// Read-only check: distributed ABIs and config/release.json contract metadata match the current forge build.
// Writes nothing, so historical evidence directories stay untouched.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { validateReleaseState } from '../sdk/gates.mjs';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');
const config = JSON.parse(await read('config/release.json'));
const out = {};
for (const name of ['RelayFactory','RelayBranch','RelayEncoder','RelayVerifier']) {
  const a = JSON.parse(await read(`out/${name}.sol/${name}.json`));
  const metadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
  for (const [path, source] of Object.entries(metadata.sources)) assert.equal(keccak256(await readFile(new URL(path,root))),source.keccak256,`Working source differs from compiler input: ${path}`);
  assert.equal(config.frozenBuild.compiler, metadata.compiler.version, 'Frozen compiler drift');
  const settings = { ...metadata.settings }; delete settings.compilationTarget;
  assert.deepEqual(config.frozenBuild.settings, settings, 'Frozen compiler settings drift');
  for (const [path, source] of Object.entries(metadata.sources)) assert.equal(config.frozenBuild.sources[path], source.keccak256, `Frozen source drift: ${path}`);
  assert.deepEqual(JSON.parse(await read(`abi/${name}.json`)), a.abi, `${name} ABI drift`);
  const sz = h => (h.length - 2) / 2;
  out[name] = { creationCodeHash: keccak256(a.bytecode.object), runtimeBytesBeforeImmutablePatching: sz(a.deployedBytecode.object), initcodeBytes: sz(a.bytecode.object) };
  assert.deepEqual({ ...config.runtimeChecks[name], immutableBindings: undefined }, { bytes: sz(a.deployedBytecode.object), normalizedKeccak: keccak256(a.deployedBytecode.object), immutableReferences: a.deployedBytecode.immutableReferences ?? {}, immutableBindings: undefined }, `${name} runtime validation drift`);
  assert.ok(out[name].runtimeBytesBeforeImmutablePatching <= 24576); assert.ok(out[name].initcodeBytes <= 49152);
}
assert.deepEqual(config.contracts, out, 'release.json artifact drift');
validateReleaseState(config, JSON.parse(await read('config/production-gate.json')));
const handoffPath = 'dist/imd-deployment.json';
if (config.productionDeployment) {
  const { verifyHandoffAssets } = await import('../sdk/handoff.mjs');
  const h = JSON.parse(await read(handoffPath));
  const files = await verifyHandoffAssets(h, p => readFile(new URL('dist/' + p, root)));
  const d=config.productionDeployment;
  for(const c of h.contracts) assert.equal(c.address.toLowerCase(),d[c.name.replace('Relay','').toLowerCase()].toLowerCase(),'Handoff deployment address drift');
  assert.equal(h.sourceCommit,d.sourceCommit); assert.equal(h.attestationHash,d.attestationHash);
  const e=JSON.parse(new TextDecoder().decode(files.get('deployment-evidence.json')));
  for(const k of ['sourceCommit','attestationHash','transactionHash','blockHash'])assert.equal(e[k],d[k],`Deployment evidence drift: ${k}`);
  assert.equal(e.blockNumber,d.blockNumber);assert.deepEqual(e.build,config.frozenBuild);
  const exported=[];const walk=async(path='')=>{for(const entry of await readdir(new URL('dist/'+path,root),{withFileTypes:true})){const p=path+entry.name;if(entry.isDirectory())await walk(p+'/');else{assert.ok(entry.isFile(),'Export must contain regular files only');if(p!=='imd-deployment.json')exported.push(p);}}};await walk();
  assert.deepEqual(exported.sort(),h.assets.map(a=>a.path).sort(),'Every final export byte must be inventoried');
} else {
  try { await read(handoffPath); assert.fail('Undeployed candidate must not carry a public handoff'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
console.log(JSON.stringify({ ok: true, ABI: 'MATCH', releaseContracts: 'MATCH', policyId: config.policyId, contracts: out }, null, 2));
