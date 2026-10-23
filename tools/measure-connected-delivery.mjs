#!/usr/bin/env node
// Measures a complete source snapshot in a temporary repository. The project .git/history
// is read-only and is never replaced, committed, staged or truncated by this tool.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, lstat, writeFile, rm, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { sha256 } from '../vendor/ethers/ethers.mjs';
const root = resolve('.'), reportPath = 'docs/validation/live-connection-v1/delivery-size.json';
const all = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean))].sort();
const work = await mkdtemp('/tmp/steps-connected-source-');
const bundle = work + '/snapshot.bundle';
const files = []; let rawBytes = 0;
try {
  for (const p of all) {
    if (p.startsWith('.imd/') || p.startsWith('test/scratch/')) continue;
    assert.ok(!/(^|\/)(?:\.git|node_modules|\.cache|\.vite|playwright-report|test-results)(?:\/|$)/u.test(p), `Generated dependency/cache path: ${p}`);
    const s = await lstat(p).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (!s) continue;
    assert.ok(s.isFile(), `Non-regular delivery file: ${p}`);
    const dst = resolve(work, 'source', p);
    await mkdir(dirname(dst), { recursive: true }); await copyFile(p, dst);
    rawBytes += s.size; files.push(p);
  }
  const snapshot = work + '/source';
  execFileSync('git', ['init', '-q', snapshot]);
  execFileSync('git', ['-C', snapshot, 'add', '-f', '.']);
  execFileSync('git', ['-C', snapshot, '-c', 'user.name=STEPS delivery measurement', '-c', 'user.email=measurement@invalid', 'commit', '-qm', 'Complete delivery snapshot for size measurement only']);
  execFileSync('git', ['-C', snapshot, 'bundle', 'create', bundle, '--all']);
  execFileSync('git', ['-C', snapshot, 'bundle', 'verify', bundle], { stdio: 'pipe' });
  const bytes = (await lstat(bundle)).size, reserve = 65536;
  const report = { status: bytes + reserve <= 8388608 ? 'PASS' : 'FAIL', fileCount: files.length, rawBytes,
    completeSourceSnapshotGitBundleBytes: bytes, reserveForMeasurementReportBytes: reserve, limitBytes: 8388608,
    method: 'Complete current deliverable file set from git ls-files cached/others/exclude-standard, copied to a fresh temporary repository; verified single-snapshot Git bundle. Required offline SDK archives and all inherited evidence are preserved.',
    originalRepositoryHistory: 'UNCHANGED; not truncated, replaced or measured as a complete historical clone',
    generatedDirectories: 'EXCLUDED at every nesting level',
    requiredOfflineDependencyArchives: 'PRESERVED: the unchanged root package-lock and SDK regressions require vendor/npm/*.tgz',
    frontendDependencyArchives: 'NONE',
    excludedInputsAndScratch: ['.imd/', 'test/scratch/', 'ignored build/cache/node_modules directories'],
    publicExport: { bytes: JSON.parse(await readFile('docs/validation/live-connection-v1/final-assets.json')).totalExportBytes,
      manifestSha256: sha256(await readFile('dist/imd-deployment.json')).slice(2) },
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  assert.equal(report.status, 'PASS', 'Complete Git source snapshot exceeds 8 MiB');
} finally { await rm(work, { recursive: true, force: true }); }
