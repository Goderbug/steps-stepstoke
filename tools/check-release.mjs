// Read-only check: distributed ABIs and config/release.json contract metadata match the current forge build.
// Writes nothing, so historical evidence directories stay untouched.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');
const config = JSON.parse(await read('config/release.json'));
const out = {};
for (const name of ['RelayFactory','RelayBranch','RelayEncoder','RelayVerifier']) {
  const a = JSON.parse(await read(`out/${name}.sol/${name}.json`));
  assert.deepEqual(JSON.parse(await read(`abi/${name}.json`)), a.abi, `${name} ABI drift`);
  const sz = h => (h.length - 2) / 2;
  out[name] = { creationCodeHash: keccak256(a.bytecode.object), runtimeBytesBeforeImmutablePatching: sz(a.deployedBytecode.object), initcodeBytes: sz(a.bytecode.object) };
  assert.ok(out[name].runtimeBytesBeforeImmutablePatching <= 24576); assert.ok(out[name].initcodeBytes <= 49152);
}
assert.deepEqual(config.contracts, out, 'release.json artifact drift');
assert.equal(config.productionDeployment, null); assert.equal(config.liveCompatibility, 'NOT_RUN'); assert.equal(config.productionReady, false);
console.log(JSON.stringify({ ok: true, ABI: 'MATCH', releaseContracts: 'MATCH', policyId: config.policyId, contracts: out }, null, 2));
