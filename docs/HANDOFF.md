# Official deployment handoff — later stage only

This candidate has no production deployment or official handoff. `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. No `launch.json` or `dist/imd-deployment.json` is manufactured. No paid job or public transaction was performed.

## Candidate pin and profile transitions

The imported ancestry is `https://github.com/identity-md-launches/launch-2294-build-cto-relay-station` at source commit `9b0294e7ab19060bd00c489fbe032cf248528e0d`, imported as `d29eedf8e7d6608ed109972c179b367ac07ce91f` in `config/release.json.sourceBaseline`; the current tree is a later candidate with reviewed changes. A later requester must pin the **final submitted repository URL and full commit ID** after this documentation commit is accepted. Record `git rev-parse HEAD` and a clean `git status --porcelain` from that immutable checkout, verify the [source/export hash inventory](validation/documentation-v1/README.md), and give that exact commit to independent review and the later `workflow.open` `evm_contracts` launch. Do not treat the imported baseline, a branch name, an unpinned head, or a local fixture as the final source identity. Any runtime byte change requires affected tests, a new frozen build, export/evidence manifests and another review before handoff.

| Profile | Evidence needed | Effect |
| --- | --- | --- |
| Undeployed candidate (now) | Frozen source, static export, local checks; no chain-1 deployment. | No public project reads or paid controls. `liveCompatibility:NOT_RUN`. |
| Verified public pilot (later) | Actual three-contract handoff plus canonical receipt/trace/runtime/ABI/source verification and a separately authorized two-job pilot with different sponsors, the same Branch payer, authenticated callbacks and binding. | Bounded pilot evidence only; it does not mark five profiles or the whole release live validated. Stop on any core failure. |
| Live-validated (later) | Independent security/runtime-child/service acceptance and seven total authenticated jobs across five profiles, including the two pilot jobs and historical child lifecycle, plus gas and closed production gates. | An explicit review may consider readiness; it never places the next order automatically. |

For the later launch, the three named entries and backward constructor references are in [CONTRACTS.md](CONTRACTS.md). The official platform manifest stage alone writes `launch.json` after accepting the pinned build. That manifest is a separate handoff artifact, not a file to create in this candidate. Launch payment, chain-1 deployment, IMD job spending and platform hosting each require their own authorization. The `workflow.open` source pin must match the final candidate commit and the importer must later verify the source bytes it claims. Platform publication after launch is distinct from per-round site publication, which remains disabled.

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
