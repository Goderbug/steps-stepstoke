#!/usr/bin/env node
// A separate, deterministic check of raw browser calldata and local receipts. This is a worker
// audit, not an independent contributor/security review and not live IMD acceptance.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Interface, getBytes, keccak256 } from '../../vendor/ethers/ethers.mjs';
import * as sdk from '../../sdk/index.mjs';
const dir = resolve(process.argv[2] ?? 'docs/validation/integration/acceptance/chromium');
const e = JSON.parse(await readFile(resolve(dir, 'browser-chain.json')));
assert.equal(e.result, 'PASS');
assert.ok(e.matrix.length >= (e.group && e.group !== 'all' ? 2 : 13) && e.matrix.every(r => r.status === 'PASS'));
const intake = new Interface(['event Requested(bytes32 indexed id,address indexed payer,bytes32 indexed action,bytes body,uint256 amount)']);
const report = { classification: 'WORKER_POST_RUN_RAW_RECEIPT_AND_SDK_CALLDATA_AUDIT', engine: e.engine, group: e.group ?? 'all', result: 'PASS', operations: {}, accounts: [], requests: [], droppedOriginals: [], receipts: 0, checks: [] };
const accounts = new Set();
const receipts = new Map(e.receipts.map(r => [r.hash, r.receipt]));
for (const tx of e.walletTransactions) {
  accounts.add(tx.from.toLowerCase());
  assert.equal(BigInt(tx.chainId), 31337n);
  assert.equal(BigInt(tx.value), 0n);
  const receipt = receipts.get(tx.hash);
  let parsed;
  for (const iface of Object.values(sdk.interfaces)) {
    try { parsed = iface.parseTransaction({ data: tx.data }); if (parsed) break; } catch {}
  }
  assert.ok(parsed, 'Every signed browser transaction must decode through the delivered ABI');
  const a = parsed.args;
  let rebuilt;
  if (parsed.name === 'createProject') rebuilt = sdk.createProject(tx.to, a[0]);
  else if (parsed.name === 'approve') rebuilt = sdk.approveExact(tx.to, a[0], a[1]);
  else if (parsed.name === 'propose') {
    const p = a[0].toObject(); p.profile = Number(p.profile);
    rebuilt = sdk.proposeWork(tx.to, p, a[1]);
  } else if (parsed.name === 'sponsor') { assert.ok(a[0] > 0n); rebuilt = sdk.sponsorProposal(tx.to, ...a); }
  else if (parsed.name === 'retry') rebuilt = sdk.retryRefused(tx.to, ...a);
  else if (parsed.name === 'fork') { assert.equal(a[1], 1n, 'Test forks R1 while parent head is R3'); rebuilt = sdk.forkHistory(tx.to, ...a); }
  else if (parsed.name === 'bind') rebuilt = sdk.bindResult(tx.to, getBytes(a[0]), keccak256(a[0]), a[1]);
  else throw new Error(`Unexpected signed operation ${parsed.name}`);
  assert.equal(rebuilt.data.toLowerCase(), tx.data.toLowerCase(), 'Browser calldata equals fresh Node SDK encoding');
  report.operations[parsed.name] = (report.operations[parsed.name] ?? 0) + 1;
  if (!receipt) { report.droppedOriginals.push(tx.hash); continue; }
  assert.equal(BigInt(receipt.status), 1n);
  assert.equal(receipt.transactionHash, tx.hash);
  assert.equal(receipt.from.toLowerCase(), tx.from.toLowerCase());
  report.receipts++;
  const requests = receipt.logs.filter(l => l.address.toLowerCase() === e.generatedConfig.contracts.intake.toLowerCase()).flatMap(l => { try { const p = intake.parseLog(l); return p?.name === 'Requested' ? [p] : []; } catch { return []; } });
  assert.equal(requests.length, ['sponsor', 'retry'].includes(parsed.name) ? 1 : 0, 'Only an explicit purchase emits an Intake request');
  for (const r of requests) {
    assert.equal(r.args.payer.toLowerCase(), tx.to.toLowerCase(), 'The Branch is the Intake payer');
    const body = JSON.parse(new TextDecoder().decode(getBytes(r.args.body)));
    assert.ok(getBytes(r.args.body).length <= sdk.LIMITS.body);
    report.requests.push({ transactionHash: tx.hash, payer: r.args.payer, action: r.args.action, amount: r.args.amount.toString(), bodyHash: keccak256(r.args.body), body });
  }
}
assert.ok(accounts.size >= 1 && accounts.size <= 2, 'Only temporary browser signers');
if (!e.group || ['all', 'flow'].includes(e.group)) assert.equal(accounts.size, 2, 'The complete six-function flow uses two temporary browser signers');
report.accounts = [...accounts];
for (const method of ['createProject', 'propose', 'approve', 'sponsor']) assert.ok(report.operations[method] > 0);
if (!e.group || e.group === 'all') for (const method of ['retry', 'bind', 'fork']) assert.ok(report.operations[method] > 0);
assert.deepEqual(new Set(report.droppedOriginals), new Set([e.replacement?.original.hash, e.sameCallReplacement?.original.hash].filter(Boolean)));
report.checks = ['Every browser calldata equals Node SDK re-encoding', 'Temporary accounts, local chain, zero native value', 'Successful original receipts; explicitly dropped originals retained', 'No request on create/propose/fork/bind/approve', 'Nonzero selected proposals'];
if (e.web) {
  const r3 = report.requests.find(r => r.payer.toLowerCase() === e.web.branch.toLowerCase() && r.body.parentJobId === 'png-r2');
  assert.ok(r3, 'Actual purchased R3 uses R2 as the execution parent');
  assert.deepEqual(new Set(r3.body.steps[0].inputs.map(i => i.hash)), new Set([e.web.r1.witness.find(a => a.name === 'site').fileHash.slice(2), e.web.r2.witness.find(a => a.name === 'cover').fileHash.slice(2)]));
  assert.deepEqual(e.web.r3.witness.find(a => a.name === 'cover'), e.web.r2.witness.find(a => a.name === 'cover'));
  report.checks.push('Actual R3 request continues R2 with R1 HTML/R2 PNG hashes', 'Untouched PNG provenance retained');
}
await writeFile(resolve(dir, 'trace-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ result: report.result, engine: report.engine, operations: report.operations, receipts: report.receipts, dropped: report.droppedOriginals.length }));
