# CTO Relay Station A1

A public project has a fixed goal, immutable execution policy, an independent Intake payer, and a permanent history of accepted asset checkpoints. Anyone can propose work, explicitly fund a current proposal, bind its authenticated result, or fork an accepted historical checkpoint.

This delivery integrates the Solidity core, Node ESM SDK/CLI, adversarial tests and an actual SDK-to-contract local chain flow. **This is not ready for real funds.** Local deployments and tests use mocks at the supplied Intake and IMD addresses. **Live compatibility, real IMD consumption and public deployment are `NOT_RUN`; production readiness is false.** An independent agent review and replay are recorded in [final validation](docs/validation/README.md); this is not an external audit. Missing callbacks or incompatible authenticated manifests can permanently stop purchases on a Branch. Documentation does not repair code or close findings. See [A1 → W1 handoff and missing work](docs/HANDOFF.md).

## Build and check offline

Run from the repository root after cloning, with **Node.js 22+**, **Foundry (`forge`, `anvil`)** and **solc 0.8.26** available. Python 3 is needed only for the separate fixture check. Tool binaries are prerequisites, not bundled dependencies: an offline machine must already have the compiler; otherwise Foundry may try to download it.

```sh
forge build
FOUNDRY_FUZZ_SEED=0x146644c630d7548a74d043e2779607ab2def960ac3890b548af84b4eb4db9118 forge test
forge fmt --check
node --test test-sdk/*.test.mjs
python3 test/adversarial/check-inline-fixtures.py
node tools/local-integration.mjs > /tmp/relay-a1-local.json
node tools/measure-release.mjs
node cli/relay.mjs help
```

No `forge install`, submodule initialization or npm installation is required. The local integration runner starts and stops its own Anvil and submits SDK-prepared calls using ephemeral unlocked local accounts; the SDK/CLI itself never signs or submits. The measurement tool checks fresh build artifacts but aggregates already saved binding traces and the saved integration report; it does not rerun those measurements. See [clean-checkout build and check details](docs/BUILD.md).

The root Foundry configuration pins **solc 0.8.26**, Cancun, optimization, and IR compilation. FFI and filesystem permissions are disabled. Solidity tests use no environment, filesystem, FFI, RPC, funded wallet, or signing cheatcodes. Every test deploys fresh local contracts. `test/fixtures/FixtureData.sol` embeds the exact submitted fixture files and raw manifests; their source files are also included.

The root package pins **ethers 6.17.0**. The SDK directly imports its vendored standalone ESM bundle, so Node tests require no installation. Every transitive package in `package-lock.json` also resolves to an integrity-checked ordinary tarball under `vendor/npm/`. No dependency is a submodule.

## Use it

```sh
node cli/relay.mjs help
node cli/relay.mjs status --phase 2
```

The CLI prepares unsigned `{to,data,value}` transactions or `eth_call` requests. It has no wallet, key loader, broadcaster, automatic purchase or browser preview. Token approvals are separate ABI calls; no approval command is provided. No public deployment address is configured.

Follow the [runnable CLI walkthrough](docs/CLI.md) to prepare **every operation** from saved local evidence, including creation, proposal, preview, sponsorship, retry, binding, reads, continuation, historical fork and actual file checks. Those examples use explicitly labelled local Anvil addresses and historical state; they are not ready-to-send live transactions. Current use requires independently verified deployment addresses, current state and exact raw evidence.

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

The [public contract reference](docs/CONTRACTS.md) describes every deployed entry point and getter, permissions, events and failure modes. There is no frontend, hosted page or browser UI in this repository.

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

The parser decodes keys and strings, rejects duplicate decoded keys at every depth, invalid UTF-8 and escapes, unpaired surrogates, noncharacters, invalid paths, trailing data, and resource excess. Unknown metadata is parsed under the same bounds. `source[]`, Git commits and later metadata cannot replace `files[]`.

File **SHA-256** and manifest **keccak256** are different commitments. The contracts authenticate the writer's descriptors, not remote file availability, file quality, HTML behavior, or actual input consumption. The writer/runtime must truthfully expose the accepted bytes and honor the fixed profile. The SDK checks actual downloaded-or-operator-supplied bytes for SHA-256, length and MIME signatures without executing them. The optional `fetch-check` command downloads only explicit public HTTPS artifacts with checked, pinned DNS addresses; private, mapped and transition addresses are rejected. No browser preview is included.

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

HTML instructions require restoring the selected HTML, inline CSS/JS, exact selected image bytes as data URIs, no symlinks, and `dist` containing only `index.html`. Before payment the encoder rejects known image-size/aggregate excess and includes Base64/data-URI overhead in its conservative HTML input budget. The integration fixture demonstrates HTML → image → HTML: the third execution parent is job two, while inputs are HTML from job one and PNG from job two.

See [measured limits](docs/LIMITS.md), [operating procedure](docs/OPERATIONS.md), [review record](docs/REVIEW.md), and [final integrated evidence](docs/validation/README.md). Earlier contributor evidence remains in [evidence/](evidence/README.md). The [documentation reproduction record](docs/validation/documentation-pass/README.md) is a separate local check, not a new independent audit.

The [future IMD request/observer procedure](docs/LIVE-VALIDATION.md) is concrete guidance for a separately authorized future run; none of it was executed here. The [A1 → W1 handoff](docs/HANDOFF.md) identifies delivered work and missing validation. Local test success, independent review, real IMD execution, Git delivery and production readiness remain separate. No Git remote delivery or final submission commit is asserted by this README.
