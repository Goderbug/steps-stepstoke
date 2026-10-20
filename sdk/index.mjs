import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  AbiCoder, Interface, getAddress, getBytes, hexlify, isHexString, keccak256, version
} from '../vendor/ethers/ethers.mjs';
import { strictJSON, unsignedJSONInteger } from './strict-json.mjs';

// No dependency installation, keys, wallet, signer, HTTP client, indexer or browser is required.
export const ethersVersion = version;
export const ASSET_TYPE = 'tuple(bytes32 key,uint8 kind,string name,string path,bytes32 fileHash,string mediaType,uint32 size,bytes32 submissionHash,address producer,string jobId,bytes32 resultHash,uint64 revision)[]';
export const PHASES = Object.freeze(['READY', 'PURCHASING', 'PENDING', 'RESULT_RECORDED', 'REFUSED', 'FROZEN']);
export const PROFILES = Object.freeze({ MarkdownCreate: 0, MarkdownUpdate: 1, HTMLCreate: 2, HTMLUpdate: 3, ImageCreate: 4 });
export const LIMITS = Object.freeze({ assets: 16, inputs: 8, body: 16384, manifest: 8192, document: 65536, html: 2097152, image: 262144, imagesTotal: 524288 });
const coder = AbiCoder.defaultAbiCoder();
const loadABI = name => JSON.parse(readFileSync(new URL(`../abi/${name}.json`, import.meta.url), 'utf8'));
export const interfaces = Object.freeze({
  factory: new Interface(loadABI('RelayFactory')),
  branch: new Interface(loadABI('RelayBranch')),
  encoder: new Interface(loadABI('RelayEncoder')),
  verifier: new Interface(loadABI('RelayVerifier'))
});
const mime = ['text/markdown', 'text/html', 'image/png'];
const caps = [LIMITS.document, LIMITS.html, LIMITS.image];
const hash = value => {
  if (!isHexString(value, 32) || BigInt(value) === 0n) throw new Error('Expected nonzero bytes32');
  return value.toLowerCase();
};
const hexDigest = (value, label) => {
  if (typeof value !== 'string') throw new Error(`Expected ${label} hex digest`);
  return hash(value.startsWith('0x') ? value : `0x${value}`);
};
const bounded = (value, max) => {
  if (typeof value !== 'string' || !value.length || Buffer.byteLength(value) > max) throw new Error('Text outside bounds');
  // UTF-8 roundtrip rejects isolated JS surrogates, which TextEncoder otherwise replaces.
  if (new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(value)) !== value) throw new Error('Invalid Unicode');
  for (const c of value) {
    const cp = c.codePointAt(0);
    if ((cp < 32 && cp !== 9 && cp !== 10) || cp === 127 || (cp >= 0xFDD0 && cp <= 0xFDEF) || (cp & 0xFFFF) >= 0xFFFE) throw new Error('Invalid text');
  }
  return value;
};
const identifier = (value, max = 64) => {
  bounded(value, max);
  if (!/^[a-zA-Z0-9_-]+$/u.test(value)) throw new Error('Invalid identifier');
  return value;
};
const path = value => {
  bounded(value, 128);
  if (!/^[a-zA-Z0-9_./-]+$/u.test(value) || value.endsWith('.') || value.split('/').some(x => !x || x.startsWith('.'))) throw new Error('Invalid relative path');
  return value;
};
const positive = value => {
  const number = BigInt(value);
  if (number <= 0n) throw new Error('Expected positive integer');
  return number;
};
const address = value => {
  const normalized = getAddress(value);
  if (BigInt(normalized) === 0n) throw new Error('Expected nonzero address');
  return normalized;
};

export function canonicalWitness(assets) {
  if (!Array.isArray(assets) || assets.length > LIMITS.assets) throw new Error('Asset count limit');
  const sorted = assets.map(a => {
    const kind = Number(a.kind);
    if (!Number.isInteger(kind) || kind < 0 || kind > 2) throw new Error('Invalid asset kind');
    const size = positive(a.size);
    if (size > BigInt(caps[kind]) || a.mediaType !== mime[kind]) throw new Error('Invalid file type or size');
    const filePath = path(a.path);
    if ((kind === 0 && !filePath.endsWith('.md')) || (kind === 1 && filePath !== 'dist/index.html') || (kind === 2 && !filePath.endsWith('.png'))) throw new Error('Invalid output path');
    const revision = positive(a.revision);
    if (revision > (1n << 64n) - 1n) throw new Error('Revision overflow');
    return {
      key: hash(a.key), kind, name: identifier(a.name), path: filePath, fileHash: hash(a.fileHash),
      mediaType: a.mediaType, size, submissionHash: hash(a.submissionHash), producer: address(a.producer),
      jobId: identifier(a.jobId), resultHash: hash(a.resultHash), revision
    };
  }).sort((a, b) => BigInt(a.key) < BigInt(b.key) ? -1 : BigInt(a.key) > BigInt(b.key) ? 1 : 0);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].key === sorted[i - 1].key) throw new Error('Duplicate asset key');
  }
  if (sorted.length + 3 - new Set(sorted.map(a => a.kind)).size > 16) throw new Error('Reserved asset slots exhausted');
  return sorted;
}

export function witnessHash(assets) {
  return keccak256(coder.encode([ASSET_TYPE], [canonicalWitness(assets)]));
}

const profileRule = profile => {
  if (!Number.isInteger(profile) || profile < 0 || profile > 4) throw new Error('Invalid profile');
  return Object.freeze({
    kind: profile === PROFILES.MarkdownCreate || profile === PROFILES.MarkdownUpdate ? 0 : profile === PROFILES.HTMLCreate || profile === PROFILES.HTMLUpdate ? 1 : 2,
    update: profile === PROFILES.MarkdownUpdate || profile === PROFILES.HTMLUpdate
  });
};
const outputPath = (kind, value) => {
  const checked = path(value);
  if ((kind === 0 && !checked.endsWith('.md')) || (kind === 1 && checked !== 'dist/index.html') || (kind === 2 && !checked.endsWith('.png'))) throw new Error('Invalid output path');
  return checked;
};

// Mirrors the fixed encoder's locally knowable admission rules.  A current eth_call is still
// needed before spending: anchor, phase, price and a competing transaction can change.
export function validateProposal(proposal, witness) {
  const p = { ...proposal };
  if (p.publish === undefined) p.publish = false;
  p.anchor = hash(p.anchor);
  p.target = hash(p.target);
  const rule = profileRule(p.profile);
  if (p.publish !== false) throw new Error('Publication is disabled');
  if (!Array.isArray(p.inputs) || p.inputs.length > LIMITS.inputs) throw new Error('Input count limit');
  p.inputs = p.inputs.map(hash);
  for (let i = 1; i < p.inputs.length; i++) if (BigInt(p.inputs[i]) <= BigInt(p.inputs[i - 1])) throw new Error('Inputs must be sorted and unique');
  p.outputName = identifier(p.outputName);
  p.outputPath = outputPath(rule.kind, p.outputPath);
  p.text = bounded(p.text, 1024);
  const current = canonicalWitness(witness);
  const target = current.find(asset => asset.key === p.target);
  if (rule.update) {
    if (!target || target.kind !== rule.kind || target.name !== p.outputName || target.path !== p.outputPath) throw new Error('Update target mapping mismatch');
    if (!p.inputs.includes(p.target)) throw new Error('Update must select target');
  } else {
    if (target) throw new Error('Create target already exists');
    const kinds = new Set(current.map(asset => asset.kind));
    kinds.add(rule.kind);
    if (current.length + 1 + 3 - kinds.size > LIMITS.assets) throw new Error('Reserved asset slots exhausted');
  }
  if (rule.kind === 2 && p.inputs.length !== 0) throw new Error('Image references are disabled');
  let imageBytes = 0;
  let htmlBytes = 0;
  for (const key of p.inputs) {
    const selected = current.find(asset => asset.key === key);
    if (!selected) throw new Error('Input is not a current asset');
    if (rule.kind === 0 && selected.kind !== 0) throw new Error('Markdown accepts Markdown inputs only');
    if (selected.kind === 2) {
      imageBytes += Number(selected.size);
      if (imageBytes > LIMITS.imagesTotal) throw new Error('Selected image aggregate limit');
      htmlBytes += 4 * Math.ceil(Number(selected.size) / 3) + 32;
    }
    if (selected.kind === 1) htmlBytes += Number(selected.size);
  }
  if (htmlBytes > LIMITS.html) throw new Error('HTML input and data-URI overhead limit');
  return Object.freeze({ proposal: Object.freeze(p), witness: current });
}

function transaction(iface, to, method, args) {
  return Object.freeze({ to: address(to), data: iface.encodeFunctionData(method, args), value: '0x0' });
}
export function createProject(factory, goal) {
  return transaction(interfaces.factory, factory, 'createProject', [bounded(goal, 512)]);
}
export function proposeWork(branch, proposal, witness) {
  const checked = validateProposal(proposal, witness);
  return transaction(interfaces.branch, branch, 'propose', [checked.proposal, checked.witness]);
}
export function sponsorProposal(branch, id, maxFee, witness) {
  return transaction(interfaces.branch, branch, 'sponsor', [positive(id), positive(maxFee), canonicalWitness(witness)]);
}
export function retryRefused(branch, maxFee, witness) {
  return transaction(interfaces.branch, branch, 'retry', [positive(maxFee), canonicalWitness(witness)]);
}
export function bindResult(branch, raw, recordedHash, witness) {
  if (!(raw instanceof Uint8Array) || raw.length > LIMITS.manifest || keccak256(raw) !== hash(recordedHash)) throw new Error('Raw manifest digest mismatch');
  strictJSON(raw);
  return transaction(interfaces.branch, branch, 'bind', [raw, canonicalWitness(witness)]);
}
export function forkHistory(factory, parent, revision, witness, direction) {
  return transaction(interfaces.factory, factory, 'fork', [address(parent), positive(revision), canonicalWitness(witness), bounded(direction, 512)]);
}
export function previewProposal(branch, id, witness) {
  return { kind: 'eth_call', transaction: transaction(interfaces.branch, branch, 'bodyOf', [positive(id), canonicalWitness(witness)]) };
}
export function readState(branch, method = 'phase', args = []) {
  const allowed = new Set(['goal', 'direction', 'source', 'revision', 'assetsHash', 'latestJobId', 'projectId', 'phase', 'proposalCount', 'attemptCount', 'activeProposal', 'activeAttempt', 'proposal', 'attempt', 'checkpoint', 'anchor', 'factory', 'encoder', 'verifier']);
  if (!allowed.has(method)) throw new Error('Unsupported read');
  return { kind: 'eth_call', method, transaction: transaction(interfaces.branch, branch, method, args) };
}
export function decodeRead(method, result) {
  return interfaces.branch.decodeFunctionResult(method, result);
}
export function decodePreview(result) {
  const [action, body] = interfaces.branch.decodeFunctionResult('bodyOf', result);
  const raw = getBytes(body);
  return { action, raw, bodyHash: keccak256(raw), byteLength: raw.length };
}

// Optional EIP-1193 read adapter. It deliberately exposes only eth_call: transaction submission,
// accounts, signing and chain switching are outside this package's authority.
export async function queryPrepared(provider, prepared, blockTag = 'latest') {
  if (!provider || typeof provider.request !== 'function') throw new Error('Expected an EIP-1193 read provider');
  if (!prepared || prepared.kind !== 'eth_call' || !prepared.transaction || typeof prepared.transaction.to !== 'string' || typeof prepared.transaction.data !== 'string') {
    throw new Error('Expected a prepared eth_call');
  }
  if (typeof blockTag !== 'string' && typeof blockTag !== 'number') throw new Error('Invalid block tag');
  const result = await provider.request({ method: 'eth_call', params: [prepared.transaction, blockTag] });
  if (typeof result !== 'string' || !isHexString(result)) throw new Error('Provider returned an invalid eth_call result');
  return result;
}
export async function queryState(provider, prepared, blockTag = 'latest') {
  if (!prepared || typeof prepared.method !== 'string') throw new Error('Expected a prepared state read');
  return decodeRead(prepared.method, await queryPrepared(provider, prepared, blockTag));
}
export async function queryPreview(provider, prepared, blockTag = 'latest') {
  return decodePreview(await queryPrepared(provider, prepared, blockTag));
}

export function decodeCheckpoint(log) {
  const parsed = interfaces.branch.parseLog(log);
  if (!parsed || parsed.name !== 'CheckpointWritten') throw new Error('Not a checkpoint log');
  const [revision, digest, encoded] = parsed.args;
  const decoded = coder.decode([ASSET_TYPE], encoded)[0];
  const witness = canonicalWitness(decoded.map(a => ({
    key: a.key, kind: Number(a.kind), name: a.name, path: a.path, fileHash: a.fileHash, mediaType: a.mediaType,
    size: a.size, submissionHash: a.submissionHash, producer: a.producer, jobId: a.jobId,
    resultHash: a.resultHash, revision: a.revision
  })));
  if (hexlify(coder.encode([ASSET_TYPE], [witness])) !== hexlify(encoded)) throw new Error('Noncanonical witness event');
  return { revision, digest, witness, assetsHash: witnessHash(witness) };
}

// Use supplied logs plus on-chain checkpoint reads; no mandatory indexer or ancestry traversal.
export function recoverHistory(branch, logs, checkpoints) {
  const expectedAddress = address(branch);
  const seen = new Set();
  return logs.map(log => {
    if (address(log.address) !== expectedAddress || log.removed) throw new Error('Wrong or removed log');
    const item = decodeCheckpoint(log);
    const key = item.revision.toString();
    if (seen.has(key)) throw new Error('Duplicate revision');
    seen.add(key);
    const cp = checkpoints[key];
    if (!cp || cp.digest.toLowerCase() !== item.digest.toLowerCase() || cp.assetsHash.toLowerCase() !== item.assetsHash) throw new Error('Unauthenticated checkpoint');
    return item;
  }).sort((a, b) => a.revision < b.revision ? -1 : a.revision > b.revision ? 1 : 0);
}

export function verifyManifest(raw, recordedHash) {
  if (!(raw instanceof Uint8Array) || keccak256(raw) !== hash(recordedHash)) throw new Error('Raw manifest digest mismatch');
  const manifest = strictJSON(raw);
  if (manifest.state !== 'completed') throw new Error('Incomplete result');
  identifier(manifest.jobId);
  identifier(manifest.projectId);
  if (!Array.isArray(manifest.files) || manifest.files.length !== 1) throw new Error('Expected exactly one declared file');
  const file = manifest.files[0];
  identifier(file.name);
  path(file.path);
  const kind = mime.indexOf(file.mediaType);
  if (kind < 0) throw new Error('Unsupported MIME');
  if ((kind === 0 && !file.path.endsWith('.md')) || (kind === 1 && file.path !== 'dist/index.html') || (kind === 2 && !file.path.endsWith('.png'))) throw new Error('Invalid output mapping');
  const bytes = unsignedJSONInteger(file.bytes, caps[kind]);
  if (!bytes) throw new Error('Empty file');
  const sha = hexDigest(file.hash, 'file');
  const submissionHash = hexDigest(file.submissionHash, 'submission');
  return { jobId: manifest.jobId, projectId: manifest.projectId, file: { name: file.name, path: file.path, hash: sha, mediaType: file.mediaType, bytes, submissionHash } };
}

export function verifyFile(descriptor, bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('Supply actual file bytes');
  if (!descriptor || typeof descriptor !== 'object') throw new Error('Supply a file descriptor');
  const size = BigInt(descriptor.bytes ?? descriptor.size);
  const kind = mime.indexOf(descriptor.mediaType);
  if (kind < 0 || bytes.length === 0 || bytes.length > caps[kind] || BigInt(bytes.length) !== size) throw new Error('File length or MIME limit');
  const expected = descriptor.hash ?? descriptor.fileHash;
  const actual = `0x${createHash('sha256').update(bytes).digest('hex')}`;
  if (actual !== hexDigest(expected, 'file')) throw new Error('File SHA-256 mismatch');
  if (kind === 2) {
    if (!Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw new Error('PNG signature mismatch');
  } else {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0')) throw new Error('Binary content in text file');
    if (kind === 1 && !/^\s*(?:<!doctype html>|<html\b)/iu.test(text)) throw new Error('HTML signature mismatch');
  }
  return { sha256: actual, bytes: bytes.length, mediaType: descriptor.mediaType, verified: true };
}

// Unknown transaction outcomes must be reconciled; this helper never constructs a new purchase.
export function reconcileTransaction({ receipt, phase }) {
  const statuses = new Set([0, 1, 0n, 1n, '0', '1', '0x0', '0x1']);
  if (!receipt || !statuses.has(receipt.status)) return { transaction: 'UNKNOWN', action: 'LOOK_UP_ORIGINAL_HASH', purchase: false };
  if (Number(receipt.status) === 0) return { transaction: 'REVERTED', action: 'REVIEW_BEFORE_NEW_TRANSACTION', purchase: false };
  if (!Number.isInteger(phase) || !PHASES[phase]) throw new Error('Supply current Branch phase');
  const callback = phase === 2 ? 'PENDING' : phase === 3 ? 'RESULT_RECORDED' : phase === 4 ? 'REFUSED' : phase === 5 ? 'FAILED' : 'NONE_OR_BOUND';
  return {
    transaction: 'MINED', admission: 'NOT_PROVEN_BY_TRANSACTION', execution: 'NOT_PROVEN_BY_TRANSACTION',
    callback, binding: phase === 3 ? 'REQUIRED' : 'READ_CHECKPOINT', file: 'VERIFY_BYTES_SEPARATELY',
    git: 'UNVERIFIED', publication: 'DISABLED', purchase: false
  };
}

// This intentionally reports observations, not conclusions a receipt cannot prove.  In
// particular, a mined purchase says nothing about Intake admission, execution, Git, or hosting.
export function lifecycleStatus({ receipt, phase, checkpointVerified = false, fileVerified = false, git = 'NOT_OBSERVED', publication = 'DISABLED' } = {}) {
  const transaction = !receipt || ![0, 1, 0n, 1n, '0', '1', '0x0', '0x1'].includes(receipt.status)
    ? 'UNKNOWN'
    : Number(receipt.status) === 0 ? 'REVERTED' : 'MINED';
  let callback = 'NOT_OBSERVED';
  let binding = 'NOT_READY';
  if (Number.isInteger(phase) && PHASES[phase]) {
    callback = ['NOT_OBSERVED', 'IN_FLIGHT', 'PENDING', 'RESULT_RECORDED', 'REFUSED', 'FROZEN'][phase];
    binding = phase === 3 ? 'REQUIRED' : phase === 0 && checkpointVerified ? 'VERIFIED' : phase === 0 ? 'CHECKPOINT_NOT_VERIFIED' : 'NOT_READY';
  }
  if (!['NOT_OBSERVED', 'VERIFIED', 'FAILED', 'UNVERIFIED'].includes(git)) throw new Error('Invalid Git observation');
  if (!['DISABLED', 'NOT_OBSERVED', 'VERIFIED', 'FAILED', 'UNVERIFIED'].includes(publication)) throw new Error('Invalid publication observation');
  return Object.freeze({
    transaction,
    admission: transaction === 'MINED' ? 'NOT_PROVEN_BY_TRANSACTION' : 'NOT_OBSERVED',
    execution: 'NOT_PROVEN_BY_TRANSACTION',
    callback,
    binding,
    file: fileVerified ? 'VERIFIED' : 'NOT_CHECKED',
    git,
    publication,
    automaticPurchase: 'NEVER'
  });
}

export { strictJSON, unsignedJSONInteger };
