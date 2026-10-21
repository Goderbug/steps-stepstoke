// UI-domain types for W1. These describe what the interface shows and asks for.
// They are NOT an A1 contract ABI: the live adapter must map A1's actual SDK onto them.

export type Hex = `0x${string}`;
export type AssetKind = "document" | "html" | "image";
export type ProposalMode = "create" | "update";

/** Limits and switches that A1 fixes in its immutable capability config. Never hardcoded by W1. */
export interface Capabilities {
  source: string; // where these values came from (A1 config hash, or the fixture label)
  chainId: number;
  chainName: string;
  enabledKinds: AssetKind[];
  maxAssets: number;
  maxInputs: number;
  maxOutputs: number;
  maxBytes: Record<AssetKind, number>;
  maxRequestBodyBytes: number;
  maxTextBytes?: number;
  maxGoalBytes?: number;
  maxAssetNameBytes?: number;
  sitePublication: boolean; // whether A1's release config allows publishing at all
  imageEditing: false; // A1 disables unverified image reference/editing modes
  mediaTypes: Record<AssetKind, string[]>;
}

export interface FileDescriptor {
  name: string;
  path: string;
  mediaType: string;
  bytes: number;
  sha256: Hex; // file content SHA-256, never the manifest keccak
}

export interface AssetVersion {
  assetKey: string; // slot key
  kind: AssetKind;
  revision: number; // round that produced these bytes
  producerJobId: string;
  descriptor: FileDescriptor;
  originBranchId: string; // original provenance (survives forks)
  originCheckpoint: string;
}

export interface Checkpoint {
  id: string; // checkpoint id as A1 records it
  branchId: string;
  revision: number;
  jobId: string | null; // IMD job that produced it (null for root/fork genesis)
  funder: Hex | null;
  changed: string[]; // asset keys changed in this round
  assets: AssetVersion[]; // complete asset set at this checkpoint
  createdBy: "create" | "round" | "fork";
  manifestKeccak: Hex | null; // keccak256 of the raw manifest; distinct from any file SHA-256
  at: string;
  git: ObservedStatus;
  site: ObservedStatus;
}

export interface ObservedStatus {
  state: "not_requested" | "pending" | "observed" | "unavailable";
  url: string | null;
  observedAt: string | null;
}

export interface Proposal {
  id: string;
  branchId: string;
  proposer: Hex;
  anchor: string; // checkpoint the proposal is bound to
  kind: AssetKind;
  mode: ProposalMode;
  targetKey: string;
  inputs: { assetKey: string; revision: number; sha256: Hex }[];
  requirement: string;
  publish: boolean;
  status: "current" | "stale" | "sponsored";
  createdAt: string;
}

export interface Branch {
  id: string;
  address: Hex | null; // A1 Branch contract (approval spender); null in the unavailable adapter
  projectTitle: string;
  goal: string;
  direction: string | null; // fork direction, fixed at fork time
  parent: { branchId: string; checkpointId: string } | null;
  creator: Hex;
  imdProjectId: string | null; // child branches start without one
  head: string | null; // latest bound job
  latestCheckpoint: string;
  frozen: boolean;
  createdAt: string;
}

export interface FeeQuote {
  price: bigint; // IMD price from A1 priceOf at quote time
  token: string;
  decimals: number;
  quotedAt: string;
  anchor: string;
  action: "job.open" | "job.continue";
  parentJobId: string | null;
  proposalId?: string;
  bodyHash?: string;
  bodyBytes?: number;
  bodyText?: string;
  spender: Hex; // the A1 Branch, never the IMD job contract directly
}

export type StageState =
  | "not_started"
  | "pending"
  | "confirmed"
  | "unknown"
  | "refused"
  | "failed"
  | "frozen"
  | "not_applicable";

export const STAGES = [
  "approval",
  "purchase",
  "admission",
  "execution",
  "callback",
  "binding",
  "files",
  "git",
  "publication",
] as const;
export type StageName = (typeof STAGES)[number];

export interface Sponsorship {
  id: string;
  branchId: string;
  proposalId: string;
  sponsor: Hex;
  maxFee: bigint;
  txHash: Hex | null;
  nonce: number | null;
  attempt: number;
  stages: Record<StageName, StageState>;
  note: string | null;
  checkpointId: string | null;
  updatedAt: string;
}

export interface ProposalDraft {
  branchId: string;
  anchor: string;
  kind: AssetKind;
  mode: ProposalMode;
  targetKey: string;
  inputKeys: string[];
  requirement: string;
  publish: boolean;
}

export interface Account {
  address: Hex;
  chainId: number;
  label: string;
}

/** Capability flags the adapter advertises. The UI disables what is not supported. */
export interface AdapterCapabilities {
  read: boolean;
  createBranch: boolean;
  propose: boolean;
  sponsor: boolean;
  fork: boolean;
  bindingRetry: boolean;
  realWalletSigning: boolean;
}

export class IntegrationPendingError extends Error {
  readonly code = "A1_INTEGRATION_PENDING";
  constructor(what: string) {
    super(`A1_INTEGRATION_PENDING: ${what}`);
  }
}

export class UserRejectedError extends Error {
  readonly code = "USER_REJECTED";
  constructor() {
    super("用户在钱包中拒绝了签名");
  }
}

export class StaleProposalError extends Error {
  readonly code = "STALE_PROPOSAL";
  constructor() {
    super("提案绑定的检查点已不是当前检查点，需要重新提交提案");
  }
}

/** Public reads have no signing identity. The empty display value is never passed to the SDK. */
export type DisplayAccount = Account | { address: ""; chainId: number; label: string };
export function signingAccount(a: DisplayAccount): Account {
  if (!a.address) throw new Error("请先连接钱包；公开读取不需要账户");
  return a as Account;
}
