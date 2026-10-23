// The site's single configuration file: metadata, A1 source pin and wallet chain.
// Historical A1 ancestry below is retained separately from the live handoff/source pin.
import { foundry, mainnet } from "viem/chains";

export const SITE_NAME = "STEPS · Stepstoke";
export const SITE_EXPANDED_NAME = "Stepstoke";
export const SITE_SLOGAN = "Build on every step.";
export const SITE_X_URL = "https://x.com/stepstoke";
export const SITE_DESCRIPTION = "Browse public projects, propose work, fund execution and continue from accepted checkpoints.";

/** Historical W1 observation. Actual live addresses/source come only from imd-deployment.json. */
export const A1_SOURCE = {
  jobId: "d5530989-b886-4f9d-80dd-44d26d85ffd2",
  submittedBodySha256: "3683b19c9c39d67b5c679641e4755e7914f471fe41329d1a3b2dfb1a34a58c77",
  checkedAt: "2026-10-20",
  observedState: "completed",
  delivery: "https://github.com/identity-md-launches/launch-2294-build-cto-relay-station/tree/9b0294e7ab19060bd00c489fbe032cf248528e0d" as string | null,
};

/**
 * A1's objective names Ethereum Intake v2, so the wallet control targets Ethereum mainnet.
 * This only drives the connect / switch-network control; no business call uses it before verified integration.
 */
export const WALLET_CHAIN = mainnet;
export const LOCAL_CHAIN = foundry;
