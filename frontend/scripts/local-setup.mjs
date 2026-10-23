#!/usr/bin/env node
// Development ONLY. Starts a disposable Anvil and a deterministic artifact server.
// No private keys, public-chain RPC, hosting or real IMD. Keep these processes local.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Interface } from '../../vendor/ethers/ethers.mjs';
const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export async function startLocal({ rpcPort = 8545, artifactPort = 8546, configOut = resolve(root, 'test/scratch/local-config.json') } = {}) {
  for (const port of [rpcPort, artifactPort]) await new Promise((ok, fail) => { const probe = netServer(); probe.once('error', () => fail(new Error(`Local port ${port} is occupied; no existing chain will be modified`))); probe.listen(port, '127.0.0.1', () => probe.close(ok)); });
  const release = JSON.parse(await readFile(resolve(root, 'config/release.json')));
  const rpcURL = `http://127.0.0.1:${rpcPort}`;
  const artifactBase = `http://127.0.0.1:${artifactPort}/artifacts/`;
  const artifacts = resolve(root, 'test/scratch/local-artifacts');
  await mkdir(artifacts, { recursive: true });
  let id = 0;
  const provider = { async request({ method, params = [] }) {
    const response = await fetch(rpcURL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
    const body = await response.json(); if (body.error) throw new Error(`${method}: ${body.error.message}`); return body.result;
  } };
  const anvil = spawn('anvil', ['--host', '127.0.0.1', '--port', String(rpcPort), '--silent', '--gas-limit', '30000000'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let failed;
  anvil.on('error', e => { failed = e; });
  anvil.on('exit', code => { if (code) failed = new Error(`anvil exited ${code}`); });
  try {
    for (let n = 0; ; n++) {
      if (failed) throw failed;
      try { await provider.request({ method: 'eth_chainId' }); break; } catch (e) { if (n > 100) throw e; await new Promise(r => setTimeout(r, 50)); }
    }
    const accounts = await provider.request({ method: 'eth_accounts' });
    const [deployer, writer, treasury, alternate] = accounts;
    const trace = [];
    const send = async (operation, tx) => {
      const hash = await provider.request({ method: 'eth_sendTransaction', params: [{ gas: '0x'+(16777216).toString(16), ...tx }] });
      for (let n = 0; n < 300; n++) {
        const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
        if (receipt) { if (BigInt(receipt.status) !== 1n) throw new Error(`${operation} reverted`); trace.push({ operation, hash, from: tx.from, to: tx.to ?? receipt.contractAddress, block: receipt.blockNumber, gasUsed: receipt.gasUsed }); return receipt; }
        await new Promise(r => setTimeout(r, 25));
      }
      throw new Error('Original setup transaction unconfirmed; not resubmitted');
    };
    const artifact = async name => JSON.parse(await readFile(resolve(root, `out/${name}.sol/${name}.json`)));
    const token = await artifact('MockToken'), intake = await artifact('MockIntake'), factory = await artifact('RelayFactory');
    const tokenI = new Interface(token.abi), intakeI = new Interface(intake.abi);
    await provider.request({ method: 'anvil_setCode', params: [release.imd, token.deployedBytecode.object] });
    await provider.request({ method: 'anvil_setCode', params: [release.intake, intake.deployedBytecode.object] });
    await send('initialize MockIntake', { from: deployer, to: release.intake, data: intakeI.encodeFunctionData('initialize', [writer, treasury, release.imd]) });
    for (const action of Object.values(release.actions)) await send('set mock price', { from: deployer, to: release.intake, data: intakeI.encodeFunctionData('setPrice', [action, 500000000000000000n]) });
    for (const who of [deployer, alternate]) await send('mint local mock balance', { from: deployer, to: release.imd, data: tokenI.encodeFunctionData('mint', [who, 10n ** 20n]) });
    const encoderCode = await artifact('RelayEncoder'), verifierCode = await artifact('RelayVerifier');
    const encoder = await send('deploy RelayEncoder', { from: deployer, data: encoderCode.bytecode.object });
    const verifier = await send('deploy RelayVerifier', { from: deployer, data: verifierCode.bytecode.object });
    const args = new Interface(factory.abi).encodeDeploy([encoder.contractAddress, verifier.contractAddress]);
    const deployed = await send('deploy actual final RelayFactory', { from: deployer, data: factory.bytecode.object + args.slice(2) });
    // Execute the delivered generator against actual deployed code; add only local transport/location policy.
    const { stdout } = await exec(process.execPath, ['tools/generate-local-config.mjs', '--rpc', rpcURL, '--factory', deployed.contractAddress], { cwd: root });
    const config = { ...JSON.parse(stdout), rpcURL, artifactBase, artifactPolicy: 'TEST_ONLY_LOOPBACK_FIXTURE' };
    const encoded = JSON.stringify(config, null, 2) + '\n';
    await mkdir(dirname(configOut), { recursive: true }); await writeFile(configOut, encoded);
    const server = createServer(async (req, res) => {
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('cache-control', 'no-store');
      const url = new URL(req.url, artifactBase);
      if (!url.pathname.startsWith('/artifacts/')) { res.writeHead(404); res.end(); return; }
      const path = resolve(artifacts, decodeURIComponent(url.pathname.slice('/artifacts/'.length)));
      if (!path.startsWith(artifacts + '/')) { res.writeHead(403); res.end(); return; }
      try { const bytes = await readFile(path); res.writeHead(200, { 'content-length': bytes.length, 'content-type': path.endsWith('.png') ? 'image/png' : path.endsWith('.html') ? 'text/html' : path.endsWith('.json') ? 'application/json' : 'text/markdown' }); res.end(bytes); }
      catch { res.writeHead(404); res.end(); }
    });
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(artifactPort, '127.0.0.1', ok); });
    return { root, config, accounts: [deployer, alternate], writer, treasury, provider, intakeI, tokenI, release, artifacts, trace, send, async close() { await new Promise(r => server.close(r)); anvil.kill(); } };
  } catch (e) { anvil.kill(); throw e; }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const local = await startLocal();
    await writeFile(resolve(root, 'test/scratch/local-session.json'), JSON.stringify({ config: local.config, accounts: local.accounts, writer: local.writer, treasury: local.treasury }, null, 2));
    try { await writeFile(resolve(root, 'dist/local-config.json'), JSON.stringify(local.config, null, 2) + '\n'); } catch { /* build the static export before starting a local session */ }
    console.log('LOCAL ONLY: Anvil 31337 at http://127.0.0.1:8545. Config generated from actual deployed code.');
    console.log('Two temporary unlocked accounts:', local.accounts.join(', '));
    console.log('Preview the already-built dist on loopback and open #/local. Rebuilding removes the session config; restart setup afterwards.');
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await local.close(); process.exit(0); });
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
