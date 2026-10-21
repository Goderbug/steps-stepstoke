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
    return gateway + uri.slice(7);
  }
  const url = new URL(uri, PUBLIC_SERVICES.api);
  if (url.origin !== PUBLIC_SERVICES.api || !/^\/intake-results\/[a-zA-Z0-9_-]+$/u.test(url.pathname) || url.search || url.hash || url.username || url.password) throw new Error('Untrusted result location');
  return url.href;
}
export async function fetchOriginalResult(uri, recordedHash, { fetch: fetchImpl = globalThis.fetch, gateway } = {}) {
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
  const r = await fetchImpl(intakeObservationURL(hash), { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!r.ok || r.redirected) throw new Error('Intake observation unavailable');
  // Observation is never a callback, purchase receipt, or binding instruction.
  return { authority: 'HTTP_OBSERVATION_ONLY', settlement: false, body: await r.json() };
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
  const addresses=['factory','encoder','verifier'].map(k=>d[k]);
  if (addresses.some(a=>!/^0x[0-9a-f]{40}$/iu.test(a) || /^0x0{40}$/iu.test(a)) || new Set(addresses.map(a=>a.toLowerCase())).size!==3 || !['transactionHash','blockHash'].every(k=>/^0x[0-9a-f]{64}$/iu.test(d[k])) || !Number.isSafeInteger(d.blockNumber) || d.blockNumber<1) throw new Error('Invalid production deployment evidence');
  if(expected && (expected.chainId!==1 || expected.deploymentBlock!==d.blockNumber || ['factory','encoder','verifier'].some(k=>expected.contracts?.[k]?.toLowerCase()!==d[k].toLowerCase()))) throw new Error('Production gate belongs to a different deployment');
  for (const name of REQUIRED_GATES) {
    const g=gate.gates?.[name];
    if (g?.status !== 'PASS' || !Array.isArray(g.evidence) || !g.evidence.length || g.evidence.some(e=>typeof e!=='string'||!e.trim())) throw new Error(`Production gate ${name} remains open`);
  }
}
