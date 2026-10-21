import type { IntegrationStatus, RelayAdapter } from "./adapter";
import { IntegrationPendingError } from "./types";
import { A1_SOURCE } from "../config";

/**
 * A1 source/Node SDK is delivered, but its release has no product deployment and is not
 * production-ready. The tested local browser bridge lives in ChainAdapter. Public operations
 * fail closed until a verified public deployment is supplied; no address is synthesized here.
 */
const pending = (what: string) => () => Promise.reject(new IntegrationPendingError(what));

export function createLiveAdapter(): RelayAdapter {
  const status: IntegrationStatus = {
    state: "A1_INTEGRATION_PENDING",
    summary: "A1 and its browser SDK are integrated locally. productionDeployment is null; public operations are unavailable.",
    missing: [
      "Verified chain ID, Factory address and public RPC",
      
      
    ],
    a1: { ...A1_SOURCE },
  };
  return {
    kind: "live",
    label: "A1 public",
    capabilities: {
      read: false,
      createBranch: false,
      propose: false,
      sponsor: false,
      fork: false,
      bindingRetry: false,
      realWalletSigning: false,
    },
    status: () => status,
    getCapabilities: pending("Capabilities"),
    listBranches: pending("Project list"),
    getBranch: pending("Branch read"),
    getHistory: pending("History read"),
    getProposals: pending("Proposal read"),
    getSponsorships: pending("Funding status read"),
    quoteFee: pending("Fee quote"),
    createBranch: pending("Create root branch"),
    propose: pending("SubmitProposal"),
    approve: pending("Token approval"),
    sponsor: pending("Funding"),
    retryRefused: pending("Explicit refusal retry"),
    resubmitBinding: pending("Submit binding again"),
    fork: pending("Fork"),
    reconcile: pending("Transaction reconciliation"),
    fetchFile: pending("File download"),
  };
}
