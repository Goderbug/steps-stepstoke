// Free, bounded public observations only. HTTP never settles or unlocks a Branch.
import { keccak256 } from '../vendor/ethers/ethers.mjs';
import { LIMITS } from './core.mjs';
export const PUBLIC_SERVICES = Object.freeze({ chainId: 1, rpc: 'https://ethereum-rpc.publicnode.com', api: 'https://api.imd.fun', artifactBase: 'https://api.imd.fun/artifacts/' });
export function intakeObservationURL(hash) {
  if (!/^0x[0-9a-f]{64}$/iu.test(hash)) throw new Error('Expected an original transaction hash');
  return `${PUBLIC_SERVICES.api}/intake/1/${hash}`;
}
export function artifactURL(hash) {
  const h = hash.replace(/^0x/u, '');
  if (!/^[0-9a-f]{64}$/iu.test(h)) throw new Error('Invalid artifact hash');
  return PUBLIC_SERVICES.artifactBase + h.toLowerCase();
}
export function originalResultURL(uri, gateway) {
  if (typeof uri !== 'string' || uri.length > 1024) throw new Error('Invalid result URI');
  if (/^ipfs:\/\/[a-zA-Z0-9]+\/result\.json$/u.test(uri)) {
    if (!gateway) throw new Error('Configure a trusted HTTPS IPFS gateway or select the original file');
    const g = new URL(gateway);
    if (g.protocol !== 'https:' || g.username || g.password || g.search || g.hash || g.pathname !== '/ipfs/') throw new Error('Invalid gateway');
    if (!['https://gateway.pinata.cloud/ipfs/','https://ipfs.io/ipfs/'].includes(gateway)) throw new Error('Gateway is not in the reviewed public allowlist');
    return gateway + uri.slice(7);
  }
  const url = new URL(uri, PUBLIC_SERVICES.api);
  if (url.origin !== PUBLIC_SERVICES.api || !/^\/intake-results\/[a-zA-Z0-9_-]+$/u.test(url.pathname) || url.search || url.hash || url.username || url.password) throw new Error('Untrusted result location');
  return url.href;
}
export async function fetchOriginalResult(uri, recordedHash, { fetch: fetchImpl = globalThis.fetch, gateway = 'https://gateway.pinata.cloud/ipfs/' } = {}) {
  if (!/^0x[0-9a-f]{64}$/iu.test(recordedHash)) throw new Error('Expected callback hash');
  const url = originalResultURL(uri, gateway);
  const response = await fetchImpl(url, { credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000) });
  if (!response.ok || response.redirected || (response.url && response.url !== url)) throw new Error('Original result unavailable or redirected');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > LIMITS.manifest) { await reader.cancel(); throw new Error(`Original result exceeds ${LIMITS.manifest} bytes; unsupported binding, never strip metadata or repurchase`); }
    chunks.push(value);
  }
  const raw = new Uint8Array(size); let n = 0;
  for (const bytes of chunks) { raw.set(bytes, n); n += bytes.length; }
  if (keccak256(raw).toLowerCase() !== recordedHash.toLowerCase()) throw new Error('Original result callback hash mismatch');
  return raw;
}
export async function observeIntake(hash, { fetch: fetchImpl = globalThis.fetch } = {}) {
  const body = await observationJSON(intakeObservationURL(hash), fetchImpl);
  return { authority: 'HTTP_OBSERVATION_ONLY', settlement: false, body };
}
export async function readLogs(provider, { address, fromBlock, toBlock, chunk = 2000, maxBlocks = 100000 }) {
  if (!Number.isSafeInteger(fromBlock) || fromBlock < 0 || !Number.isSafeInteger(toBlock) || toBlock < fromBlock || toBlock - fromBlock + 1 > maxBlocks || !Number.isSafeInteger(chunk) || chunk < 1 || chunk > 2000) throw new Error('Log range exceeds the bounded read window; use an explicit narrower range');
  const logs = [];
  for (let from = fromBlock; from <= toBlock; from += chunk) {
    const to = Math.min(from + chunk - 1, toBlock);
    const batch = await provider.request({ method: 'eth_getLogs', params: [{ address, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16) }] });
    if (!Array.isArray(batch) || logs.length + batch.length > 10000) throw new Error('Log response exceeds bound');
    logs.push(...batch);
  }
  return logs;
}
export const REQUIRED_GATES = Object.freeze(['securityReview', 'runtimeChildPolicy', 'manifestCompatibility', 'gasCeilings', 'liveExecution', 'deploymentVerification']);
export function assertProductionGates(gate, expected) {
  if (!gate || gate.chainId !== 1 || gate.productionReady !== true || gate.liveCompatibility !== 'PASS' || !gate.productionDeployment) throw new Error('Production gates remain open');
  const d=gate.productionDeployment;
  validateDeploymentRecord(d);
  if(expected && (expected.chainId!==1 || expected.deploymentBlock!==d.blockNumber || ['factory','encoder','verifier'].some(k=>expected.contracts?.[k]?.toLowerCase()!==d[k].toLowerCase()) || (expected.evidence && ['transactionHash','blockHash','sourceCommit','attestationHash'].some(k=>expected.evidence[k]!==d[k])))) throw new Error('Production gate belongs to a different deployment');
  for (const id of [0,1,2,3,4]) { const p = gate.profiles?.[id]; if (p?.status !== 'PASS' || !Array.isArray(p.evidence) || !p.evidence.length) throw new Error(`Live profile ${id} remains open`); }
  for (const name of REQUIRED_GATES) {
    const g=gate.gates?.[name];
    if (g?.status !== 'PASS' || !Array.isArray(g.evidence) || !g.evidence.length || g.evidence.some(e=>typeof e!=='string'||!e.trim())) throw new Error(`Production gate ${name} remains open`);
  }
}

// Bounded public HTTP observations, correlated to an authenticated Purchased event.
async function observationJSON(url, fetchImpl) {
  const r = await fetchImpl(url, { credentials:'omit', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(15000) });
  if (r.status === 404) return null;
  if (!r.ok || r.redirected || (r.url && r.url !== url)) throw new Error('Official observation unavailable or redirected');
  const reader=r.body.getReader();const chunks=[];let n=0;
  for (;;) {const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>262144){await reader.cancel();throw new Error('Observation exceeds read bound');}chunks.push(value);}
  const raw=new Uint8Array(n);let at=0;for(const c of chunks){raw.set(c,at);at+=c.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
}
export async function observeAdmission({ chainId, transactionHash, requestId, payer, intake, jobId }, { fetch: fetchImpl=globalThis.fetch }={}) {
  if(chainId!==1 || !/^0x[0-9a-f]{64}$/iu.test(requestId??'') || ![payer,intake].every(a=>/^0x[0-9a-f]{40}$/iu.test(a??'')))throw new Error('Authenticated chain/transaction/request/payer/Intake correlation required');
  const body=await observationJSON(intakeObservationURL(transactionHash),fetchImpl);
  const result={authority:'HTTP_OBSERVATION_ONLY',settlement:false,chainId,transactionHash,requestId,payer,admission:'NOT_OBSERVED',execution:'NOT_OBSERVED',git:'NOT_OBSERVED',jobId:null};
  if(!body)return result;
  const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
  if(body.chainId!==1||!same(body.transactionHash,transactionHash)||!Array.isArray(body.entries))throw new Error('Intake observation identity mismatch');
  const entries=body.entries.filter(e=>same(e.requestId,requestId));
  if(entries.length!==1)throw new Error('Missing or ambiguous Intake request');
  const e=entries[0];
  if(!same(e.payer,payer)||!same(e.intake,intake)||!same(e.callback?.target,payer))throw new Error('Intake payer/callback mismatch');
  result.admission=e.state;result.entry=e;
  const admitted=e.admission?.result;
  if(!admitted)return result;
  if(admitted.kind!=='job'||typeof admitted.jobId!=='string'||!/^[a-zA-Z0-9_-]+$/u.test(admitted.jobId)||admitted.jobId.length>128||(jobId&&jobId!==admitted.jobId))throw new Error('Admission job identity mismatch');
  result.jobId=admitted.jobId;
  // Construct the official path; never follow a statusUrl supplied in HTTP content.
  const job=await observationJSON(`${PUBLIC_SERVICES.api}/jobs/${encodeURIComponent(admitted.jobId)}`,fetchImpl);
  if(job){if(job.id!==admitted.jobId||!same(job.paidBy,payer))throw new Error('Job/payer identity mismatch');result.execution=job.state;result.git=job.delivery??null;result.job=job;}
  return result;
}

export function validateDeploymentRecord(d) {
  if (!d || typeof d !== 'object') throw new Error('Invalid production deployment evidence');
  const addresses=['factory','encoder','verifier'].map(k=>d[k]);
  if (addresses.some(a=>!/^0x[0-9a-f]{40}$/iu.test(a) || /^0x0{40}$/iu.test(a)) || new Set(addresses.map(a=>a.toLowerCase())).size!==3 || !['transactionHash','blockHash'].every(k=>/^0x[0-9a-f]{64}$/iu.test(d[k])) || !Number.isSafeInteger(d.blockNumber) || d.blockNumber<1) throw new Error('Invalid production deployment evidence');
  if (!/^[0-9a-f]{40}$/u.test(d.sourceCommit ?? '') || !/^[0-9a-f]{64}$/u.test(d.attestationHash ?? '')) throw new Error('Invalid production deployment source/attestation identity');
  return d;
}
