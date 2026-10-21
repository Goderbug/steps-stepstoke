import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
import { fetchOriginalResult, originalResultURL, artifactURL, observeIntake, readLogs, assertProductionGates } from '../sdk/public.mjs';
import { observeDeployment, verifyRuntime } from '../sdk/config.mjs';
import { verifyManifest } from '../sdk/core.mjs';

test('public authenticated snapshots remain exact and unsupported zero-file envelopes are refused', async () => {
  const index=JSON.parse(await readFile(new URL('../docs/validation/rc-v1/authenticated-results-index.json',import.meta.url)));
  for(const row of index) {
    const raw=await readFile(new URL(`../test/fixtures/public/completed-${row.index}.json`,import.meta.url));
    assert.equal(keccak256(raw),row.resultHash);
    assert.throws(()=>verifyManifest(raw,row.resultHash),/Expected a declared file/);
    const mutable=await readFile(new URL(`../test/fixtures/public/mutable-job-${row.index}.json`,import.meta.url));
    assert.notEqual(keccak256(mutable),row.resultHash);
    assert.throws(()=>verifyManifest(mutable,row.resultHash),/digest mismatch/);
  }
});
test('actual public multi-file result selects only the proposal output from exact bytes', async () => {
  const raw=await readFile(new URL('../test/fixtures/public/observed-multiple-files.json',import.meta.url));
  // HTTP observation is not a callback. The local digest tests parser compatibility only.
  assert.equal(JSON.parse(raw).files.length,2);
  assert.throws(()=>verifyManifest(raw,keccak256(raw)),/Supply declared output/);
  const output=verifyManifest(raw,keccak256(raw),{outputName:'r5-report',outputPath:'artifacts/r5-report.md'});
  assert.equal(output.file.hash,'0x77ddc8340baa239e79c2f6360bbd08b8e8ed221c28667532917b6a8da853fa25');
  assert.equal(output.file.mediaType,'text/markdown');
  assert.equal(output.file.bytes,25123);
});

test('original bytes survive fetch and require exact callback hash', async () => {
  const raw = new TextEncoder().encode('{ "extra": [1, 2], "jobId":"original" }\n');
  let request;
  const fetch = async (url, options) => { request = { url, options }; return new Response(raw); };
  const out = await fetchOriginalResult('/intake-results/snapshot', keccak256(raw), { fetch });
  assert.deepEqual(out,raw); assert.equal(request.options.redirect,'error'); assert.equal(request.options.credentials,'omit');
  await assert.rejects(fetchOriginalResult('/intake-results/snapshot',keccak256(new Uint8Array()),{fetch}),/hash mismatch/);
  await assert.rejects(fetchOriginalResult('/intake-results/snapshot',keccak256(raw),{fetch:async()=>new Response(new Uint8Array(32769))}),/exceeds/);
});
test('no callback URI can fetch arbitrary/private destinations', () => {
  for (const uri of ['http://localhost/result.json','https://evil.test/intake-results/x','https://api.imd.fun@evil.test/intake-results/x','https://api.imd.fun/intake-results/../../x','//localhost/x','https://api.imd.fun/intake-results/x?q=y']) assert.throws(()=>originalResultURL(uri));
  assert.throws(()=>originalResultURL('ipfs://bafyCID/result.json'),/Configure/);
  assert.equal(originalResultURL('ipfs://bafyCID/result.json','https://ipfs.io/ipfs/'),'https://ipfs.io/ipfs/bafyCID/result.json');
  assert.equal(artifactURL('a'.repeat(64)),'https://api.imd.fun/artifacts/'+'a'.repeat(64));
});
test('HTTP completion remains an observation and never a settlement', async () => {
  const result = await observeIntake('0x'+'a'.repeat(64),{fetch:async()=>Response.json({state:'completed'})});
  assert.equal(result.settlement,false); assert.equal(result.authority,'HTTP_OBSERVATION_ONLY');
});
test('public reads refuse other chains before touching contracts and never switch', async () => {
  const calls=[];
  const p={request:async r=>{calls.push(r);return '0xaa36a7';}};
  await assert.rejects(observeDeployment(p,{release:{intendedChainId:1},factory:'0x'+'1'.repeat(40),chainId:1}),/Wrong chain/);
  assert.deepEqual(calls.map(c=>c.method),['eth_chainId']);
});
test('candidate cannot pass the production spending gate', async () => {
  const r=JSON.parse(await readFile(new URL('../config/release.json',import.meta.url)));
  assert.throws(()=>assertProductionGates(r),/gates remain open/);
});
test('production evidence is tied to the exact configured deployment', () => {
  const d={sourceCommit:'a'.repeat(40),attestationHash:'b'.repeat(64),factory:'0x'+'1'.repeat(40),encoder:'0x'+'2'.repeat(40),verifier:'0x'+'3'.repeat(40),transactionHash:'0x'+'4'.repeat(64),blockHash:'0x'+'5'.repeat(64),blockNumber:123};
  const gates=Object.fromEntries(['securityReview','runtimeChildPolicy','manifestCompatibility','gasCeilings','liveExecution','deploymentVerification'].map(k=>[k,{status:'PASS',evidence:['unit test evidence only']}])) ;
  const gate={profiles:Object.fromEntries([0,1,2,3,4].map(id=>[id,{status:'PASS',evidence:['UNIT TEST ONLY']} ])),chainId:1,productionReady:true,liveCompatibility:'PASS',productionDeployment:d,gates};
  const config={chainId:1,contracts:d,deploymentBlock:123};
  assert.doesNotThrow(()=>assertProductionGates(gate,config));
  assert.throws(()=>assertProductionGates(gate,{...config,deploymentBlock:124}),/different deployment/);
  assert.throws(()=>assertProductionGates({...gate,productionDeployment:{...d,verifier:d.encoder}},config),/Invalid/);
  assert.throws(()=>assertProductionGates({...gate,gates:{...gates,securityReview:{status:'PASS',evidence:'not an evidence array'}}},config),/securityReview/);
});
test('RPC log windows are bounded and block numbers generated correctly', async () => {
  const calls=[];const p={request:async r=>{calls.push(r.params[0]);return []}};
  await readLogs(p,{address:'0x'+'1'.repeat(40),fromBlock:26240000,toBlock:26242000});
  assert.equal(calls.length,2); assert.equal(Number(BigInt(calls[0].fromBlock)),26240000); assert.equal(Number(BigInt(calls[1].toBlock)),26242000);
  await assert.rejects(readLogs(p,{fromBlock:0,toBlock:26242000}),/bounded/);
});
test('runtime code checks reject a one-byte executable edit and inconsistent immutables', () => {
  const code='0x600000000000';
  const release={runtimeChecks:{C:{bytes:6,normalizedKeccak:keccak256(code),immutableReferences:{a:[{start:2,length:2},{start:4,length:2}]}}}};
  assert.equal(verifyRuntime('0x600012341234','C',release),keccak256('0x600012341234'));
  assert.throws(()=>verifyRuntime('0x600112341234','C',release),/code mismatch/);
  assert.throws(()=>verifyRuntime('0x600012341235','C',release),/inconsistent/);
});
