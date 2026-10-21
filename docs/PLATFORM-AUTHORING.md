# Extending the platform

Use English for new platform UI, accessibility labels, default fixtures and current contributor documentation. Authenticated files, chain identifiers and historical records retain their original bytes and language. Platform styling stays independent of project artwork; this assignment contains no Second Life art redesign.

Read [the current design system](DESIGN.md), then reuse the component families in `frontend/src/components/`. Add surfaces using ProjectHeader, the existing 1200px layout and semantic CSS tokens. Use SequenceRail for ordered checkpoints, ArtifactViewer for complete selected snapshots, ContributionCard for every eligible proposal, FundingSheet for explicit funding, BuildStatus for independent stages, EvidenceDisclosure for secondary facts and WalletButton for the single wallet entry point. Use production components in the showcase.

The adapter remains the only contract/SDK boundary. A derived frontend read may add consistency checks or presentation fields; it must not invent relationships, change an ABI, add authority, infer a winning proposal, or turn attempts/genesis/inheritance into paid completed rounds. Keep Latest and Selected independent. Historical Fork must use the exact accepted snapshot and provenance; Continue prepares from the current checkpoint only.

For a signing form, capture `useActionScope` with account/network and review-context identity. Pass its guard through `signingAccount`. All delayed preparation must assert the guard before invoking a wallet. Unmount/close must invalidate it; disabling a button alone does not cancel a pending promise. Keep exact approval and purchase as separate explicit actions, preserve original-hash/nonce recovery, and do not add automatic retries or spend authority.

Keep trusted bounded file retrieval, exact SHA-256/length/media validation and version keys. Never execute an artifact. HTML remains an opaque CSP sandbox; Markdown remains sanitized. The filename is the sanitized descriptor.path basename with its original extension. A failed fetch or decode cannot earn verification.

Build `dist/` after the final source change. Keep base `./`, relative assets and hash routes. Never include dependencies, caches or unnecessary npm archives in the submission; do not change an ignore file without a stated path budget. Root build/dependency configuration and A1 core remain protected. The current frontend dependency lockfile is sufficient for this version.

Run typecheck, unit tests, current Playwright acceptance and the actual disposable-chain runner. Add meaningful regressions for changed behavior; do not assert merely that an implementation was copied. Inspect actual desktop/mobile export screenshots and keyboard focus. Record current logs, receipts, hashes and limitations in a new dated evidence area; never relabel historical results as current passes. Preserve the non-production flags until separately authorized and independently checked live work occurs.

Regression changes must migrate every existing scenario and retain its safety assertions. Test fixtures use `platform.fixture.v1`; transaction recovery keeps its existing stable journal keys. Funding/proposal/fork forms are modal siblings of the workspace, and file selection uses the production file tabs. Wait for the branch identity before operating on a newly navigated workspace; never associate a journal with a branch by its position or recency alone.

Public RPC uses navigation keepalive only for reads with request bodies at most 16384 bytes. Wallet submissions and larger simulation bodies retain their ordinary transport. This transport policy is not authority to keep preparing or submit after unmount: action scopes still cancel delayed wallet submission. Keep unexpected runtime errors as failures; explicitly injected resource failures need exact URL/status attribution.

## Policy for future task briefs

Write new platform briefs, default examples, acceptance steps, operation/build/developer guides, visible states and accessible names in English. Explicitly supersede earlier Chinese-first/preserve-style UI guidance only; preserve original authenticated outputs, immutable identifiers and raw historical evidence in their original language and bytes. Do not ask a future worker to translate or restyle project artwork, including Second Life artwork.

Name the six preserved functions and the proposal → approval → purchase boundary. Specify exact allowed write paths, source commit, protected files and local-only acceptance separately. Never instruct an agent to infer owner addresses, winners, file origins or live acceptance from fixtures. Require PASS/FAIL/NOT_RUN rows linked to actual logs, receipts, source/export hashes and unresolved gates. Keep productionDeployment null, liveCompatibility NOT_RUN and productionReady false until a separately authorized live acceptance task supplies the evidence. A request for documentation alone is not permission to implement missing behavior or change config/core.

The assignment's write boundary wins over customary design-document locations: if only README.md and docs/** are allowed, put frontend and design documentation under docs/ and link it from root README. Do not write frontend/DESIGN.md or modify frontend/README.md in such a task.
