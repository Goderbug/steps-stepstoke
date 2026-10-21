#!/usr/bin/env node
// Explicit mock-writer control for the local development setup. Never makes an Intake purchase.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Interface } from '../../vendor/ethers/ethers.mjs';
import * as sdk from '../../sdk/browser.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
try {
  const branch = opt('branch');
  if (!branch || !/^0x[0-9a-f]{40}$/i.test(branch)) throw new Error('Usage: --branch ACTUAL_LOCAL_BRANCH --job LOCAL_JOB_ID [--file FILE] [--status 1|2|7]');
  const session = JSON.parse(await readFile(resolve(root, 'test/scratch/local-session.json')));
  const { config, writer } = session;
  const u = new URL(config.rpcURL);
  if (config.kind !== 'LOCAL_DEPLOYMENT' || config.chainId !== 31337 || u.hostname !== '127.0.0.1') throw new Error('Local mock setup only');
  let id = 0;
  const provider = { async request({ method, params = [] }) { const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) }); const b = await r.json(); if (b.error) throw new Error(b.error.message); return b.result; } };
  if (Number(BigInt(await provider.request({ method: 'eth_chainId' }))) !== 31337) throw new Error('Not a local chain');
  const read = async (m, a = []) => (await sdk.queryState(provider, sdk.readState(branch, m, a)))[0];
  if (!(await sdk.queryState(provider, sdk.readFactory(config.contracts.factory, 'registered', [branch])))[0]) throw new Error('Branch not registered');
  if (Number(await read('phase')) !== 2) throw new Error('Branch has no pending request');
  const attempt = await read('attempt', [await read('activeAttempt')]);
  const artifact = JSON.parse(await readFile(resolve(root, 'out/MockIntake.sol/MockIntake.json')));
  const intakeI = new Interface(artifact.abi);
  let data, output;
  if (opt('status')) {
    const status = Number(opt('status')); if (![1, 2, 7].includes(status)) throw new Error('Mock failure status must be 1, 2 or 7');
    data = intakeI.encodeFunctionData('fail', [attempt.requestId, status, `0x${Buffer.from('local_mock').toString('hex').padEnd(64, '0')}`]);
  } else {
    const job = opt('job'); if (!job || !/^[a-zA-Z0-9_-]{1,64}$/.test(job)) throw new Error('Supply a distinct explicit --job LOCAL_JOB_ID (1-64 identifier characters)');
    const p = await read('proposal', [attempt.proposalId]);
    const kind = Number(p.profile) < 2 ? 0 : Number(p.profile) < 4 ? 1 : 2;
    const file = opt('file') ? new Uint8Array(await readFile(resolve(opt('file')))) : kind === 2 ? new Uint8Array(await readFile(resolve(root, 'test/fixtures/image-2.png'))) : new TextEncoder().encode(kind === 0 ? `# ${p.outputName}\n\nLOCAL MOCK RESULT ${job}\n` : `<!doctype html><html lang="zh-CN"><body><h1>LOCAL MOCK RESULT ${job}</h1><p>${p.outputName}</p></body></html>`);
    const hash = bytes => createHash('sha256').update(bytes).digest('hex');
    const project = await read('projectId') || `local-${branch.slice(2).toLowerCase()}`;
    const descriptor = { name: p.outputName, path: p.outputPath, mediaType: ['text/markdown', 'text/html', 'image/png'][kind], bytes: file.length, hash: hash(file), submissionHash: hash(Buffer.from(`LOCAL_MOCK:${attempt.requestId}`)) };
    sdk.verifyFile(descriptor, file);
    const raw = new TextEncoder().encode(JSON.stringify({ jobId: job, projectId: project, state: 'completed', files: [descriptor] }));
    sdk.verifyManifest(raw, sdk.keccak256Bytes(raw));
    const location = resolve(root, `test/scratch/local-artifacts/${job}/${p.outputPath}`);
    await mkdir(dirname(location), { recursive: true }); await writeFile(location, file);
    output = resolve(root, `test/scratch/local-artifacts/${job}/result.json`); await writeFile(output, raw);
    data = intakeI.encodeFunctionData('complete', [attempt.requestId, raw]);
  }
  const hash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: writer, to: config.contracts.intake, data, gas: '0x1e8480' }] });
  let receipt;
  for (let n = 0; n < 200; n++) {
    receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
    if (receipt) break;
    await new Promise(r => setTimeout(r, 25));
  }
  if (!receipt || BigInt(receipt.status) !== 1n) throw new Error(`Mock callback outcome requires reconciliation of original hash (no resubmission): ${hash}`);
  const expectedPhase = opt('status') ? Number(opt('status')) === 1 ? 4 : 5 : 3;
  if (Number(await read('phase')) !== expectedPhase) throw new Error(`Mock callback transaction mined but Branch did not record the expected outcome; inspect ${hash}`);
  console.log(JSON.stringify({ kind: 'EXPLICIT_LOCAL_MOCK_CALLBACK', hash, rawResultFile: output ?? null, next: output ? 'Refresh W1 progress and select this original result.json in the binding form.' : 'Refresh W1 to observe authenticated refusal/freeze.' }, null, 2));
} catch (e) { console.error(e.message); process.exitCode = 1; }
