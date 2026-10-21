import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keccak256, sha256 } from '../vendor/ethers/ethers.mjs';
import * as node from '../sdk/index.mjs';
import * as browser from '../sdk/browser.mjs';
import { verifyHTMLDist } from '../sdk/files.mjs';
import { observeLocalDeployment, publicConfigStatus } from '../sdk/config.mjs';
import { parityVectors, BRANCH } from './parity-vectors.mjs';

const root = new URL('../', import.meta.url);
const fixture = name => readFile(new URL(`test/fixtures/${name}`, root));
const u8 = buffer => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
const fx = {
  documentResult: u8(await fixture('document.md.result.json')), document: u8(await fixture('document.md')),
  image: u8(await fixture('image-2.png')), keccak: keccak256
};
fx.imageSha = sha256(fx.image);
fx.documentSha = sha256(fx.document);
const BROWSER_MODULES = ['sdk/browser.mjs', 'sdk/core.mjs', 'sdk/strict-json.mjs', 'sdk/abi.mjs', 'sdk/files-browser.mjs', 'sdk/config.mjs'];

test('browser entrypoint import graph avoids node:*, fs, DNS, HTTPS, process and implicit Buffer', async () => {
  const seen = new Set();
  const visit = async rel => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const source = await readFile(new URL(rel, root), 'utf8');
    const code = source.replace(/\/\/.*$/gmu, '');
    assert.doesNotMatch(code, /from\s+['"]node:|import\(['"]node:|require\(/u, rel);
    assert.doesNotMatch(code, /\bBuffer\b|\bprocess\.|\bfs\b|node:dns|node:https/u, rel);
    for (const [, spec] of source.matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/gu)) {
      const next = new URL(spec, new URL(rel, root)).pathname.slice(new URL(root).pathname.length);
      if (!next.startsWith('vendor/')) await visit(next);
    }
  };
  await visit('sdk/browser.mjs');
  await visit('sdk/config.mjs');
  for (const rel of BROWSER_MODULES) assert.ok(seen.has(rel), `${rel} reached`);
  // The vendored ethers bundle is the browser ESM build: it imports nothing.
  assert.doesNotMatch(await readFile(new URL('vendor/ethers/ethers.mjs', root), 'utf8'), /^\s*import\s/mu);
});

test('embedded ABI module matches the exported abi/*.json byte hashes', () => {
  const result = spawnSync(process.execPath, [new URL('tools/generate-sdk-abi.mjs', root).pathname, '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('Node and browser entrypoints produce identical calldata, witness, hashes and rejections', () => {
  const a = parityVectors(node, fx);
  const b = parityVectors(browser, fx);
  assert.equal(a.runtime, 'node');
  assert.equal(b.runtime, 'browser');
  assert.deepEqual(b.ok, a.ok);
  assert.deepEqual(b.rejected, a.rejected);
  for (const [name, value] of Object.entries(a.ok)) assert.ok(!value?.threw, `${name}: ${value?.threw}`);
  for (const [name, value] of Object.entries(a.rejected)) assert.notEqual(value, 'ACCEPTED', name);
  assert.equal(a.ok.filePNG.sha256, fx.imageSha);
});

test('browser entrypoint runs in a Node process with Buffer, process.binding and require removed', () => {
  const script = `
    // Node's own lazily loaded fetch internals need Buffer; load them before removing it.
    void [globalThis.fetch, globalThis.Response, globalThis.ReadableStream, globalThis.Blob];
    delete globalThis.Buffer; delete globalThis.require; globalThis.process.binding = undefined;
    const sdk = await import(${JSON.stringify(new URL('sdk/browser.mjs', root).href)});
    const { parityVectors } = await import(${JSON.stringify(new URL('test-sdk/parity-vectors.mjs', root).href)});
    const { keccak256, sha256 } = await import(${JSON.stringify(new URL('vendor/ethers/ethers.mjs', root).href)});
    const fx = JSON.parse(process.argv[1], (k, v) => Array.isArray(v) && k !== 'inputs' && typeof v[0] === 'number' ? new Uint8Array(v) : v);
    fx.keccak = keccak256; fx.imageSha = sha256(fx.image); fx.documentSha = sha256(fx.document);
    console.log(JSON.stringify({ hasBuffer: typeof Buffer, vectors: parityVectors(sdk, fx) }));`;
  const plain = { documentResult: Array.from(fx.documentResult), document: Array.from(fx.document), image: Array.from(fx.image) };
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, JSON.stringify(plain)], { encoding: 'utf8', maxBuffer: 1 << 24 });
  assert.equal(result.status, 0, result.stderr);
  const child = JSON.parse(result.stdout);
  assert.equal(child.hasBuffer, 'undefined');
  const reference = parityVectors(node, fx);
  assert.deepEqual(child.vectors.ok, reference.ok);
  assert.deepEqual(child.vectors.rejected, reference.rejected);
});

test('utf8Length matches Buffer.byteLength, including unpaired surrogates', () => {
  for (const s of ['', 'a', 'é', '中文', '😀', '\uD800', '\uDC00x', 'a\uD83D', '😀\uD800', 'x'.repeat(300)]) {
    assert.equal(node.utf8Length(s), Buffer.byteLength(s), JSON.stringify(s));
  }
});

test('HTML export check matches the Node dist check for embedded images and refuses tampering', async () => {
  const html = u8(Buffer.from(`<!doctype html><html><body><img src="data:image/png;base64,${Buffer.from(fx.image).toString('base64')}"></body></html>`));
  const descriptor = { path: 'dist/index.html', mediaType: 'text/html', hash: sha256(html), bytes: html.length };
  const images = [{ descriptor: { mediaType: 'image/png', hash: fx.imageSha, bytes: fx.image.length }, bytes: fx.image }];
  const dir = await mkdtemp(join(tmpdir(), 'relay-browser-'));
  try {
    await mkdir(join(dir, 'dist'));
    await writeFile(join(dir, 'dist', 'index.html'), html);
    const a = await verifyHTMLDist(join(dir, 'dist'), descriptor, images);
    const b = browser.verifyHTMLExport(descriptor, html, images);
    assert.deepEqual(b, a);
    const other = new Uint8Array(fx.image); other[20] ^= 1;
    assert.throws(() => browser.verifyHTMLExport(descriptor, html, [{ descriptor: { ...images[0].descriptor, hash: sha256(other) }, bytes: other }]), /not embedded exactly/u);
    for (let n = 0; n < 7; n++) assert.equal(browser.base64(fx.image.subarray(0, n)), Buffer.from(fx.image.subarray(0, n)).toString('base64'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

const policy = browser.createArtifactPolicy({ locations: [{ origin: 'https://artifacts.example', pathPrefix: '/ipfs/' }] });
const respond = (body, init = {}, url = 'https://artifacts.example/ipfs/doc') => {
  const response = new Response(body, init);
  Object.defineProperty(response, 'url', { value: url });
  if (init.redirected) Object.defineProperty(response, 'redirected', { value: true });
  return response;
};
const markdown = { hash: sha256(fx.document), bytes: fx.document.length, mediaType: 'text/markdown' };

test('browser artifact fetch: configured location, credential-free request, verified bytes', async () => {
  let seen;
  const result = await browser.fetchTrustedArtifact('https://artifacts.example/ipfs/doc', markdown, {
    policy, fetch: async (url, init) => { seen = init; return respond(fx.document); }
  });
  assert.equal(result.status, 'VERIFIED');
  assert.equal(result.source, 'TRUSTED_HTTPS');
  assert.equal(result.dns, 'NOT_OBSERVABLE_IN_BROWSER');
  assert.deepEqual([seen.credentials, seen.redirect, seen.referrerPolicy, seen.mode], ['omit', 'error', 'no-referrer', 'cors']);
});

test('browser artifact fetch refuses untrusted, redirected, oversized, tampered and failed responses', async () => {
  const never = async () => { throw new Error('fetch must not be called'); };
  const code = async (promise, expected) => assert.equal((await promise.then(() => null, e => e)).code, expected);
  for (const url of ['http://artifacts.example/ipfs/doc', 'https://evil.example/ipfs/doc', 'https://artifacts.example/other', 'https://u:p@artifacts.example/ipfs/doc', 'javascript:alert(1)']) {
    await code(browser.fetchTrustedArtifact(url, markdown, { policy, fetch: never }), 'UNTRUSTED_LOCATION');
  }
  await code(browser.fetchTrustedArtifact('https://artifacts.example/ipfs/doc', markdown, { policy, fetch: async () => respond(fx.document, { redirected: true }, 'https://evil.example/x') }), 'BAD_REDIRECT');
  await code(browser.fetchTrustedArtifact('https://artifacts.example/ipfs/doc', markdown, { policy, fetch: async () => { throw new TypeError('redirect'); } }), 'NETWORK_ERROR');
  await code(browser.fetchTrustedArtifact('https://artifacts.example/ipfs/doc', markdown, { policy, fetch: async () => respond(fx.document, { headers: { 'content-length': '70000' } }) }), 'TOO_LARGE');
  let pulled = 0;
  const endless = new ReadableStream({ pull(controller) { pulled++; controller.enqueue(new Uint8Array(16384)); } });
  await code(browser.fetchTrustedArtifact('https://artifacts.example/ipfs/doc', markdown, { policy, fetch: async () => respond(endless) }), 'TOO_LARGE');
  assert.ok(pulled <= 6, 'streaming read stops at the bound');
  const tampered = new Uint8Array(fx.document); tampered[0] ^= 1;
  await code(browser.fetchTrustedArtifact('https://artifacts.example/ipfs/doc', markdown, { policy, fetch: async () => respond(tampered) }), 'VERIFY_FAILED');
  await code(browser.fetchTrustedArtifact('https://artifacts.example/ipfs/doc', markdown, { policy, fetch: async () => respond('gone', { status: 404 }) }), 'HTTP_STATUS');
  await code(browser.fetchTrustedArtifact('https://artifacts.example/ipfs/doc', { ...markdown, mediaType: 'text/plain' }, { policy, fetch: never }), 'INVALID_DESCRIPTOR');
});

test('artifact policies: HTTPS hostnames only; loopback fixture policy is test-only', () => {
  for (const origin of ['http://a.example', 'https://127.0.0.1', 'https://[::1]', 'https://localhost', 'https://u:p@a.example', 'https://a.example/path']) {
    assert.throws(() => browser.createArtifactPolicy({ locations: [{ origin }] }), /./u, origin);
  }
  assert.throws(() => browser.createLoopbackFixturePolicy({ locations: [{ origin: 'http://127.0.0.1:9' }], pageOrigin: 'https://relay.example' }), /test-only/u);
  assert.throws(() => browser.createLoopbackFixturePolicy({ locations: [{ origin: 'https://a.example' }], pageOrigin: 'http://127.0.0.1:5173' }));
  const fixture = browser.createLoopbackFixturePolicy({ locations: [{ origin: 'http://127.0.0.1:9' }], pageOrigin: 'http://127.0.0.1:5173' });
  assert.equal(fixture.kind, 'TEST_ONLY_LOOPBACK_FIXTURE');
});

test('readBlobBounded reads a File/Blob up to the bound only', async () => {
  assert.deepEqual(await browser.readBlobBounded(new Blob([fx.document]), 100), fx.document);
  await assert.rejects(browser.readBlobBounded(new Blob([new Uint8Array(101)]), 100));
});

test('wallet request carries only the prepared unsigned transaction', () => {
  const prepared = browser.sponsorProposal(BRANCH, 1, 5, []);
  const request = browser.toWalletRequest(prepared, { from: '0x4000000000000000000000000000000000000004', chainId: 31337 });
  assert.equal(request.method, 'eth_sendTransaction');
  assert.deepEqual(Object.keys(request.params[0]).sort(), ['chainId', 'data', 'from', 'to', 'value']);
  assert.equal(request.params[0].chainId, '0x7a69');
  assert.throws(() => browser.toWalletRequest({ ...prepared, value: '0x1' }, { from: request.params[0].from, chainId: 1 }));
});

test('config generation stays closed without a public deployment and refuses non-local chains', async () => {
  const release = JSON.parse(await readFile(new URL('config/release.json', root), 'utf8'));
  assert.equal(publicConfigStatus(release).status, 'CLOSED');
  const provider = { request: async ({ method }) => { if (method === 'eth_chainId') return '0x1'; throw new Error('unexpected'); } };
  await assert.rejects(observeLocalDeployment(provider, { release, factory: BRANCH }), /not a local development chain/u);
});
