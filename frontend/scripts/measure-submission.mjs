#!/usr/bin/env node
// Materialize the complete deliverable file set in a fresh temporary Git repository, then make
// a single-commit source bundle. The shared repository's .git is read only and is never mutated.
import { mkdtemp, mkdir, copyFile, stat, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(p => p && !p.startsWith('.imd/'));
const work = await mkdtemp(join(tmpdir(), 'cto-source-bundle-'));
let rawBytes = 0, fileCount = 0;
try {
  for (const p of files) {
    if (/(^|\/)(\.git|node_modules|\.cache|\.vite)(\/|$)/.test(p)) throw new Error(`Generated/forbidden source path ${p}`);
    const source = resolve(root, p), target = resolve(work, p);
    const s = await stat(source).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!s?.isFile()) continue; // Rebuilt hashed export assets may be deleted from the old index.
    await mkdir(dirname(target), { recursive: true }); await copyFile(source, target);
    rawBytes += s.size; fileCount++;
  }
  execFileSync('git', ['init', '-q', work]);
  execFileSync('git', ['-C', work, 'add', '-f', '.']);
  execFileSync('git', ['-C', work, '-c', 'user.name=Source bundle measurement', '-c', 'user.email=local@invalid', 'commit', '-qm', 'Complete deliverable source snapshot']);
  const bundle = join(tmpdir(), 'cto-relay-final-source.bundle');
  execFileSync('git', ['-C', work, 'bundle', 'create', bundle, '--all']);
  execFileSync('git', ['bundle', 'verify', bundle], { cwd: work, stdio: 'pipe' });
  const bytes = (await stat(bundle)).size;
  const report = { method: 'Fresh Git repository containing every deliverable file from git ls-files --cached --others --exclude-standard, excluding only removed .imd inputs. Single-commit complete source snapshot bundle, verified with git bundle verify. Temporary repository and bundle are not submitted.', fileCount, rawBytes, sourceSnapshotGitBundleBytes: bytes, limit: 8388608, reserveForFinalReportBytes: 65536, status: bytes + 65536 <= 8388608 ? 'PASS' : 'FAIL', originalRepositoryHistory: 'NOT_MEASURED: shared repository is read-only and has missing promisor history; no original .git mutation or history truncation performed' };
  await writeFile(resolve(root, 'docs/validation/integration/acceptance/submission-size.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (report.status !== 'PASS') process.exitCode = 1;
} finally { await rm(work, { recursive: true, force: true }); }
