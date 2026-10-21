#!/usr/bin/env node
// Summarize exact candidate evidence. Inputs are fresh outputs of the delivered local tools.
// No network, keys, writes or presumed readiness. Historical clone measurements are never read.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {keccak256} from '../vendor/ethers/ethers.mjs';
const [flowPath,bindingPath,batchPath]=process.argv.slice(2);
if(!batchPath)throw Error('Usage: node tools/measure-release.mjs FLOW_JSON BINDING_JSON CONSTRUCTOR_JSON');
const load=async p=>JSON.parse(await readFile(p,'utf8'));
const [flow,binding,batch,release]=await Promise.all([load(flowPath),load(bindingPath),load(batchPath),load(new URL('../config/release.json',import.meta.url))]);
assert.equal(flow.compatibility,'LOCAL_MOCK_ONLY');assert.equal(flow.rounds.length,7);assert.equal(binding.measurements.length,8);
const contracts={};
for(const name of ['RelayFactory','RelayBranch','RelayEncoder','RelayVerifier']){
 const a=await load(new URL(`../out/${name}.sol/${name}.json`,import.meta.url));
 const size=x=>(x.length-2)/2;
 contracts[name]={creationCodeHash:keccak256(a.bytecode.object),runtimeBytesBeforeImmutablePatching:size(a.deployedBytecode.object),initcodeBytes:size(a.bytecode.object)};
 assert.deepEqual(await load(new URL(`../abi/${name}.json`,import.meta.url)),a.abi);
}
assert.deepEqual(contracts,release.contracts);
const omit=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
console.log(JSON.stringify({scope:'LOCAL_MOCK_ONLY; measured receipt gas, not live service costs or a universal worst-case proof',productionDeployment:null,liveCompatibility:'NOT_RUN',productionReady:false,contracts,policyId:release.policyId,transactions:flow.transactions.map(r=>omit(r,['calldata'])),binding:binding.measurements.map(r=>omit(r,['calldata','raw','rawResult','witness'])),runtimeCreations:binding.runtimeCreations.map(r=>omit(r,['calldata','childInitcode'])),constructorBatch:batch.receipts.map(r=>omit(r,['rawTransaction','receipt'])),transactionGasCeiling:16777216,observedEthereumBlockGasLimit:60000000,serviceGasCeiling:null,netExecutionGasDefinition:'Receipt gasUsed minus standard intrinsicGas; includes net refunds and any calldata-floor surcharge. Not a raw opcode execution trace.',limitations:['MockIntake stores complete bodies and its completion accepts raw bytes, so purchase/completion outer costs differ from real Intake.','Eight finite stress shapes do not prove a global maximum.','Service simulation/byte ceilings are unpublished and unverified.']},null,2));
