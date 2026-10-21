// The site's single configuration file: metadata, A1 source pin and wallet chain.
// A1 source is delivered; no verified product deployment is supplied (A1_INTEGRATION_PENDING).
import { foundry, mainnet } from "viem/chains";

export const SITE_NAME = "CTO 中继站";
export const SITE_DESCRIPTION = "浏览公开项目、提出工作、明确资助、查看真实资产与历史，并从已接受的检查点分叉。";

/** What W1 observed about A1 at build time. Updated by hand at each integration step. */
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
