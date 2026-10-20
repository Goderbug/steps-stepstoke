# Future IMD request and observer procedure — NOT_RUN

**This procedure was not executed.** No public deployment, real token approval, paid job, live request check or public-chain fork test is established by this documentation. It describes a future operator-controlled validation after review and separately authorized spending. The delivered tooling cannot sign or broadcast; this page does not supply credentials, a wallet, a live Factory address or spending authorization.

The release requests external skills and file-descriptor shapes that local mocks do not validate. An incompatible fixed encoder cannot be repaired by editing this document or changing a JSON config value after deployment. Keep live compatibility `NOT_RUN` until actual observations support a narrower statement; never turn an unexpected response into a claimed PASS.

## Establish the release and observation sources

Retain the actual checked-out commit (`git rev-parse HEAD`), source fingerprints, build settings, ABIs, creation-code hashes and local check results. The repository's fixed contract metadata is in `config/release.json`; no current public Factory deployment is recorded there. A future deployment must have its own chain ID, transaction receipt, actual Factory/dependency/implementation addresses and verified code record. Compare immutable-patched runtime code with deployed instances, not just an unpatched artifact template. Creation-code hashes in the config do not identify a deployed address by themselves.

For future chain reads, the operator supplies an independently selected Ethereum RPC as `ETH_RPC_URL`. Confirm chain ID 1, code at Intake `0xa43e6f75ee006411f79ac1c84120606c2330de82` and IMD `0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7`, token identity/decimals and both runtime prices. Do not assume the local mock price of 0.5 IMD is current, or that another network's same addresses sell these jobs. Do not deploy mock code to a public chain or treat local `anvil_setCode` as protocol deployment proof.

Read-only command templates, **not run here**:

```sh
: "${ETH_RPC_URL:?Set an operator-selected Ethereum read RPC}"
cast chain-id --rpc-url "$ETH_RPC_URL"
cast code 0xa43e6f75ee006411f79ac1c84120606c2330de82 --rpc-url "$ETH_RPC_URL"
cast code 0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7 --rpc-url "$ETH_RPC_URL"
cast call 0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7 'symbol()(string)' --rpc-url "$ETH_RPC_URL"
cast call 0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7 'decimals()(uint8)' --rpc-url "$ETH_RPC_URL"
cast call 0xa43e6f75ee006411f79ac1c84120606c2330de82 'priceOf(bytes32,address)(uint256)' 0x6a6f622e6f70656e406a6f622d31000000000000000000000000000000000000 0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7 --rpc-url "$ETH_RPC_URL"
cast call 0xa43e6f75ee006411f79ac1c84120606c2330de82 'priceOf(bytes32,address)(uint256)' 0x6a6f622e636f6e74696e7565406a6f622d310000000000000000000000000000 0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7 --rpc-url "$ETH_RPC_URL"
```

Retain raw responses, block number/hash, RPC source and UTC observation time. Zero price is not sold. Code being present and `symbol()` matching do not certify compatibility or security. Future real-IMD execution remains a separate observation from these reads.

The supplied protocol material names relative HTTP endpoints `/requests/check` and `/intake/{chainId}/{transactionHash}`; it does not pin an API origin in this release. Obtain the current official HTTPS origin independently and supply it as `PLANE_ORIGIN`. No guessed host or callback-supplied arbitrary URL should become the API authority. Do not put private RPC endpoints, credentials or bearer tokens in published evidence.

## Free exact-request preflight

Before any funded request, review the current official catalog/schema for `build-document`, `build-website`, `imagegen`, their create/update modes and the exact `steps[].inputs`/`outputs` fields. All profiles fix `github:true, ipfs:false`, one named output, publication off; image inputs/edits/variations are disabled. A generic request-check success for another body does not validate this encoder.

Use an actual registered Branch/current proposal and authenticated current witness. Prepare its `bodyOf` read with the CLI. Here `BRANCH_ADDRESS`, `PROPOSAL_ID` and `WITNESS_FILE` are actual operator-supplied current data, not example deployment values:

```sh
: "${BRANCH_ADDRESS:?Set the verified Branch address}"
: "${PROPOSAL_ID:?Set the actual current nonzero proposal ID}"
: "${WITNESS_FILE:?Set the authenticated current witness file}"
node cli/relay.mjs preview --branch "$BRANCH_ADDRESS" --id "$PROPOSAL_ID" --witness "$WITNESS_FILE" > preview-call.json
```

The CLI prints a read request, not an RPC response. A future read-only adapter can obtain that response without a signer:

```js
// Future execution only; ETH_RPC_URL is an explicitly supplied read endpoint.
import { readFile, writeFile } from 'node:fs/promises';
import { JsonRpcProvider } from './vendor/ethers/ethers.mjs';
import { queryPrepared } from './sdk/index.mjs';
const provider = new JsonRpcProvider(process.env.ETH_RPC_URL);
try {
  if ((await provider.getNetwork()).chainId !== 1n) throw new Error('Wrong network');
  const prepared = JSON.parse(await readFile('preview-call.json', 'utf8'));
  const result = await queryPrepared({ request: ({method,params}) => provider.send(method,params) }, prepared);
  await writeFile('body-of-return.json', JSON.stringify(result) + '\n');
} finally { provider.destroy(); }
```

Save the code above as an explicitly reviewed `.mjs` script in the project root or run it with `node --input-type=module`; it uses project-root relative imports. Record the block used; for consistent snapshots the SDK accepts a specific `blockTag` as the third `queryPrepared` argument. No helper verifies RPC honesty by itself.

Prepare and inspect the packet:

```sh
node tools/validate-live.mjs body-of-return.json > preflight-packet.json
node --input-type=module <<'NODE'
import { readFile, writeFile } from 'node:fs/promises';
const packet = JSON.parse(await readFile('preflight-packet.json', 'utf8'));
await writeFile('request-check.json', JSON.stringify(packet.preflight) + '\n');
NODE
```

The tool accepts either an ABI hex string or `{ "result": ABI_HEX }` in the input file. It decodes the actual action/body, checks bounded JSON, records exact raw request hex/hash/byte length and emits `{action:"job.open"|"job.continue",input:…}` for the HTTP checker. It always emits `compatibility:"NOT_RUN"`; it performs no HTTP call and makes no compatibility decision. Reserializing the **preflight wrapper** is appropriate for the checker; never use that technique for callback-authenticated result bytes.

Future free check, **not run here**, with the independently verified official HTTPS origin:

```sh
: "${PLANE_ORIGIN:?Set the independently verified official HTTPS API origin}"
curl --fail-with-body --silent --show-error --request POST \
  --header 'Content-Type: application/json' --data-binary @request-check.json \
  --dump-header request-check.headers --output request-check.response.json \
  "${PLANE_ORIGIN%/}/requests/check"
```

Retain the exact sent wrapper, raw request bytes/hash, response headers/body, HTTP status and exit status. A 2xx response alone is not acceptance: inspect all returned blockers/schema/catalog messages. A failure is a release blocker for that mode; do not repeatedly spend against it. Preflight itself does not prove payer ownership, current parent eligibility, finished Git delivery, actual execution, result compatibility or cost-free admission after payment.

Validate every enabled open/create/update/input combination, including first-child open that updates an inherited target and continuations selecting older assets. An update in a child can use `job.open`; action selection follows own job state, not the word "update". Continuations must preview the Branch's exact latest bound `parentJobId` and contain no `repoUrl`, `baseCommit` or parent `projectId`. Live continuation checks require real eligible parent jobs; fixture IDs are never substitutes.

## Planned explicit request matrix

Use a fixed public goal such as "Maintain a public Markdown guide and a self-contained HTML page illustrating the guide." Choose distinct target keys in advance and retain them. The following texts are concrete future **proposal texts**, still subject to exact encoder preflight; they are not claimed live-admitted requests.

| Stage | Mode and selected files | Proposal text and observation |
| --- | --- | --- |
| Root 1 | MarkdownCreate, no inputs; name `guide`, path `docs/guide.md` | "Create a concise Markdown guide to this public project. Include the literal marker A1-MD-ORIGINAL." Verify one actual UTF-8 Markdown output and a new own job/project |
| Root 2 | MarkdownUpdate, target guide selected | "Restore the selected guide, preserve A1-MD-ORIGINAL and add a short continuation checklist." Same slot/name/path, new job, same project; all old non-target descriptors unchanged |
| Root 3 | HTMLCreate, select guide; name `site`, path `dist/index.html` | "Create a self-contained HTML page for the selected guide. Include id=original-marker, inline CSS and JavaScript, and no external resources." Verify named HTML equals actual dist/index.html |
| Root 4 | ImageCreate, **no inputs**; name `illustration`, path `assets/illustration.png` | "Generate one simple PNG illustration of a relay station. Return the actual PNG below 262144 bytes; no references or variations." Preserve the guide/HTML descriptors, verify actual image bytes |
| Root 5 | HTMLUpdate, select current HTML from root 3 and PNG from root 4 | "Restore the selected HTML, preserve original-marker and existing text, and embed the selected PNG bytes unchanged as an inline data URI." Parent job is root 4; restored HTML is root 3; exact PNG bytes retained |
| Historical fork | Fork root revision 3 **after** root revision 5; direction "Illustrate the original guide page in a new direction." | Authenticate root-3 full witness, inherit exactly its guide/HTML/provenance, no PNG from later history, no own project/job/proposals and no purchase |
| Child 1 | ImageCreate, no inputs, same image output mapping in a new child slot | "Generate one simple PNG illustration for this Branch's direction, below 262144 bytes." First own action is open and creates a distinct own project |
| Child 2 | HTMLUpdate, select inherited HTML and child's new PNG | "Restore the inherited selected HTML, preserve original-marker and inline the selected PNG exactly." Continue only child's own image job; parent state unchanged |

Each proposal and fork is free of IMD purchase. Each sponsor is an explicit separately reviewed payment. A human-funded child **Branch** here is distinct from a runtime worker launching an autonomous paid child job, which the fixed objective forbids. No automatic follow-up purchases, token launch, on-chain app deployment, ranking, governance or treasury behavior is part of this validation.

Before each sponsor, compare `bodyOf` bytes with the reviewed proposal and full current witness, re-read phase/anchor and `priceOf`, choose `maxFee`, independently prepare an exact intended token allowance to the Branch, and simulate the precise sponsor call from the intended sponsor. Use your separately approved transaction system to submit; no real key or wallet is part of the delivered CLI. If state changes between preview and submission, reconcile/review rather than automatically buying again. No send command is supplied here.

## Observe every stage independently

For each actual future operation, retain the following without exposing credentials:

| Observation | Minimum raw evidence and pass condition |
| --- | --- |
| Transaction | Chain/block/hash/receipt status, input calldata and logs; registered Factory/Branch match. A success receipt proves only that transaction |
| Purchase | `Purchased` attempt/proposal/request IDs, exact action/body hash/fee and sponsor; independently match Intake request receipt/body and Branch as payer; exact token deltas and zero Branch→Intake allowance |
| Admission | Official observation correlated to that same chain/transaction/request and payer; record refused/accepted/pending separately from the receipt |
| Execution | Actual job/project identity and terminal state, retaining raw response; no inference from a request hash or accepted preflight |
| Callback | Authenticated Branch `ResultRecorded` or `FailureRecorded`, matching active request/attempt and actual phase; small callback alone does not bind history |
| Binding | Exact raw manifest bytes, callback keccak256, full old witness, successful bind receipt, `Bound`/`CheckpointWritten`, permanent checkpoint read and new table; verify one-target change and retained provenance |
| File | Actual accepted named bytes, SHA-256/length/MIME checks and raw result descriptor. Preserve manifest `files[]`; never substitute `source[]`, a later Git blob or model text |
| Git delivery | Independently observed repo/commit/delivery outcome tied to the correct job; compare accepted file bytes separately. `github:true` and a manifest's delivery string alone are insufficient |
| Publication | `DISABLED` in this release, not PASS. No publication transaction or browser preview |

The protocol's read-only observer endpoint can be queried for an **actual purchase hash**, not the bind/proposal/approval hash. Future template, not run here:

```sh
: "${PURCHASE_TX_HASH:?Set the actual Ethereum purchase transaction hash}"
curl --fail-with-body --silent --show-error \
  --dump-header intake-observer.headers --output intake-observer.response.json \
  "${PLANE_ORIGIN%/}/intake/1/${PURCHASE_TX_HASH}"
```

An HTTP status is an observation, never a substitute callback or settlement authorization. No observer call can unlock Branch state. Obtain exact raw manifests through an independently checked public retrieval process; the SDK does not automatically fetch callback URIs. Verify raw keccak256 before interpreting the descriptor; verify actual file SHA-256 separately. Optional public HTTPS file fetching must use an explicit reviewed URL and the enabled SDK guard, never private/local addresses or automatic execution. Preserve the raw bytes alongside their digests.

For HTML, inspect dist shape and exact named bytes, verify selected PNG data URIs with the SDK's selectedImages argument and check old markers without opening a browser. Inspect remote references/self-contained requirements separately; the on-chain verifier and SDK do not prove HTML/JS behavior. Git history and publication do not replace those checks.

## Failure decisions and evidence gaps

If the original transaction outcome is unknown, look up that same hash/nonce and current Branch attempt/phase. Do not repeat a purchase because an HTTP client timed out. Status 1 permits only an explicit funded retry of the same proposal/body/snapshot after investigation and new authorization; it spends again and cannot change the request. Status 2 or any other failure status freezes purchases. Missing callback remains Pending indefinitely, including when HTTP says a job finished. Do not impersonate Intake, add an admin repair or use an off-chain result as settlement.

A wrong witness/raw document bind can be simulated read-only and should fail without changing the checkpoint/result. Correct original bytes/witness can then bind without purchasing. If the writer's **actual authenticated manifest** violates the fixed policy (extra outputs, oversize, invalid schema/identity), reformatting cannot fix it. Retain that core failure, stop readiness claims and assess an earlier historical fork; it does not make the failed paid attempt successful.

No turnkey live observer harness, public deployment script, live fork-integration test, paid run evidence or external human audit is delivered. Those remain explicit work in [the A1 → W1 handoff](HANDOFF.md). Future reports must separate local checks, catalog/preflight, protocol reads, deployment, real consumption, Git and readiness, with exact commands/responses and unresolved findings for each.
