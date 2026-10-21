# Public entry points and failure boundaries

This is the ABI/page inventory of the delivered source, not a launch permission. All application contracts are permissionless except the two Intake callbacks. A wallet, UI gate, or an SDK guard does not remove a direct on-chain entry point. Reads cost no transaction gas; state changes require the caller's gas. None can be used on Ethereum until the three named applications are actually deployed and verified. See [operations](OPERATIONS.md) before a paid action.

## Contract roles and trust boundary

| Role | What it does | What it trusts |
| --- | --- | --- |
| `RelayFactory` | Creates and registers full root/fork Branches; fixes Encoder/Verifier addresses in its constructor. | At use time it checks dependency code and policy IDs. It checks a registered parent and selected checkpoint for a fork. No owner or initializer. |
| `RelayEncoder` | Validates finite profile/input policy and returns exact `job.open@job-1` or `job.continue@job-1` body bytes. | The caller supplies a complete witness; Branch checks its hash before using it. It cannot buy a job. |
| `RelayVerifier` | Parses the **original raw** result JSON against the recorded callback keccak and selects the one declared name/path. | Branch supplies its authenticated callback hash, stored proposal and prior witness. Extra files remain in the hashed envelope but do not enter the asset set. A direct `verify` call is only a calculation, not settlement. |
| `RelayBranch` | Holds a fixed goal/direction, proposals, paid attempts, callback outcomes, accepted checkpoints and lineage. Each Branch is its own Intake payer. | Fixed Intake address may deliver a callback only for its active request. Anyone may bind correct original bytes after that callback. |

Off chain, the browser/CLI prepares calls, reads receipts/logs and retrieves result/files. HTTP admission, Git delivery, local journals, file verification and a free preflight are observations only. On chain, `Purchased` means a paid request was admitted to the call path, `ResultRecorded`/`FailureRecorded` comes from Intake, and `Bound` creates an accepted checkpoint only after raw-byte/parser/identity checks. A wallet sponsor owns its own IMD and approves the **Branch**; the Branch pulls exactly the current `priceOf`, grants Intake exactly that amount for the request and clears Intake allowance. No product treasury, refund path, admin, upgrade, pause, clone, delegatecall, or arbitrary body hook exists. Full Branch creation costs more gas than a clone; current measured creation/fork costs and open service ceilings are in [limits](LIMITS.md).

## Callable Solidity ABI

The table names every function in the four delivered application ABIs, including compiler-generated public getters. All getters/pure functions are callable by anyone; their only intended failure is malformed arguments/provider failure unless stated. Struct parameters must follow the pinned ABI arrays in `abi/`.

| Contract and selectors | Caller; effect | Revert or practical failure |
| --- | --- | --- |
| Factory `createProject(goal)` | Anyone; gas-only full root Branch creation/registration. | Goal empty/invalid UTF-8/over 512 bytes, missing/wrong Encoder or Verifier code/policy, constructor gas/size. No IMD purchase. |
| Factory `fork(parent,at,witness,direction)` | Anyone; gas-only child at an **accepted** selected revision. Parent remains unchanged. | Unregistered parent, revision 0/unknown/unaccepted, wrong complete witness, empty/invalid/overlong direction, dependency or gas/size failure. Child inherits asset provenance but starts without own project/job. |
| Factory `encoder()`, `verifier()`, `intake()`, `imd()`, `policyId()` | Anyone; immutable/compiled dependency facts. | A fact alone does not authenticate a deployment. |
| Factory `registered(address)`, `branches(index)`, `branchCount()` | Anyone; registry reads. | Unknown `branches` index returns zero, not a verified Branch. Long-lived event/index pagination is bounded in the UI. |
| Encoder `validateText(goal,direction)` | Anyone; pure goal/direction validation. | Invalid UTF-8, empty goal, or 512-byte bound. |
| Encoder `assetsHash(assets)`, `witnessHash(assets)` | Anyone; pure canonical hashes. | `assetsHash` requires valid sorted descriptors; witness hash bounds shape. A hash without a trusted checkpoint is no authority. |
| Encoder `encode(goal,direction,ownLatestJob,proposal,current)` | Anyone; pure exact action/body preview. | Invalid profile/target/output/input/witness, publication=true, unsupported image editing, text/asset/body limits; a supplied latest job controls open versus continue in this standalone calculation. Branch `bodyOf` binds it to actual state. |
| Encoder `policyId()` | Anyone; compiled release ID. | Equality alone does not establish deployment provenance. |
| Verifier `verify(raw,recordedHash,proposal,oldAssets,branch,revision)` | Anyone; pure parse/descriptor calculation. | Hash mismatch; non-completed state; malformed, ambiguous, missing or excessive JSON/files; invalid descriptor/size. A direct caller may choose its inputs; only Branch `bind` authenticates them. |
| Verifier `policyId()` | Anyone; compiled release ID. | Same provenance limit as Encoder. |
| Branch `propose(p,current)` | Anyone; records a proposal/body hash, no payment. | Reentrancy guard; stale anchor, incomplete/wrong witness, invalid fixed profile/target/input/declared output, `publish=true`, finite limits. Can be proposed while another attempt is pending, but only a current proposal can later be funded. |
| Branch `bodyOf(id,current)` | Anyone; exact current action/body read. | Unknown ID, stale anchor/body, wrong witness or encoding failure. This read does not reserve price or pay. |
| Branch `sponsor(id,maxFee,current)` | Anyone with gas, current exact Branch IMD allowance and balance; makes one paid request. | Phase must be Ready; stale proposal/witness; zero/changed price or price above `maxFee`; token transfer/balance mismatch; Intake request failure; duplicate/zero request ID; reentrancy. Approval and purchase are distinct transactions. A receipt does not mean completed work. |
| Branch `retry(maxFee,current)` | Anyone may sponsor the **active** status-1 refused proposal again, with a new exact allowance and payment. | Phase other than Refused; changed body/anchor/witness; same price/payment/Intake failures as `sponsor`. Status 2/unknown is Frozen. There is no retry of an invalid binding, missing callback or unresolved transaction. |
| Branch `onIntakeResult(requestId,resultHash,uri)` | Only the compiled Intake address for the active pending request; records hash/URI, not parsed files. | Wrong sender/request, duplicate, wrong phase, reentrancy, URI over 1,024 bytes. If Intake cannot deliver, Pending remains; HTTP cannot settle it. |
| Branch `onIntakeFailure(requestId,status,reason,*,*,*)` | Only the compiled Intake address for the active pending request; status 1 Refused, all other statuses Frozen. | Wrong sender/request, duplicate, wrong phase, reentrancy. No caller can convert a frozen status to Ready. |
| Branch `bind(rawManifest,oldAssets)` | Anyone; gas-only accepted checkpoint after ResultRecorded. | Wrong phase/witness, raw bytes not equal callback keccak, invalid/missing/ambiguous/oversized original envelope, reused job ID, wrong project ID, inherited parent project reuse, gas limit. A revert leaves the same recorded result; correct bytes/witness can be submitted again without buying. |
| Branch `anchor()`, `checkpoint(at)`, `proposal(id)`, `attempt(id)` | Anyone; checkpoint/proposal/attempt reads. | `proposal` and `attempt` revert for ID 0/out of range. An unknown checkpoint returns zero fields; require a nonzero digest and an accepted result for a fork. |
| Branch `factory()`, `encoder()`, `verifier()`, `goal()`, `direction()`, `source()`, `inheritedProjectHash()`, `revision()`, `assetsHash()`, `latestJobId()`, `projectId()`, `phase()` | Anyone; fixed identity, lineage and current state reads. | These values need registry/code/receipt verification before public use. `source` is a parent checkpoint, not this child's own IMD head. |
| Branch `proposalCount()`, `proposalBodyHash(id)`, `attemptCount()`, `activeProposal()`, `activeAttempt()`, `requestAttempt(requestId)`, `usedJob(jobHash)` | Anyone; counters and mapping reads. | Unset keys return zero/false; use them with events and full checkpoint witness, not as stand-alone settlement proof. |
| Branch `intake()`, `imd()`, `policyId()` | Anyone; compiled release dependencies. | If fixed external service/catalog moves or withdraws the action, existing Branches cannot be retargeted. |

The supplied Intake interface has `priceOf(action,asset)` (anyone may read; price can change or be zero) and `requestWithFailure(...)` (called by Branch during a funded purchase). IMD is an ERC-20: the sponsor must separately approve the exact Branch allowance and keep enough balance; approval alone does not invoke Intake. Neither external contract is deployed or controlled by this repo.

## Browser routes and controls

All routes are static hash routes; there is no site server or account database. The header's Connect sheet is reachable on every route: discovered EIP-6963 browser wallets, mobile wallet-browser links and Coinbase Smart Wallet. Browse without a wallet; signing requires the selected account and correct chain. The visible switch control is user-initiated. Wallet rejection, wrong network, changed account/provider, stale review or missing deployment stops a signing preparation.

| Page | What a visitor can do | Permission and failure state |
| --- | --- | --- |
| `#/` | Read release/deployment status; open demo, local, Ethereum, component gallery; explicitly recheck a handoff. | Public. No handoff means unavailable, not empty live projects. A failed handoff stays disabled. The Create button is disabled here until verified public mode exists. |
| `#/demo`, `#/demo/b/:fixtureId` | Fixture project list and project workspace; simulate all six workflows, callback/receipt failure controls, account/network and reset. | No real signature/IMD. Deterministic fixtures can reject simulated signatures or produce pending/refused/frozen/bad-binding states. Reset discards fixture history. |
| `#/showcase` | Inspect the same sequence, output, funding sheet, status and wallet components with illustrative data. | Public demonstration only; funding is simulated. No authenticated result or transaction. |
| `#/local`, `#/local/b/:address` | Verify disposable chain 31337, list/create/open registered Branches, propose, approve, purchase, inspect, bind, continue and fork. | Requires a fresh local setup/config and loopback page. Reads need the local chain/code; writes need a connected chain-31337 wallet. MockIntake/MockToken and fixture files cannot prove live compatibility. Stale configuration, wrong network, unknown Branch, wrong witness or failed transaction stop the action. |
| `#/ethereum`, `#/ethereum/b/:address?deployment=:identity` | After a later handoff, verify chain-1 deployment, list/open Branches, inspect histories and, only with closed gates, prepare writes. | In this candidate the page is unavailable. A bookmark must match deployment identity. Read verification checks handoff/receipt/code/registration again; failure clears displayed project data. A disconnected or wrong-chain wallet may still read verified data. No status JSON alone enables signing. |

On each workspace page the sequence selects an **accepted** historical checkpoint for reading/forking, while Continue prepares from the **latest** checkpoint. Output tabs, SHA-256/length/media checks, original-result download, official admission read, transaction/attempt disclosure, refresh and manual bind are separate controls. A failed file fetch (including CORS), missing URI, malformed bytes or absent callback shows unavailable/failed evidence; it never completes a round. HTML previews are isolated and Markdown is sanitized. The demo-only callback control cannot invoke real Intake. The production UI may disable a control, but permissionless Solidity still has the ABI above.

## CLI entry points

`node cli/relay.mjs help` gives exact option names. Every write command below produces **unsigned calldata**; none signs, sends, auto-retries or switches chain. An operator must independently verify deployment/account/price/phase before using the bytes. Bad/missing/duplicate options, malformed JSON, noninteger amounts, invalid witnesses and finite limits return JSON error with exit code 1.

| Commands | Result and limit |
| --- | --- |
| `create`, `propose`, `continue`, `sponsor`, `retry`, `bind`, `fork` | Prepare the corresponding contract call. `continue` is an alias of propose; `bind` requires exact original raw file and callback hash. CLI `sponsor` does **not** prepare approval or read a fresh price for you. |
| `preview`, `read`, `witness`, `decode-checkpoint`, `recover-history` | Prepare an `eth_call` or calculate/decode supplied witness/log data. History recovery needs explicit matching Branch logs/checkpoints; absent or contradictory data is not filled in. |
| `result-fetch`, `intake-read`, `admission-read` | Read official allowlisted original result or job observations. Network/CORS/unavailable status can fail; HTTP admission/Git are diagnostic and `settlement:false`. `result-fetch` checks exact callback keccak and 32 KiB cap. |
| `file-check`, `html-check`, `fetch-check` | Check supplied descriptor versus actual bytes or bounded trusted HTTPS artifact. Missing file, unsafe path/host/redirect, length/hash/MIME mismatch fails. File checks do not bind. |
| `status` | Project distinct receipt, phase, checkpoint/file/Git/publication observations supplied by the caller. Caller-supplied booleans are labels, never chain authority. |

The public Node/browser SDK additionally exposes pure preparation, strict parsing, file validation, bounded log/receipt reads, handoff/deployment verification and production-gate checks. [SDK function inventory](SDK-API.md) names the exported groups; [CLI.md](CLI.md) gives operator commands. Its calls may reject malformed input or unavailable transport; none grants a new on-chain permission.
