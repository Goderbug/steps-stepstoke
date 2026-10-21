#!/usr/bin/env node
// Starts its OWN empty disposable node. No RPC argument, keys, public chain or public broadcasts.
// Replays the documented three-name CREATE2 batch with backward dependency references.
import assert from 'node:assert/strict';
import { observeDeployment, verifyRuntime } from '../sdk/config.mjs';
import { execFileSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importDeployment } from './import-deployment.mjs';
import { abiHash, verifyHandoffAssets } from '../sdk/handoff.mjs';
import { verifyBoundRuntime } from '../sdk/deployment.mjs';
import { readFile } from 'node:fs/promises';
import { Interface, AbiCoder, keccak256, toUtf8Bytes, getCreate2Address } from '../vendor/ethers/ethers.mjs';
const root=new URL('../',import.meta.url), coder=AbiCoder.defaultAbiCoder();
const artifact=async(name,file=name)=>JSON.parse(await readFile(new URL(`out/${file}.sol/${name}.json`,root)));
const portProbe=createServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));
const node=spawn('anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','1','--hardfork','prague','--gas-limit','60000000','--silent'],{stdio:'ignore'});
let id=0;const rpc=async(method,params=[])=>{const r=await fetch(`http://127.0.0.1:${port}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(15000)});const b=await r.json();if(b.error)throw Error(b.error.message);return b.result;};
export function calldataMetrics(data,creation=false) {
 const b=Buffer.from(data.slice(2),'hex');const zero=[...b].filter(x=>x===0).length;const tokens=zero+4*(b.length-zero);
 return {calldataBytes:b.length,zeroBytes:zero,nonzeroBytes:b.length-zero,intrinsicGas:21000+tokens*4+(creation?32000+2*Math.ceil(b.length/32):0),eip7623Floor:21000+tokens*10};
}
try {
 for(let n=0;;n++){try{await rpc('eth_chainId');break;}catch(e){if(n===100)throw e;await new Promise(r=>setTimeout(r,25));}}
 assert.equal(await rpc('eth_chainId'),'0x1');const [actor]=await rpc('eth_accounts');const receipts=[];
 const send=async(label,tx)=>{const hash=await rpc('eth_sendTransaction',[{from:actor,gas:'0x'+(16777216).toString(16),...tx}]);
   let r; for(let n=0;n<200;n++){r=await rpc('eth_getTransactionReceipt',[hash]);if(r)break;await new Promise(resolve=>setTimeout(resolve,25));} if(!r)throw Error('Original local transaction pending; no retry'); assert.equal(r.status,'0x1',label);
   const metrics=calldataMetrics(tx.data,!tx.to);const total=Number(BigInt(r.gasUsed));
   receipts.push({label,hash,blockNumber:Number(BigInt(r.blockNumber)),gasUsed:total,declaredGasLimit:16777216,...metrics,netExecutionGas:total-metrics.intrinsicGas,rawTransaction:tx,receipt:r});return r;};
 const e=await artifact('RelayEncoder'),v=await artifact('RelayVerifier'),f=await artifact('RelayFactory'),p=await artifact('NamedBatchProbe','LaunchCompatibility.t');
 // Empty-chain simulation: the two dependency addresses have no code. Nonzero/distinct is all
 // this constructor may require. These are local ephemeral actors, never a proposed manifest.
 const actors=await rpc('eth_accounts');
 for(const [name,a,args] of [['RelayEncoder',e,[]],['RelayVerifier',v,[]],['RelayFactory',f,[actors[1],actors[2]]]]){
  const data=a.bytecode.object+new Interface(a.abi).encodeDeploy(args).slice(2);
  const returned=await rpc('eth_call',[{from:actor,data},'latest']);assert.ok(returned.length>2,name);
 }
 const probeReceipt=await send('deploy local batch probe',{data:p.bytecode.object});const probe=probeReceipt.contractAddress;
 const document=await readFile(new URL('docs/CONTRACTS.md',root),'utf8');
 const proposedManifest=JSON.parse(document.match(/```json\n([\s\S]*?)\n```/u)[1]);
 assert.equal(proposedManifest.kind,'evm_contracts');
 assert.deepEqual(proposedManifest.contracts.map(c=>c.contract),['RelayEncoder','RelayVerifier','RelayFactory']);
 assert.deepEqual(proposedManifest.contracts.map(c=>c.constructorArgs),[[],[],['$contract:RelayEncoder','$contract:RelayVerifier']]);
 const salts=[],addresses=[],codes=[],resolved={};
 for(const entry of proposedManifest.contracts) {
  const a={RelayEncoder:e,RelayVerifier:v,RelayFactory:f}[entry.contract];
  const args=entry.constructorArgs.map(ref=>{assert.ok(ref.startsWith('$contract:'));const value=resolved[ref.slice(10)];assert.ok(value,'backward reference only');return value;});
  const salt=keccak256(toUtf8Bytes(entry.contract)),code=a.bytecode.object+new Interface(a.abi).encodeDeploy(args).slice(2);
  const address=getCreate2Address(probe,salt,keccak256(code));salts.push(salt);codes.push(code);addresses.push(address);resolved[entry.contract]=address;
 }
 const batch=new Interface(p.abi).encodeFunctionData('deployAll',[codes,salts]);await send('three named constructors in one atomic batch',{to:probe,data:batch});
 for(let i=0;i<3;i++){const code=await rpc('eth_getCode',[addresses[i],'latest']);assert.ok(code.length>2);}
 const iface=new Interface(f.abi);const create=await send('runtime full root Branch CREATE',{to:addresses[2],data:iface.encodeFunctionData('createProject',['Disposable launch rehearsal'])});
 const event=create.logs.map(l=>{try{return iface.parseLog(l)}catch{return null}}).find(e=>e?.name==='BranchCreated');assert.ok(event);
 const childCode=await rpc('eth_getCode',[event.args.branch,'latest']);assert.ok((childCode.length-2)/2>10000);
 const release=JSON.parse(await readFile(new URL('config/release.json',root)));
 // Local fault-free public adapter read path on chain 1, with disclosed mocks solely for prices.
 for(const [name,address] of [['MockToken',release.imd],['MockIntake',release.intake]]) await rpc('anvil_setCode',[address,(await artifact(name)).deployedBytecode.object]);
 const publicAdapterObservation=await observeDeployment({request:({method,params})=>rpc(method,params)}, {release,factory:addresses[2],chainId:1});
 verifyBoundRuntime(childCode,'RelayBranch',release,{factory:addresses[2],encoder:addresses[0],verifier:addresses[1]});
 const localDir=await mkdtemp(join(tmpdir(),'steps-handoff-local-'));
 const sourceCommit=execFileSync('git',['rev-parse','HEAD']).toString().trim();
 const localHandoff={version:1,launchId:'DISPOSABLE_LOCAL_REHEARSAL_ONLY',chainId:1,sourceCommit,attestationHash:keccak256(toUtf8Bytes('DISPOSABLE LOCAL REHEARSAL; NOT AN OFFICIAL ATTESTATION')).slice(2),contracts:await Promise.all(['RelayEncoder','RelayVerifier','RelayFactory'].map(async(name,i)=>({name,address:addresses[i],abiHash:abiHash(JSON.parse(await readFile(new URL(`abi/${name}.json`,root))))})))};
 const deploymentReceipt=receipts.find(r=>r.label==='three named constructors in one atomic batch').receipt;
 const localEvidence={classification:'DISPOSABLE_LOCAL_TEST_ONLY',sourceCommit,attestationHash:localHandoff.attestationHash,transactionHash:deploymentReceipt.transactionHash,blockNumber:Number(BigInt(deploymentReceipt.blockNumber)),blockHash:deploymentReceipt.blockHash,build:release.frozenBuild};
 await writeFile(join(localDir,'handoff.json'),JSON.stringify(localHandoff));await writeFile(join(localDir,'evidence.json'),JSON.stringify(localEvidence));await writeFile(join(localDir,'index.html'),'<html lang="en">Disposable local importer rehearsal</html>');
 const imported=await importDeployment({handoffPath:join(localDir,'handoff.json'),networkPath:join(localDir,'absent-network.json'),evidencePath:join(localDir,'evidence.json'),dist:localDir,provider:{request:({method,params})=>rpc(method,params)},release});
 await verifyHandoffAssets(imported,p=>readFile(join(localDir,p)));
 // A changed immutable must fail even if normalized executable code still matches.
 assert.throws(()=>verifyBoundRuntime(childCode,'RelayBranch',release,{factory:addresses[0],encoder:addresses[0],verifier:addresses[1]}),/wrong immutable/);

 const output={scope:'DISPOSABLE_LOCAL_CHAIN_1_ONLY',handoffImporter:'PASS: actual receipts, CREATE2 call traces, frozen settings/code and all immutables; final asset inventory verified',productionDeployment:null,productionReady:false,liveCompatibility:'NOT_RUN',evm:'prague',networkGasCeiling:16777216,serviceGasCeiling:null,publicAdapterObservation,proposedManifest,manifestSource:'docs/CONTRACTS.md fenced JSON; no launch.json created',constructors:'empty dependency addresses PASS; full named batch PASS',names:['RelayEncoder','RelayVerifier','RelayFactory'],localAddresses:addresses,branch:event.args.branch,branchRuntimeBytes:(childCode.length-2)/2,receipts};
 console.log(JSON.stringify(output,null,2));
} finally {node.kill();}
