# A1 local review fixes — 2026-10-21

This is the local repair candidate based on IMD delivery commit `9b0294e7ab19060bd00c489fbe032cf248528e0d`, repository `identity-md-launches/launch-2294-build-cto-relay-station`. It is not a new Swarm delivery, a public deployment, or final product acceptance. Policy identity is now `CTO-Relay-A1/2/fixed-profiles/unpublished`; current artifact hashes are in [`config/release.json`](../../../config/release.json).

## Disposition

| Finding | Result |
| --- | --- |
| Medium: different slots can reuse a public output name/path | Fixed in on-chain admission and SDK preparation. Also reject file/directory ancestor conflicts in both directions. Updating the same slot and legitimate shared directories remain allowed. |
| Low: Markdown/PNG can occupy top-level `dist/` | Fixed. Only the HTML slot can use `dist/index.html`. |
| Medium: irrelevant result metadata exhausts the binding parser | Demonstrated failures repaired with a metadata-aware parser and SDK counterpart. Whole raw bytes remain authenticated; syntax, duplicate decoded keys, Unicode and required fields remain checked. **The general liveness risk is mitigated, not fully closed:** an authenticated document outside the finite supported envelope can still stop the Branch. |
| Informational: a refused request pins the retry body | Intentional policy retained. An explicit retry cannot switch proposal/body or silently purchase a different job. |

The parser retains only acceptance fields while validating all metadata. Its limits include 32,768 raw bytes and a combined byte/structure work budget; see [exact limits](../../LIMITS.md). No admin override, timeout unlock, rewritten result hash, automatic rebuy, or refund promise was added.

## Verification of this candidate

| Check | Result | Evidence |
| --- | --- | --- |
| Full contracts | **125 passed, 0 failed**, including payment, callbacks, continuation, forks, fuzz and stateful invariants | [forge-test.txt](forge-test.txt) |
| SDK / CLI | **27 passed, 0 failed** | [node-test.txt](node-test.txt) |
| Independent parser review | **6 passed**, including 3,000 fuzz runs comparing ignored and retained strings against the original parser, plus decoded-content checks | [Independent review](independent-review.md), [raw log](independent-scanner-differential.txt) |
| SDK → actual local contracts | **7 accepted rounds, 8 mock purchases, 33 recorded transactions**; all five profiles, preserved assets, historical fork, child continuation, refusal retry and bad-witness recovery | [local-integration.json](local-integration.json) |
| Larger result through the entire SDK/EVM flow | **12,128 raw bytes**, 40 source entries and a 2,048-byte summary; callback and binding authenticate the same unchanged raw document | [Local flow](local-integration.json) |
| Formatting / fixture integrity | Passed; PNG CRC, decompression and exact inline Base64 checked | [format-check.txt](format-check.txt), [fixture-check.txt](fixture-check.txt) |
| ABI / release bytecode | Five ABIs match the build; all four production artifacts fit the enforced size limits | [measurement-check.txt](measurement-check.txt), [production-contract-sizes.txt](production-contract-sizes.txt) |

These are local contracts and real SDK calls with **mock Intake/token and fixture outputs**. They do not execute the IMD swarm, establish public-chain compatibility, validate W1 integration, or spend real IMD/ETH. The 33 recorded transactions exclude mock setup transactions; eight mock purchases are asserted by the runner.

The environment used Node 22.12.0, Forge/Anvil 1.8.5 and solc 0.8.26 with the project's Cancun/optimizer/IR configuration. The original delivery used a different Foundry version; its logs are historical. Signature-cache warnings in the new Forge log concern sandbox writes to a user cache, not failing tests.

## Regression and resource evidence

- Original source failed seven of nine initial mapping regressions; the intermediate exact-path guard failed three of four prefix regressions. Final mapping coverage is 13/13. See [original baseline](mapping-baseline.txt), [prefix baseline](mapping-prefix-baseline.txt), [final mapping run](mapping-regression-final.txt).
- Original source failed all three demonstrated metadata cases: raw size above 8 KiB, 33 structured sources, and a 2 KiB unknown file-description string. Both negative controls passed. Final manifest coverage is 15/15. See [baseline](manifest-baseline.txt), [current traces](manifest-envelope-trace.txt), [summary](manifest-summary.json).
- The corrected SDK baseline is 3 failures / 2 controls passing; current coverage passes. An earlier baseline had a shallow-copied fixture that leaked metadata into the next test; the fixture was corrected, and the earlier log is not used as the final comparison. See [corrected baseline](sdk-baseline-corrected.txt).
- One unchanged historical IMD result (1,230 bytes; SHA-256 `c321949efc72b3d546a404d9a483a1bc102e50dff08ab32e64eae4cba2d823b2`) is replayed locally. A separate synthetic 33-entry result uses that observed source descriptor; it is not represented as a new real IMD execution.
- Maximum-witness tests use all 16 slots and a 13,280-byte ABI witness. Original maximum shapes now bind 32,768-byte manifests at 12,580,654 / 13,129,868 / 13,111,987 execution gas. Additional combined complexity, long-number, whitespace and escaped-key cases are measured; the highest recorded binding is **13,849,065 gas**, below the unchanged 14,000,000 assertion. See [maximum traces](maximum-binding-trace.txt) and [manifest traces](manifest-envelope-trace.txt). This is tested coverage, not a mathematical upper bound for every accepted JSON shape. Intrinsic/calldata gas is additional.
- Factory initcode is **45,535 bytes**; Verifier runtime is **14,372 bytes**. Current complete artifact measurements are in [measurements.json](measurements.json).

The first extended local flow exposed a test-harness budget error: its 12,128-byte raw result needed an estimated 508,290 gas for the **outer mock transaction**, exceeding the old 500,000 setting. The runner now allows 2,000,000 for that outer transaction; `MockIntake` still forwards exactly **200,000** to the Branch callback. Submission/receipt waits are bounded and reconcile the original hash without resending. The stopped local run is not a passing result. See [diagnosis](local-callback-gas-diagnosis.json) and [retained progress](local-integration-underfunded-callback.txt).

## Reproduction and release boundary

From the repository root with the recorded toolchain available:

```sh
forge test -vv
node --test test-sdk/*.test.mjs
forge fmt --check
python3 test/adversarial/check-inline-fixtures.py
node tools/local-integration.mjs --review-fixes > docs/validation/review-fixes/local-integration.json
node tools/measure-release.mjs --review-fixes
```

Use `--use /path/to/solc-0.8.26` if solc is installed outside Foundry's cache. Exact final source fingerprints are in [source-sha256.json](source-sha256.json); the reviewable patch is retained alongside the local implementation. Original delivery validation logs remain intact.

**Remaining gate:** validate real IMD request/profile/result compatibility, actual files and continuation under separately authorized testing, then integrate W1. The medium residual concerning incompatible/oversized authenticated results remains recorded. Production readiness stays false. No public deployment, remote source update or new paid order occurred in this repair.
