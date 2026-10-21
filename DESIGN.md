# CTO Relay: Open Workshop

## Overview

CTO Relay is a workspace for public projects: propose work, fund one execution, inspect accepted output, then continue or fork history. The platform uses a warm, precise light interface, independent of project artwork. This system changes platform chrome, not authenticated artifacts or Second Life artwork.

The source of truth is `frontend/src/styles.css`. Three surfaces share one hierarchy: a compact fixed goal, the ordered checkpoint sequence, the selected complete output, then the next action. Details and provenance use native disclosures. The project list uses the same header, rows, actions and form primitives. The funding surface separates proposal review, token approval and purchase. `#/showcase` composes the production components using labelled demo data.

## Colors

All component CSS references semantic tokens in `:root`; there is no dark theme.

| Semantic token | Value | Purpose |
| --- | --- | --- |
| `--color-canvas` | `#F6F5F1` | Workspace canvas |
| `--color-surface` | `#FFFFFF` | Output, forms and overlays |
| `--color-text` | `#22231F` | Main text |
| `--color-secondary` | `#666961` | Supporting text and metadata |
| `--color-border` | `#DDDCD4` | Thin structural rules |
| `--color-control-border` | `#878A80` | Visible input and secondary button boundaries |
| `--color-action` / `--color-on-action` | `#C1452A` / `#FFFFFF` | Primary action |
| `--color-action-hover`, `--color-focus` | `#A83721` | Hover and keyboard focus |
| `--color-selected` | `#FFF1E8` | Selected checkpoint and error surface |
| `--color-success` / `--color-success-bg` | `#326044` / `#EDF4EC` | Local verification and confirmations |
| `--color-warning` / `--color-warning-bg` | `#795019` / `#FFF5DF` | Pending, unknown and refusal context |
| `--color-error` | `#9D3028` | Failures and frozen state |

State always has a text label. Measurement results are in `docs/validation/platform-ux-v1/contrast.json`: body/canvas 14.493:1, secondary/canvas 5.122:1, white/action 5.058:1, control edge/surface 3.513:1. These are solid token pairs, not a claim about arbitrary artifact content.

## Typography

The disclosed local fallback is Arial, Helvetica, sans-serif for interface text and Courier New, Courier, monospace for identifiers. These are system fonts; no font service, remote font request or font installation is required. Space Grotesk and IBM Plex Mono are not bundled. The unused historical Noto subset was removed from source; its license and provenance notices remain. The export requests no font file.

The scale is 13px metadata, 16px body and controls, 20px subheadings, 24px section headings, and 36px page titles changing to 28px at 640px and below. Body line height is 1.5; metadata 1.55; titles 1.15. Weights are 400 and 600. Headings use modest negative tracking; body text has natural tracking. Identifiers and numeric data use tabular numbers. Full critical IDs wrap and have copy controls in disclosures; shortened wallet addresses have full title text. Authenticated file typography remains inside its isolated preview.

## Layout

Spacing tokens: 4, 8, 12, 16, 24, 32, 48 and 64px (`--space-1` through `--space-16`). The content is at most 1200px inside a 1248px padded container. Desktop gutters are 24px; at 640px and below they are 16px. Reading order stays the same across widths.

The sequence is a flexible ordered row on desktop. On phones it becomes a two-column grid, with the same numeric chain order and explicit Latest and Selected labels. Inherited/genesis checkpoints are labelled as having no paid round. The result stays full width. Its tabs wrap, complete tables scroll inside a named keyboard-focusable region, and long evidence wraps. Images use natural aspect ratio (`width:auto; height:auto; max-width:100%`). HTML has a 420px minimum preview on desktop and 340px on mobile. The next-action block stacks below 1000px. Forms switch from two columns to one below 640px.

## Elevation & Depth

The layout uses whitespace and thin rules; only the selected output is a principal framed surface. Shadows are reserved for sheets (`0 16px 64px rgba(34,35,31,.18)`). The backdrop is `rgba(34,35,31,.32)`. Sheets center on desktop and align to the bottom on phones, with internal scrolling and a 92dvh mobile cap. Overlay z-index is 50. The page header is not sticky.

## Shapes

Controls use 6px radii, previews/sheets 8px, badges 4px. The app favicon is a local vector relay mark, with a locally rendered English Open Graph PNG. Controls have at least 44px targets. Status badges are labels, not controls. Interactive transitions name color/background/border properties and last 160ms. Reduced motion removes transitions and animations.

## Components

| Family | Production source | Behavior |
| --- | --- | --- |
| ProjectHeader | `frontend/src/components/platform.tsx` | Page title, compact goal, optional branch direction, return link and action slot |
| SequenceRail / RoundItem | same | Numerically ordered real checkpoints, selection only, explicit Latest/Selected/genesis/inheritance labels |
| ArtifactViewer | `frontend/src/components/ArtifactViewer.tsx` | Complete selected snapshot, file tabs, large verified output, origin table, checkpoint evidence and fork action slot |
| ContributionCard | `frontend/src/components/platform.tsx` | Requirement, eligible/stale/funded label, proposal disclosure and action slot; all proposals remain accessible |
| FundingSheet | `frontend/src/components/FundingSheet.tsx`, `frontend/src/ui/SponsorPanel.tsx` | Fresh quote, read-only proposal, explicit exact approval followed by a separate purchase; original-record retry context |
| BuildStatus | `frontend/src/components/platform.tsx` | Independent labelled approval, purchase, admission, execution, callback, binding, file, Git and publication states |
| EvidenceDisclosure | same | Native keyboard-operable details/summary for secondary facts and raw evidence |
| WalletButton | `frontend/src/components/WalletButton.tsx`, `frontend/src/wallet/ConnectSheet.tsx` | Named EIP-6963 discovery, mobile deep links, Coinbase Smart Wallet, network switch and disconnect |

`Sheet` provides the production focus trap, background inertness, Escape/backdrop/close dismissal, scroll containment and opener focus return. `useActionScope` invalidates captured preparation on unmount, account/network/context edits and re-review; `ChainAdapter` rechecks it after delayed reads and immediately before wallet submission. Cancellation cannot retract a transaction already sent.

`FilePreview` verifies the exact descriptor/version before exposing preview/download, uses an opaque sandbox and CSP for HTML, and sanitizes Markdown. `VerifiedThumbnail` lazily retrieves only visible image versions, bounds bytes and dimensions, verifies SHA-256/length/media and decodes before showing a thumbnail. Failure displays a plain fallback. No thumbnail is a fabricated execution result.

## Do's and Don'ts

- Start a new surface with ProjectHeader and existing tokens. Keep the selected result larger than supporting facts.
- Use one primary content action; wallet connection is a secondary header utility. Put evidence behind a descriptive disclosure.
- Keep proposal, approval, purchase, callback, binding and local file checks separate. Continue opens preparation only.
- Keep original file producer branch/job/checkpoint and exact chain IDs. Latest is not every file's origin; attempts are not completed rounds.
- Do not translate authenticated outputs, infer relationships, simulate live projects, change protocol limits, introduce a dark theme, or execute artifact scripts.

Rendered coverage, fixes, screenshots and limitations are recorded in `docs/validation/platform-ux-v1/design-review.md`. Better Interface guidance is adapted from Jakub Krehel (MIT); documentation method from Paul Bakaus / Impeccable (Apache-2.0). Retained notices are in `frontend/docs/licenses/`.

## Final integration refinements

At 320px, the brand uses the 16px body step with a 24px mark so the wallet control remains beside it. Closed demo settings share a compact row with the mode label, with the fixture explanation beneath. This keeps the whole sequence reachable on the first phone screen without clipping text or hiding controls. Open settings remain in normal flow.

Unbroken project names and goals wrap with `overflow-wrap:anywhere`; flex heading children allow shrinking. Failed verification checks also wrap long actual digests. Wide Markdown/provenance tables scroll in their own named, keyboard-focusable regions while the host document reflows.

The funding sheet shows both approval and purchase controls throughout. Purchase is disabled before confirmed approval; approval is disabled after confirmation. Only the available next action has the primary fill. A price change returns to exact approval. Closing any preparation restores its opener's focus and invalidates delayed signing work.

Final rendered observations, contrast measurements, six-domain coverage and browser limits: [integration review](docs/validation/platform-ux-v1/final/design-review.md).

Inputs, selects and textareas use the 16px body token even inside 13px metadata containers. Main navigation links have minimum 44px width and height. These values are verified by the final rendered review.
