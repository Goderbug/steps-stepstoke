// Synthetic transport fault tests. Actual compiler/CREATE integration: deployment-rehearsal.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { abiHash, validateHandoff, verifyHandoffAssets, loadPublicHandoff } from '../sdk/handoff.mjs';
import { verifyBoundRuntime, verifyPublicDeployment } from '../sdk/deployment.mjs';
import { EventLogCache, observeTransaction } from '../sdk/observation.mjs';
import { observeAdmission } from '../sdk/public.mjs';
import { validateReleaseState, uiCapabilities } from '../sdk/gates.mjs';
import { keccak256, sha256, toUtf8Bytes } from '../vendor/ethers/ethers.mjs';
const address = n=>'0x'+n.repeat(40), hash=n=>'0x'+n.repeat(64), bytes=s=>toUtf8Bytes(s);
function fixture() {
  const abi=[{type:'function',name:'example',inputs:[],outputs:[],stateMutability:'view'}];
  const files = new Map([['index.html',bytes('<html lang="en">LOCAL TEST ONLY</html>')],['deployment-evidence.json',bytes('{}')]]);
  const contracts=['RelayEncoder','RelayVerifier','RelayFactory'].map((name,i)=>{const abiPath=`abi/${name}.json`;files.set(abiPath,bytes(JSON.stringify(abi)));return {name,address:address(String(i+1)),abiHash:abiHash(abi),abiPath};});
  const h={version:1,launchId:'LOCAL-SYNTHETIC-TEST',chainId:1,sourceCommit:'a'.repeat(40),attestationHash:sha256(bytes('LOCAL TEST ONLY')).slice(2),contracts,assets:[...files].map(([path,raw])=>({path,sha256:sha256(raw).slice(2)}))};
  return {h,files};
}
test('canonical ABI hashes ignore object key insertion order, retain array order and require raw arrays',()=>{
  assert.equal(abiHash([{type:'function',name:'a',inputs:[]}]),abiHash([{inputs:[],name:'a',type:'function'}]));
  assert.notEqual(abiHash([{type:'a'},{type:'b'}]),abiHash([{type:'b'},{type:'a'}]));assert.throws(()=>abiHash({abi:[]}),/raw JSON array/);
});
test('handoff enforces exact named set, key/hex/path rules and hashes every final asset',async()=>{
  const {h,files}=fixture();await verifyHandoffAssets(h,p=>files.get(p));
  for(const patch of [{chainId:11155111},{factory:address('7')},{sourceCommit:'main'},{attestationHash:hash('4')},{contracts:h.contracts.slice(0,2)},{contracts:h.contracts.map(c=>({...c,address:address('2')}))}])assert.throws(()=>validateHandoff({...h,...patch}));
  for(const path of ['../x','/x','https://example/x','a//b','a/./b','imd-deployment.json'])assert.throws(()=>validateHandoff({...h,assets:[...h.assets,{path,sha256:'a'.repeat(64)}]}));
  files.set('index.html',bytes('altered final bytes'));await assert.rejects(verifyHandoffAssets(h,p=>files.get(p)),/Asset bytes mismatch/);
});
test('runtime handoff is unavailable without the real file; no alternate config is fetched',async()=>{
  const calls=[];await assert.rejects(loadPublicHandoff({fetch:async p=>{calls.push(p);return new Response('',{status:404});}}),/unavailable/);assert.deepEqual(calls,['./imd-deployment.json']);
});
test('runtime masks cannot bless arbitrary immutable address words',()=>{
  const code='0x6000'+'0'.repeat(64),patched='0x6000'+address('1').slice(2).padStart(64,'0');
  const release={runtimeChecks:{RelayFactory:{bytes:34,normalizedKeccak:keccak256(code),immutableReferences:{10:[{start:2,length:32}]},immutableBindings:{10:'encoder'}}}};
  verifyBoundRuntime(patched,'RelayFactory',release,{encoder:address('1')});
  assert.throws(()=>verifyBoundRuntime(patched,'RelayFactory',release,{encoder:address('2')}),/wrong immutable/);
  assert.throws(()=>verifyBoundRuntime('0x6001'+patched.slice(6),'RelayFactory',release,{encoder:address('1')}),/code mismatch/);
});
test('public deployment rejects wrong chain and mismatched source/compiler before receipt claims',async()=>{
  const {h}=fixture();const p={request:async()=> '0x7a69'};
  await assert.rejects(verifyPublicDeployment(p,h,{},{}),/Wrong chain/);
  const evidence={sourceCommit:h.sourceCommit,attestationHash:h.attestationHash,blockNumber:10,transactionHash:hash('5'),blockHash:hash('6'),build:{compiler:'wrong'}};
  await assert.rejects(verifyPublicDeployment({request:async()=> '0x1'},h,evidence,{frozenBuild:{compiler:'0.8.26'}}),/frozen build/);
});
test('incremental cache progresses in bounded pages, reuses head and invalidates on a reorg',async()=>{
  let fork='a',head=14;const ranges=[];
  const p={request:async({method,params})=>{
    if(method==='eth_blockNumber')return '0x'+head.toString(16);
    if(method==='eth_getBlockByNumber')return {number:params[0],hash:hash(fork)};
    if(method==='eth_getLogs'){const f=params[0];ranges.push([Number(BigInt(f.fromBlock)),Number(BigInt(f.toBlock))]);return [{blockNumber:f.fromBlock,logIndex:'0x0',blockHash:hash(fork)}];}
    throw Error(method);
  }};
  const c=new EventLogCache({identity:'public:1:LOCAL_TEST_FACTORY:LOCAL_ATTESTATION',deploymentBlock:10,maxBlocksPerRead:3});
  assert.equal((await c.read(p,address('1'))).complete,false);assert.equal((await c.read(p,address('1'))).complete,true);await c.read(p,address('1'));
  assert.deepEqual(ranges,[[10,12],[13,14]]);fork='b';const r=await c.read(p,address('1'));assert.equal(r.complete,false);assert.equal(r.logs.length,1);assert.equal(r.logs[0].blockHash,hash('b'));
  const independent=new EventLogCache({identity:'local:31337:OTHER_FACTORY',deploymentBlock:10,maxBlocksPerRead:3});await independent.read(p,address('1'));assert.equal(ranges.at(-1)[0],10);
});
test('receipt finality and original hash are canonical, never a nonce-based rebuy decision',async()=>{
  let head=100,blockHash=hash('a');const receipt={transactionHash:hash('1'),blockNumber:'0x64',blockHash:hash('a'),status:'0x1'};
  const p={request:async({method})=>method==='eth_getTransactionReceipt'?receipt:method==='eth_blockNumber'?'0x'+head.toString(16):{number:'0x64',hash:blockHash}};
  assert.equal((await observeTransaction(p,hash('1'))).state,'MINED_UNFINALIZED');head=111;assert.equal((await observeTransaction(p,hash('1'))).state,'CONFIRMED');blockHash=hash('b');assert.equal((await observeTransaction(p,hash('1'))).state,'REORGED');
  await assert.rejects(observeTransaction(p,hash('2')),/Receipt hash mismatch/);
});
test('official admission and job reads correlate request, payer and job while Git stays independent',async()=>{
  const expected={chainId:1,transactionHash:hash('1'),requestId:hash('2'),payer:address('3'),intake:address('4')};
  const e={requestId:expected.requestId,payer:expected.payer,intake:expected.intake,callback:{target:expected.payer},state:'admitted',admission:{result:{kind:'job',jobId:'local-job-test',statusUrl:'https://evil.test/'}}};
  const body={chainId:1,transactionHash:expected.transactionHash,entries:[e]};let paidBy=expected.payer;const urls=[];
  const fetch=async url=>{urls.push(url);return Response.json(url.includes('/intake/')?body:{id:'local-job-test',paidBy,state:'running',delivery:{failure:'not delivered'}});};
  const r=await observeAdmission(expected,{fetch});assert.equal(r.settlement,false);assert.equal(r.execution,'running');assert.equal(r.git.failure,'not delivered');assert.ok(urls[1].endsWith('/jobs/local-job-test'));
  paidBy=address('5');await assert.rejects(observeAdmission(expected,{fetch}),/Job\/payer/);
  await assert.rejects(observeAdmission({...expected,requestId:hash('7')},{fetch}),/Missing or ambiguous/);
  body.chainId=4663;await assert.rejects(observeAdmission(expected,{fetch}),/identity mismatch/);
});
test('verified deployment alone permits reads, never spending or a PASS profile',()=>{
  const g={productionDeployment:null,productionReady:false,liveCompatibility:'NOT_RUN',gates:Object.fromEntries(['securityReview','runtimeChildPolicy','manifestCompatibility','gasCeilings','liveExecution','deploymentVerification'].map(k=>[k,{status:'OPEN',evidence:[]}]))};
  validateReleaseState(g,g);assert.equal(uiCapabilities({verified:true,gate:g}).read,true);assert.equal(uiCapabilities({verified:true,gate:g}).realWalletSigning,false);
  assert.throws(()=>validateReleaseState({...g,productionReady:true},g),/Undeployed/);
});
test('deployed but unvalidated state remains valid and read-only; live PASS needs every profile',()=>{
  const d={factory:address('1'),encoder:address('2'),verifier:address('3'),transactionHash:hash('4'),blockHash:hash('5'),blockNumber:10,sourceCommit:'a'.repeat(40),attestationHash:'b'.repeat(64)};
  const g={productionDeployment:d,productionReady:false,liveCompatibility:'NOT_RUN',gates:Object.fromEntries(['securityReview','runtimeChildPolicy','manifestCompatibility','gasCeilings','liveExecution','deploymentVerification'].map(k=>[k,{status:'OPEN',evidence:[]}]))};
  assert.equal(validateReleaseState(g,g).deployment,'EVIDENCE_REQUIRED');
  assert.equal(uiCapabilities({verified:true,gate:g}).realWalletSigning,false);
  const pass={...g,liveCompatibility:'PASS'};
  assert.throws(()=>validateReleaseState(pass,pass),/Profile 0/);
  const profiles=Object.fromEntries([0,1,2,3,4].map(id=>[id,{status:'PASS',evidence:['LOCAL TEST ONLY']}])) ;
  const profiled={...pass,profiles};validateReleaseState(profiled,profiled);
  assert.equal(uiCapabilities({verified:true,gate:profiled}).realWalletSigning,false);
  assert.throws(()=>validateReleaseState(g,{...g,productionDeployment:{...d,blockNumber:11}}),/state differs/);
});
