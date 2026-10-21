# Dedicated W1 / A1 integration acceptance

This pass preserves the accepted Chinese W1 design and the patched A1 contract rules. The final
static export is `dist/`. Its local route uses the actual browser SDK and final Solidity on a
disposable Anvil chain, with MockToken/MockIntake and deterministic real files. It is usable after
the local setup in the [root README](../../../../README.md#w1-browser-integration-and-static-export).
The public route remains closed because no public deployment was supplied.

**Local behavioral matrix: PASS in Chromium and Playwright WebKit. Overall acceptance: INCOMPLETE. Production readiness: false.**
WebKit reported three loopback RPC page errors in reload-heavy runs; browser diagnostic cleanliness
is **FAIL** for those original runs, separate from the passing transaction/recovery assertions.
All three instrumented diagnostic reruns were clean; root cause remains open, and the runner
now gates its overall result on browser errors. See
[browser-diagnostics.json](browser-diagnostics.json). A fresh independent contributor review is **NOT_RUN**; this report and the separate executable
receipt/structural audits are worker checks, not independent certification. Real IMD, public
hosting/deployment, paid runtime work and physical wallets/devices are **NOT_RUN**.

Machine-readable results: [check-results.json](check-results.json), [matrix.json](matrix.json),
[final-sha256.json](final-sha256.json).

## Authenticated inputs and scope

The supplied starting checkout was accepted integration HEAD
`8c0d6da09cd32c73b26a5da43f7c24867e7869af`, not the older A1 HEAD. Its pinned A1 ancestor
`9b0294e7ab19060bd00c489fbe032cf248528e0d` was verified. The exact pinned patch was downloaded,
checked at **194891 bytes**, SHA-256
`3028547365dae0b93d9a6191f15b9023fd59821c791d205e8c79cc16375a2989`, and applied with
`git apply --check` followed by `git apply` to a temporary archive of that ancestor. All 70
patched-baseline manifest hashes matched. The existing integration was not reset or recreated.
The pinned W1 archive at `d48bc2117a06c79c3b8545d15eeff2675da94a31` was checked against 319 original
file hashes; its dependency lock remains exact. See [source-inputs.json](source-inputs.json) and
[input-verification.log](input-verification.log). Prior reviews, logs and evidence are unchanged.

All six actual W1 run configurations exactly match both `frontend/public/local-config.json` and
`dist/local-config.json`, including final runtime code hashes, policy, ABI digests and limits; see
[release-consistency.json](release-consistency.json).

The application repair closes a browser download trust gap: browser redirect chains cannot be
inspected, so all redirects now fail closed, including the old optional `allowRedirects:true`
setting. Configure a final trusted artifact URL instead. CLI/Node downloads retain their adapter
and policy. Stale metadata/documentation was corrected. Test tooling now supports WebKit, bounded
assertions, independent matrix groups, persistent per-case progress and separate evidence paths.
No Solidity, fixed profile, payer model, allowance rule, callback rule or publication policy changed.
[tool-versions.json](tool-versions.json) records the actual compiler/runtime/browser tool versions.

## Actual browser-to-contract matrix

The named **Relay Local Test Wallet** is selected through EIP-6963. It forwards SDK unsigned
transactions to two temporary unlocked Anvil accounts; it is not a fixture adapter or a CLI
replay. Setup deploys the final contracts and installs MockToken/MockIntake on this disposable
chain only. A mock writer supplies authenticated callbacks; deterministic Markdown/HTML/PNG
bytes are downloaded and verified by the actual browser. The application does not generate AI
content or prove that a real IMD worker consumed these inputs.

Chromium ran the complete matrix on one chain: **80 browser wallet submissions, 78 successful
original receipts and 2 deliberately dropped original hashes**. WebKit ran five isolated groups:
**85 submissions, 83 successful original receipts and 2 deliberately dropped originals**.
Replacement transactions are explicit test controls; their hashes and resulting chain state
are retained. Additional WebKit setup flows explain the different totals. The full Markdown,
three-round HTML/image retention, historical fork and child flow stays on one chain in both engines.
Every original wallet calldata was separately re-encoded by the Node SDK in a post-run
worker audit, and every successful original receipt was checked. Only explicit
`sponsor`/`retry` calls emit paid MockIntake requests; create/propose/fork do not.

| Case | Actual Chromium | Actual WebKit | Real IMD |
| --- | --- | --- | --- |
| Public config closed; local reads without wallet; EIP-6963 selected provider | PASS | PASS | NOT_RUN |
| Create / propose / explicit sponsor / bind / read Markdown, alternate funder update | PASS | PASS | NOT_RUN |
| HTML R1 -> PNG R2 -> HTML R3 continues R2, selected exact bytes and retained provenance | PASS | PASS | NOT_RUN |
| Fork non-head accepted R1 exactly; child opens then continues with separate sponsorship | PASS | PASS | NOT_RUN |
| Multiple current proposals, explicit older selection, missing callback, reload with corrupt/missing journal | PASS | PASS | NOT_RUN |
| Authenticated status1 explicit identical-body paid retry; corrected raw binding without repurchase; stale anchors | PASS | PASS | NOT_RUN |
| Exact allowance and fresh price/maxFee checks; double-click and signature rejection | PASS | PASS | NOT_RUN |
| Account/network changes invalidate prepared signing; no purchase | PASS | PASS | NOT_RUN |
| Purchase signature rejection and double-click send exactly one explicit paid attempt | PASS | PASS | NOT_RUN |
| Authenticated status2 and unknown failure freeze permanently | PASS | PASS | NOT_RUN |
| Pending original hash/nonce saved before wait; missing/corrupt journal uses pending nonce; replaced transaction reconciles without rebuy | PASS | PASS | NOT_RUN |
| Same-call replacement recovers authenticated attempt; status1 retry uses chain truth despite original journal | PASS | PASS | NOT_RUN |
| Actual local file tampering/unavailability/stream bound; malicious preview and mobile keyboard/focus | PASS | PASS | NOT_RUN |

[matrix.json](matrix.json) maps every group to raw evidence. Each `browser-chain.json` retains
selected-case results, before/after purchase counts, SDK calldata, original hashes/nonces,
receipts/logs, mock setup/writer traces, generated code/policy/config and artifact provenance.
Raw reports: [Chromium](chromium/browser-chain.json), [WebKit flow](webkit-flow/browser-chain.json),
[recovery](webkit-recovery/browser-chain.json), [payments](webkit-payments/browser-chain.json),
[failures](webkit-failures/browser-chain.json), [files](webkit-files/browser-chain.json).
Their sibling `trace-audit.json` files record the post-run receipt audit. Additional diagnostic
reruns are listed separately in `browser-diagnostics.json`; their transactions are not included
in the primary matrix totals above. Exact deterministic
files are retained under each `files/`; those directories also contain common seed files that
were not necessarily consumed in that shard. The traces identify actual consumed files.

The R3 purchased body continues `png-r2`, selects the original R1 HTML and exact R2 image hashes,
and leaves the PNG descriptor/provenance unchanged. The browser renders the retained R1 marker
and an exact PNG data URI. A non-head R1 fork inherits precisely that checkpoint, then separately
opens and continues its own project with explicit approval/purchase. Status-1 retries have a new
request and the same body hash; a bad raw binding is corrected without another purchase.
Missing callbacks stay pending, and authenticated status 2, 7 and 0 failure callbacks freeze.

The file/security case submits malicious HTML and Markdown through actual proposals, payments,
callbacks and binding, then verifies sanitization and an empty-sandbox opaque HTML frame.
External requests, script/wallet/storage access, forms and top navigation are removed or blocked.
Tampered, unavailable and oversized files receive no verified badge. The separate SDK browser
check exercises a chunked oversized stream and redirect rejection. HTTP never settles a Branch.

## Build, runtime parity and UI checks

| Check | Actual result / raw evidence |
| --- | --- |
| `forge build` | PASS; [forge-build.log](forge-build.log) |
| Seeded `forge test -vv` | 125 PASS, 0 failed/skipped; [forge-test.log](forge-test.log) |
| `forge fmt --check` | PASS; [forge-fmt.log](forge-fmt.log) |
| `node --test test-sdk/*.test.mjs` | 39 PASS, including the 27 baseline tests; [sdk-test.log](sdk-test.log) |
| Frontend production build | PASS; [build-final.log](build-final.log) |
| TypeScript typecheck | PASS after final test/config changes; [typecheck-final.log](typecheck-final.log) |
| Frontend unit tests | 30 PASS; [unit.log](unit.log) |
| Independent second production build | All 8 exported files byte-identical; [export-reproducibility.json](export-reproducibility.json) |
| Release artifacts / embedded SDK ABI | PASS; [release-check.log](release-check.log), [abi-check.log](abi-check.log) |
| Inline fixture integrity / CLI help | PASS; [fixture-integrity.log](fixture-integrity.log), [cli-help.log](cli-help.log) |
| Actual browser SDK parity | Chromium and WebKit PASS, 25 accepted vectors and 37 rejection vectors each; [sdk-browser-chain.json](sdk-browser-chain.json), [sdk-webkit-chain.json](sdk-webkit-chain.json) |
| Separate fixture UI suite | 120 PASS, 0 failed/skipped/retried across Chromium desktop/mobile/narrow and WebKit desktop/mobile; [fixture-summary.json](fixture-summary.json) |
| Actual W1 browser diagnostics | Chromium PASS; WebKit FAIL for 3 loopback RPC page errors during reload-heavy runs; [browser-diagnostics.json](browser-diagnostics.json) |
| Pinned design probe | All 16 checks PASS on final export; [taste.json](taste.json), [taste-final.log](taste-final.log) |
| Structural/config/path/size checks | [structural-review.json](structural-review.json), [protected-paths.log](protected-paths.log), [submission-size.json](submission-size.json) |

Parity compares unsigned calldata, witness encoding/hash, manifest keccak and actual file SHA-256,
including malformed JSON, Unicode, decoded duplicates and limits. The browser has neither `Buffer`
nor `process`. These low-level SDK checks are separate from W1 signing acceptance.
Fixture UI tests use a labelled simulated adapter and are **not** actual-chain evidence.

The final export uses relative assets and hash routes, contains a title/favicon/description/
Open Graph metadata, and was tested under a static gateway subpath. The 390px first screen shows
the product and the local/create action. Actual local workspaces were checked at 320/390/1440;
keyboard wallet-sheet focus trapping, Escape and focus return passed in both engines. The pinned
probe reports no horizontal overflow, runtime errors or missing/external resources. Its measured
solid text pairs meet the specified contrast threshold; this is not an exhaustive contrast audit.
See [review.md](review.md) for all six Better Interface domains, fixes and limitations, and
[DESIGN.md](../../../../DESIGN.md) for implemented tokens, typography and components.

## Reproduce

Install with `npm ci --prefix frontend` and build with `npm run build --prefix frontend`.
The root README covers preview, the actual local config generator and the loopback-only local
route. Do not change root Foundry/dependency files or use a public RPC for these tests.

```sh
export PLAYWRIGHT_BROWSERS_PATH=/tmp/cto-relay-browsers
frontend/node_modules/.bin/playwright install chromium webkit
# Only if Ubuntu 24.04 browser libraries are absent:
bash frontend/scripts/prepare-webkit.sh /tmp/cto-relay-webkit
export W1_WEBKIT_EXECUTABLE=/tmp/cto-relay-webkit/webkit-headless
node frontend/tests/integration/browser-chain.mjs --browser chromium
# Execute sequentially, each on its own disposable chain:
node frontend/tests/integration/browser-chain.mjs --browser webkit --group flow
node frontend/tests/integration/browser-chain.mjs --browser webkit --group recovery
node frontend/tests/integration/browser-chain.mjs --browser webkit --group payments
node frontend/tests/integration/browser-chain.mjs --browser webkit --group failures
node frontend/tests/integration/browser-chain.mjs --browser webkit --group files
node frontend/scripts/audit-local-evidence.mjs docs/validation/integration/acceptance/chromium
npm run typecheck --prefix frontend
npm run test --prefix frontend
node tools/check-release.mjs
node tools/generate-sdk-abi.mjs --check
# Additional SDK parity + real streaming checks (separate from W1):
node tools/sdk-local-check.mjs --browser webkit --executable "$W1_WEBKIT_EXECUTABLE" --out /tmp/relay-sdk-webkit.json
node frontend/scripts/check-integration.mjs
node frontend/scripts/measure-submission.mjs
```

For fixture checks, run `npm run test:e2e --prefix frontend -- --project=<project> --workers=1`.
On runners with command time limits, append one `tests/e2e/<file>.spec.ts` at a time and set
`W1_E2E_REPORT=../docs/validation/integration/acceptance/fixtures/results/<project>-<file>.json`.
Projects are chromium-desktop/mobile/narrow and webkit-desktop/mobile; files are journey, layout,
revision, w1 and wallet. All raw logs are retained. WebKit here is Playwright's Linux engine with
software rendering, not physical Safari/iPhone testing. Native package downloads and caches stay
under `/tmp`; neither browser binaries nor dependency caches are part of the submission.

Earlier interrupted runs are not relabelled PASS. Initial attempts exposed an assertion timing
problem and a temporary duplicate-Solidity archive in `test/scratch/`; these were corrected.
Long browser commands were terminated with exit 143, so final evidence uses completed bounded
runs. Their raw failing/interrupted reports remain. See [review.md](review.md).

## Remaining limits and packaging

`productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false` remain in
force. Finite authenticated manifest limits can still leave a result permanently unbindable.
No timeout/admin unlock, raw-result rewriting, refund or automatic retry exists. Browser DNS
answers and connected IPs cannot be checked; approved HTTPS hosts remain a trust decision and
redirects are refused. Loopback policies are explicitly test-only.

Fresh independent contributor review, physical extensions/wallets/passkeys, physical assistive
technology, native zoom/RTL, long-history/pruned-RPC/reorg behavior, real IMD admission/execution/
callback/Git/publication and public deployment are NOT_RUN. Live approval/purchase readiness is
blocked by missing public configuration, unverified live compatibility and the retained review
risk. Local PASS does not remove those limits.

The frontend source and export fit the 8 MiB source budget. The complete deliverable snapshot is
also measured as a verified single-commit Git bundle in `submission-size.json`; original remote
history is not rewritten or claimed measured. Required inherited offline root dependencies and
all earlier evidence are retained. Only redundant **new** screenshots/progress/temporary captures
are omitted; [packaging-prune.json](packaging-prune.json) records their hashes. Representative
screenshots, all final raw logs, transaction receipts and actual file bytes remain. Final source,
ABI, SDK, config and export hashes are recorded in `final-sha256.json`.
