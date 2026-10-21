#!/usr/bin/env node
// Acceptance signs through a named EIP-6963 provider in the built W1 UI. The provider forwards
// unsigned transactions to two disposable unlocked Anvil accounts. It holds no key and never
// substitutes an adapter, calldata, fixture state or a CLI replay for a browser action.
import { chromium, webkit, expect as playwrightExpect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, cp } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { startLocal } from '../../scripts/local-setup.mjs';
import * as sdk from '../../../sdk/browser.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
// Software-rendered WebKit and RPC-heavy history verification need a bounded allowance for
// slow CI. This changes assertion patience only; no timer can unlock or resubmit an operation.
const expect = playwrightExpect.configure({ timeout: 30000 });
const option = name => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? undefined : process.argv[i + 1]; };
const engine = option('browser') ?? 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine), 'Use --browser chromium or webkit');
const group = option('group') ?? 'all';
const groups = { all: null, flow: [0, 1, 2, 3], recovery: [0, 4, 5], payments: [0, 6, 7, 8], failures: [0, 9, 10, 11], files: [0, 12] };
assert.ok(group in groups, 'Use --group all|flow|recovery|payments|failures|files');
const out = resolve(root, option('out') ?? `docs/validation/platform-ux-v1/final/local/${engine}${process.argv.includes('--mobile') ? '-mobile' : ''}${group === 'all' ? '' : '-' + group}`);
await mkdir(resolve(out, 'screenshots'), { recursive: true });
const evidence = { classification: 'ACTUAL_LOCAL_CONTRACT_WITH_MOCK_INTAKE', engine, group, productionDeployment: null, liveCompatibility: 'NOT_RUN', productionReady: false, matrix: [], transactions: [], walletTransactions: [], browserErrors: [], consoleErrors: [], unexpectedRequests: [] };
// Preserve navigation/RPC context for browser diagnostics without treating a successful
// transaction matrix as proof of a clean browser console.
evidence.browserDiagnostics = [];
let currentCase = null;
const expectedHTTPFailures = new Set();
evidence.expectedResourceDiagnostics = [];
const allCases = [...(await readFile(fileURLToPath(import.meta.url), 'utf8')).matchAll(/await record\('([^']+)',/g)].map(m => m[1]);
const planned = allCases.filter((_, i) => !groups[group] || groups[group].includes(i));
const saveProgress = async () => {
  const matrix = [...evidence.matrix, ...planned.filter(name => !evidence.matrix.some(r => r.name === name)).map(name => ({ name, status: 'NOT_RUN' }))];
  await writeFile(resolve(out, 'progress.json'), JSON.stringify({ ...evidence, matrix, transactions: local.trace }, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
};
const record = async (name, fn) => {
  if (!planned.includes(name)) return;
  currentCase = name;
  const before = { walletTransactions: evidence.walletTransactions.length, purchases: await countPurchases() };
  try { const detail = await fn(); evidence.matrix.push({ name, status: 'PASS', detail, before, after: { walletTransactions: evidence.walletTransactions.length, purchases: await countPurchases() } }); await saveProgress(); console.log('PASS', name); }
  catch (e) { evidence.matrix.push({ name, status: 'FAIL', error: e.stack }); await saveProgress(); console.error('FAIL', name, e.message); throw e; }
};
const local = await startLocal();
await copyFile(resolve(root, 'frontend/public/local-config.json'), resolve(root, 'dist/local-config.json'));
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4174', '--host', '127.0.0.1', '--strictPort'], { cwd: resolve(root, 'frontend'), stdio: 'ignore' });
let browser, page;
const read = async (branch, method, args = []) => (await sdk.queryState(local.provider, sdk.readState(branch, method, args)))[0];
const countPurchases = async () => Number(BigInt(await local.provider.request({ method: 'eth_call', params: [{ to: local.release.intake, data: local.intakeI.encodeFunctionData('count') }, 'latest'] })));
const tx = (operation, to, data, from = local.writer) => local.send(operation, { from, to, data });
const funding = () => page.getByRole('dialog', { name: /Fund a contribution|Review identical paid retry/ });
async function disclose(title) { if(page.url().includes('/b/')) await expect(page.locator('#assets')).toHaveAttribute('data-branch-id',page.url().split('/b/')[1]); await expect(page.locator('summary').filter({ hasText:title }).first()).toBeAttached(); for (const el of await page.locator('summary').filter({ hasText: title }).all()) { if (!(await el.evaluate(el => el.parentElement.open))) await el.click(); } }
async function selectRound(n) { await page.getByRole('button', { name: new RegExp(`^Select Round ${n}(,|$)`) }).click(); }
const refresh = () => page.getByRole('button', { name: 'Refresh chain state' }).click();
async function capture(name) {
  const mobile=process.argv.includes('--mobile');
  const retained=mobile ? name==='actual-local-home-390.jpg' : ['actual-web.jpg','actual-local-320.jpg'].includes(name);
  const destination=retained?resolve(out,'screenshots',name):resolve(root,'test/scratch/local-captures',engine+(mobile?'-mobile':''),name);
  await mkdir(dirname(destination),{recursive:true});
  await page.screenshot({path:destination,type:'jpeg',quality:36,scale:'css',fullPage:false});
}

async function initWallet(context) {
  await context.addInitScript(({ rpcURL, accounts }) => {
    const listeners = new Map();
    let connected = false, selected = 0, chain = '0x7a69', reject = false, hold = false;
    let nextId = 0;
    const calls = [], transactions = [];
    const emit = (name, value) => listeners.get(name)?.forEach(fn => fn(value));
    const rpc = async (method, params) => {
      const response = await fetch(rpcURL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++nextId, method, params }) });
      const body = await response.json(); if (body.error) throw new Error(body.error.message); return body.result;
    };
    const provider = {
      on(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); return this; },
      removeListener(name, fn) { listeners.get(name)?.delete(fn); return this; },
      async request({ method, params = [] }) {
        calls.push({ method, params });
        if (method === 'eth_requestAccounts') { connected = true; return [accounts[selected]]; }
        if (method === 'eth_accounts') return connected ? [accounts[selected]] : [];
        if (method === 'eth_chainId') return chain;
        if (method === 'wallet_requestPermissions') return [{ parentCapability: 'eth_accounts' }];
        if (method === 'wallet_getPermissions') return connected ? [{ parentCapability: 'eth_accounts' }] : [];
        if (method === 'wallet_switchEthereumChain') { chain = params[0].chainId; emit('chainChanged', chain); return null; }
        if (method === 'eth_sendTransaction') {
          if (reject) { reject = false; throw Object.assign(new Error('User rejected request'), { code: 4001 }); }
          while (hold) await new Promise(r => setTimeout(r, 20));
          if (params[0].from.toLowerCase() !== accounts[selected].toLowerCase() || chain !== '0x7a69') throw new Error('Account/network changed in wallet');
          const unsigned = params[0];
          const gas = await rpc('eth_estimateGas', [unsigned]);
          const hash = await rpc(method, [{ ...unsigned, gas: `0x${(BigInt(gas) * 12n / 10n).toString(16)}` }]);
          transactions.push({ hash, ...unsigned });
          return hash;
        }
        return rpc(method, params);
      }
    };
    const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: '85a72ed5-2710-4e82-9518-5ca0bfaab9d1', name: 'Relay Local Test Wallet', icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>", rdns: 'test.relay.local' }, provider } }));
    addEventListener('eip6963:requestProvider', announce);
    Object.assign(window, { relayTestWallet: { calls, transactions, select(n) { selected = n; emit('accountsChanged', [accounts[n]]); }, network(value) { chain = value; emit('chainChanged', chain); }, reject() { reject = true; }, hold(v) { hold = v; } } });
    announce();
  }, { rpcURL: local.config.rpcURL, accounts: local.accounts });
}
async function createProject(title) {
  if (page.url() !== 'http://127.0.0.1:4174/#/local') await page.goto('http://127.0.0.1:4174/#/local');
  await expect(page.getByText('Reading projects…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create project', exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'Connect wallet', exact: true }).isVisible()) { await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await page.getByRole('button', { name: 'Relay Local Test Wallet', exact: true }).click(); }
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByLabel('Project title', { exact: true }).fill(title);
  await page.getByLabel('Fixed goal (cannot change after creation)').fill('Preserve real files and historical origins.');
  await page.getByRole('button', { name: 'Review creation' }).click();
  await page.getByRole('button', { name: 'Sign and create', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open project', exact: true })).toBeVisible();
  const href = await page.getByRole('link', { name: 'Open project', exact: true }).getAttribute('href');
  await page.getByRole('link', { name: 'Open project', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  return href.split('/').at(-1);
}
async function propose({ kind = 'document', mode = 'create', target = 'main', inputs = [], text = 'Generate deterministic local files' } = {}) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Prepare a contribution' });
  await form.getByLabel('Type').selectOption(kind);
  await form.getByRole('radio', { name: mode === 'create' ? 'Create' : 'Update', exact: true }).check();
  if (mode === 'create') await form.getByLabel('New asset name', { exact: true }).fill(target);
  else await form.getByLabel('Target asset').selectOption(target);
  for (const key of inputs) await form.getByLabel(new RegExp(`^${key} ·`)).check();
  await form.getByLabel('Requirement').fill(text);
  await form.getByRole('button', { name: 'Review proposal', exact: true }).click();
  await form.getByRole('button', { name: 'Sign and submit proposal' }).click();
  await expect(form).toHaveCount(0);
}
async function sponsor(branch, proposalNumber, account = 0) {
  await page.evaluate(n => window.relayTestWallet.select(n), account);
  const before = Number(await read(branch, 'attemptCount'));
  const id = `${branch}:${proposalNumber}`;
  const row = page.locator('#proposals > ul > li').filter({ hasText: id });
  await row.getByRole('button', { name: 'Review funding', exact: true }).click();
  await funding().getByRole('button', { name: '1. Approve exact amount', exact: true }).click();
  await expect(funding().getByRole('button', { name: '1. Approval confirmed', exact: true })).toBeVisible();
  await funding().getByRole('button', { name: '2. Purchase execution', exact: true }).click();
  await expect.poll(() => read(branch, 'attemptCount').then(Number)).toBe(before + 1);
  const number = await read(branch, 'activeAttempt');
  const attempt = await read(branch, 'attempt', [number]);
  assert.equal(attempt.sponsor.toLowerCase(), local.accounts[account].toLowerCase());
  return { number, attempt };
}
const sha = b => createHash('sha256').update(b).digest('hex');
async function deliver(branch, { text, bytes, project = 'local-project-main', job, malicious = false } = {}) {
  const a = await read(branch, 'attempt', [await read(branch, 'activeAttempt')]);
  const p = await read(branch, 'proposal', [a.proposalId]);
  const kind = Number(p.profile) < 2 ? 0 : Number(p.profile) < 4 ? 1 : 2;
  const file = bytes ?? new TextEncoder().encode(text ?? (kind === 0 ? `# Local file\n${job}\n` : `<!doctype html><html><body><h1>${job}</h1></body></html>`));
  const manifest = { jobId: job, projectId: project, state: 'completed', files: [{ name: p.outputName, path: p.outputPath, mediaType: ['text/markdown', 'text/html', 'image/png'][kind], bytes: file.length, hash: sha(file), submissionHash: sha(Buffer.from(`submission-${job}`)) }] };
  const raw = new TextEncoder().encode(JSON.stringify(manifest));
  const path = resolve(local.artifacts, `${job}/${p.outputPath}`);
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, file);
  const rawPath = resolve(local.artifacts, `${job}/result.json`); await writeFile(rawPath, raw);
  await tx('mock writer result ' + job, local.release.intake, local.intakeI.encodeFunctionData('complete', [a.requestId, raw]));
  assert.equal(Number(await read(branch, 'phase')), 3);
  await refresh();
  return { raw, rawPath, path, file, manifest, malicious };
}
async function bind(branch, result) {
  const form = page.locator('#progress form').filter({ has: page.getByText('Original callback-authenticated result.json (up to 32768 bytes)', { exact: true }) });
  await expect(form).toBeVisible();
  await form.getByLabel('Original callback-authenticated result.json (up to 32768 bytes)').setInputFiles(result.rawPath);
  await form.getByRole('button', { name: 'Bind original result without purchase' }).click();
  await expect.poll(() => read(branch, 'phase').then(Number)).toBe(0);
  await refresh();
  const revision = Number(await read(branch, 'revision'));
  await selectRound(revision);
  await expect(page.getByRole('heading', { name: `Round ${revision} output`, exact: true })).toBeVisible();
}
async function filePreview(name) {
  const tab = page.locator(`.asset-tabs button[data-asset-key="${name}"]`);
  if (await tab.count()) await tab.click();
  const row = page.locator('#assets');
  await expect(row.getByText('Verified locally · SHA-256, length, media', {exact:true})).toBeVisible();
  await disclose(/^File verification details|^Complete asset table/);
  return row;
}

try {
  for (let n = 0; ; n++) { try { const res = await fetch('http://127.0.0.1:4174/'); if (res.ok) break; } catch {} if (n > 100) throw new Error('Preview failed'); await new Promise(r => setTimeout(r, 50)); }
  browser = await ({ chromium, webkit }[engine]).launch({ executablePath: engine === 'chromium' ? process.env.W1_CHROMIUM_EXECUTABLE : process.env.W1_WEBKIT_EXECUTABLE, headless: true });
  const mobile = process.argv.includes('--mobile');
  evidence.viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport: evidence.viewport, isMobile: mobile, hasTouch: mobile });
  await initWallet(context); page = await context.newPage(); page.setDefaultTimeout(30000);
  const captures = [];
  page.on('response', response => {
    if (response.url() !== local.config.rpcURL + '/' && response.url() !== local.config.rpcURL) return;
    let request; try { request = response.request().postDataJSON(); } catch { return; }
    if (request?.method !== 'eth_sendTransaction') return;
    captures.push((async () => { const body = await response.json(); if (body.result) evidence.walletTransactions.push({ hash: body.result, ...request.params[0] }); })());
  });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const row={text:m.text(),location:m.location(),case:currentCase};
    if (expectedHTTPFailures.has(m.location().url) && /server responded with a status of 503/.test(m.text())) evidence.expectedResourceDiagnostics.push(row);
    else evidence.consoleErrors.push(row);
  });
  page.on('pageerror', e => {
    evidence.browserErrors.push(e.stack);
    evidence.browserDiagnostics.push({ event: 'pageerror', at: new Date().toISOString(), case: currentCase, url: page.url(), message: e.stack });
  });
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) evidence.browserDiagnostics.push({ event: 'navigation', at: new Date().toISOString(), case: currentCase, url: frame.url() }); });
  page.on('requestfailed', request => evidence.browserDiagnostics.push({ event: 'requestfailed', at: new Date().toISOString(), case: currentCase, url: request.url(), failure: request.failure()?.errorText }));
  page.on('request', r => { if (/^https?:/.test(r.url()) && !['127.0.0.1', 'localhost'].includes(new URL(r.url()).hostname)) evidence.unexpectedRequests.push(r.url()); });
  await record('Public config closed; local reads without wallet; EIP-6963 selected provider', async () => {
    await page.goto('http://127.0.0.1:4174/#/');
    await expect(page.getByRole('button', { name: 'Create project', exact: true })).toBeDisabled();
    await page.getByRole('link', { name: 'Open local contracts', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create project', exact: true })).toBeVisible();
    await expect(page.getByText('No projects yet.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await page.getByRole('button', { name: 'Relay Local Test Wallet', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible();
    assert.equal(await countPurchases(), 0);
  });
  let markdown, web;
  await record('Create / propose / explicit sponsor / bind / read Markdown, alternate funder update', async () => {
    markdown = await createProject('Local Markdown project');
    assert.equal(await countPurchases(), 0);
    await propose(); assert.equal(await countPurchases(), 0);
    await sponsor(markdown, 1, 1);
    const first = await deliver(markdown, { job: 'markdown-create' }); await bind(markdown, first);
    await expect((await filePreview('main')).locator('.md').getByText('markdown-create', { exact: true })).toBeVisible();
    await propose({ mode: 'update', target: 'main', inputs: ['main'], text: 'Update local notes' });
    await sponsor(markdown, 2, 0);
    const second = await deliver(markdown, { job: 'markdown-update' }); await bind(markdown, second);
    assert.equal(await read(markdown, 'latestJobId'), 'markdown-update');
    await expect((await filePreview('main')).locator('.md').getByText('markdown-update', { exact: true })).toBeVisible();
    await capture('actual-markdown.jpg');
  });
  await record('HTML R1 -> PNG R2 -> HTML R3 continues R2, selected exact bytes and retained provenance', async () => {
    web = await createProject('Local website project');
    await propose({ kind: 'html', target: 'site', text: 'R1 initial page' }); await sponsor(web, 1, 0);
    const r1 = await deliver(web, { job: 'html-r1', project: 'local-project-web', text: '<!doctype html><html><body><h1>HTML-R1-EXACT</h1></body></html>' }); await bind(web, r1);
    const firstHistory = await local.provider.request({ method: 'eth_getLogs', params: [{ address: web, fromBlock: '0x0', toBlock: 'latest', topics: [sdk.interfaces.branch.getEvent('CheckpointWritten').topicHash] }] });
    const r1Witness = sdk.decodeCheckpoint(firstHistory.at(-1));
    await propose({ kind: 'image', target: 'cover', text: 'R2 PNG' }); await sponsor(web, 2, 1);
    const png = new Uint8Array(await readFile(resolve(root, 'test/fixtures/image-2.png')));
    const r2 = await deliver(web, { job: 'png-r2', project: 'local-project-web', bytes: png }); await bind(web, r2);
    const r2Logs = await local.provider.request({ method: 'eth_getLogs', params: [{ address: web, fromBlock: '0x0', toBlock: 'latest', topics: [sdk.interfaces.branch.getEvent('CheckpointWritten').topicHash] }] });
    const r2Witness = sdk.decodeCheckpoint(r2Logs.at(-1));
    assert.deepEqual(r2Witness.witness.find(a => a.name === 'site'), r1Witness.witness[0]);
    await propose({ kind: 'html', mode: 'update', target: 'site', inputs: ['site', 'cover'], text: 'R3 retains R1 markers and embeds exact R2 PNG' });
    const currentWitness = r2Witness.witness;
    const preview3 = await sdk.queryPreview(local.provider, sdk.previewProposal(web, 3, currentWitness));
    assert.equal(JSON.parse(new TextDecoder().decode(preview3.raw)).parentJobId, 'png-r2');
    const selectedFiles = JSON.parse(new TextDecoder().decode(preview3.raw)).steps[0].inputs;
    assert.deepEqual(new Set(selectedFiles.map(f => f.hash)), new Set([r1.manifest.files[0].hash, r2.manifest.files[0].hash]));
    await sponsor(web, 3, 0);
    const r3 = await deliver(web, { job: 'html-r3', project: 'local-project-web', text: `<!doctype html><html><body><h1>HTML-R1-EXACT</h1><p>HTML-R3-CONTINUES-PNG-R2</p><img src="data:image/png;base64,${Buffer.from(png).toString('base64')}" /></body></html>` });
    await bind(web, r3);
    sdk.verifyHTMLExport({ ...r3.manifest.files[0], hash: r3.manifest.files[0].hash }, r3.file, [{ descriptor: { ...r2.manifest.files[0] }, bytes: png }]);
    const finalLogs = await local.provider.request({ method: 'eth_getLogs', params: [{ address: web, fromBlock: '0x0', toBlock: 'latest', topics: [sdk.interfaces.branch.getEvent('CheckpointWritten').topicHash] }] });
    const r3Witness = sdk.decodeCheckpoint(finalLogs.at(-1));
    assert.deepEqual(r3Witness.witness.find(a => a.name === 'cover'), r2Witness.witness.find(a => a.name === 'cover'));
    const pngRow = await filePreview('cover'); await expect(pngRow.locator('img')).toBeVisible();
    const row = await filePreview('site');
    const frame = row.locator('iframe'); await expect(frame).toHaveAttribute('sandbox', '');
    await expect(frame.contentFrame().getByText('HTML-R3-CONTINUES-PNG-R2')).toBeVisible();
    await expect(frame.contentFrame().getByRole('heading', { name: 'HTML-R1-EXACT' })).toBeVisible();
    assert.equal(await frame.contentFrame().locator('img').getAttribute('src'), `data:image/png;base64,${Buffer.from(png).toString('base64')}`);
    await capture('actual-web.jpg');
    evidence.web = { branch: web, r1: r1Witness, r2: r2Witness, r3: r3Witness, r3RequestBody: new TextDecoder().decode(preview3.raw), pngSHA256: sha(png) };
  });
  await record('Fork non-head accepted R1 exactly; child opens then continues with separate sponsorship', async () => {
    const before = await countPurchases();
    await selectRound(1);
    await page.getByRole('button', { name: 'Historical Fork', exact: true }).click();
    const historic = page.getByRole('dialog', { name: 'Historical Fork' });
    await historic.getByLabel('Fork direction (fixed after creation)').fill('Develop independently from historical HTML R1');
    await historic.getByRole('button', { name: 'Review fork' }).click();
    await historic.getByRole('button', { name: 'Sign and fork' }).click();
    await historic.getByRole('link', { name: 'Open fork' }).click();
    await disclose(/^Branch, network/);
    await expect(page.getByText('None / None', {exact:true})).toBeVisible();
    const child = page.url().split('/').at(-1);
    assert.equal(await countPurchases(), before);
    assert.equal(await read(child, 'projectId'), '');
    assert.equal(Number(await read(child, 'proposalCount')), 0);
    await expect(page.getByRole('button', { name: 'Historical Fork', exact: true })).toHaveCount(0);
    const childEvents = await local.provider.request({ method: 'eth_getLogs', params: [{ address: child, fromBlock: '0x0', toBlock: 'latest', topics: [sdk.interfaces.branch.getEvent('CheckpointWritten').topicHash] }] });
    assert.deepEqual(sdk.decodeCheckpoint(childEvents[0]).witness, evidence.web.r1.witness);
    const row = await filePreview('site'); await expect(row.locator('iframe').contentFrame().getByText('HTML-R1-EXACT')).toBeVisible();
    await propose({ target: 'child-notes', text: 'Child first independent execution' });
    await sponsor(child, 1, 1);
    let a = await read(child, 'attempt', [1]);
    let request = local.intakeI.decodeFunctionResult('request', await local.provider.request({ method: 'eth_call', params: [{ to: local.release.intake, data: local.intakeI.encodeFunctionData('request', [a.requestId]) }, 'latest'] }))[0];
    assert.equal(request.action, local.release.actions.open);
    await bind(child, await deliver(child, { job: 'child-open', project: 'local-project-child' }));
    await propose({ mode: 'update', target: 'child-notes', inputs: ['child-notes'], text: 'Continue child work' }); await sponsor(child, 2, 0);
    a = await read(child, 'attempt', [2]);
    request = local.intakeI.decodeFunctionResult('request', await local.provider.request({ method: 'eth_call', params: [{ to: local.release.intake, data: local.intakeI.encodeFunctionData('request', [a.requestId]) }, 'latest'] }))[0];
    assert.equal(request.action, local.release.actions.continue);
    assert.match(new TextDecoder().decode(sdk.getBytes ? sdk.getBytes(request.body) : Buffer.from(request.body.slice(2), 'hex')), /child-open/);
    await bind(child, await deliver(child, { job: 'child-continue', project: 'local-project-child' }));
    assert.equal(await read(child, 'latestJobId'), 'child-continue');
    evidence.child = child;
  });
  let recoveryBranch;
  await record('Multiple current proposals, explicit older selection, missing callback, reload with corrupt/missing journal', async () => {
    recoveryBranch = await createProject('Recovery and refusal tests');
    await propose({ target: 'first', text: 'Earlier proposal remains eligible' });
    const anchor = await read(recoveryBranch, 'anchor');
    await propose({ target: 'second', text: 'Later proposal preserves anchor' });
    assert.equal(await read(recoveryBranch, 'anchor'), anchor);
    await expect(page.locator('#proposals .tag-accent')).toHaveCount(2);
    await sponsor(recoveryBranch, 1, 0);
    const spent = await countPurchases();
    await expect(page.locator('#progress .stage').filter({ hasText: 'Callback' })).toContainText('Pending');
    for (const value of [null, '{broken json']) {
      await page.evaluate(value => { localStorage.clear(); if (value) { localStorage.setItem('relay.local.transactions.v1', value); localStorage.setItem('w1.recovery.v1', value); } }, value);
      await page.reload();
      await expect(page.locator('#progress .stage').filter({ hasText: 'Callback' })).toContainText('Pending');
      await expect(page.getByText('Wait for the original transaction or callback', { exact: false })).toBeVisible();
      assert.equal(await countPurchases(), spent);
    }
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
    await page.getByRole('button', { name: 'Relay Local Test Wallet', exact: true }).click();
    evidence.recoveryBranch = recoveryBranch;
  });
  await record('Authenticated status1 explicit identical-body paid retry; corrected raw binding without repurchase; stale anchors', async () => {
    const original = await read(recoveryBranch, 'attempt', [1]);
    await tx('mock status1 refusal', local.release.intake, local.intakeI.encodeFunctionData('fail', [original.requestId, 1, `0x${Buffer.from('admission_refused').toString('hex').padEnd(64, '0')}`]));
    await refresh();
    await page.evaluate(() => window.relayTestWallet.select(1));
    await page.getByRole('button', { name: 'Review identical paid retry', exact: true }).click();
    const panel = funding();
    await panel.getByRole('button', { name: '1. Approve exact amount', exact: true }).click();
    await panel.getByRole('button', { name: '2. Purchase identical retry', exact: true }).click();
    await expect.poll(() => read(recoveryBranch, 'attemptCount').then(Number)).toBe(2);
    const retried = await read(recoveryBranch, 'attempt', [2]);
    assert.equal(retried.bodyHash, original.bodyHash); assert.notEqual(retried.requestId, original.requestId);
    assert.equal(retried.sponsor.toLowerCase(), local.accounts[1].toLowerCase());
    const result = await deliver(recoveryBranch, { job: 'refused-retried', project: 'local-project-recovery' });
    const spent = await countPurchases();
    const form = page.locator('#progress form').filter({ has: page.getByText('Original callback-authenticated result.json (up to 32768 bytes)', { exact: true }) });
    await form.locator('input[type=file]').setInputFiles({ name: 'wrong-result.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await form.getByRole('button', { name: 'Bind original result without purchase' }).click();
    await expect(page.getByText('Raw manifest digest mismatch', { exact: false })).toBeVisible();
    assert.equal(Number(await read(recoveryBranch, 'phase')), 3); assert.equal(await countPurchases(), spent);
    await bind(recoveryBranch, result); assert.equal(await countPurchases(), spent);
    await expect(page.locator('#proposals > ul > li').filter({ hasText: 'Later proposal preserves anchor' })).toContainText('Stale anchor');
  });
  await record('Exact allowance and fresh price/maxFee checks; double-click and signature rejection', async () => {
    const feeBranch = await createProject('Fee and signature tests');
    await propose({ target: 'fee', text: 'Exact price test' });
    const row = page.locator('#proposals > ul > li').filter({ hasText: 'Exact price test' });
    await row.getByRole('button', { name: 'Review funding', exact: true }).click();
    await page.evaluate(() => window.relayTestWallet.reject());
    const beforeReject = await page.evaluate(() => window.relayTestWallet.transactions.length);
    await funding().getByRole('button', { name: '1. Approve exact amount', exact: true }).click();
    await expect(funding().locator('[role=alert]')).toContainText('User rejected');
    assert.equal(await page.evaluate(() => window.relayTestWallet.transactions.length), beforeReject);
    await funding().getByRole('button', { name: '1. Approve exact amount', exact: true }).dblclick();
    await expect(funding().getByRole('button', { name: '1. Approval confirmed' })).toBeVisible();
    assert.equal(await page.evaluate(() => window.relayTestWallet.transactions.length), beforeReject + 1);
    const spent = await countPurchases();
    await tx('mock price drop', local.release.intake, local.intakeI.encodeFunctionData('setPrice', [local.release.actions.open, 400000000000000000n]), local.accounts[0]);
    await funding().getByRole('button', { name: '2. Purchase execution', exact: true }).click();
    await expect(funding().locator('[role=alert]')).toContainText('Approve the exact current price again');
    assert.equal(await countPurchases(), spent);
    await funding().getByRole('button', { name: '1. Approve exact amount', exact: true }).click();
    await expect(funding().getByRole('button', { name: '1. Approval confirmed' })).toBeVisible();
    await tx('mock price above maxFee', local.release.intake, local.intakeI.encodeFunctionData('setPrice', [local.release.actions.open, 700000000000000000n]), local.accounts[0]);
    await funding().getByRole('button', { name: '2. Purchase execution', exact: true }).click();
    await expect(funding().locator('[role=alert]')).toContainText('exceeds your maximum fee');
    assert.equal(await countPurchases(), spent);
    await tx('restore mock price', local.release.intake, local.intakeI.encodeFunctionData('setPrice', [local.release.actions.open, 500000000000000000n]), local.accounts[0]);
    await page.getByRole('button', { name: 'Close preparation', exact: true }).click();
    await propose({ target: 'Legacy_Name_' + 'A'.repeat(52), text: 'CLI compatible 64 byte name' });
    assert.equal(Number(await read(feeBranch, 'proposalCount')), 2);
    assert.equal(await countPurchases(), spent);
    evidence.feeBranch = feeBranch;
  });
  await record('Account/network changes invalidate prepared signing; no purchase', async () => {
    const spent = await countPurchases();
    await page.evaluate(() => window.relayTestWallet.select(1));
    const row = page.locator('#proposals > ul > li').filter({ hasText: 'Exact price test' });
    await row.getByRole('button', { name: 'Review funding', exact: true }).click();
    await expect(funding()).toBeVisible();
    await page.evaluate(() => window.relayTestWallet.select(0));
    await expect(page.getByText('Account or network changed', { exact: false })).toBeVisible();
    await row.getByRole('button', { name: 'Review funding', exact: true }).click();
    await page.evaluate(() => window.relayTestWallet.network('0x1'));
    await expect(row.getByRole('button', { name: 'Review funding', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Switch to /  })).toBeVisible();
    assert.equal(await countPurchases(), spent);
    await page.getByRole('button', { name: /^Switch to /  }).click();
  });
  await record('Purchase signature rejection and double-click send exactly one explicit paid attempt', async () => {
    const branch = await createProject('Purchase rejection and double click');
    await propose({ target: 'single', text: 'Only one explicit purchase' });
    const row = page.locator('#proposals > ul > li').filter({ hasText: 'Only one explicit purchase' });
    await row.getByRole('button', { name: 'Review funding', exact: true }).click();
    const panel = funding().getByLabel('Review funding');
    await expect(panel.locator('textarea')).toHaveCount(0);
    await expect(panel.locator('input')).toHaveCount(1); // Only maxFee is editable by a sponsor.
    await funding().getByRole('button', { name: '1. Approve exact amount', exact: true }).click();
    await expect(funding().getByRole('button', { name: '1. Approval confirmed' })).toBeVisible();
    const before = await countPurchases();
    await page.evaluate(() => window.relayTestWallet.reject());
    await funding().getByRole('button', { name: '2. Purchase execution', exact: true }).click();
    await expect(funding().locator('[role=alert]')).toContainText('User rejected');
    assert.equal(await countPurchases(), before);
    assert.equal(Number(await read(branch, 'attemptCount')), 0);
    await funding().getByRole('button', { name: '2. Purchase execution', exact: true }).dblclick();
    await expect.poll(() => read(branch, 'attemptCount').then(Number)).toBe(1);
    assert.equal(await countPurchases(), before + 1);
    const allowance = (await sdk.queryState(local.provider, sdk.readAllowance(local.release.imd, local.accounts[0], branch)))[0];
    assert.equal(allowance, 0n, 'purchase consumes the exact Branch allowance');
    await page.reload(); await expect(page.locator('#progress')).toContainText('missing callback remains pending');
    assert.equal(await countPurchases(), before + 1);
  });
  await record('Authenticated status2 and unknown failure freeze permanently', async () => {
    for (const status of [2, 7, 0]) {
      const branch = await createProject(`Frozen status ${status}`);
      await propose({ target: 'frozen', text: 'Freeze test' }); await sponsor(branch, 1, status === 2 ? 0 : 1);
      const a = await read(branch, 'attempt', [1]);
      await tx(`mock failure status ${status}`, local.release.intake, local.intakeI.encodeFunctionData('fail', [a.requestId, status, `0x${'11'.repeat(32)}`]));
      await refresh();
      await expect(page.getByText('Purchases frozen', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Review identical paid retry', exact: true })).toHaveCount(0);
      await expect(page.locator('#progress .stage').filter({ hasText: 'Callback' })).toContainText('Frozen');
      await expect(page.locator('#progress input[type=file]')).toHaveCount(0);
      assert.equal(Number(await read(branch, 'phase')), 5);
    }
  });
  await record('Pending original hash/nonce saved before wait; missing/corrupt journal uses pending nonce; replaced transaction reconciles without rebuy', async () => {
    const pendingBranch = await createProject('Transaction replacement test');
    await propose({ target: 'pending', text: 'Replacement transaction proposal' });
    const row = page.locator('#proposals > ul > li').filter({ hasText: 'Replacement transaction proposal' });
    await row.getByRole('button', { name: 'Review funding', exact: true }).click();
    await funding().getByRole('button', { name: '1. Approve exact amount', exact: true }).click();
    await expect(funding().getByRole('button', { name: '1. Approval confirmed' })).toBeVisible();
    await local.provider.request({ method: 'evm_setAutomine', params: [false] });
    const before = await countPurchases();
    await funding().getByRole('button', { name: '2. Purchase execution', exact: true }).click();
    await expect.poll(() => page.evaluate(branch => {
      const rows = JSON.parse(localStorage.getItem('relay.local.transactions.v1') ?? '[]'); return rows.findLast(r => r.operation === 'sponsor' && r.state === 'SUBMITTED' && r.branch.toLowerCase() === branch.toLowerCase());
    }, pendingBranch)).toBeTruthy();
    const original = await page.evaluate(branch => JSON.parse(localStorage.getItem('relay.local.transactions.v1')).findLast(r => r.operation === 'sponsor' && r.state === 'SUBMITTED' && r.branch.toLowerCase() === branch.toLowerCase()), pendingBranch);
    assert.match(original.hash, /^0x[0-9a-f]{64}$/i); assert.equal(original.chainId, 31337); assert.equal(original.branch.toLowerCase(), pendingBranch.toLowerCase()); assert.equal(typeof original.nonce, 'number');
    const receipt = await local.provider.request({ method: 'eth_getTransactionReceipt', params: [original.hash] }); assert.equal(receipt, null);
    await page.reload();
    await expect(page.locator('#progress')).toContainText('Unknown');
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('relay.local.transactions.v1', '{corrupt'); });
    await page.reload();
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await page.getByRole('button', { name: 'Relay Local Test Wallet', exact: true }).click();
    await page.evaluate(n => window.relayTestWallet.select(n), local.accounts.findIndex(a => a.toLowerCase() === original.account.toLowerCase()));
    await expect(page.locator('#progress')).toContainText('Pending account transaction', { timeout: 10000 });
    await expect(row.getByRole('button', { name: 'Review funding', exact: true })).toBeDisabled();
    assert.equal(await countPurchases(), before);
    // Replace the pending purchase with an explicit zero-value self-transaction from the same
    // disposable account/nonce. This is a test control, never an app-generated purchase.
    await local.provider.request({ method: 'anvil_dropTransaction', params: [original.hash] });
    await page.evaluate(original => localStorage.setItem('relay.local.transactions.v1', JSON.stringify([original])), original);
    await page.reload(); await expect(page.locator('#progress')).toContainText('DROPPED_OR_UNKNOWN');
    assert.equal(await countPurchases(), before);
    const replacementHash = await local.provider.request({ method: 'eth_sendTransaction', params: [{ from: original.account, to: original.account, value: '0x0', nonce: `0x${original.nonce.toString(16)}`, gas: '0x5208' }] });
    await local.provider.request({ method: 'evm_setAutomine', params: [true] }); await local.provider.request({ method: 'evm_mine', params: [] });
    // Restore the original evidence hint to demonstrate replacement lookup by original nonce.
    await page.evaluate(original => localStorage.setItem('relay.local.transactions.v1', JSON.stringify([original])), original);
    await page.reload(); await expect(page.locator('#progress')).toContainText('REPLACED_OTHER');
    assert.equal(await countPurchases(), before); assert.equal(Number(await read(pendingBranch, 'phase')), 0);
    evidence.replacement = { original, replacementHash, purchasesUnchanged: before };
    await page.evaluate(() => localStorage.removeItem('relay.local.transactions.v1'));
  });
  await record('Same-call replacement recovers authenticated attempt; status1 retry uses chain truth despite original journal', async () => {
    const branch = await createProject('Same call replacement test');
    await propose({ target: 'same-call', text: 'Same call transaction replacement' });
    const row = page.locator('#proposals > ul > li').filter({ hasText: 'Same call transaction replacement' });
    await row.getByRole('button', { name: 'Review funding', exact: true }).click();
    await funding().getByRole('button', { name: '1. Approve exact amount', exact: true }).click();
    await expect(funding().getByRole('button', { name: '1. Approval confirmed' })).toBeVisible();
    await local.provider.request({ method: 'evm_setAutomine', params: [false] });
    const spent = await countPurchases();
    await funding().getByRole('button', { name: '2. Purchase execution', exact: true }).click();
    await expect.poll(() => page.evaluate(branch => JSON.parse(localStorage.getItem('relay.local.transactions.v1') ?? '[]').findLast(r => r.operation === 'sponsor' && r.branch.toLowerCase() === branch.toLowerCase() && r.state === 'SUBMITTED'), branch)).toBeTruthy();
    const original = await page.evaluate(branch => JSON.parse(localStorage.getItem('relay.local.transactions.v1')).findLast(r => r.operation === 'sponsor' && r.branch.toLowerCase() === branch.toLowerCase()), branch);
    await local.provider.request({ method: 'anvil_dropTransaction', params: [original.hash] });
    const replacement = await local.provider.request({ method: 'eth_sendTransaction', params: [{ from: original.account, to: original.to, data: original.data, value: '0x0', nonce: `0x${original.nonce.toString(16)}`, gas: '0x'+(16777216).toString(16) }] });
    await local.provider.request({ method: 'evm_setAutomine', params: [true] }); await local.provider.request({ method: 'evm_mine', params: [] });
    assert.equal(await countPurchases(), spent + 1);
    const first = await read(branch, 'attempt', [1]);
    // Reload abandons the old receipt waiter but preserves its original hash/nonce journal.
    await page.reload();
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await page.getByRole('button', { name: 'Relay Local Test Wallet', exact: true }).click();
    await tx('mock status1 after same-call replacement', local.release.intake, local.intakeI.encodeFunctionData('fail', [first.requestId, 1, `0x${'11'.repeat(32)}`]));
    await refresh();
    await page.getByRole('button', { name: 'Review identical paid retry', exact: true }).click();
    const panel = funding();
    await panel.getByRole('button', { name: '1. Approve exact amount', exact: true }).click();
    await expect(panel.getByRole('button', { name: '1. Approval confirmed' })).toBeVisible();
    await panel.getByRole('button', { name: '2. Purchase identical retry', exact: true }).click();
    await expect.poll(() => read(branch, 'attemptCount').then(Number)).toBe(2);
    const retried = await read(branch, 'attempt', [2]); assert.equal(retried.bodyHash, first.bodyHash);
    assert.equal(await countPurchases(), spent + 2);
    evidence.sameCallReplacement = { original, replacement, firstBodyHash: first.bodyHash, retriedBodyHash: retried.bodyHash };
  });
  await record('Actual local file tampering/unavailability/stream bound; malicious preview and mobile keyboard/focus', async () => {
    let artifactJob = 'html-r3';
    // The independent files shard seeds its own accepted HTML through the same actual UI.
    // The complete three-round retention sequence remains together in the flow shard.
    if (!web) {
      web = await createProject('Local file verification project');
      await propose({ kind: 'html', target: 'site', text: 'Actual onchain file descriptor' });
      await sponsor(web, 1, 0);
      artifactJob = 'files-target';
      await bind(web, await deliver(web, { job: artifactJob, project: 'local-files-project' }));
    }
    await page.goto(`http://127.0.0.1:4174/#/local/b/${web}`);
    const assetPath = resolve(local.artifacts, `${artifactJob}/artifacts/index.html`);
    const original = await readFile(assetPath);
    for (const content of [Buffer.from('tampered'), Buffer.alloc(2097153, 120)]) {
      await writeFile(assetPath, content); await page.reload();
      const row = page.locator('#assets');
      await disclose(/^File verification details/);
      await expect(row.getByText('File unavailable:', { exact: false })).toBeVisible();
      await expect(row.getByText('Verified locally · SHA-256, length, media')).toHaveCount(0);
    }
    await writeFile(assetPath, original);
    expectedHTTPFailures.add(`${local.config.artifactBase}${artifactJob}/artifacts/index.html`);
    await page.route(`**/artifacts/${artifactJob}/artifacts/index.html`, r => r.fulfill({ status: 503, body: 'unavailable' }));
    await page.reload();
    await disclose(/^File verification details/);
    await expect(page.getByText('File unavailable:', { exact: false })).toBeVisible();
    await page.unroute(`**/artifacts/${artifactJob}/artifacts/index.html`);
    expectedHTTPFailures.clear();
    const evil = await createProject('Preview isolation test');
    await propose({ kind: 'html', target: 'evil', text: 'Hostile HTML fixture' }); await sponsor(evil, 1, 0);
    const html = '<!doctype html><html><body><h1>SAFE-MARKER</h1><script>top.localStorage.setItem("pwned","1");parent.ethereum.request({method:"eth_sendTransaction"});</script><img src="https://evil.invalid/pixel"><a href="https://evil.invalid" target="_top">bad</a><form action="https://evil.invalid"><button>submit</button></form><iframe src="https://evil.invalid"></iframe></body></html>';
    await bind(evil, await deliver(evil, { job: 'malicious-preview', project: 'local-project-preview', text: html }));
    const row = await filePreview('evil');
    await expect(row.locator('iframe')).toHaveAttribute('sandbox', '');
    await expect(row.locator('iframe').contentFrame().getByText('SAFE-MARKER')).toBeVisible();
    await expect(row.locator('iframe').contentFrame().locator('script,form,iframe,[href],[src^="http"]')).toHaveCount(0);
    assert.equal(await page.evaluate(() => localStorage.getItem('pwned')), null);
    const notes = await createProject('Markdown isolation test');
    await propose({ target: 'notes', text: 'Sanitize Markdown' }); await sponsor(notes, 1, 1);
    const maliciousMarkdown = '# SAFE-MARKDOWN\n<script>localStorage.setItem("pwned","1")</script>\n![remote](https://evil.invalid/pixel)\n<a href="javascript:alert(1)">bad link</a>\n<form><input autofocus></form>';
    await bind(notes, await deliver(notes, { job: 'malicious-markdown', project: 'local-project-markdown-security', text: maliciousMarkdown }));
    const notesRow = await filePreview('notes');
    await expect(notesRow.locator('.md').getByRole('heading', { name: 'SAFE-MARKDOWN' })).toBeVisible();
    await expect(notesRow.locator('.md script,.md img,.md form,.md input,.md [href^="javascript:"]')).toHaveCount(0);
    assert.equal(await page.evaluate(() => localStorage.getItem('pwned')), null);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await capture(`actual-local-${width}.jpg`);
    }
    await page.goto('http://127.0.0.1:4174/#/local'); await page.setViewportSize({ width: 390, height: 844 });
    const create = page.getByRole('button', { name: 'Create project', exact: true }); await expect(create).toBeInViewport();
    await capture('actual-local-home-390.jpg');
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    const connect = page.getByRole('button', { name: 'Connect wallet', exact: true });
    await connect.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('dialog').locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape'); await expect(connect).toBeFocused();
    await page.getByRole('navigation', {name:'Platform'}).getByRole('link', { name: 'Demo', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Relay introduction', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Local Markdown project', exact: true })).toHaveCount(0);
    assert.deepEqual(evidence.browserErrors, []); assert.deepEqual(evidence.unexpectedRequests, []);
  });

  await record('Mixed branch and history reads refetch both automatically; visible read-only Retry recovers without reload or signing', async () => {
    await page.goto(`http://127.0.0.1:4174/#/local/b/${web}`);
    await expect(page.getByRole('heading', {name:'Local website project',exact:true})).toBeVisible();
    await selectRound(1);
    const anchorSelector=sdk.interfaces.branch.getFunction('anchor').selector;
    const goalSelector=sdk.interfaces.branch.getFunction('goal').selector;
    const checkpointSelector=sdk.interfaces.branch.getFunction('checkpoint').selector;
    const previous=evidence.web.r1.digest;
    const current=await read(web,'anchor');
    assert.notEqual(previous,current);
    // getBranch dispatches goal, direction, projectId, latestJobId, anchor, phase synchronously, so
    // its own anchor call carries the goal call's JSON-RPC id + 4. Only that anchor is corrupted:
    // proposal and witness reads also call anchor() and must not decide whether this test passes.
    let mode='once', corrupted=0, anchors=0, branches=0, histories=0;
    const goalIds=new Set();
    const intercept=async route=>{
      const request=route.request().postDataJSON();const call=request?.params?.[0];
      if(request?.method==='eth_call'&&call?.to?.toLowerCase()===web.toLowerCase()) {
        if(call.data===goalSelector) {branches++;goalIds.add(request.id);}
        if(call.data.startsWith(checkpointSelector)) histories++;
        if(call.data===anchorSelector) {
          anchors++;
          const branchRead=goalIds.has(request.id-4);
          if(branchRead&&(mode==='always'||(mode==='once'&&corrupted===0))){corrupted++;return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({jsonrpc:'2.0',id:request.id,result:previous})});}
        }
      }
      return route.continue();
    };
    await page.route(local.config.rpcURL+'/**',intercept);
    const signed=evidence.walletTransactions.length,bought=await countPurchases();
    await refresh();
    // One inconsistent branch/history pair, then the snapshot repeats BOTH reads by itself.
    await expect.poll(()=>({corrupted,pairedReads:branches>=2&&histories>=2})).toEqual({corrupted:1,pairedReads:true});
    await expect(page.getByRole('button',{name:'Continue',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Retry reads',exact:true})).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'Round 1 output',exact:true})).toBeVisible();
    const automatic={corruptedPairs:corrupted,anchors,branches,histories};
    mode='always';
    await refresh();
    const retry=page.getByRole('button',{name:'Retry reads',exact:true});await expect(retry).toBeVisible();
    await expect(page.getByRole('button',{name:'Continue',exact:true})).toHaveCount(0);
    await expect(page.getByText('Read-only. Branch and history disagree',{exact:false})).toBeVisible();
    const before={branches,histories};mode='off';await retry.click();
    await expect(page.getByRole('heading',{name:'Round 1 output',exact:true})).toBeVisible();
    assert.ok(branches>before.branches&&histories>before.histories);
    assert.equal(await read(web,'anchor'),current);assert.equal(evidence.walletTransactions.length,signed);assert.equal(await countPurchases(),bought);
    await page.unroute(local.config.rpcURL+'/**',intercept);
    evidence.mixedReads={automatic,afterRetry:{corruptedPairs:corrupted,anchors,branches,histories},selection:previous,head:current,walletTransactionsUnchanged:signed};
  });
  await record('Delayed preparation cancelled by close, account or network change before the selected wallet is called', async () => {
    const b=await createProject('Cancellation boundaries');await propose({target:'cancel',text:'No delayed wallet calls after cancellation'});
    const row=page.locator('#proposals > ul > li').filter({hasText:'No delayed wallet calls after cancellation'});
    const tokenSelector=local.tokenI.getFunction('approve').selector;
    evidence.cancellations=[];
    for(const reason of ['close','account','network']) {
      await page.evaluate(()=>{window.relayTestWallet.select(0);window.relayTestWallet.network('0x7a69');});
      await expect(row.getByRole('button',{name:'Review funding',exact:true})).toBeEnabled();
      await row.getByRole('button',{name:'Review funding',exact:true}).click();
      await expect(funding().getByRole('button',{name:'1. Approve exact amount'})).toBeEnabled();
      let enter,release;const reached=new Promise(r=>enter=r),gate=new Promise(r=>release=r);let held=false;
      const intercept=async route=>{const req=route.request().postDataJSON();if(!held&&req?.method==='eth_call'&&req.params[0].data.startsWith(tokenSelector)){held=true;enter();await gate;}return route.continue();};
      await page.route(local.config.rpcURL+'/**',intercept);
      const before=evidence.walletTransactions.length;
      await funding().getByRole('button',{name:'1. Approve exact amount'}).click();await reached;
      if(reason==='close')await page.getByRole('button',{name:'Close preparation'}).click();
      if(reason==='account')await page.evaluate(()=>window.relayTestWallet.select(1));
      if(reason==='network')await page.evaluate(()=>window.relayTestWallet.network('0x1'));
      await expect(funding()).toHaveCount(0);release();
      await page.unrouteAll({behavior:'wait'});
      await page.waitForTimeout(50); // Allow the released JSON response and cancellation guard to settle.
      assert.equal(evidence.walletTransactions.length,before);
      evidence.cancellations.push({reason,walletTransactionsBefore:before,walletTransactionsAfter:evidence.walletTransactions.length});
    }
    await page.evaluate(()=>{window.relayTestWallet.select(0);window.relayTestWallet.network('0x7a69');});
    assert.equal(Number(await read(b,'attemptCount')),0);
  });
  await record('Non-square PNG renders naturally and downloads its safe descriptor basename with exact bytes', async () => {
    const b=await createProject('Wide image verification');await propose({kind:'image',target:'wide',text:'A deterministic non-square PNG'});await sponsor(b,1,1);
    const bytes=new Uint8Array(await readFile(resolve(root,'frontend/tests/fixtures/wide.png')));
    const output=await deliver(b,{job:'wide-image',project:'local-wide-image',bytes});await bind(b,output);
    const image=page.locator('.img-box img');await expect(image).toBeVisible();
    const dimensions=await image.evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight}));
    assert.notEqual(dimensions.naturalWidth,dimensions.naturalHeight);assert.equal(dimensions.naturalWidth,48);assert.equal(dimensions.naturalHeight,24);assert.ok(Math.abs(dimensions.width/dimensions.height-2)<0.001);
    const pending=page.waitForEvent('download');await page.getByRole('link',{name:'Download verified file',exact:true}).click();const download=await pending;
    assert.equal(download.suggestedFilename(),output.manifest.files[0].path.split('/').at(-1));const downloaded=new Uint8Array(await readFile(await download.path()));assert.deepEqual(downloaded,bytes);
    evidence.wideImage={...dimensions,path:output.manifest.files[0].path,filename:download.suggestedFilename(),bytes:bytes.length,sha256:sha(downloaded),descriptorSHA256:output.manifest.files[0].hash};
  });

  await Promise.all(captures);
  assert.ok(evidence.walletTransactions.length > (group === 'all' ? 50 : 0), 'retain actual W1 wallet transactions across reloads');
  evidence.branches = { markdown, web };
} catch (e) {
  evidence.error = e.stack;
  if (page) { await capture('actual-failure.jpg').catch(() => {}); await writeFile(resolve(out, 'failure-dom.html'), await page.content()).catch(() => {}); }
  process.exitCode = 1;
} finally {
  // Every app wallet transaction is retained across page reloads by the RPC response observer.
  if (page) evidence.lastWindowTransactions = await page.evaluate(() => window.relayTestWallet.transactions).catch(() => []);
  evidence.transactions = local.trace;
  evidence.receipts = [];
  for (const t of evidence.walletTransactions ?? []) evidence.receipts.push({ hash: t.hash, receipt: await local.provider.request({ method: 'eth_getTransactionReceipt', params: [t.hash] }) });
  evidence.generatedConfig = local.config;
  await cp(local.artifacts, resolve(out, 'files'), { recursive: true });
  for (const name of planned) if (!evidence.matrix.some(r => r.name === name)) evidence.matrix.push({ name, status: 'NOT_RUN' });
  evidence.functionalResult = evidence.matrix.every(r => r.status === 'PASS') && !evidence.error ? 'PASS' : 'FAIL';
  evidence.browserRuntimeStatus = evidence.browserErrors.length || evidence.consoleErrors.length || evidence.unexpectedRequests.length ? 'FAIL' : 'PASS';
  evidence.result = evidence.functionalResult === 'PASS' && evidence.browserRuntimeStatus === 'PASS' ? 'PASS' : 'FAIL';
  if (evidence.result !== 'PASS') process.exitCode = 1;
  await writeFile(resolve(out, 'browser-chain.json'), JSON.stringify(evidence, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
  await browser?.close(); preview.kill(); await local.close();
}
