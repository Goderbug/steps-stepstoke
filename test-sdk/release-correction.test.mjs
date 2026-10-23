import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as node from '../sdk/index.mjs';
import * as browser from '../sdk/browser.mjs';

for (const [name, sdk] of [['Node', node], ['browser', browser]]) {
  test(`${name}: generic strict JSON preserves the on-chain 256-token boundary`, () => {
    // Root + key + outer array + eight arrays + 245 scalars = 256 retained tokens.
    const payload = extra => new TextEncoder().encode(JSON.stringify({items:
      [...Array.from({length: 7}, () => Array(32).fill(0)), Array(21 + extra).fill(0)]}));
    assert.equal(sdk.strictJSON(payload(0)).items.length, 8);
    assert.throws(() => sdk.strictJSON(payload(1)), /Invalid or excessive JSON/);
    // Raising manifest capacity must not change the unrelated generic parser.
    assert.equal(sdk.MANIFEST_LIMITS.retainedTokens, 1024);
  });
}

test('published manifest policy matches the audited SDK and Solidity segment charge', () => {
  const release = JSON.parse(readFileSync(new URL('../config/release.json', import.meta.url)));
  const policy = release.manifestParser;
  for (const key of ['depth','objectMembers','keyBytes','retainedTokens','retainedStringBytes','totalValues','totalKeyBytes']) {
    assert.equal(policy[key], node.MANIFEST_LIMITS[key], key);
  }
  assert.equal(policy.combinedWork.maximum, node.MANIFEST_LIMITS.work);
  assert.equal(policy.combinedWork.segmentFlushWork, node.MANIFEST_LIMITS.segmentFlushWork);
  assert.equal(policy.combinedWork.formula, 'rawBytes + 96 * totalValues + 8 * totalDecodedKeyBytes + 4 * priorKeyComparisons + 8 * segmentFlushes');
  const source = readFileSync(new URL('../src/libraries/ManifestJSON.sol', import.meta.url), 'utf8');
  assert.match(source, /SEGMENT_FLUSH_WORK\s*=\s*8\s*;/);
});
