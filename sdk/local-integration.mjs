// LOCAL ONLY. Uses unlocked accounts on the ephemeral Anvil instance, never wallet files.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createPublicClient,createWalletClient,http,keccak256,toHex,decodeEventLog} from 'viem';
import {foundry} from 'viem/chains';
import * as sdk from './steps-branch-v2.mjs';

const url='http://127.0.0.1:18765';
const publicClient=createPublicClient({chain:foundry,transport:http(url)});
assert.equal(await publicClient.getChainId(),31337,'Refuse a non-local chain');
const accounts=await publicClient.request({method:'eth_accounts'});
const account=accounts[0];
const wallet=createWalletClient({account,chain:foundry,transport:http(url)});
const artifact=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const A=artifact('../out/StepsBranch.sol/StepsBranch.json');
const T=artifact('../out/MockToken.sol/MockToken.json');
const I=artifact('../out/StepsBranch.t.sol/DocumentedIntake.json');
async function receipt(hash) {const r=await publicClient.waitForTransactionReceipt({hash});assert.equal(r.status,'success');return r;}
async function deploy(a,args=[]) {const r=await receipt(await wallet.deployContract({abi:a.abi,bytecode:a.bytecode.object,args,gas:8000000n}));return r.contractAddress;}
async function write(address,abi,functionName,args=[]) {return receipt(await wallet.writeContract({address,abi,functionName,args,gas:1500000n}));}
async function send(data,from=account) {return receipt(await wallet.sendTransaction({account:from,to:ledger,data,gas:1500000n}));}
async function read(functionName,args=[]) {return publicClient.readContract({address:ledger,abi:A.abi,functionName,args});}
const token=await deploy(T), intake=await deploy(I), ledger=await deploy(A,[intake,token,500000000000000000n,account]);
await write(token,T.abi,'mint',[account,20000000000000000000n]);
await write(token,T.abi,'approve',[ledger,20000000000000000000n]);
const body=sdk.jobBody({objective:'Local verification of STEPS repair',skill:'research-report'});
const result=new TextEncoder().encode('{"jobId":"local-proof-job","files":[]}');
const resultHash=keccak256(result);
const uri='ipfs://bafybeiddvhj22nmr4vbvcukumtqoi6sdnheqqxqidqod36lxb73zyi7pny/result.json';
const observations=[];
async function fund(branchId,anchor) {
  const proposed=sdk.decodeBranchLogs((await send(sdk.encodePropose({branchId,anchor,body}))).logs,ledger).proposed[0];
  const funded=sdk.decodeBranchLogs((await send(sdk.encodeFund({proposalId:proposed.id,body,maxPayment:500000000000000000n}))).logs,ledger).funded[0];
  assert.equal(funded.id,proposed.id);
  return funded;
}
async function deliver(requestId,locator,label) {
  // Each callback is its own transaction: no warmed storage from setup/funding.
  const r=await write(intake,I.abi,'deliver',[requestId,resultHash,locator]);
  const delivery=r.logs.filter(x=>x.address.toLowerCase()===intake.toLowerCase()).map(x=>decodeEventLog({abi:I.abi,data:x.data,topics:x.topics})).find(x=>x.eventName==='Delivery').args;
  assert.equal(delivery.delivered,true,`${label}: callback failed`);
  const cp=sdk.decodeBranchLogs(r.logs,ledger).checkpoints[0];assert.ok(cp);
  const record=await read('checkpoint',[cp.checkpointId]);
  assert.equal(record.resultHash,resultHash);assert.equal(record.uriHash,keccak256(new TextEncoder().encode(locator)));
  const view=sdk.decodeResult(result,record.resultHash);assert.equal(view.jobId,'local-proof-job');
  if(locator.length<=2048) sdk.verifyResultUri(cp.uri,record.uriHash); else assert.equal(cp.uri,'');
  observations.push({label,transactionHash:r.transactionHash,blockNumber:r.blockNumber.toString(),callGasIncludingMockOverhead:delivery.callGas.toString(),delivered:delivery.delivered,checkpointId:cp.checkpointId.toString()});
  return record;
}
const r0=await fund(0n,sdk.ZERO_HASH);
const c0=await deliver(r0.requestId,uri,'first cold callback');
const r1=await fund(0n,c0.digest);
const forkReceipt=await send(sdk.encodeFork({parentId:0n}),accounts[1]);
const child=sdk.decodeBranchLogs(forkReceipt.logs,ledger).forked[0].childBranchId;
assert.equal((await read('branches',[0n]))[0],c0.digest);
assert.equal(await read('count'),1n);
const rf=await fund(child,c0.digest);
const cf=await deliver(rf.requestId,'https://api.imd.fun/intake-results/'+rf.requestId,'fork callback arrives before parent branch');
const c1=await deliver(r1.requestId,uri,'source branch callback after fork');
assert.equal(cf.parent,c0.digest);assert.equal(c1.parent,c0.digest);
assert.equal((await read('branches',[child]))[0],cf.digest);
const r2=await fund(0n,c1.digest);
const failureReceipt=await write(intake,I.abi,'fail',[r2.requestId,2,toHex('blocked',{size:32})]);
const failure=sdk.decodeBranchLogs(failureReceipt.logs,ledger).failures[0];assert.equal(failure.status,2);
assert.equal(sdk.proposalState((await read('proposals',[r2.id]))[2]),'failed');
assert.equal((await read('branches',[0n]))[0],c1.digest);
assert.equal((await read('branches',[0n]))[3],0n);
const r3=await fund(0n,c1.digest);const c3=await deliver(r3.requestId,'https://example.org/'+ 'a'.repeat(2028),'2048-byte URI cold callback');
assert.equal(c3.revision,3n);
const r4=await fund(0n,c3.digest);const c4=await deliver(r4.requestId,'a'.repeat(16384),'16384-byte URI cold callback');
const sr=await send(sdk.encodeFork({parentId:0n,resultBytes:result}),accounts[2]);
assert.equal(sdk.decodeBranchLogs(sr.logs,ledger).snapshots[0].resultHash,resultHash);
assert.equal(await publicClient.readContract({address:token,abi:T.abi,functionName:'balanceOf',args:[ledger]}),0n);
assert.equal(await publicClient.readContract({address:token,abi:T.abi,functionName:'allowance',args:[ledger,intake]}),0n);
// Worst storage combination: the first recorded checkpoint comes from proposal 1,
// on a fresh origin branch, with the largest URI retained in the event.
const worst=await deploy(A,[intake,token,500000000000000000n,account]);
await write(token,T.abi,'approve',[worst,500000000000000000n]);
await write(worst,A.abi,'propose',[0n,sdk.ZERO_HASH,toHex(body)]);
await write(worst,A.abi,'propose',[0n,sdk.ZERO_HASH,toHex(body)]);
const wr=await write(worst,A.abi,'fundWithPayment',[1n,toHex(body),500000000000000000n]);
const wreq=sdk.decodeBranchLogs(wr.logs,worst).funded[0].requestId;
const wd=await write(intake,I.abi,'deliver',[wreq,resultHash,'a'.repeat(2048)]);
const wlog=wd.logs.filter(x=>x.address.toLowerCase()===intake.toLowerCase()).map(x=>decodeEventLog({abi:I.abi,data:x.data,topics:x.topics})).find(x=>x.eventName==='Delivery').args;
assert.equal(wlog.delivered,true,'Worst cold callback combination failed');
observations.push({label:'first checkpoint, nonzero proposal, 2048-byte URI, cold transaction',transactionHash:wd.transactionHash,blockNumber:wd.blockNumber.toString(),callGasIncludingMockOverhead:wlog.callGas.toString(),delivered:wlog.delivered,checkpointId:'0'});

assert.equal(await read('snapshotOf',[sdk.decodeBranchLogs(sr.logs,ledger).forked[0].childBranchId]),toHex(result));
async function expire(id) {
  await publicClient.request({method:'evm_increaseTime',params:[7*24*60*60]});
  await publicClient.request({method:'evm_mine',params:[]});
  const r=await send(sdk.encodeExpirePending({proposalId:id}),accounts[1]);
  assert.equal(sdk.decodeBranchLogs(r.logs,ledger).expired[0].proposalId,id);
  assert.equal(sdk.proposalState((await read('proposals',[id]))[2]),'expired');
  assert.equal(sdk.lateReceiptState(await read('lateReceiptOf',[id])),'awaiting');
}
function deliveryEvidence(r,label) {
 const log=r.logs.filter(x=>x.address.toLowerCase()===intake.toLowerCase()).map(x=>decodeEventLog({abi:I.abi,data:x.data,topics:x.topics})).find(x=>x.eventName==='Delivery').args;
 assert.equal(log.delivered,true,label);
 observations.push({label,transactionHash:r.transactionHash,blockNumber:r.blockNumber.toString(),callGasIncludingMockOverhead:log.callGas.toString(),delivered:true,checkpointId:null});
 return sdk.decodeBranchLogs(r.logs,ledger);
}
let head=c4.digest;
for(const locator of [uri,'a'.repeat(2048),'a'.repeat(16384)]) {
 const old=await fund(0n,head);await expire(old.id);
 const next=await fund(0n,head);
 const before=await read('branches',[0n]);const count=await read('count');
 const r=await write(intake,I.abi,'deliver',[old.requestId,resultHash,locator]);
 const logs=deliveryEvidence(r,`late success: ${locator.length}-byte URI, cold transaction`);
 assert.equal(logs.checkpoints.length,0);assert.equal(logs.failures.length,0);assert.equal(logs.lateResults.length,1);
 assert.deepEqual(await read('branches',[0n]),before);assert.equal(await read('count'),count);
 const late=await read('lateReceiptOf',[old.id]);
 assert.equal(sdk.lateReceiptState(late),'succeeded');assert.equal(late[2],resultHash);assert.equal(late[3],keccak256(new TextEncoder().encode(locator)));
 assert.equal(sdk.proposalState((await read('proposals',[old.id]))[2]),'expired');
 assert.equal(logs.uriOmissions.length,locator.length>2048?1:0);
 head=(await deliver(next.requestId,uri,'new request settles after archived old success')).digest;
}
for(const status of [1,2]) {
 const old=await fund(0n,head);await expire(old.id);const next=await fund(0n,head);
 const before=await read('branches',[0n]);const count=await read('count');
 const r=await write(intake,I.abi,'fail',[old.requestId,status,toHex('late',{size:32})]);
 const logs=deliveryEvidence(r,`late status ${status}, cold transaction`);
 assert.equal(logs.lateFailures.length,1);assert.equal(logs.failures.length,0);assert.equal(logs.checkpoints.length,0);
 assert.deepEqual(await read('branches',[0n]),before);assert.equal(await read('count'),count);
 assert.equal(sdk.lateReceiptState(await read('lateReceiptOf',[old.id])),status===1?'refused':'failed');
 assert.equal(sdk.proposalState((await read('proposals',[old.id]))[2]),'expired');
 head=(await deliver(next.requestId,uri,'new request settles after archived old failure')).digest;
}
// Independent, fully nonzero 4 KiB storage verifies the snapshot persistence gas cost.
const snapshot=Uint8Array.from({length:4096},(_,i)=>i%255+1);
const full=await fund(0n,head);
const fullReceipt=await write(intake,I.abi,'deliver',[full.requestId,keccak256(snapshot),uri]);
const fullCheckpoint=deliveryEvidence(fullReceipt,'4 KiB result commitment, cold transaction').checkpoints[0];
const copyReceipt=await receipt(await wallet.sendTransaction({to:ledger,data:sdk.encodeFork({parentId:fullCheckpoint.checkpointId,resultBytes:snapshot}),gas:4000000n}));
const copiedBranch=sdk.decodeBranchLogs(copyReceipt.logs,ledger).forked[0].childBranchId;
assert.equal(await read('snapshotOf',[copiedBranch]),toHex(snapshot));
const output={scope:'LOCAL_ANVIL_ONLY',chainId:31337,ledger,intake,token,observations,checks:['SDK propose and bounded fund','nested ERC20 payment','cold transaction callbacks with 200000 gas','source/fork independent reverse completion','failure preserves head and unlocks branch','authenticated result snapshot copy','no residual ledger balance or Intake approval','permissionless expiry is separate from service failure','late success/refusal/no-result preserved without changing active branch','4 KiB nonzero snapshot persisted and read back'],snapshotCopyGas:copyReceipt.gasUsed.toString(),mainnetAcceptance:false};
writeFileSync(new URL('../local-integration.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
