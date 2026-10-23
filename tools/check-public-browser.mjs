#!/usr/bin/env node
// Actual browser requests only: no route interception, proxy, wallet or cached traces.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Interface, keccak256 } from '../vendor/ethers/ethers.mjs';
import { verifyBoundRuntime } from '../sdk/deployment.mjs';
const { chromium } = await import(process.argv[2] ?? '../frontend/node_modules/playwright/index.mjs');
const h = JSON.parse(await readFile('.imd/reads/deployment.json', 'utf8'));
const report = JSON.parse(await readFile('docs/validation/live-connection-v1/chain-report.json', 'utf8'));
const release = JSON.parse(await readFile('config/release.json', 'utf8'));
const policy = JSON.parse(await readFile('docs/validation/live-connection-v1/public-read-transport.json', 'utf8'));
const addresses = Object.fromEntries(h.contracts.map(c => [c.name.replace('Relay', '').toLowerCase(), c.address]));
const iface = new Interface(JSON.parse(await readFile('abi/RelayFactory.json', 'utf8')));
const blockTag = n => '0x' + n.toString(16);
const requests = [
  { name: 'chain', method: 'eth_chainId', params: [] },
  { name: 'receipt', method: 'eth_getTransactionReceipt', params: [report.transactionHash] },
  { name: 'block', method: 'eth_getBlockByNumber', params: [blockTag(report.deploymentBlock), false] },
  { name: 'trace', method: 'debug_traceTransaction', params: [report.transactionHash, { tracer: 'callTracer' }] },
  ...h.contracts.flatMap(c => ['before', 'deployment', 'latest'].map(at => ({ name: `${c.name}:${at}`, method: 'eth_getCode', params: [c.address, at === 'latest' ? at : blockTag(report.deploymentBlock - (at === 'before' ? 1 : 0))] }))),
  ...['encoder', 'verifier'].map(name => ({ name: `getter:${name}`, method: 'eth_call', params: [{ to: addresses.factory, data: iface.encodeFunctionData(name) }, 'latest'] })),
  { name: 'head', method: 'eth_blockNumber', params: [] },
  { name: 'transaction', method: 'eth_getTransactionByHash', params: [report.transactionHash] },
  { name: 'nonce', method: 'eth_getTransactionCount', params: [report.outerSender, 'latest'] },
  { name: 'logs', method: 'eth_getLogs', params: [{ address: addresses.factory, fromBlock: blockTag(report.deploymentBlock), toBlock: blockTag(report.deploymentBlock) }] },
];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const headers = [];
  page.on('response', async response => {
    if (policy.rpcUrls.some(u => new URL(u).origin === new URL(response.url()).origin)) {
      const h = await response.allHeaders();
      headers.push({ url: response.url(), status: response.status(), allowOrigin: h['access-control-allow-origin'] ?? null,
        allowMethods: h['access-control-allow-methods'] ?? null, allowHeaders: h['access-control-allow-headers'] ?? null });
    }
  });
  const preview = process.argv[3] ?? 'http://127.0.0.1:4175/preview/';
  await page.goto(preview, { waitUntil: 'domcontentloaded' });
  const results = [];
  for (const request of requests) {
    const attempts = [];
    let value, answered = false;
    for (const url of policy.rpcUrls) {
      const result = await page.evaluate(async ({ url, request }) => {
        try {
          const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' },
            credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: request.method, params: request.params }) });
          const body = await response.json();
          return { status: response.status, body };
        } catch (e) { return { error: `${e.name}: ${e.message}` }; }
      }, { url, request });
      attempts.push({ url, httpStatus: result.status ?? null, error: result.error ?? result.body?.error ?? null });
      if (result.status === 200 && result.body?.jsonrpc === '2.0' && result.body.id === 1 && Object.hasOwn(result.body, 'result')) {
        value = result.body.result; answered = true; break;
      }
    }
    assert.ok(answered, `No anonymous browser response for ${request.name}: ${JSON.stringify(attempts)}`);
    if (request.name === 'chain') assert.equal(value, '0x1');
    else if (request.name === 'receipt') { assert.equal(value.blockHash, report.blockHash); assert.equal(value.transactionHash, report.transactionHash); assert.equal(BigInt(value.status), 1n); }
    else if (request.name === 'block') { assert.equal(value.hash, report.blockHash); assert.ok(value.transactions.includes(report.transactionHash)); }
    else if (request.name === 'head') assert.ok(BigInt(value) >= BigInt(report.deploymentBlock));
    else if (request.name === 'nonce') assert.ok(/^0x[0-9a-f]+$/u.test(value) && BigInt(value) >= 1n);
    else if (request.name === 'transaction') { assert.equal(value.hash, report.transactionHash); assert.equal(value.blockHash, report.blockHash); assert.equal(value.from, report.outerSender); assert.equal(value.to, report.outerRecipient); }
    else if (request.name === 'logs') { assert.ok(Array.isArray(value)); for (const log of value) { assert.equal(log.address.toLowerCase(), addresses.factory); assert.equal(log.blockHash, report.blockHash); assert.equal(log.removed, false); } }
    else if (request.name === 'trace') {
      assert.equal(value.from, report.outerSender); assert.equal(value.to, report.outerRecipient);
      const creates = []; const walk = t => { assert.ok(t && !t.error); if (['CREATE', 'CREATE2'].includes(t.type)) creates.push(t); for (const c of t.calls ?? []) walk(c); }; walk(value);
      for (const c of h.contracts) { const t = creates.find(t => t.to.toLowerCase() === c.address); assert.ok(t); assert.equal(t.from, report.outerRecipient); assert.equal(keccak256(t.input), report.applications.find(a => a.name === c.name).initKeccakWithArguments); }
    } else if (request.method === 'eth_getCode') {
      if (request.name.endsWith(':before')) assert.equal(value, '0x');
      else verifyBoundRuntime(value, request.name.split(':')[0], release, addresses);
    } else if (request.method === 'eth_call') assert.equal(iface.decodeFunctionResult(request.name.split(':')[1], value)[0].toLowerCase(), addresses[request.name.split(':')[1]]);
    results.push({ name: request.name, method: request.method, status: 'PASS', attempts });
  }
  assert.equal(results.length, 19);
  await writeFile('docs/validation/live-connection-v1/browser-public-reads.json', JSON.stringify({ checkedAt: new Date().toISOString(),
    browser: `Chromium ${browser.version()}`, origin: new URL(preview).origin, actualHostedOrigin: 'NOT_AVAILABLE_BEFORE_IMD_PUBLICATION',
    interceptedRoutes: 0, credentials: 'omit', wallet: 'NONE', supportedReadMethodsCovered: [...new Set(results.map(r => r.method))], results, responseHeaders: headers,
    limitation: 'Anonymous endpoint availability and CORS are observations at this time, not service guarantees. The final hosted URL must be checked after IMD returns it.' }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, anonymousBrowserChecks: results.length, failed: 0, hostedOrigin: 'NOT_RUN' }));
} finally { await browser.close(); }
