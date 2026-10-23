# STEPS release correction v1

The goal is official Ethereum deployment, verified contracts and a connected public English STEPS website. This correction follows the user's request to fix the delivery and prioritize formal release. It is not another public demo or a new contract launch.

## Source and review boundary

The official source is [IMD launch 2455, commit 751f3901d4453e1477828e4f7ef0d6af8bc03485](https://github.com/identity-md-launches/launch-2455-relayencoder-relayverifier-relayfactory/tree/751f3901d4453e1477828e4f7ef0d6af8bc03485). Job [09baba31-7451-4891-9562-4c27d9111a09](https://explorer.imd.fun/jobs/09baba31-7451-4891-9562-4c27d9111a09) delivered it and launch cad0c789-2611-4392-bec0-456cb8e57d2c passed seven official admission checks. Admission is not deployment: the last recorded response had no deployment artifacts. No public addresses are invented here.

Every Solidity input, compiler setting, distributed ABI, creation-bytecode hash and normalized runtime hash is unchanged by these corrections. The deployed contract source must remain pinned to the actual official delivery even when the website uses this later corrected SDK/configuration commit. `tools/import-deployment.mjs` verifies every Solidity input against that actual contract-source commit.

Root reviewed the diff and independently reproduced the delivery's tests. This is a self-review plus reproduction; it does not claim a second newly commissioned security audit. Full evidence and its hashes are in `evidence.tar.xz` and `evidence-index.json`. `review.json` records exact counts and limitations.

## Corrections and the compatibility decision

1. Re-froze the complete clean build after the two already-delivered release tests were included. The inventory had 48 inputs; the actual clean build has 50. No bytecode was changed to satisfy the checker.
2. Retained the audited eight-unit segment-flush work charge. This intentionally narrows the pre-audit parser domain: some escape-heavy documents formerly accepted by the local candidate are now rejected. Removing the charge would restore a reproduced gas-exhaustion risk. This is an explicit engineering policy decision under the current request to fix and release, not a claim that the earlier no-compatibility-change instruction was satisfied.
3. Corrected the published work formula to include `8 * segmentFlushes`. The charge applies to the first simple escape in each consecutive run in a retained string or any key. Ignored metadata string values and Unicode escapes are not charged. The total remains 65,536 work units; a 32 KiB document is not necessarily accepted.
4. Restored the separate generic strict JSON parser's 256-token cap in both SDK entrypoints, matching compiled `StrictJSON.sol`. The manifest projection keeps its audited 1,024-token capacity. Regression tests cover 256/257 generic tokens and retain all existing manifest capacity/segment tests.

## Reproduced results

- Clean build, strict release inventory and exact bytecode equivalence: PASS.
- Contract tests: 180 passed, 0 failed, 0 skipped. SDK tests: 89 passed. Frontend unit tests: 100 passed. Frontend production build: PASS.
- Actual compiled generic parser versus Node/browser SDK at 256/257 tokens: PASS.
- Original 32,768-byte result with the exact 16-asset witness and unchanged calldata: successful local receipt at 13,687,379 gas, below the 16,777,216 declared ceiling.
- Local atomic deployment and handoff importer: PASS, including actual creation traces, immutable substitutions and all exported asset hashes.
- Actual local public-mode browser rehearsal: 11 recorded checks, 8 distinct scenarios; no page errors. It covers contract/receipt/network drift, exact file bytes, invalid file rejection and read-only controls. Duplicate repeated drift scenarios are not counted as additional unique coverage.

These are finite local checks with mock Intake/token and local transport where stated. They do not prove live IMD result compatibility, a universal gas maximum, public RPC availability or a successful public deployment. The original candidate's 184-test audit statement is not used: the independently reproduced delivered suite has 180 tests.

## Remaining release gates

Keep `productionDeployment: null`, `liveCompatibility: NOT_RUN` and `productionReady: false` until actual evidence justifies a transition. Deployment verification must obtain the successful canonical receipt, actual outer sender and creation caller, three actual contract addresses, matching code/constructors and pinned official source/attestation. Website hosting follows that acceptance and must preserve readiness gates.

[Known liveness limits](../../LIMITS.md) remain: missing/underfunded callbacks, oversized callback URIs, zero result hashes, unbindable authenticated results and permanent failure can stop a paid branch. There is no administrative unlock, timeout or refund mechanism. The SDK can detect an unsupported delivered format before binding, but cannot guarantee its shape before a job is paid. Do not describe these constraints as fixed or silently enable paid public operations. [Live validation](../../LIVE-VALIDATION.md) remains unrun and requires its own concrete bounded spending decision.
