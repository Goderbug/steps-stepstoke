# Verified Ethereum deployment handoff

The actual live project handoff is imported after the final website build. Launch cad0c789-2611-4392-bec0-456cb8e57d2c, source 751f3901d4453e1477828e4f7ef0d6af8bc03485, receipt 0x6377bb6862896730e68c455685bd057d87ddeafca57633370df20c196479bad6 in block 26248821 are independently cross-checked. The existing launch manifest is unchanged. `liveCompatibility:NOT_RUN`, `productionReady:false`; no paid product job or worker transaction was performed. Current evidence: [live-connection-v1](validation/live-connection-v1/README.md).

## Source identity and readiness transitions

Contract-source commit **751f3901d4453e1477828e4f7ef0d6af8bc03485** is the official accepted deployment source. The later website-source commit is assigned by IMD when it commits this integration; it is not substituted for the contract-source commit. Earlier `sourceBaseline` entries describe ancestry only. The 50 Solidity inputs, ABI arrays, compiler settings and manifest remain unchanged. The final website asset inventory is separate from historical candidate inventories.

| State | Evidence | Effect |
| --- | --- | --- |
| Verified public reads (current) | Actual three-contract handoff, canonical successful receipt/block, live trace, source/ABI/creation/runtime/immutable verification, anonymous browser RPC checks. | Public reads enabled after verification in each session. All signing and paid controls disabled. |
| Live profile validation (NOT_RUN) | Separately authorized actual authenticated product executions, binding and output checks for this deployment. | Deployment verification cannot supply this evidence; no product execution is authorized here. |
| Production ready (false) | All five profile records PASS with matching evidence and every production gate closed for this deployment. | Only a separate evidence review can consider enabling transactions. No automatic purchase, retry or order. |

The accepted `launch.json` is retained unchanged. No contract deployment, replacement, token, pool, hook, proxy or owner is added by this integration. IMD's later GitHub/site handoff is the source for the exact website commit, URL and CID. Per-round site publication remains disabled.

Reproduction requires the **actual** `.imd/reads/deployment.json` and optional `.imd/reads/network.json`, the deployed source commit already present in the local object set, the frozen compiler artifacts and an operator-reviewed receipt-evidence file. Do not edit a local fixture into a production handoff. Run from the repository root, after the final frontend build:

```sh
node tools/import-deployment.mjs RECEIPT_EVIDENCE HTTPS_READ_RPC [PUBLIC_READ_TRANSPORT_JSON]
node tools/check-release.mjs
node tools/observe-ethereum.mjs dist
```

The importer copies `version:1`, `launchId`, chain 1, `sourceCommit`, `attestationHash` and the complete three-name set: RelayEncoder, RelayVerifier, RelayFactory. Each address is copied from the actual handoff. Each ABI is the pinned raw JSON array at `abi/<name>.json`; `abiHash` is Keccak-256 of compact JSON with object keys sorted recursively and array order retained. Hashes use 64 lowercase hexadecimal characters without `0x`. ABI arrays are not wrapped in artifact objects.

The exported file has exactly `version`, `launchId`, `chainId`, `sourceCommit`, `attestationHash`, `contracts`, `assets`, plus `network` and `walletAddChain` only when supplied by network.json. Network values are copied unchanged; no address, RPC, deployment block, gate record or auxiliary URL is appended to its top level. There is no token, pool or poolKey in this contracts-only application. Paths are relative, regular files without traversal or symlinks. Every final exported file except `imd-deployment.json` itself is inventoried by final-byte SHA-256, including index.html, ABI arrays and `deployment-evidence.json`. Limits are 128 files, 8 MiB per file and a conservative 32 MiB runtime inventory read budget. Regenerate after any byte changes.

The auxiliary `deployment-evidence.json` contains `sourceCommit`, `attestationHash`, `transactionHash`, `blockNumber`, `blockHash`, `build` (exact `config/release.json.frozenBuild`) and optionally `productionGate`. It supplies **no addresses** and cannot override the handoff. The production gate's deployment record independently names the same Factory/Encoder/Verifier, transaction, block, source and attestation; all must agree. Deployment validity and per-profile compatibility remain separate.

### Public read transport

The importer also writes and hashes `public-read-transport.json` as a separate static asset. Its exact shape is `{ "version": 1, "chainId": 1, "rpcUrls": ["https://ethereum-rpc.publicnode.com/", "https://eth.drpc.org/"] }`. It contains no application addresses, credentials or authority. The official `network` and `walletAddChain` values are copied unchanged. Optional `PUBLIC_READ_TRANSPORT_JSON` selects an operator-reviewed policy before export, never from a URL parameter, browser storage or an end-user form. The same final inventory authenticates this asset; an altered digest or unsafe URL rejects the handoff.

The Node importer, read-only observer and public browser adapter share `sdk/public-rpc.mjs`. At most three credential-free HTTPS endpoints are attempted once per read, with a 12-second request timeout and an 8 MiB response limit. Query tokens, embedded credentials and private IP literals are refused. The default policy uses the supplied primary read RPC followed by PublicNode and dRPC, without duplicates. Legacy inventoried exports without the new policy use the same bounded defaults. A successful endpoint is preferred for that method on later reads; chain 1 is checked before each endpoint is first used and after an availability failure.

Only read methods are accepted. A missing method, archive restriction, rate limit or network failure can select another listed RPC. A wrong chain, malformed response, reverted call, null receipt, empty code, mismatched trace or failed verification cannot select another endpoint in search of a passing answer. All unavailable endpoints produce an explicit unavailable error, never an empty project list or permission to spend. Wallet transactions remain on the separately selected wallet provider.

This is a transport availability fix, not a new proof system. Each returned receipt, block, historical runtime, CREATE trace, creation code and constructor argument still passes the checks below, with a second receipt/block canonicality check after all deployment reads. Downloaded or cached trace JSON is not accepted as an alternative to a live RPC trace. The same provider trust assumptions apply as before; failover does not create an RPC quorum or cryptographic execution proof.

Anonymous tracing is a current capability observation, **not a service guarantee**: [dRPC's method documentation](https://drpc.org/docs/ethereum-api/debugandtrace/debug_traceTransaction) labels debug tracing as paid-tier, despite also publishing an anonymous endpoint example. If access changes, the UI must fail closed. Before hosting, run the importer and observer against the **actual deployment transaction**, then verify that the final browser origin can read the same frozen deployment through its inventoried policy. A synthetic local success or earlier unrelated public transaction cannot satisfy this launch gate.

Verification requires chain 1; a successful canonical receipt and matching block number/hash/transaction membership; historical empty code at all named addresses immediately before deployment; one successful CREATE/CREATE2 trace for each application in that transaction; exact frozen creation-code prefix and Factory constructor arguments; source bytes at the supplied Git commit matching every compiler input; exact compiler/settings/source metadata; and exact deployed/runtime code with the actual encoder/verifier/factory immutable address words, not merely masked slot hashes. Bytecode/policy IDs alone are insufficient. If no configured anonymous endpoint supplies archival or callTracer reads, verification fails closed. No receipt or attestation is invented to compensate.

Every opened Branch is checked for registration, immutable Factory/Encoder/Verifier getters and the frozen direct RelayBranch runtime with all actual immutable words. This includes runtime-created roots and historical children. A matching masked runtime with a different dependency is rejected.

The static UI reads **this same** inventoried `imd-deployment.json`, verifies its assets/ABIs and receipt/code evidence, and derives only compiled Intake/IMD dependencies from the verified Factory. It never takes addresses from the evidence file or a second public config. A missing or invalid handoff displays unavailable; local and fixture modes remain visibly separate. The workflow-provided handoff is an externally authenticated input: this candidate does not invent a signature scheme or claim that matching hash strings establish the issuer's identity.
