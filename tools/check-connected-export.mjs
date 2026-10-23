#!/usr/bin/env node
// Final offline integrity/authority check. No contract build, RPC or wallet operation.
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { sha256 } from '../vendor/ethers/ethers.mjs';
import { loadPublicHandoff, canonicalJSON } from '../sdk/handoff.mjs';
import { validateReleaseState, uiCapabilities } from '../sdk/gates.mjs';
const read = p => readFile(p);
const json = async p => JSON.parse(await read(p));
const release = await json('config/release.json'), gate = await json('config/production-gate.json');
validateReleaseState(release, gate);
assert.ok(release.productionDeployment);
assert.equal(release.productionReady, false); assert.equal(release.liveCompatibility, 'NOT_RUN');
for (const id of [0, 1, 2, 3, 4]) { assert.equal(gate.profiles[id].status, 'NOT_RUN'); assert.deepEqual(gate.profiles[id].evidence, []); }
const config = await loadPublicHandoff({ base: '', fetch: async p => new Response(await read('dist/' + p)) });
const caps = uiCapabilities({ verified: true, config, gate });
assert.equal(caps.read, true);
assert.ok(Object.entries(caps).every(([k, v]) => k === 'read' || v === false), 'Deployment cannot grant signing authority');
assert.deepEqual(config.productionGate, gate);
const h = config.handoff, actual = await json('.imd/reads/deployment.json'), network = await json('.imd/reads/network.json');
assert.equal(h.sourceCommit, actual.sourceCommit); assert.equal(h.attestationHash, actual.attestationHash); assert.equal(h.launchId, actual.launchId);
assert.equal(canonicalJSON(h.network), canonicalJSON(network.network));
assert.equal(canonicalJSON(h.walletAddChain), canonicalJSON(network.walletAddChain));
for (const c of h.contracts) assert.equal(c.address, actual.contracts.find(a => a.name === c.name).address);
const paths = [];
async function walk(dir) {
  for (const entry of await readdir(dir)) {
    const p = dir + '/' + entry, s = await lstat(p);
    assert.ok(!s.isSymbolicLink(), `Export symlink: ${p}`);
    if (s.isDirectory()) await walk(p); else { assert.ok(s.isFile()); paths.push(p.slice(5)); }
  }
}
await walk('dist');
assert.deepEqual(paths.filter(p => p !== 'imd-deployment.json').sort(), h.assets.map(a => a.path).sort());
assert.ok(!paths.some(p => /(?:^|\/)(?:local-config|ethereum-config)\.json$|\.(?:map|tgz|tar\.gz)$/.test(p)), 'Rehearsal config or packaging artifact in public export');
const html = (await read('dist/index.html')).toString();
assert.ok([...html.matchAll(/(?:src|href)="([^"]+)"/g)].every(m => m[1].startsWith('./')));
for (const pattern of [/<title>STEPS/, /rel="icon"/, /name="description"/, /property="og:title"/, /property="og:image"/]) assert.match(html, pattern);
const protectedPaths = ['foundry.toml', 'foundry.lock', 'remappings.txt', '.gitmodules', 'lib', 'package.json', 'package-lock.json', 'frontend/package.json', 'frontend/package-lock.json', 'abi', 'sdk/abi.mjs', 'launch.json'];
assert.equal(execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...protectedPaths], { encoding: 'utf8' }).trim(), '');
assert.ok(!execFileSync('git', ['ls-files', '--stage'], { encoding: 'utf8' }).split('\n').some(l => l.startsWith('160000 ')), 'Submodule in delivery');
const inventory = [];
for (const path of paths.sort()) {
  const raw = await read('dist/' + path);
  inventory.push({ path, bytes: raw.length, sha256: sha256(raw).slice(2) });
}
const result = { checkedAt: new Date().toISOString(), status: 'PASS', exportFiles: inventory.length,
  totalExportBytes: inventory.reduce((n, f) => n + f.bytes, 0), inventory, capabilities: caps,
  protectedBuildDependenciesContractsABIsManifest: 'UNCHANGED', networkAndWalletParameters: 'MATCH_AUTHENTIC_HANDOFF',
  contractSourceCommit: h.sourceCommit, websiteSourceCommit: 'ASSIGNED_BY_IMD_AFTER_REVIEW; not the inherited HEAD or contract source',
  publication: { websiteCommit: null, url: null, cid: null, status: 'NO_SERVICE_PUBLICATION_OUTPUT_AVAILABLE_TO_WORKER' },
  liveCompatibility: 'NOT_RUN', productionReady: false };
await writeFile('docs/validation/live-connection-v1/final-assets.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, exportFiles: inventory.length, bytes: result.totalExportBytes, signing: false, productionReady: false }));
