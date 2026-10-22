// Synthetic fault injection. No wallet, paid endpoint, deployment or public write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicReadProvider, validatePublicRpcPolicy, defaultPublicRpcPolicy, PUBLIC_RPC_POLICY_ASSET } from '../sdk/public-rpc.mjs';
import { verifyPublicDeployment } from '../sdk/deployment.mjs';
import { abiHash, loadPublicHandoff } from '../sdk/handoff.mjs';
import { keccak256, sha256, toUtf8Bytes } from '../vendor/ethers/ethers.mjs';
const urls=['https://primary.example/','https://fallback.example/'];
const hash=n=>'0x'+n.repeat(64), addr=n=>'0x'+n.repeat(40);
function transport(route, options={}) {
  const calls=[];
  const provider=createPublicReadProvider({rpcUrls:urls,fetch:async(url,init)=>{
    const request=JSON.parse(init.body);calls.push({url,...request});
    assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');
    const result=await route(url,request,init);
    return result instanceof Response ? result : Response.json({jsonrpc:'2.0',id:request.id,...result});
  },...options});
  return {provider,calls};
}
test('bounded policy rejects duplicate, private, credentialled, token and excessive endpoints',()=>{
  for(const rpcUrls of [[],[...urls,...urls],['http://rpc.example'],['https://user:secret@rpc.example'],['https://rpc.example?key=secret'],['https://rpc.example/#secret'],['https://127.0.0.1'],['https://10.1.2.3'],['https://[::1]'],['https://localhost'],['https://a.local'],['https://primary.example','https://primary.example/']]) assert.throws(()=>validatePublicRpcPolicy({version:1,chainId:1,rpcUrls}));
  assert.throws(()=>validatePublicRpcPolicy({version:1,chainId:1,rpcUrls:urls,privateKey:'not accepted'}));
  assert.equal(defaultPublicRpcPolicy().rpcUrls.length,2);
});
test('unsupported method falls back once, verifies fallback chain and reuses capable endpoint',async()=>{
  const {provider,calls}=transport((url,r)=>r.method==='eth_chainId'?{result:'0x1'}:url===urls[0]?{error:{code:-32601,message:'method unavailable'}}:{result:{type:'CALL',calls:[]}});
  const request={method:'debug_traceTransaction',params:[hash('1'),{tracer:'callTracer'}]};
  assert.equal((await provider.request(request)).type,'CALL');
  assert.deepEqual(calls.map(c=>[c.url,c.method]),[[urls[0],'eth_chainId'],[urls[0],'debug_traceTransaction'],[urls[1],'eth_chainId'],[urls[1],'debug_traceTransaction']]);
  await provider.request(request);assert.equal(calls.at(-1).url,urls[1]);assert.equal(calls.length,5);
});
test('HTTP/archive failure falls back; all unavailable is bounded and never yields empty data',async()=>{
  const a=transport((url,r)=>r.method==='eth_chainId'?{result:'0x1'}:url===urls[0]?new Response('archive access unavailable',{status:403}):{result:'0x6000'});
  assert.equal(await a.provider.request({method:'eth_getCode',params:[addr('1'),'0x10']}),'0x6000');
  const b=transport(()=>new Response('overloaded',{status:503}));
  await assert.rejects(b.provider.request({method:'eth_blockNumber'}),/Public RPC unavailable/);assert.equal(b.calls.length,2);
});
test('wrong-chain fallback, semantic reverts and malformed envelopes fail closed without shopping providers',async()=>{
  const wrong=transport((url,r)=>url===urls[0]?new Response('',{status:503}):{result:'0xaa36a7'});
  await assert.rejects(wrong.provider.request({method:'eth_getCode',params:[addr('1'),'latest']}),/Wrong chain/);
  assert.ok(wrong.calls.every(c=>c.method==='eth_chainId'));
  for(const answer of [{error:{code:3,message:'execution reverted'}},
    {error:{code:-32603,message:'execution reverted',data:'0x08c379a0'}},
    {error:{code:-32603,message:'Internal JSON-RPC error.',data:{code:3,message:'execution reverted',data:'0x08c379a0'}}},
    {error:{code:-32000,message:'missing trie node',data:{message:'execution reverted'}}},
    {error:{code:-32603,message:'Internal JSON-RPC error.'}},
    {jsonrpc:'2.0',id:999,result:'0x6000'},{result:'0x6000',error:{code:-32601,message:'ambiguous'}}]) {
    const t=transport((_url,r)=>r.method==='eth_chainId'?{result:'0x1'}:answer);
    await assert.rejects(t.provider.request({method:'eth_call',params:[{},'latest']}));
    assert.ok(t.calls.every(c=>c.url===urls[0]));
  }
});
test('null receipts, empty code and returned trace errors never cause fallback',async()=>{
  for(const result of [null,'0x',{type:'CALL',error:'execution reverted'}]) {
    const t=transport((_url,r)=>r.method==='eth_chainId'?{result:'0x1'}:{result});
    assert.deepEqual(await t.provider.request({method:'eth_getTransactionReceipt',params:[hash('1')]}),result);
    assert.ok(t.calls.every(c=>c.url===urls[0]));
  }
});
test('non-2xx JSON-RPC semantic and identity failures never become availability retries',async()=>{
  const errors=[{code:3,message:'execution reverted',data:'0x08c379a0'},
    {code:-32603,message:'Internal JSON-RPC error.',data:{code:3,message:'execution reverted'}},
    {code:-32603,message:'Internal JSON-RPC error.'},null];
  for(const error of errors){
    const t=transport((_u,r)=>r.method==='eth_chainId'?{result:'0x1'}:Response.json({jsonrpc:'2.0',id:r.id,error},{status:500}));
    await assert.rejects(t.provider.request({method:'eth_call',params:[{},'latest']}));
    assert.ok(t.calls.every(c=>c.url===urls[0]));
  }
  const mismatch=transport((_u,r)=>r.method==='eth_chainId'?{result:'0x1'}:Response.json({jsonrpc:'2.0',id:r.id+1,error:{code:-32601,message:'method unavailable'}},{status:500}));
  await assert.rejects(mismatch.provider.request({method:'eth_call'}),/identity mismatch/);
  assert.ok(mismatch.calls.every(c=>c.url===urls[0]));
});
test('bounded HTTP archive denial and response-stream failure still use another public endpoint',async()=>{
  for(const mode of ['archive','stream']){
    const t=transport((url,r)=>{
      if(r.method==='eth_chainId')return {result:'0x1'};
      if(url===urls[1])return {result:'0x6000'};
      if(mode==='archive')return Response.json({jsonrpc:'2.0',id:r.id,error:{code:-32602,message:'Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode'}},{status:403});
      return new Response(new ReadableStream({start(c){c.error(new Error('interrupted'));}}));
    });
    assert.equal(await t.provider.request({method:'eth_getCode',params:[addr('1'),'0x10']}),'0x6000');
    assert.equal(t.calls.at(-1).url,urls[1]);
  }
});
test('public transport refuses signing, account access and custom tracing before fetching',async()=>{
  const t=transport(()=>{throw Error('must not fetch');});
  for(const method of ['eth_sendTransaction','eth_sendRawTransaction','eth_accounts','personal_sign','wallet_switchEthereumChain']) await assert.rejects(t.provider.request({method}),/Read-only/);
  await assert.rejects(t.provider.request({method:'debug_traceTransaction',params:[hash('1'),{tracer:'arbitrary code'}]}),/callTracer/);
  assert.equal(t.calls.length,0);
});
test('network timeout, redirect and response size are bounded',async()=>{
  const timeout=transport(async(_u,_r,init)=>new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(init.signal.reason));}),{timeoutMs:5});
  // Keep the event loop alive because AbortSignal.timeout uses an unref'ed timer in Node.
  const timer=setTimeout(()=>{},1000);
  try { await assert.rejects(timeout.provider.request({method:'eth_chainId'}),/Public RPC unavailable/); } finally {clearTimeout(timer);}
  assert.equal(timeout.calls.length,2);
  const large=transport((_u,r)=>r.method==='eth_chainId'?{result:'0x1'}:new Response('x'.repeat(8*1024*1024+1)));
  await assert.rejects(large.provider.request({method:'eth_blockNumber'}),/response too large/);
  const redirected=createPublicReadProvider({rpcUrls:urls,fetch:async()=>({redirected:true})});
  await assert.rejects(redirected.request({method:'eth_chainId'}),/redirect refused/);
});

function deploymentFixture() {
  const abi=[];
  const contracts=['RelayEncoder','RelayVerifier','RelayFactory'].map((name,i)=>({name,address:addr(String(i+1)),abiHash:abiHash(abi),abiPath:`abi/${name}.json`}));
  const h={version:1,launchId:'SYNTHETIC_LOCAL_ONLY',chainId:1,sourceCommit:'a'.repeat(40),attestationHash:'b'.repeat(64),contracts,
    network:{rpcUrl:urls[0],unchanged:'official input'},assets:[]};
  const runtime='0x6000',creation='0x6001';
  const release={frozenBuild:{compiler:'SYNTHETIC_TEST'},contracts:Object.fromEntries(contracts.map(c=>[c.name,{creationCodeHash:keccak256(creation)}])),
    runtimeChecks:Object.fromEntries(contracts.map(c=>[c.name,{bytes:2,normalizedKeccak:keccak256(runtime),immutableReferences:{},immutableBindings:{}}]))};
  const evidence={sourceCommit:h.sourceCommit,attestationHash:h.attestationHash,blockNumber:10,transactionHash:hash('5'),blockHash:hash('6'),build:release.frozenBuild};
  const files=new Map([['index.html',toUtf8Bytes('SYNTHETIC LOCAL TEST')],['deployment-evidence.json',toUtf8Bytes(JSON.stringify(evidence))],...contracts.map(c=>[c.abiPath,toUtf8Bytes('[]')])]);
  const inventory=()=>{h.assets=[...files].map(([path,b])=>({path,sha256:sha256(b).slice(2)}));files.set('imd-deployment.json',toUtf8Bytes(JSON.stringify(h)));};
  const receipt={transactionHash:evidence.transactionHash,status:'0x1',blockNumber:'0xa',blockHash:evidence.blockHash};
  const block={number:'0xa',hash:evidence.blockHash,transactions:[evidence.transactionHash]};
  const trace={type:'CALL',calls:contracts.map(c=>({type:'CREATE2',to:c.address,input:creation+(c.name==='RelayFactory'?contracts[0].address.slice(2).padStart(64,'0')+contracts[1].address.slice(2).padStart(64,'0'):''),output:runtime}))};
  const route=(url,r)=>{
    if(r.method==='eth_chainId')return {result:'0x1'};
    if(r.method==='eth_getTransactionReceipt')return {result:receipt};
    if(r.method==='eth_getBlockByNumber')return {result:block};
    if(r.method==='debug_traceTransaction')return url===urls[0]?{error:{code:-32601,message:'unavailable'}}:{result:trace};
    if(r.method==='eth_getCode')return url===urls[0]?new Response('',{status:403}):{result:r.params[1]==='0x9'?'0x':runtime};
    throw Error('Unexpected '+r.method);
  };
  inventory();return {h,files,evidence,release,trace,receipt,block,route,inventory};
}
test('complete deployment verifier survives unavailable trace/archive primary without dropping any check',async()=>{
  const f=deploymentFixture(),{provider,calls}=transport(f.route);
  const result=await verifyPublicDeployment(provider,f.h,f.evidence,f.release);
  assert.equal(result.validity,'VERIFIED_DEPLOYMENT');assert.equal(result.productionReady,false);
  assert.equal(calls.filter(r=>r.method==='eth_getCode'&&r.url===urls[1]).length,9);
  assert.equal(calls.filter(r=>r.method==='eth_getBlockByNumber').length,2);
  assert.equal(calls.filter(r=>r.method==='eth_getTransactionReceipt').length,2);
});
test('fallback trace, constructor, code, source and receipt tampering are still rejected',async()=>{
  const changes=[f=>{f.trace.calls[0].input='0x6002';},f=>{f.trace.calls[2].input=f.trace.calls[2].input.slice(0,-1)+'9';},f=>{f.trace.calls[1].output='0x6003';},f=>{f.evidence.sourceCommit='c'.repeat(40);},f=>{f.receipt.blockHash=hash('7');}];
  for(const change of changes){const f=deploymentFixture();change(f);await assert.rejects(verifyPublicDeployment(transport(f.route).provider,f.h,f.evidence,f.release));}
});
test('deployment reorg during fallback verification cannot publish a verified result',async()=>{
  const f=deploymentFixture();let blocks=0;
  const t=transport((url,r)=>r.method==='eth_getBlockByNumber'&&++blocks===2?{result:{...f.block,hash:hash('7')}}:f.route(url,r));
  await assert.rejects(verifyPublicDeployment(t.provider,f.h,f.evidence,f.release),/changed during verification/);
});
test('handoff hashes transport policy, rejects tampering, and never mutates official network',async()=>{
  const f=deploymentFixture();const original=JSON.stringify(f.h.network);
  // Remove previous manifest from the content map before rebuilding inventory.
  f.files.delete('imd-deployment.json');
  f.files.set(PUBLIC_RPC_POLICY_ASSET,toUtf8Bytes(JSON.stringify({version:1,chainId:1,rpcUrls:urls})));f.inventory();
  const fetch=async p=>new Response(f.files.get(p.slice(2)));
  const loaded=await loadPublicHandoff({fetch});assert.deepEqual(loaded.rpcURLs,urls);assert.equal(JSON.stringify(loaded.handoff.network),original);
  f.files.set(PUBLIC_RPC_POLICY_ASSET,toUtf8Bytes(JSON.stringify({version:1,chainId:1,rpcUrls:['https://different.example/']})));
  await assert.rejects(loadPublicHandoff({fetch}),/Asset bytes mismatch: public-read-transport/);
});
