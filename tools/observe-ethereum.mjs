#!/usr/bin/env node
// No keys, writes, chain switching or transactions. Address must come from the later handoff.
import { readFile } from 'node:fs/promises';
import { observeDeployment } from '../sdk/config.mjs';
import { PUBLIC_SERVICES } from '../sdk/public.mjs';
const factory = process.argv[2], rpc = process.argv[3] ?? PUBLIC_SERVICES.rpc;
if (!factory) throw new Error('Usage: node tools/observe-ethereum.mjs CONFIRMED_FACTORY [HTTPS_RPC]');
const url = new URL(rpc);
if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Credential-free HTTPS RPC required');
const release = JSON.parse(await readFile(new URL('../config/release.json', import.meta.url)));
let id = 0;
const provider = { async request({ method, params = [] }) {
  if (!['eth_call', 'eth_chainId', 'eth_getCode'].includes(method)) throw new Error('Read method only');
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(15000) });
  const b = await r.json(); if (!r.ok || b.error) throw new Error(b.error?.message ?? 'RPC unavailable'); return b.result;
} };
console.log(JSON.stringify(await observeDeployment(provider, { release, factory, chainId: 1 }), null, 2));
