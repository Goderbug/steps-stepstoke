# A1 integration handoff

Status: **A1_INTEGRATION_PENDING**. W1-to-A1 local-chain integration: **NOT_RUN**. The unmodified A1 dependency harness was separately replayed with local mocks; that is not a W1 browser bridge. Mainnet compatibility/consumption: **NOT_RUN**. No real key, paid job, public deployment or production hosting was used.

## Observed source and pins

- Public dependency: https://api.imd.fun/jobs/d5530989-b886-4f9d-80dd-44d26d85ffd2
- Submitted-body SHA-256 supplied by the assignment: `3683b19c9c39d67b5c679641e4755e7914f471fe41329d1a3b2dfb1a34a58c77`. The job metadata alone is not verification of the exact submitted-body encoding.
- Build/integration responses: `validation/raw/a1-build.json`, `validation/raw/a1-integration.json`, and the final release observation when present in `validation/release.json`.
- At this revision's build and integration checks the job was `completed` with a public delivery.
- Delivered repository: https://github.com/identity-md-launches/launch-2294-build-cto-relay-station, commit `9b0294e7ab19060bd00c489fbe032cf248528e0d`. The exact public archive and inspected SDK/ABI/config/harness files are SHA-256-pinned in `validation/raw/a1-source-pins.json`; the Git tree response is `validation/raw/a1-delivery-tree.json`.
- Imported into the product: **none**. `sdk/index.mjs` imports `node:crypto`, `node:fs` and the bundled ethers module; it cannot be directly imported into this browser app. `config/release.json` has `productionDeployment: null`, `productionReady: false`, `liveCompatibility: "NOT_RUN"` and publication disabled. This inspection establishes source provenance, not verified deployed configuration or a browser bridge.
- `validation/release.json` pins W1 source, tests, protected lock/config files, export and the exact job-response bytes with SHA-256. The delivery service will assign W1's final commit; the manifest describes the checked working-tree bytes.

## Existing boundary

`src/domain/adapter.ts` defines one UI-domain `RelayAdapter`; `types.ts` defines view models and explicit operation capabilities. This is **not a contract ABI**. `liveAdapter.ts` advertises every capability false and rejects every operation with `A1_INTEGRATION_PENDING`. `FixtureAdapter` is a separate local-only implementation with simulated identities, prices, callbacks and storage. The default route never falls back to it.

## Dependency replay performed in this revision

The pinned public archive was extracted only in `test/scratch/a1/` and left unmodified. Executed from that archive root:

```sh
forge build --offline
node --test test-sdk/*.test.mjs
node tools/local-integration.mjs
```

All three commands exited 0. Raw build/SDK logs are `validation/raw/a1-core-build.log` and `validation/raw/a1-sdk-replay.log` (20 tests). `validation/raw/a1-core-local-replay.json` records the unmodified harness's 33 local transactions, seven bound rounds and ten checks, including all five profiles, retained HTML/image bytes, historical fork, identical-body refusal retry and corrected binding. It starts/stops its own Anvil and uses temporary unlocked accounts and mocked Intake/token code. No A1 core source, dependency or config was changed. This is **A1 dependency replay only**: W1's UI adapter, browser signing, recovery and reads were not wired to that chain. Those integration cases remain **NOT_RUN**; mainnet, paid IMD execution, Git delivery and publishing are also **NOT_RUN**.

## Exact browser integration handoff

Preserve the disabled live adapter until all gates below pass. Use the actual delivered APIs, not selectors inferred from W1:

| W1 boundary | Delivered SDK API / remaining work |
| --- | --- |
| Root/propose/fork | `createProject`, `proposeWork`, `forkHistory`; map fixed goal/direction, real bytes32 asset keys and authenticated witnesses |
| Read/history | `readState`, `queryState`, `decodeCheckpoint`, `recoverHistory`; recover/verify complete events and canonical checkpoints without a mandatory indexer |
| Fee/unsigned sponsorship | `previewProposal`, `queryPreview`, `sponsorProposal`; refresh actual quote, anchor and Branch allowance, then pass unsigned calldata to the selected wallet |
| Refusal/binding | `retryRefused`, `bindResult`; preserve exact raw body/result/witness, authenticate status and preview fresh retry fee/allowance |
| Witness/file verification | `canonicalWitness`, `witnessHash`, `verifyManifest`, `verifyFile`; retain independent bounded browser decode and isolated previews |
| Recovery | `reconcileTransaction`, `lifecycleStatus`; W1 must additionally journal original hash/nonce before receipt and reconcile replacements without repurchase |

A reviewed browser-compatible SDK entrypoint/bridge is still required: do not remove Node checks by silently weakening verification. A verified product Factory deployment/config and public RPC must come from A1's deployer in a separately authorized stage; none is present in the delivered release. Run W1's real selected-provider local-chain acceptance before enabling any live capability. No deployment or paid followup is authorized by this revision.

## Remaining implementation and acceptance

1. Recheck the pinned public delivery before importing. Repository/commit and inspected file pins are recorded above; record every subsequently imported SDK, ABI and immutable configuration path and content SHA-256. Verify the provided body pin against an actual available submitted body; do not equate the job JSON or objective text hash with that pin.
2. The unmodified A1 build/SDK/local harness replay above passed. Extend this to actual W1 adapter integration, using only temporary local-chain identities. Do not modify core, purchase a live job or add a signer/backend/indexer authority. Record exact commands, outcomes and any browser-incompatible Node-only modules.
3. Map the real SDK query, canonical checkpoint witnesses, proposal previews, unsigned transactions, fee/allowance checks, result/manifest binding and authenticated status APIs into the UI boundary. No method names/selectors can be derived from the UI interface. Keep a capability false until its mapping is real and tested.
4. Validate chain ID, Factory/Branch identity, immutable profiles/capability provenance and approved public RPC configuration. Replace candidate fixture constraints with actual SDK validation, including complete serialized request-body overhead, per-type reservations, input-type/inline-image budgets and mode/publication restrictions. W1's current draft checks are fixture/UI checks, not proof of A1 encoder compatibility.
5. Wire the verified live read route to the shared project/workspace views without a connect wall. Those views are currently instantiated only by demo mode; remove demo-specific route/chain assumptions when binding live views. Keep public unavailable states distinct from empty lists. Connect signing to the user's explicitly selected provider only.
6. Before each signature revalidate the selected account/network, configuration, anchor, current nonzero proposal, witnesses, quoted price, exact allowance and Branch spender. Approval must resolve after confirmed allowance, not merely a returned hash. MaxFee is a purchase ceiling, not permission for automatic sponsorship.
7. Journal the original approval/purchase hash, nonce, chain and selected identity as soon as submission is known, before waiting for confirmation. Reconcile after reload from the real SDK/chain, including dropped/replaced/unknown transactions and absent/corrupt local storage. Never automatically prepare a replacement purchase. The demo journal is not a production transaction broadcaster.
8. Implement authenticated refusal/status-1 identical-body retry with a fresh explicit fee/approval preview and new attempt receipt. Freeze status 2 and unknown failure; leave absent callbacks pending indefinitely. Obtain the corrected raw manifest and bounded witness from real A1 APIs for a binding preview/resubmission without repurchase. No HTTP response may unlock a branch or invent a refund.
9. Fetch actual files using SDK-approved public locations with streaming size limits, no private/local-network URL access, and descriptors/provenance from accepted checkpoints. Verify file SHA-256/length/MIME independently of raw-manifest keccak. Keep Git/publication observations and times separate; publishing before binding must not mark acceptance.
10. Run the entire acceptance matrix against actual A1 contracts/SDK locally, with temporary accounts and deterministic real files. Retain the already separate fixture evidence. Then complete the remaining explicitly authorized live acceptance in a later stage; this handoff authorizes no mainnet operation.

## Mandatory local-chain acceptance before enabling live operations

| Area | Required actual evidence | Current result |
| --- | --- | --- |
| Six functions | Root/propose/choose sponsor/read/continue/historical fork using real SDK-prepared transactions and witnesses | NOT_RUN |
| Multi-asset retention | Execute HTML R1 → image R2 → HTML R3; R3 parent is own latest job R2; selected saved R1 HTML and exact R2 image bytes persist | NOT_RUN |
| Historical fork | Chosen historical assets/provenance only; child has own open and separately funded execution | NOT_RUN |
| Payment/state | Exact Branch allowance, current price/maxFee, stale-anchor rejection, double submit, account/network changes | NOT_RUN |
| Recovery/failure | Original hash/nonce after reload, pending/missing callbacks, authenticated status 1, status 2/unknown freeze, corrected binding without repurchase | NOT_RUN |
| Files/publication | Actual authenticated descriptors, unavailable/tampered files, SHA-256 versus manifest keccak, Git/site observation ordering | NOT_RUN |
| Wallet integration | Selected real provider signing unsigned local-chain transactions; rejection and asynchronous receipt handling | NOT_RUN |

The existing fixture browser suite demonstrates UI behavior only. It does not authenticate callbacks, validate A1's Solidity parser, verify deployed contracts or prove IMD job admission/execution.
