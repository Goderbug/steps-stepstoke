# Extending the platform

Use English for new platform UI, accessibility labels, default fixtures and current contributor documentation. Authenticated files, chain identifiers and historical records retain their original bytes and language. Platform styling stays independent of project artwork; this assignment contains no Second Life art redesign.

Read the root DESIGN.md, then reuse the component families in `frontend/src/components/`. Add surfaces using ProjectHeader, the existing 1200px layout and semantic CSS tokens. Use SequenceRail for ordered checkpoints, ArtifactViewer for complete selected snapshots, ContributionCard for every eligible proposal, FundingSheet for explicit funding, BuildStatus for independent stages, EvidenceDisclosure for secondary facts and WalletButton for the single wallet entry point. Use production components in the showcase.

The adapter remains the only contract/SDK boundary. A derived frontend read may add consistency checks or presentation fields; it must not invent relationships, change an ABI, add authority, infer a winning proposal, or turn attempts/genesis/inheritance into paid completed rounds. Keep Latest and Selected independent. Historical Fork must use the exact accepted snapshot and provenance; Continue prepares from the current checkpoint only.

For a signing form, capture `useActionScope` with account/network and review-context identity. Pass its guard through `signingAccount`. All delayed preparation must assert the guard before invoking a wallet. Unmount/close must invalidate it; disabling a button alone does not cancel a pending promise. Keep exact approval and purchase as separate explicit actions, preserve original-hash/nonce recovery, and do not add automatic retries or spend authority.

Keep trusted bounded file retrieval, exact SHA-256/length/media validation and version keys. Never execute an artifact. HTML remains an opaque CSP sandbox; Markdown remains sanitized. The filename is the sanitized descriptor.path basename with its original extension. A failed fetch or decode cannot earn verification.

Build `dist/` after the final source change. Keep base `./`, relative assets and hash routes. Never include dependencies, caches or unnecessary npm archives in the submission; do not change an ignore file without a stated path budget. Root build/dependency configuration and A1 core remain protected. The current frontend dependency lockfile is sufficient for this version.

Run typecheck, unit tests, current Playwright acceptance and the actual disposable-chain runner. Add meaningful regressions for changed behavior; do not assert merely that an implementation was copied. Inspect actual desktop/mobile export screenshots and keyboard focus. Record current logs, receipts, hashes and limitations in a new dated evidence area; never relabel historical results as current passes. Preserve the non-production flags until separately authorized and independently checked live work occurs.
