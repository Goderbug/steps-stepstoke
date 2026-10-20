# Documentation-only local reproduction

Date: 2026-10-20. This pass read the delivered source and supplied protocol/testing references, documented actual behavior and ran local checks. **Only README/docs are changed.** It did not repair production code, replace earlier contributor results, perform a new independent agent audit, call a public RPC/HTTP endpoint, deploy publicly, run AI or spend real IMD.

The checkout began at observed local commit `1a7dc9828411a4404e3c1b32bc22e18405558525`. That identifies the baseline inspected here, not a final documentation submission commit, remote repository delivery or deployment. All 81 entries in the retained source/test/ABI/config/vendor fingerprint inventory matched during this pass; see [the comparison output](source-fingerprints.txt). Documentation prose/logs are outside that inventory's declared scope.

Tools observed: Node 22.23.3, Forge 1.8.3, solc 0.8.26 (pinned build). Commands ran from the repository root with no dependency installation. Foundry/solc/Anvil were already available; toolchain executables are not bundled by this documentation.

| Check actually executed | Result | Raw output |
| --- | --- | --- |
| `forge build` | Exit 0; compiler/linter warnings retained | [build](forge-build.txt) |
| `FOUNDRY_FUZZ_SEED=0x146644c630d7548a74d043e2779607ab2def960ac3890b548af84b4eb4db9118 forge test -vv` | Exit 0; 91 passed, 0 failed, 0 skipped, 11 suites | [Foundry tests](forge-test.txt) |
| `node --test test-sdk/*.test.mjs` | Exit 0; 20 passed, 0 failed | [Node tests](node-test.txt) |
| `forge fmt --check` | Exit 0; empty stdout/stderr | [format](forge-fmt.txt) |
| `python3 test/adversarial/check-inline-fixtures.py` | Exit 0; CRC/decompressed inline PNG fixture and Base64 match | [fixture](fixture-check.txt) |
| `node tools/local-integration.mjs` | Exit 0; LOCAL_MOCK_ONLY; 7 bound rounds, 8 funded mock attempts, 33 recorded receipts | [flow JSON](local-integration.json), [stderr](local-integration.stderr.txt) |
| Read-only comparison of all five `abi/*.json` with fresh artifacts, and four release hashes/sizes with fixed config | MATCH; all release runtimes/initcode within EIP-170/EIP-3860 | [ABI/config](abi-config-check.txt) |
| SHA-256 comparison against `docs/validation/source-sha256.json` | Every inventoried file matches | [fingerprints](source-fingerprints.txt) |
| `node tools/measure-release.mjs` | Exit 0; four ABI/config checks and retained measurement consistency pass | [measurement tool](measurement-tool.txt) |
| All five `sh` blocks in [CLI.md](../../CLI.md), extracted in order and executed with `set -eu` | Exit 0; all offline preparations/checks complete; no download/send | [stdout](cli-walkthrough.txt), [stderr](cli-walkthrough.stderr.txt) |

The CLI walkthrough uses retained local Anvil addresses/checkpoints and actual fixture bytes, including reconstructed event/read envelopes explicitly labelled as format demonstrations. It does not obtain new independent history from a public chain or simulate every prepared call against a running historical snapshot. The separate integration runner does execute SDK-prepared calls against actual locally deployed release contracts.

The integration runner covers HTML create → PNG → HTML update, Markdown create/update, explicit identical retry after refusal, wrong-witness binding recovery, a revision-one historical fork after root revision five and child open/continuation. Only Intake and IMD are mocked; the Factory deploys the actual dependencies/implementation and creates actual Branch clones. These are local mock token movements, not real IMD consumption. Named file fixture bytes are checked separately from raw manifest keccak256. No HTML or downloaded content is executed.

The measurement tool reads saved maximum-binding/body traces and the retained integration report in the parent directory. Its successful output is **not a fresh gas experiment**. This pass did not replace the earlier raw traces, source inventory, independent report or check-results file. Existing measured limits and warnings remain disclosed in [LIMITS.md](../../LIMITS.md) and [the retained integration record](../README.md).

The final documentation checks are recorded in [documentation-checks.txt](documentation-checks.txt) and [check-results.json](check-results.json): local Markdown target resolution, ABI/SDK/CLI reference coverage, diff whitespace and allowed-path review. They check documentation consistency, not contract security or behavior certification. No false production PASS follows from them.

Live catalog/profile compatibility, public-chain fork testing, actual protocol consumption, deployment and publication remain **`NOT_RUN`**. The earlier independent agent review remains [its own report](../independent-review.md); external human audit remains unperformed. [HANDOFF.md](../../HANDOFF.md) records missing work and [LIVE-VALIDATION.md](../../LIVE-VALIDATION.md) supplies future instructions that were not executed.
