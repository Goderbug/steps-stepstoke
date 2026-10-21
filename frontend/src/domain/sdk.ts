// One bridge to the delivered browser runtime. No Node entrypoint is bundled.
// @ts-expect-error The upstream SDK is native JavaScript; ABI and input validation run at runtime.
import * as browserSDK from "../../../sdk/browser.mjs";
// @ts-expect-error The config verifier is runtime-neutral JavaScript.
import * as deploymentConfig from "../../../sdk/config.mjs";
export const sdk = browserSDK as any;
// @ts-expect-error Runtime-neutral deployment verifier.
import { verifyBoundRuntime } from "../../../sdk/deployment.mjs";
export const verifyBranchRuntime = verifyBoundRuntime;
export const deployment = deploymentConfig as any;
export { default as release } from "../../../config/release.json";
