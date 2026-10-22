#!/usr/bin/env node
// Real local transactions for the full 16-asset witness and prior near-14M parser shapes.
// Own disposable Anvil only; no keys, public RPC, live IMD or worker work.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { Contract, ContractFactory, JsonRpcProvider, keccak256, sha256, toBeHex, Interface } from '../vendor/ethers/ethers.mjs';
import * as sdk from '../sdk/index.mjs';
import { transactionMetrics } from './transaction-metrics.mjs';
const root=new URL('../',import.meta.url), artifact=async n=>JSON.parse(await readFile(new URL(`out/${n}.sol/${n}.json`,root)));
const release=JSON.parse(await readFile(new URL('config/release.json',root)));
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;await new Promise(r=>probe.close(r));
const anvil=spawn('anvil',['--host','127.0.0.1','--port',String(port),'--hardfork','prague','--gas-limit','60000000','--silent'],{stdio:'ignore'});
const provider=new JsonRpcProvider(`http://127.0.0.1:${port}`,31337,{cacheTimeout:-1,staticNetwork:true});provider.pollingInterval=20;
const fee=500000000000000000n, gasLimit=16777216n, transactions=[];
const out={scope:'LOCAL_MOCK_ONLY; Prague full transactions',productionDeployment:null,liveCompatibility:'NOT_RUN',productionReady:false,transactionGasCeiling:16777216,serviceGasCeiling:null,measurements:[]};
try {
 for(let i=0;;i++){try{await provider.send('eth_chainId',[]);break;}catch(e){if(i>100)throw e;await new Promise(r=>setTimeout(r,25));}}
 const signer=await provider.getSigner(0), writer=await provider.getSigner(1), treasury=await provider.getSigner(2);
 const mined=async pending=>{const sent=await pending;let r;for(let i=0;i<300;i++){r=await provider.send('eth_getTransactionReceipt',[sent.hash]);if(r)break;await new Promise(ok=>setTimeout(ok,25));}assert.ok(r,'receipt absent; no resend');if(r.status!=='0x1'){const err=new Error('Local transaction reverted');err.receipt=r;err.transaction=await provider.send('eth_getTransactionByHash',[sent.hash]);err.trace=await provider.send('debug_traceTransaction',[sent.hash,{tracer:'callTracer'}]);throw err;}return r;};
 const deploy=async(n,args=[])=>{const a=await artifact(n);const c=await new ContractFactory(a.abi,a.bytecode.object,signer).deploy(...args,{gasLimit});await mined(c.deploymentTransaction());return c;};
 const tokenA=await artifact('MockToken'),intakeA=await artifact('MockIntake');
 await provider.send('anvil_setCode',[release.imd,tokenA.deployedBytecode.object]);await provider.send('anvil_setCode',[release.intake,intakeA.deployedBytecode.object]);
 const token=new Contract(release.imd,tokenA.abi,signer),intake=new Contract(release.intake,intakeA.abi,signer);
 await mined(intake.initialize(await writer.getAddress(),await treasury.getAddress(),release.imd));for(const action of Object.values(release.actions))await mined(intake.setPrice(action,fee));await mined(token.mint(await signer.getAddress(),100n*fee));
 const e=await deploy('RelayEncoder'),v=await deploy('RelayVerifier'),f=await deploy('RelayFactory',[await e.getAddress(),await v.getAddress()]);
 const goal='G'.repeat(512);
 const created=await mined(f.createProject(goal,{gasLimit}));
 const address=created.logs.map(l=>{try{return sdk.interfaces.factory.parseLog(l)}catch{return null}}).find(e=>e?.name==='BranchCreated').args.branch;
 const branch=new Contract(address,sdk.interfaces.branch,signer);await mined(token.approve(address,100n*fee));
 let current=[];
 const rawManifest=(p,job)=>JSON.stringify({jobId:job,projectId:'metadata-project',state:'completed',source:[],files:[{name:p.outputName,path:p.outputPath,hash:sha256(new TextEncoder().encode('local-fixture-content')).slice(2),mediaType:['text/markdown','text/markdown','text/html','text/html','image/png'][p.profile],bytes:83,submissionHash:sha256(new TextEncoder().encode('local-fixture-submission')).slice(2)}]});
 const bind=async(p,raw,label)=>{
  await mined(branch.propose(p,current,{gasLimit}));const id=await branch.proposalCount();await mined(branch.sponsor(id,fee,current,{gasLimit}));const a=await branch.attempt(await branch.activeAttempt());
  await mined(intake.connect(writer).complete(a.requestId,new TextEncoder().encode(raw),{gasLimit:2000000}));assert.equal(await branch.phase(),3n);
  const data=sdk.bindResult(address,new TextEncoder().encode(raw),keccak256(new TextEncoder().encode(raw)),current).data;
  const r=await mined(signer.sendTransaction({to:address,data,gasLimit}));
  const log=r.logs.find(l=>{try{return sdk.interfaces.branch.parseLog(l)?.name==='CheckpointWritten'}catch{return false}});current=sdk.decodeCheckpoint(log).witness;
  if(label)out.measurements.push({label,rawBytes:new TextEncoder().encode(raw).length,witnessAssets:current.length,...transactionMetrics(data,BigInt(r.gasUsed),false,gasLimit),hash:r.transactionHash,calldata:data,rawResult:raw});
 };
 for(let i=1;i<=16;i++){
  const profile=i<=14?0:i===15?2:4;
  const p={anchor:await branch.anchor(),profile,target:toBeHex(i,32),inputs:[],outputName:String.fromCharCode(65+i).repeat(64),outputPath:i<=14?'artifacts/'+String.fromCharCode(97+i).repeat(115)+'.md':i===15?'artifacts/index.html':'artifacts/'+'a'.repeat(114)+'.png',text:'Perform the declared change.',publish:false};
  await bind(p,rawManifest(p,String.fromCharCode(65+i).repeat(64)),null);
 }
 // Full direct-child worst shape: maximum goal/direction and complete maximum-width witness.
 const cp=await branch.checkpoint(16),direction='D'.repeat(512);
 const fork=sdk.forkHistory(await f.getAddress(),address,16,current,direction);
 const forkReceipt=await mined(signer.sendTransaction({...fork,gasLimit}));
 const childAddress=forkReceipt.logs.map(l=>{try{return sdk.interfaces.factory.parseLog(l)}catch{return null}}).find(e=>e?.name==='BranchCreated').args.branch;
 assert.equal(await f.registered(childAddress),true);
 const branchArtifact=await artifact('RelayBranch');
 const childInitcode=branchArtifact.bytecode.object+new Interface(branchArtifact.abi).encodeDeploy([await e.getAddress(),await v.getAddress(),goal,direction,{parent:address,revision:16,checkpoint:cp.digest},cp.projectHash,sdk.witnessHash(current),current]).slice(2);
 assert.ok((childInitcode.length-2)/2<=49152,'runtime child initcode bound');
 const rootTx=await provider.send('eth_getTransactionByHash',[created.transactionHash]);
 out.runtimeCreations=[{label:'maximum 512-byte root goal',...transactionMetrics(rootTx.input,BigInt(created.gasUsed),false,BigInt(rootTx.gas)),calldata:rootTx.input,hash:created.transactionHash},{label:'full 16-asset fork with 512-byte goal and direction',...transactionMetrics(fork.data,BigInt(forkReceipt.gasUsed),false,gasLimit),calldata:fork.data,hash:forkReceipt.transactionHash,childInitcodeBytes:(childInitcode.length-2)/2,childInitcodeKeccak:keccak256(childInitcode),childInitcode}];
 const snapshot=await provider.send('evm_snapshot',[]);
 let checkpoint=snapshot;
 for (const variant of ['utf8-retained','utf8-three','utf8-four','escaped-retained','escaped-surrogates','simple-escapes']) {
  assert.ok(await provider.send('evm_revert',[checkpoint]));checkpoint=await provider.send('evm_snapshot',[]);
  const logs=await provider.getLogs({address,fromBlock:0,toBlock:'latest',topics:[sdk.interfaces.branch.getEvent('CheckpointWritten').topicHash]});current=sdk.decodeCheckpoint(logs.at(-1)).witness;
  const p={anchor:await branch.anchor(),profile:1,target:toBeHex(1,32),inputs:[toBeHex(1,32)],outputName:current[0].name,outputPath:current[0].path,text:'Perform the declared change.',publish:false};
  const base=JSON.parse(rawManifest(p,'metadata-limits-job'));
  let raw;
  if (variant==='utf8-keys') {
    base.source=Object.fromEntries(Array.from({length:7},(_,i)=>['é'.repeat(127)+i,0]));
    raw=JSON.stringify(base);
  } else {
    const shapes={'utf8-retained':['é',500,15],'utf8-three':['水',333,15],'utf8-four':['🚀',250,15],'escaped-retained':['é',500,5],'escaped-surrogates':['🚀',250,5],'simple-escapes':['\n',1000,7]};
    const [scalar,repetitions,count]=shapes[variant]; const chars=scalar.repeat(repetitions);
    for(let i=0;i<count;i++)base.files.push({name:chars+i,path:chars+i});
    raw=JSON.stringify(base);
    if(variant==='escaped-retained')raw=raw.replace(/é/g,'\\u00e9');
    if(variant==='escaped-surrogates')raw=raw.replace(/🚀/gu,'\\uD83D\\uDE80');
  }
  raw += ' '.repeat(32768-Buffer.byteLength(raw));
  assert.equal(Buffer.byteLength(raw),32768);
  sdk.verifyManifest(new TextEncoder().encode(raw),keccak256(new TextEncoder().encode(raw)),p);
  if(variant==='utf8-retained')assert.equal(sha256(new TextEncoder().encode(raw)),'0x8768318db71105397ac89eef44af007752b94e966eb8adebd237a2b97c9de805','Original rejected manifest bytes must stay identical');
  try {
    await bind(p,raw,variant);
    console.error(JSON.stringify({variant,status:'PASS',gas:out.measurements.at(-1).gasUsed}));
  } catch(e) {
    const failed={label:variant,status:'FAIL_AT_ETHEREUM_TRANSACTION_CEILING',error:String(e),rawBytes:Buffer.byteLength(raw),phase:String(await branch.phase()),failedReceipt:e.receipt??null,failedTransaction:e.transaction??null,failedTrace:e.trace??null};
    console.error(JSON.stringify(failed));
    if(await branch.phase()===3n) {
      const data=sdk.bindResult(address,new TextEncoder().encode(raw),keccak256(new TextEncoder().encode(raw)),current).data;
      try {const r=await mined(signer.sendTransaction({to:address,data,gasLimit:50000000n}));failed.overCeilingDiagnostic={classification:'DISPOSABLE_LOCAL_ONLY: DECLARED GAS LIMIT EXCEEDS ETHEREUM 16777216; NOT A VALID PRODUCT TRANSACTION',...transactionMetrics(data,BigInt(r.gasUsed),false,50000000n),receipt:r,phase:String(await branch.phase()),calldata:data};}
      catch(diagnostic){failed.overCeilingDiagnosticError=String(diagnostic);}
    }
    out.measurements.push(failed);
  }
 }
 console.log(JSON.stringify(out,null,2));
 assert.ok(out.measurements.length===6 && out.measurements.every(m=>!m.status && m.gasUsed < 16777216),'Every complete binding must pass below the transaction ceiling');
} finally {provider.destroy();anvil.kill();}
