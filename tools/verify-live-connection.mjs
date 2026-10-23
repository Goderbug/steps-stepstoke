#!/usr/bin/env node
// Read-only launch cross-check. Uses the existing SDK verifier; never sends a transaction.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { keccak256, sha256, Interface } from '../vendor/ethers/ethers.mjs';
import { abiHash } from '../sdk/handoff.mjs';
import { verifyPublicDeployment } from '../sdk/deployment.mjs';
import { createPublicReadProvider, defaultPublicRpcPolicy } from '../sdk/public-rpc.mjs';
import { validateReleaseState } from '../sdk/gates.mjs';

const output = 'docs/validation/live-connection-v1';
const readJSON = async p => JSON.parse(await readFile(p, 'utf8'));
const handoff = await readJSON('.imd/reads/deployment.json');
const network = await readJSON('.imd/reads/network.json');
const release = await readJSON('config/release.json');
assert.equal(handoff.launchId, 'cad0c789-2611-4392-bec0-456cb8e57d2c');
assert.equal(handoff.sourceCommit, '751f3901d4453e1477828e4f7ef0d6af8bc03485');
assert.equal(handoff.chainId, 1);
assert.equal(handoff.contracts.length, 3);
const gitBytes = path => execFileSync('git', ['show', `${handoff.sourceCommit}:${path}`], { maxBuffer: 8 * 1024 * 1024 });
const sources = [];
for (const [path, expected] of Object.entries(release.frozenBuild.sources)) {
  const official = gitBytes(path), current = await readFile(path);
  assert.equal(keccak256(official), expected, `Official compiler input: ${path}`);
  assert.deepEqual(current, official, `Changed Solidity input: ${path}`);
  sources.push({ path, keccak256: expected, sha256: sha256(current).slice(2) });
}
assert.equal(sources.length, 50, 'Complete corrected compilation inventory required');
const abiReports = [];
for (const name of ['RelayEncoder', 'RelayVerifier', 'RelayFactory', 'RelayBranch', 'IIntake']) {
  const path = `abi/${name}.json`, raw = await readFile(path);
  assert.deepEqual(raw, gitBytes(path), `ABI changed from official source: ${name}`);
  const canonicalKeccak = abiHash(JSON.parse(raw));
  const named = handoff.contracts.find(c => c.name === name);
  if (named) assert.equal(canonicalKeccak, named.abiHash);
  abiReports.push({ name, path, canonicalKeccak, sha256: sha256(raw).slice(2), officialBytes: 'MATCH' });
}
const policy = defaultPublicRpcPolicy(network.network.rpcUrls[0]);
const provider = createPublicReadProvider({ rpcUrls: policy.rpcUrls });
const txHash = handoff.contracts[0].txHash;
assert.ok(handoff.contracts.every(c => c.txHash === txHash && c.blockNumber === handoff.contracts[0].blockNumber));
const [receipt, tx] = await Promise.all([
  provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] }),
  provider.request({ method: 'eth_getTransactionByHash', params: [txHash] }),
]);
assert.ok(receipt && tx, 'Live receipt and transaction required');
assert.equal(BigInt(receipt.status), 1n);
assert.equal(Number(BigInt(receipt.blockNumber)), handoff.contracts[0].blockNumber);
const block = await provider.request({ method: 'eth_getBlockByNumber', params: [receipt.blockNumber, false] });
assert.equal(block.hash, receipt.blockHash);
assert.equal(tx.blockHash, receipt.blockHash);
assert.equal(tx.hash, txHash);
assert.equal(tx.from, receipt.from);
assert.equal(tx.to, receipt.to);
assert.equal(BigInt(tx.chainId), 1n);
const trace = await provider.request({ method: 'debug_traceTransaction', params: [txHash, { tracer: 'callTracer' }] });
assert.equal(trace.from.toLowerCase(), tx.from.toLowerCase(), 'Outer sender');
assert.equal(trace.to.toLowerCase(), tx.to.toLowerCase(), 'Outer recipient');
assert.equal(trace.input.toLowerCase(), tx.input.toLowerCase(), 'Outer calldata');
const creates = [];
function visit(t) {
  assert.ok(t && !t.error, 'Successful complete call trace required');
  if (['CREATE', 'CREATE2'].includes(t.type)) creates.push(t);
  for (const child of t.calls ?? []) visit(child);
}
visit(trace);
const evidence = {
  sourceCommit: handoff.sourceCommit, attestationHash: handoff.attestationHash,
  transactionHash: txHash, blockNumber: Number(BigInt(receipt.blockNumber)), blockHash: receipt.blockHash,
  build: release.frozenBuild,
};
const contracts = handoff.contracts.map(c => ({ name: c.name, address: c.address, abiHash: c.abiHash, abiPath: `abi/${c.name}.json` }));
// Only real bytes are described here. The final importer inventories the rebuilt export separately.
const assets = [];
for (const path of ['index.html', ...contracts.map(c => c.abiPath), 'deployment-evidence.json']) {
  const bytes = path === 'deployment-evidence.json' ? Buffer.from(JSON.stringify(evidence)) : await readFile(path === 'index.html' ? 'dist/index.html' : path);
  assets.push({ path, sha256: sha256(bytes).slice(2) });
}
const h = { version: 1, launchId: handoff.launchId, chainId: 1, sourceCommit: handoff.sourceCommit, attestationHash: handoff.attestationHash, contracts, assets };
const verified = await verifyPublicDeployment(provider, h, evidence, release);
if (release.productionDeployment) {
  const gate = await readJSON('config/production-gate.json');
  validateReleaseState(release, gate);
  for (const key of ['transactionHash', 'blockNumber', 'blockHash', 'sourceCommit', 'attestationHash']) assert.equal(release.productionDeployment[key], evidence[key]);
  for (const [key, address] of Object.entries(addressesFromHandoff())) assert.equal(release.productionDeployment[key].toLowerCase(), address.toLowerCase());
  evidence.productionGate = gate;
}
function addressesFromHandoff() { return Object.fromEntries(handoff.contracts.map(c => [c.name.replace('Relay', '').toLowerCase(), c.address])); }
const reports = [];
for (const c of contracts) {
  const matches = creates.filter(t => t.to.toLowerCase() === c.address.toLowerCase());
  assert.equal(matches.length, 1);
  const creation = matches[0];
  assert.equal(creation.from.toLowerCase(), tx.to.toLowerCase(), 'Actual launch creation caller');
  const code = await provider.request({ method: 'eth_getCode', params: [c.address, 'latest'] });
  reports.push({ name: c.name, address: c.address, creationCaller: creation.from, creationType: creation.type,
    initBytesWithArguments: (creation.input.length - 2) / 2, initKeccakWithArguments: keccak256(creation.input),
    creationCodeHash: release.contracts[c.name].creationCodeHash, runtimeBytes: (code.length - 2) / 2,
    runtimeKeccak: keccak256(code), normalizedRuntimeKeccak: release.runtimeChecks[c.name].normalizedKeccak,
    constructorAndImmutables: 'MATCH', historicalAndLatestRuntime: 'MATCH' });
}
const factory = handoff.contracts.find(c => c.name === 'RelayFactory');
const iface = new Interface(JSON.parse(await readFile('abi/RelayFactory.json', 'utf8')));
const getters = {};
for (const name of ['encoder', 'verifier']) {
  const raw = await provider.request({ method: 'eth_call', params: [{ to: factory.address, data: iface.encodeFunctionData(name) }, 'latest'] });
  getters[name] = iface.decodeFunctionResult(name, raw)[0].toLowerCase();
  assert.equal(getters[name], handoff.contracts.find(c => c.name === `Relay${name[0].toUpperCase()}${name.slice(1)}`).address.toLowerCase());
}
// A second operator independently confirms the canonical receipt and block.
const second = createPublicReadProvider({ rpcUrls: [network.network.rpcUrls[1]] });
const receipt2 = await second.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
const block2 = await second.request({ method: 'eth_getBlockByNumber', params: [receipt.blockNumber, false] });
assert.equal(receipt2.blockHash, receipt.blockHash); assert.equal(block2.hash, receipt.blockHash);
assert.equal(BigInt(receipt2.status), 1n);
await mkdir(output, { recursive: true });
await writeFile(`${output}/deployment-evidence.json`, JSON.stringify(evidence, null, 2) + '\n');
await writeFile(`${output}/public-read-transport.json`, JSON.stringify(policy, null, 2) + '\n');
await writeFile(`${output}/chain-report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), ...verified,
  launchId: handoff.launchId, attestationHash: handoff.attestationHash, sourceCommit: handoff.sourceCommit,
  outerSender: tx.from, outerRecipient: tx.to, transactionIndex: receipt.transactionIndex,
  trace: 'LIVE_CALLTRACER; no cached or downloaded trace accepted', getters, applications: reports,
  sources, abis: abiReports, publicRPCs: policy.rpcUrls,
  handoffInputSha256: sha256(await readFile('.imd/reads/deployment.json')).slice(2),
  networkInputSha256: sha256(await readFile('.imd/reads/network.json')).slice(2),
  independentCanonicality: 'MATCH on two operators', liveProfiles: 'NOT_RUN', walletAuthority: false,
}, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, sources: sources.length, applications: reports.length, blockHash: receipt.blockHash,
  outerSender: tx.from, creationCaller: tx.to, productionReady: false, liveCompatibility: 'NOT_RUN' }));
