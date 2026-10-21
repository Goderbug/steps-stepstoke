# English platform interface

The current frontend is PLATFORM-UX-V1, using the Open Workshop system in [DESIGN.md](../DESIGN.md). It preserves all six A1 functions. Earlier W1 Chinese screenshots, authenticated output and historical records are retained as history; they do not specify current interface copy.

## Surfaces and routes

`#/` explains public configuration and offers a labelled demo or actual local contracts. With `productionDeployment:null`, public actions remain unavailable and no fixtures are substituted. `#/demo` is a deterministic browser-local fixture list; `#/local` reads actual local A1 contracts from verified loopback configuration. `#/showcase` composes the production components, rather than copied mock variants. Hash routing and relative assets support gateway subpaths.

The project list uses ProjectHeader and a separate create review. The workspace reads a fixed goal, prominent SequenceRail, complete selected ArtifactViewer, next action, all contributions, then independent funding/build states and evidence disclosures. FundingSheet is a distinct review/approval/purchase surface. Browsing is wallet-free.

## Interaction sequence

1. **Create project → Review creation → Sign and create.** Fixed title/goal, gas only. No AI purchase.
2. **Continue → Prepare a contribution → Review proposal → Sign and submit proposal.** Always uses the current checkpoint, even when viewing history. A proposal does not purchase execution or invalidate its current peers.
3. **Review funding → Approve exact amount.** Sponsor reviews immutable proposal, inputs, anchor, publication choice, request body, parent, Branch spender and live quote. Maximum fee is a purchase cap, never an allowance. USD context is unavailable because no price source is supplied.
4. **Approval confirmed → Purchase execution.** A separate explicit action. Receipt confirmation and a fresh exact allowance check precede purchase. All signing checks run again; duplicates are blocked.
5. **Callback → binding → file verification.** Independent labelled states. Bind original callback-authenticated bytes; selecting the correct result or witness does not repurchase.
6. **Select checkpoint → Historical Fork → Review fork → Sign and fork.** Only accepted nonzero execution checkpoints expose this action beside their output. The exact selected snapshot and original file provenance are inherited. Parent proposals/project/head/publication identity are not copied; child funding is separate.

## Reads, identity and recovery

`ui/snapshot.ts` obtains branch/history together and repeats both when they disagree. Persistent inconsistency displays a read-only Retry control and pauses actions. Retry requires no signature or page reload. An explicit selected checkpoint remains selected across refresh; Latest is a separate label. IDs come from adapter records and chain events, not winner or relationship inference.

`useActionScope` carries cancellation from UI preparation through the adapter to the final wallet boundary. Close, unmount, account/network changes and changed review context invalidate captured work. Cancellation cannot retract an already-submitted wallet request. `ChainAdapter.send` preserves original hash/nonce journalling, selected-provider equality, fresh preparation/simulation and receipt confirmation.

Unknown submission outcomes reconcile original records. They never trigger an automatic new purchase. Missing callbacks remain pending. Authenticated status 1 permits only an explicit new payment for the identical request. Status 2 and unknown failures freeze purchases. HTTP status, publication URLs and Git observation cannot settle or unlock a Branch.

## Files

Actual file bytes come only through the existing trusted bounded adapter retrieval and SDK checks. SHA-256, descriptor length, media and image resource/decode checks gate preview and download. A version-keyed component prevents old verified bytes appearing as a new version. The selected snapshot's full asset table retains original producer branch/job/checkpoint, including inherited files. Latest execution is not every file's origin.

HTML uses `sandbox=""`, an opaque origin, `referrerPolicy="no-referrer"`, restrictive CSP and sanitized navigable/active elements. Markdown strips scripts, event handlers, frames, forms, remote images and host identifier/focus overrides. No preview receives wallet access. PNG uses natural aspect ratio. Lazy thumbnails verify bounded bytes before display, otherwise a labelled fallback. Download names come from a sanitized descriptor.path basename, keeping the extension and exact verified bytes. Unavailable or malformed files are never verified.

## Accessibility and implementation

Semantic headings, ordered checkpoints, labels, disclosures, 44px controls, visible keyboard focus and reduced motion share the same CSS tokens. Sheets trap Tab, support Escape/backdrop/close, make background content inert and return focus to the opener. Native table regions allow keyboard scrolling without page overflow. Current text, error copy and accessibility labels are English; authenticated historical content is preserved.

See [authoring](PLATFORM-AUTHORING.md) for component reuse and [validation](validation/platform-ux-v1/README.md) for actual checks and limitations. Local/fixture evidence does not establish live compatibility: `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`.
