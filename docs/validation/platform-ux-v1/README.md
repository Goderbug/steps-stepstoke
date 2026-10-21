# PLATFORM-UX-V1 delivery and local acceptance

Implemented the English Open Workshop platform in the delivered frontend. Source and the repository-root relative static export are included. A1 core and root build/dependencies are unchanged. No public deployment, hosting, funded credential, real IMD purchase or child order occurred.

`productionDeployment:null` · `liveCompatibility:NOT_RUN` · `productionReady:false`

The implementation is complete for this frontend scope. Local functional checks pass; a previously recorded WebKit RPC runtime issue remains an open qualification. These are worker observations, not independent certification or live acceptance.

## Baseline and preserved history

Required source: `identity-md-launches/launch-2294-build-cto-relay-station` at `878ba4ba1cf7c601656f3a25d17546a425ba1207`, tree `c7838395fec7b493f61a1cf7a08cf5c9db6966b9`. The delivered working HEAD additionally contains the accepted planning record. [BASELINE.json](BASELINE.json) is unchanged. Initial and final comparisons cover all 26 protected files in `src/`, `sdk/`, `cli/`, `abi/`, `config/`, plus the protected build/dependency paths.

The original stage plan is preserved as [PLAN.md](PLAN.md), with [planning-check-results.json](planning-check-results.json). Earlier integration/review evidence remains in its original directories. Current `source-sha256.json`, `dist-sha256.json`, `baseline-final.json` and `export-rebuild.json` describe this implementation. The final export rebuild is byte-identical.

## What changed

- Central semantic light tokens, disclosed local system typography, responsive spacing/targets/focus/motion, metadata and English share image. Root [DESIGN.md](../../../DESIGN.md) records actual values.
- Eight reusable production families: ProjectHeader, SequenceRail/RoundItem, ArtifactViewer, ContributionCard, FundingSheet, BuildStatus, EvidenceDisclosure and WalletButton. `#/showcase` composes these same components.
- Project list/create, workspace and contribution/funding/status use the same system. Compact goal → numeric sequence → large selected complete output → next action. Latest and Selected are independent; genesis/inheritance/unaccepted attempts are labelled separately from completed execution rounds.
- Continue opens preparation at the current checkpoint only. Every eligible proposal remains reachable. Proposal, exact confirmed approval and purchase are separate explicit actions. Historical Fork is beside the selected accepted output and inherits its exact snapshot/provenance, with later child funding separate.
- Branch/history disagreement refetches both reads and offers visible read-only Retry without a wallet, reload or signature. Explicit historical selection survives refresh.
- Cancellation guards reach the final wallet boundary after delayed preparation and invalidate on close/unmount/account/network/context changes. Existing provider/anchor/proposal/witness/parent/spender/price/maxFee/exact-allowance checks, duplicate guards and original hash/nonce reconciliation remain.
- Trusted bounded file retrieval, sanitization, opaque HTML sandbox/CSP and original producer provenance remain. PNG keeps natural aspect ratio. Downloads preserve the descriptor.path extension and exact verified bytes. Version keys include full original provenance. Lazy thumbnails verify/decode bounded image bytes or show a fallback; unavailable or bad artifacts never receive verification.
- Current UI/a11y/default demo/build/operations/developer/authoring docs are English. Authenticated files, identifiers and historical records remain unchanged. Default demo is labelled successful HTML → PNG → HTML; failure controls are secondary. Real routes never use fixtures as a fallback.

## Actual checks

| Check | Result | Raw evidence |
| --- | --- | --- |
| Protected A1/root comparison | PASS, all 26 A1 hashes identical; protected diff empty | `raw/baseline-check.json`, `baseline-final.json` |
| Frontend typecheck | PASS, exit 0 | `raw/typecheck-final.log`, `final-commands.json` |
| Unit tests | PASS, 41 tests / 4 files | `raw/unit-final.log` |
| Production build and identical rebuild | PASS | `raw/build-final.log`, `raw/rebuild-final.log`, `export-rebuild.json` |
| Production fixture/browser suite | PASS, 50/50 | `raw/e2e-final.log`, `e2e.json`, `raw/browser/` |
| Actual local contracts, Chromium | PASS, eight functional cases, 29 successful wallet receipts, zero runtime errors | `receipts/chromium/browser-chain.json`, `raw/chain-chromium-final.log` |
| Actual local contracts, WebKit original/diagnostic | Eight functional cases and 29 successful receipts each; strict runtime gate FAIL on one loopback RPC page error | `receipts/webkit/`, `receipts/webkit-diagnostic/`, corresponding raw logs |
| WebKit confirmation after avoiding redundant in-flight list navigation in the harness | PASS, eight cases, 29 receipts, zero runtime errors; exact index.html download hash checked | `receipts/webkit-diagnostic-confirmation/browser-chain.json`, `raw/chain-webkit-confirmation.log` |
| Core compile / contracts / format | PASS, 125 contract tests; format exit 0 | `raw/forge-build.log`, `raw/forge-test.log`, `raw/forge-fmt.log` |
| SDK/CLI | PASS, 39 tests | `raw/sdk-test.log` |
| Release / all five ABI comparisons / independent fixture integrity | PASS | `raw/release-check-final.log`, `raw/abi-check.log`, `raw/fixture-integrity.log` |
| Better Interface and taste probe | Six domains reviewed; taste 16/16 | `design-review.md`, `raw/taste-final.log`, `contrast.json` |
| Supplemental rendered review | Four routes × four widths; no overflow or undersized measured controls; focus/reduced motion recorded | `rendered-review.json`, `raw/rendered-review.log` |
| Frontend/source bundle budget | PASS within 8 MiB limits; see measured final bytes | `submission-size.json`, `source-size.json` |

Chromium projects use 1440×900, 390×844 and 320×844; WebKit uses 1440×900 and 390×844. The supplemental review adds 768px. The static preview serves the committed export at `/preview/`, proving relative assets and hash routes under a gateway-like prefix. Browser logs inspect page errors, HTTP failures and console errors, not just visible assertions.

## Local receipt coverage

The actual runner starts/closes disposable Anvil, verifies actual deployed A1 identity, drives SDK-prepared unsigned transactions through a named EIP-6963 test wallet, explicitly delivers MockIntake callbacks and binds their original result bytes. It records every wallet transaction across reloads and its on-chain receipt. It does not substitute fixture adapter state or a CLI replay for browser actions.

Cases cover wallet-free reads; gas-only creation and proposals; HTML R1; PNG R2 with an alternate sponsor; HTML R3 continuing R2 with exact selected input hashes; retained file origins; an exact selected R1 fork and separately funded child; missing callback across reload with no repurchase; authenticated status-1 identical paid retry; corrected raw binding without another purchase; and status-2 freezing. Safe extension and exact download bytes are checked against the authenticated descriptor. Chain state and HTTP/file/publication observations remain separate.

## Design evidence and limits

[design-review.md](design-review.md) records the pinned six-domain coverage, source locations, applicable findings, corrections and limitations. Actual captures in `screenshots/` show desktop/mobile entry, sequence/workspace, mobile funding and visible focus. `receipts/chromium/actual-workspace-*.jpg` shows actual local output/provenance. Captures were opened and inspected. The 390px entry screen includes CTO Relay and Explore demo project. Native devices, screen readers and native zoom are unperformed.

A diagnostic stack identifies the retained WebKit error during listBranches while the harness redundantly navigated to the same local list. Removing that redundant navigation and awaiting the list read produced a clean confirmation. This supports that reproduction's navigation-cancellation explanation; it does not establish a general fix for every historical error. The original strict runtime FAIL records remain retained, and [open-issues.md](open-issues.md) keeps the issue open.

Evidence has an explicit size budget: one readable Chromium visual set at desktop/mobile, small viewport JPEGs, complete JSON receipts/logs for both engines and both failed diagnostics, no duplicate WebKit screenshot set or irrelevant runtime-failure capture. Historical artifacts, required core dependency archives, source and runtime assets remain complete. No ignore file was changed; no dependencies, caches or new npm archive mirrors are submitted.

## Reproduce

From the repository root, follow [README.md](../../../README.md) or [frontend/README.md](../../../frontend/README.md). Core and frontend build commands are separate. Current English entry points are `frontend/tests/e2e/platform.spec.ts` and `frontend/tests/integration/platform-chain.mjs`; original W1 selector files remain historical source. Test browser runtimes/libraries were installed under `/tmp` on this worker and are not delivery dependencies.

The initial install/typecheck/unit/browser attempts and their real failures remain in `raw/`; later PASS files do not relabel them. `open-issues.md` distinguishes current implementation evidence from unsupported live readiness.
