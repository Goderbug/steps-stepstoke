import type {
  Account,
  AdapterCapabilities,
  Branch,
  Capabilities,
  Checkpoint,
  FeeQuote,
  FileDescriptor,
  Hex,
  Proposal,
  ProposalDraft,
  Sponsorship,
} from "./types";

/** What the UI may persist locally to help recovery. Never treated as business truth. */
export interface RecoveryRecord {
  sponsorshipId: string;
  branchId: string;
  proposalId: string;
  account: Hex;
  chainId: number;
  adapterKind: "fixture" | "live";
  txHash: Hex | null;
  nonce: number | null;
  savedAt: string;
}

export interface IntegrationStatus {
  state: "ready" | "A1_INTEGRATION_PENDING";
  summary: string;
  missing: string[];
  a1: { jobId: string; submittedBodySha256: string; checkedAt: string; observedState: string; delivery: string | null };
}

/**
 * The single typed boundary between W1's interface and A1. Every capability is explicit; a
 * method the adapter cannot perform must throw instead of inventing a result.
 */
export interface RelayAdapter {
  readonly kind: "fixture" | "live";
  readonly routeBase?: "local" | "ethereum";
  fetchOriginalResult?(sponsorshipId: string): Promise<Uint8Array>;
  readonly label: string;
  readonly capabilities: AdapterCapabilities;
  status(): IntegrationStatus;
  getCapabilities(): Promise<Capabilities>;
  listBranches(): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch>;
  getHistory(branchId: string): Promise<Checkpoint[]>;
  getProposals(branchId: string): Promise<Proposal[]>;
  getSponsorships(branchId: string): Promise<Sponsorship[]>;
  quoteFee(proposalId: string): Promise<FeeQuote>;
  createBranch(account: Account, input: { title: string; goal: string }): Promise<Branch>;
  propose(account: Account, draft: ProposalDraft): Promise<Proposal>;
  approve(account: Account, quote: FeeQuote, amount: bigint): Promise<Hex>;
  sponsor(account: Account, proposalId: string, maxFee: bigint, quote: FeeQuote): Promise<Sponsorship>;
  /** Identical-body retry after an authenticated status-1 refusal: a new funded attempt with a fresh quote and exact allowance. */
  retryRefused(account: Account, sponsorshipId: string, maxFee: bigint, quote: FeeQuote): Promise<Sponsorship>;
  resubmitBinding(account: Account, sponsorshipId: string, raw?: Uint8Array): Promise<Sponsorship>;
  fork(account: Account, input: { branchId: string; checkpointId: string; direction: string }): Promise<Branch>;
  reconcile(record: RecoveryRecord): Promise<Sponsorship | null>;
  fetchFile(descriptor: FileDescriptor, producerJobId: string): Promise<Uint8Array>;
}
