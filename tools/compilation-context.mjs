// The complete clean compilation unit affects via-IR output, including Foundry preprocessing.
// Core-only or incremental artifacts must not silently become the release fingerprint.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
export async function compilationContext(root = new URL('../', import.meta.url)) {
  const names = (await readdir(new URL('out/build-info/', root))).filter(p => p.endsWith('.json'));
  assert.equal(names.length, 1, 'Release requires one clean full compilation; run node tools/build-release.mjs');
  const info = JSON.parse(await readFile(new URL('out/build-info/' + names[0], root)));
  const cache = JSON.parse(await readFile(new URL('cache/solidity-files-cache.json', root)));
  const sources = {};
  for (const file of Object.values(cache.files).map(f => f.sourceName).sort()) {
    assert.ok(!file.startsWith('test/scratch/'), 'Scratch Solidity is not a release input');
    assert.ok(Object.values(info.source_id_to_path).includes(file), 'Mixed compilation cache');
    sources[file] = keccak256(await readFile(new URL(file, root)));
  }
  return {
    compilation: {
      command: 'forge build --offline --force',
      forge: execFileSync('forge', ['--version'], { encoding: 'utf8' }).split('\n').slice(0, 2).join('\n'),
      sourceIdToPath: info.source_id_to_path,
    },
    sources,
  };
}
