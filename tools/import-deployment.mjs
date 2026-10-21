#!/usr/bin/env node
// Run AFTER the static build. No transaction methods, signer, account or guessed handoff.
import { readFile, writeFile, readdir, mkdir, lstat, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { sha256, keccak256 } from '../vendor/ethers/ethers.mjs';
import { APPLICATIONS, abiHash, verifyHandoffAssets, validateHandoff } from '../sdk/handoff.mjs';
import { verifyPublicDeployment } from '../sdk/deployment.mjs';
export async function importDeployment({ handoffPath = '.imd/reads/deployment.json', networkPath = '.imd/reads/network.json', evidencePath, dist = 'dist', provider, release }) {
  // Read all inputs and verify onchain BEFORE writing any publishable manifest.
  await rm(resolve(dist,'imd-deployment.json'),{force:true});
  const h = JSON.parse(await readFile(handoffPath,'utf8'));
  if (!Array.isArray(h.contracts) || h.contracts.length !== 3 || new Set(h.contracts.map(c=>c.name)).size !== 3 || h.contracts.some(c=>!APPLICATIONS.includes(c.name))) throw new Error('Complete named application set required before reading ABIs');
  if (!evidencePath || !provider) throw new Error('Receipt evidence and read-only RPC are required');
  const evidence = JSON.parse(await readFile(evidencePath,'utf8'));
  const contracts = [];
  for (const c of h.contracts ?? []) {
    const abi = JSON.parse(await readFile(`abi/${c.name}.json`,'utf8'));
    if (!Array.isArray(abi) || abiHash(abi) !== c.abiHash) throw new Error(`Frozen ABI differs from handoff: ${c.name}`);
    contracts.push({ name:c.name, address:c.address, abiHash:c.abiHash, abiPath:`abi/${c.name}.json` });
  }
  const result = {version:1,launchId:h.launchId,chainId:h.chainId,sourceCommit:h.sourceCommit,attestationHash:h.attestationHash,contracts,assets:[]};
  try { const n = JSON.parse(await readFile(networkPath,'utf8')); if (Object.hasOwn(n,'network')) result.network = n.network; if (Object.hasOwn(n,'walletAddChain')) result.walletAddChain=n.walletAddChain; } catch(e) { if(e.code!=='ENOENT') throw e; }
  const content = new Map();
  const walk = async dir => { for(const e of await readdir(dir,{withFileTypes:true})) { const p=resolve(dir,e.name); if((await lstat(p)).isSymbolicLink())throw new Error('Symlink in static export'); if(e.isDirectory())await walk(p);else if(e.isFile()&&relative(resolve(dist),p)!=='imd-deployment.json')content.set(relative(resolve(dist),p).replaceAll('\\','/'),await readFile(p)); } };
  await walk(resolve(dist));
  for (const c of contracts) content.set(c.abiPath,await readFile(`abi/${c.name}.json`));
  content.set('deployment-evidence.json',await readFile(evidencePath));
  for (const [path,raw] of [...content.entries()].sort(([a],[b])=>a.localeCompare(b))) result.assets.push({path,sha256:sha256(raw).slice(2)});
  validateHandoff(result);
  await verifyHandoffAssets(result,p=>content.get(p));
  // Authenticate the sourceCommit against the exact local object set; never fetch a future head.
  for (const [path, expected] of Object.entries(release.frozenBuild.sources)) {
    const raw = execFileSync('git',['show',`${h.sourceCommit}:${path}`],{maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
    if (keccak256(raw) !== expected) throw new Error(`Handoff sourceCommit differs from frozen source: ${path}`);
  }
  await verifyPublicDeployment(provider,result,evidence,release);
  await mkdir(resolve(dist,'abi'),{recursive:true});
  for (const c of contracts) await writeFile(resolve(dist,c.abiPath),content.get(c.abiPath));
  await writeFile(resolve(dist,'deployment-evidence.json'),content.get('deployment-evidence.json'));
  await writeFile(resolve(dist,'imd-deployment.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [evidencePath,rpc] = process.argv.slice(2);
  try {
    if(!rpc || new URL(rpc).protocol!=='https:' || new URL(rpc).username || new URL(rpc).password)throw new Error('Usage: node tools/import-deployment.mjs RECEIPT_EVIDENCE HTTPS_RPC (requires actual .imd/reads/deployment.json)');
    const allowed = new Set(['eth_chainId','eth_getTransactionReceipt','eth_getBlockByNumber','eth_getCode','debug_traceTransaction']);let id=0;
    const provider={async request({method,params=[]}){if(!allowed.has(method))throw new Error('Read only');const r=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(30000)});const b=await r.json();if(!r.ok||b.error)throw new Error(b.error?.message??'RPC unavailable');return b.result;}};
    const release=JSON.parse(await readFile('config/release.json','utf8'));
    const result=await importDeployment({evidencePath,provider,release});console.log(JSON.stringify({ok:true,launchId:result.launchId,chainId:result.chainId,assets:result.assets.length,liveCompatibility:'NOT_RUN',productionReady:false}));
  } catch(e) {console.error(e.message);process.exitCode=1;}
}
