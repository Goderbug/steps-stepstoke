# Public contracts, ABI and configuration

The public source is in [`src/`](../src/), ABI JSON in [`abi/`](../abi/) and fixed build metadata in [`config/release.json`](../config/release.json). This page describes the local A1/2 repair candidate atop the pinned IMD delivery. **No public deployment is recorded; live compatibility is `NOT_RUN`.** There are no web pages or frontend routes. Test mocks and test harnesses are not release contracts.

## Deployment and fixed authority

Anyone can deploy `RelayFactory()` with no arguments. Its constructor deploys a `RelayEncoder`, `RelayVerifier` and `RelayBranch` implementation. Each project/fork is an EIP-1167 clone of that implementation. No contract has an owner, admin, upgrade, policy setter, sweep, arbitrary-call or arbitrary-request entry point. Factory creation and clone initialization are one atomic transaction; a failed initialization rolls back creation/registration.

`RelayBranch(encoder_,verifier_)` is the implementation constructor, called by the Factory. It fixes `factory = msg.sender`, encoder and verifier as immutables and locks its own initializer. Directly deploying another Branch implementation does not register it with this Factory and gives it no authority over registered Branches. Public deployment instructions and authorization are outside the local demonstration; [future validation](LIVE-VALIDATION.md) describes the evidence needed first.

The fixed addresses are Intake v2 `0xa43e6f75ee006411f79ac1c84120606c2330de82` and Ethereum IMD `0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7`. The policy ID is `0x98360971ff8aeee2617322ba7ccbb1b51b318fb6e47f39129464eb5fd2f2e19b` (`keccak256("CTO-Relay-A1/2/fixed-profiles/unpublished")`). Chain 1 is intended, but the constructor does **not** enforce chain ID. Identical addresses on another network are not a compatibility guarantee.

| Action | Exact bytes32 ID (UTF-8, right padded; not a hash) |
| --- | --- |
| First own run | `0x6a6f622e6f70656e406a6f622d31000000000000000000000000000000000000` |
| Later own runs | `0x6a6f622e636f6e74696e7565406a6f622d310000000000000000000000000000` |

Compiler settings are solc 0.8.26, Cancun, optimizer 200 runs, via IR, no metadata bytecode hash, FFI disabled and no filesystem cheatcode permissions. Configuration is descriptive, not an on-chain control surface. `productionDeployment:null`, `productionReady:false` and `liveCompatibility:"NOT_RUN"` are literal release metadata. `independentAgentReview:"PASS_WITH_REPAIRS"` and `independentContributorReview:"NOT_RUN"` are different fields: see [review scope](HANDOFF.md).

## Common argument and result types

See [`RelayTypes.sol`](../src/RelayTypes.sol) for exact ABI order. JSON examples use decimal strings for large integers to avoid JavaScript rounding.

| Type | Ordered fields |
| --- | --- |
| `Asset` | `key:bytes32, kind:uint8, name:string, path:string, fileHash:bytes32, mediaType:string, size:uint32, submissionHash:bytes32, producer:address, jobId:string, resultHash:bytes32, revision:uint64` |
| `Proposal` | `anchor:bytes32, profile:uint8, target:bytes32, inputs:bytes32[], outputName:string, outputPath:string, text:string, publish:bool` |
| `Source` | `parent:address, revision:uint64, checkpoint:bytes32` |
| `Checkpoint` | `digest, assetsHash, resultHash, jobHash, projectHash` (all `bytes32`) |
| `Attempt` | `proposalId:uint256, sponsor:address, fee:uint256, requestId:bytes32, bodyHash:bytes32, outcome:bytes32, status:uint8, delivered:bool` |

`Kind` is Markdown=0, HTML=1, Image=2. Profiles are MarkdownCreate=0, MarkdownUpdate=1, HTMLCreate=2, HTMLUpdate=3, ImageCreate=4. Phases are Ready=0, Purchasing=1, Pending=2, ResultRecorded=3, Refused=4, Frozen=5. Attempt `status=0` alone is ambiguous between pending and successful result: inspect `delivered`, phase and events. After binding, active attempt/proposal identifiers remain available; they are not reset to zero.

The current witness is the **entire** sorted asset table, including unselected slots. Keys must be strictly ascending/nonzero; `keccak256(abi.encode(Asset[]))` commits every field. A selected input list is a different, sorted subset of keys. A new target key is chosen by the proposer; it is a slot identifier, not the file hash. Updates retain target kind/name/path. [Limits](LIMITS.md) specifies field bounds and type reservation.

## Factory entry points

All are nonpayable. Anyone can call the reads; none needs a token allowance.

| Function | Permission and behavior | Rejection / edge behavior |
| --- | --- | --- |
| `createProject(string goal)` | Anyone; returns initialized registered root Branch with fixed goal, empty direction/source and empty witness | Empty/overlong/invalid UTF-8 or control text; failed clone/dependency calls. No IMD purchase |
| `fork(address parent,uint64 at,Asset[] witness,string direction)` | Anyone; returns registered child with parent's fixed goal, chosen checkpoint source, exact historical assets and new fixed direction | `InvalidParent` if unregistered; `InvalidCheckpoint` for revision 0, nonexistent/unaccepted checkpoint or witness mismatch; empty direction `Policy.Invalid`, other text/size errors. Parent may be pending/frozen; chosen checkpoint must already be accepted. No purchase |
| `registered(address)` | Registration flag for this Factory | Unknown addresses return false; a lookalike contract or another Factory's Branch is not registered |
| `branches(uint256)` | 1-based registration index | Unknown/zero index returns zero address; not an exception |
| `branchCount()` | Number registered | Root and child each count once |
| `encoder()`, `verifier()`, `implementation()` | Fixed dependency addresses | No setter; implementation itself is not a usable project |
| `policyId()` | Compiled policy digest | Pure read |

Creation caller gets no continuing permission, exclusive sponsorship right or editing power.

## Branch entry points that change state

| Function | Permission and effect | Main failure modes |
| --- | --- | --- |
| `initialize(goal,direction,source,inheritedProjectHash,inherited)` | Immutable Factory only, once, on a clone; sets genesis checkpoint | `Unauthorized` for other callers, repeat call or implementation; `Busy` on guarded reentry; text/witness bounds. No user initializer flow |
| `propose(Proposal p,Asset[] current)` | Anyone; stores proposal and exact encoded body hash, returns nonzero ID; no purchase | `Stale` for wrong anchor; `InvalidWitness` for nonmatching table; encoder policy/size failures. Guarded against reentry. Does **not** require Ready, so proposals may be added while pending/refused/frozen; they do not unlock purchases |
| `sponsor(uint256 id,uint256 maxFee,Asset[] current)` | Anyone pays from their own balance/allowance; Ready only; returns request ID | `Busy`, unknown/zero proposal, stale anchor/body, wrong witness or invalid profile; `FeeExceeded` if price zero or above cap; token/Intake faults and exact-payment checks. All known admission checks and body bounds run before token transfer |
| `retry(uint256 maxFee,Asset[] current)` | Anyone may explicitly fund a retry in Refused; same active proposal and body, new attempt | `Busy` outside Refused; witness/body/price/payment errors as above. Cannot switch proposal or parent/files/text/profile. No refund of the old attempt |
| `onIntakeResult(bytes32 requestId,bytes32 resultHash,string uri)` | Fixed Intake only, own active Pending request, once; records digest, marks delivered and enters ResultRecorded | `NotPending` for wrong sender/request/replay/synchronous callback during guarded purchase; URI over 1,024 bytes gives `Policy.Limit`. No manifest parsing or work; a callback revert leaves Pending |
| `onIntakeFailure(bytes32 requestId,uint8 status,bytes32 reason,uint16,uint16,bytes)` | Same authentication as result; records status/reason; status 1 enters Refused, every other status enters Frozen | `NotPending` as above; panel counts/signature are ignored, not verified attestations. No refund or work |
| `bind(bytes rawManifest,Asset[] oldAssets)` | Anyone in ResultRecorded; verifies recorded raw digest and old witness, replaces one target, increments revision and enters Ready | `Busy`, `InvalidWitness`, strict-parser/verifier failures or `IdentityMismatch`. Replayed job, changed own project, or first child job reusing its directly inherited project hash fail. Revert preserves result and checkpoint; correct binding can be resubmitted without a purchase |

`guarded` protects initialization, propose, sponsor, retry and bind. Callback `_pending` also rejects calls while a guarded operation is entered. The returned Intake request ID must be nonzero and unused; otherwise the complete purchase reverts. Branch/Factory have no receive or fallback handler: ordinary ETH sends and unknown selectors revert. All Branch public methods are nonpayable.

Each purchase measures exact incoming sponsor/Branch deltas, grants exactly the price to Intake, invokes `requestWithFailure`, clears allowance, and requires the old Branch balance restored. Taxed/partial transfers or failed allowance cleanup revert atomically. The sponsor must separately approve **the Branch**, not Intake. A Branch donation remains stranded; it does not pay the sponsor's fee. There is no refund, withdrawal, timeout, cancel, admin repair or HTTP settlement function.

## Branch reads

All reads are public. ABI/argument decoding failures can revert any call; otherwise the special cases are below.

| Read | Meaning / failure behavior |
| --- | --- |
| `bodyOf(id,current)` | Returns exact `(action,body)` for a current proposal; unknown ID → `UnknownProposal`, old anchor/body → `Stale`, wrong table → `InvalidWitness`, encoder violations → policy errors. May preview while pending; preview is not purchase permission |
| `proposal(id)` | Full committed proposal; zero/unknown ID → `UnknownProposal` |
| `proposalBodyHash(id)` | Committed body keccak256; unknown ID returns zero |
| `attempt(id)` | Immutable purchase fields plus recorded callback outcome/status/delivered; zero/unknown ID → `NotPending` |
| `checkpoint(at)` | Permanent checkpoint at arbitrary revision; nonexistent revision returns all zeros. Genesis revision 0 exists but is not forkable |
| `anchor()` | Digest of the current checkpoint, not the newest proposal |
| `revision()`, `assetsHash()` | Current accepted revision and full witness commitment; child genesis revision is 0 even with inherited assets |
| `goal()`, `direction()` | Fixed root goal and this Branch's fixed direction |
| `source()` | Direct source parent/revision/checkpoint; root uses empty source |
| `inheritedProjectHash()` | Direct fork checkpoint's project hash, used to prevent first child binding to that project; not a parent project ID to continue |
| `latestJobId()`, `projectId()` | This Branch's latest bound own identities, initially empty even for children |
| `phase()` | Numeric lifecycle phase; missing callback leaves Pending indefinitely |
| `proposalCount()`, `attemptCount()` | Monotonic counts; failed/refused attempts do not create revisions |
| `activeProposal()`, `activeAttempt()` | Selected execution and latest attempt IDs; initially zero |
| `requestAttempt(requestId)` | Request → attempt ID; unknown request returns zero; old entries persist for history |
| `usedJob(jobHash)` | Whether this Branch already bound `keccak256(UTF-8 jobId)`; unknown returns false |
| `factory()`, `encoder()`, `verifier()` | Immutable dependencies |
| `intake()`, `imd()`, `policyId()` | Fixed compiled policy values |

There is no full asset-table getter. Recover witness bytes from `CheckpointWritten` or retained calldata, authenticate against `checkpoint(at).assetsHash`, then verify files separately.

## Pure helper contracts and external protocol interface

These public helpers are callable by anyone without state changes or payment. Calling a helper with invented context does not authenticate a Branch or advance history.

| Entry point | Behavior / failures |
| --- | --- |
| `Encoder.policyId()` | Same compiled policy ID |
| `Encoder.validateText(goal,direction)` | Bounded valid text; nonempty goal, optional empty direction; `Policy.Limit`/`Invalid` on excess/invalid text |
| `Encoder.assetsHash(assets)` | Fully validates table including ordering, descriptors, provenance and reserved capacity, then hashes; policy errors on invalid input |
| `Encoder.witnessHash(assets)` | Bounds table shape/variable field lengths then hashes; **does not fully validate** descriptors. For comparison against an already authenticated checkpoint, not admission of a new table |
| `Encoder.encode(goal,direction,ownLatestJob,p,current)` | Checks fixed profiles, table/selection/output/size rules and returns exact action/body; uses `ownLatestJob` to choose open/continue. No Branch anchor/storage authentication here; use `Branch.bodyOf` for authoritative previews |
| `Verifier.verify(raw,recordedHash,proposal,oldAssets,branch,revision)` | Checks raw digest, complete JSON, completed identities and unique `files[]` output; returns `(job,project,nextAssets)`. It stamps supplied producing Branch/revision. Does not itself enforce Branch phase, old commitment, own project consistency or used-job history; `Branch.bind` does. Invalid raw data/mapping/type/limits revert |
| `IIntake.priceOf(action,asset)` | External protocol read used on every purchase; zero means not sold to this client |
| `IIntake.requestWithFailure(action,body,Callback{target,selector},onFailure,asset,amount)` | External payable protocol interface; Branch supplies its own address and fixed callback selectors, exact IMD amount and zero native value. Not a Relay user entry point. Protocol reverts roll back the purchase; later refusal/failure callbacks do not refund it |

The binding parser validates the whole raw manifest and retains only acceptance fields. Ignored metadata is still authenticated by the original digest and checked for decoded duplicates, malformed UTF-8/escapes/Unicode/numbers, trailing data and the measured byte/structure/work envelope. Metadata arrays and strings do not consume the retained-field token/string budget. The verifier accepts exactly one `files[]` object with the committed output name/path/MIME, nonzero SHA-256 and submission hash and bounded nonzero integer byte length. Cross-slot name and equal or file/directory-prefix path conflicts are rejected during proposal admission; top-level `dist/` is reserved for HTML `dist/index.html`. It does not fetch bytes, compare repo commits or prove file content/quality. See [limits](LIMITS.md), [current repair evidence](validation/review-fixes/README.md) and [trust assumptions](OPERATIONS.md).

## Errors and events for observers

`Policy.Invalid` means a policy/type/content violation; `Policy.Limit` means a resource/text limit, including required text being empty. `Unauthorized` protects initialization; `Busy` protects phase/reentry; `Stale`, `UnknownProposal`, `InvalidWitness`, `FeeExceeded`, `PaymentMismatch`, `NotPending`, `IdentityMismatch`, `InvalidParent` and `InvalidCheckpoint` identify the cases above. OpenZeppelin/token/Intake errors, ABI decoding, arithmetic panics and out-of-gas can also propagate; an error list is not a guarantee of success for every other input.

| Event | Retained evidence |
| --- | --- |
| `Factory.BranchCreated` | Branch, direct parent/revision/checkpoint and creator; not an ownership grant |
| `Branch.Initialized` | Fixed goal/direction/source |
| `Proposed` | Proposal ID, anchor, body hash and complete ABI-encoded proposal |
| `Purchased` | Attempt/proposal/request IDs, sponsor, action, exact fee and body hash; proves purchase transaction, not admission/execution |
| `ResultRecorded` | Attempt/request, raw-manifest digest and bounded URI; URI emitted, not stored in a getter |
| `FailureRecorded` | Attempt/request, status and reason; reason is typically right-padded ASCII, not a refund entitlement |
| `CheckpointWritten` | Revision, digest and complete ABI-encoded witness, including genesis |
| `Bound` | Revision/proposal/attempt and exact raw manifest; no file bytes or Git-delivery guarantee |

Use registered addresses and canonical nonremoved logs at a consistent confirmed block. A decoded event alone is not independent authentication. [SDK history recovery](CLI.md) compares explicit logs with separately obtained permanent checkpoint reads. The checkpoint domain includes chain ID, Factory, Branch, policy, encoder/verifier, goal/direction hashes, direct source, revision, assets/result/job/project hashes; it prevents substituting another Branch or a later parent revision.
