# Independent contract tests for CTO Relay Station A1

These tests supplement the accepted contributor's existing suite. All additions are under `test/`; production contracts, SDK, dependencies and configuration are unchanged.

Run from the repository root:

```sh
forge build
FOUNDRY_FUZZ_SEED=0x146644c630d7548a74d043e2779607ab2def960ac3890b548af84b4eb4db9118 forge test
```

The new Solidity tests require no downloads, environment variables, filesystem cheatcodes, FFI, fork URL, credentials or paid services. The seed above controls the runner, not contract inputs. Fuzz and invariant counts are embedded in the test source.

| Suite | Added coverage |
| --- | --- |
| `ContinuationSpec.t.sol` | Five completed root rounds across Markdown, HTML and PNG; alternating sponsors; HTML → image → HTML execution with older selected HTML; retained unrelated assets; exact emitted witness reconstruction; authenticated historical fork after parent advancement; **two actually purchased and bound child rounds**; competing proposals in both selection orders; stale losing purchases; mutation of all 12 asset fields; foreign Factory and nonexistent checkpoints; checkpoint domain preimage |
| `PaymentSpec.t.sol` | Runtime price movement, maxFee boundary, whole-balance payment, donations, exact approval at Intake entry, insufficient funds/allowance, atomic rollback on Intake/approval faults, zero/reused request IDs, concurrent sponsor/retry ordering, same-body continuation retries, late prior-attempt callbacks, spoof/cross-branch/foreign-request/replay callbacks, missing and late callbacks, 1,024/1,025-byte callback URI boundary under the 200,000-gas stipend, unknown failure freeze, reentrancy during transfer/approval/Intake calls |
| `ManifestSpec.t.sol` | Exact raw hash versus whitespace/key reordering; ignored source/Git/publication metadata; malformed recorded result preserves history; complete/job/project/output checks; historical job replay; decoded duplicate keys; malformed UTF-8, surrogates and noncharacters; valid Unicode scalar fuzzing; hash type/width/hex/zero checks; decoded fields and identifier limits; empty accepted files; exact depth/member/key/token/string/document boundaries; strict integer grammar and declared file size caps |
| `ProfileBoundarySpec.t.sol` | Real accepted eight-asset witness with a **16,384-byte purchasable body** and a 16,385-byte proposal rejected before transfers; UTF-8 byte limits; path restrictions; disabled publishing; Base64 ceiling arithmetic and HTML budget fuzzing; reserved type slots; input count limits; updates at full capacity |
| `StateMachineSpec.t.sol` | Independent ghost model over two sponsors and up to four branches; randomized proposals, purchases, retries, result/failure callbacks, binding, donations, time advancement, hostile callbacks and historical forks; 256 runs × 96 calls; exact token conservation, immutable attempt receipts, retained assets, expected phases and permanent checkpoint hashes |

`SpecSupport.sol` has separate protocol/token mocks and fixture builders. Expected file hashes are SHA-256 over actual inline Markdown, self-contained HTML and a valid PNG. Manifest commitments are keccak256 over the original JSON bytes. Checkpoint events are compared with an independently assembled expected table, rather than treating emitted data as the correctness oracle.

The invariant model chooses valid operations from its own tracked state. It does not read the contract's current phase to decide what behavior is correct. Expected rejected operations are checked explicitly; unexpected handler reverts fail the run. Setup populates all three asset kinds and creates a historical child. A deterministic handler test also requires a refusal, funded retry, two completed child rounds and another historical fork, preventing an entirely idle success case.

The optional fixture check uses only Python's standard library:

```sh
python3 test/adversarial/check-inline-fixtures.py
```

It verifies every PNG chunk CRC, the decompressed RGBA scanline and exact Base64 equivalence. Foundry does not invoke Python or read fixture files.

Final local result: **91 tests passed, 0 failed, 0 skipped**, including 37 added tests. The additions include five fuzz properties at 1,000 runs each and the model invariant at 24,576 random calls with zero handler reverts. `forge build` also passed, with compiler/linter warnings preserved.

Raw output is in [`forge-build.txt`](evidence/forge-build.txt), [`forge-test.txt`](evidence/forge-test.txt) and [`fixture-check.txt`](evidence/fixture-check.txt). These logs describe local reproduction, not independent deployment or consumption proof.

The tests enforce the release's disclosed restrictions: 16 assets, 8 inputs, one accepted output, 8,192-byte raw manifest, 16,384-byte request, 64 KiB Markdown, 2 MiB HTML, 256 KiB generated PNG, 512 KiB aggregate selected images, disabled image editing/reference modes and disabled publication. Pure verifier/encoder boundary cases test **declared descriptors**; the EVM cannot prove MIME content, image validity, output quality, actual input consumption or HTML execution safety.

Review scope is the contracts and their offline protocol integration. Real Intake/catalog compatibility, real IMD consumption, public deployment, SDK network behavior and publication remain **NOT_RUN**. No live readiness claim follows from these tests. No confirmed implementation defect was identified in this pass; a future failing specification assertion must be investigated and reported, not inverted to bless the failure.
