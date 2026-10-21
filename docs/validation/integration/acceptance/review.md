# Dedicated integration review

This is the implementing worker's source/rendered review, supported by separate executable
calldata/receipt and structural audits. It is **not an independent contributor review**.
Fresh independent contributor review of this integration is **NOT_RUN**. The supplied A1
independent reviews and all earlier evidence remain unchanged. Structural acceptance and worker
test results do not provide independent behavioral or security certification.

## Better Interface coverage

The pinned Better Interface workflow and the core principles of accessibility, layout, writing,
typography, colors and UI details were read. The existing Chinese stone/green W1 design, component
hierarchy, spacing and responsive behavior were preserved; this assignment did not redesign it.

| Domain | Coverage | Evidence / limits |
| --- | --- | --- |
| Accessibility | Source and rendered | Native labels, roles, live status, wallet sheet inert background, keyboard focus wrap/Escape/return; actual-contract matrix and fixture keyboard tests. Native screen readers and physical assistive devices NOT_RUN. |
| Layout | Source and rendered | Public/local primary action on first 390px screen; actual workspaces at 320/390/1440, fixture long values/tables and static gateway subpath. Horizontal overflow assertions and representative screenshots are retained. Native 200% zoom and RTL NOT_RUN. |
| Writing | Source | Chinese actions and separate proposal/approval/purchase/binding stages retained. Fixed stale pre-delivery metadata. Local mock, fixture and unavailable public modes remain explicit. |
| Typography | Source and rendered | Existing five-size scale, 16px mobile controls, local WOFF2 and identifier wrapping retained. Inspected Chinese text in Chromium and WebKit screenshots. Arbitrary user glyph coverage and every system fallback NOT_RUN. |
| Colors | Source and rendered | Existing semantic tokens unchanged. Pinned taste probe measures resolved solid foreground/background pairs; its raw result is retained. It does not certify every preview, disabled/composited state or physical display. |
| UI details | Source and rendered | Loading, rejected, unknown, pending, confirmed and frozen states, separate explicit retry, synchronous action locks and reduced-motion styles retained. No new theme, decorative effects or animation system. Slow-motion animation-panel inspection NOT_RUN. |

`DESIGN.md` describes the final source tokens and components. Representative final screenshots
are under `chromium/screenshots/`, `webkit-flow/screenshots/`, `webkit-files/screenshots/` and
`fixtures/screenshots/`; `packaging-prune.json` identifies redundant captures omitted from this
pass to fit the submission budget. Earlier evidence was not deleted or rewritten.

## Findings and repairs

| Severity / area | Source | Finding, correction and recheck |
| --- | --- | --- |
| High / SDK trust boundary | `sdk/files-browser.mjs:46`, `:107` | The optional redirect mode followed unobservable intermediate destinations and checked only the final URL. All redirects now fail closed; `allowRedirects:true` is rejected and even an already-redirected response to an approved final URL is refused. New Node regressions and actual Chromium/WebKit streaming/download tests verify refusal. Current loopback policy already refused redirects. |
| Medium / metadata | `frontend/index.html:9` | Description still said A1 was not delivered. It now states that local contracts are integrated, public configuration is absent and fixtures are separate. Production rebuild and metadata/subpath checks cover the export. The local bridge comment in `frontend/src/domain/liveAdapter.ts` was corrected too. |
| Validation gap / WebKit runtime | `frontend/scripts/prepare-webkit.sh` | Prior evidence had no working WebKit. Added a temporary Ubuntu-library and Mesa software-rendering setup, with a headless wrapper that preserves the official bundled libraries. No root configuration or dependency edits; packages/caches stay under `/tmp`. Actual WebKit SDK and W1 signing flows now run. This is Linux Playwright WebKit, not a physical iPhone/Safari certification. |
| Validation defect / assertion timing | `frontend/tests/integration/browser-chain.mjs:15` | A five-second matcher expired while creation was still processing; a screenshot showed the waiting state, not a revert. Use bounded 30-second assertions. This does not change application receipt timeouts, submit again, or unlock a Branch. The complete Chromium rerun passes. |
| Validation defect / long commands | `frontend/tests/integration/browser-chain.mjs:19`, `frontend/playwright.config.ts` | Long browser jobs ended with SIGTERM, including after twelve completed matrix cases. Save per-case progress, split actual-chain work into isolated groups, and write fixture reports per project/spec file. The complete retention/fork flow stays on one chain. No interrupted run is relabeled PASS. |
| Medium / browser diagnostics (open) | `frontend/src/domain/chainAdapter.ts:38`, `frontend/tests/integration/browser-chain.mjs:177` | Three initial WebKit reload-heavy groups captured a loopback RPC page error while all transaction/recovery assertions passed. All three affected groups passed instrumented diagnostic reruns without page errors. Payments/recovery captured cancelled RPCs immediately before navigation; a minimal caught-fetch/reload probe did not reproduce the original error. Root cause is not established and these raw diagnostics are not filtered into PASS. See `browser-diagnostics.json`; clean-runtime acceptance remains FAIL pending resolution. The runner now gates its overall result on page errors/external requests and reports functional/runtime status separately; `webkit-runtime-gate/browser-chain.json` verifies the final runner with another real payment group. No extra purchase or external request was observed. |
| Validation defect / packaging audit | `frontend/scripts/measure-submission.mjs`, `check-integration.mjs` | Old tracked hashed dist names disappear on a normal rebuild. Auditors now skip deleted paths and write new reports only under this acceptance directory. Final source/runtime/evidence remain complete. |

The initial Foundry test command also saw a temporary archived copy of A1 under `test/scratch/`
and reported duplicate Solidity types. Moving that verification archive to `/tmp` removed the
test scaffold collision; the unmodified final Solidity suite then passed all 125 tests.

## Unchanged limits and readiness

No Solidity rule, payer/owner model, profile, publication policy or CLI behavior was redesigned.
No public deployment, real IMD purchase, paid child job, automatic retry, refund or unlock was
performed or added. Missing callbacks remain pending. Authenticated status 1 permits only an
explicit newly funded identical-body retry; status 2/unknown failure freezes the Branch.

The finite-manifest liveness risk is **retained**: an authenticated result outside the bounded
manifest envelope may never bind. There is no administrator/timeout escape, raw-result rewriting,
refund or automatic retry. Browser DNS answers/connected IPs are unobservable; approved hosts
remain an explicit trust decision. No mandatory proxy/backend was introduced.

No unresolved Critical/High regression was found in the completed local checks. An intermittent
WebKit RPC diagnostic remains open at Medium severity; browser runtime cleanliness is FAIL
for the original three affected groups even though their functional assertions passed. This is a scoped
worker finding, not a fresh independent review. Public operations remain closed and
`productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false` remain in force.
Physical wallets/devices, Coinbase passkeys, long-history/pruned-RPC/reorg behavior and real IMD
admission/execution/callback/Git/publication are NOT_RUN.

Guidance attribution and licenses remain in `frontend/docs/licenses/`: Better Interface by Jakub
Krehel (MIT), the pinned Impeccable documentation method by Paul Bakaus (Apache-2.0), and the
pinned Ethereum frontend UX reference (MIT).
