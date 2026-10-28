import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, keccak256, sha256, encodeEventTopics, encodeAbiParameters } from 'viem';
import * as sdk from './steps-branch-v2.mjs';
const bytes = s => new TextEncoder().encode(s);
const body = sdk.jobBody({objective:'Build the next step',repo:'https://github.com/example/project',baseCommit:'abc',inputs:[{url:'ipfs://prior'}]});
const result = bytes('{"jobId":"job-123","files":[{"path":"a.txt","hash":"'+sha256(bytes('hello')).slice(2)+'","bytes":5}]}');
const hash = keccak256(result);
const uri = 'ipfs://bafy-result/result.json';
const uriHash = keccak256(bytes(uri));
const decode = data => decodeFunctionData({abi:sdk.STEPS_BRANCH_V2_ABI,data});
const ledger = `0x${'11'.repeat(20)}`;

test('job body preserves actual prior source inputs',()=> {
  const input=JSON.parse(new TextDecoder().decode(body));
  assert.equal(input.baseCommit,'abc');assert.equal(input.inputs[0].url,'ipfs://prior');
  assert.throws(()=>sdk.jobBody({objective:''}));
});
test('instruction is derived from committed body',()=> {
  assert.equal(sdk.instructionFromBody(body,sdk.bodyHash(body)),'Build the next step');
  assert.throws(()=>sdk.instructionFromBody(body,sdk.ZERO_HASH),/hash mismatch/);
});
test('proposal encodes branch and anchor; omitted identity fails',()=> {
  const call=decode(sdk.encodePropose({branchId:7n,anchor:sdk.ZERO_HASH,body}));
  assert.equal(call.functionName,'propose');assert.equal(call.args[0],7n);assert.equal(call.args[1],sdk.ZERO_HASH);
  assert.throws(()=>sdk.encodePropose({anchor:sdk.ZERO_HASH,body}),/Explicit integer/);
});
test('payment selects real funded path with explicit maximum',()=> {
  const call=decode(sdk.encodeFund({proposalId:3,body,maxPayment:500000000000000000n}));
  assert.equal(call.functionName,'fundWithPayment');assert.equal(call.args.length,3);
  assert.throws(()=>sdk.encodeFund({proposalId:3,body}),/Explicit integer/);
});
test('reference and snapshot forks use exact ABI; legacy copies fail closed',()=> {
  assert.equal(decode(sdk.encodeFork({parentId:0})).functionName,'fork');
  assert.equal(decode(sdk.encodeFork({parentId:0,resultBytes:result})).functionName,'forkWithSnapshot');
  assert.equal(decode(sdk.encodeForkFromOrigin()).functionName,'forkFromOrigin');
  assert.throws(()=>sdk.encodeFork({parentId:0,contents:[bytes('hello')]}),/Legacy/);
});
test('states distinguish draft, pending, success and both failures',()=> {
  assert.deepEqual([0,1,2,3,4,5].map(sdk.proposalState),['draft','pending','succeeded','refused','failed','expired']);
  assert.throws(()=>sdk.proposalState(99),/Unknown/);
});
test('only matching ledger logs are accepted, not foreign lookalikes',()=> {
  const topics=encodeEventTopics({abi:sdk.STEPS_BRANCH_V2_ABI,eventName:'FailureRecorded',args:{proposalId:1n,branchId:0n,requestId:sdk.ZERO_HASH}});
  const data=encodeAbiParameters([{type:'uint8'},{type:'bytes32'}],[2,sdk.ZERO_HASH]);
  const log={address:ledger,topics,data};
  assert.equal(sdk.decodeBranchLogs([log],ledger).failures.length,1);
  assert.equal(sdk.decodeBranchLogs([{...log,address:`0x${'22'.repeat(20)}`}],ledger).failures.length,0);
  assert.equal(sdk.decodeBranchLogs([{...log,removed:true}],ledger).failures.length,0);
  assert.throws(()=>sdk.decodeBranchLogs([log]),/address required/);
});
test('result and URI commitments are mandatory',()=> {
  assert.equal(sdk.decodeResult(result,hash).jobId,'job-123');
  assert.throws(()=>sdk.decodeResult(result,sdk.ZERO_HASH),/hash mismatch/);
  assert.throws(()=>sdk.decodeResult(result),/32-byte hash/);
  assert.throws(()=>sdk.verifyResultUri('https://other.example',uriHash),/hash mismatch/);
  assert.throws(()=>sdk.verifyResultUri('',uriHash),/unavailable/);
});
test('fetch verifies locator and bytes before exposing metadata',async()=> {
  let fetched=false;
  const mock=async(url,opts)=>{fetched=true;assert.match(url,/^https:\/\/ipfs.io\/ipfs\//);assert.equal(opts.credentials,'omit');return new Response(result);};
  const decoded=await sdk.readResult(uri,hash,uriHash,mock);assert.equal(decoded.jobId,'job-123');assert.equal(fetched,true);
  await assert.rejects(sdk.readResult(uri,sdk.ZERO_HASH,uriHash,mock),/hash mismatch/);
});
test('streaming fetch enforces size cap without trusting content-length',async()=> {
  await assert.rejects(sdk.readResult(uri,hash,uriHash,async()=>new Response(result),{maxBytes:2}),/too large/);
});
test('file verification checks both size and digest, including hex prefixes',async()=> {
  const file=sdk.decodeResult(result,hash).files[0];
  assert.equal(await sdk.verifyFile(file,bytes('hello')),true);
  assert.equal(await sdk.verifyFile({...file,sha256:'0x'+file.sha256},bytes('hello')),true);
  assert.equal(await sdk.verifyFile({...file,bytes:4},bytes('hello')),false);
  assert.equal(await sdk.verifyFile(file,bytes('other')),false);
});

test('same-chain ledger rejects remote routing even with caller-encoded body',()=> {
  const bad=bytes('{"objective":"work","deliver":{"chainId":8453}}');
  assert.throws(()=>sdk.jobBody(JSON.parse(new TextDecoder().decode(bad))),/Cross-chain/);
  assert.throws(()=>sdk.encodePropose({branchId:0,anchor:sdk.ZERO_HASH,body:bad}),/Cross-chain/);
  assert.throws(()=>sdk.encodeFund({proposalId:0,body:bad,maxPayment:1n}),/Cross-chain/);
});
test('snapshot copy limit is explicit and reference fallback remains available',()=> {
  assert.equal(decode(sdk.encodeFork({parentId:1,resultBytes:new Uint8Array(4096)})).functionName,'forkWithSnapshot');
  assert.throws(()=>sdk.encodeFork({parentId:1,resultBytes:new Uint8Array(4097)}),/4 KiB/);
  assert.equal(decode(sdk.encodeFork({parentId:1})).functionName,'fork');
});
test('expiry and archive getters use the current ABI',()=> {
  assert.equal(decode(sdk.encodeExpirePending({proposalId:12})).functionName,'expirePending');
  assert.deepEqual(decode(sdk.encodeReadSnapshot({branchId:2})).args,[2n]);
  assert.deepEqual(decode(sdk.encodeReadLateReceipt({proposalId:12})).args,[12n]);
  assert.equal(sdk.STEPS_BRANCH_V2_ABI.find(x=>x.type==='constructor').inputs.length,4);
  assert.equal(sdk.STEPS_BRANCH_V2_ABI.some(x=>x.name==='delivery'),false);
});
test('absent late receipt is not protocol success',()=> {
  assert.equal(sdk.lateReceiptState([false,0,sdk.ZERO_HASH,sdk.ZERO_HASH,sdk.ZERO_HASH]),'awaiting');
  assert.deepEqual([0,1,2].map(s=>sdk.lateReceiptState([true,s,hash,uriHash,sdk.ZERO_HASH])),['succeeded','refused','failed']);
  assert.throws(()=>sdk.lateReceiptState([true,3,hash,uriHash,sdk.ZERO_HASH]),/status/);
  assert.throws(()=>sdk.lateReceiptState([]),/Invalid/);
});
const eventLog=(name,indexed,values)=> {
 const event=sdk.STEPS_BRANCH_V2_ABI.find(x=>x.type==='event' && x.name===name);
 return {address:ledger,topics:encodeEventTopics({abi:sdk.STEPS_BRANCH_V2_ABI,eventName:name,args:indexed}),data:encodeAbiParameters(event.inputs.filter(x=>!x.indexed),values)};
};
test('expiry and late outcomes never enter checkpoint or protocol failure arrays',()=> {
 const indexed={proposalId:8n,branchId:2n,requestId:hash};
 const logs=[eventLog('PendingExpired',{proposalId:8n,branchId:2n,by:ledger},[]),eventLog('LateResultRecorded',indexed,[hash,uriHash,uri]),eventLog('LateFailureRecorded',indexed,[2,hash]),eventLog('UriOmitted',{},[uriHash])];
 const parsed=sdk.decodeBranchLogs(logs,ledger);
 assert.equal(parsed.expired.length,1);assert.equal(parsed.lateResults.length,1);assert.equal(parsed.lateFailures.length,1);assert.equal(parsed.uriOmissions.length,1);
 assert.equal(parsed.checkpoints.length,0);assert.equal(parsed.failures.length,0);
 assert.equal(sdk.decodeBranchLogs(logs.map(l=>({...l,removed:true})),ledger).lateResults.length,0);
 assert.equal(sdk.decodeBranchLogs(logs,'0x'+'22'.repeat(20)).lateResults.length,0);
});
