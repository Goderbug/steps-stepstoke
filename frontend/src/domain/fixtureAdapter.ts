// Fixture (demo) adapter. Local test/demo data only: it holds no provider, never touches a
// browser wallet and cannot send a real transaction. Its "chain" is a JSON blob in localStorage.
import { getAddress, keccak256, toHex } from "viem";
import type { IntegrationStatus, RecoveryRecord, RelayAdapter } from "./adapter";
import { fromBase64, sha256Hex, toBase64, utf8 } from "./files";
import { DOC_NOTES, EVIL_HTML, EVIL_MD, HTML_R1, PNG_AMBER_B64, PNG_GREEN_B64, SVG_AS_PNG, htmlR3 } from "./fixtures";
import {
  STAGES,
  StaleProposalError,
  UserRejectedError,
  type Account,
  type AssetKind,
  type AssetVersion,
  type Branch,
  type Capabilities,
  type Checkpoint,
  type FeeQuote,
  type FileDescriptor,
  type Hex,
  type ObservedStatus,
  type Proposal,
  type ProposalDraft,
  type Sponsorship,
  type StageName,
  type StageState,
} from "./types";
import { A1_SOURCE } from "../config";

const STORE_KEY = "platform.fixture.v1";
export const FIXTURE_CHAIN_ID = 31337;

const demoAddress = (seed: string): Hex => getAddress(`0x${keccak256(toHex(seed)).slice(-40)}`);
export const DEMO_ACCOUNTS: Account[] = [
  { address: demoAddress("w1-fixture-account-a"), chainId: FIXTURE_CHAIN_ID, label: "Demo account A" },
  { address: demoAddress("w1-fixture-account-b"), chainId: FIXTURE_CHAIN_ID, label: "Demo account B" },
];

/** Fixture copy of the candidate limits published in A1's objective. Not verified A1 config. */
export const FIXTURE_CAPABILITIES: Capabilities = {
  source: "Demo candidate limits from the A1 brief; not verified deployment configuration",
  chainId: FIXTURE_CHAIN_ID,
  chainName: "Local demo chain",
  enabledKinds: ["document", "html", "image"],
  maxAssets: 16,
  maxInputs: 8,
  maxOutputs: 1,
  maxBytes: { document: 64 * 1024, html: 2 * 1024 * 1024, image: 256 * 1024 },
  maxRequestBodyBytes: 16384,
  sitePublication: true,
  imageEditing: false,
  mediaTypes: { document: ["text/markdown"], html: ["text/html"], image: ["image/png", "image/jpeg", "image/webp"] },
};

export type CallbackOutcome = "missing" | "accepted" | "refused" | "failed" | "bad_binding";
export interface DemoControls {
  rejectNextSignature: boolean;
  txOutcome: "ok" | "unknown";
  callbackOutcome: CallbackOutcome;
}

interface StoredFile { b64: string; available: boolean }
interface State {
  seq: number;
  nonces: Record<string, number>;
  branches: Branch[];
  checkpoints: Checkpoint[];
  proposals: Proposal[];
  sponsorships: (Omit<Sponsorship, "maxFee"> & { maxFee: string; unknownResolves?: boolean; callbackOutcome?: CallbackOutcome; retriedBy?: string })[];
  files: Record<string, StoredFile>; // key: producerJobId:path
  allowances: Record<string, string>; // account:spender -> amount
}

const now = () => new Date().toISOString();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const notRequested: ObservedStatus = { state: "not_requested", url: null, observedAt: null };
const PRICE = 25n * 10n ** 18n;

function freshStages(): Record<StageName, StageState> {
  return Object.fromEntries(STAGES.map((s) => [s, "not_started"])) as Record<StageName, StageState>;
}

const ext: Record<AssetKind, string> = { document: "md", html: "html", image: "png" };
const mediaOf: Record<AssetKind, string> = { document: "text/markdown", html: "text/html", image: "image/png" };

async function seed(): Promise<State> {
  const s: State = { seq: 100, nonces: {}, branches: [], checkpoints: [], proposals: [], sponsorships: [], files: {}, allowances: {} };
  const [A, B] = DEMO_ACCOUNTS;
  const put = async (jobId: string, key: string, kind: AssetKind, bytes: Uint8Array, opts: { mediaType?: string; serve?: Uint8Array; available?: boolean } = {}): Promise<FileDescriptor> => {
    const path = `assets/${key}.${ext[kind]}`;
    s.files[`${jobId}:${path}`] = { b64: toBase64(opts.serve ?? bytes), available: opts.available ?? true };
    return { name: `${key}.${ext[kind]}`, path, mediaType: opts.mediaType ?? mediaOf[kind], bytes: bytes.length, sha256: await sha256Hex(bytes) };
  };
  const ver = (key: string, kind: AssetKind, revision: number, jobId: string, d: FileDescriptor, branchId: string, cp: string): AssetVersion => ({
    assetKey: key, kind, revision, producerJobId: jobId, descriptor: d, originBranchId: branchId, originCheckpoint: cp,
  });

  // Main demo branch: HTML R1 -> image R2 -> HTML R3 (uses job R2 as parent, inputs HTML R1 + image R2).
  const b = "fx-branch-1";
  const html1 = await put("fx-job-1", "site", "html", utf8(HTML_R1));
  const img2 = await put("fx-job-2", "cover", "image", fromBase64(PNG_GREEN_B64));
  const html3 = await put("fx-job-3", "site", "html", utf8(htmlR3(PNG_GREEN_B64)));
  const doc0 = await put("fx-job-1", "notes", "document", utf8(DOC_NOTES));
  const v1 = ver("site", "html", 1, "fx-job-1", html1, b, `${b}:1`);
  const vd = ver("notes", "document", 1, "fx-job-1", doc0, b, `${b}:1`);
  const v2 = ver("cover", "image", 2, "fx-job-2", img2, b, `${b}:2`);
  const v3 = ver("site", "html", 3, "fx-job-3", html3, b, `${b}:3`);
  const gitAt = "2026-10-01T09:00:00.000Z";
  s.branches.push({
    id: b, address: demoAddress(`w1-fixture-branch-${b}`), projectTitle: "Relay introduction", goal: "Build a public introduction to the relay, with a cover image and project notes.",
    direction: null, parent: null, creator: A.address, imdProjectId: "fx-project-1", head: "fx-job-3", latestCheckpoint: `${b}:3`, frozen: false, createdAt: "2026-09-30T08:00:00.000Z",
  });
  const cp = (rev: number, jobId: string | null, funder: Hex | null, changed: string[], assets: AssetVersion[], createdBy: Checkpoint["createdBy"], git: ObservedStatus = notRequested, site: ObservedStatus = notRequested): Checkpoint => ({
    id: `${b}:${rev}`, branchId: b, revision: rev, jobId, funder, changed, assets, createdBy,
    manifestKeccak: jobId ? keccak256(toHex(`manifest-${jobId}`)) : null, at: `2026-10-0${rev + 1}T08:00:00.000Z`, git, site,
  });
  s.checkpoints.push(
    cp(0, null, null, [], [], "create"),
    cp(1, "fx-job-1", A.address, ["site", "notes"], [vd, v1], "round", { state: "observed", url: "https://github.com/imd-fixture/relay-demo/commit/r1", observedAt: gitAt }),
    cp(2, "fx-job-2", B.address, ["cover"], [vd, v1, v2], "round", { state: "observed", url: "https://github.com/imd-fixture/relay-demo/commit/r2", observedAt: gitAt }),
    cp(3, "fx-job-3", A.address, ["site"], [vd, v2, v3], "round", { state: "observed", url: "https://github.com/imd-fixture/relay-demo/commit/r3", observedAt: gitAt }, { state: "pending", url: "https://relay-demo.example.org/", observedAt: null }),
  );
  s.proposals.push(
    { id: "fx-prop-1", branchId: b, proposer: B.address, anchor: `${b}:3`, kind: "document", mode: "update", targetKey: "notes", inputs: [{ assetKey: "notes", revision: 1, sha256: doc0.sha256 }], requirement: "Expand the notes with the project goal, how to fund work and how to fork.", publish: false, status: "current", createdAt: "2026-10-05T08:00:00.000Z" },
    { id: "fx-prop-2", branchId: b, proposer: A.address, anchor: `${b}:3`, kind: "html", mode: "update", targetKey: "site", inputs: [{ assetKey: "site", revision: 3, sha256: html3.sha256 }, { assetKey: "cover", revision: 2, sha256: img2.sha256 }], requirement: "Improve the introduction while keeping the cover and the original round marker.", publish: false, status: "current", createdAt: "2026-10-05T09:00:00.000Z" },
    { id: "fx-prop-0", branchId: b, proposer: B.address, anchor: `${b}:2`, kind: "image", mode: "create", targetKey: "banner", inputs: [], requirement: "Create a banner image.", publish: false, status: "stale", createdAt: "2026-10-03T08:00:00.000Z" },
  );

  // Security fixture branch: malicious and broken files that must never execute or get a verified badge.
  const sb = "fx-branch-sec";
  const evilHtml = await put("fx-job-s1", "evil-site", "html", utf8(EVIL_HTML));
  const evilMd = await put("fx-job-s1", "evil-notes", "document", utf8(EVIL_MD));
  const tamperedBytes = fromBase64(PNG_GREEN_B64);
  const tamperedServe = tamperedBytes.slice();
  tamperedServe[tamperedServe.length - 13] ^= 0xff;
  const tampered = await put("fx-job-s1", "tampered", "image", tamperedBytes, { serve: tamperedServe });
  const missing = await put("fx-job-s1", "missing", "document", utf8("# Unavailable file\n"), { available: false });
  const fake = await put("fx-job-s1", "fake-png", "image", utf8(SVG_AS_PNG));
  const broken = await put("fx-job-s1", "broken-png", "image", fromBase64(PNG_GREEN_B64).slice(0, 33));
  const hugeBytes = fromBase64(PNG_GREEN_B64);
  new DataView(hugeBytes.buffer).setUint32(16, 100000);
  const oversized = await put("fx-job-s1", "oversized-png", "image", hugeBytes);
  const sAssets = [
    ver("evil-site", "html", 1, "fx-job-s1", evilHtml, sb, `${sb}:1`),
    ver("evil-notes", "document", 1, "fx-job-s1", evilMd, sb, `${sb}:1`),
    ver("tampered", "image", 1, "fx-job-s1", tampered, sb, `${sb}:1`),
    ver("missing", "document", 1, "fx-job-s1", missing, sb, `${sb}:1`),
    ver("fake-png", "image", 1, "fx-job-s1", fake, sb, `${sb}:1`),
    ver("broken-png", "image", 1, "fx-job-s1", broken, sb, `${sb}:1`),
    ver("oversized-png", "image", 1, "fx-job-s1", oversized, sb, `${sb}:1`),
  ];
  s.branches.push({
    id: sb, address: demoAddress(`w1-fixture-branch-${sb}`), projectTitle: "Preview safety lab", goal: "Demo fixtures for isolated previews, unavailable files and verification failures.",
    direction: null, parent: null, creator: B.address, imdProjectId: "fx-project-sec", head: "fx-job-s1", latestCheckpoint: `${sb}:1`, frozen: false, createdAt: "2026-10-02T08:00:00.000Z",
  });
  s.checkpoints.push(
    { id: `${sb}:0`, branchId: sb, revision: 0, jobId: null, funder: null, changed: [], assets: [], createdBy: "create", manifestKeccak: null, at: "2026-10-02T08:00:00.000Z", git: notRequested, site: notRequested },
    { id: `${sb}:1`, branchId: sb, revision: 1, jobId: "fx-job-s1", funder: B.address, changed: sAssets.map((a) => a.assetKey), assets: sAssets, createdBy: "round", manifestKeccak: keccak256(toHex("manifest-fx-job-s1")), at: "2026-10-02T09:00:00.000Z", git: notRequested, site: notRequested },
  );
  return s;
}

export class FixtureAdapter implements RelayAdapter {
  readonly identity = "fixture:deterministic:v1";
  readonly kind = "fixture" as const;
  readonly label = "Demo mode";
  readonly capabilities = { read: true, createBranch: true, propose: true, sponsor: true, fork: true, bindingRetry: true, realWalletSigning: false };
  controls: DemoControls = { rejectNextSignature: false, txOutcome: "ok", callbackOutcome: "accepted" };
  private constructor(private s: State, private latency: number) {}
  private purchases = new Set<string>();
  private controlListeners = new Set<() => void>();
  subscribeControls(listener: () => void) {
    this.controlListeners.add(listener);
    return () => { this.controlListeners.delete(listener); };
  }

  private assertIdle(branchId: string, retryId?: string) {
    const outstanding = this.s.sponsorships.some((sp) => sp.branchId === branchId && sp.id !== retryId && !sp.retriedBy
      && (sp.stages.purchase === "unknown" || sp.stages.purchase === "pending" || sp.stages.callback === "pending" || sp.stages.callback === "refused" || sp.stages.binding === "failed"));
    if (outstanding || this.purchases.has(branchId)) throw new Error("An unresolved request exists. Wait or correct the binding; do not purchase again");
  }

  static async create(opts: { latency?: number; reset?: boolean } = {}): Promise<FixtureAdapter> {
    let state: State | null = null;
    if (!opts.reset) {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) state = JSON.parse(raw) as State;
      } catch {
        state = null;
      }
    }
    const a = new FixtureAdapter(state ?? (await seed()), opts.latency ?? 120);
    a.save();
    return a;
  }

  status(): IntegrationStatus {
    return { state: "A1_INTEGRATION_PENDING", summary: "Deterministic local demo data. No real transactions.", missing: [], a1: { ...A1_SOURCE } };
  }

  private save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.s));
    } catch {
      /* storage full or disabled: the demo still runs in memory */
    }
  }
  private id(prefix: string) {
    this.s.seq += 1;
    return `${prefix}-${this.s.seq}`;
  }
  private async sign(account: Account): Promise<{ hash: Hex; nonce: number }> {
    await wait(this.latency);
    account.assertActive?.();
    if (account.chainId !== FIXTURE_CHAIN_ID) throw new Error("Switch to the demo network before signing");
    if (this.controls.rejectNextSignature) {
      this.controls.rejectNextSignature = false;
      for (const listener of this.controlListeners) listener();
      throw new UserRejectedError();
    }
    const nonce = (this.s.nonces[account.address] ?? 0) + 1;
    this.s.nonces[account.address] = nonce;
    return { hash: keccak256(toHex(`fixture-tx:${account.address}:${nonce}`)), nonce };
  }
  private branch(id: string) {
    const b = this.s.branches.find((x) => x.id === id);
    if (!b) throw new Error(`Branch not found ${id}`);
    return b;
  }
  private latest(branchId: string) {
    const b = this.branch(branchId);
    return this.s.checkpoints.find((c) => c.id === b.latestCheckpoint)!;
  }
  private toSponsorship(x: State["sponsorships"][number]): Sponsorship {
    const { unknownResolves: _u, ...rest } = x;
    return { ...rest, maxFee: BigInt(x.maxFee) };
  }

  async getCapabilities() {
    await wait(this.latency / 2);
    return FIXTURE_CAPABILITIES;
  }
  async listBranches() {
    await wait(this.latency);
    return structuredClone(this.s.branches);
  }
  async getBranch(id: string) {
    await wait(this.latency / 2);
    return structuredClone(this.branch(id));
  }
  async getHistory(branchId: string) {
    await wait(this.latency / 2);
    return structuredClone(this.s.checkpoints.filter((c) => c.branchId === branchId).sort((a, b) => b.revision - a.revision));
  }
  async getProposals(branchId: string) {
    await wait(this.latency / 2);
    return structuredClone(this.s.proposals.filter((p) => p.branchId === branchId));
  }
  async getSponsorships(branchId: string) {
    await wait(this.latency / 2);
    return this.s.sponsorships.filter((p) => p.branchId === branchId).map((x) => this.toSponsorship(x));
  }

  async quoteFee(proposalId: string): Promise<FeeQuote> {
    await wait(this.latency / 2);
    const p = this.s.proposals.find((x) => x.id === proposalId);
    if (!p) throw new Error("Proposal not found");
    const b = this.branch(p.branchId);
    return { price: PRICE, token: "IMD (demo)", decimals: 18, quotedAt: now(), anchor: b.latestCheckpoint, action: b.head ? "job.continue" : "job.open", parentJobId: b.head, spender: b.address! };
  }

  async createBranch(account: Account, input: { title: string; goal: string }) {
    const goal = input.goal.trim();
    const title = input.title.trim();
    if (!goal || !title) throw new Error("Project title and goal are required");
    await this.sign(account);
    const id = this.id("fx-branch");
    const b: Branch = { id, address: demoAddress(`w1-fixture-branch-${id}`), projectTitle: title, goal, direction: null, parent: null, creator: account.address, imdProjectId: null, head: null, latestCheckpoint: `${id}:0`, frozen: false, createdAt: now() };
    this.s.branches.unshift(b);
    this.s.checkpoints.push({ id: `${id}:0`, branchId: id, revision: 0, jobId: null, funder: null, changed: [], assets: [], createdBy: "create", manifestKeccak: null, at: now(), git: notRequested, site: notRequested });
    this.save();
    return structuredClone(b);
  }

  async propose(account: Account, d: ProposalDraft) {
    const cp = this.latest(d.branchId);
    if (d.anchor !== cp.id) throw new StaleProposalError();
    const inputs = d.inputKeys.map((k) => {
      const a = cp.assets.find((x) => x.assetKey === k);
      if (!a) throw new Error(`Input asset ${k} is absent from the current checkpoint`);
      return { assetKey: k, revision: a.revision, sha256: a.descriptor.sha256 };
    });
    if (d.mode === "update" && !d.inputKeys.includes(d.targetKey)) throw new Error("The update target must be included as an input");
    await this.sign(account);
    const p: Proposal = { id: this.id("fx-prop"), branchId: d.branchId, proposer: account.address, anchor: cp.id, kind: d.kind, mode: d.mode, targetKey: d.targetKey, inputs, requirement: d.requirement, publish: d.publish, status: "current", createdAt: now() };
    this.s.proposals.push(p);
    this.save();
    return structuredClone(p);
  }

  async approve(account: Account, quote: FeeQuote, amount: bigint) {
    const { hash } = await this.sign(account);
    this.s.allowances[`${account.address}:${quote.spender}`] = amount.toString();
    this.save();
    return hash;
  }

  async sponsor(account: Account, proposalId: string, maxFee: bigint, quote: FeeQuote) {
    const p = this.s.proposals.find((x) => x.id === proposalId);
    if (!p) throw new Error("Proposal not found");
    const b = this.branch(p.branchId);
    if (b.frozen) throw new Error("Branch purchases are frozen after status 2 or an unknown failure");
    if (p.status !== "current" || p.anchor !== b.latestCheckpoint || quote.anchor !== b.latestCheckpoint) throw new StaleProposalError();
    this.assertIdle(b.id);
    if (quote.spender !== b.address || quote.parentJobId !== b.head) throw new Error("Quote does not match this branch");
    if (maxFee < PRICE) throw new Error("The maximum fee is below the current price");
    const allowance = BigInt(this.s.allowances[`${account.address}:${b.address}`] ?? "0");
    if (allowance < PRICE) throw new Error("Confirm an approval for the exact price first");
    this.purchases.add(b.id);
    try {
    const { hash, nonce } = await this.sign(account);
    if (p.status !== "current" || p.anchor !== b.latestCheckpoint) throw new StaleProposalError();
    this.s.allowances[`${account.address}:${b.address}`] = "0"; // exact transfer, leftover cleared
    const sp: State["sponsorships"][number] = { id: this.id("fx-sp"), branchId: b.id, proposalId, sponsor: account.address, maxFee: maxFee.toString(), txHash: hash, nonce, attempt: 1, stages: freshStages(), note: null, checkpointId: null, updatedAt: now() };
    sp.stages.approval = "confirmed";
    p.status = "sponsored";
    if (this.controls.txOutcome === "unknown") {
      sp.stages.purchase = "unknown";
      sp.note = "Receipt missing. Reconcile the original hash and nonce after reload";
      sp.unknownResolves = true;
      sp.callbackOutcome = this.controls.callbackOutcome;
    } else {
      await this.advance(sp, p);
    }
    this.s.sponsorships.push(sp);
    this.save();
    return this.toSponsorship(sp);
    } finally { this.purchases.delete(b.id); }
  }

  /** Moves a confirmed purchase through admission/execution/callback per the demo control. */
  private async advance(sp: State["sponsorships"][number], p: Proposal) {
    sp.stages.purchase = "confirmed";
    sp.stages.admission = "confirmed";
    sp.stages.execution = "pending";
    sp.updatedAt = now();
    const outcome = sp.callbackOutcome ?? this.controls.callbackOutcome;
    const b = this.branch(sp.branchId);
    if (outcome === "missing") {
      sp.stages.callback = "pending";
      sp.note = "Callback pending. No timeout unlock, automatic refund or automatic retry";
    } else if (outcome === "refused") {
      sp.stages.execution = "confirmed";
      sp.stages.callback = "refused";
      sp.note = "Authenticated status 1 refusal. An explicit paid retry must use the identical body";
    } else if (outcome === "failed") {
      sp.stages.execution = "failed";
      sp.stages.callback = "failed";
      sp.stages.binding = "frozen";
      b.frozen = true;
      sp.note = "Status 2 callback: branch purchases are frozen";
    } else {
      sp.stages.execution = "confirmed";
      sp.stages.callback = "confirmed";
      if (outcome === "bad_binding") {
        sp.stages.binding = "failed";
        sp.note = "Invalid binding. The previous checkpoint remains. Correct the binding without another purchase";
      } else {
        await this.bind(sp, p);
      }
    }
  }

  private async bind(sp: State["sponsorships"][number], p: Proposal) {
    const b = this.branch(sp.branchId);
    const prev = this.latest(b.id);
    const rev = prev.revision + 1;
    const jobId = `fx-job-${b.id}-${rev}`;
    const bytes = await this.produce(p, prev);
    const path = `assets/${p.targetKey}.${ext[p.kind]}`;
    this.s.files[`${jobId}:${path}`] = { b64: toBase64(bytes.bytes), available: true };
    const cpId = `${b.id}:${rev}`;
    const v: AssetVersion = { assetKey: p.targetKey, kind: p.kind, revision: rev, producerJobId: jobId, descriptor: { name: `${p.targetKey}.${ext[p.kind]}`, path, mediaType: mediaOf[p.kind], bytes: bytes.bytes.length, sha256: bytes.sha }, originBranchId: b.id, originCheckpoint: cpId };
    const assets = [...prev.assets.filter((a) => a.assetKey !== p.targetKey), v].sort((x, y) => x.assetKey.localeCompare(y.assetKey));
    this.s.checkpoints.push({
      id: cpId, branchId: b.id, revision: rev, jobId, funder: sp.sponsor, changed: [p.targetKey], assets, createdBy: "round",
      manifestKeccak: keccak256(toHex(`manifest-${jobId}`)), at: now(),
      git: { state: "pending", url: null, observedAt: null },
      site: p.publish ? { state: "pending", url: null, observedAt: null } : notRequested,
    });
    b.head = jobId;
    b.imdProjectId = b.imdProjectId ?? `fx-project-${b.id}`;
    b.latestCheckpoint = cpId;
    // Another round moves the anchor: remaining current proposals become stale and need resubmission.
    for (const q of this.s.proposals) if (q.branchId === b.id && q.status === "current") q.status = "stale";
    sp.stages.binding = "confirmed";
    sp.stages.files = "pending";
    sp.stages.git = "pending";
    sp.stages.publication = p.publish ? "pending" : "not_applicable";
    sp.checkpointId = cpId;
    sp.note = "Checkpoint bound. File verification updates after the actual output bytes are verified locally";
  }

  private async produce(p: Proposal, prev: Checkpoint): Promise<{ bytes: Uint8Array; sha: Hex }> {
    const inputs = p.inputs.map((i) => prev.assets.find((a) => a.assetKey === i.assetKey)!);
    let bytes: Uint8Array;
    if (p.kind === "image") bytes = fromBase64(PNG_AMBER_B64);
    else if (p.kind === "document") bytes = utf8(`# ${p.targetKey}\n\n${p.requirement}\n\nInputs: ${inputs.map((i) => `${i.assetKey}@R${i.revision}`).join(", ") || "None"}\n`);
    else {
      const imgs = inputs.filter((i) => i.kind === "image").map((i) => `<img alt="${i.assetKey}" src="data:image/png;base64,${this.s.files[`${i.producerJobId}:${i.descriptor.path}`]?.b64 ?? ""}">`);
      const target = inputs.find((i) => i.assetKey === p.targetKey && i.kind === "html");
      const saved = target ? this.s.files[`${target.producerJobId}:${target.descriptor.path}`] : null;
      const original = saved ? new TextDecoder().decode(fromBase64(saved.b64)) : `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><title>${p.targetKey}</title></head><body><h1>${p.targetKey}</h1></body></html>\n`;
      const addition = `<!-- marker:R${prev.revision + 1} --><p>${p.requirement.replace(/[<>&]/g, "")}</p>${imgs.join("")}`;
      bytes = utf8(original.replace(/<\/body>/i, `${addition}</body>`));
    }
    return { bytes, sha: await sha256Hex(bytes) };
  }

  async retryRefused(account: Account, sponsorshipId: string, maxFee: bigint, quote: FeeQuote) {
    const sp = this.s.sponsorships.find((x) => x.id === sponsorshipId);
    if (!sp || sp.stages.callback !== "refused" || sp.retriedBy) throw new Error("Only an authenticated status 1 refusal without a later retry can be retried");
    const p = this.s.proposals.find((x) => x.id === sp.proposalId)!;
    const b = this.branch(sp.branchId);
    if (b.frozen) throw new Error("Branch is frozen");
    this.assertIdle(b.id, sp.id);
    if (p.anchor !== b.latestCheckpoint || quote.anchor !== b.latestCheckpoint) throw new StaleProposalError();
    if (quote.spender !== b.address || quote.parentJobId !== b.head) throw new Error("Quote does not match this branch");
    if (maxFee < PRICE) throw new Error("Maximum fee is below the current price");
    // The retry is a new funded purchase: it needs this account's own exact allowance to the Branch.
    const allowanceKey = `${account.address}:${b.address}`;
    if (BigInt(this.s.allowances[allowanceKey] ?? "0") < PRICE) throw new Error("Confirm an approval for the exact price first");
    this.purchases.add(b.id);
    try {
    const { hash, nonce } = await this.sign(account);
    if (sp.retriedBy) throw new Error("This refusal already has a retry");
    this.s.allowances[allowanceKey] = "0"; // exact transfer, leftover cleared
    const retry: State["sponsorships"][number] = { ...structuredClone(sp), id: this.id("fx-sp"), sponsor: account.address, maxFee: maxFee.toString(), txHash: hash, nonce, attempt: sp.attempt + 1, stages: freshStages(), note: null, checkpointId: null, updatedAt: now() };
    retry.stages.approval = "confirmed";
    sp.retriedBy = retry.id;
    if (this.controls.txOutcome === "unknown") {
      retry.stages.purchase = "unknown";
      retry.note = "Retry receipt missing. Reconcile this retry's original hash and nonce";
      retry.unknownResolves = true;
      retry.callbackOutcome = this.controls.callbackOutcome;
    } else {
      await this.advance(retry, p);
    }
    this.s.sponsorships.push(retry);
    this.save();
    return this.toSponsorship(retry);
    } finally { this.purchases.delete(b.id); }
  }

  async resubmitBinding(account: Account, sponsorshipId: string) {
    const sp = this.s.sponsorships.find((x) => x.id === sponsorshipId);
    if (!sp || sp.stages.binding !== "failed") throw new Error("Only a failed binding can be submitted again");
    await this.sign(account);
    await this.bind(sp, this.s.proposals.find((x) => x.id === sp.proposalId)!);
    sp.updatedAt = now();
    this.save();
    return this.toSponsorship(sp);
  }

  async fork(account: Account, input: { branchId: string; checkpointId: string; direction: string }) {
    const cp = this.s.checkpoints.find((c) => c.id === input.checkpointId && c.branchId === input.branchId);
    if (!cp || cp.createdBy !== "round" || cp.revision <= 0) throw new Error("Fork an accepted historical checkpoint");
    if (!input.direction.trim()) throw new Error("Describe the fork direction");
    const parent = this.branch(input.branchId);
    await this.sign(account);
    const id = this.id("fx-branch");
    const b: Branch = { id, address: demoAddress(`w1-fixture-branch-${id}`), projectTitle: `${parent.projectTitle} (fork)`, goal: parent.goal, direction: input.direction.trim(), parent: { branchId: parent.id, checkpointId: cp.id }, creator: account.address, imdProjectId: null, head: null, latestCheckpoint: `${id}:0`, frozen: false, createdAt: now() };
    this.s.branches.unshift(b);
    this.s.checkpoints.push({ id: `${id}:0`, branchId: id, revision: 0, jobId: null, funder: null, changed: [], assets: structuredClone(cp.assets), createdBy: "fork", manifestKeccak: null, at: now(), git: notRequested, site: notRequested });
    this.save();
    return structuredClone(b);
  }

  async reconcile(record: RecoveryRecord) {
    await wait(this.latency);
    if (record.adapterKind !== "fixture" || record.chainId !== FIXTURE_CHAIN_ID) return null;
    const sp = this.s.sponsorships.find((x) => x.id === record.sponsorshipId && x.txHash === record.txHash && x.nonce === record.nonce && x.sponsor === record.account && x.branchId === record.branchId && x.proposalId === record.proposalId);
    if (!sp) return null;
    if (sp.stages.purchase === "unknown" && sp.unknownResolves) {
      sp.unknownResolves = false;
      await this.advance(sp, this.s.proposals.find((x) => x.id === sp.proposalId)!);
      sp.note = `Reconciled original hash and nonce ${sp.nonce} : transaction mined. ${sp.note ?? ""}`;
      this.save();
    }
    return this.toSponsorship(sp);
  }

  async fetchFile(d: FileDescriptor, producerJobId: string) {
    await wait(this.latency);
    const f = this.s.files[`${producerJobId}:${d.path}`];
    if (!f || !f.available) throw new Error(`File unavailable (404): ${d.path}, Producer job ${producerJobId}`);
    return fromBase64(f.b64);
  }

  /** Demo-only: deliver a missing callback for a pending sponsorship. */
  async deliverCallback(sponsorshipId: string) {
    const sp = this.s.sponsorships.find((x) => x.id === sponsorshipId);
    if (!sp || sp.stages.callback !== "pending") return;
    const p = this.s.proposals.find((x) => x.id === sp.proposalId)!;
    sp.stages.execution = "confirmed";
    sp.stages.callback = "confirmed";
    await this.bind(sp, p);
    this.save();
  }

  /** Demo-only: observe Git for a checkpoint. */
  observeGit(checkpointId: string) {
    const c = this.s.checkpoints.find((x) => x.id === checkpointId);
    if (!c) return;
    c.git = { state: "observed", url: `https://github.com/imd-fixture/relay-demo/commit/${c.revision}`, observedAt: now() };
    for (const sp of this.s.sponsorships) if (sp.checkpointId === checkpointId) sp.stages.git = "confirmed";
    this.save();
  }
}
