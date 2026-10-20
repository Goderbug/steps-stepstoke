# Operating the fixed release

**Local implementation only: live compatibility, real IMD execution and public deployment are `NOT_RUN`.** Start with [build/test](BUILD.md), [runnable unsigned CLI examples](CLI.md) and [every public contract entry point](CONTRACTS.md). The [future IMD request/observer procedure](LIVE-VALIDATION.md) has not been executed. [Handoff](HANDOFF.md) separates completed local work from missing validation.

1. Read the Factory registration and Branch policy, goal, direction, latest checkpoint and phase. Recover the complete witness from its `CheckpointWritten` event and compare its ABI hash to the checkpoint read from the chain.
2. Select only current asset keys. Verify any bytes you intend to consume against their SHA-256, length and MIME. Treat file contents, model text, callback URIs and metadata as untrusted data.
3. Prepare a proposal using the current `anchor()`. An update must select its target. Read `bodyOf(id, witness)` and inspect the exact action, parent, inputs and output mapping. It is the authoritative request preview.
4. Before any future live rollout, validate every open/update/profile combination against the official free request checker. `tools/validate-live.mjs` prepares the preflight packet from an actual `bodyOf` eth_call result. It makes no network call, accepts no key, and does not authorize purchase. Preserve exact responses and mark compatibility only after verification.
5. A sponsor reads the live fee and chooses `maxFee`, approves the Branch, then explicitly sends the prepared sponsor transaction. Approvals and calldata can be prepared using any ABI tool. The shipped CLI never signs or submits.
6. Reconcile the original transaction hash if submission outcome is unknown. Look for the Branch's `Purchased` receipt and its request ID. Do not send another purchase merely because a client timed out. A mined transaction proves neither admission nor successful execution.
7. Wait for the authenticated callback. There is no on-chain timeout recovery. Status 1 permits a separately approved funded retry of the same active proposal. Status 2/unknown failures freeze purchases. A lost callback leaves the Branch pending; neither HTTP nor an operator can unlock it.
8. Obtain the raw result bytes through a trusted retrieval process. Never reserialize JSON to compute the callback digest. Compare keccak256, parse under the fixed envelope, and verify the actual file bytes separately. The SDK never automatically fetches a manifest URI. Optional `fetchPublicArtifact` / CLI `fetch-check` downloads only an explicit HTTPS URL, checks every DNS answer and redirect, pins the connection to a checked public IP, bounds the response, and verifies the actual bytes. IPv6 admission conservatively excludes mapped, translated, transition and special address ranges.
9. Anyone can prepare and submit `bind`. A failed attempt to bind does not buy AI or erase the result. Read the new checkpoint and archive its complete witness and raw manifest.
10. File verification, Git delivery and publication are separate observations. `github:true` does not prove Git delivery. A continuation refused while delivery is outstanding can only be explicitly retried after the operator investigates; no automatic retry is authorized. Publication is disabled in this release.

To fork, choose any accepted nonzero revision of a registered parent and supply that revision's full witness. Confirm the source checkpoint and new fixed direction before creating the child. The child owes no fee until somebody sponsors its first proposal; it will open its own Intake project.

## Node foundation

The exported functions prepare unsigned transactions: `createProject`, `proposeWork`, `sponsorProposal`, `retryRefused`, `bindResult`, and `forkHistory`. `previewProposal` and `readState` prepare `eth_call` requests. `decodeCheckpoint`, `recoverHistory`, `canonicalWitness` and `witnessHash` support history recovery from logs and independently obtained checkpoint reads. `verifyManifest` and `verifyFile` operate on raw bytes. `reconcileTransaction` always returns `purchase:false`.

The initial CLI supports the same preparation flows, local file checks and checkpoint decoding. Run `node cli/relay.mjs help`. File paths are explicit operator arguments, never paths automatically selected by an untrusted manifest. No file is executed or previewed in a browser.

The CLI prints read requests; it does not itself issue RPC calls. `queryPrepared`/`queryState`/`queryPreview` are optional SDK read adapters. There is no CLI approve or send command. Sponsor-to-Branch allowance must be prepared separately; unused allowance there is distinct from the Branch-to-Intake allowance that the contract clears. Prepared transactions must be simulated and reviewed against current state by the user's chosen transaction system before any separately authorized submission.

`sdk/files.mjs` adds bounded regular-file reads and `verifyHTMLDist`: it checks that an explicitly supplied local dist directory contains only a regular `index.html`, verifies its descriptor and actual bytes, and optionally checks that selected PNG bytes occur exactly as data URIs. It does not execute or prove arbitrary HTML/JavaScript behavior.

CLI `html-check` calls this helper without selected images. Only the SDK's explicit `selectedImages` argument (used by the local integration runner) checks embedding. A valid hash and leading MIME signature do not establish complete image validity, no remote HTML references, runtime restoration of inputs or a safe script. These remain content/runtime inspection responsibilities.

The on-chain encoder remains authoritative for current-state admission. Off-chain preparation is not a promise that a transaction will succeed: another sponsor can change the anchor first, a price can exceed the cap, or a Branch can become pending. Simulate the exact prepared call against current state when a read-only provider is available. No private key, mandatory RPC service, indexer or server is part of this package.

## Operational trust

The release trusts the external Intake contract and its writer to preserve the documented request/callback protocol and honestly report job/project/file identities. The fixed client cannot repair an incompatible external upgrade. An immutable client policy is not proof that an external protocol will remain immutable.

Content commitments do not prove task quality, model compliance, input consumption, HTTP availability, symlink absence, self-contained HTML behavior, Git delivery or publication. Inspecting content is an off-chain responsibility. Never execute an untrusted artifact to perform a hash or MIME check.

This work contains no public-chain deployment, live paid run, credentials, token issuance, child-job spending, governance, ranking or treasury.
