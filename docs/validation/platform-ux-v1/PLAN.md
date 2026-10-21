# CTO Relay PLATFORM-UX-V1 integration and acceptance plan

## Scope and baseline

This is the bounded integration-planning record for PLATFORM-UX-V1. It does not make a frontend, configuration, protocol, ABI, dependency, signing, or deployment change. The subsequent whole-project website stages own those implementation changes. This record therefore does not relabel retained test evidence as a new result.

The delivered source is the requested repository at commit `878ba4ba1cf7c601656f3a25d17546a425ba1207`; its tree is `c7838395fec7b493f61a1cf7a08cf5c9db6966b9`. [BASELINE.json](BASELINE.json) records the starting commit and SHA-256 of every protected A1 file in `src/`, `sdk/`, `cli/`, `abi/`, and `config/`. A protected-path diff against that commit was clean when recorded. `foundry.toml`, `foundry.lock`, `remappings.txt`, `lib/`, root `package.json`, and root `package-lock.json` are also out of scope and must stay unchanged.

The platform remains intentionally non-production: `productionDeployment` is `null`, `liveCompatibility` is `NOT_RUN`, and `productionReady` is `false`. No live IMD request, public deployment or hosting, funded credential, protocol decision, allowance rule, callback rule, or automatic spending is authorized by this plan.

## Current integration inventory

The accepted outputs are present in one delivered tree, not separate mock-only branches:

| Surface | Existing production integration | Required PLATFORM-UX-V1 direction | Must retain |
| --- | --- | --- | --- |
| Project list and creation | `App.tsx`, `ProjectList.tsx`, `LocalApp.tsx`; public route fails closed, `#/local` reads the disposable local chain, `#/demo` is explicitly labelled | English `ProjectHeader` and project list/create surface; browsing remains available before wallet connection | Fixed goal, gas-only creation, public read access, explicit unavailable/local/demo distinction |
| Workspace, proposals, files and history | `Workspace.tsx`, `ProposeForm.tsx`, `FilePreview.tsx`; `ChainAdapter` derives Branch, events, checkpoints, assets and proposals from the local chain | Goal first, sequence rail second, selected completed output large, evidence in disclosures, all eligible proposals reachable | Create/update proposals, read-only historical selection, bounded verified files, isolated HTML and explicit continuation/fork choices |
| Contribution, funding and lifecycle status | `SponsorPanel.tsx`, `ConnectSheet.tsx`, `actionScope.ts`, `recovery.ts`; real local wallet transactions use `ChainAdapter`, not the fixture adapter | `ContributionCard`, `FundingSheet`, `BuildStatus`, `WalletButton`; prepare before signing and make approval/purchase/callback/binding distinct | Fresh quote/anchor/account/network/spender checks, exact allowance, duplicate guards, recovery without rebuy, separate retry/freeze states |

The current W1 interface and user-facing source are Chinese-first. That is a known baseline gap against the English-only PLATFORM-UX-V1 requirement, not permission to silently translate historical records, authenticated output, or identifiers. The implementation stage must replace current operation, build, developer, accessibility, default demo, and future task-authoring copy with English while retaining historical evidence verbatim.

### Six functions and invariant mapping

| Function | Current concrete boundary | PLATFORM-UX-V1 presentation and final acceptance |
| --- | --- | --- |
| Create project/root Branch | `RelayAdapter.createBranch`; `ProjectList` create form | Create is a separate prepared confirmation; fixed goal and gas-only label shown before wallet call; test double-click and account/network cancellation. |
| Propose work | `RelayAdapter.propose`; `ProposeForm` | Proposal is distinct from funding; show anchor, profile, output, inputs, request text and publication choice; retain every eligible current proposal. |
| Fund/sponsor | `quoteFee`, `approve`, `sponsor`, `retryRefused`; `SponsorPanel` | Funding sheet re-reads account, network, anchor, proposal, Branch spender, price/max fee and exact allowance before each signature; approval confirmation precedes purchase. |
| Read project/files/state/history | `getBranch`, `getHistory`, `getProposals`, `getSponsorships`, `fetchFile` | Reads need no wallet; a selected checkpoint is read-only; complete asset table reports original producer Branch/job/checkpoint, not a fabricated latest origin. |
| Continue | A new proposal and explicit sponsor on the current Branch; `latestJobId` becomes the continuation parent | “Continue” opens only preparation for the current checkpoint. It never submits a proposal, approval, or payment by itself. |
| Historical fork | `RelayAdapter.fork`; selected checkpoint witness | Place Historical Fork beside the selected output; fork the exact selected accepted snapshot/provenance, begin a separate child, and require its own later funding. |

### Shared interface contract for the implementation stage

`RelayAdapter` and `domain/types.ts` remain the only application boundary to the contract/SDK. The implementation must either reuse their mapped values or extend them only in unprotected frontend code without fabricating chain relationships. Each production component consumes the same `Branch`, `Checkpoint`, `AssetVersion`, `Proposal`, `FeeQuote`, and `Sponsorship` record:

| Component | Required input/state | Prohibited inference |
| --- | --- | --- |
| `ProjectHeader` | Branch identity, fixed goal, latest checkpoint, connected account/network state | A deployment, ownership privilege, a writable history selection, or a live result from a fixture |
| `SequenceRail` / `RoundItem` | Numeric checkpoint order, `createdBy`, job/attempt state, selected ID and latest ID | Calling genesis, inheritance, unaccepted attempts, or a pending payment a completed paid round |
| `ArtifactViewer` | Selected checkpoint’s full asset list and each asset’s origin fields | Treating the branch head as the producer of every retained file |
| `ContributionCard` / `FundingSheet` | A selected current proposal, fresh `FeeQuote`, stage state and explicit retry identity | Sponsor edits, max-fee-as-allowance, callback/HTTP settlement, or a payment after stale preparation |
| `BuildStatus` / `EvidenceDisclosure` | Independent approval, purchase, admission, execution, callback, binding, files, Git and publication states | Collapsing stages into “complete,” or treating external publication as acceptance |
| `WalletButton` | EIP-6963/phone/Smart Wallet state plus account/network identity | A connection requirement for public reads or a generic wallet label when named providers are available |

When branch and history reads can disagree, the data layer must obtain a consistent snapshot or refetch **both**. The view must show a read-only Retry control while the mismatch exists; it must recover without reload or signature. Data refresh cannot overwrite the selected checkpoint merely because the latest checkpoint changed.

## Prior findings and their preservation checks

The three earlier accepted A1 review findings are not visual defects and are not reopened as new findings in this planning stage. Their existing repairs must be protected by the interface and local acceptance:

| Prior finding | Existing A1 disposition | UX and integration guard |
| --- | --- | --- |
| Different slots could claim the same public mapping | Cross-slot name, equal-path and ancestor-path collisions are rejected before payment; historical provenance remains readable | Proposal errors must identify the invalid mapping without suggesting a workaround or changing the output mapping. |
| Unrelated metadata exhausted the retained JSON parser envelope | Full raw document validation with bounded retained acceptance fields and SDK parity | Evidence disclosure may reveal bounds and raw-result status, but must not reconstruct, truncate, or “repair” a manifest. |
| Markdown/PNG could occupy `dist/` | Top-level `dist/` is reserved for HTML `dist/index.html` | Asset and preview labels must show real descriptor path/type; no new asset type or path exception is introduced. |

The retained Medium WebKit issue is separate: three original reload-heavy local-contract groups recorded loopback RPC `pageerror`s even though their functional assertions passed. Instrumented reruns were clean, but the cause remains `OPEN_INTERMITTENT`; it is not a resolved fix or a current-stage pass. The final acceptance reruns must preserve the runner’s separate functional and runtime-cleanliness verdicts and include an investigation/reproduction result.

## Implementation order

1. **Freeze and map.** Recheck [BASELINE.json](BASELINE.json), root protected paths, adapter/types, local configuration identity and existing exports. Inventory every non-English current-operation/build/developer/default-demo/a11y string. Do not edit authenticated records, chain IDs, Factory/Branch/checkpoint IDs or historical identifiers.
2. **Build the English design foundation.** Add only frontend-owned semantic tokens: canvas `#F6F5F1`, surface `#FFFFFF`, text `#22231F`, secondary `#666961`, border `#DDDCD4`, action `#C1452A` with white text, and selected `#FFF1E8`. Use a disclosed bundled Space Grotesk/IBM Plex Mono family or a stated local fallback; body 16px, meta 13px, desktop/mobile title 36/28px; 4/8/12/16/24/32/48/64 spacing; control/preview/badge radii 6/8/4; 1200px maximum width, 24/16px gutters, and 44px targets. Ship only light tokens, labels alongside state color, 140–200ms property-specific motion and reduced-motion alternatives.
3. **Replace the three surfaces with shared production components.** Introduce `ProjectHeader`, `SequenceRail`/`RoundItem`, `ArtifactViewer`, `ContributionCard`, `FundingSheet`, `BuildStatus`, `EvidenceDisclosure`, and `WalletButton`. The local showcase must compose these same production components; it may not copy mocked variants. Keep open-workshop whitespace, thin rules, few boxes and overlay-only shadows, without project-art redesign or a dark theme.
4. **Make sequence/history truth visible.** Put compact goal before the rail, then a large selected completed output and one contextual next action. Distinguish Latest from Selected. Keep numeric chain order and real IDs. Ensure all current eligible proposals remain reachable through disclosure/list controls; only accepted checkpoints expose fork. Preserve inherited assets’ original producer branch/job/checkpoint in a full table.
5. **Harden transaction and recovery presentation.** Preparation is cancellable on close/unmount/account/network change before wallet invocation. Freshly validate account, network, anchor, selected proposal, parent, price/max fee, Branch spender and exact allowance before signing. Status 1 offers only an explicit same-body funded retry after new review; missing callback stays pending; status 2/unknown freezes; a corrected binding never repurchases. No HTTP result settles state.
6. **Keep the file trust boundary.** Retain trusted bounded retrieval, SHA-256/length/media validation, exact version-keyed bytes and provenance, safe basename/extension download naming, lazy bounded verified thumbnails/fallbacks, sanitized Markdown and opaque CSP/sandbox HTML. Broken/unavailable/tampered files have no verified badge. PNG uses its natural aspect ratio. No preview may permit scripts, wallet/storage/form/navigation escape.
7. **Export, document and evidence.** Produce a relative static `dist/` export with hash routes and gateway-subpath proof. Update English design, build, developer, and future task-authoring documentation. Deliver the tokens/showcase, raw command logs, browser screenshots, receipts, source/export hashes and open-issues register under this directory; measure frontend source at or below 8 MiB and exclude dependencies/caches.

## State matrix to implement and test

| Area | Required visible state and user action |
| --- | --- |
| Public browsing | Readable before wallet connection; unavailable live configuration explains why without fixture substitution. |
| Sequence | Latest and Selected both labelled when different; selection changes output/history only, never payment target. |
| Proposal | Current, stale, sponsored and invalid-anchor states have labels; every eligible current proposal can be selected. |
| Funding | Disconnected → Connect; wrong chain → Switch; review → Approve exact amount; confirmed allowance → Purchase; each action has its own pending/error state. |
| Lifecycle | Pending/missing callback remains pending; status 1 has explicit identical-body retry; status 2/unknown is frozen; binding failure permits corrected raw bytes without repurchase. |
| History/fork | Genesis, inherited assets and unaccepted attempts are not rendered as paid completed rounds; fork only selected accepted snapshot and child funding remains separate. |
| Read consistency | Branch/history mismatch freezes actions, labels content read-only, offers Retry and refetches both reads. |
| Files | Loading, verified, unavailable, malformed, too-large and sandboxed states are labelled; verification is descriptor/version keyed. |
| Accessibility | Keyboard focus, 44px targets, focus ring, modal trap/restore, Escape, labels and live/error announcements; reduced motion has no essential-only animation. |

## Acceptance and evidence plan

The later implementation stage must write fresh, dated outcomes rather than copy old PASS text. The planned evidence layout is:

```text
docs/validation/platform-ux-v1/
  BASELINE.json
  README.md
  check-results.json
  source-sha256.json
  dist-sha256.json
  open-issues.md
  design-review.md
  raw/                 # command stdout/stderr, one file per command
  screenshots/         # inspected production export states
  receipts/            # local-chain transaction/SDK audit references
```

| Gate | Fresh command or observation | Required result boundary |
| --- | --- | --- |
| Baseline/protected paths | SHA-256 compare against `BASELINE.json`; protected-path diff | Exact equality; any difference blocks handoff. |
| Core integrity | `forge build`; seeded `forge test`; `forge fmt --check`; `node --test test-sdk/*.test.mjs`; release/ABI checks | Run after final frontend work without changing protected files; record actual counts and tool exit status. |
| Frontend | locked frontend install only if allowed, typecheck, unit tests, production build, source-size and export hash/rebuild comparison | English source and relative static export; do not claim a build from historical logs. |
| Fixture UI | all configured Chromium/WebKit desktop/mobile/narrow projects | Explicitly labelled fixture coverage only; never used as contract proof. |
| Actual local contracts | `browser-chain.mjs` with final production `dist/`, local setup, EIP-6963 test wallet, receipt/SDK audit | Real disposable Anvil transactions and deterministic files; MockToken/MockIntake only, never real IMD. Exercise all six functions plus state matrix. |
| Browser design/accessibility | Inspect production export at 320, 390, intermediate breakpoint and desktop; keyboard, focus, overlay, contrast and reduced motion; capture final screenshots | Source review does not substitute for rendered inspection. Native devices, screen readers, zoom and Safari remain explicitly scoped if not run. |
| WebKit diagnostic | Reproduce/retest reload-heavy recovery, payments and failures groups with raw pageerror/request-cancellation capture | Preserve FAIL if any pageerror occurs; a clean rerun does not erase historical raw failures or establish a cause. |
| Handoff | Check English docs, raw logs/screenshots/receipts/hashes/open issues; preserve `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false` | Structural/local evidence only; no security, public deployment or real-IMD claim. |

## Existing harnesses and evidence boundaries

- `frontend/tests/integration/browser-chain.mjs` is the actual browser-to-disposable-Anvil harness. It deploys final contracts, drives the production `dist/` through a named EIP-6963 local test wallet, uses `ChainAdapter`, and can audit receipts through `frontend/scripts/audit-local-evidence.mjs`. It is real local-contract evidence, but uses MockToken/MockIntake and a scripted mock writer.
- `frontend/tests/e2e/{journey,layout,revision,w1,wallet}.spec.ts` with `frontend/tests/e2e/harness.ts` is the fixture UI suite. Its `FixtureAdapter` results are useful UI regression coverage but never prove contract integration.
- `frontend/tests/unit/` covers domain, chain-provider and preview/security behavior. Root `test/` and `test-sdk/` cover the protected A1 contracts and SDK. `tools/check-release.mjs` and `tools/generate-sdk-abi.mjs --check` check local release/ABI consistency.
- Retained reports under `docs/validation/integration/acceptance/` and `docs/validation/integration/documentation/` describe prior runs. They are references only for this plan. The outstanding WebKit diagnostics are recorded in `acceptance/browser-diagnostics.json` and must remain open until reproduced and explained.

## This-stage check record

This planning stage made only the two files in this directory. It verified the requested starting commit/tree, recorded protected SHA-256 values, inspected the three implementation surfaces, the typed adapter boundary, all six functions, existing local-contract/fixture harnesses, prior review findings and the open WebKit diagnostic. Root and frontend build configuration/dependencies were not edited. Frontend dependencies were absent, so frontend typecheck/unit/build were not run in this stage rather than creating or modifying prohibited `node_modules/`.

Actual check outcomes for this stage are deliberately narrow:

| Check | Outcome |
| --- | --- |
| Protected A1/root path diff | PASS: clean against the observed baseline. |
| `node --test test-sdk/*.test.mjs` | PASS: 39 passed, 0 failed. |
| `forge fmt --check` | PASS: exit 0. |
| `node tools/generate-sdk-abi.mjs --check` | PASS: all five ABI SHA-256 values match. |
| `node cli/relay.mjs help` | PASS. |
| `forge build` | No outcome recorded. Three attempts entered `Compiling 42 files with Solc 0.8.26`, but this execution wrapper ended each foreground command at roughly 30 seconds before an exit status or `out/` artifacts were available. Consequently `node tools/check-release.mjs` could not open `out/RelayFactory.sol/RelayFactory.json`; that is a missing-build-output limitation, not a release-check PASS or a source failure. |
| Frontend typecheck/unit/build and browser/local-contract runs | NOT_RUN in this planning stage: `frontend/node_modules/` was absent and is protected from modification; retained reports were not claimed as new runs. |

The later implementation stage is responsible for the full fresh acceptance matrix above.

**Completion:** Complete for the bounded planning/integration-map scope. PLATFORM-UX-V1 implementation and its fresh browser acceptance are intentionally pending the subsequent whole-project website stages.
