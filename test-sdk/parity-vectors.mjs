// Runtime-neutral parity vectors. Receives an SDK entrypoint module (sdk/index.mjs in Node,
// sdk/browser.mjs in Node-without-Buffer or a real browser) plus fixture bytes, and returns a
// JSON-serialisable record. Equal records across runtimes prove identical calldata, witness
// hashes, manifest keccak, file SHA-256 and rejection behaviour. Imports nothing itself.
// Addresses below are local ABI fixtures only, never deployment values.
export const FACTORY = '0x1000000000000000000000000000000000000001';
export const BRANCH = '0x2000000000000000000000000000000000000002';
export const TOKEN = '0x3000000000000000000000000000000000000003';
export const OWNER = '0x4000000000000000000000000000000000000004';
const enc = text => new TextEncoder().encode(text);

export function parityVectors(sdk, fx) {
  const key = n => `0x${n.toString(16).padStart(64, '0')}`;
  const out = { runtime: sdk.RUNTIME, ok: {}, rejected: {} };
  const parsed = JSON.parse(new TextDecoder().decode(fx.documentResult));
  const asset = {
    key: key(1), kind: 0, name: 'main', path: 'artifacts/main.md', fileHash: `0x${parsed.files[0].hash}`, mediaType: 'text/markdown',
    size: parsed.files[0].bytes, submissionHash: `0x${parsed.files[0].submissionHash}`, producer: BRANCH, jobId: parsed.jobId,
    resultHash: null, revision: 1
  };
  const manifestKeccak = fx.keccak(fx.documentResult);
  asset.resultHash = manifestKeccak;
  const image = { ...asset, key: key(2), kind: 2, name: 'logo', path: 'assets/logo.png', mediaType: 'image/png', size: fx.image.length, fileHash: fx.imageSha, revision: 2 };
  const witness = [image, asset];
  const createP = { anchor: key(10), profile: 0, target: key(3), inputs: [key(1)], outputName: 'notes', outputPath: 'artifacts/notes.md', text: 'Write notes 中文 ✓', publish: false };
  const updateP = { anchor: key(10), profile: 1, target: key(1), inputs: [key(1)], outputName: 'main', outputPath: 'artifacts/main.md', text: 'Update', publish: false };
  const htmlP = { anchor: key(10), profile: 2, target: key(4), inputs: [key(1), key(2)], outputName: 'site', outputPath: 'artifacts/index.html', text: 'Site', publish: false };
  const record = (name, fn) => {
    try { out.ok[name] = JSON.parse(JSON.stringify(fn(), (_, v) => typeof v === 'bigint' ? `${v}n` : v instanceof Uint8Array ? Array.from(v) : v)); }
    catch (error) { out.ok[name] = { threw: error.message }; }
  };
  const reject = (name, fn) => {
    try { fn(); out.rejected[name] = 'ACCEPTED'; } catch (error) { out.rejected[name] = error.message; }
  };
  record('witness', () => sdk.canonicalWitness(witness));
  record('witnessHash', () => sdk.witnessHash(witness));
  record('emptyWitnessHash', () => sdk.witnessHash([]));
  record('create', () => sdk.createProject(FACTORY, 'A fixed public goal — 公共目标'));
  record('proposeCreate', () => sdk.proposeWork(BRANCH, createP, witness));
  record('proposeUpdate', () => sdk.proposeWork(BRANCH, updateP, witness));
  record('proposeHTML', () => sdk.proposeWork(BRANCH, htmlP, witness));
  record('sponsor', () => sdk.sponsorProposal(BRANCH, 3, '500000000000000000', witness));
  record('retry', () => sdk.retryRefused(BRANCH, '500000000000000000', witness));
  record('bind', () => sdk.bindResult(BRANCH, fx.documentResult, manifestKeccak, witness));
  record('fork', () => sdk.forkHistory(FACTORY, BRANCH, 2, witness, 'Fork direction'));
  record('preview', () => sdk.previewProposal(BRANCH, 1, witness));
  record('readPhase', () => sdk.readState(BRANCH, 'phase'));
  record('readCheckpoint', () => sdk.readState(BRANCH, 'checkpoint', [1]));
  record('approveExact', () => sdk.approveExact(TOKEN, BRANCH, '500000000000000000'));
  record('allowance', () => sdk.readAllowance(TOKEN, OWNER, BRANCH));
  record('walletRequest', () => sdk.toWalletRequest(sdk.sponsorProposal(BRANCH, 3, 1n, witness), { from: OWNER, chainId: 31337 }));
  record('manifestKeccak', () => manifestKeccak);
  record('manifest', () => sdk.verifyManifest(fx.documentResult, manifestKeccak));
  record('fileMarkdown', () => sdk.verifyFile({ hash: `0x${parsed.files[0].hash}`, bytes: parsed.files[0].bytes, mediaType: 'text/markdown' }, fx.document));
  record('filePNG', () => sdk.verifyFile({ hash: fx.imageSha, bytes: fx.image.length, mediaType: 'image/png' }, fx.image));
  record('strictUnicode', () => sdk.strictJSON(enc('{"a":"é中😀","b":[1,true,null]}')));
  record('utf8Length', () => [sdk.utf8Length('a'), sdk.utf8Length('é'), sdk.utf8Length('中'), sdk.utf8Length('😀'), sdk.utf8Length('\uD800')]);
  record('lifecycle', () => sdk.lifecycleStatus({ receipt: { status: 1 }, phase: 2 }));
  record('reconcileUnknown', () => sdk.reconcileTransaction({ receipt: null }));

  // Malformed, Unicode, duplicate and limit rejections must fail identically.
  reject('dupKey', () => sdk.strictJSON(enc('{"a":1,"a":2}')));
  reject('dupDecodedKey', () => sdk.strictJSON(enc('{"a":1,"\\u0061":2}')));
  reject('dupManifestMetadataKey', () => sdk.strictManifestJSON(enc('{"state":"completed","meta":{"x":1,"\\u0078":2}}')));
  reject('loneSurrogate', () => sdk.strictJSON(enc('{"a":"\\ud800"}')));
  reject('noncharacter', () => sdk.strictJSON(enc('{"a":"\\ufdd0"}')));
  reject('invalidUTF8', () => sdk.strictJSON(new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d])));
  reject('overlongUTF8', () => sdk.strictJSON(new Uint8Array([0x7b, 0x22, 0xc0, 0xaf, 0x22, 0x3a, 0x31, 0x7d])));
  reject('controlChar', () => sdk.strictJSON(enc('{"a":"\u0001"}')));
  reject('trailing', () => sdk.strictJSON(enc('{"a":1} x')));
  reject('topArray', () => sdk.strictJSON(enc('[1]')));
  reject('depth', () => sdk.strictManifestJSON(enc(`${'{"a":'.repeat(18)}1${'}'.repeat(18)}`)));
  reject('manifestBytes', () => sdk.strictManifestJSON(enc(`{"a":"${'x'.repeat(32800)}"}`)));
  reject('ignoredMetadataInvalid', () => sdk.strictManifestJSON(enc('{"state":"completed","meta":{"x":01}}')));
  reject('manifestWork', () => sdk.strictManifestJSON(enc(`{${Array.from({ length: 127 }, (_, i) => `"k${i}":[${Array(3).fill('0').join(',')}]`).join(',')}}`)));
  reject('integerSpelling', () => sdk.unsignedJSONInteger(sdk.strictJSON(enc('{"n":1e0}')).n, 10));
  reject('manifestDigest', () => sdk.verifyManifest(fx.documentResult, key(9)));
  reject('fileHash', () => sdk.verifyFile({ hash: key(9), bytes: fx.document.length, mediaType: 'text/markdown' }, fx.document));
  reject('fileLength', () => sdk.verifyFile({ hash: `0x${parsed.files[0].hash}`, bytes: fx.document.length + 1, mediaType: 'text/markdown' }, fx.document));
  reject('pngSignature', () => sdk.verifyFile({ hash: fx.documentSha, bytes: fx.document.length, mediaType: 'image/png' }, fx.document));
  reject('htmlSignature', () => sdk.verifyFile({ hash: fx.documentSha, bytes: fx.document.length, mediaType: 'text/html' }, fx.document));
  reject('fileTooLarge', () => sdk.verifyFile({ hash: key(1), bytes: 65537, mediaType: 'text/markdown' }, new Uint8Array(65537)));
  reject('mime', () => sdk.verifyFile({ hash: key(1), bytes: 1, mediaType: 'text/plain' }, new Uint8Array(1)));
  reject('witnessDuplicate', () => sdk.canonicalWitness([asset, asset]));
  reject('witnessDist', () => sdk.canonicalWitness([{ ...asset, path: 'dist/main.md' }]));
  reject('witnessCount', () => sdk.canonicalWitness(Array.from({ length: 17 }, (_, i) => ({ ...asset, key: key(i + 1), name: `a${i}`, path: `d/a${i}.md` }))));
  reject('textUnicode', () => sdk.createProject(FACTORY, 'bad \uD800'));
  reject('textControl', () => sdk.createProject(FACTORY, 'bad \u0007'));
  reject('textBytes', () => sdk.createProject(FACTORY, '中'.repeat(171)));
  reject('proposalCollision', () => sdk.proposeWork(BRANCH, { ...createP, outputName: 'main' }, witness));
  reject('proposalPrefix', () => sdk.proposeWork(BRANCH, { ...createP, outputPath: 'artifacts/main.md/x.md' }, witness));
  reject('proposalPublish', () => sdk.proposeWork(BRANCH, { ...createP, publish: true }, witness));
  reject('proposalInputsUnsorted', () => sdk.proposeWork(BRANCH, { ...htmlP, inputs: [key(2), key(1)] }, witness));
  reject('proposalImageRefs', () => sdk.proposeWork(BRANCH, { ...createP, profile: 4, outputPath: 'a/b.png', inputs: [key(2)] }, witness));
  reject('sponsorZero', () => sdk.sponsorProposal(BRANCH, 0, 1, witness));
  reject('approveUnlimited', () => sdk.approveExact(TOKEN, BRANCH, (1n << 256n) - 1n));
  reject('zeroAddress', () => sdk.createProject('0x0000000000000000000000000000000000000000', 'goal'));
  reject('bindOversize', () => sdk.bindResult(BRANCH, new Uint8Array(32769), key(1), witness));
  return out;
}
