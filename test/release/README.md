# Independent release regression tests

This addition tests the existing repaired contracts. It changes no application source,
dependency, compiler setting, launch manifest or website file. The working-tree base
was `e1f964c7c3cd325a012928b179da83e542f38843`; that is the input revision, not a claim
about the final submission commit or the original public import. Existing repair
authorship and provenance remain with their contributors.

## Exact C-GAS-01 reproduction

`ExactGasRegression.t.sol` rebuilds the sixteen original accepted revisions through
the public Branch operations, with authenticated mock Intake callbacks. It positions
a complete Factory runtime at the archived **local rehearsal** address so that the
original producer addresses are preserved too. No Branch storage or checkpoint is
injected. All tests in this addition use chain ID 1.

The original manifest and witness are pinned independently:

| Input | Digest |
| --- | --- |
| 32,768-byte original result, SHA-256 | `8768318db71105397ac89eef44af007752b94e966eb8adebd237a2b97c9de805` |
| `abi.encode(original16AssetWitness)`, Keccak-256 | `45bf29418f29ab58d2166ef45615e718d720d4653c73e8a4fa1b333f72389828` |
| `abi.encode(original16AssetWitness)`, SHA-256 | `8f6860eac45bba3eed686ad0e7f989fe0fed521760c9e9961427203420992b79` |

These match `docs/validation/launch-packaging-v1/retained-binding.json`'s
`utf8-retained` entry. The fixture generator preserves key order, raw Unicode,
ignored files and trailing spaces. It does not substitute a JSON projection.

The Foundry gas helper explicitly caps the bind call after reserving calldata
intrinsic gas. Its total includes CALL overhead conservatively and accounts for the
EIP-7623 calldata floor. Its measured region covers binding, not fixture construction
or earlier purchases. Negative tests mutate arbitrary raw bytes, replace whitespace,
remove ignored metadata, and corrupt a historical witness. Rejections must preserve
the paid receipt, recorded result, accepted checkpoint and balances; the original
binding can still complete. The accepted replacement must preserve the other fifteen
asset descriptors exactly.

`replay-exact-gas.mjs` supplies a separate complete-transaction check on a disposable
Prague Anvil node with chain ID 1 and a **16,777,216** block/transaction gas limit. It
recreates the original witness, checks that the complete bind calldata is byte-for-byte
identical to the archived calldata, and checks the mined receipt and canonical local
block. No worker key or public RPC is used. It also rehearses the named contracts in
one zero-value CREATE2 batch, checks constructor shape, no constructor-created children,
runtime sizes, reachable forbidden opcodes, exported ABIs, compiler settings, and all
runtime bytes after substituting the exact immutable words. A subsequent runtime
`createProject` creates a complete Branch.

The measured complete bind transaction used **13,427,365 gas**, below **16,777,216**.
The local three-contract batch used **10,266,939 gas**. These finite cases do not prove
a universal worst-case gas bound. The local batch helper is a rehearsal of the launch
shape, not the official deployment service.

## Stateful payment fault campaign

`PurchaseAtomicityInvariant.t.sol` adds a handler over two independent branches and
two sponsors. Its ghost ledger tracks each paid attempt, each sponsor's expenditure,
donations, accepted assets, phases and immutable historical checkpoints. It starts with
an accepted root revision and a refused request, so continuation and retry paths are
reachable immediately.

The random actions interleave purchases, explicit retries, callbacks, binding,
donations, and cross-branch callback attacks. Twelve purchase modes cover ordinary
success; Intake reverts; partial pulls; zero/reused request IDs; rejected approval
clearing; insufficient fee caps and allowance; token transfer/approval reentrancy;
and synchronous success/failure callbacks. Reverted purchases must roll back transfers,
allowances, receipts and state. Successful purchases must debit exactly one explicit
fee from the sponsor, use the Branch as payer, preserve donations, and leave zero
Intake allowance. Retry bodies must match the refused attempt exactly.

All required successes and reverts are asserted. No `vm.assume`, `vm.setEnv`, fork,
FFI, live payment, storage injection, or runtime dependency installation is used.
The invariant is configured inline for 256 runs, depth 96, and fail-on-revert. A
deterministic test exercises every fault on both a continuation and a retry, then
demonstrates recovery and all four reentrancy probes.

## Reproduction and observed results

Run from the repository root; all generated artifacts can remain in disposable scratch:

```sh
mkdir -p test/scratch
forge build --out test/scratch/out --cache-path test/scratch/cache
FOUNDRY_FUZZ_SEED=0x8e6f08b396342979a78a833b59d8fa94c3c4f688c79711dbcc983d17d9e957d3 forge test --out test/scratch/out --cache-path test/scratch/cache -vv
TMPDIR="$PWD/test/scratch" node --test test-sdk/*.test.mjs
node test/release/replay-exact-gas.mjs test/scratch/out
```

Observed on Foundry 1.8.3 / Solidity 0.8.26: build passed; **175 Foundry tests passed**
across 22 suites; **85 SDK tests passed**. The added invariant executed **24,576 handler
calls** with no unexpected reverts or discards. The raw-byte mutation fuzz test ran
128 cases. No new reproducible contract defect was found in this addition.

`local-replay-evidence.json` contains the actual **local-only** receipt identifiers,
block, contract addresses, runtime/ABI hashes, constructor arguments and immutable
bindings from the checked replay. These are not mainnet deployment or handoff fields.
There is no official launch ID, public deployment transaction, verified source link,
or official handoff established by this test task. `productionReady=false` and live
profile checks remain `NOT_RUN`. Website publication and paid UI activation are not
performed or authorized by these results.
