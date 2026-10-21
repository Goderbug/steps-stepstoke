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
 const mined=async pending=>{const sent=await pending;let r;for(let i=0;i<300;i++){r=await provider.send('eth_getTransactionReceipt',[sent.hash]);if(r)break;await new Promise(ok=>setTimeout(ok,25));}assert.ok(r,'receipt absent; no resend');assert.equal(r.status,'0x1');return r;};
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
 for(let shape=0;shape<8;shape++){
  if(shape){assert.ok(await provider.send('evm_revert',[checkpoint]));checkpoint=await provider.send('evm_snapshot',[]);}
  // Restored storage returns to revision 16; every shape uses the same full, original witness.
  const logs=await provider.getLogs({address,fromBlock:0,toBlock:'latest',topics:[sdk.interfaces.branch.getEvent('CheckpointWritten').topicHash]});current=sdk.decodeCheckpoint(logs.at(-1)).witness;
  const p={anchor:await branch.anchor(),profile:1,target:toBeHex(1,32),inputs:[toBeHex(1,32)],outputName:current[0].name,outputPath:current[0].path,text:'Perform the declared change.',publish:false};
  let raw=rawManifest(p,'metadata-limits-job');let source;
  const target=shape===0?26180:shape===1?15648:32768;
  if(shape===0)source='[{'+Array.from({length:110},(_,i)=>`"k${i}":0`).join(',')+'}]';
  if(shape===1)source='['+Array(498).fill('0').join(',')+']';
  if(shape===2)source='{'+Array.from({length:8},(_,i)=>'"'+('\\u004'+String(i+1)).repeat(i<7?256:179)+'":0').join(',')+'}';
  if(shape<3){raw=raw.replace('"source":[]','"source":'+source+',"padding":""');const n=target-raw.length;const pad=shape===1?'\\u00e9'.repeat(Math.floor(n/6))+'a'.repeat(n%6):'a'.repeat(n);raw=raw.replace('"padding":""','"padding":"'+pad+'"');}
  if(shape===3)raw=raw.replace('"source":[]','"source":'+'1'.repeat(target-raw.length+2));
  if(shape===4)raw+=' '.repeat(target-raw.length);
  if(shape>=5) {
    raw=rawManifest(p,'metadata-limits-job');
    if(shape<7) {
      const available=32768-raw.length-23;
      source='['+Array.from({length:8},(_,i)=>{const n=Math.floor(available/8)+(i<available%8?1:0);return '"'+(shape===6?'\\u00e9'.repeat(Math.floor(n/6))+'a'.repeat(n%6):'a'.repeat(n))+'"';}).join(',')+']';
    } else {
      const wide=padding=>'['+Array.from({length:3},(_,i)=>'{'+Array.from({length:32},(_,j)=>'"k'+j+'":"'+'a'.repeat(Math.floor(padding/96)+(i*32+j<padding%96?1:0))+'"').join(',')+'}').join(',')+']';
      source=wide(32768-raw.length-wide(0).length+2);
    }
    raw=raw.replace('"source":[]','"source":'+source);
  }
  assert.equal(raw.length,target);
  await bind(p,raw,['110-key combined complexity','498-value escaped-unicode combined complexity','maximum escaped key bytes','maximum ignored number','maximum whitespace','maximum ASCII strings','maximum escaped strings','maximum wide objects'][shape]);
 }
 console.log(JSON.stringify(out,null,2));
} finally {provider.destroy();anvil.kill();}
