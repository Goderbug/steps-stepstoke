#!/usr/bin/env node
// Separate structural release audit. This does not certify behavioral safety or live IMD.
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const report = { kind: 'WORKER_STRUCTURAL_REVIEW_NOT_INDEPENDENT_CONTRIBUTOR_REVIEW', checks: [], limitations: ['Structural checks are not behavioral proof', 'Independent contributor review of this frontend integration: NOT_RUN', 'Real IMD/live compatibility: NOT_RUN'] };
const read = p => readFile(resolve(root, p));
const json = async p => JSON.parse(await read(p));
const sha = b => createHash('sha256').update(b).digest('hex');
function check(name, ok, detail) { report.checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail }); if (!ok) process.exitCode = 1; }
const pins = await json('docs/validation/integration/frontend/input-provenance.json');
const manifest = await json('docs/validation/review-fixes/source-sha256.json');
const coreFiles = Object.entries(manifest.files).filter(([p]) => p.startsWith('src/') || p.startsWith('abi/') || p === 'config/release.json');
for (const [p, h] of coreFiles) check(`patched baseline ${p}`, sha(await read(p)) === h, 'Source bytes remain identical to the authenticated patched A1 baseline');
const protectedPaths = ['foundry.toml', 'foundry.lock', 'remappings.txt', '.gitmodules', 'lib', 'package.json', 'package-lock.json'];
const changedProtected = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', ...protectedPaths], { cwd: root, encoding: 'utf8' }).trim();
check('Protected root build/dependency files', !changedProtected, changedProtected || 'No changes');
check('Pinned W1 dependency lockfile', sha(await read('frontend/package-lock.json')) === pins.w1.files['package-lock.json'], 'Exact original lockfile SHA-256');
const pkg = await json('frontend/package.json'), lock = await json('frontend/package-lock.json');
check('Frontend dependency versions', JSON.stringify(pkg.dependencies) === JSON.stringify(lock.packages[''].dependencies) || Object.keys(pkg.dependencies).every(k => pkg.dependencies[k] === lock.packages[''].dependencies[k]), 'Manifest dependency versions match the preserved lock');
const release = await json('config/release.json');
check('Release readiness stays closed', release.productionDeployment === null && release.productionReady === false && release.liveCompatibility === 'NOT_RUN', 'No public deployment or live-compatibility claim');
const local = await json('frontend/public/local-config.json');
check('Local observed configuration', local.kind === 'LOCAL_DEPLOYMENT' && local.chainId === 31337 && local.release.policyId === release.policyId && Object.values(local.runtimeCodeKeccak).every(h => /^0x[0-9a-f]{64}$/.test(h)), 'Actual deployed code hashes; browser re-verifies them before signing');
check('Exported configuration matches source', sha(await read('dist/local-config.json')) === sha(await read('frontend/public/local-config.json')), 'Exact runtime config bytes');
const index = (await read('dist/index.html')).toString();
check('Metadata', /<title>.+<\/title>/.test(index) && /rel="icon"/.test(index) && /name="description"/.test(index) && /property="og:title"/.test(index) && /property="og:image"/.test(index), 'Title, icon, description and Open Graph metadata');
const urls = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(x => !x.startsWith('#'));
check('Relative export entry assets', urls.every(x => x.startsWith('./')), urls);
for (const u of urls) check(`Export asset ${u}`, (await stat(resolve(root, 'dist', u))).isFile(), 'Present');
for (const f of await readdir(resolve(root, 'dist/assets'))) {
 if (!f.endsWith('.css')) continue;
 const css = (await read(`dist/assets/${f}`)).toString();
 for (const match of css.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
  if (match[1].startsWith('data:')) continue;
  check(`CSS runtime asset ${match[1]}`, !match[1].startsWith('/') && (await stat(resolve(root, 'dist/assets', match[1]))).isFile(), 'Relative and present');
 }
}
const paths = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean).filter(p => !p.startsWith('.imd/'));
check('No dependency/cache artifacts in source set', !paths.some(p => /(^|\/)(node_modules|\.vite|\.cache|playwright-report|test-results)(\/|$)/.test(p)), 'Generated paths excluded at every nesting level');
check('No frontend npm archives', !paths.some(p => p.startsWith('frontend/') && /\.(tgz|tar\.gz)$/.test(p)), 'Inherited root offline dependencies are preserved');
let frontendBytes = 0, distBytes = 0;
for (const p of paths) { if (!p.startsWith('frontend/') && !p.startsWith('dist/')) continue; const s = await stat(resolve(root, p)).catch(error => { if (error.code === 'ENOENT') return null; throw error; }); if (s?.isFile()) { if (p.startsWith('dist/')) distBytes += s.size; else frontendBytes += s.size; } }
check('Frontend source plus export <= 8 MiB', frontendBytes + distBytes <= 8388608, { frontendBytes, distBytes, combinedBytes: frontendBytes + distBytes, limit: 8388608 });
report.result = report.checks.some(c => c.status === 'FAIL') ? 'FAIL' : 'PASS';
await writeFile(resolve(root, 'docs/validation/platform-ux-v1/final/structural-review.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ result: report.result, checks: report.checks.length, frontendBytes, distBytes, independentContributorReview: 'NOT_RUN' }));
