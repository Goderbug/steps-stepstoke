# Better Interface review: PLATFORM-UX-V1

Reviewed the production export at a gateway-like `/preview/` subpath. The visual idea is a warm, precise workshop: a goal and ordered sequence lead to the selected output, with one next action and secondary evidence. This is platform styling only; authenticated artifacts and Second Life artwork were not redesigned.

The pinned Better Interface workflow and six domain core principles informed implementation. The final design is extracted in root DESIGN.md. Original license notices remain in `frontend/docs/licenses/`. Ordinary choices inferred from the brief: use explicitly disclosed local system fonts, retain the existing React/Vite/wagmi stack and all wallet connectors, and keep the public route closed rather than inserting fixtures.

## Coverage

| Domain | Checked | Evidence and limits |
| --- | --- | --- |
| Accessibility | Semantic headings, ordered checkpoint buttons, labels, disclosures, visible focus, 44px controls, sheet Tab/Escape/focus return, inert background, state labels and reduced motion | Current Playwright interactions; `rendered-review.json`; inspected `screenshots/focus-390.jpg`. No screen-reader session, physical device or native browser zoom session |
| Layout | List/create, sequence/output/next action, funding and showcase; wrapping, local table scrolling and no page overflow at 320/390/768/1440 | `scripts/platform-review.mjs` observes four routes at four widths. Chromium and WebKit functional suite covers 320/390/1440 as configured. Representative screenshots are viewport captures, not every scroll position |
| Writing | Current UI/a11y/errors/default demo and current build/operation/developer/authoring docs are English; explicit gas-only, approval/purchase, pending/unknown/refusal/frozen language | Source scan finds no Han characters in `frontend/src`. Authenticated outputs, identifiers, historical evidence and original W1 selector files retain their bytes/language |
| Typography | 16px body, 13px metadata, 36/28px titles, restrained weights/tracking, wrapping IDs and tabular numeric roles | Computed body styles in `rendered-review.json`; entry probe type-size/family checks. Arial/Helvetica/Courier are disclosed system fallbacks; no claim that Space Grotesk or IBM Plex Mono was loaded |
| Colors | Semantic roles, labelled states, text/action/focus/control edge contrast | `contrast.json` calculates identified solid pairs; entry probe measures rendered text. Arbitrary authenticated artwork/HTML is outside platform contrast coverage |
| UI | Shared production families, few framed surfaces, overlay-only shadows, 160ms property-specific transitions, loading/empty/error/success states and local verified thumbnails | Production components are used by routes and showcase. Reduced-motion observation is recorded. No dark theme or new artwork |

## Findings, fixes and rechecks

| Severity / source | Finding and correction | Recheck |
| --- | --- | --- |
| High · `frontend/src/ui/Workspace.tsx:64`, `components/platform.tsx:33`, `components/ArtifactViewer.tsx:10` | Baseline source put extensive branch facts before assets and history. Reordered to compact goal → sequence → complete selected output → next action; evidence moved to disclosures | Actual desktop/mobile captures and primary journeys; all eligible contributions remain reachable |
| High · `frontend/src/ui/snapshot.ts:3`, `ui/Workspace.tsx:58` | Mixed branch/history reads could remain on a synchronization message without recovery. Both reads are now repeated together; persistent mismatch presents read-only Retry and pauses actions | Unit regression proves both refetch, recovery without reload/signature, and historical selection retention |
| High · `frontend/src/ui/actionScope.ts:4`, `domain/chainAdapter.ts:210` | UI-only lifetime checks did not cover adapter delays. Captured guards now invalidate on close/unmount/account/network/context change and assert after preparation and immediately before wallet submission | Four real adapter fault-injection stages send zero wallet transactions after cancellation; account/network and fixture lifetime regressions also pass |
| High · `frontend/src/domain/files.ts:93`, `preview/FilePreview.tsx:72` | Descriptor names can omit extensions. Downloads now use a sanitized descriptor.path basename, preserving extension through truncation and saving exact verified bytes | Path/control/long-name unit checks and browser SHA-256 download comparison |
| Medium · `frontend/src/styles.css:140` | PNG layout must retain its natural aspect ratio. Images use auto width/height with max-width containment | Chromium and WebKit image ratio assertions |
| Medium · `frontend/src/ui/ProposeForm.tsx:102`, `ui/ProjectList.tsx:89`, `ui/SponsorPanel.tsx:71` | Browser validation exposed implicit field names including nested hint/option text. Added concise explicit names while retaining described-by hints | Current proposal/create/funding interactions pass in all five browser projects |
| Medium · `frontend/src/styles.css:8` | Structural border #DDDCD4 is too faint to identify inputs on white. Added a separate control-boundary token #878A80; structural rules keep the brief's border | Measured 3.513:1 against white and 3.220:1 against canvas; visible focused input capture |
| Medium · `frontend/src/ui/Showcase.tsx:13` | Fixture history arrives descending; choosing its last item made the showcase select genesis and mis-anchor funding. Sorted numerically before composing components | Showcase now renders Round 3 output; current browser interaction covers the production funding sheet |
| High · `frontend/src/ui/verification.ts:14`, `preview/FilePreview.tsx:18` | Verification identity must include full original provenance and version, not just matching bytes. Keys now include original Branch/checkpoint, asset key/revision, producer job and complete descriptor | Regression proves observations cannot transfer across original branches, versions or checkpoints |

Source references identify the active final files; line numbers may move with future edits. No remaining introduced high-impact platform finding is known from these checks. The retained WebKit local RPC runtime issue remains open separately; see `open-issues.md`.

## Probe and rendered observations

`taste@1` passes 16/16 on the entry export: render, layout, targets, contrast, casing, tracking, eyebrows, type sizes/faces, glyphs, slogans, repetition, copy budget, chrome, motion and share metadata. The supplied probe is an entry-page measurement, not coverage of every route. `raw/taste-final.log` preserves its actual output. The supplemental rendered review measures the other surfaces and records focused inputs/reduced motion. Screenshots were opened and inspected; phone entry shows CTO Relay and Explore demo project in the first 390px-wide screen. The focused phone input has a visible 3px burnt-orange ring. There is no horizontal page overflow in the recorded widths.

Completion: implementation and local functional checks are complete for the platform scope. Live acceptance remains NOT_RUN. Native assistive/device/zoom tests are unperformed, and the previously recorded intermittent WebKit loopback RPC page error is not declared fixed by a clean rerun.
