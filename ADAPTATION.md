# STEPS (Stepstoke) — RELEASE-CANDIDATE-V1 adaptation

Development only. Imported commit: `d29eedf8e7d6608ed109972c179b367ac07ce91f`. No future project head was imported. `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. No public-chain signing, broadcasts, deployment, spending, hosting, paid IMD requests or new orders occurred. Official X: https://x.com/stepstoke (not contacted for posting).

## Launch construction and policy

The contracts-only launch names exactly **RelayEncoder**, **RelayVerifier**, **RelayFactory**, in that order. The proposed constructor manifest is documentation only in [CONTRACTS.md](docs/CONTRACTS.md). There is no `launch.json` and no launch token.

- `src/RelayFactory.sol`: removed `Clones`, the implementation address and constructor deployment of dependencies. The nonpayable `(RelayEncoder, RelayVerifier)` constructor only checks nonzero/distinct static addresses and stores two immutables. Empty-code addresses are accepted during the empty-chain constructor rehearsal. No external call, code check, nested deployment, `tx.origin`, initialization or authority is introduced.
- `src/RelayBranch.sol`: removed the clone lock, `initialize` function and initialized flag. Product create/fork now uses `new RelayBranch(...)`. Its constructor stores complete validated state and emits the initial checkpoint without external calls. Its `factory` is the product RelayFactory that executed CREATE. Registration and creation are atomic; a revert cannot leave a registered partial child. The original `Initialized` event is retained as historical ABI terminology; it does not expose an initializer.
- Factory runtime checks dependency code existence and the encoder/verifier policy IDs, validates goal/direction and authenticated checkpoint/witness inputs **before CREATE**. `src/RelayVerifier.sol` exposes its existing policy ID. No linked external libraries remain in product bytecode. Protected, unused vendored dependency files were left unchanged.
- `test/LaunchCompatibility.t.sol` rehearses the empty constructors, bad dependencies/inputs before CREATE, independent complete children, backward-reference CREATE2 batch and the supplied executable-opcode floor. Old initializer selectors revert from stranger and factory. Both deployed children and all three launch applications are scanned. The supplied launch reference does not prohibit runtime child CREATE; its static-argument/empty-chain constraints apply to the three named launch constructors. Child construction is neither hidden nor a fourth launch application. Service acceptance remains a release gate because a local policy floor is not final service approval.

## Reproduced official protocol incompatibilities

Official documentation, catalog and free `/requests/check` responses were read on 2026-10-21. Exact failed and corrected requests/responses are retained in the current evidence archive. The original bodies were refused before any paid execution:

| Reproduction | Narrow correction | Tests |
| --- | --- | --- |
| Named outputs outside `artifacts/` are refused | `Assets`, encoder, SDK and adapter require that namespace for new writes; fixed HTML output is `artifacts/index.html`, with identical `dist/index.html` retained by the HTML job instruction | IntakeCompatibility; mapping/profile boundary; SDK; seven-round EVM and browser flows |
| `steps` without `shape` is invalid | Encoder emits `"shape":"chain"` | Exact body tests and free checks |
| `build-document` and `imagegen` are absent from the current runnable catalog | Fixed Markdown profiles use `research-report`; image creation uses `create-image`; HTML retains `build-website` | Exact profile body tests/catalog evidence/free checks |
| Old HTML instruction triggers the API's brief screen | Equivalent wording explicitly preserves self-contained UTF-8 HTML, exact image bytes/data URIs, output limits, markers and disabled publishing | Exact encoder bodies and free checks |
| Official input/output names must start with an ASCII letter | Reject new output names and selected input names that cannot satisfy that rule before payment; history remains readable | IntakeCompatibility and SDK/UI validation |
| Legacy HTML path plus new HTML path could admit a second HTML slot | Reject another HTML target even across legacy/new namespace | Explicit legacy HTML regression and SDK parity |

Authenticated historical descriptors are never rewritten. Updating an old non-artifacts mapping requires an **explicit new proposal** with the same key/name and canonical path (`artifacts/<name>.md`, or fixed HTML path). Already-supported mappings cannot be renamed. A historical name unsupported by the current API can be inspected but cannot be sent as a selected input or updated under a renamed identity. No automatic migration, import of another factory's branches or fabricated checkpoint is added.

The policy ID was versioned to `STEPS/RELEASE-CANDIDATE-V1/fixed-profiles/artifacts/unpublished` and synchronized across contracts, ABI, SDK and release configuration. The prior parser, payment and lineage security repairs were preserved and their regressions rerun. Parser bounds were not silently raised to accept every public delivery.

## Public integration and interface

- `sdk/config.mjs` now verifies either explicit Ethereum chain 1 or disposable local chain 31337, with exact candidate runtimes, compiler-reported immutable slots, dependency getters, policy and ABI hashes. No implicit chain switch or clone detection remains. Factory Intake/IMD getters replace implementation-derived configuration.
- `sdk/public.mjs`, CLI and `tools/observe-ethereum.mjs` add bounded public log reads, callback-URI original-byte retrieval, immutable artifact lookup and free Intake transaction observations. Only original bytes with the recorded keccak may bind. Mutable `/jobs/:id/result` responses and HTTP/Git/file observations cannot settle or unlock state.
- The real `ChainAdapter` and `createLiveAdapter` support verified chain-1 deployment configuration, public files/results and original-hash/nonce recovery. Production mutations require all gates tied to the same deployment. The candidate supplies no public addresses. `#/ethereum` reports that absence honestly. Unknown/replaced transactions are reconciled; no automatic repurchase is added.
- Open Workshop's layout, controls and six operations remain. Current platform chrome, metadata and existing OG artwork text use STEPS/Stepstoke and the official X. No new logo or slogan was designed. Authenticated/demo historical content and technical identifiers remain. Fixed a reproduced TypeScript error where Workspace referenced the latest-attempt helper without importing it.
- Proposal, exact allowance approval and purchase remain separate. Continue prepares a proposal. Historical fork uses the selected accepted checkpoint, while continuation uses the Branch's own latest job. Original producer provenance remains visible.

## Review, tests and evidence

[Current evidence](docs/validation/rc-v1/README.md) identifies the final source, required fuzz seed, full Foundry/invariant results, SDK checks, constructor batch, executable disassembly, exact raw results, local/browser transactions, sizes and complete calldata/intrinsic/net-execution gas. Earlier failed runs are retained with their repairs. A measurement defect was also reproduced: old local harnesses declared 29–30M transaction gas limits while comparing only receipt usage to EIP-7825. The harnesses now declare at most 16,777,216, record declared and used gas separately, and test that a low-usage transaction with an excessive declared limit is still invalid. The 13.85M historical synthetic case is superseded only by measured final-code shapes, not by a universal bound claim.

Four public completion snapshots match on-chain result hashes byte-for-byte and contain zero named files. They are rejected by the binder without retry rights. A public one-file envelope is replayed exactly in local tests; that replay is not a live callback to STEPS. Actual multi-file HTTP results (2, 4 and 17 files) are explicitly unsupported. No authenticated oversized real envelope was obtained. These are open compatibility gates, not accepted deliveries.

All dependency/build configuration and protected paths are preserved. Historical text, failures and fixtures have byte-recoverable archives; removed historical binary evidence has independently verified predecessor commit/path/blob/SHA-256 references. See [history](docs/history/README.md). Current failures and test sources remain delivered. Final delivery size excludes build caches and is measured in the evidence index.

## Unresolved launch gates

This candidate must **not launch** while a material security, policy, size/gas or protocol gate is open. [REVIEW.md](docs/REVIEW.md), [LIMITS.md](docs/LIMITS.md) and `config/production-gate.json` record the remaining work: independent final security review, service runtime-child acceptance, actual one-output runtime behavior across all profiles, real oversized/multi-file envelope policy, service gas/calldata ceilings, authorized live execution and confirmed deployment. A local fixture, free check, static export or receipt cannot close those gates. No owner/admin recovery, timeout purchase, new asset type, token, pool, hook, treasury or publication authority was introduced.
