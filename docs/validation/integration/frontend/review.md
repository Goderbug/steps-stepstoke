# W1 integration review

This is the implementing worker's source and rendered review, supplemented by separate structural
and browser probes. It is **not an independent contributor review**. The earlier A1 independent
reviews remain immutable under `docs/validation/`; independent review of this new integration
is `NOT_RUN`. No structural check or worker assertion is independent behavioral certification.

## Better Interface coverage

The pinned Better Interface workflow and core principles of all six domains were read and used.
W1's Chinese stone/green UI, spacing, components and responsive behavior were preserved.

| Domain | Coverage | Evidence and limitations |
| --- | --- | --- |
| Accessibility | Checked | Native labeled inputs/buttons; actual local keyboard dialog open, focus wrap, Escape/return; main route focus; W1 keyboard regressions at 320/390/1440. Native screen readers, forced-colors and physical assistive devices were not tested. |
| Layout | Checked | Actual export and local workspace at 320/390/1440; zero host overflow assertions; public and local primary actions on first 390px screen; gateway-subpath regression. Native zoom, RTL mirror and physical-device layouts were not tested. |
| Writing | Checked | Chinese W1 terminology retained. Public configuration, local contracts/mocks and demo fixtures explicitly distinguished. Purchase is separate from proposal/create/fork; refusal, unknown outcome, raw binding and manifest risk explained beside controls. |
| Typography | Checked | Existing five-size scale, mobile 16px controls, wrapping identifiers/body. Initial rendered CJK tofu was corrected by bundling the existing Noto Sans SC fallback as a WOFF2 subset. Arbitrary user glyph coverage still depends on system fonts. |
| Colors | Checked | Existing semantic palette retained; pinned taste probe reports all measured solid text/background pairs meeting its thresholds. Disabled controls, previews, physical displays and every possible composited background are not certified by that result. |
| UI details | Checked | W1 loading/empty/pending/rejected/error/confirmed states, reduced-motion CSS and distinct stages retained; wallet pending locks cover signature through receipt. No theme or animation redesign. Animation-panel slow playback was not tested. |

Final probe data is `taste.json`; 390px public screenshot is `screenshots/taste-public-390.png`.
Actual local screenshots, per-test browser audits and traces sit beside this report. Chromium was
used. WebKit binary download succeeded, but native dependencies were unavailable and system
installation was refused by the sandbox: WebKit rendering/interaction is `NOT_RUN`.

## Findings, corrections and rechecks

| Severity | Source | Finding and correction | Recheck |
| --- | --- | --- | --- |
| High | `frontend/src/domain/liveAdapter.ts:13`, `chainAdapter.ts:58`, `ui/LocalApp.tsx:21` | W1's only working actions were fixtures. Added actual A1 browser SDK/ABI adapter and loopback-only verified config. Public configuration stays closed; fixtures are never fallback data. | Browser-chain six-function runs; deployed-code/config verification; public-closed and mode-transition cases. |
| High | `frontend/src/domain/chainAdapter.ts:213` | A provider could change while preparing an operation even if account/chain stayed the same. Compare the selected provider identity before signing, in addition to account/network, proposal, witness and fee refreshes. | Isolated provider-switch fault injection in `chain-provider.test.ts`, plus actual selected EIP-6963 signing. |
| High | `frontend/src/ui/Workspace.tsx:18`, `ProjectList.tsx:11` | The original query keys had no adapter namespace. Switching modes could briefly reuse another mode's cached records. Include adapter kind in read keys; retain prefix invalidation. | Actual local-to-demo transition asserts fixture project present and actual local project absent. |
| High | `frontend/src/domain/chainAdapter.ts:229`, `Workspace.tsx:356` | W1 recovery/binding was fixture-only. Record original hash/nonce/account/chain/operation before receipt waits; authenticate attempts and witnesses from chain logs/state; add bounded original-result upload. | Actual pending, dropped, replaced, absent/corrupt journal, status1 retry and bad-then-correct raw binding. No repurchase on correction. |
| High | `frontend/src/ui/SponsorPanel.tsx:61`, `chainAdapter.ts:313` | A price decrease also invalidates the old exact allowance. Require equality to the fresh price before purchase; refresh full body, maxFee, Branch, account and network before SDK wallet submission. | Actual price decrease/increase and double-click approval; no purchase on changed quote or rejected signature. |
| Medium | `frontend/src/domain/chainAdapter.ts:261` | A known same-call replacement could remain blocked by an old hash journal after authenticated status1. Treat a mined matching replacement as resolved, then require the fresh contract phase/body/allowance checks for an explicit retry. | Same-call replacement plus newly funded identical-body retry case. Unknown/dropped outcomes remain blocked. |
| High | `frontend/src/domain/chainAdapter.ts:155` | An authenticated failure callback with status 0 freezes Solidity but could be mistaken for a result by a status-only UI. Include `FailureRecorded` and active frozen phase in classification; offer no result binding for that failure. | Actual status 2, 7 and 0 callbacks assert frozen callback stage and no binding/retry form. |
| Medium | `frontend/src/ui/ProposeForm.tsx:15`, `Workspace.tsx:181` | Fixture-only lower-case slot rules and the fork-genesis button did not match A1. Accept the actual 64-byte ASCII name envelope for local A1, and offer forks only for nonzero accepted revisions. | Boundary unit test, actual 64-byte mixed-case proposal, and absent child-genesis fork action. |
| High (rendered) | `frontend/src/styles.css:2` | This browser host had no Chinese font and showed square glyphs. Bundle a small subset of W1's existing Noto Sans SC fallback with OFL notice and source/subset digests. | Inspected final public and local 390px screenshots; font asset served locally, no resource failure. |

The local mock-delivery utility also initially checked its receipt too early; it now waits on its original hash and verifies the Branch phase, with no resubmission. `local-command-check.json` records the repaired utility walkthrough.

No known unresolved Critical/High functional defect was found in the exercised local flows.
That is a worker finding, not an independent safety verdict. Remaining review scope is explicit:
independent contributor review, WebKit, physical wallets/mobile devices, native screen readers,
long-running/reorg/pruned-RPC scenarios and real IMD runtime compatibility were not established.
The finite manifest liveness risk remains unchanged: an authenticated oversized result may never
bind. There is no administrator/timeout unlock, rewriting, refund or automatic retry.

## Submission packaging

Original W1 validation binaries are referenced at the pinned commit. New browser screenshots are
direct final JPEG captures at their tested viewports rather than redundant full-page PNG copies;
`packaging-prune.json` records superseded intermediate artifacts and hashes. Raw command logs,
per-test audits, chain traces, exact source/lockfiles/runtime assets and current screenshots remain.
The complete source snapshot and frontend/export byte budgets are measured separately.
