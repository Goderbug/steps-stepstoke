# STEPS launch packaging v1 (contracts-only Ethereum launch)

Local checks of the final source for the `evm_contracts` launch `RelayEncoder()`, `RelayVerifier()`, `RelayFactory($contract:RelayEncoder,$contract:RelayVerifier)`. This is local evidence only: `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. No key, broadcast, public RPC, paid job, website step or `launch.json` is part of it. The manifest is written by the later manifest stage; the proposal in [CONTRACTS.md](../../CONTRACTS.md) is unchanged.

Imported commit: `c511aabb128d77336ff9dfe437b2c8a7e472e274` (local repair v1 head, repaired by the project owner after IMD candidate `b7747bf3`). Final source commit: `33426e67117b99f41ed93a8e6c051fd10f50d2a4` (this evidence is committed on top of it with identical sources). Changes from the imported commit are listed in [ADAPTATION.md](../../../ADAPTATION.md), section "Launch packaging v1".

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
