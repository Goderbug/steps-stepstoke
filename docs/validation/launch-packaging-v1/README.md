# STEPS launch packaging v1 (contracts-only Ethereum launch)

Local checks of the final source for the `evm_contracts` launch `RelayEncoder()`, `RelayVerifier()`, `RelayFactory($contract:RelayEncoder,$contract:RelayVerifier)`. This is local evidence only: `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. No key, broadcast, public RPC, paid job, website step or `launch.json` is part of it. The manifest is written by the later manifest stage; the proposal in [CONTRACTS.md](../../CONTRACTS.md) is unchanged.

Imported commit: `c511aabb128d77336ff9dfe437b2c8a7e472e274` (local repair v1 head, repaired by the project owner after IMD candidate `b7747bf3`). Final source commit: `33426e67117b99f41ed93a8e6c051fd10f50d2a4` (this evidence is committed on top of it with identical sources). Changes from the imported commit are listed in [ADAPTATION.md](../../../ADAPTATION.md), section "Launch packaging v1".

## Revision 1: review finding 16331cb9 (retained-token cap)

The independent review reproduced that `ManifestJSON.MAX_RETAINED_TOKENS = 256` was the first limit an ordinary completed result reached: a standard file entry retains 13 tokens and the root 9, so a result listing 20 produced files (about 4.7 KB, every entry well formed) reverted `Policy.Limit` and stranded the paid Branch in ResultRecorded. The supplied proof failed on the accepted tree and passes on this revision. The exact final source commit of this revision is the service's commit of this tree; the frozen compiler inputs it must match are in `config/release.json` (`frozenBuild`).

Change in `src/libraries/ManifestJSON.sol`: `MAX_RETAINED_TOKENS = 2 * MAX_VALUES` (1,024). A retained token is a retained value or the key that introduces one, so the count never exceeds twice the value budget; the value, key-byte and combined-work budgets are now always reached first. Mirrored in `sdk/strict-json.mjs`, `config/release.json` and `docs/LIMITS.md` (standard six-key entries bind up to 50 files, the 51st is refused by the unchanged work budget). Tests: `test/ManifestRetainedTokens.t.sol` (5) and one SDK parity test. No other limit, budget, interface, policy ID or transaction gas limit changed; the four advisory findings are answered in `.imd-responses.json` and disclosed in LIMITS.md without contract changes.

The token array is allocated at its maximum before parsing, so every bind pays about 260,000 gas more. Re-measured on this revision's source (same tools, own Prague Anvil, declared limit 16,777,216, full 16-asset witness, calldata 46,116 bytes), evidence in [revision-1/](revision-1/):

| Check | Result |
| --- | --- |
| Forced clean build, `tools/sync-release.mjs` re-freeze, `tools/check-release.mjs` | PASS; Verifier runtime 14,138 bytes (was 14,124), Encoder/Factory/Branch unchanged |
| `FOUNDRY_FUZZ_SEED=0x8e6f…` `forge test` | **174/174 PASS** (169 + 5 new) |
| `node --test test-sdk/*.test.mjs` | **86/86 PASS** |
| `node tools/generate-sdk-abi.mjs --check` | PASS, ABI SHA-256 unchanged |
| `node tools/inspect-bytecode.mjs` | PASS, no forbidden opcode, no link references; [revision-1/bytecode-inspection.json](revision-1/bytecode-inspection.json) |
| `node tools/measure-retained-binding.mjs` | **6/6 PASS**; [revision-1/retained-binding.json](revision-1/retained-binding.json) |
| `node tools/measure-binding.mjs` | **8/8 PASS**; [revision-1/metadata-binding.json](revision-1/metadata-binding.json) |
| `node tools/deployment-rehearsal.mjs` | on-chain steps PASS (constructors, three-name CREATE2 batch, runtime Branch CREATE, adapter observation, immutable checks); the importer's `git rev-parse HEAD` source authentication cannot pass on an uncommitted tree and must be re-run on the service's final commit (no rehearsal JSON is recorded for this revision for that reason; the accepted packaging's [deployment-rehearsal.json](deployment-rehearsal.json) covers identical constructors, Encoder, Factory and Branch bytecode) |

| Shape | Accepted packaging (previous) | Revision 1 |
| --- | ---: | ---: |
| C-GAS-01 exact 32,768-byte input, SHA-256 `8768318db71105397ac89eef44af007752b94e966eb8adebd237a2b97c9de805` | 13,427,365 | **13,687,379** |
| three-byte scalars | 13,090,945 | 13,350,959 |
| four-byte scalars | 12,407,365 | 12,667,379 |
| `é` escapes | 13,027,602 | 13,278,016 |
| surrogate-pair escapes | 13,435,102 | 13,685,516 |
| consecutive simple escapes | 11,750,610 | 12,002,944 |
| metadata: 110-key combined complexity | 12,024,736 | 12,267,890 |
| metadata: 498-value escaped-unicode | 9,941,264 | 10,180,458 |
| metadata: maximum escaped key bytes | 12,476,495 | 12,722,109 |
| metadata: maximum ignored number | 10,542,971 | 10,788,585 |
| metadata: maximum whitespace | 11,315,303 | 11,560,917 |
| metadata: maximum ASCII strings | 12,425,492 | 12,671,106 |
| metadata: maximum escaped strings | 11,282,108 | 11,527,722 |
| metadata: maximum wide objects | 12,861,815 | 13,107,429 |

Foundry complete-transaction estimates (`test/ManifestSegmentBudget.t.sol`, `Metric` events): C-GAS-01 shape 13,698,181 (was 13,438,155); budget-maximal flush/scalar mix **14,779,323** (was 14,520,257), the largest measured shape, 1,997,893 below the cap; ASCII-prefix shapes 11,976,661 / 11,987,401 / 11,985,751; five alternating-escape files 11,473,442. The audit's full alternating shape is still refused by the budget. These finite cases still support but do not prove a universal maximum; the gas gate stays OPEN for the service's own simulation.

## Reproduced audit finding 28bdccb2 and its repair

The audit's 32,768-byte `"a\n"`-alternating result (about 10,700 segment flushes, every declared budget respected) was reproduced in Foundry before the change: complete `Branch.bind` estimate 16,802,041 gas (audit's local Anvil transaction: 16,751,470), above the 16,777,216 transaction ceiling. Measurement also found a worse, escape-free shape the audit did not name: retained strings of 999 plain ASCII bytes followed by one raw two-byte scalar reached an estimated 17,284,676 gas, because the ASCII pre-scan walked the prefix and the general loop walked it again.

Repair in `src/libraries/ManifestJSON.sol`, within `_stringInto` only:

1. The general loop starts at the pre-scan's stopping point with the scanned prefix as its first raw segment, so no byte is walked twice. Decoding, limits and rejections are unchanged (see the new semantic regressions).
2. Each simple escape dispatched by the general loop, that is the first of a run of consecutive simple escapes, is charged `SEGMENT_FLUSH_WORK = 8` units of the existing `MAX_WORK = 65_536` budget. Consecutive simple escapes stay in the fast inner loop and are charged only as raw bytes; Unicode escapes, raw UTF-8 and ignored metadata strings are not charged. Eight units price a dispatch (about 780 gas) at about half the per-unit rate of the accepted C-GAS-01 shape (about 210 gas per raw two-byte-scalar byte), so that accepted shape remains the practical worst case.

`sdk/strict-json.mjs` mirrors the charge (`MANIFEST_LIMITS.segmentFlushWork`) and checks the budget at the end of every retained string, so the SDK refuses exactly what the verifier refuses.

No budget value, parser limit, raw-byte binding, result projection, ABI, policy ID, authority or transaction gas limit changed. Verifier runtime grew from 13,999 to 14,124 bytes; Encoder, Factory and Branch runtimes are unchanged (11,498 / 21,195 / 12,876 bytes).

## Final-source results

| Check | Result |
| --- | --- |
| Clean full build and frozen fingerprint check (`node tools/build-release.mjs` equivalent: `forge build --offline --force`, `tools/sync-release.mjs` re-freeze, `tools/check-release.mjs`) | PASS; Forge 1.8.3, solc 0.8.26, Cancun, optimizer 200, viaIR, `bytecode_hash = "none"`; 47 compiler inputs |
| `FOUNDRY_FUZZ_SEED=0x8e6f08b396342979a78a833b59d8fa94c3c4f688c79711dbcc983d17d9e957d3 forge test` | **169/169 PASS**, 20 suites (156 inherited + 13 new in `test/ManifestSegmentBudget.t.sol`), fuzz and invariant suites included |
| `node --test test-sdk/*.test.mjs` | **85/85 PASS** (84 inherited + 1 new parity test) |
| `node tools/generate-sdk-abi.mjs --check` | PASS, ABI SHA-256 unchanged |
| `node tools/inspect-bytecode.mjs` | PASS, no DELEGATECALL/CALLCODE/SELFDESTRUCT reachable, no link references; [bytecode-inspection.json](bytecode-inspection.json) |
| `node tools/measure-retained-binding.mjs` (own Prague Anvil, declared limit 16,777,216) | **6/6 PASS**; [retained-binding.json](retained-binding.json) |
| `node tools/measure-binding.mjs` (own Prague Anvil) | **8/8 PASS**; [metadata-binding.json](metadata-binding.json) |
| `node tools/deployment-rehearsal.mjs` (empty local chain 1, three-name CREATE2 batch, importer) | **PASS** against source commit `33426e67117b99f41ed93a8e6c051fd10f50d2a4`: empty-dependency constructors PASS, full named batch PASS at **10,266,963 gas** (declared 16,777,216), actual receipts, CREATE2 traces, frozen code and immutables verified, Verifier runtime keccak `0x9fb8b15b2d1deed8b2ee64d234a7a487c56402aae760c8bf2b0c1b56a694c1e1`; disposable addresses only, never a production handoff; [deployment-rehearsal.json](deployment-rehearsal.json) |

Complete local transactions, gas used (all below 16,777,216, calldata 46,116 bytes with the full 16-asset witness):

| Shape | Before (local repair v1) | Final source |
| --- | --- | --- |
| C-GAS-01 exact 32,768-byte input, SHA-256 `8768318db71105397ac89eef44af007752b94e966eb8adebd237a2b97c9de805` | 13,361,083 | **13,427,365** |
| three-byte scalars | 13,0xx,xxx | 13,090,945 |
| four-byte scalars | 12,4xx,xxx | 12,407,365 |
| `é` escapes | 13,0xx,xxx | 13,027,602 |
| surrogate-pair escapes | 13,4xx,xxx | 13,435,102 |
| consecutive simple escapes | 11,7xx,xxx | 11,750,610 |

Foundry estimates (fresh-memory measurer plus intrinsic calldata, EIP-7623 floor considered) for the regression shapes with the full witness, final source:

| Shape (`test/ManifestSegmentBudget.t.sol`) | Complete transaction estimate |
| --- | --- |
| C-GAS-01 two-byte scalar shape (same harness, for calibration against the 13,427,365 Anvil figure) | 13,438,155 |
| ASCII prefix (999 bytes) then one raw two-byte scalar, 15 extra files (was 17,284,676) | 11,716,635 |
| ASCII prefix then one simple escape (was 17,294,486) | 11,727,375 |
| ASCII prefix then one Unicode escape (was 17,270,846) | 11,725,725 |
| five `"a\n"` x 500 files, 5,000 flushes, within budget | 11,229,436 |
| budget-maximal mix: 3,000 flushes plus two-byte scalars to 32,768 bytes | 14,520,257 |
| audit's full alternating shape (`"a\n"` and `"a\""`, about 10,700 flushes) | refused by `RelayVerifier.verify` with `Policy.Limit`, no longer out of gas |

Exact figures are emitted as `Metric` events by `forge test --match-path test/ManifestSegmentBudget.t.sol -vvvv`.

These finite cases, together with the per-unit calibration above, support but do not prove a universal maximum; the gas ceiling gate in `config/production-gate.json` stays OPEN for the service's own simulation.

## Audit finding 7e8de817 (low)

Reproduced as documented behaviour: `bind` is the only exit from `ResultRecorded`, and `RelayFactory.fork` refuses a checkpoint whose `resultHash` is zero, so a first paid result that the verifier rejects leaves that Branch without continuation or fork. The brief forbids owner/admin recovery, timeouts, refunds and forced unlocks, and the README, PROTOCOL-OVERVIEW and REVIEW documents already disclose the limit. No contract change was made; the limit is restated in ADAPTATION.md for the launch record.
