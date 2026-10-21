// Recompute final artifact measurements and assert the distributed ABI/config match the build.
// No network, keys, source rewriting or build configuration changes.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
const root = new URL('../', import.meta.url);
// Candidate evidence stays separate from the original immutable delivery logs.
const read = async path => readFile(new URL(path, root), 'utf8');
const config = JSON.parse(await read('config/release.json'));
const evidenceDir = config.validationReport === 'docs/validation/review-fixes/README.md' || process.argv.includes('--review-fixes') ? 'docs/validation/review-fixes' : 'docs/validation';
const contracts = {};
for (const name of ['RelayFactory', 'RelayBranch', 'RelayEncoder', 'RelayVerifier']) {
  const artifact = JSON.parse(await read(`out/${name}.sol/${name}.json`));
  assert.deepEqual(JSON.parse(await read(`abi/${name}.json`)), artifact.abi, `${name} ABI drift`);
  const creation = artifact.bytecode.object;
  const runtime = artifact.deployedBytecode.object;
  const size = hex => (hex.length - (hex.startsWith('0x') ? 2 : 0)) / 2;
  contracts[name] = {
    creationCodeHash: keccak256(creation),
    runtimeBytesBeforeImmutablePatching: size(runtime), initcodeBytes: size(creation)
  };
  assert.ok(size(runtime) <= 24576, `${name} EIP-170`);
  assert.ok(size(creation) <= 49152, `${name} EIP-3860`);
}
assert.deepEqual(config.contracts, contracts, 'Fixed release config artifact drift');
const trace = await read(`${evidenceDir}/maximum-binding-trace.txt`);
const metrics = [...trace.matchAll(/emit Metric\(name: "([^"]+)", value: (\d+)/gu)].map(m => ({ name: m[1], value: Number(m[2]) }));
assert.equal(metrics.length, 9);
const bodyTrace = await read(`${evidenceDir}/worst-body-trace.txt`);
assert.match(bodyTrace, /independent exact runtime request UTF-8 bytes", value: 16384/u);
assert.match(bodyTrace, /1 passed; 0 failed/u);
const flow = JSON.parse(await read(`${evidenceDir}/local-integration.json`));
assert.equal(flow.rounds.length, 7);
assert.equal(flow.compatibility, 'LOCAL_MOCK_ONLY');
const measurements = {
  scope: 'Local source candidate: local EVM and mock Intake/IMD only', policyId: config.policyId, contracts,
  bindingExecution: metrics,
  requestBoundary: { acceptedUTF8Bytes: 16384, rejectedUTF8Bytes: 16385, prepaymentRejection: true },
  localChainTransactions: flow.transactions,
  localChainMaximumScenarioBodyBytes: Math.max(...flow.rounds.map(r => r.bodyBytes)),
  liveCompatibility: 'NOT_RUN', publicDeployment: 'NOT_RUN', paidConsumption: 'NOT_RUN'
};
await writeFile(new URL(`${evidenceDir}/measurements.json`, root), JSON.stringify(measurements, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, ABI: 'MATCH', fixedConfig: 'MATCH', contracts, requestBoundary: measurements.requestBoundary }, null, 2));
