import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
import * as nodeSDK from '../sdk/index.mjs';
import * as browserSDK from '../sdk/browser.mjs';

const original = JSON.parse(await readFile(new URL('../test/fixtures/document.md.result.json', import.meta.url)));
const declared = { outputName: 'main', outputPath: 'artifacts/main.md' };
const encode = value => new TextEncoder().encode(JSON.stringify(value));
const extra = i => ({ name: `data-${i}`, path: `artifacts/data-${i}.json`, mediaType: 'application/json', bytes: 999999999 });

for (const [runtime, sdk] of [['node', nodeSDK], ['browser', browserSDK]]) {
  test(`${runtime}: selects the declared output at each end of 2, 4 and 17 files`, () => {
    for (const count of [2, 4, 17]) for (const first of [true, false]) {
      const extras = Array.from({ length: count - 1 }, (_, i) => extra(i));
      const files = first ? [...original.files, ...extras] : [...extras, ...original.files];
      const raw = encode({ ...original, files });
      const out = sdk.verifyManifest(raw, keccak256(raw), declared);
      assert.equal(out.file.hash, `0x${original.files[0].hash}`);
      assert.deepEqual(Object.keys(out), ['jobId', 'projectId', 'file']);
    }
  });
  test(`${runtime}: never guesses, accepts a collision or falls back to source metadata`, () => {
    for (const collision of [
      { name: 'main', path: 'artifacts/other.md' },
      { name: 'other', path: 'artifacts/main.md' },
      original.files[0], null, {},
    ]) {
      const raw = encode({ ...original, files: [collision, ...original.files] });
      assert.throws(() => sdk.verifyManifest(raw, keccak256(raw), declared));
    }
    const raw = encode({ ...original, files: [extra(0)], source: original.files });
    assert.throws(() => sdk.verifyManifest(raw, keccak256(raw), declared), /missing/);
    assert.throws(() => sdk.verifyManifest(raw, keccak256(raw), {}), /name and path/);
    const multi = encode({ ...original, files: [extra(0), ...original.files] });
    assert.throws(() => sdk.verifyManifest(multi, keccak256(multi)), /Supply declared output/);
  });
  test(`${runtime}: authenticates ignored entries and rejects malformed metadata and bounds`, () => {
    const value = { ...original, files: [extra(0), ...original.files] };
    const raw = encode(value);
    const changed = encode({ ...value, files: [extra(1), ...original.files] });
    assert.throws(() => sdk.verifyManifest(changed, keccak256(raw), declared), /digest mismatch/);
    for (const bad of [
      new TextEncoder().encode(new TextDecoder().decode(raw).replace('"bytes":999999999', '"bytes":0,"b\\u0079tes":1')),
      new TextEncoder().encode(new TextDecoder().decode(raw).replace('application/json', '\\ud800')),
      encode({ ...value, metadata: 'x'.repeat(32768) }),
    ]) assert.throws(() => sdk.verifyManifest(bad, keccak256(bad), declared));
  });
  test(`${runtime}: a supplied proposal also constrains a single-file result`, () => {
    const raw = encode(original);
    assert.deepEqual(sdk.verifyManifest(raw, keccak256(raw)), sdk.verifyManifest(raw, keccak256(raw), declared));
    assert.throws(() => sdk.verifyManifest(raw, keccak256(raw), { name: 'other', path: 'artifacts/other.md' }), /missing/);
  });
}

test('exact captured public fixture matches the inlined Solidity replay byte for byte', async () => {
  const raw = await readFile(new URL('../test/fixtures/public/observed-multiple-files.json', import.meta.url));
  const inline = await readFile(new URL('../test/fixtures/MultiFileResult.sol', import.meta.url), 'utf8');
  const literal = inline.match(/return bytes\(\s*'([^\n]*)'\s*\);/)[1];
  assert.deepEqual(Buffer.from(literal), raw);
});
