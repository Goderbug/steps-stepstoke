// Public-mode entry state for the landing page. It only reads the confirmed deployment handoff
// that a later platform stage places beside the export (imd-deployment.json) through the SDK's
// digest-checked loader. On-chain verification (chain, receipt, trace, runtime code) happens when
// the #/ethereum route builds its ChainAdapter; this probe never invents or accepts an address.
import { sdk, release } from "./sdk";

export type PublicProbe =
  | { state: "checking" }
  /** No handoff beside the export: the candidate is undeployed. */
  | { state: "undeployed"; reason: string }
  /** A handoff exists but failed its digest/identity checks: that deployment is disabled. */
  | { state: "rejected"; reason: string }
  /** Digest-checked handoff present. Reads still require the #/ethereum on-chain verification. */
  | { state: "handoff"; identity: string; factory: string; deploymentBlock: number };

export const UNAVAILABLE = "Confirmed deployment handoff unavailable";
export const UNDEPLOYED_BUILD: PublicProbe = { state: "undeployed", reason: "This build records productionDeployment: null. No deployment handoff was supplied." };

export async function probePublicDeployment(fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<PublicProbe> {
  try {
    const config = await sdk.loadPublicHandoff({ fetch: fetchImpl });
    if (config.kind !== "ETHEREUM_DEPLOYMENT" || config.chainId !== 1) return { state: "rejected", reason: "Handoff is not an Ethereum chain 1 deployment" };
    return { state: "handoff", identity: config.identity, factory: config.contracts.factory, deploymentBlock: config.deploymentBlock };
  } catch (e) {
    const message = (e as Error).message;
    // A missing file (404, network or CORS failure) means no handoff was delivered with this export.
    if (message === UNAVAILABLE || e instanceof TypeError) return { state: "undeployed", reason: UNAVAILABLE };
    return { state: "rejected", reason: e instanceof SyntaxError ? "Deployment handoff is not valid JSON" : message };
  }
}

/** Actual public facts from the frozen release configuration, not from fixtures or mocks. */
export const PUBLIC_FACTS = {
  chainId: release.intendedChainId as number,
  chainName: "Ethereum mainnet",
  paymentToken: "IMD",
  imd: release.imd as string,
  intake: release.intake as string,
  actions: Object.keys(release.actions).map(a => `job.${a}`),
  productionDeployment: release.productionDeployment as null,
  liveCompatibility: release.liveCompatibility as string,
  productionReady: release.productionReady as boolean,
  officialX: release.officialX as string,
};
