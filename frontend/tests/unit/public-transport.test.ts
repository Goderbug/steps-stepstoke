// Mocked public-transport regressions for the Ethereum (chain 1) web path. Every transport here is
// an in-memory stub: no public RPC, gateway, wallet or deployment is contacted. These tests prove
// fail-closed handling of the transport, not live compatibility (liveCompatibility stays NOT_RUN).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { keccak256 } from "ethers";
import { ChainAdapter, FINALLY_FAILED, loadJournal, mergeJournal, type Journal, type LocalConfig } from "../../src/domain/chainAdapter";
import { probePublicDeployment, PUBLIC_FACTS } from "../../src/domain/publicMode";
import { isLatestAttempt } from "../../src/ui/recovery";
import { sdk, deployment, release } from "../../src/domain/sdk";
import config from "../../public/local-config.json";
import { DEMO_ACCOUNTS } from "../../src/domain/fixtureAdapter";
import { STAGES, type Sponsorship } from "../../src/domain/types";

const enc = new TextEncoder();
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const NAMES = ["RelayEncoder", "RelayVerifier", "RelayFactory"];
const ADDR = { RelayEncoder: "0x" + "11".repeat(20), RelayVerifier: "0x" + "22".repeat(20), RelayFactory: "0x" + "33".repeat(20) } as Record<string, string>;
const hex64 = (n: number) => "0x" + n.toString(16).padStart(64, "0");
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

/** A complete, internally consistent handoff export served from memory. */
function exportFiles(over: { abiTamper?: boolean; assetTamper?: boolean; evidence?: object } = {}) {
  const files = new Map<string, Uint8Array>();
  const abis: Record<string, unknown[]> = {};
  for (const n of NAMES) { abis[n] = [{ type: "function", name: n, inputs: [], outputs: [] }]; files.set(`abi/${n}.json`, enc.encode(JSON.stringify(abis[n]))); }
  files.set("index.html", enc.encode("<!doctype html><title>STEPS</title>"));
  const h: any = { version: 1, launchId: "UNIT_TEST_ONLY", chainId: 1, sourceCommit: "a".repeat(40), attestationHash: "b".repeat(64),
    contracts: NAMES.map(name => ({ name, address: ADDR[name], abiHash: sdk.abiHash(abis[name]), abiPath: `abi/${name}.json` })) };
  files.set("deployment-evidence.json", enc.encode(JSON.stringify(over.evidence ?? { sourceCommit: h.sourceCommit, attestationHash: h.attestationHash, blockNumber: 100 })));
  if (over.abiTamper) { const t = enc.encode(JSON.stringify([{ type: "function", name: "other", inputs: [], outputs: [] }])); files.set("abi/RelayFactory.json", t); }
  h.assets = [...files].map(([path, b]) => ({ path, sha256: sha(b) }));
  if (over.assetTamper) files.set("index.html", enc.encode("<!doctype html><title>Tampered</title>"));
  files.set("imd-deployment.json", enc.encode(JSON.stringify(h)));
  return { files, h };
}
const serve = (files: Map<string, Uint8Array>, patch: (path: string, r: Response) => any = (_p, r) => r) =>
  vi.fn(async (url: string, init?: RequestInit) => {
    expect(init?.redirect).toBe("error"); expect(init?.credentials).toBe("omit");
    const path = String(url).replace(/^\.\//, ""); const b = files.get(path);
    return patch(path, b ? new Response(b as BodyInit) : new Response("not found", { status: 404 }));
  });

describe("public deployment handoff transport", () => {
  it("reports an undeployed candidate honestly when no handoff is exported", async () => {
    expect(await probePublicDeployment(serve(new Map()) as unknown as typeof fetch)).toEqual({ state: "undeployed", reason: "Confirmed deployment handoff unavailable" });
    expect(PUBLIC_FACTS).toMatchObject({ chainId: 1, paymentToken: "IMD", productionDeployment: null, liveCompatibility: "NOT_RUN", productionReady: false });
    expect(PUBLIC_FACTS.imd).toBe(release.imd);
  });
  it("treats a CORS/network failure as unavailable and a redirect as refused, never as a deployment", async () => {
    expect((await probePublicDeployment(vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch)).state).toBe("undeployed");
    const { files } = exportFiles();
    const redirected = serve(files, (_p, r) => ({ ok: true, redirected: true, body: r.body }));
    expect((await probePublicDeployment(redirected as unknown as typeof fetch)).state).toBe("undeployed");
  });
  it("accepts only a digest-consistent handoff and derives the deployment identity from it", async () => {
    const { files, h } = exportFiles();
    const probe = await probePublicDeployment(serve(files) as unknown as typeof fetch);
    expect(probe).toEqual({ state: "handoff", identity: `public:1:${ADDR.RelayFactory}:${h.attestationHash}`, factory: ADDR.RelayFactory, deploymentBlock: 100 });
  });
  it.each([
    ["tampered inventoried asset", { assetTamper: true }, "Asset bytes mismatch: index.html"],
    ["ABI/manifest digest mismatch", { abiTamper: true }, "ABI hash mismatch: RelayFactory"],
    ["evidence from another handoff", { evidence: { sourceCommit: "c".repeat(40), attestationHash: "b".repeat(64), blockNumber: 1 } }, "Evidence belongs to a different handoff"],
  ])("disables the deployment on %s", async (_n, over, reason) => {
    const { files } = exportFiles(over);
    expect(await probePublicDeployment(serve(files) as unknown as typeof fetch)).toEqual({ state: "rejected", reason });
  });
  it("rejects a wrong-chain handoff and an oversize export asset", async () => {
    const { files, h } = exportFiles();
    files.set("imd-deployment.json", enc.encode(JSON.stringify({ ...h, chainId: 11155111 })));
    expect(await probePublicDeployment(serve(files) as unknown as typeof fetch)).toEqual({ state: "rejected", reason: "Invalid Ethereum workflow handoff identity" });
    const big = exportFiles().files; big.set("index.html", new Uint8Array(8 * 1024 * 1024 + 1));
    expect(await probePublicDeployment(serve(big) as unknown as typeof fetch)).toEqual({ state: "rejected", reason: "Export asset too large" });
  });
});

/** Chain 1 adapter over an in-memory RPC. Verification is never stubbed to pass here. */
function publicAdapter(rpc: (method: string, params: any[]) => any, wallet: any = null) {
  const { h } = exportFiles();
  const c = { ...config, kind: "ETHEREUM_DEPLOYMENT", chainId: 1, deploymentBlock: 100, rpcURL: "https://rpc.example.test/", handoff: h,
    evidence: { sourceCommit: h.sourceCommit, attestationHash: h.attestationHash, blockNumber: 100, transactionHash: hex64(1), blockHash: hex64(2), build: release.frozenBuild },
    contracts: { ...config.contracts, factory: ADDR.RelayFactory, encoder: ADDR.RelayEncoder, verifier: ADDR.RelayVerifier } } as LocalConfig;
  const a = new ChainAdapter(c, async () => wallet);
  (a as any).provider.request = vi.fn(async ({ method, params = [] }: any) => rpc(method, params));
  return a;
}

describe("public chain configuration", () => {
  it("refuses non-mainnet, non-HTTPS and loopback public configurations before any read", () => {
    expect(() => publicAdapter(() => null)).not.toThrow();
    const base = { ...config, kind: "ETHEREUM_DEPLOYMENT", chainId: 1, deploymentBlock: 100, handoff: exportFiles().h } as LocalConfig;
    expect(() => new ChainAdapter({ ...base, chainId: 11155111 }, async () => null)).toThrow("confirmed Ethereum");
    expect(() => new ChainAdapter({ ...base, rpcURL: "http://rpc.example.test/" }, async () => null)).toThrow("credential-free HTTPS");
    expect(() => new ChainAdapter({ ...base, rpcURL: "https://127.0.0.1:8545/" }, async () => null)).toThrow("credential-free HTTPS");
  });
  it("disables the deployment when the RPC reports another chain (no implicit switch)", async () => {
    const a = publicAdapter(m => m === "eth_chainId" ? "0xaa36a7" : null);
    await expect(a.verify()).rejects.toThrow("Wrong chain; no implicit switch");
    expect(a.capabilities.read).toBe(false);
  });
  it("disables a stale configuration whose receipt no longer matches the handoff", async () => {
    const a = publicAdapter(m => m === "eth_chainId" ? "0x1" : m === "eth_getTransactionReceipt" ? { transactionHash: hex64(1), status: "0x1", blockNumber: "0x64", blockHash: hex64(9) } : m === "eth_getBlockByNumber" ? { hash: hex64(9), number: "0x64", transactions: [hex64(1)] } : null);
    await expect(a.verify()).rejects.toThrow("Deployment receipt/block mismatch");
    expect(a.capabilities.realWalletSigning).toBe(false);
  });
  it("rejects wrong runtime code for a named contract", () => {
    expect(() => deployment.verifyRuntime("0x00", "RelayFactory", release)).toThrow("RelayFactory runtime size mismatch");
    const spec = (release as any).runtimeChecks.RelayFactory;
    expect(() => deployment.verifyRuntime("0x" + "00".repeat(spec.bytes), "RelayFactory", release)).toThrow(/RelayFactory (runtime code mismatch|inconsistent immutable)/);
  });
  it("propagates RPC errors instead of rendering an empty project list", async () => {
    const a = publicAdapter(m => { if (m === "eth_call") throw new Error("eth_call: upstream unavailable"); return null; });
    await expect(a.listBranches()).rejects.toThrow("upstream unavailable");
  });
});

describe("bounded event observation", () => {
  const chain = (head: number, hashOf = (n: number) => hex64(1000 + n)) => {
    const calls: string[] = [];
    const provider = { request: vi.fn(async ({ method, params }: any) => {
      calls.push(method);
      if (method === "eth_blockNumber") return "0x" + head.toString(16);
      if (method === "eth_getBlockByNumber") { const n = Number(BigInt(params[0])); return { number: params[0], hash: hashOf(n) }; }
      if (method === "eth_getLogs") { const from = Number(BigInt(params[0].fromBlock)); return [{ blockNumber: params[0].fromBlock, logIndex: "0x0", removed: false, data: "0x", topics: [], from }, { blockNumber: params[0].fromBlock, logIndex: "0x1", removed: true, data: "0x", topics: [] }]; }
      throw new Error("unexpected " + method);
    }) };
    return { provider, calls };
  };
  it("pages history in bounded windows and reports incomplete catch-up", async () => {
    const { provider } = chain(25);
    const cache = new sdk.EventLogCache({ identity: "public:1:a", deploymentBlock: 0, maxBlocksPerRead: 10 });
    const first = await cache.read(provider, ADDR.RelayFactory);
    expect(first).toMatchObject({ complete: false, cursor: 9, head: 25 });
    expect(first.logs).toHaveLength(1); // removed logs are dropped
    expect((await cache.read(provider, ADDR.RelayFactory)).cursor).toBe(19);
    expect(await cache.read(provider, ADDR.RelayFactory)).toMatchObject({ complete: true, cursor: 25 });
  });
  it("refuses a page whose boundary block changed during the read (reorg)", async () => {
    let n = 0;
    const { provider } = chain(5, () => hex64(++n));
    const cache = new sdk.EventLogCache({ identity: "public:1:b", deploymentBlock: 0 });
    await expect(cache.read(provider, ADDR.RelayFactory)).rejects.toThrow("Reorg during log observation");
  });
  it("discards a cached cursor whose block hash was reorganised and rereads from deployment", async () => {
    let fork = 0;
    const { provider, calls } = chain(5, b => hex64(b + fork));
    const cache = new sdk.EventLogCache({ identity: "public:1:c", deploymentBlock: 0 });
    await cache.read(provider, ADDR.RelayFactory);
    fork = 77; calls.length = 0;
    const again = await cache.read(provider, ADDR.RelayFactory);
    expect(again.cursor).toBe(5);
    expect(provider.request.mock.calls.filter(([r]: any) => r.method === "eth_getLogs").at(-1)![0].params[0].fromBlock).toBe("0x0");
  });
  it("does not poison the cache after an RPC error", async () => {
    const { provider } = chain(3);
    const real = provider.request.getMockImplementation()!;
    provider.request.mockImplementationOnce(async () => { throw new Error("RPC HTTP 503"); });
    const cache = new sdk.EventLogCache({ identity: "public:1:d", deploymentBlock: 0 });
    await expect(cache.read(provider, ADDR.RelayFactory)).rejects.toThrow("RPC HTTP 503");
    provider.request.mockImplementation(real);
    expect((await cache.read(provider, ADDR.RelayFactory)).complete).toBe(true);
  });
});

describe("transaction observation and recovery", () => {
  const H = hex64(0xabc);
  const obs = (receipt: any, blockHash = hex64(5), head = 200) => sdk.observeTransaction({ request: async ({ method }: any) =>
    method === "eth_getTransactionReceipt" ? receipt : method === "eth_blockNumber" ? "0x" + head.toString(16) : { number: "0x64", hash: blockHash } }, H);
  it("maps confirmations, reorgs and unknown receipts without settling state", async () => {
    expect(await obs(null)).toMatchObject({ state: "PENDING_OR_UNKNOWN", settlement: false });
    const r = { transactionHash: H, blockNumber: "0x64", blockHash: hex64(5), status: "0x1" };
    expect(await obs(r, hex64(6))).toMatchObject({ state: "REORGED", settlement: false });
    expect(await obs(r, hex64(5), 105)).toMatchObject({ state: "MINED_UNFINALIZED", confirmations: 6, required: 12 });
    expect(await obs(r)).toMatchObject({ state: "CONFIRMED", settlement: false });
    expect(await obs({ ...r, status: "0x0" })).toMatchObject({ state: "REVERTED" });
    await expect(obs({ ...r, transactionHash: hex64(1) })).rejects.toThrow("Receipt hash mismatch");
  });

  const account = DEMO_ACCOUNTS[0].address;
  const j = (over: Partial<Journal> = {}): Journal => ({ identity: "", hash: hex64(0xa1) as any, nonce: 7, account: account as any, chainId: 1, operation: "retry", branch: "0x" + "44".repeat(20), proposalId: "p", data: "0xbeef", to: "0x" + "44".repeat(20), state: "SUBMITTED", at: "2026-10-21T00:00:00Z", ...over });
  const recovering = (replacement: any, replacementReceipt: any = null, extra: Record<string, any> = {}) => publicAdapter((m, p) => {
    if (m in extra) return extra[m];
    if (m === "eth_getTransactionReceipt") return p[0] === replacement?.hash ? replacementReceipt : null;
    if (m === "eth_getTransactionByHash") return null;
    if (m === "eth_getTransactionCount") return "0x8";
    if (m === "eth_blockNumber") return "0xc8";
    if (m === "eth_getBlockByNumber") return { number: p[0], hash: hex64(Number(BigInt(p[0]))), transactions: Number(BigInt(p[0])) === 150 && replacement ? [replacement] : [] };
    return null;
  });
  it("reports replacement and unknown outcomes against the original hash", async () => {
    const same = { hash: hex64(0xb2), from: account, nonce: "0x7", to: "0x" + "44".repeat(20), input: "0xbeef" };
    expect(await recovering({ ...same, input: "0xdead" }).reconcileJournal(j())).toBe("REPLACED_OTHER");
    expect(await recovering(same, null).reconcileJournal(j())).toBe("REPLACED_SAME_CALL_READ_CHAIN");
    const reverted = { transactionHash: same.hash, blockNumber: "0x96", blockHash: hex64(150), status: "0x0" };
    expect(await recovering(same, reverted).reconcileJournal(j())).toBe("REPLACED_SAME_CALL_REVERTED");
    expect(await recovering(same, { ...reverted, status: "0x1" }).reconcileJournal(j())).toBe("REPLACED_SAME_CALL_READ_CHAIN");
    expect(await recovering(null).reconcileJournal(j())).toBe("NONCE_USED_UNKNOWN");
    expect(await recovering(null, null, { eth_getTransactionCount: "0x7" }).reconcileJournal(j())).toBe("DROPPED_OR_UNKNOWN");
    expect(await recovering(null, null, { eth_getTransactionByHash: { hash: hex64(0xa1) } }).reconcileJournal(j())).toBe("PENDING");
  });
  it("blocks a new purchase while an original transaction is unknown or unfinalized", async () => {
    const a = recovering(null, null, { eth_getTransactionCount: "0x7" });
    localStorage.setItem("relay.local.transactions.v1", JSON.stringify([j({ identity: a.identity })]));
    await expect(a.unresolvedPurchase(j().branch, { ...DEMO_ACCOUNTS[0], chainId: 1 })).rejects.toThrow("Original purchase status DROPPED_OR_UNKNOWN");
    const pending = recovering(null, null, { eth_getTransactionCount: undefined });
    (pending as any).provider.request = vi.fn(async ({ method, params }: any) => method === "eth_getTransactionCount" ? (params[1] === "pending" ? "0x9" : "0x8") : null);
    await expect(pending.unresolvedPurchase(j().branch, { ...DEMO_ACCOUNTS[0], chainId: 1 })).rejects.toThrow("An account transaction is pending");
  });
  it("keeps journals isolated per deployment identity and preserves the original replaced hash", () => {
    const rows = mergeJournal(mergeJournal([], j({ identity: "local:31337:x" })), j({ identity: "public:1:y", hash: hex64(0xa2) as any }));
    localStorage.setItem("relay.local.transactions.v1", JSON.stringify(mergeJournal(rows, j({ identity: "public:1:y", hash: hex64(0xa3) as any }))));
    expect(loadJournal("public:1:y").map(r => r.hash)).toEqual([hex64(0xa2), hex64(0xa3)]);
    expect(loadJournal("local:31337:x")).toHaveLength(1);
  });
});

describe("retry journal regression: reverted/replaced rows versus authenticated refusal", () => {
  const stages = (over: Partial<Sponsorship["stages"]>) => ({ ...Object.fromEntries(STAGES.map(k => [k, "not_started"])), ...over }) as Sponsorship["stages"];
  const refusal: Sponsorship = { id: "b:1", branchId: "b", proposalId: "b:1", sponsor: "0x1" as any, maxFee: 1n, txHash: hex64(1) as any, nonce: 1, attempt: 1, stages: stages({ purchase: "confirmed", admission: "refused", callback: "refused" }), note: "", checkpointId: null, updatedAt: "" };
  const journalRow = (status: string): Sponsorship => ({ ...refusal, id: `unknown:${status}`, txHash: hex64(2) as any, attempt: 2, stages: stages({ purchase: FINALLY_FAILED.includes(status) ? "failed" : "unknown" }) });
  it.each(["REVERTED", "REPLACED_OTHER", "REPLACED_SAME_CALL_REVERTED"])("a %s retry row does not hide the authenticated status 1 retry", status => {
    expect(isLatestAttempt([refusal, journalRow(status)], refusal)).toBe(true);
    expect(journalRow(status).stages.callback).not.toBe("refused"); // a journal row never authorizes a retry itself
  });
  it.each(["DROPPED_OR_UNKNOWN", "PENDING", "NONCE_USED_UNKNOWN", "MINED_UNFINALIZED", "REPLACED_SAME_CALL_READ_CHAIN"])("an %s retry row blocks another paid retry until reconciled", status => {
    expect(isLatestAttempt([refusal, journalRow(status)], refusal)).toBe(false);
  });
});

describe("public artifact and original-result transport", () => {
  const body = enc.encode("# Report\n\nVerified bytes.\n");
  const d = { name: "Report", path: "docs/report.md", mediaType: "text/markdown", bytes: body.length, sha256: "0x" + sha(body) } as any;
  const a = () => publicAdapter(() => null);
  const stub = (r: () => any) => { const f = vi.fn(async (_u: string, init?: RequestInit) => { expect(init?.redirect).toBe("error"); expect(init?.credentials).toBe("omit"); return r(); }); vi.stubGlobal("fetch", f); return f; };
  it("returns exact verified bytes from the official artifact route only", async () => {
    const f = stub(() => new Response(body as BodyInit, { headers: { "content-type": "text/markdown" } }));
    expect(Array.from(await a().fetchFile(d, "job-1"))).toEqual(Array.from(body));
    expect(String(f.mock.calls[0][0])).toBe("https://api.imd.fun/artifacts/" + sha(body));
  });
  it.each([
    ["CORS/network failure", () => { throw new TypeError("Failed to fetch"); }, "NETWORK_ERROR"],
    ["redirect", () => ({ type: "basic", redirected: true, url: "https://other.example/x", status: 200, headers: new Headers(), body: new Response(body as BodyInit).body }), "BAD_REDIRECT"],
    ["unavailable", () => new Response("gone", { status: 404 }), "HTTP_STATUS"],
    ["oversize declared length", () => new Response(body as BodyInit, { headers: { "content-length": String(10 * 1024 * 1024) } }), "TOO_LARGE"],
    ["tampered bytes", () => new Response(enc.encode("# Report\n\nTampered bytes.\n") as BodyInit), "VERIFY_FAILED"],
  ])("refuses %s", async (_n, r, code) => {
    stub(r);
    await expect(a().fetchFile(d, "job-1")).rejects.toMatchObject({ code });
  });
  it("binds original result bytes only when the callback hash matches; never repurchases", async () => {
    const raw = enc.encode('{"files":[]}'); const hash = keccak256("0x" + Buffer.from(raw).toString("hex"));
    const ok = vi.fn(async () => new Response(raw as BodyInit)) as any;
    expect(Array.from(await sdk.fetchOriginalResult("ipfs://bafyfixture/result.json", hash, { fetch: ok }))).toEqual(Array.from(raw));
    await expect(sdk.fetchOriginalResult("ipfs://bafyfixture/result.json", hex64(1), { fetch: ok })).rejects.toThrow("callback hash mismatch");
    const big = vi.fn(async () => new Response(new Uint8Array(sdk.LIMITS.manifest + 1) as BodyInit)) as any;
    await expect(sdk.fetchOriginalResult("ipfs://bafyfixture/result.json", hash, { fetch: big })).rejects.toThrow("unsupported binding");
    const moved = vi.fn(async () => ({ ok: true, redirected: true, url: "", body: new Response(raw as BodyInit).body })) as any;
    await expect(sdk.fetchOriginalResult("ipfs://bafyfixture/result.json", hash, { fetch: moved })).rejects.toThrow("unavailable or redirected");
    await expect(sdk.fetchOriginalResult("https://evil.example/intake-results/x", hash, { fetch: ok })).rejects.toThrow("Untrusted result location");
  });
});

describe("price and allowance changes before signing", () => {
  const signer = { ...DEMO_ACCOUNTS[0], chainId: 31337 };
  const local = (allowance: bigint) => {
    const sent: string[] = [];
    const wallet = { request: vi.fn(async ({ method }: any) => { sent.push(method); if (method === "eth_accounts") return [signer.address]; if (method === "eth_chainId") return "0x7a69"; if (method === "eth_getTransactionCount") return "0x0"; if (method === "eth_sendTransaction") throw new Error("must not send"); return null; }) };
    const a = new ChainAdapter(config as LocalConfig, async () => wallet as any);
    a.verify = vi.fn(async () => {});
    (a as any).provider.request = vi.fn(async ({ method }: any) => method === "eth_getTransactionCount" ? "0x0" : method === "eth_call" ? hex64(Number(allowance)) : null);
    (a as any).read = vi.fn(async (_b: string, m: string) => m === "phase" ? 0n : 0n);
    return { a, sent };
  };
  const branch = "0x" + "44".repeat(20);
  const quote = { price: 5n, token: "Mock IMD", decimals: 18, quotedAt: "", anchor: hex64(3), action: "job.open", parentJobId: null, spender: branch, proposalId: `${branch}:1`, bodyHash: hex64(4), bodyBytes: 10, bodyText: "{}" } as any;
  it("refuses approval when the fresh price differs from the reviewed quote", async () => {
    const { a, sent } = local(5n);
    a.quoteFee = vi.fn(async () => ({ ...quote, price: 6n }));
    await expect(a.approve(signer, quote, 5n)).rejects.toThrow("Price or proposal changed");
    expect(sent).not.toContain("eth_sendTransaction");
  });
  it("refuses purchase when maxFee is below the fresh price or the allowance is not exact", async () => {
    const lower = local(5n); lower.a.quoteFee = vi.fn(async () => ({ ...quote, price: 6n }));
    await expect(lower.a.sponsor(signer, quote.proposalId, 5n, quote)).rejects.toThrow("Quote, parent job or price changed");
    const extra = local(7n); extra.a.quoteFee = vi.fn(async () => quote);
    await expect(extra.a.sponsor(signer, quote.proposalId, 5n, quote)).rejects.toThrow("exact current price allowance");
    expect([...lower.sent, ...extra.sent]).not.toContain("eth_sendTransaction");
  });
});
