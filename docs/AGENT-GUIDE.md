# Developer and Agent guide

The English PLATFORM-UX-V1 UI is delivered in `frontend/` and its relative static export in root `dist/`. This documentation assignment changes only root README and `docs/**`. It adds no protocol mechanism, deployment, backend, spend authority, dependency or configuration change. Start with [the frontend README](frontend-README.md), [design system](DESIGN.md) and [reproducible checks](BUILD.md).

## Source map and trusted boundaries

| Layer | Source | Responsibilities |
| --- | --- | --- |
| Composition/routes | `frontend/src/App.tsx`, `ui/LocalApp.tsx`, `ui/ProjectList.tsx`, `ui/Workspace.tsx` | Explicit public/local/demo modes; project/create, complete workspace and preparation sheets |
| Shared interface | `components/platform.tsx`, `ArtifactViewer.tsx`, `FundingSheet.tsx`, `WalletButton.tsx`, `Sheet.tsx` | Eight production component families, modal accessibility and one wallet entry point; `ui/Showcase.tsx` reuses them |
| State consistency | `ui/snapshot.ts`, `ui/actionScope.ts`, `ui/recovery.ts`, `ui/verification.ts` | Paired branch/history refetch, read-only Retry, cancellation, original transaction records, full version/provenance-keyed verification |
| Signing and reads | `domain/chainAdapter.ts`, `domain/sdk.ts`, `sdk/browser.mjs` | Loopback identity verification, fresh selected-provider checks, exact approval and simulation, original hash/nonce journal and reconciliation |
| Fixtures and unavailable live mode | `domain/fixtureAdapter.ts`, `domain/fixtures.ts`, `domain/liveAdapter.ts` | Deterministic labelled browser-local examples; public mode fails closed instead of using fixtures |
| File boundary | `preview/FilePreview.tsx`, `preview/sanitize.ts`, `components/VerifiedThumbnail.tsx`, `domain/files.ts`, `sdk/files-browser.mjs` | Bounded trusted fetch, SHA-256/length/media/decode, opaque HTML CSP sandbox, sanitized Markdown, safe exact-byte downloads |
| Immutable A1 | `src/`, `sdk/`, `cli/`, `abi/`, `config/` | Existing authority, profiles, limits, parsers, current-state admission and settlement; no frontend shortcut may override these |

The adapter supplies real IDs from chain/events. Keep chain, Factory, Branch and checkpoint identity together. An accepted numeric revision differs from an attempted purchase, and an inherited asset's producer may precede the Branch's latest job. Forking inherits the selected exact witness, not an inferred winner or a new origin for every file.

## Preparation and recovery contract

Continue prepares from current state; selection is read-only. All eligible proposals remain reachable. A sponsor reviews the existing immutable proposal and cannot edit its body, parent, inputs, mapping or publish choice. Recheck account, network, selected provider, anchor, proposal, witness, parent, Branch spender, current price, maxFee and exact allowance immediately before wallet submission. Confirm exact approval before offering the separate purchase. Duplicate guards last through receipt confirmation.

Capture `useActionScope` and pass its guard to the adapter's `signingAccount`. Closing/unmounting preparation or changing account/network/context invalidates delayed work; check again after awaited reads and before a wallet call. This cannot cancel a request already submitted. Reconcile its original hash/nonce/calldata records; never buy again merely because a callback, receipt or HTTP response is missing. Status 1 is an explicit new payment for the identical body; status 2/unknown freezes. Correct result binding is permissionless and does not purchase.

Branch/history disagreement refetches **both** reads and ultimately shows a visible read-only Retry. Do not “repair” it by overwriting Selected with Latest, hiding the old snapshot, requesting a signature, or fabricating fixture state. `httpProvider` uses keepalive only for public reads with bodies ≤16,384 bytes; larger simulations and wallet submissions keep ordinary transport. That workaround does not cancel stale preparation and is not a universal network guarantee.

## Artifact contract

Authentication is over original bytes. Never parse/reserialize a manifest before comparing its callback digest. Never translate authenticated files or rewrite mappings to make an incompatible result pass. Every preview/download/thumbnail must be scoped to the full original descriptor and producer version. Browser fetch cannot observe DNS answers or connected IP; the configured trusted location is an explicit trust boundary, not proof of DNS safety. Loopback retrieval is test-only.

HTML uses an empty sandbox attribute, opaque origin and restrictive CSP. Markdown is sanitized. Do not grant scripts, wallet, storage, forms or navigation access. PNG layout follows natural dimensions; download uses a safe descriptor.path basename with the original extension and exact verified bytes. Failed/unavailable content has no verified state. Binding and file verification do not prove task quality, external Git delivery, publication or liveness.

## Verification workflow

Run build/typecheck/units and the complete browser and actual-chain commands in [BUILD.md](BUILD.md). Use a disposable checkout if a runner writes local configuration or evidence. Keep original failure logs; do not replace them with later success. Do not invoke removed `.imd` task tooling as a fresh-clone prerequisite. The [documentation byte-audit script](validation/platform-ux-v1/documentation/verify.py) reads the pinned commit and reports protected/core and export comparisons without mutations.

New evidence must identify its actual source, toolchain, mocked versus real local transport, viewport/engine, command exit, receipts and limitations. Historical final results are not new runs. The current six-domain review is worker-executed, not independent contributor approval. A local pass cannot clear live manifest/callback, native wallet/device or external audit gates. Keep the three non-production flags until separately authorized live acceptance establishes them; this guide grants no permission for live calls or deployment.

## English and scope

Use [the future brief policy](PLATFORM-AUTHORING.md) for new tasks. Current UI, a11y, default examples and operator/developer prose are English; original records and authenticated project content retain their language. Open Workshop styles platform chrome only. No Second Life branding/artwork redesign, new asset types, governance, treasury, auto-spend/retry/unlock, or new ABI/backend authority belongs to this release.
