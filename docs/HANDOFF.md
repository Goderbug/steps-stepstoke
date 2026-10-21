# Official deployment handoff — later stage only

This candidate has no production deployment or official handoff. `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. No `launch.json` or `dist/imd-deployment.json` is manufactured. No paid job or public transaction was performed.

After a separately authorized launch, provide the **actual** `.imd/reads/deployment.json` and optional `.imd/reads/network.json`, the deployed source commit already present in the local object set, the frozen compiler artifacts and an operator-reviewed receipt-evidence file. Do not edit a local fixture into a production handoff. Run from the repository root, after the final frontend build:

```sh
node tools/check-release.mjs
node tools/import-deployment.mjs RECEIPT_EVIDENCE HTTPS_READ_RPC
node tools/observe-ethereum.mjs dist
```

The importer copies `version:1`, `launchId`, chain 1, `sourceCommit`, `attestationHash` and the complete three-name set: RelayEncoder, RelayVerifier, RelayFactory. Each address is copied from the actual handoff. Each ABI is the pinned raw JSON array at `abi/<name>.json`; `abiHash` is Keccak-256 of compact JSON with object keys sorted recursively and array order retained. Hashes use 64 lowercase hexadecimal characters without `0x`. ABI arrays are not wrapped in artifact objects.

The exported file has exactly `version`, `launchId`, `chainId`, `sourceCommit`, `attestationHash`, `contracts`, `assets`, plus `network` and `walletAddChain` only when supplied by network.json. Network values are copied unchanged; no address, RPC, deployment block, gate record or auxiliary URL is appended to its top level. There is no token, pool or poolKey in this contracts-only application. Paths are relative, regular files without traversal or symlinks. Every final exported file except `imd-deployment.json` itself is inventoried by final-byte SHA-256, including index.html, ABI arrays and `deployment-evidence.json`. Limits are 128 files, 8 MiB per file and a conservative 32 MiB runtime inventory read budget. Regenerate after any byte changes.

The auxiliary `deployment-evidence.json` contains `sourceCommit`, `attestationHash`, `transactionHash`, `blockNumber`, `blockHash`, `build` (exact `config/release.json.frozenBuild`) and optionally `productionGate`. It supplies **no addresses** and cannot override the handoff. The production gate's deployment record independently names the same Factory/Encoder/Verifier, transaction, block, source and attestation; all must agree. Deployment validity and per-profile compatibility remain separate.

Verification requires chain 1; a successful canonical receipt and matching block number/hash/transaction membership; historical empty code at all named addresses immediately before deployment; one successful CREATE/CREATE2 trace for each application in that transaction; exact frozen creation-code prefix and Factory constructor arguments; source bytes at the supplied Git commit matching every compiler input; exact compiler/settings/source metadata; and exact deployed/runtime code with the actual encoder/verifier/factory immutable address words, not merely masked slot hashes. Bytecode/policy IDs alone are insufficient. Unsupported archival or callTracer RPC methods fail closed and remain an availability limitation. No receipt or attestation is invented to compensate.

Every opened Branch is checked for registration, immutable Factory/Encoder/Verifier getters and the frozen direct RelayBranch runtime with all actual immutable words. This includes runtime-created roots and historical children. A matching masked runtime with a different dependency is rejected.

The static UI reads **this same** inventoried `imd-deployment.json`, verifies its assets/ABIs and receipt/code evidence, and derives only compiled Intake/IMD dependencies from the verified Factory. It never takes addresses from the evidence file or a second public config. Missing future handoff displays unavailable; local and fixture modes remain visibly separate. The workflow-provided handoff is an externally authenticated input: this candidate does not invent a signature scheme or claim that matching hash strings establish the issuer's identity.
