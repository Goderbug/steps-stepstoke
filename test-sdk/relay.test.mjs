import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { AbiCoder, keccak256, toBeHex } from '../vendor/ethers/ethers.mjs';
import * as relay from '../sdk/index.mjs';
import { MockReadProvider } from './mock-rpc.mjs';

const factory = '0x1000000000000000000000000000000000000001'; // Local ABI fixture only.
const branch = '0x2000000000000000000000000000000000000002';
const key = n => toBeHex(n, 32);
const fixture = async name => readFile(new URL(`../test/fixtures/${name}`, import.meta.url));
const bytes = text => new TextEncoder().encode(text);
const raw = await fixture('document.md.result.json');
const document = await fixture('document.md');
const parsed = JSON.parse(raw);
const asset = {
  key: key(1), kind: 0, name: 'main', path: 'artifacts/main.md', fileHash: `0x${parsed.files[0].hash}`,
  mediaType: 'text/markdown', size: parsed.files[0].bytes, submissionHash: `0x${parsed.files[0].submissionHash}`,
  producer: branch, jobId: parsed.jobId, resultHash: keccak256(raw), revision: 1
};

test('legacy names remain readable but cannot become invalid official request inputs', () => {
  const legacy={...asset,name:'1legacy'};
  assert.equal(relay.canonicalWitness([legacy])[0].name,'1legacy');
  assert.throws(()=>relay.validateProposal({anchor:key(1),profile:0,target:key(2),inputs:[key(1)],outputName:'next',outputPath:'artifacts/next.md',text:'Write the next report.',publish:false},[legacy]),/Input names must start with a letter/);
});

test('vendored ethers is exactly 6.17.0 and every locked dependency is present offline', async () => {
  assert.equal(relay.ethersVersion, '6.17.0');
  const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(lock.packages[''].dependencies.ethers, '6.17.0');
  for (const [name, item] of Object.entries(lock.packages)) {
    if (!name) continue;
    assert.ok(item.resolved.startsWith('file:vendor/npm/'));
    const tarball = await readFile(new URL(`../${item.resolved.slice(5)}`, import.meta.url));
    assert.equal(`sha512-${createHash('sha512').update(tarball).digest('base64')}`, item.integrity);
  }
});

test('all six functions have unsigned ABI transaction/read preparation', () => {
  const p = { anchor: key(10), profile: 0, target: key(1), inputs: [], outputName: 'main', outputPath: 'artifacts/main.md', text: 'Continue the public goal', publish: false };
  const cases = [
    [relay.createProject(factory, 'A fixed public goal'), relay.interfaces.factory, 'createProject'],
    [relay.proposeWork(branch, p, []), relay.interfaces.branch, 'propose'],
    [relay.sponsorProposal(branch, 1, 500_000_000_000_000_000n, []), relay.interfaces.branch, 'sponsor'],
    [relay.retryRefused(branch, 700_000_000_000_000_000n, []), relay.interfaces.branch, 'retry'],
    [relay.bindResult(branch, raw, keccak256(raw), []), relay.interfaces.branch, 'bind'],
    [relay.forkHistory(factory, branch, 1, [asset], 'Take the original in a new direction'), relay.interfaces.factory, 'fork']
  ];
  for (const [tx, iface, name] of cases) {
    assert.equal(iface.parseTransaction(tx).name, name);
    assert.equal(tx.value, '0x0');
    assert.deepEqual(Object.keys(tx), ['to', 'data', 'value']);
  }
  const read = relay.readState(branch, 'checkpoint', [1]);
  assert.equal(read.kind, 'eth_call');
  assert.equal(relay.interfaces.branch.parseTransaction(read.transaction).name, 'checkpoint');
  const continuation = relay.proposeWork(branch, { ...p, profile: 1, inputs: [key(1)] }, [asset]);
  assert.equal(relay.interfaces.branch.parseTransaction(continuation).name, 'propose');
});

test('proposal zero, unsigned funding caps, publishing and invalid inputs are rejected', () => {
  assert.throws(() => relay.sponsorProposal(branch, 0, 1, []));
  assert.throws(() => relay.sponsorProposal(branch, 1, 0, []));
  assert.throws(() => relay.retryRefused(branch, -1, []));
  assert.throws(() => relay.forkHistory(factory, branch, 0, [], 'fork'));
  assert.throws(() => relay.createProject(factory, '\ud800'));
  assert.throws(() => relay.readState(branch, 'sponsor', []));
  const p = { anchor: key(1), profile: 0, target: key(1), inputs: [], outputName: 'main', outputPath: 'artifacts/main.md', text: 'work', publish: true };
  assert.throws(() => relay.proposeWork(branch, p, []));
  const defaults = { ...p };
  delete defaults.publish;
  const defaultTx = relay.proposeWork(branch, defaults, []);
  assert.equal(relay.interfaces.branch.parseTransaction(defaultTx).args[0].publish, false);
  assert.throws(() => relay.proposeWork(branch, { ...p, publish: false, outputPath: '../main.md' }, []));
  assert.throws(() => relay.proposeWork(branch, { ...p, publish: false, inputs: [key(2), key(1)] }, []));
});

test('client rejects fixed-profile violations before it prepares a purchaseable proposal', () => {
  const base = { anchor: key(10), profile: relay.PROFILES.MarkdownUpdate, target: key(1), inputs: [key(1)], outputName: 'main', outputPath: 'artifacts/main.md', text: 'Update', publish: false };
  assert.equal(relay.validateProposal(base, [asset]).proposal.outputPath, 'artifacts/main.md');
  assert.throws(() => relay.validateProposal({ ...base, inputs: [] }, [asset]), /select target/u);
  assert.throws(() => relay.validateProposal({ ...base, outputName: 'changed' }, [asset]), /mapping/u);
  assert.throws(() => relay.validateProposal({ ...base, profile: relay.PROFILES.HTMLUpdate, outputName: 'main', outputPath: 'artifacts/index.html' }, [asset]), /mapping/u);
  assert.throws(() => relay.validateProposal({ ...base, profile: relay.PROFILES.ImageCreate, inputs: [key(1)], target: key(2), outputName: 'image', outputPath: 'artifacts/image.png' }, [asset]), /references/u);
  assert.throws(() => relay.validateProposal({ ...base, profile: relay.PROFILES.MarkdownCreate, inputs: [], target: key(1) }, [asset]), /already exists/u);
});

test('raw binding preserves exact bytes and refuses a reserialization with a different digest', () => {
  const tx = relay.bindResult(branch, raw, keccak256(raw), []);
  const args = relay.interfaces.branch.decodeFunctionData('bind', tx.data);
  assert.equal(args[0], `0x${raw.toString('hex')}`);
  const changed = bytes(JSON.stringify(parsed, null, 2));
  assert.throws(() => relay.bindResult(branch, changed, keccak256(raw), []));
  assert.throws(() => relay.bindResult(branch, bytes('{"x":1,"\\u0078":2}'), keccak256(bytes('{"x":1,"\\u0078":2}')), []));
});

test('canonical witnesses sort, retain provenance, detect duplication and encode deterministically', () => {
  const other = { ...asset, key: key(2), revision: 4, jobId: 'later-job', resultHash: key(111) };
  const sorted = relay.canonicalWitness([other, asset]);
  assert.equal(sorted[0].key, key(1));
  assert.equal(sorted[1].revision, 4n);
  assert.equal(relay.witnessHash([other, asset]), relay.witnessHash([asset, other]));
  assert.notEqual(relay.witnessHash([asset]), relay.witnessHash([{ ...asset, producer: factory }]));
  assert.throws(() => relay.canonicalWitness([asset, asset]));
  assert.throws(() => relay.canonicalWitness([{ ...asset, size: 65537 }]));
  assert.throws(() => relay.canonicalWitness([{ ...asset, revision: 0 }]));
});

test('SDK golden witness and calldata are shared with executed Solidity tests', async () => {
  const golden = JSON.parse(await fixture('sdk-golden.json'));
  assert.equal(relay.witnessHash([asset]), golden.digest);
  assert.equal(relay.witnessHash(golden.witness), golden.digest);
  assert.equal(relay.createProject(factory, 'SDK golden goal').data, golden.createCalldata);
});

test('history is recoverable from full witness logs and permanent checkpoint reads', () => {
  const witness = relay.canonicalWitness([asset]);
  const encoded = AbiCoder.defaultAbiCoder().encode([relay.ASSET_TYPE], [witness]);
  const digest = key(88);
  const event = relay.interfaces.branch.encodeEventLog('CheckpointWritten', [1, digest, encoded]);
  const log = { ...event, address: branch, removed: false };
  const checkpoints = { 1: { digest, assetsHash: relay.witnessHash(witness) } };
  const history = relay.recoverHistory(branch, [log], checkpoints);
  assert.equal(history[0].witness[0].jobId, parsed.jobId);
  assert.equal(history[0].witness[0].resultHash, keccak256(raw));
  assert.throws(() => relay.recoverHistory(branch, [log], { 1: { ...checkpoints[1], assetsHash: key(9) } }));
  assert.throws(() => relay.recoverHistory(branch, [{ ...log, address: factory }], checkpoints));
  assert.throws(() => relay.recoverHistory(branch, [{ ...log, removed: true }], checkpoints));
  assert.throws(() => relay.recoverHistory(branch, [log, log], checkpoints));
});

test('optional EIP-1193 querying makes eth_call only and decodes the prepared ABI read', async () => {
  const stateRead = relay.readState(branch, 'phase');
  const provider = new MockReadProvider(relay.interfaces.branch.encodeFunctionResult('phase', [2]));
  assert.equal((await relay.queryState(provider, stateRead))[0], 2n);
  assert.deepEqual(provider.calls, [{ method: 'eth_call', params: [stateRead.transaction, 'latest'] }]);
  const preview = relay.previewProposal(branch, 1, []);
  const previewProvider = new MockReadProvider(relay.interfaces.branch.encodeFunctionResult('bodyOf', [key(9), `0x${raw.toString('hex')}`]));
  assert.equal((await relay.queryPreview(previewProvider, preview)).bodyHash, keccak256(raw));
  await assert.rejects(relay.queryPrepared({ request: async () => 'nope' }, stateRead));
  await assert.rejects(relay.queryPrepared({ request: async request => { throw new Error(request.method); } }, relay.createProject(factory, 'not a read')));
});

test('actual Markdown, HTML and PNG bytes verify length, SHA-256 and MIME signature', async () => {
  for (const filename of ['document.md', 'document-updated.md', 'html-1.html', 'image-2.png', 'html-3.html']) {
    const manifest = await fixture(`${filename}.result.json`);
    const descriptor = relay.verifyManifest(manifest, keccak256(manifest)).file;
    const file = await fixture(filename);
    assert.equal(relay.verifyFile(descriptor, file).verified, true);
    const corrupted = Buffer.from(file);
    corrupted[0] ^= 1;
    assert.throws(() => relay.verifyFile(descriptor, corrupted));
    assert.throws(() => relay.verifyFile(descriptor, file.subarray(1)));
  }
  const descriptor = relay.verifyManifest(raw, keccak256(raw)).file;
  assert.throws(() => relay.verifyFile({ ...descriptor, mediaType: 'image/png' }, document));
  assert.throws(() => relay.verifyFile({ ...descriptor, hash: null, fileHash: null }, document), /Expected file hex digest/u);
  const html = (await fixture('html-3.html')).toString('utf8');
  assert.match(html, /id="original-marker"/u);
  const encoded = /data:image\/png;base64,([^"]+)/u.exec(html)[1];
  assert.deepEqual(Buffer.from(encoded, 'base64'), await fixture('image-2.png'));
});

test('strict raw parser rejects Unicode, duplicates, trailing content and excessive resources', () => {
  const bad = [
    '{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"nested":{"x":1,"x":2}}', '{"x":"\\ud800"}',
    '{"x":"\\udc00"}', '{"x":"\\uffff"}', '{"x":"\\ud800\\u0041"}', '{"x":01}', '{"x":1.}',
    '{"x":null,}', '{"x":[1,]}', '{"x":true}{}', '{"x":[[[[[[[[[1]]]]]]]]]}'
  ];
  for (const value of bad) assert.throws(() => relay.strictJSON(bytes(value)), value);
  assert.throws(() => relay.strictJSON(Buffer.from('7b2278223a22c080227d', 'hex')));
  assert.throws(() => relay.strictJSON(bytes(JSON.stringify({ x: 'x'.repeat(1025) }))));
  assert.throws(() => relay.strictJSON(new Uint8Array(16385)));
  assert.equal(relay.strictJSON(bytes('{"x":"caf\\u00e9 \\ud83d\\ude80"}')).x, 'café 🚀');
  assert.equal(relay.unsignedJSONInteger(relay.strictJSON(bytes('{"x":31}')).x, 65536), 31);
  for (const value of ['-0', '1e0', '1.0']) assert.throws(() => relay.unsignedJSONInteger(relay.strictJSON(bytes(`{"x":${value}}`)).x, 65536));
  assert.throws(() => relay.unsignedJSONInteger(relay.strictJSON(bytes('{"x":{"jsonNumber":"31"}}')).x, 65536));
  const deceptive = bytes(raw.toString('utf8').replace(`"bytes":${document.length}`, `"bytes":{"jsonNumber":"${document.length}"}`));
  assert.throws(() => relay.verifyManifest(deceptive, keccak256(deceptive)));
});

test('unknown transactions never trigger an automatic rebuy; stages remain separate', () => {
  assert.deepEqual(relay.reconcileTransaction({ receipt: null }), { transaction: 'UNKNOWN', action: 'LOOK_UP_ORIGINAL_HASH', purchase: false });
  assert.equal(relay.reconcileTransaction({ receipt: {} }).transaction, 'UNKNOWN');
  assert.equal(relay.reconcileTransaction({ receipt: { status: true } }).transaction, 'UNKNOWN');
  const paid = relay.reconcileTransaction({ receipt: { status: 1 }, phase: 2 });
  assert.equal(paid.callback, 'PENDING');
  assert.equal(paid.admission, 'NOT_PROVEN_BY_TRANSACTION');
  assert.equal(paid.git, 'UNVERIFIED');
  assert.equal(paid.publication, 'DISABLED');
  assert.equal(paid.purchase, false);
  assert.equal(relay.reconcileTransaction({ receipt: { status: 1 }, phase: 4 }).purchase, false);
});

test('lifecycle status never treats a receipt as admission, execution, file, Git or publication proof', () => {
  const pending = relay.lifecycleStatus({ receipt: { status: '0x1' }, phase: 2 });
  assert.deepEqual(pending, {
    transaction: 'MINED', admission: 'NOT_PROVEN_BY_TRANSACTION', execution: 'NOT_PROVEN_BY_TRANSACTION',
    callback: 'PENDING', binding: 'NOT_READY', file: 'NOT_CHECKED', git: 'NOT_OBSERVED',
    publication: 'DISABLED', automaticPurchase: 'NEVER'
  });
  const bound = relay.lifecycleStatus({ receipt: { status: 1 }, phase: 0, checkpointVerified: true, fileVerified: true, git: 'VERIFIED' });
  assert.equal(bound.binding, 'VERIFIED');
  assert.equal(bound.file, 'VERIFIED');
  assert.equal(bound.publication, 'DISABLED');
  assert.equal(relay.lifecycleStatus({ receipt: null }).transaction, 'UNKNOWN');
  assert.throws(() => relay.lifecycleStatus({ git: 'DELIVERED' }));
});

test('CLI prepares calldata without any RPC, key or signer', () => {
  const cli = new URL('../cli/relay.mjs', import.meta.url);
  const run = spawnSync(process.execPath, [cli.pathname, 'create', '--factory', factory, '--goal', 'A fixed goal'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(relay.interfaces.factory.parseTransaction(JSON.parse(run.stdout)).name, 'createProject');
  const invalid = spawnSync(process.execPath, [cli.pathname, 'send'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stderr).error.code, 'INVALID_INPUT');
});

test('CLI recovers authenticated checkpoint history from explicit local evidence only', async () => {
  const witness = relay.canonicalWitness([asset]);
  const encoded = AbiCoder.defaultAbiCoder().encode([relay.ASSET_TYPE], [witness]);
  const digest = key(44);
  const event = relay.interfaces.branch.encodeEventLog('CheckpointWritten', [1, digest, encoded]);
  const scratchRoot = new URL('../test/scratch/', import.meta.url);
  await mkdir(scratchRoot, { recursive: true });
  const directory = await mkdtemp(join(scratchRoot.pathname, 'history-cli-'));
  try {
    const logs = [{ ...event, address: branch, removed: false }];
    const checkpoints = { 1: { digest, assetsHash: relay.witnessHash(witness) } };
    await writeFile(join(directory, 'logs.json'), JSON.stringify(logs));
    await writeFile(join(directory, 'checkpoints.json'), JSON.stringify(checkpoints));
    const cli = new URL('../cli/relay.mjs', import.meta.url);
    const run = spawnSync(process.execPath, [cli.pathname, 'recover-history', '--branch', branch, '--logs', join(directory, 'logs.json'), '--checkpoints', join(directory, 'checkpoints.json')], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(JSON.parse(run.stdout)[0].digest, digest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
