# Final six-domain review

CTO Relay is a public-project workshop carried by a warm light workspace: compact goal, ordered sequence, complete selected output, then an explicit next action. Project artwork and authenticated output bytes remain independent of the platform chrome.

The pinned Better Interface workflow and core principles of all six domains were applied. Its MIT/Apache-2.0 attribution/license notices remain in `frontend/docs/licenses/better-interface-LICENSE.txt`; the pinned eth-frontend-ux MIT notice also remains. This is the implementing worker's review, not a second contributor audit.

## Coverage

| Domain | Checked on the production export | Limits |
| --- | --- | --- |
| Accessibility | Native buttons/links/forms/disclosures; English names and status labels; keyboard/modal trap, root inertness, Escape/opener return, copy IDs; 44px action controls; 16px inputs; reduced-motion 0s | No physical screen reader, native 200% zoom or physical phone session |
| Layout | Public entry, project list, workspace and component showcase at 320/390/768/1440 in both engines; long values; wide table's own keyboard scroll region; selected R1 distinct from latest R3; gateway subpath | Finite viewport/content samples, not every possible artifact |
| Writing | English UI, a11y, defaults and current docs; labels for demo/local/public configuration, approval/payment separation, stale/unknown/frozen states, source provenance | Authenticated/historical content is preserved, not translated |
| Typography | Six sizes (13/16/20/24/28/36), body 16; local Arial/Helvetica and Courier fallbacks; wrapped identifiers; measured 16px mobile selector | Exact installed system face can differ; no Space Grotesk/IBM Plex font claim |
| Colors | Semantic light tokens; six rendered text/background pairs in each engine; no new dark theme; states carry labels | Disabled/exempt text and every transient background are not a full WCAG audit |
| UI | Production components reused by showcase; disabled/pending/error/retry states; isolated complete preview, natural image ratio, safe downloads; 160ms transitions and reduced motion | Live wallet/passkey/deep-link journeys were not performed |

Chromium and WebKit each measured: body 14.493:1; primary white-on-action 5.058:1; output metadata 5.588:1; fixture-mode copy 5.122:1; verification error 6.581:1; verified badge 6.484:1. All sampled text meets 4.5:1. Exact rendered pairs and selectors are in `design-measurements-{chromium,webkit}.json`. Focus uses a visible 3px outline with 3px offset, confirmed through keyboard tests, computed styles and the retained focused-sheet screenshot. The final pinned probe passes 16/16. It supplements the route/state checks rather than replacing them.

## Findings, corrections and rechecks

| Severity / source | Reproduction and impact | Implemented correction / evidence |
| --- | --- | --- |
| High — `frontend/playwright.config.ts:7` | Only `platform.spec.ts` was selected; original safety scenarios were excluded | Every `*.spec.ts` now runs. All five projects retained; 175 pass, zero skips. Original assertion counts retained |
| High — `frontend/src/styles.css:41`, `:42`, `:188` | 80-character titles, unbroken goals and failed SHA digests caused document overflow, including 251px at 320 | Allow heading/flex shrink and wrap long values/checks. Long-value, malformed-file and wide-table cases pass in both engines; host overflow 0 |
| Medium — `frontend/src/styles.css:246`, `:250` | Wrapped narrow header and open secondary settings pushed the selected sequence control outside the first screen | Compact closed mode/settings row and 16px narrow brand with 24px mark. Entire selected rail fits at 320/390; full-viewport assertions retained |
| Medium — `frontend/src/styles.css:34`, `:57` | Mode metadata inherited a 13px selector; the Demo navigation target was narrower than 44px | Inputs/selects/textareas use 16px; navigation links have 44px minimum width and height. Original 16px assertion and final taste/target checks pass |
| High — `frontend/src/domain/chainAdapter.ts:39` | Full WebKit signing run emitted uncaught access-control errors during receipt polling/branch reads around navigation | Keepalive only for bounded public read requests; no wallet-write keepalive, no truncation of large simulations. Unit and four full actual local runs pass; failed WebKit record retained |
| High — `frontend/src/domain/fixtureAdapter.ts:330`, `:346`, `:444` | Unknown demo purchase reconciled after reload using the new default success outcome, losing its selected missing-callback state | Persist the pending attempt's callback outcome and use it on reconciliation. Added unit regression plus original retry/reload assertions pass; no purchase or checkpoint is fabricated |
| Medium — `frontend/src/ui/SponsorPanel.tsx:62` | Composition removed the visibly disabled payment step expected by the older approval guard | Show both steps; only the available action has primary fill. Purchase stays disabled until exact approval confirmation; rejection/double-click/price checks remain |
| Medium — `frontend/tests/e2e/actions.ts:10`, `frontend/tests/integration/browser-chain.mjs:448` | A newly navigated branch could still expose the old disclosure; an unfiltered journal lookup selected a different branch's submitted record | Wait for the exact displayed branch ID; select the pending original journal by its own branch ID. Fork, history and replacement assertions retained and pass |

No confirmed high/medium finding remains open in the locally exercised scope. Screenshots in `screenshots/` and `local/*/screenshots/` are representative final frames; all per-scenario runtime reports and actual receipts remain available. Scratch captures are deliberately not submitted. Renderer probes do not establish a screen-reader session, native Safari certification or live acceptance.
