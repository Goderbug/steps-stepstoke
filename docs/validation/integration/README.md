# Integration stage 1: reviewed A1 repair patch applied (2026-10-21)

This stage applies the pinned, reviewed A1 repair patch to the delivered A1 source and reruns the baseline checks. Importing W1 into `frontend/`, the browser SDK, installing frontend dependencies and the browser-to-local-contract matrix are **later build-website steps** and are not part of this stage. Their status below is **NOT_RUN**.

## Source verification

| Input | Expected | Observed | Result |
| --- | --- | --- | --- |
| Starting HEAD | `9b0294e7ab19060bd00c489fbe032cf248528e0d` | `9b0294e7ab19060bd00c489fbe032cf248528e0d` | PASS |
| Patch URL | `…/b052a8c9bdfefd8ab601f2d0f467ed9a710a281a/a1-review-fixes.patch` | downloaded | PASS |
| Patch size | 194,891 bytes | 194,891 bytes | PASS |
| Patch SHA-256 | `3028547365dae0b93d9a6191f15b9023fd59821c791d205e8c79cc16375a2989` | same | PASS |
| SOURCE-INPUTS.json | pinned gist revision `3c17d6ec…` | 964 bytes, SHA-256 `17373912b2f7bca7beaf56b5ee95b401fb17ec4845f48f6ad752eb56afd5f0fc`, copied to [SOURCE-INPUTS.json](SOURCE-INPUTS.json); its patch bytes and SHA-256 agree with the brief | PASS |
| `git apply --check` | clean | clean (34 files, +2063/−204) | PASS |
| `git apply` | exact, unmodified | applied as is, including all `config/release.json` edits | PASS |
| Patched baseline `docs/validation/review-fixes/source-sha256.json` | 70 files | 70 match, 0 mismatch, 0 missing | PASS |

The patch touches no protected configuration: `foundry.toml`, `remappings.txt`, `package.json`, `package-lock.json`, `lib/` and `vendor/` are byte-identical to HEAD (`git diff --quiet HEAD -- …` passed). `config/release.json` is application release metadata, and this stage owns it. It is exactly the patch's version.

## Checks rerun on the patched tree (Forge 1.8.3, Anvil 1.8.3, solc 0.8.26, Node 22.23.2)

| Command | Result | Raw log |
| --- | --- | --- |
| `forge build` | PASS (compiled; lint warnings only) | [forge-build.txt](forge-build.txt) |
| `FOUNDRY_FUZZ_SEED=0x1466…9118 forge test -vv` | **PASS: 125 passed, 0 failed, 0 skipped** (14 suites) | [forge-test.txt](forge-test.txt) |
| `forge fmt --check` | PASS | [forge-fmt.txt](forge-fmt.txt) |
| `node --test test-sdk/*.test.mjs` | **PASS: 27 passed, 0 failed** | [node-test.txt](node-test.txt) |
| `python3 test/adversarial/check-inline-fixtures.py` | PASS | [fixture-check.txt](fixture-check.txt) |
| `node tools/check-release.mjs` (new, read-only) | PASS: the 5 ABIs match the build; `config/release.json` creation-code hashes and sizes match all 4 contracts; `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false` | [release-check.txt](release-check.txt) |
| `node tools/local-integration.mjs --review-fixes` | PASS: actual local contracts on Anvil, real SDK calls, **mock Intake/IMD**, 7 accepted rounds, 33 recorded transactions, `compatibility: LOCAL_MOCK_ONLY` | [local-integration.json](local-integration.json), [stderr](local-integration.stderr.txt) |
| `node cli/relay.mjs help` | PASS | [cli-help.txt](cli-help.txt) |

`tools/measure-release.mjs --review-fixes` was not run, because it rewrites `docs/validation/review-fixes/measurements.json` and needs trace logs the patch does not ship. `tools/check-release.mjs` performs the same ABI and release-metadata assertions without writing anything. The policy id `0x98360971…e19b` and the limits in `config/release.json` (including manifest 32,768 bytes and request 16,384 bytes) are the patch's values, and the 125 contract tests and 27 SDK tests that exercise them pass.

Final hashes of the contracts, SDK, CLI, ABIs and release config are in [final-sha256.txt](final-sha256.txt) (that file's SHA-256: `98b38567497bc01779afdee726e015549ebeeefe56d7b743b3d3c0c08298113b`).

## Disclosed gaps

- **Missing patch evidence.** The patch's `docs/validation/review-fixes/README.md` and `independent-review.md` link to 16 raw logs that the patch does not contain: `forge-test.txt`, `node-test.txt`, `local-integration.json`, `fixture-check.txt`, `format-check.txt`, `independent-scanner-differential.txt`, `local-integration-underfunded-callback.txt`, `manifest-baseline.txt`, `manifest-envelope-trace.txt`, `mapping-baseline.txt`, `mapping-prefix-baseline.txt`, `mapping-regression-final.txt`, `maximum-binding-trace.txt`, `measurement-check.txt`, `production-contract-sizes.txt` and `sdk-baseline-corrected.txt`. They were not recreated, because that would change the reviewed patch. The equivalent current results are the raw logs in this directory. The pre-repair baseline failure logs and the gas traces are not reproduced here.
- **Manifest liveness risk retained.** An authenticated result outside the finite manifest envelope can still leave a Branch unable to bind. There is no admin or timeout unlock, raw-result rewriting, refund or automatic retry.
- **Status of later stages:** W1 import, the browser SDK, the browser signing matrix, real IMD compatibility and public deployment are all NOT_RUN. `productionDeployment: null`, `liveCompatibility: NOT_RUN`, `productionReady: false`.

This is structural and local-mock evidence. It is not proof of live IMD behaviour or of security.
