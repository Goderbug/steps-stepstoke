# Protocol overview (previous README, preserved)

This is the README text as delivered at commit `28fbb8a`, kept verbatim below the line for its detailed description of payments, assets, binding, file trust and profiles. The current entry point is the [root README](../README.md). Where they differ, the root README and [CONTRACTS.md](CONTRACTS.md) describe the code as it is now. Relative links below were written for the repository root.

---

# CTO Relay Station

The current deliverable adds the W1 Chinese browser UI and actual local-contract acceptance. Start with [frontend setup and validation](#w1-browser-integration-and-static-export). The A1 core and CLI documentation below remains applicable; its historical reports are preserved.

A public project has a fixed goal, immutable execution policy, an independent Intake payer, and a permanent history of accepted asset checkpoints. Anyone can propose work, explicitly fund a current proposal, bind its authenticated result, or fork an accepted historical checkpoint.

This checkout is a local repair candidate built on the [original IMD A1 delivery at `9b0294e7ab19060bd00c489fbe032cf248528e0d`](https://github.com/identity-md-launches/launch-2294-build-cto-relay-station/tree/9b0294e7ab19060bd00c489fbe032cf248528e0d). The candidate uses policy `CTO-Relay-A1/2/fixed-profiles/unpublished` and changes contracts, SDK/CLI and tests to address the later asset-mapping, manifest-envelope and `dist/` findings. [Current repair evidence](validation/review-fixes/README.md) records results against this source; older validation logs describe the original delivery. This local candidate is not a new IMD delivery or a public deployment.

**Production readiness remains false.** Local deployments use mock Intake/IMD. Live profile compatibility, real IMD runtime consumption and public deployment remain `NOT_RUN`. Finite parser limits and missing callbacks can still stop purchases; the larger metadata-aware envelope does not guarantee every future IMD manifest is bindable. The [A1 handoff](HANDOFF.md) is historical; see [current acceptance and remaining findings](validation/integration/acceptance/README.md) for this integration.

## Build and check offline

Run from the repository root after cloning, with **Node.js 22+**, **Foundry (`forge`, `anvil`)** and **solc 0.8.26** available. Python 3 is needed only for the separate fixture check. Tool binaries are prerequisites, not bundled dependencies: an offline machine must already have the compiler; otherwise Foundry may try to download it.

```sh
forge build
FOUNDRY_FUZZ_SEED=0x146644c630d7548a74d043e2779607ab2def960ac3890b548af84b4eb4db9118 forge test
forge fmt --check
node --test test-sdk/*.test.mjs
python3 test/adversarial/check-inline-fixtures.py
node tools/local-integration.mjs --review-fixes > /tmp/relay-a1-local.json
node tools/measure-release.mjs --review-fixes
node cli/relay.mjs help
```

No `forge install`, submodule initialization or npm installation is required. The local integration runner starts and stops its own Anvil and submits SDK-prepared calls using ephemeral unlocked local accounts; the SDK/CLI itself never signs or submits. The measurement tool checks fresh build artifacts but aggregates already saved binding traces and the saved integration report; it does not rerun those measurements. See [clean-checkout build and check details](BUILD.md).

The root Foundry configuration pins **solc 0.8.26**, Cancun, optimization, and IR compilation. FFI and filesystem permissions are disabled. Solidity tests use no environment, filesystem, FFI, RPC, funded wallet, or signing cheatcodes. Every test deploys fresh local contracts. `test/fixtures/FixtureData.sol` embeds the exact submitted fixture files and raw manifests; their source files are also included.

The root package pins **ethers 6.17.0**. The SDK directly imports its vendored standalone ESM bundle, so Node tests require no installation. Every transitive package in `package-lock.json` also resolves to an integrity-checked ordinary tarball under `vendor/npm/`. No dependency is a submodule.

## Use it

```sh
node cli/relay.mjs help
node cli/relay.mjs status --phase 2
```

The CLI prepares unsigned `{to,data,value}` transactions or `eth_call` requests. It has no wallet, key loader, broadcaster, automatic purchase or browser preview. Token approvals are separate ABI calls; no approval command is provided. No public deployment address is configured.

Follow the [runnable CLI walkthrough](CLI.md) to prepare **every operation** from saved local evidence, including creation, proposal, preview, sponsorship, retry, binding, reads, continuation, historical fork and actual file checks. Those examples use explicitly labelled local Anvil addresses and historical state; they are not ready-to-send live transactions. Current use requires independently verified deployment addresses, current state and exact raw evidence.

## The six public functions

| User action | Contract/API |
| --- | --- |
| Create a project | `RelayFactory.createProject(goal)` atomically creates and initializes a root Branch; no payment |
| Propose work | `RelayBranch.propose(proposal, currentWitness)` commits the current anchor, profile, target key, selected keys, output mapping, text and publication choice; no payment |
| Sponsor | `RelayBranch.sponsor(nonzeroProposalId, maxFee, currentWitness)` pays exactly the current Intake price |
| Read files, state and history | Branch getters, `proposal`, `attempt`, `checkpoint`, `bodyOf`, and complete public checkpoint/manifest events |
| Continue | Propose and sponsor again; the encoder uses this Branch's latest bound job automatically, with no round limit |
| Fork history | `RelayFactory.fork(registeredParent, acceptedRevision, completeWitness, direction)` creates a new payer with precisely that historical asset set; no payment |

`retry` and `bind` are explicit recovery/settlement operations. Contract use does not require this SDK, a browser, a server, an indexer or a signer service. All transaction arguments can be ABI-encoded directly using `abi/`.

The [public contract reference](CONTRACTS.md) describes every entry point and getter, permissions, events and failure modes. The W1 browser UI and committed static export are described below; no public deployment or hosting is performed.

Adding a proposal does not change the anchor or invalidate other current proposals. Any current proposal can win the next funded execution; there is no FIFO. A completed binding changes the anchor, making proposals against the prior checkpoint stale. Sponsors cannot edit a proposal.

## Authority and deployment

Deploy **`RelayFactory()` with no arguments**. Its constructor creates the fixed encoder, verifier and Branch implementation. It exposes no owner, operator, upgrades, setters, sweep function, arbitrary call, arbitrary skill, arbitrary body or raw payment entrypoint. Branches are fixed EIP-1167 clones of that implementation. The implementation's initializer is locked; a clone can only be initialized once by its immutable Factory, in the same transaction that registers it. Encoder/verifier addresses are embedded in implementation bytecode.

The release uses the task's Ethereum configuration:

| Parameter | Fixed value |
| --- | --- |
| Intended chain | Ethereum, chain ID 1 |
| Intake v2 | `0xa43e6f75ee006411f79ac1c84120606c2330de82` |
| IMD | `0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7` |
| First own run, including a child | right-padded UTF-8 `job.open@job-1` |
| Later own run | right-padded UTF-8 `job.continue@job-1` |
| Publication | disabled in this fixed release |

No deployment address or owner needs to be supplied to build the project. A future deployer must independently verify the intended chain, protocol code at both fixed addresses, the immutable build artifacts, runtime profile compatibility and current prices before choosing to deploy. Deploying the same bytecode on a different chain does not establish compatibility there. The Factory has no configurable constructor inputs or admin settings to fix after launch.

## Payments and asynchronous execution

The **Branch** is the payer seen by Intake. A sponsor approves that Branch for its chosen spending ceiling, then explicitly submits a sponsor/retry transaction. The Branch validates the current proposal and witness and constructs the bounded request before moving IMD. It calls `priceOf(action, IMD)`, rejects a zero price or a price above `maxFee`, pulls the exact fee, checks both balance deltas, approves exactly that fee, calls `requestWithFailure`, and clears the allowance. A partial pull, taxed transfer, false-return token or failed request reverts the whole transaction.

The paid fee is spent, including on refusal. The Branch never schedules work, refunds, automatically retries, or spends a pre-funded balance. Accidental token transfers are not spend authorization and cannot be swept.

Callbacks authenticate the fixed Intake, the Branch's outstanding request, and the exact registered success/failure selectors. They only record outcome/phase and emit bounded metadata. They do not parse, download, bind, transfer, or initiate work. Both callbacks are exercised with a **200,000 gas** stipend.

| Phase | Next permitted purchase |
| --- | --- |
| `Ready` | Any current nonzero proposal |
| `Purchasing` | None; reentrancy is blocked |
| `Pending` | None, indefinitely if no callback arrives |
| `ResultRecorded` | None until permissionless binding succeeds |
| `Refused` (status 1) | Explicit funded retry of the identical active proposal/body/snapshot |
| `Frozen` (status 2 or any other failure status) | None |

A retry creates a new attempt receipt and rereads the price. It cannot substitute the parent, files, profile, text, target or publication choice. Failed attempts never create revisions. There is no timeout, HTTP settlement, admin repair or callback replacement path.

## Assets and historical forks

The canonical witness is a sorted `RelayTypes.Asset[]` with strictly ascending, nonzero `bytes32` keys. It preserves `name`, relative `path`, file SHA-256, MIME, byte length, `submissionHash`, producing Branch, producing job, result keccak256 and producing revision. Its commitment is `keccak256(abi.encode(witness))`. A round replaces or inserts exactly its predeclared target; every other complete struct is retained unchanged.

The Branch stores each permanent checkpoint's digest, asset commitment, result digest, job hash and project hash. The checkpoint domain includes chain ID, Factory, Branch, policy ID, encoder, verifier, fixed goal, fixed direction, direct source checkpoint and revision. `CheckpointWritten` emits the complete ABI witness; `Bound` emits the exact raw manifest. Events and transaction calldata are sufficient to reconstruct the table without recursively loading ancestors.

Forks authenticate the registered parent and chosen nonzero accepted revision against its permanent stored commitment. The child retains every descriptor and its original provenance, but has no own project/job, proposals or publication identity. Its first purchase uses `job.open`; later purchases use only its own latest bound job. Inherited assets can be updated in that first open run. Root/child genesis revision zero is not itself a forkable accepted execution.

## Binding and file trust

Anyone calls `bind(exactRawManifest, oldAssetWitness)` after a success callback. The verifier checks the callback's **keccak256 of the original bytes**, a complete strict JSON document, `state: "completed"`, bounded job/project identity, and exactly one declared `files[]` output. The output must match the committed name/path and profile MIME/size rules. Continuations must keep the Branch's own project and use a new job identity. A child's first project cannot copy its source checkpoint's project.

The binding parser validates the entire authenticated document, including unknown metadata, while retaining only the fields needed for acceptance. It rejects duplicate decoded keys at every depth, invalid UTF-8/escapes, unpaired surrogates, noncharacters, trailing data and resource excess. The raw manifest cap is 32,768 bytes; retained strings and total document complexity have separate limits in [LIMITS.md](LIMITS.md). SDK binding uses `strictManifestJSON`; the general `strictJSON` helper keeps its 8,192-byte default. Unknown metadata is never truncated or substituted for `files[]`.

File **SHA-256** and manifest **keccak256** are different commitments. The contracts authenticate the writer's descriptors, not remote file availability, file quality, HTML behavior, or actual input consumption. The writer/runtime must truthfully expose the accepted bytes and honor the fixed profile. The SDK checks actual downloaded-or-operator-supplied bytes for SHA-256, length and MIME signatures without executing them. The optional `fetch-check` command downloads only explicit public HTTPS artifacts with checked, pinned DNS addresses; private, mapped and transition addresses are rejected. The separate browser adapter uses an explicit trusted-origin policy and isolated, sanitized previews; its DNS limitations are documented below.

A bad binding reverts without erasing the result or changing the prior checkpoint. Anyone may submit the correct raw bytes and witness again without purchasing. If the writer's actual hashed manifest violates the fixed policy, there is no alternative rewritten JSON or repair authority; that Branch remains at `ResultRecorded`. Its earlier accepted history can still be forked.

## Fixed profiles

| Profile | Runtime step | Selected input types | Output |
| --- | --- | --- | --- |
| Markdown create | `build-document` | Markdown | New `.md`, `text/markdown`, at most 64 KiB |
| Markdown update | `build-document` | Markdown, including target | Same slot/name/path |
| HTML create | `build-website` | Markdown, HTML, PNG | New slot, named exact `dist/index.html`, at most 2 MiB |
| HTML update | `build-website` | Markdown, HTML, PNG, including target | Same slot/name/path; restore selected target |
| Single image | `imagegen` | None | New `.png`, `image/png`, at most 256 KiB |

All profiles request `github:true, ipfs:false`. Publishing defaults to false and true is rejected. Image reference, edit and variation modes are disabled; this release generates PNG only. HTML may contain inline small PNG/JPEG/WebP data, but separate accepted image slots in this release are PNG. Stored unselected files are not represented as read.

Every selected input appears explicitly in `steps[].inputs` with its complete descriptor (`name,path,hash,mediaType,bytes,submissionHash`) and the unique alias `as: "asset-N"`, materialized at `.imd/reads/artifacts/asset-N`. Alias order follows sorted selected keys. `steps[].outputs` declares the single output mapping. These immutable runtime shapes/skill names must be checked against the live catalog before a paid release; the supplied protocol reference does not itself certify these three profiles. **Live compatibility remains `NOT_RUN`.**

Proposals cannot reuse another current slot's name, use the same path, or make one file path an ancestor of another. Updates retain their own mapping and must also avoid other slots. Historical independent descriptors remain readable without rewriting provenance. The fixed HTML path permits one HTML slot per Branch; update that slot or fork its accepted history. Non-HTML outputs cannot occupy top-level `dist/`.

HTML instructions require restoring the selected HTML, inline CSS/JS, exact selected image bytes as data URIs, no symlinks, and `dist` containing only `index.html`. Before payment the encoder rejects known image-size/aggregate excess and includes Base64/data-URI overhead in its conservative HTML input budget. The integration fixture demonstrates HTML → image → HTML: the third execution parent is job two, while inputs are HTML from job one and PNG from job two.

See [current repair evidence](validation/review-fixes/README.md), [limits](LIMITS.md), [operating procedure](OPERATIONS.md) and [review record](REVIEW.md). Original [integrated evidence](validation/README.md), [contributor evidence](../evidence/README.md) and [documentation reproduction](validation/documentation-pass/README.md) remain unchanged historical records; their source hashes, counts and gas figures are not measurements of this candidate.

The [future IMD request/observer procedure](LIVE-VALIDATION.md) describes a separately authorized runtime test; that test has not run. W1's originally separate fixture interface is now integrated with the accepted A1 candidate as described below. Historical repair reports retain their original scope. Local tests, review, original IMD source delivery, real runtime execution and production readiness are separate evidence categories.

## W1 browser integration and static export

The Chinese W1 website is in `frontend/`; the committed production export is in root `dist/`.
It uses relative assets and hash routes and works at a static gateway subpath. No public hosting
or chain deployment was performed. `#/` explains that public configuration is unavailable;
`#/local` uses actual local A1 contracts, and `#/demo` is a separately labeled fixture.

Requirements: Node 22+, npm, Foundry (`forge`, `anvil`). Install only frontend dependencies:

```sh
npm ci --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run preview --prefix frontend
```

Preview at `http://localhost:4173/`. Build writes root `dist/`, including local metadata, favicon,
share image and a small self-hosted subset of W1's existing Chinese font fallback. No private
RPC, API key, signer, mandatory proxy, indexer or backend is bundled. Missing local/public
configuration never substitutes fixture addresses. The frontend lockfile retains W1's exact
locked dependency versions; root compiler/dependency files remain untouched.

### Reproducible actual local contract setup

```sh
forge build
forge test
node --test test-sdk/*.test.mjs
node frontend/scripts/local-setup.mjs
```

Leave the last command running in a separate terminal. It refuses occupied ports instead of
modifying an existing chain, starts disposable Anvil 31337 on `127.0.0.1:8545`, installs MockToken
and MockIntake at A1's fixed protocol addresses **on this local chain only**, deploys the actual
final RelayFactory, and executes `tools/generate-local-config.mjs` against deployed code. It writes
`frontend/public/local-config.json` and updates the export's copy. Anvil uses temporary unlocked
development accounts; never use these accounts on a public chain. The printed two accounts are
funded with local MockToken. Runtime mock files/session data stay in ignored `test/scratch/`.

Configure a development wallet for this loopback network and choose one of those temporary
accounts, or run the automated named EIP-6963 test provider below. In another terminal:

```sh
npm run build --prefix frontend
npm run preview --prefix frontend
```

Open `http://localhost:4173/#/local`. Connect through the single wallet control. Public reads do
not need a connection. Create a project, propose work, then select any current proposal, review
the complete SDK/encoder body, confirm exact Branch allowance, and explicitly buy execution.
Creating, proposing and forking never buy AI. Titles are stored with the immutable goal; the
combined text must fit A1's 512-byte goal limit. Proposal requirements use the actual 1024-byte
text limit; the full encoded body is checked on chain against 16384 bytes before signing.

A real Intake worker is not connected to this local chain. Explicitly deliver a deterministic
mock result after a local purchase (replace the arguments with the actual Branch and a new
local identifier):

```sh
node frontend/scripts/local-deliver.mjs --branch ACTUAL_LOCAL_BRANCH --job LOCAL_JOB_ID
```

The command prints the original `result.json` path. Refresh progress, select that file in W1,
and choose **Bind original result without purchase**. Download/verify the actual asset bytes before a badge or
preview appears. `--file PATH` supplies real Markdown/HTML/PNG bytes matching the proposal;
`--status 1` sends an authenticated mock refusal (explicit newly funded identical-body retry),
and `--status 2` or `--status 7` demonstrates permanent freeze. These controls never purchase work.
Continuation uses Branch latestJobId; fork a selected accepted historical checkpoint, then
fund child work separately. File provenance remains with original producing branches/jobs.

The generated local config is committed as a reproducible **local mock observation**, guarded by
loopback page/RPC checks, chain ID, Factory registration, fixed policy/ABI and deployed code hashes.
Running setup regenerates it from the actual deployment. Public deployment remains null.
Browser downloads use the explicit test-only loopback artifact host; any future public deployment
must configure trusted HTTPS locations. Browsers cannot observe DNS answers or the connected IP;
see [SDK-BROWSER.md](SDK-BROWSER.md) for that trust limitation. No result URI can unlock a
Branch. The UI keeps transaction, admission, execution, callback, binding, file, Git and publication
states separate. Missing callbacks stay pending, status 2/unknown failure freezes, and unknown
transactions are reconciled by their original hash/nonce without automatic purchase.

### Worker validation

```sh
# Run from the repository root. Browser tools/caches stay outside the submission.
export PLAYWRIGHT_BROWSERS_PATH=/tmp/cto-relay-browsers
frontend/node_modules/.bin/playwright install chromium webkit
# On a minimal Ubuntu 24.04 runner without WebKit libraries (no sudo needed):
bash frontend/scripts/prepare-webkit.sh /tmp/cto-relay-webkit
export W1_WEBKIT_EXECUTABLE=/tmp/cto-relay-webkit/webkit-headless
npm run test:e2e --prefix frontend
node frontend/tests/integration/browser-chain.mjs --browser chromium
# On a runner with a per-process time limit, run each WebKit group separately:
node frontend/tests/integration/browser-chain.mjs --browser webkit --group flow
node frontend/tests/integration/browser-chain.mjs --browser webkit --group recovery
node frontend/tests/integration/browser-chain.mjs --browser webkit --group payments
node frontend/tests/integration/browser-chain.mjs --browser webkit --group failures
node frontend/tests/integration/browser-chain.mjs --browser webkit --group files
node tools/check-release.mjs
node tools/generate-sdk-abi.mjs --check
```

`W1_CHROMIUM_EXECUTABLE` may select an already installed Chromium. `test:local` starts its own
Anvil/artifact server, serves the actual production export, and signs W1 interactions through
a named EIP-6963 provider using two disposable unlocked accounts. It does not replace the UI
adapter, synthesize state or replay CLI transactions. Stop a manual local setup first because
these tests reserve the same loopback ports. `test/scratch/` is disposable and is not submitted.
Browser-chain commands must run sequentially. Each group starts a fresh disposable chain; the
`flow` group keeps Markdown, HTML → PNG → HTML and the historical fork/child sequence together.
The other groups cover independent payment, recovery and file scenarios. Chromium accepts the
same groups. `--out RELATIVE_DIRECTORY` selects an evidence directory; the default is
`docs/validation/integration/acceptance/<browser>[-<group>]/`.
Fixture tests can also be split with `--project=webkit-desktop tests/e2e/journey.spec.ts
--workers=1` (and the other files/projects in `frontend/tests/e2e/`). Set `W1_E2E_REPORT` to a
distinct output path relative to `frontend/` to retain each separate JSON report.
`prepare-webkit.sh` downloads ordinary Ubuntu library packages into its temporary directory and
creates a headless wrapper, including Mesa software rendering; it does not install system packages
or alter project dependencies. On a machine with supported browser libraries, omit that helper
and `W1_WEBKIT_EXECUTABLE`. The pinned worker-only taste probe is not a clean-checkout dependency;
its raw results and representative screenshots are retained in the acceptance report.

Actual results, matrix coverage, limitations, commands, screenshots, traces, input hashes and
release hashes are in [the dedicated acceptance report](validation/integration/acceptance/README.md).
The [prior integration report](validation/integration/frontend/README.md) is preserved as
historical evidence, including its then-unavailable WebKit checks.
Historical W1 evidence is referenced at its immutable commit instead of duplicated binaries.
`productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false` remain in force.
Authenticated oversized manifests can remain permanently unbindable. No administrator/timeout
unlock, refund, result rewriting or automatic retry was added.
