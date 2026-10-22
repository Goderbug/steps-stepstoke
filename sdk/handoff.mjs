// Workflow handoff format. Shared by the offline importer and static browser runtime.
// The handoff is data, never a source of executable policy or alternate addresses.
import { getAddress, keccak256, sha256, toUtf8Bytes } from '../vendor/ethers/ethers.mjs';
import { PUBLIC_RPC_POLICY_ASSET, defaultPublicRpcPolicy, validatePublicRpcPolicy } from './public-rpc.mjs';
export const APPLICATIONS = Object.freeze(['RelayEncoder', 'RelayVerifier', 'RelayFactory']);
export const canonicalJSON = value => JSON.stringify(sortJSON(value));
function sortJSON(v) {
  if (Array.isArray(v)) return v.map(sortJSON);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map(k => [k, sortJSON(v[k])]));
  return v;
}
export const abiHash = abi => {
  if (!Array.isArray(abi)) throw new Error('ABI must be a raw JSON array');
  return keccak256(toUtf8Bytes(canonicalJSON(abi))).slice(2);
};
export function relativeAsset(path) {
  if (typeof path !== 'string' || !/^[A-Za-z0-9_./-]+$/u.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe export path');
  return path;
}
const hex = (v, n) => typeof v === 'string' && new RegExp(`^[0-9a-f]{${n}}$`, 'u').test(v);
export function validateHandoff(h) {
  if (!h || h.version !== 1 || h.chainId !== 1 || typeof h.launchId !== 'string' || !h.launchId.trim() || !hex(h.sourceCommit, 40) || !hex(h.attestationHash, 64)) throw new Error('Invalid Ethereum workflow handoff identity');
  if (Object.keys(h).some(k => !['version','launchId','chainId','sourceCommit','attestationHash','contracts','assets','network','walletAddChain'].includes(k))) throw new Error('Unexpected handoff top-level key');
  if (!Array.isArray(h.contracts) || h.contracts.length !== 3 || new Set(h.contracts.map(c => c.name)).size !== 3 || APPLICATIONS.some(n => !h.contracts.some(c => c.name === n))) throw new Error('Complete named contract set required');
  const addresses = new Set();
  for (const c of h.contracts) {
    if (Object.keys(c).some(k => !['name','address','abiHash','abiPath'].includes(k)) || !hex(c.abiHash, 64) || !/^0x[0-9a-f]{40}$/iu.test(c.address) || BigInt(c.address) === 0n) throw new Error('Invalid named contract');
    getAddress(c.address); addresses.add(c.address.toLowerCase());
    if (c.abiPath !== `abi/${c.name}.json`) throw new Error('ABI path must identify its named contract');
  }
  if (addresses.size !== 3) throw new Error('Duplicate deployment address');
  if (!Array.isArray(h.assets) || !h.assets.length || h.assets.length > 128) throw new Error('Invalid asset inventory');
  const paths = new Set();
  for (const a of h.assets) {
    relativeAsset(a.path);
    if (Object.keys(a).sort().join(',') !== 'path,sha256' || !hex(a.sha256, 64) || a.path === 'imd-deployment.json' || paths.has(a.path)) throw new Error('Invalid or duplicate asset');
    paths.add(a.path);
  }
  for (const p of ['index.html', ...h.contracts.map(c => c.abiPath), 'deployment-evidence.json']) if (!paths.has(p)) throw new Error(`Missing inventoried ${p}`);
  return h;
}
export function deploymentIdentity(h) {
  validateHandoff(h);
  return `public:1:${h.contracts.find(c => c.name === 'RelayFactory').address.toLowerCase()}:${h.attestationHash}`;
}
export async function verifyHandoffAssets(h, readBytes) {
  validateHandoff(h);
  const data = new Map(); let total = 0;
  for (const a of h.assets) {
    const raw = new Uint8Array(await readBytes(a.path));
    total += raw.length;
    if (raw.length > 8 * 1024 * 1024 || total > 32 * 1024 * 1024 || sha256(raw).slice(2) !== a.sha256) throw new Error(`Asset bytes mismatch: ${a.path}`);
    data.set(a.path, raw);
  }
  for (const c of h.contracts) if (abiHash(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data.get(c.abiPath)))) !== c.abiHash) throw new Error(`ABI hash mismatch: ${c.name}`);
  return data;
}
export async function loadPublicHandoff({ fetch: fetchImpl = globalThis.fetch, base = './' } = {}) {
  const fetchBytes = async path => {
    const r = await fetchImpl(base + relativeAsset(path), { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!r.ok || r.redirected) throw new Error('Confirmed deployment handoff unavailable');
    const reader = r.body.getReader(); const chunks = []; let size = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8388608) { await reader.cancel(); throw new Error('Export asset too large'); } chunks.push(value); }
    const raw = new Uint8Array(size); let at = 0; for (const c of chunks) { raw.set(c, at); at += c.length; } return raw;
  };
  const h = validateHandoff(JSON.parse(new TextDecoder().decode(await fetchBytes('imd-deployment.json'))));
  const files = await verifyHandoffAssets(h, fetchBytes);
  const evidence = JSON.parse(new TextDecoder().decode(files.get('deployment-evidence.json')));
  if (evidence.sourceCommit !== h.sourceCommit || evidence.attestationHash !== h.attestationHash) throw new Error('Evidence belongs to a different handoff');
  // Auxiliary evidence provides receipt coordinates, never application addresses.
  const contracts = Object.fromEntries(h.contracts.map(c => [c.name.replace('Relay','').toLowerCase(), c.address]));
  const rpcURL = h.network?.rpcUrl ?? h.network?.rpcUrls?.default?.http?.[0] ?? h.network?.rpcUrls?.[0] ?? 'https://ethereum-rpc.publicnode.com';
  if (typeof rpcURL !== 'string') throw new Error('Supplied network has no supported public RPC URL');
  // A separate, digest-checked transport asset can select public read providers. The
  // official network/walletAddChain objects above remain byte-for-byte data copies.
  const rpcPolicy = files.has(PUBLIC_RPC_POLICY_ASSET)
    ? validatePublicRpcPolicy(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files.get(PUBLIC_RPC_POLICY_ASSET))))
    : defaultPublicRpcPolicy(rpcURL);
  return { kind: 'ETHEREUM_DEPLOYMENT', chainId: h.chainId, contracts, rpcURL: rpcPolicy.rpcUrls[0], rpcURLs: rpcPolicy.rpcUrls,
    handoff: h, evidence, identity: deploymentIdentity(h), deploymentBlock: evidence.blockNumber, productionGate: evidence.productionGate };
}
