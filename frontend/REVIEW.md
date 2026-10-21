# Contributor review and independent measurements

| Area | Final observation |
| --- | --- |
| Product requirements | Fixture UI/validation complete; real A1 binding explicitly pending; no live-data substitution |
| Reproduced functional/security defects | Fixed in the tested fixture paths; final 28 unit and 120 browser cases pass |
| First screen at 390 | Project/create action and workspace shortcuts visible; screenshots retained |
| Independent design probe | taste@1: 16/16 on the default production entry page |
| Rendered contrast sample | Six actual UI pairs pass 4.5:1; narrow inputs are 16px; reduced-motion transitions are 0s |
| Share metadata | Title, description, favicon, og:title and local og:image present; gateway-subpath asset test passes |
| Actual A1 local-chain / mainnet | NOT_RUN / NOT_RUN |
| Review authority | Automated independent measurements plus a separate source/evidence review by the implementing contributor; no second-author security audit claimed |

This is a Chinese project workspace carried by a consistent stone/green hierarchy, with amber separating demo/pending information from real business state. The review preserves that accepted direction.

## Requirements checked

| Brief requirement | Result and evidence |
| --- | --- |
| “preserve the accepted UI and scope, do not redesign” | Met: existing layout/tokens/components retained; shortcuts reordered after the goal to repair a measured phone-screen issue |
| “working responsive frontend source, static build” | Met: final typecheck/build, source and relative `dist/` assets; static subpath browser case |
| “SIX FUNCTIONS” | Met in explicit fixture mode: all five browser projects execute a fresh two-account journey with root, proposals, chosen sponsorship, reads, continuation and a historical fork |
| “Creating/proposing/forking needs only gas” | Met in fixture model: no sponsorship until an explicit purchase; real-wallet call trap remains empty |
| “No connect wall for public reads” | Met: default route renders the public-read unavailable state without connecting |
| “unavailable … never populated silently with fixtures” | Met: default route has no demo project; explicit demo route has persistent labels |
| “Select create/update, target slot … mandatory input” | Met for fixture/UI checks: required update target, current versions, image editing disabled, publication starts off |
| “Another proposal does not invalidate existing current proposals” | Met in fixture tests: choose an older current proposal after creating another; no FIFO/latest-only selection |
| “Changed input anchor requires resubmission” | Met in fixture/unit cases: refreshed anchor rejects before approval/signing; stale proposal has resubmission path |
| “HTML R1 -> image R2 -> HTML R3” | Met as an executed fixture journey, not merely seeded history: original marker and exact downloaded R2 PNG bytes persist in R3; R3 uses R2 as the parent |
| “Fork copies selected historical assets” | Met in fixture journeys: fork R1 after parent R4; child bytes equal R1, no later image/document, no copied project/head/proposals; original provenance retained |
| “only the user's selected browser wallet signs” | Real signing disabled pending A1. EIP-6963 selection/account/network/rejection is tested using a temporary unsigned provider; demo cannot request signing |
| “Exact allowance to A1 Branch” | Met in UI-domain tests: quote Branch spender/parent/anchor checked; approval equals current price rather than maxFee; price rise requires reapproval |
| “Unknown transaction reconciles … after reload” | Met in fixture cases: original hash/nonce/identity checked; one sponsorship remains; no replacement purchase |
| “Pending/missing callback stays pending” | Met in fixture browser case across reload; outstanding requests block purchases |
| “status-1 … identical-body retry … other failures freeze” | Simulated status 1 explicit/single-use retry and status 2 freeze pass. Actual callback authentication/unknown failure semantics remain NOT_RUN with A1 |
| “Binding may be retried … without repurchase” | Met in fixture case: bad binding preserves old checkpoint and corrected binding adds no purchase receipt. Real manifest/witness path remains NOT_RUN |
| “actual download plus SHA256/length/format verification” | Met on actual deterministic fixture bytes: browser verification and independent Node SHA-256/length assertions; missing, tampered, fake/truncated and oversized images rejected |
| “Sanitize Markdown; isolate generated HTML” | Met in tested malicious fixtures: no active elements/navigation/forms, opaque sandbox, CSP, no external requests/messages/storage access or host navigation; CSS/inline resource bounds checked |
| “320/390/1440 … keyboard/focus … console/resource errors” | Met in the executed five-project matrix; focus wrap/return, inert background, long values, no overflow; zero unexpected errors/resources |
| “Production adapter … explicit disabled pending status” | Met: every live operation rejects, capabilities false, no invented ABI/config; actual public delivery pinned; Node SDK/deployment/browser-bridge gates documented |
| “independent review” | Independent automated probe/measurements executed and retained. Source review is by this contributor; external peer audit is not claimed |

## Six-domain coverage

| Domain | Checked | Limits |
| --- | --- | --- |
| Accessibility | Native roles/labels, skip link, keyboard focus ring, sheet trap/Escape/return, inert background, account/network resets, text status, 16px phone controls, reduced-motion styles | No physical screen reader, native 200% zoom, forced-colors device or accessibility certification |
| Layout | Actual Chromium 320/390/1440 and WebKit 390/1440, first screens, expanded previews, long unbroken values, error hashes, static gateway subpath; no host overflow | Not every possible content/configuration/device; dynamic A1 profiles unavailable |
| Writing | Chinese-first action labels, fixed goals/directions, explicit cost/publish effects, empty/error/pending language, persistent demo/live separation | No additional locales or copy claims about real execution |
| Typography | Existing 13/15/17/20/26 scale, 16px mobile controls, 400/600/700 weights, full IDs, wrapped code/long data | Requested fallback stack documented; actual font supplying every glyph not identified |
| Colors | Default-page taste contrast plus six computed rendered pairs: body, action, secondary metadata, amber demo, red file error, verified descriptor badge | Not every disabled/hover/focus-adjacent pair or untrusted preview's typography |
| UI | Existing surfaces/radii, independent stage labels, pending locks, empty/error/retry controls, 150ms named transitions and reduced motion; modal behavior checked | No real wallet app/passkey transaction session; no live Git/publication observation |

The pinned Better Interface and Ethereum UX licenses/attribution are retained under `docs/licenses/`. `DESIGN.md` documents the final implementation after the last product-source change.

## Findings and disposition

These are repaired findings, not open reports against the final code. Locations below point to the resulting source. Historical raw iteration logs are labelled separately in the validation report.

| ID / severity | Now / change / why / recheck |
| --- | --- |
| W1-01 HIGH: delayed wallet action | `src/ui/actionScope.ts:4`, `src/ui/SponsorPanel.tsx:34`, `src/ui/Workspace.tsx:146`, `src/ui/ProjectList.tsx:22`: a delayed quote could outlive its selected wallet and proposal/create previews survived identity changes. Added an active-form guard and account/network keys. Deferred-quote, identity/network and sign-rejection cases pass |
| W1-02 HIGH: excessive approval and stale quote | `src/ui/SponsorPanel.tsx:39`, `:52`, `:56`: approval used the maxFee ceiling. It now approves the current exact quote price, checks Branch/parent/anchor and requires reapproval after a price rise. Unit spies confirm exact amount and zero purchase on a changed quote |
| W1-03 HIGH: outstanding demo purchase/retry | `src/domain/fixtureAdapter.ts:175`, `:306`, `:417`, `src/ui/Workspace.tsx:73`: the demo could buy another request while pending and reuse a refused attempt. Added per-branch exclusion and single-use retry linkage; no second purchase while missing/unknown/bad binding. Corrected binding still does not buy |
| W1-04 HIGH: preview navigation/security | `src/preview/sanitize.ts:32`: sandbox alone permits frame self-navigation, and `navigate-to` emitted unsupported-directive errors. Navigation/refresh/forms/active nodes/unsafe CSS are removed, with opaque sandbox and supported CSP retained. Markdown host IDs/focus attributes are stripped. Both engines pass malicious byte and navigation/message/storage probes |
| W1-05 HIGH: verification/resource identity | `src/preview/FilePreview.tsx:14`, `:29`, `src/domain/files.ts:21`: old bytes could be reused during a descriptor change; oversized-image text did not hide the image, and a matching header was insufficient. Added descriptor-keyed state, dimension/pixel limits and browser decode before a badge/download. Truncated, oversized, tampered, fake-format and missing files fail without verified badges |
| W1-06 HIGH: executed retention model | `src/domain/fixtureAdapter.ts:399`: new demo HTML discarded the selected saved HTML even though seeded history looked correct. The fixture producer now restores the explicit saved HTML input and inserts exact selected image bytes. Fresh four-round journeys in both engines independently hash downloaded files and verify retained R1/R2 content plus historical fork equality |
| W1-07 HIGH: phone workspace action visibility | `src/ui/Workspace.tsx:82`: on the reviewed 390px screen shortcuts began around y=821.84 and extended below 844px. Reordered the same shortcuts below the goal; final measurement y=391.11, height 44. The first-screen screenshot is now captured before scrolling, and all five browser projects assert full visibility |
| W1-08 MEDIUM: recovery hints | `src/ui/recovery.ts:6`, `:25`, `src/domain/fixtureAdapter.ts:463`: arbitrary/corrupt hints and wrong identity/chain data were not fully scoped. Added shape bounds, adapter/chain/account/branch/proposal/hash/nonce checks and storage-error handling. Reconciliation rejects altered hints and does not purchase |
| W1-09 MEDIUM: wallet accessibility/phone provider | `src/wallet/ConnectSheet.tsx:25`, `:39`, `:65`, `:85`: background was not inert, connected-state focus could be lost, and EIP-only phone providers could be hidden. Sheet now portals outside the inert root, traps/restores focus to the current control and lists discovered providers. Keyboard and EIP-6963-only phone tests pass |
| W1-10 MEDIUM: eager SDK reload errors | `src/main.tsx:19`: automatic reconnect initialized the Coinbase SDK's asynchronous HEAD probe on public/demo loads; WebKit exposed reload-abort errors. Connection is explicit after loading. No automatic signing/purchase is introduced; final console checks stay strict |
| W1-11 MEDIUM: long-data and mobile control behavior | `src/styles.css:72`, `:242`, `:270`: unbroken goals/error hashes/code needed wrapping and 15px inputs risked phone zoom. Reused the type scale with 16px mobile inputs, wrapped data/code, and copyable historical funders/input hashes. Long-content and final viewport assertions pass |
| W1-12 MEDIUM: stale demo reset | `src/App.tsx:136`: resetting the local adapter could leave the project query cache and prepared forms visible. Reset now removes only relay query entries, remounts demo forms, restores the simulated identity/network and guards reset errors/double clicks. The reset regression runs in all five browser projects |

Additional test repairs: removed Chromium-desktop-only skips, used the browser title API for hidden title text, retained exact expected WebKit sandbox-denial diagnostics rather than treating them as app errors, and captured screenshots at CSS pixel scale to fit the submission budget. The one-shot rejection control now clears visually after its simulated rejection.

## Reopened revision: reproduced findings

| Finding / severity | Reproduction, smallest repair and final recheck |
| --- | --- |
| `6af9aa59bd78e3fa8d3bb2cb090369b7f7e6f5518763464ec877716f6df0f59c` HIGH: stale submitted export/evidence | Reproduced against the submitted `dist/`: all five Chromium-mobile revision cases failed, with old `index-BGwPVQjO.js` / `index-DCBZ4oQ3.css` and twelve mismatched source/test pins. Raw evidence: `docs/validation/raw/revision-submitted-export.log`, `revision-before.json`. Rebuilt the final export and ran all 24 cases in all five projects, including the five regressions. The existing retry fee/allowance review, account-B journal, full identifier copy controls, image draft reset and file-stage repair are now in the shipped bundle. `scripts/validate.mjs` additionally records the exact built/tested source/config/export hashes; `scripts/record-release.mjs` refuses later mismatches. Final evidence/release pins are regenerated. |
| `05b3e0148cc4800d46d09493e2738c8130f03779f7e7d7dbc399c5b57fdced06` HIGH: table expands implicit preview column | Reproduced after rebuilding the unchanged revised source: the 390px table case failed with 875px host overflow (`docs/validation/raw/revision-source-before-table.log`). `src/styles.css:184` now gives `.preview` one `minmax(0, 1fr)` column. Existing readable cells, labelled region and keyboard access are retained. `tests/e2e/revision.spec.ts:129` checks every preview child/download inside the asset panel, a truly overflowing inner scroller, nonoverlapping glyphs, ArrowRight scrolling, an unobstructed download hit target and a real successful download. All five widths/engines pass; measured geometry and screenshots are retained. |

A1 was re-read at build/integration time and now has a public source delivery. Its Node SDK, ABIs and fixed release config were inspected and SHA-256-pinned at commit `9b0294e7ab19060bd00c489fbe032cf248528e0d`. The unmodified dependency SDK suite (20 tests) and local EVM harness (33 transactions) passed in a temporary extraction. This is dependency replay only: the product still has no verified A1 deployment/browser bridge, all live capabilities remain false, and actual W1-to-A1 local-chain and mainnet integration remain **NOT_RUN**. See `docs/A1-HANDOFF.md`.

## Readiness and remaining work

The useful UI-validation deliverable is complete for the explicitly labelled fixture scope. **Live product readiness remains blocked by the unimplemented W1 browser bridge, missing verified product deployment and W1-to-A1 local-chain acceptance.** The live route/SDK/witness/unsigned-transaction/recovery mapping is not implemented, and enabling a flag alone would not complete it. See `docs/A1-HANDOFF.md` for exact next steps and NOT_RUN cases.

Real extension/mobile/passkey sessions, actual ABI/contract configuration, A1 manifest parsing/callback authentication, real admission/execution, actual publishing/Git observation and mainnet consumption are not certified by this work. PNG is the executed image fixture; actual JPEG/WebP files were not part of the browser journey. Independent automated measurements carry no independent network approval authority, and no second-author source audit is represented as having run.
