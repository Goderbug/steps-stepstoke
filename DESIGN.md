# Implemented design

## Overview

CTO 中继站 is a Chinese-first project workspace. The accepted stone/green interface is preserved: a compact product/wallet header, explicit amber demo/pending status, project rows, branch facts, assets, proposals, progress and checkpoint history. This integration preserves W1’s visual direction and adds actual local contract behavior, explicit raw-result binding and a separate local mode. Workspace shortcuts follow the fixed goal so a phone user can reach the relevant work before the full identifier details.

The source of truth is `frontend/src/styles.css`, with component markup in `frontend/src/App.tsx`, `frontend/src/ui/` and `frontend/src/wallet/ConnectSheet.tsx`. Observed layouts/screenshots and limitations are recorded in `docs/validation/integration/frontend/README.md` and `docs/validation/integration/frontend/review.md`.

## Colors

Canonical values are CSS hex primitives, consumed through semantic variables.

| Role | Token/value |
| --- | --- |
| Page / surface | `--color-bg` → `--stone-50` `#f6f5f1`; `--color-surface` → `--stone-0` `#ffffff` |
| Primary / secondary text | `--color-text` → `--stone-900` `#1b2420`; `--color-text-2` → `--stone-600` `#4f5a55` |
| Structural edge | `--color-border` → `--stone-200` `#dcdcd4` |
| Action / hover | `--color-accent` → `--green-700` `#1f5f4f`; `--color-accent-hover` → `--green-800` `#174a3d` |
| Soft success / on-action | `--color-accent-soft` `#e3efe9`; `--color-on-accent` `#ffffff` |
| Warning/demo/pending | `--color-warn-bg` `#fbf0d4`; `--color-warn-text` `#6a4a06` |
| Error/refused/frozen | `--color-error-bg` `#f9e3df`; `--color-error-text` `#a3301c` |
| Keyboard focus | `--color-focus` `#1b2420`, 2px solid, 2px offset |

Status always includes words, not color alone. The modal backdrop is `rgb(20 28 25 / 0.45)`. The preview image outline is `rgb(0 0 0 / 0.1)`. There is one implemented light palette and no theme switch. Actual rendered contrast checks belong to the retained probe results; no unmeasured font/background pair is claimed here.

## Typography

`--font` requests PingFang SC, Hiragino Sans GB, Noto Sans SC, Microsoft YaHei, system-ui and sans-serif. `--mono` requests ui-monospace, SFMono-Regular, Menlo, Consolas and monospace. These are fallback stacks; a 122888-byte bundled Noto Sans SC variable WOFF2 subset supplies 462 CJK UI glyphs when the existing system fallbacks are absent. Other user content uses system fallback. No remote font service is required. The exact fallback supplying a given Chinese glyph was not inspected.

The shared scale is 13px (`--text-sm`, secondary facts/metadata/code), 15px (`--text-base`, body and buttons), 17px (`--text-md`, subheadings/row titles/brand), 20px (`--text-lg`, section headings) and 26px (`--text-xl`, page heading). Controls use 16px at widths up to 640px to avoid iOS input zoom. Body line-height is 1.55, headings 1.2. CSS uses 400/600; native strong text may use 700. There is no tracked-capital heading treatment.

Descriptions cap at 65ch and goals at 70ch. IDs, requirements, long titles/goals and verification output wrap without clipping. Code is reserved for identifiers. Markdown code wraps with `white-space: pre-wrap`; table cells keep a readable 4em minimum with 4px/8px padding inside a labelled, keyboard-focusable horizontal scroller. `.preview` uses one `minmax(0, 1fr)` grid column so the table scrolls inside its panel while descriptors and downloads remain contained. `lang="zh-CN"` is set in the document. User HTML is a separate opaque-origin preview, not part of the product typography system.

## Layout

Spacing tokens are 4, 8, 12, 16 and 24px. `.page` is centered at max-width 1240px, with 16px padding (12px at up to 640px). `.panel` uses 16px padding/12px gaps. Rows use 12px padding. `.actions`, `.field-row`, `.jump` and header controls wrap naturally.

The workspace is one column below 1024px and two `minmax(0, 1fr)` columns at/above 1024px; history spans both. Below/equal to 640px, facts stack label/value, rows become vertical and fact grids use one column. Desktop fact groups use auto-fit columns with 300px minimums. Critical values remain selectable and copyable rather than ellipsized.

The demo header is sticky at z-index 10; jump targets have an 88px scroll margin. The wallet overlay is z-index 30. Its sheet is bottom-aligned below 640px and centered above; it is capped at 90dvh with internal scrolling. Current Chromium checks and screenshots are recorded at 320, 390 and 1440 CSS pixels, including long values and a gateway subpath. Native zoom, physical devices and RTL are not claimed as tested.

## Elevation & Depth

Panels use a 1px structural box-shadow; rows use a soft page-color fill, with spacing carrying the grouping. Buttons/confirmations use borders for action or confirmation state. There are no decorative gradients, elevation stacks or animated page entrances. Generated HTML is bounded by a frame edge, with its own origin and CSP.

## Shapes

`--radius` is 10px for panels/sheet and `--radius-sm` is 6px for controls, rows and previews. Pills/tags use 999px radii. The sheet has only its top corners rounded on narrow screens. Text containers use natural height; HTML preview height is intentionally 320px with internal content scrolling.

## Components

| Pattern/source | Use and states |
| --- | --- |
| `.btn` in `styles.css` | Primary green, outlined secondary, quiet and link variants; minimum 44px height (link variant 32px); hover, disabled, focus and pending labels |
| `ProjectList.tsx` | Public discovery, empty/loading/error list, fixed-goal create preview and result |
| `App.tsx` demo controls | Persistent mode/account labels; reset has a pending state, clears relay caches and remounts prepared forms without clearing the wallet connector state |
| `ProposeForm.tsx` | Labelled type/mode/target/current-input fields; mandatory update target; validation/review/signing/result; publication off initially |
| `SponsorPanel.tsx` | Exact object/fee/spender preview, current-price approval, explicit purchase, quote refresh and stale/changed-price errors |
| `Workspace.tsx` | Goal/account/network/branch/revision facts, shortcuts, retained assets, current/stale proposals, independent stages and historical fork confirmation |
| `CopyId` in `ui/format.tsx` | Full wrapping identifier plus a labelled copy button; copied state |
| `FilePreview.tsx` | Downloading/error/verification results; version-keyed state; sanitized Markdown, sandboxed HTML or validated raster; explicit original-byte download |
| `ConnectSheet.tsx` | Named wallets and mobile open-in links, Coinbase choice, pending/rejection, account/network/disconnect; portal, inert background, focus wrap/Escape/return |

Routes move focus to `<main>`. Section shortcuts move focus to their target. All input controls use native elements/labels, and statuses use `status`, `alert` or polite regions as appropriate. Component buttons keep synchronous locks against duplicate actions. Color transitions are 150ms and named by property; reduced motion disables transitions. No autoplay media exists.

## Do's and Don'ts

- Start new workspace content with the existing panel/list/facts primitives and semantic tokens.
- Keep an action next to its proposal, checkpoint or file, with the consequential preview before signing.
- Keep distinct public-closed, local-contract and demo language and the distinction between file verification, binding and publication.
- Use full wrapping/copyable IDs; keep error instructions beside their control.
- A new route should use the existing header, one page heading and hash navigation, and be checked at 320/390/1440.
- Do not turn simulated data into live public reads or enable a capability without verified A1 bindings.

Guidance attribution: Jakub Krehel's Better Interface, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e` (MIT), and Paul Bakaus's Impeccable documentation method, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8` (Apache-2.0). The pinned combined notices/licenses are preserved in `frontend/docs/licenses/better-interface-LICENSE.txt`. Ethereum UX guidance attribution/license is preserved in `frontend/docs/licenses/eth-frontend-ux-LICENSE.txt`.

## Integration components and states

`frontend/src/ui/LocalApp.tsx` reuses W1 panels/lists/forms for `#/local` and `#/local/b/<Branch>`.
The amber strip labels actual A1 calls with MockToken / MockIntake, separate from `#/demo`.
`frontend/src/domain/chainAdapter.ts` supplies authenticated branch/history/proposal reads and SDK
transactions; it adds no new visual system. `Workspace.tsx` reuses `.form`, `.field`, `.hint` and
`.btn` for bounded original-result file selection and explicit binding. `SponsorPanel.tsx` adds
native `<details>` for the complete encoded body, byte length and digest before spending.
`frontend/src/styles.css` keeps W1's palette/spacing/type scale. The only added font is the existing
Noto Sans SC fallback, self-hosted and subsetted under `frontend/src/assets/` (OFL notice and
source/subset hashes in `frontend/docs/licenses/`). `<pre class="req">` wraps transaction/body
values; no critical identifiers are clipped. Route changes retain W1's main focus behavior.
Pending buttons lock synchronously and remain locked through receipt observation. Account/network
changes discard prepared views; public reads and file checks remain available without a signer.

The generated local configuration is consumed by the loopback-only local route. The public root
continues to show the product, disabled creation, the reason and a visible local-mode action on
the first screen at 390px. See the integration review for measured results and limitations;
physical devices, native screen readers and unavailable browser engines are not implied tested.

Local A1 capability validation accepts the fixed 64-byte ASCII asset-name envelope (including CLI-produced mixed-case names). The demo keeps its fixture labels. Fork controls appear only for nonzero accepted revisions, matching A1 rather than offering a child-genesis fork that the contract refuses.
