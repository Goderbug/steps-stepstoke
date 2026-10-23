import { afterEach, describe, expect, it, vi } from "vitest";
import { ChainAdapter, FINALLY_FAILED, type Journal, type LocalConfig } from "../../src/domain/chainAdapter";
import { deployment, sdk } from "../../src/domain/sdk";
import config from "../fixtures/local-config.json";
import { isLatestAttempt } from "../../src/ui/recovery";
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as `0x${string}`;
const account = `0x${"11".repeat(20)}` as `0x${string}`, branch = `0x${"44".repeat(20)}` as `0x${string}`;
function adapter(rpc: (m: string, p: any[]) => any) {
  const a = new ChainAdapter({ ...config, kind: "ETHEREUM_DEPLOYMENT", chainId: 1, deploymentBlock: 100, rpcURL: "https://rpc.example.test/", evidence: {}, handoff: { version: 1, launchId: "UNIT_TEST_ONLY", sourceCommit: "b".repeat(40), chainId: 1, contracts: ["Encoder", "Verifier", "Factory"].map(name => ({ name: `Relay${name}`, address: (config.contracts as any)[name.toLowerCase()], abiHash: "c".repeat(64), abiPath: `abi/Relay${name}.json` })), attestationHash: "a".repeat(64), assets: ["index.html", "deployment-evidence.json", ...["Encoder", "Verifier", "Factory"].map(name => `abi/Relay${name}.json`)].map(path => ({ path, sha256: "c".repeat(64) })) } } as LocalConfig, async () => null);
  a.provider.request = vi.fn(async ({method,params=[]}) => rpc(method,params)); return a;
}
const journal = (identity: string): Journal => ({ identity, hash: hash(0xa1), account, nonce: 7, chainId: 1, operation: "retry", branch, proposalId: `${branch}:1`, to: branch, data: "0xbeef", state: "SUBMITTED", at: "2026-10-21T00:00:00Z" });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
describe("reopened boundary regressions", () => {
  it("revokes verified public reads if the RPC changes chain", async () => {
    const a = adapter(m => m === "eth_chainId" ? "0x7a69" : m === "eth_call" ? hash(0) : null);
    // Only the initial provenance check is isolated; post-verification reads use the real code.
    const initial = vi.spyOn(deployment, "verifyDeploymentConfig").mockResolvedValueOnce([]);
    await a.verify(); initial.mockRestore(); expect(a.capabilities.read).toBe(true);
    const cache = (a as any).logCache;
    cache.rows.set("previous", { logs: ["stale"] });
    const unavailable = vi.fn(); a.onUnavailable(unavailable);
    await expect(a.listBranches()).rejects.toThrow(/Wrong chain/);
    expect(a.capabilities.read).toBe(false);
    expect(unavailable).toHaveBeenCalledOnce();
    expect((a as any).logCache).not.toBe(cache);
    expect((a as any).logCache.rows.size).toBe(0);
    expect(a.status().state).toBe("A1_INTEGRATION_PENDING");
    await expect(a.getBranch(branch)).rejects.toThrow(/Wrong chain/);
    expect(a.provider.request).not.toHaveBeenCalledWith(expect.objectContaining({ method: "eth_call" }));
    // A working RPC alone does not silently resurrect an invalidated deployment.
    const restored = vi.spyOn(deployment, "verifyDeploymentConfig").mockResolvedValue([]);
    await expect(a.listBranches()).rejects.toThrow(/Wrong chain/);
    expect(restored).not.toHaveBeenCalled();
    await a.verify(); expect(a.capabilities.read).toBe(true);
    expect(await a.listBranches()).toEqual([]);
  });
  it.each(["Factory code mismatch", "Deployment receipt/block mismatch", "RPC HTTP 503"])("revokes prior verification on %s at an existing-project boundary", async problem => {
    const a = adapter(() => null);
    vi.spyOn(deployment, "verifyDeploymentConfig").mockResolvedValueOnce([]).mockResolvedValue([problem]);
    await a.verify();
    await expect(a.getHistory(branch)).rejects.toThrow(problem);
    expect(a.capabilities.read).toBe(false);
    expect(a.capabilities.realWalletSigning).toBe(false);
    expect(a.provider.request).not.toHaveBeenCalled();
  });
  it("retains the original hash in a successful same-call replacement attempt", async () => {
    const a = adapter(m => m === "eth_blockNumber" ? "0xc8" : m === "eth_getTransactionByHash" ? { from: account, nonce: "0x7", to: branch, input: "0xbeef" } : m === "eth_getTransactionReceipt" ? { transactionHash: hash(0xb2), blockNumber: "0x96", blockHash: hash(150), status: "0x1" } : m === "eth_getBlockByNumber" ? { number: "0x96", hash: hash(150) } : null);
    (a as any).checkBranch = vi.fn(async () => {});
    (a as any).read = vi.fn(async (_b: string, m: string) => m === "attempt" ? { requestId: hash(3), proposalId: 1n, sponsor: account, fee: 5n, delivered: false, status: 0n } : 1n);
    (a as any).logs = vi.fn(async () => [{ parsed: { name: "Purchased", args: { attempt: 1n, requestId: hash(3) } }, transactionHash: hash(0xb2), blockNumber: "0x96" }]);
    (a as any).time = vi.fn(async () => "2026-10-21T00:00:00Z");
    localStorage.setItem("relay.local.transactions.v1", JSON.stringify([journal(a.identity)]));
    (a as any).memory.set(hash(0xa1), journal(a.identity));
    const rows = await a.getSponsorships(branch);
    expect(rows).toHaveLength(1); expect(rows[0].txHash).toBe(hash(0xa1));
    expect((rows[0] as any).replacementHash).toBe(hash(0xb2));
    expect(rows[0].replacementState).toBe("CONFIRMED");
    expect(rows[0].stages.purchase).toBe("confirmed");
  });
  it("keeps a one-confirmation cancellation unresolved", async () => {
    const replacement = { hash: hash(0xb2), from: account, nonce: "0x7", to: account, input: "0x" };
    const receipt = { transactionHash: replacement.hash, blockNumber: "0xc8", blockHash: hash(200), status: "0x1" };
    const a = adapter((m,p) => m === "eth_getTransactionReceipt" ? (p[0] === replacement.hash ? receipt : null) : m === "eth_getTransactionByHash" ? null : m === "eth_getTransactionCount" ? "0x8" : m === "eth_blockNumber" ? "0xc8" : m === "eth_getBlockByNumber" ? { number: p[0], hash: hash(Number(BigInt(p[0]))), transactions: [replacement] } : null);
    expect((await sdk.observeTransaction(a.provider, replacement.hash)).state).toBe("MINED_UNFINALIZED");
    const j = journal(a.identity); localStorage.setItem("relay.local.transactions.v1", JSON.stringify([j]));
    expect(FINALLY_FAILED).not.toContain(await a.reconcileJournal(j));
    await expect(a.unresolvedPurchase(branch, { address: account, chainId: 1, label: "Local test account" })).rejects.toThrow(/reconcile first/);
  });
  it("does not duplicate an authenticated purchase when a journal hash uses uppercase hex", async () => {
    const mined = hash(0xb2), original = `0x${mined.slice(2).toUpperCase()}` as `0x${string}`;
    const a = adapter(m => m === "eth_blockNumber" ? "0xc8" : m === "eth_getTransactionByHash" ? { from: account, nonce: "0x7", to: branch, input: "0xbeef" } : m === "eth_getTransactionReceipt" ? { transactionHash: mined, blockNumber: "0x96", blockHash: hash(150), status: "0x1" } : m === "eth_getBlockByNumber" ? { number: "0x96", hash: hash(150) } : null);
    (a as any).checkBranch = vi.fn(async () => {});
    (a as any).read = vi.fn(async (_b: string, m: string) => m === "attempt" ? { requestId: hash(3), proposalId: 1n, sponsor: account, fee: 5n, delivered: false, status: 0n } : 1n);
    (a as any).logs = vi.fn(async () => [{ parsed: { name: "Purchased", args: { attempt: 1n, requestId: hash(3) } }, transactionHash: mined, blockNumber: "0x96" }]);
    (a as any).time = vi.fn(async () => "2026-10-21T00:00:00Z");
    localStorage.setItem("relay.local.transactions.v1", JSON.stringify([{...journal(a.identity),hash:original}]));
    const rows = await a.getSponsorships(branch);
    expect(rows).toHaveLength(1); expect(rows[0].txHash?.toLowerCase()).toBe(original.toLowerCase());
  });
  it.each([
    [200, true, true, "0x1", "REPLACED_MINED_UNFINALIZED", false],
    [210, true, true, "0x0", "REPLACED_MINED_UNFINALIZED", false],
    [211, true, true, "0x1", "REPLACED_OTHER", true],
    [211, true, true, "0x0", "REPLACED_OTHER", true],
    [211, false, true, "0x1", "REPLACED_REORGED", false],
    [211, true, false, "0x1", "REPLACED_PENDING_OR_UNKNOWN", false],
  ])("observes cancellation at head %i (canonical %s, receipt %s, status %s) before unblocking", async (head, canonical, available, status, expected, final) => {
    const replacement = { hash: hash(0xb2), from: account, nonce: "0x7", to: account, input: "0x" };
    const receipt = { transactionHash: replacement.hash, blockNumber: "0xc8", blockHash: hash(200), status };
    const a = adapter((m,p) => m === "eth_getTransactionReceipt" ? (p[0] === replacement.hash && available ? receipt : null) : m === "eth_getTransactionByHash" ? { from: account, nonce: "0x6", to: branch, input: "0xbeef" } : m === "eth_getTransactionCount" ? "0x8" : m === "eth_blockNumber" ? `0x${Number(head).toString(16)}` : m === "eth_getBlockByNumber" ? { number: p[0], hash: hash(canonical ? Number(BigInt(p[0])) : 999), transactions: Number(BigInt(p[0])) === 200 ? [replacement] : [] } : null);
    // The original dropped transaction is unknown; the older authenticated purchase is known.
    const rpc = a.provider.request;
    a.provider.request = vi.fn(async r => r.method === "eth_getTransactionByHash" && r.params?.[0] === hash(0xa1) ? null : rpc(r));
    (a as any).checkBranch = vi.fn(async () => {});
    (a as any).read = vi.fn(async (_b: string, m: string) => m === "attempt" ? { requestId: hash(3), proposalId: 1n, sponsor: account, fee: 5n, delivered: true, status: 1n } : m === "phase" ? 4n : 1n);
    (a as any).logs = vi.fn(async () => [{ parsed: { name: "Purchased", args: { attempt: 1n, requestId: hash(3) } }, transactionHash: hash(9), blockNumber: "0x96" }]);
    (a as any).time = vi.fn(async () => "2026-10-21T00:00:00Z");
    const j = journal(a.identity); localStorage.setItem("relay.local.transactions.v1", JSON.stringify([j]));
    expect(await a.reconcileJournal(j)).toBe(expected);
    const rows = await a.getSponsorships(branch);
    expect(rows).toHaveLength(2);
    expect(rows[0].stages.callback).toBe("refused");
    expect(rows[1].txHash).toBe(j.hash); expect(rows[1].replacementHash).toBe(replacement.hash);
    expect(rows[1].stages.callback).toBe("not_started");
    expect(isLatestAttempt(rows, rows[0])).toBe(final);
    const prepare = a.unresolvedPurchase(branch, { address: account, chainId: 1, label: "Local test account" });
    if (final) await expect(prepare).resolves.toBeUndefined();
    else await expect(prepare).rejects.toThrow(/reconcile first/);
  });
});
