#!/usr/bin/env node
// Generates the browser app's local configuration from an actual local deployment.
//   node tools/generate-local-config.mjs --rpc http://127.0.0.1:8545 --factory 0x... [--out FILE]
// Reads config/release.json read-only. Prints JSON to stdout unless --out names a file; the final
// file location is chosen by the integration (build-website) stage, not by this tool.
import { readFile, writeFile } from 'node:fs/promises';
import { observeLocalDeployment } from '../sdk/config.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
try {
  const rpc = option('rpc');
  const factory = option('factory');
  if (!rpc || !factory) throw new Error('Usage: --rpc LOOPBACK_URL --factory ADDRESS [--out FILE]');
  const url = new URL(rpc);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Local config generation reads a loopback RPC only');
  let id = 0;
  const provider = {
    async request({ method, params }) {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
      const body = await response.json();
      if (body.error) throw new Error(`${method}: ${body.error.message}`);
      return body.result;
    }
  };
  const release = JSON.parse(await readFile(new URL('../config/release.json', import.meta.url), 'utf8'));
  const config = await observeLocalDeployment(provider, { release, factory });
  const text = JSON.stringify(config, null, 2) + '\n';
  if (option('out')) await writeFile(option('out'), text); else process.stdout.write(text);
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
}
