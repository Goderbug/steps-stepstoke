// STEPS deploy-v2 repair, 2026-10-28. ABI-changing; not a drop-in v1 adapter.
// Browser-safe: no fs, Buffer, wallet secret, or implicit transaction submission.
import { keccak256, toHex, decodeEventLog, encodeFunctionData, sha256 } from "viem";
import { STEPS_BRANCH_V2_ABI } from "./steps-branch-v2.abi.mjs";
export { STEPS_BRANCH_V2_ABI };

export const ACTION = "job.open@job-1";
export const MAX_SNAPSHOT_BYTES = 4096;
export const ZERO_HASH = `0x${"0".repeat(64)}`;
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const bytesOf = (value) => {
  if (!(value instanceof Uint8Array)) throw new TypeError("Expected Uint8Array bytes");
  return value;
};
const hashOf = (value) => {
  if (!hashPattern.test(value ?? "")) throw new TypeError("Expected a 32-byte hash");
  return value.toLowerCase();
};
const idOf = (value) => {
  if (value === undefined || value === null || (typeof value === "number" && !Number.isSafeInteger(value))) throw new TypeError("Explicit integer required");
  const n = BigInt(value);
  if (n < 0n) throw new RangeError("Negative integer");
  return n;
};

/** Preserve all explicit IMD inputs, including source/repo/baseCommit and file inputs.
 * Always run the official free /requests/check before paying. JSON validity alone is not admission.
 */
export function jobBody(input) {
  if (!input || typeof input.objective !== "string" || !input.objective.trim()) throw new Error("A nonempty objective is required");
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  if (bytes.length > 16 * 1024) throw new Error("Request body exceeds 16 KiB");
  sameChainBody(bytes);
  return bytes;
}
function sameChainBody(body) {
  const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytesOf(body)));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error("Request body must be an object");
  if (Object.hasOwn(data, 'deliver')) throw new Error("Cross-chain deliver is unsupported by this ledger");
}
export const bodyHash = (body) => keccak256(bytesOf(body));

/** Display the objective from the committed body, never an independently supplied label. */
export function instructionFromBody(body, expectedHash) {
  if (bodyHash(body).toLowerCase() !== hashOf(expectedHash)) throw new Error("Proposal body hash mismatch");
  const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  if (typeof data.objective !== "string" || !data.objective.trim()) throw new Error("Invalid objective");
  return data.objective;
}

export function encodePropose({ branchId, anchor, body }) {
  sameChainBody(body);
  return encodeFunctionData({ abi: STEPS_BRANCH_V2_ABI, functionName: "propose", args: [idOf(branchId), hashOf(anchor), toHex(bytesOf(body))] });
}
export function encodeFund({ proposalId, body, maxPayment }) {
  sameChainBody(body);
  return encodeFunctionData({ abi: STEPS_BRANCH_V2_ABI, functionName: "fundWithPayment", args: [idOf(proposalId), toHex(bytesOf(body)), idOf(maxPayment)] });
}

/** A fork returns a new logical branch id, NOT a newly delivered checkpoint.
 * Optional resultBytes stores authenticated result.json (at most 4 KiB), not its referenced files.
 */
export function encodeFork({ parentId, resultBytes, paths, hashes, contents }) {
  if (paths !== undefined || hashes !== undefined || contents !== undefined) throw new Error("Legacy file-copy fork is unsupported; use a reference fork or exact result snapshot");
  if (resultBytes !== undefined && bytesOf(resultBytes).length > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot exceeds 4 KiB; use a reference fork");
  return resultBytes === undefined
    ? encodeFunctionData({ abi: STEPS_BRANCH_V2_ABI, functionName: "fork", args: [idOf(parentId)] })
    : encodeFunctionData({ abi: STEPS_BRANCH_V2_ABI, functionName: "forkWithSnapshot", args: [idOf(parentId), toHex(bytesOf(resultBytes))] });
}
export function encodeForkFromOrigin() {
  return encodeFunctionData({ abi: STEPS_BRANCH_V2_ABI, functionName: "forkFromOrigin" });
}

/** Stops local waiting after the onchain deadline; does not cancel or refund an IMD job. */
export function encodeExpirePending({ proposalId }) {
  return encodeFunctionData({ abi: STEPS_BRANCH_V2_ABI, functionName: "expirePending", args: [idOf(proposalId)] });
}
export function encodeReadSnapshot({ branchId }) {
  return encodeFunctionData({ abi: STEPS_BRANCH_V2_ABI, functionName: "snapshotOf", args: [idOf(branchId)] });
}
export function encodeReadLateReceipt({ proposalId }) {
  return encodeFunctionData({ abi: STEPS_BRANCH_V2_ABI, functionName: "lateReceiptOf", args: [idOf(proposalId)] });
}

/** Supply a decoded lateReceiptOf tuple. An absent receipt's default 0 is not success. */
export function lateReceiptState(receipt) {
  if (!Array.isArray(receipt) || receipt.length !== 5 || typeof receipt[0] !== 'boolean') throw new Error("Invalid late receipt");
  if (!receipt[0]) return 'awaiting';
  const states = ['succeeded', 'refused', 'failed'];
  const status = Number(receipt[1]);
  if (!Number.isInteger(status) || !states[status]) throw new Error("Invalid late receipt status");
  return states[status];
}

/** Filter receipt logs by the exact expected ledger address before trusting their shape. */
export function decodeBranchLogs(logs, expectedAddress) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(expectedAddress ?? "")) throw new Error("Expected ledger address required");
  const out = { proposed: [], funded: [], checkpoints: [], failures: [], forked: [], snapshots: [], expired: [], lateResults: [], lateFailures: [], uriOmissions: [] };
  const kinds = { Proposed: "proposed", Funded: "funded", CheckpointRecorded: "checkpoints", FailureRecorded: "failures", Forked: "forked", SnapshotCopied: "snapshots", PendingExpired: "expired", LateResultRecorded: "lateResults", LateFailureRecorded: "lateFailures", UriOmitted: "uriOmissions" };
  for (const log of logs) {
    if (log.removed || log.address?.toLowerCase() !== expectedAddress.toLowerCase()) continue;
    try {
      const { eventName, args } = decodeEventLog({ abi: STEPS_BRANCH_V2_ABI, data: log.data, topics: log.topics, strict: true });
      if (kinds[eventName]) out[kinds[eventName]].push(args);
    } catch { /* Unrelated or malformed logs are not evidence. */ }
  }
  return out;
}

export function proposalState(status) {
  const states = ["draft", "pending", "succeeded", "refused", "failed", "expired"];
  const n = Number(status);
  if (!Number.isInteger(n) || !states[n]) throw new Error("Unknown proposal status");
  return states[n];
}

/** Pin URI bytes to the checkpoint. An omitted long URI must be recovered from Intake's event. */
export function verifyResultUri(uri, expectedUriHash) {
  if (typeof uri !== "string" || !uri) throw new Error("Result URI unavailable; inspect the matching Intake Completed event");
  if (keccak256(new TextEncoder().encode(uri)).toLowerCase() !== hashOf(expectedUriHash)) throw new Error("Result URI hash mismatch");
  return uri;
}

/** Decode only after checking the exact result bytes against the onchain commitment. */
export function decodeResult(bytes, expectedHash) {
  const resultHash = keccak256(bytesOf(bytes));
  if (resultHash.toLowerCase() !== hashOf(expectedHash)) throw new Error("Result hash mismatch");
  const doc = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) throw new Error("Invalid result document");
  if (doc.files !== undefined && !Array.isArray(doc.files)) throw new Error("Invalid file list");
  return {
    resultHash,
    jobId: typeof doc.jobId === "string" ? doc.jobId : null,
    state: doc.state ?? null, launch: doc.launch ?? null, delivery: doc.delivery ?? null,
    files: (doc.files ?? []).map((f) => ({ name: f.name, path: f.path, mediaType: f.mediaType, bytes: f.bytes, sha256: f.hash, url: f.url ?? null })),
  };
}

/** Fetch a verified locator with a bounded stream. IPFS gateway trust is reduced by hashing. */
export async function readResult(uri, expectedHash, expectedUriHash, fetchImpl = fetch, { maxBytes = 8 * 1024 * 1024, timeoutMs = 15000 } = {}) {
  verifyResultUri(uri, expectedUriHash);
  hashOf(expectedHash);
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || !Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Invalid fetch bounds");
  const url = uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
  if (!/^https:\/\//.test(url)) throw new Error("Unsupported result URI scheme");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, credentials: "omit", redirect: "error" });
    if (!res.ok) throw new Error(`Result unavailable: ${res.status}`);
    if (Number(res.headers.get("content-length")) > maxBytes) throw new Error("Result too large");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("Result body unavailable");
    const chunks = []; let total = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) { await reader.cancel(); throw new Error("Result too large"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return { ...decodeResult(bytes, expectedHash), bytes };
  } finally { clearTimeout(timeout); }
}

/** This checks a file against an already authenticated result descriptor. */
export async function verifyFile(file, bytes) {
  const expected = String(file.sha256 ?? "").replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected) || !Number.isSafeInteger(file.bytes) || file.bytes < 0) return false;
  return bytesOf(bytes).length === file.bytes && sha256(bytes).slice(2).toLowerCase() === expected;
}
