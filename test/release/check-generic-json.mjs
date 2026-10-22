// Differential check against the actual compiled StrictJSON harness. Local unlocked
// Anvil accounts only; no wallet key, public RPC, public transaction or real funds.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { ContractFactory, JsonRpcProvider } from '../../vendor/ethers/ethers.mjs';
import * as nodeSDK from '../../sdk/index.mjs';
import * as browserSDK from '../../sdk/browser.mjs';

const probe = createServer();
probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const chain = spawn('anvil', ['--host','127.0.0.1','--port',String(port),'--silent'], {stdio:'ignore'});
const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, 31337, {staticNetwork:true});
try {
  for (let n=0;;n++) { try { await provider.send('eth_chainId', []); break; }
    catch (e) { if (n === 100) throw e; await new Promise(r => setTimeout(r,25)); } }
  assert.match(await provider.send('web3_clientVersion', []), /anvil/i);
  const artifact = JSON.parse(await readFile(new URL('../../out/StrictManifest.t.sol/JSONHarness.json', import.meta.url)));
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode.object, await provider.getSigner()).deploy();
  await contract.waitForDeployment();
  const data = extra => new TextEncoder().encode(JSON.stringify({items:
    [...Array.from({length:7},()=>Array(32).fill(0)), Array(21+extra).fill(0)]}));
  assert.equal(await contract.parse(data(0)), 256n);
  await assert.rejects(contract.parse(data(1)));
  for (const sdk of [nodeSDK,browserSDK]) {
    assert.equal(sdk.strictJSON(data(0)).items.length,8);
    assert.throws(()=>sdk.strictJSON(data(1)));
  }
  console.log(JSON.stringify({scope:'DISPOSABLE_LOCAL_DIFFERENTIAL_CHECK', status:'PASS',
    acceptedTokens:256,rejectedTokens:257,implementations:['compiled StrictJSON.sol','Node SDK','browser SDK']},null,2));
} finally { provider.destroy(); chain.kill(); }
