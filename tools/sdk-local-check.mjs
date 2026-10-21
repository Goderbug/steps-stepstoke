#!/usr/bin/env node
// Actual-local-contract check of the browser SDK entrypoint. Needs `forge build` output and anvil.
//   node tools/sdk-local-check.mjs [--out FILE] [--browser chromium|webkit --executable PATH --playwright PATH_TO_playwright]
// --chrome EXECUTABLE remains supported for the original Chromium command.
// Starts a disposable anvil, places MockToken/MockIntake at the release's IMD/Intake addresses
// (LOCAL MOCKS), deploys the actual RelayFactory, generates the local config from deployed code,
// then runs tools/sdk-local-scenario.mjs with sdk/browser.mjs in Node and, when --chrome is given,
// inside a real Chromium page that talks to anvil directly. No key, backend or public RPC.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createServer as createHTTPServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, normalize } from 'node:path';
import { Interface } from '../vendor/ethers/ethers.mjs';
import * as sdk from '../sdk/browser.mjs';
import { observeLocalDeployment } from '../sdk/config.mjs';
import { runLocalScenario } from './sdk-local-scenario.mjs';
import { parityVectors } from '../test-sdk/parity-vectors.mjs';
import * as nodeSdk from '../sdk/index.mjs';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const engine = option('browser') ?? 'chromium';
if (!['chromium', 'webkit'].includes(engine)) throw new Error('Use --browser chromium or webkit');
const executable = option('executable') ?? option('chrome');
const freePort = async () => { const s = createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening'); const { port } = s.address(); await new Promise(r => s.close(r)); return port; };
const artifact = async name => JSON.parse(await readFile(new URL(`out/${name}.sol/${name}.json`, root)));
const u8 = b => new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
const fixture = async name => u8(await readFile(new URL(`test/fixtures/${name}`, root)));
const json = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);

const release = JSON.parse(await readFile(new URL('config/release.json', root), 'utf8'));
const port = await freePort();
const anvil = spawn('anvil', ['--host', '127.0.0.1', '--port', String(port), '--silent', '--gas-limit', '30000000'], { stdio: 'ignore' });
const rpcURL = `http://127.0.0.1:${port}`;
let id = 0;
const provider = { async request({ method, params = [] }) {
  const response = await fetch(rpcURL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
} };
const evidence = { kind: 'ACTUAL_LOCAL_CONTRACT', chain: 'anvil 31337 (disposable)', mocks: ['MockToken at release.imd', 'MockIntake at release.intake', 'mock writer callbacks'], liveCompatibility: 'NOT_RUN', productionDeployment: null, runs: [] };
let server;
try {
  for (let i = 0; ; i++) { try { await provider.request({ method: 'eth_chainId' }); break; } catch (error) { if (i > 200) throw error; await new Promise(r => setTimeout(r, 25)); } }
  const accounts = await provider.request({ method: 'eth_accounts' });
  const [deployer, writer, treasury, funderA, funderB] = accounts;
  const mined = async tx => {
    const hash = await provider.request({ method: 'eth_sendTransaction', params: [{ gas: '0x'+(16777216).toString(16), ...tx }] });
    for (let i = 0; i < 400; i++) { const r = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] }); if (r) { if (BigInt(r.status) !== 1n) throw new Error('setup reverted'); return r; } await new Promise(res => setTimeout(res, 25)); }
    throw new Error('setup receipt timeout');
  };
  const token = await artifact('MockToken');
  const intake = await artifact('MockIntake');
  const tokenI = new Interface(token.abi);
  const intakeI = new Interface(intake.abi);
  await provider.request({ method: 'anvil_setCode', params: [release.imd, token.deployedBytecode.object] });
  await provider.request({ method: 'anvil_setCode', params: [release.intake, intake.deployedBytecode.object] });
  await mined({ from: deployer, to: release.intake, data: intakeI.encodeFunctionData('initialize', [writer, treasury, release.imd]) });
  for (const action of Object.values(release.actions)) await mined({ from: deployer, to: release.intake, data: intakeI.encodeFunctionData('setPrice', [action, 500000000000000000n]) });
  for (const who of [funderA, funderB]) await mined({ from: deployer, to: release.imd, data: tokenI.encodeFunctionData('mint', [who, 10n ** 19n]) });
  const factoryArtifact = await artifact('RelayFactory');
  const encoder = await mined({ from: deployer, data: (await artifact('RelayEncoder')).bytecode.object });
  const verifier = await mined({ from: deployer, data: (await artifact('RelayVerifier')).bytecode.object });
  const args = new Interface(factoryArtifact.abi).encodeDeploy([encoder.contractAddress, verifier.contractAddress]);
  const deployed = await mined({ from: deployer, data: factoryArtifact.bytecode.object + args.slice(2) });
  const config = await observeLocalDeployment(provider, { release, factory: deployed.contractAddress });
  evidence.generatedConfig = config;
  const fixtures = {
    documentResult: await fixture('document.md.result.json'), document: await fixture('document.md'),
    updatedResult: await fixture('document-updated.md.result.json'), updated: await fixture('document-updated.md')
  };
  const scenario = { config, accounts: [deployer, funderA, funderB], writer, fixtures };
  evidence.runs.push(await runLocalScenario({ sdk, provider, intakeInterface: intakeI, label: 'node-browser-entrypoint', ...scenario }));

  if (executable) {
    const browserTypes = await import(option('playwright'));
    const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.md': 'text/markdown', '.png': 'image/png' };
    const allowed = ['sdk/', 'vendor/ethers/', 'tools/sdk-local-scenario.mjs', 'test-sdk/parity-vectors.mjs', 'test/fixtures/'];
    server = createHTTPServer(async (req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/u, '');
      if (path === '') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>sdk check</title>'); return; }
      if (path.includes('..') || !allowed.some(p => path.startsWith(p))) { res.writeHead(404); res.end(); return; }
      if (path === 'test/fixtures/oversized.md') { res.writeHead(200, { 'content-type': 'text/markdown', 'access-control-allow-origin': '*' }); for (let i = 0; i < 70; i++) res.write('x'.repeat(1024)); res.end(); return; }
      if (path === 'test/fixtures/redirect') { res.writeHead(302, { location: 'http://127.0.0.2/' }); res.end(); return; }
      try { const body = await readFile(new URL(path, root)); res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' }); res.end(body); } catch { res.writeHead(404); res.end(); }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await browserTypes[engine].launch({ executablePath: executable });
    try {
      const page = await browser.newPage();
      await page.goto(origin + '/');
      const plain = Object.fromEntries(Object.entries(fixtures).map(([k, v]) => [k, Array.from(v)]));
      const browserRun = await page.evaluate(async ({ origin, rpcURL, scenario, plain, intakeAbi, engine }) => {
        const sdk = await import(`${origin}/sdk/browser.mjs`);
        const { runLocalScenario } = await import(`${origin}/tools/sdk-local-scenario.mjs`);
        const { parityVectors } = await import(`${origin}/test-sdk/parity-vectors.mjs`);
        const { Interface, keccak256, sha256 } = await import(`${origin}/vendor/ethers/ethers.mjs`);
        const fixtures = Object.fromEntries(Object.entries(plain).map(([k, v]) => [k, new Uint8Array(v)]));
        let n = 0;
        const provider = { async request({ method, params = [] }) {
          const r = await fetch(rpcURL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params }) });
          const body = await r.json(); if (body.error) throw new Error(`${method}: ${body.error.message}`); return body.result;
        } };
        const out = { environment: { userAgent: navigator.userAgent, bufferType: typeof Buffer, processType: typeof process, secureContext: isSecureContext } };
        out.scenario = await runLocalScenario({ sdk, provider, intakeInterface: new Interface(intakeAbi), label: `${engine}-browser-entrypoint`, ...scenario, fixtures });
        const image = new Uint8Array(await (await fetch(`${origin}/test/fixtures/image-2.png`)).arrayBuffer());
        out.vectors = parityVectors(sdk, { documentResult: fixtures.documentResult, document: fixtures.document, image, imageSha: sha256(image), documentSha: sha256(fixtures.document), keccak: keccak256 });
        out.webCrypto = { png: await sdk.webCryptoSha256(image), ethers: sdk.browserSha256(image) };
        // Real browser streaming fetch through the TEST-ONLY loopback fixture policy.
        const policy = sdk.createLoopbackFixturePolicy({ locations: [{ origin, pathPrefix: '/test/fixtures/' }] });
        const descriptor = { hash: sha256(fixtures.document), bytes: fixtures.document.length, mediaType: 'text/markdown' };
        const fetched = await sdk.fetchTrustedArtifact(`${origin}/test/fixtures/document.md`, descriptor, { policy });
        const attempt = async (url, d) => { try { await sdk.fetchTrustedArtifact(url, d, { policy }); return 'ACCEPTED'; } catch (e) { return e.code; } };
        out.fetch = {
          ok: { status: fetched.status, source: fetched.source, bytes: fetched.bytes.length, sha256: fetched.verification.sha256 },
          tampered: await attempt(`${origin}/test/fixtures/document-updated.md`, descriptor),
          // Real Markdown cap breach: a 70 KiB chunked body (no Content-Length) for a Markdown descriptor.
          oversized: await attempt(`${origin}/test/fixtures/oversized.md`, descriptor),
          redirect: await attempt(`${origin}/test/fixtures/redirect`, descriptor),
          outsidePolicy: await attempt(`${origin}/sdk/core.mjs`, descriptor),
          productionPolicyRefusesLoopback: (() => { try { sdk.createArtifactPolicy({ locations: [{ origin }] }); return 'ACCEPTED'; } catch (e) { return e.code; } })()
        };
        return out;
      }, { origin, rpcURL, scenario: { config, accounts: scenario.accounts, writer }, plain, intakeAbi: intake.abi, engine });
      evidence.runs.push(browserRun.scenario);
      evidence[engine] = { environment: browserRun.environment, webCrypto: browserRun.webCrypto, fetch: browserRun.fetch };
      const nodeVectors = parityVectors(nodeSdk, { documentResult: fixtures.documentResult, document: fixtures.document, image: await fixture('image-2.png'), imageSha: sdk.browserSha256(await fixture('image-2.png')), documentSha: sdk.browserSha256(fixtures.document), keccak: sdk.keccak256Bytes });
      evidence[engine].parity = {
        okEqual: JSON.stringify(nodeVectors.ok) === JSON.stringify(browserRun.vectors.ok),
        rejectedEqual: JSON.stringify(nodeVectors.rejected) === JSON.stringify(browserRun.vectors.rejected),
        vectors: Object.keys(nodeVectors.ok).length, rejections: Object.keys(nodeVectors.rejected).length,
        mismatches: [...Object.keys(nodeVectors.ok).filter(k => JSON.stringify(nodeVectors.ok[k]) !== JSON.stringify(browserRun.vectors.ok[k])), ...Object.keys(nodeVectors.rejected).filter(k => nodeVectors.rejected[k] !== browserRun.vectors.rejected[k])]
      };
      const f = browserRun.fetch;
      const ok = evidence[engine].parity.okEqual && evidence[engine].parity.rejectedEqual && browserRun.environment.bufferType === 'undefined'
        && browserRun.webCrypto.png === browserRun.webCrypto.ethers && f.ok.status === 'VERIFIED' && f.tampered === 'VERIFY_FAILED'
        && f.oversized === 'TOO_LARGE' && f.redirect === 'NETWORK_ERROR' && f.outsidePolicy === 'UNTRUSTED_LOCATION' && f.productionPolicyRefusesLoopback === 'INVALID_POLICY';
      evidence[engine].result = ok ? 'PASS' : 'FAIL';
      if (!ok) process.exitCode = 1;
    } finally { await browser.close(); }
  } else evidence[engine] = { result: 'NOT_RUN', reason: 'no browser executable supplied' };
  evidence.result = process.exitCode ? 'FAIL' : 'PASS';
} catch (error) {
  evidence.result = 'FAIL';
  evidence.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  anvil.kill();
  server?.close();
}
const text = json(evidence) + '\n';
if (option('out')) await writeFile(option('out'), text); else process.stdout.write(text);
console.error(`sdk-local-check: ${evidence.result}`);
