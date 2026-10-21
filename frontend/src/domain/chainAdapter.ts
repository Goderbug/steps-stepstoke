import { getAddress, keccak256, toUtf8Bytes } from "ethers";
import type { RelayAdapter, RecoveryRecord } from "./adapter";
import type { Account, AssetVersion, Branch, Capabilities, Checkpoint, FeeQuote, FileDescriptor, Hex, Proposal, ProposalDraft, Sponsorship } from "./types";
import { STAGES, StaleProposalError } from "./types";
import { sdk, deployment, release } from "./sdk";

export interface Provider { request(a: { method: string; params?: any[] }): Promise<any> }
export interface LocalConfig {
  kind: "LOCAL_DEPLOYMENT"; chainId: number; contracts: Record<string, string>;
  runtimeCodeKeccak: Record<string, string>; actions: Record<string, string>;
  rpcURL: string; artifactBase: string; [key: string]: any;
}
export type WalletGetter = () => Promise<Provider | null>;
export interface Journal {
  hash: Hex | null; nonce: number; account: Hex; chainId: number; operation: string;
  branch: string; proposalId?: string; data: string; to: string; state: string; at: string;
}
const KEY = "relay.local.transactions.v1";
const now = () => new Date().toISOString();
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const address = (s: string) => getAddress(s) as Hex;
const validHex = (s: any, bytes: number) => typeof s === "string" && new RegExp(`^0x[0-9a-f]{${bytes * 2}}$`, "i").test(s);
export function loadJournal(): Journal[] {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => validHex(r.hash, 32) && validHex(r.account, 20) && validHex(r.to, 20) && typeof r.data === "string" && Number.isSafeInteger(r.nonce) && Number.isSafeInteger(r.chainId) && typeof r.operation === "string" && typeof r.branch === "string").slice(-100);
  } catch { return []; }
}
function persist(row: Journal) {
  try {
    const rows = loadJournal().filter((r) => !(eq(r.account, row.account) && r.chainId === row.chainId && r.nonce === row.nonce));
    localStorage.setItem(KEY, JSON.stringify([...rows, row].slice(-100)));
  } catch { /* Storage is a hint. Every business read recovers contract state and authenticated logs. */ }
}
export function httpProvider(url: string): Provider {
  let id = 0;
  return { async request({ method, params = [] }) {
    const bodyText = JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params });
    // WebKit can reject a small in-flight read during document replacement as a CORS error.
    // Let bounded public reads finish across navigation. Wallet writes never use this policy;
    // large simulations keep their full bytes and use ordinary fetch (no keepalive quota).
    const keepalive = (method === "eth_call" || method.startsWith("eth_get") || method === "eth_chainId")
      && new TextEncoder().encode(bodyText).byteLength <= 16384;
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: bodyText, keepalive, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
    const body = await res.json();
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    return body.result;
  } };
}
export function assertLoopbackConfig(c: LocalConfig) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) || c.kind !== "LOCAL_DEPLOYMENT" || c.chainId !== 31337) throw new Error("Local configuration requires a loopback page and local chain. No public deployment is configured.");
  for (const value of [c.rpcURL, c.artifactBase]) {
    const u = new URL(value);
    if (u.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || u.username || u.password) throw new Error("Local services require credential-free loopback HTTP URLs");
  }
}

/** Actual A1 contracts + browser SDK. Reads are public RPC; only the selected wallet signs. */
export class ChainAdapter implements RelayAdapter {
  readonly kind = "live" as const;
  readonly label = "Local contracts with MockToken / MockIntake (not live IMD)";
  readonly capabilities = { read: true, createBranch: true, propose: true, sponsor: true, fork: true, bindingRetry: true, realWalletSigning: true };
  readonly provider: Provider;
  private locked = false;
  private memory = new Map<string, Journal>();
  constructor(readonly config: LocalConfig, private wallet: WalletGetter) { assertLoopbackConfig(config); this.provider = httpProvider(config.rpcURL); }
  async verify() {
    const problems = await deployment.verifyDeploymentConfig(this.provider, this.config, release);
    if (problems.length) throw new Error(`Deployment verification failed: ${problems.join(", ")}`);
  }
  status() { return { state: "ready" as const, summary: this.label, missing: [], a1: { jobId: "d5530989-b886-4f9d-80dd-44d26d85ffd2", submittedBodySha256: "", checkedAt: "2026-10-21", observedState: "local verified", delivery: null } }; }
  private read = async (branch: string, method: string, args: any[] = []) => (await sdk.queryState(this.provider, sdk.readState(branch, method, args)))[0];
  private factoryRead = async (method: string, args: any[] = []) => (await sdk.queryState(this.provider, sdk.readFactory(this.config.contracts.factory, method, args)))[0];
  private async logs(at: string, iface = sdk.interfaces.branch) {
    const raw = await this.provider.request({ method: "eth_getLogs", params: [{ address: at, fromBlock: "0x0", toBlock: "latest" }] });
    return raw.map((log: any) => { try { return { ...log, parsed: iface.parseLog(log) }; } catch { return { ...log, parsed: null }; } });
  }
  private async checkBranch(branch: string) {
    address(branch);
    if (!await this.factoryRead("registered", [branch])) throw new Error("Branch is not registered by this Factory");
    for (const name of ["factory", "encoder", "verifier"]) if (!eq(await this.read(branch, name), this.config.contracts[name])) throw new Error(`Branch ${name} verification failed`);
    // Factory registered clones have the fixed implementation code; check the minimal proxy runtime too.
    const code = await this.provider.request({ method: "eth_getCode", params: [branch, "latest"] });
    const expected = `0x363d3d373d3d3d363d73${this.config.contracts.implementation.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3`;
    if (!eq(code, expected)) throw new Error("Branch proxy code verification failed");
  }
  async getCapabilities(): Promise<Capabilities> {
    return { source: `A1 ${release.version} · policy ${release.policyId}`, chainId: this.config.chainId, chainName: "Local contract chain", enabledKinds: ["document", "html", "image"], maxAssets: release.limits.assets, maxInputs: release.limits.inputs, maxOutputs: release.limits.outputs, maxBytes: { document: release.limits.markdownBytes, html: release.limits.htmlBytes, image: release.limits.imageBytes }, maxRequestBodyBytes: release.limits.requestBytes, maxTextBytes: 1024, maxGoalBytes: 512, maxAssetNameBytes: 64, sitePublication: release.publishing, imageEditing: false, mediaTypes: { document: ["text/markdown"], html: ["text/html"], image: ["image/png"] } };
  }
  async listBranches() {
    const count = Number(await this.factoryRead("branchCount"));
    const rows: Branch[] = [];
    for (let n = 1; n <= count; n++) rows.push(await this.getBranch(await this.factoryRead("branches", [n])));
    return rows;
  }
  async getBranch(id: string): Promise<Branch> {
    await this.checkBranch(id);
    const [goal, direction, project, head, anchor, phase] = await Promise.all(["goal", "direction", "projectId", "latestJobId", "anchor", "phase"].map(m => this.read(id, m)));
    const log = (await this.logs(this.config.contracts.factory, sdk.interfaces.factory)).find((l: any) => l.parsed?.name === "BranchCreated" && eq(l.parsed.args.branch, id));
    if (!log) throw new Error("Authenticated BranchCreated event is missing");
    const e = log.parsed.args;
    return { id: address(id), address: address(id), projectTitle: goal.split("\n")[0], goal, direction: direction || null, parent: BigInt(e.parent) ? { branchId: address(e.parent), checkpointId: e.parentCheckpoint } : null, creator: address(e.creator), imdProjectId: project || null, head: head || null, latestCheckpoint: anchor, frozen: Number(phase) === 5, createdAt: await this.time(log.blockNumber) };
  }
  private async time(block: string) { const b = await this.provider.request({ method: "eth_getBlockByNumber", params: [block, false] }); return new Date(Number(BigInt(b.timestamp)) * 1000).toISOString(); }
  private async historyData(branch: string) {
    const logs = await this.logs(branch);
    const cpLogs = logs.filter((l: any) => l.parsed?.name === "CheckpointWritten");
    const checkpoints: Record<string, any> = {};
    for (const l of cpLogs) { const rev = String(l.parsed.args.revision); checkpoints[rev] = await this.read(branch, "checkpoint", [rev]); }
    const history = sdk.recoverHistory(branch, cpLogs, checkpoints);
    return { logs, history, checkpoints, cpLogs };
  }
  private async witness(branch: string, digest?: string) {
    const data = await this.historyData(branch);
    const anchor = digest ?? await this.read(branch, "anchor");
    const item = data.history.find((c: any) => eq(c.digest, anchor));
    if (!item) throw new Error("Checkpoint witness is unavailable");
    return item;
  }
  async getHistory(branch: string): Promise<Checkpoint[]> {
    await this.checkBranch(branch);
    const { logs, history, checkpoints, cpLogs } = await this.historyData(branch);
    const rows: Checkpoint[] = [];
    for (const item of history) {
      const cp = checkpoints[String(item.revision)];
      const bound = logs.find((l: any) => l.parsed?.name === "Bound" && l.parsed.args.revision === item.revision);
      const purchase = bound ? await this.read(branch, "attempt", [bound.parsed.args.attempt]) : null;
      const assets: AssetVersion[] = [];
      for (const a of item.witness) {
        const origin = await this.read(a.producer, "checkpoint", [a.revision]);
        assets.push({ assetKey: a.name, kind: ["document", "html", "image"][a.kind] as AssetVersion["kind"], revision: Number(a.revision), producerJobId: a.jobId, descriptor: { name: a.name, path: a.path, mediaType: a.mediaType, bytes: Number(a.size), sha256: a.fileHash }, originBranchId: a.producer, originCheckpoint: origin.digest });
      }
      const output = bound ? sdk.verifyManifest(new Uint8Array(toBytes(bound.parsed.args.rawManifest)), cp.resultHash) : null;
      rows.push({ id: item.digest, branchId: address(branch), revision: Number(item.revision), jobId: output?.jobId ?? null, funder: purchase ? purchase.sponsor : null, changed: bound ? assets.filter(a => eq(a.originBranchId, branch) && a.revision === Number(item.revision)).map(a => a.assetKey) : [], assets, createdBy: bound ? "round" : assets.length ? "fork" : "create", manifestKeccak: BigInt(cp.resultHash) ? cp.resultHash : null, at: await this.time(cpLogs.find((l: any) => l.parsed.args.revision === item.revision).blockNumber), git: { state: "unavailable", url: null, observedAt: null }, site: { state: "not_requested", url: null, observedAt: null } });
    }
    return rows;
  }
  private split(id: string) { const [branch, n] = id.split(":"); if (!validHex(branch, 20) || !/^[1-9][0-9]*$/.test(n ?? "")) throw new Error("A nonzero on-chain ID is required"); return { branch: address(branch), n: BigInt(n) }; }
  async getProposals(branch: string): Promise<Proposal[]> {
    await this.checkBranch(branch);
    const [count, anchor, logs, attempts] = await Promise.all([this.read(branch, "proposalCount"), this.read(branch, "anchor"), this.logs(branch), this.read(branch, "attemptCount")]);
    const sponsored = new Set<string>();
    for (let n = 1; n <= Number(attempts); n++) sponsored.add(String((await this.read(branch, "attempt", [n])).proposalId));
    const out: Proposal[] = [];
    for (let n = 1; n <= Number(count); n++) {
      const p = await this.read(branch, "proposal", [n]);
      const log = logs.find((l: any) => l.parsed?.name === "Proposed" && Number(l.parsed.args.proposalId) === n);
      const tx = await this.provider.request({ method: "eth_getTransactionByHash", params: [log.transactionHash] });
      const w = (await this.witness(branch, p.anchor)).witness;
      out.push({ id: `${address(branch)}:${n}`, branchId: address(branch), proposer: address(tx.from), anchor: p.anchor, kind: p.profile < 2 ? "document" : p.profile < 4 ? "html" : "image", mode: [1, 3].includes(Number(p.profile)) ? "update" : "create", targetKey: p.outputName, inputs: p.inputs.map((key: string) => { const a = w.find((a: any) => eq(a.key, key)); if (!a) throw new Error("Proposal input witness is missing"); return { assetKey: a.name, revision: Number(a.revision), sha256: a.fileHash }; }), requirement: p.text, publish: p.publish, status: sponsored.has(String(n)) ? "sponsored" : eq(p.anchor, anchor) ? "current" : "stale", createdAt: await this.time(log.blockNumber) });
    }
    return out;
  }
  async getSponsorships(branch: string): Promise<Sponsorship[]> {
    await this.checkBranch(branch);
    const [count, phase, active, logs] = await Promise.all([this.read(branch, "attemptCount"), this.read(branch, "phase"), this.read(branch, "activeAttempt"), this.logs(branch)]);
    const rows: Sponsorship[] = [];
    const perProposal = new Map<string, number>();
    for (let n = 1; n <= Number(count); n++) {
      const a = await this.read(branch, "attempt", [n]);
      const log = logs.find((l: any) => l.parsed?.name === "Purchased" && Number(l.parsed.args.attempt) === n);
      if (!log || !eq(log.parsed.args.requestId, a.requestId)) throw new Error("Purchase event does not match the on-chain attempt");
      const tx = await this.provider.request({ method: "eth_getTransactionByHash", params: [log.transactionHash] });
      const bound = logs.find((l: any) => l.parsed?.name === "Bound" && Number(l.parsed.args.attempt) === n);
      const cp = bound ? await this.read(branch, "checkpoint", [bound.parsed.args.revision]) : null;
      const failureLog = logs.find((l: any) => l.parsed?.name === "FailureRecorded" && Number(l.parsed.args.attempt) === n);
      // Failure callbacks with an unknown status, including 0, freeze the contract. Status 0
      // alone is not proof of a result: authenticate the callback kind and active phase too.
      const failed = a.delivered && (Number(a.status) !== 0 || Boolean(failureLog) || (Number(active) === n && Number(phase) === 5));
      const frozen = failed && Number(a.status) !== 1;
      const result = a.delivered && !failed;
      const stages = Object.fromEntries(STAGES.map(k => [k, "not_started"])) as Sponsorship["stages"];
      Object.assign(stages, { approval: "confirmed", purchase: "confirmed", admission: failed ? Number(a.status) === 1 ? "refused" : "unknown" : result ? "confirmed" : "unknown", execution: result ? "confirmed" : failed ? "unknown" : "pending", callback: frozen ? "frozen" : failed ? "refused" : result ? "confirmed" : "pending", binding: bound ? "confirmed" : result ? "pending" : "not_started", files: bound ? "pending" : "not_started", git: "unknown", publication: "not_applicable" });
      const key = String(a.proposalId), attempt = (perProposal.get(key) ?? 0) + 1; perProposal.set(key, attempt);
      rows.push({ id: `${address(branch)}:${n}`, branchId: address(branch), proposalId: `${address(branch)}:${a.proposalId}`, sponsor: a.sponsor, maxFee: a.fee, txHash: log.transactionHash, nonce: Number(BigInt(tx.nonce)), attempt, stages, note: frozen ? `Authenticated failure status ${a.status}, Branch permanently frozen. ` : result && !bound ? "Result hash authenticated. Bind the original result.json without repurchasing. A result outside the manifest limits may remain permanently unbindable." : !a.delivered ? "Purchase confirmed. Admission is separate; a missing callback remains pending. HTTP cannot settle or unlock it." : bound ? "Binding, files, Git and publication are observed separately." : "Authenticated status 1 permits an explicit paid retry with the identical body. No refund.", checkpointId: cp?.digest ?? null, updatedAt: await this.time(log.blockNumber) });
    }
    const journals = [...loadJournal(), ...this.memory.values()].filter(r => eq(r.branch, branch) && r.chainId === this.config.chainId && ["sponsor", "retry"].includes(r.operation));
    for (const j of journals) {
      if (rows.some(r => r.txHash === j.hash || (eq(r.sponsor, j.account) && r.nonce === j.nonce))) continue;
      const status = await this.reconcileJournal(j);
      const stages = Object.fromEntries(STAGES.map(k => [k, "not_started"])) as Sponsorship["stages"];
      stages.purchase = status === "REVERTED" || status === "REPLACED_OTHER" ? "failed" : "unknown";
      rows.push({ id: `unknown:${j.hash}`, branchId: branch, proposalId: j.proposalId ?? "unknown", sponsor: j.account, maxFee: 0n, txHash: j.hash, nonce: j.nonce, attempt: Number(active) + 1, stages, note: `Original transaction reconciliation: ${status}. No automatic purchase. On-chain phase ${Number(phase)}. `, checkpointId: null, updatedAt: j.at });
    }
    // Without a journal, a connected account's pending nonce is still chain evidence of an
    // unresolved transaction. Its operation/hash are unknown; never infer a new purchase is safe.
    const wallet = await this.wallet();
    if (wallet) {
      const accounts = await wallet.request({ method: "eth_accounts" });
      const walletChain = Number(BigInt(await wallet.request({ method: "eth_chainId" })));
      if (accounts[0] && walletChain === this.config.chainId) {
        const [mined, pending] = await Promise.all(["latest", "pending"].map(tag => this.provider.request({ method: "eth_getTransactionCount", params: [accounts[0], tag] })));
        if (BigInt(pending) > BigInt(mined) && !rows.some(r => r.nonce === Number(BigInt(mined)) && eq(r.sponsor, accounts[0]))) {
          const stages = Object.fromEntries(STAGES.map(k => [k, "not_started"])) as Sponsorship["stages"];
          stages.purchase = "unknown";
          rows.push({ id: `pending-account:${accounts[0]}:${mined}`, branchId: branch, proposalId: "unknown", sponsor: address(accounts[0]), maxFee: 0n, txHash: null, nonce: Number(BigInt(mined)), attempt: 0, stages, note: "Pending account transaction with no local record. Operation and hash are unknown. Reconcile the original transaction; no automatic purchase.", checkpointId: null, updatedAt: now() });
        }
      }
    }
    return rows;
  }
  async quoteFee(proposalId: string): Promise<FeeQuote> {
    const { branch, n } = this.split(proposalId); await this.checkBranch(branch);
    const w = await this.witness(branch);
    const p = await this.read(branch, "proposal", [n]);
    if (!eq(p.anchor, w.digest)) throw new StaleProposalError();
    const preview = await sdk.queryPreview(this.provider, sdk.previewProposal(branch, n, w.witness));
    if (preview.byteLength > sdk.LIMITS.body) throw new Error("Complete request body exceeds its limit");
    const price = (await sdk.queryState(this.provider, sdk.readPrice(this.config.contracts.intake, preview.action, this.config.contracts.imd)))[0];
    if (price <= 0n) throw new Error("This action is not currently for sale");
    const head = await this.read(branch, "latestJobId");
    return { price, token: "Mock IMD", decimals: 18, quotedAt: now(), anchor: w.digest, action: head ? "job.continue" : "job.open", parentJobId: head || null, spender: address(branch), proposalId, bodyHash: preview.bodyHash, bodyBytes: preview.byteLength, bodyText: new TextDecoder().decode(preview.raw) };
  }
  private async selected(account: Account): Promise<Provider> {
    account.assertActive?.();
    const p = await this.wallet(); account.assertActive?.(); if (!p) throw new Error("Connect the selected EIP-6963 wallet");
    const [accounts, chain] = await Promise.all([p.request({ method: "eth_accounts" }), p.request({ method: "eth_chainId" })]);
    account.assertActive?.();
    if (!accounts[0] || !eq(accounts[0], account.address) || Number(BigInt(chain)) !== account.chainId || account.chainId !== this.config.chainId) throw new Error("Account or network changed. Review the action again");
    return p;
  }
  private async send(account: Account, operation: string, branch: string, prepare: () => Promise<any>, proposalId?: string): Promise<any> {
    if (this.locked) throw new Error("A signature or unresolved transaction is already in progress");
    this.locked = true;
    try {
      await this.verify();
      const wallet = await this.selected(account);
      let prepared = await prepare();
      account.assertActive?.();
      const request = sdk.toWalletRequest(prepared, { from: account.address, chainId: account.chainId });
      await this.provider.request({ method: "eth_call", params: [{ ...request.params[0] }, "latest"] });
      account.assertActive?.();
      const nonce = Number(BigInt(await wallet.request({ method: "eth_getTransactionCount", params: [account.address, "pending"] })));
      if (await this.selected(account) !== wallet) throw new Error("Selected wallet provider changed. Review again");
      const finalPrepared = await prepare();
      account.assertActive?.();
      if (finalPrepared.to !== prepared.to || finalPrepared.data !== prepared.data) throw new Error("State changed before signing. Review again");
      prepared = finalPrepared;
      if (await this.selected(account) !== wallet) throw new Error("Selected wallet provider changed. Review again");
      // Use the nonce actually submitted. Save the original hash before ANY receipt wait.
      account.assertActive?.();
      const hash = await wallet.request({ method: request.method, params: [{ ...request.params[0], nonce: `0x${nonce.toString(16)}` }] }) as Hex;
      const row: Journal = { hash, nonce, account: account.address, chainId: account.chainId, operation, branch, proposalId, data: prepared.data, to: prepared.to, state: "SUBMITTED", at: now() };
      persist(row); this.memory.set(hash, row);
      for (let n = 0; n < 60; n++) {
        const receipt = await this.provider.request({ method: "eth_getTransactionReceipt", params: [hash] });
        if (receipt) {
          row.state = BigInt(receipt.status) === 1n ? "MINED" : "REVERTED"; persist(row);
          if (row.state === "REVERTED") throw new Error(`Transaction reverted: ${hash}`);
          return receipt;
        }
        await new Promise(r => setTimeout(r, 150));
      }
      throw new Error(`Transaction ${hash} outcome unknown. Original hash and nonce recorded; refresh to reconcile without repurchasing.`);
    } finally { this.locked = false; }
  }
  private async reconcileJournal(j: Journal): Promise<string> {
    const receipt = await this.provider.request({ method: "eth_getTransactionReceipt", params: [j.hash] });
    if (receipt) return BigInt(receipt.status) === 1n ? "MINED" : "REVERTED";
    const tx = await this.provider.request({ method: "eth_getTransactionByHash", params: [j.hash] });
    if (tx) return "PENDING";
    const minedNonce = Number(BigInt(await this.provider.request({ method: "eth_getTransactionCount", params: [j.account, "latest"] })));
    if (minedNonce > j.nonce) {
      const head = Number(BigInt(await this.provider.request({ method: "eth_blockNumber" })));
      for (let b = head; b >= 0; b--) {
        const block = await this.provider.request({ method: "eth_getBlockByNumber", params: [`0x${b.toString(16)}`, true] });
        const replacement = block.transactions.find((t: any) => eq(t.from, j.account) && Number(BigInt(t.nonce)) === j.nonce);
        if (replacement) return eq(replacement.to ?? "", j.to) && eq(replacement.input, j.data) ? "REPLACED_SAME_CALL_READ_CHAIN" : "REPLACED_OTHER";
      }
      return "NONCE_USED_UNKNOWN";
    }
    return "DROPPED_OR_UNKNOWN";
  }
  private async unresolvedPurchase(branch: string, account: Account) {
    const [latestNonce, pendingNonce] = await Promise.all(["latest", "pending"].map(tag => this.provider.request({ method: "eth_getTransactionCount", params: [account.address, tag] })));
    if (BigInt(pendingNonce) > BigInt(latestNonce)) throw new Error("An account transaction is pending. Reconcile it before another purchase, even if local records are missing");
    for (const j of [...loadJournal(), ...this.memory.values()]) {
      if (!eq(j.branch, branch) || j.chainId !== this.config.chainId || !eq(j.account, account.address) || !["sponsor", "retry"].includes(j.operation)) continue;
      const status = await this.reconcileJournal(j);
      if (!["MINED", "REVERTED", "REPLACED_OTHER", "REPLACED_SAME_CALL_READ_CHAIN"].includes(status)) throw new Error(`Original purchase status ${status}, reconcile first; no automatic or duplicate purchase`);
    }
  }
  async createBranch(account: Account, input: { title: string; goal: string }) {
    const receipt = await this.send(account, "create", this.config.contracts.factory, async () => sdk.createProject(this.config.contracts.factory, `${input.title.trim()}\n${input.goal.trim()}`));
    const event = receipt.logs.map((l: any) => { try { return sdk.interfaces.factory.parseLog(l); } catch { return null; } }).find((e: any) => e?.name === "BranchCreated");
    return this.getBranch(event.args.branch);
  }
  private async draft(d: ProposalDraft) {
    await this.checkBranch(d.branchId);
    const w = await this.witness(d.branchId);
    if (!eq(d.anchor, w.digest)) throw new StaleProposalError();
    const find = (name: string) => w.witness.find((a: any) => a.name === name);
    const target = find(d.targetKey);
    const kind = ["document", "html", "image"].indexOf(d.kind);
    const p = { anchor: w.digest, profile: kind * 2 + (d.mode === "update" ? 1 : 0), target: target?.key ?? keccak256(toUtf8Bytes(d.targetKey)), inputs: d.inputKeys.map(name => { const a = find(name); if (!a) throw new Error("Input is absent from the current witness"); return a.key; }).sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1), outputName: target?.name ?? d.targetKey, outputPath: target?.path ?? (kind === 1 ? "dist/index.html" : kind === 0 ? `docs/${d.targetKey}.md` : `images/${d.targetKey}.png`), text: d.requirement, publish: d.publish };
    return { p, w: w.witness };
  }
  async propose(account: Account, d: ProposalDraft) {
    await this.send(account, "propose", d.branchId, async () => { const { p, w } = await this.draft(d); return sdk.proposeWork(d.branchId, p, w); });
    return (await this.getProposals(d.branchId)).at(-1)!;
  }
  async approve(account: Account, quote: FeeQuote, amount: bigint): Promise<Hex> {
    if (!quote.proposalId) throw new Error("An explicit proposal quote is required");
    const receipt = await this.send(account, "approve", quote.spender, async () => {
      const q = await this.quoteFee(quote.proposalId!);
      if (q.price !== quote.price || amount !== q.price || q.bodyHash !== quote.bodyHash || !eq(q.anchor, quote.anchor) || !eq(q.spender, quote.spender)) throw new Error("Price or proposal changed. Review approval again");
      return sdk.approveExact(this.config.contracts.imd, q.spender, amount);
    }, quote.proposalId);
    const allowance = (await sdk.queryState(this.provider, sdk.readAllowance(this.config.contracts.imd, account.address, quote.spender)))[0];
    if (allowance !== amount) throw new Error("Confirmed Branch allowance is not the exact price");
    return receipt.transactionHash;
  }
  private async purchase(account: Account, proposalId: string, maxFee: bigint, quote: FeeQuote, retry: boolean) {
    const { branch, n } = this.split(proposalId);
    await this.send(account, retry ? "retry" : "sponsor", branch, async () => {
      await this.unresolvedPurchase(branch, account);
      const q = await this.quoteFee(proposalId);
      if (maxFee < q.price || q.price !== quote.price || q.bodyHash !== quote.bodyHash || q.parentJobId !== quote.parentJobId || q.anchor !== quote.anchor || q.spender !== quote.spender) throw new Error("Quote, parent job or price changed. Approve the exact price again");
      const phase = Number(await this.read(branch, "phase"));
      if (phase !== (retry ? 4 : 0)) throw new Error("Branch is pending or frozen. Another purchase is unavailable");
      if (retry) {
        const a = await this.read(branch, "attempt", [await this.read(branch, "activeAttempt")]);
        if (!a.delivered || Number(a.status) !== 1 || a.proposalId !== n || a.bodyHash !== q.bodyHash) throw new Error("Only an authenticated status 1 with the identical body permits an explicit retry");
      }
      const allowance = (await sdk.queryState(this.provider, sdk.readAllowance(this.config.contracts.imd, account.address, branch)))[0];
      if (allowance !== q.price) throw new Error("Confirm the exact current price allowance to this Branch first");
      const witness = (await this.witness(branch)).witness;
      return retry ? sdk.retryRefused(branch, maxFee, witness) : sdk.sponsorProposal(branch, n, maxFee, witness);
    }, proposalId);
    return (await this.getSponsorships(branch)).filter(s => s.proposalId === proposalId).at(-1)!;
  }
  sponsor(account: Account, id: string, max: bigint, q: FeeQuote) { return this.purchase(account, id, max, q, false); }
  async retryRefused(account: Account, id: string, max: bigint, q: FeeQuote) {
    const { branch, n } = this.split(id), a = await this.read(branch, "attempt", [n]);
    if (BigInt(await this.read(branch, "activeAttempt")) !== n) throw new Error("Only the current attempt can be retried");
    return this.purchase(account, `${branch}:${a.proposalId}`, max, q, true);
  }
  async resubmitBinding(account: Account, id: string, raw?: Uint8Array) {
    const { branch, n } = this.split(id);
    if (!raw) throw new Error("Select the original callback-authenticated result.json. Preserve its exact bytes");
    await this.send(account, "bind", branch, async () => {
      if (Number(await this.read(branch, "phase")) !== 3 || BigInt(await this.read(branch, "activeAttempt")) !== n) throw new Error("No authenticated result is ready to bind");
      const a = await this.read(branch, "attempt", [n]);
      return sdk.bindResult(branch, raw, a.outcome, (await this.witness(branch)).witness);
    });
    return (await this.getSponsorships(branch)).find(s => s.id === id)!;
  }
  async fork(account: Account, input: { branchId: string; checkpointId: string; direction: string }) {
    const receipt = await this.send(account, "fork", input.branchId, async () => {
      await this.checkBranch(input.branchId);
      const c = await this.witness(input.branchId, input.checkpointId);
      return sdk.forkHistory(this.config.contracts.factory, input.branchId, c.revision, c.witness, input.direction);
    });
    const event = receipt.logs.map((l: any) => { try { return sdk.interfaces.factory.parseLog(l); } catch { return null; } }).find((e: any) => e?.name === "BranchCreated");
    return this.getBranch(event.args.branch);
  }
  async reconcile(r: RecoveryRecord) { return (await this.getSponsorships(r.branchId)).find(s => s.id === r.sponsorshipId || s.txHash === r.txHash) ?? null; }
  async fetchFile(d: FileDescriptor, producerJobId: string) {
    // Locations are an explicit local-test policy, not discovered from untrusted result metadata.
    const base = new URL(this.config.artifactBase);
    const policy = sdk.createLoopbackFixturePolicy({ locations: [{ origin: base.origin, pathPrefix: base.pathname }] });
    if (!/^[a-zA-Z0-9_-]+$/.test(producerJobId) || d.path.split("/").some(s => !s || s === "." || s === "..")) throw new Error("Invalid artifact location");
    const url = new URL(`${encodeURIComponent(producerJobId)}/${d.path}`, base).href;
    const result = await sdk.fetchTrustedArtifact(url, { ...d, hash: d.sha256 }, { policy });
    return result.bytes;
  }
}
function toBytes(hex: string): Uint8Array { return Uint8Array.from(hex.slice(2).match(/../g) ?? [], b => parseInt(b, 16)); }
