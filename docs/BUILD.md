# Build and test from a clean checkout

Run commands from the repository root. No public deployment, funded wallet, API credential or RPC endpoint is needed for these checks.

## Prerequisites and dependencies

Use Node.js ≥22 (the package engine), Foundry providing `forge` and `anvil`, and the native solc **0.8.26** compiler available to Foundry. Python 3 is optional for the independent image-fixture check. The documentation reproduction used Node 22.23.3 and Forge 1.8.3. Other tool versions are not certified by that observation.

```sh
node --version
forge --version
anvil --version
```

The repository includes the needed OpenZeppelin Contracts 5.4.0 source subset under `lib/`, ethers 6.17.0's standalone ESM bundle under `vendor/ethers/`, and every locked npm dependency as an integrity-checked tarball under `vendor/npm/`. They are ordinary files, not submodules. The SDK imports the vendored bundle directly. Do not run `forge install` or initialize submodules to build this checkout; `npm ci` is unnecessary for its tests/CLI. License/provenance files accompany the vendored code. Node tests check tarball integrity against `package-lock.json`.

Foundry, solc, Node and Python executables are **not** vendored. A fresh offline machine must provision these tools, including solc 0.8.26, beforehand. If the compiler is missing, `forge build` may need a network download; the committed source dependencies alone do not make a blank machine an offline compiler installation. No extra runtime package is fetched by the SDK.

## Complete local sequence

```sh
forge build
FOUNDRY_FUZZ_SEED=0x146644c630d7548a74d043e2779607ab2def960ac3890b548af84b4eb4db9118 forge test -vv
forge fmt --check
node --test test-sdk/*.test.mjs
python3 test/adversarial/check-inline-fixtures.py
node tools/local-integration.mjs > /tmp/relay-a1-local.json
node tools/measure-release.mjs
node cli/relay.mjs help
```

`npm run build`, `npm run test:contracts`, `npm test` and `npm run cli -- help` are package-script equivalents for the corresponding steps. `npm run check` covers Node tests, build, Foundry tests and formatting; it does **not** include the integration runner or Python check. A failing command should be investigated before continuing toward readiness.

| Step | What it establishes | Boundary |
| --- | --- | --- |
| `forge build` | Root contracts and tests compile with pinned settings | Lint warnings remain in raw logs; compilation is not a security audit |
| `forge test -vv` | 91 delivered tests, including fuzz/invariant suites, on fresh local EVM deployments | Mock Intake/token, no fork of live chain state |
| `forge fmt --check` | Solidity formatting | No source rewrite |
| `node --test …` | 20 SDK/CLI tests, actual fixture checks, unsigned ABI/read/history preparation, network-guard regressions | No real DNS/HTTP or wallet; controlled transport stand-ins |
| Python fixture check | Independent inline PNG chunk CRCs, decompression and exact Base64 equivalence | Fixture integrity, not a general hostile-image decoder |
| `local-integration.mjs` | Actual release deployment on temporary Anvil and SDK-prepared transactions through seven bound rounds | Mock IMD/Intake at fixed addresses; no AI, live admission, Git delivery or real IMD consumption |
| `measure-release.mjs` | Four release ABIs and artifact hashes/sizes match fixed config; saved measurement report consistency | Reads existing raw measurement traces and `docs/validation/local-integration.json`; it does not create new gas measurements |

The Foundry suite includes unit tests, 1,000-run fuzz properties and two stateful invariants (128×64 and 256×96 configured sequences/calls). The adversarial model includes randomized proposals, purchases, retries, callbacks, binding, donations and historical forks. Callback tests use the protocol's 200,000-gas stipend. See [`test/adversarial/README.md`](../test/adversarial/README.md) for coverage and [`docs/validation/README.md`](validation/README.md) for raw results and limitations.

The seed above is a test-runner setting, not a credential or contract input. Tests use no FFI, filesystem cheatcodes or external RPCs. The local integration runner is a separate Node process: it starts loopback-only Anvil, uses its unlocked temporary accounts, installs MockToken/MockIntake, submits simulated/prepared transactions, then stops Anvil and removes temporary HTML directories. It accepts no externally supplied RPC URL. A failed invocation reports a local test failure; it is not proof of external service failure.

## ABI and artifact checks

Fresh `forge build` artifacts live in `out/`. The committed `abi/` files support preparation before compiling. To compare **all five** committed ABIs read-only:

```sh
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const name of ['RelayFactory', 'RelayBranch', 'RelayEncoder', 'RelayVerifier', 'IIntake']) {
  const read = path => JSON.parse(readFileSync(path, 'utf8'));
  assert.deepEqual(read(`abi/${name}.json`), read(`out/${name}.sol/${name}.json`).abi, name);
  console.log(`${name}: ABI MATCH`);
}
NODE
```

`node tools/export-abi.mjs` regenerates `abi/` and **writes files**; that is a maintenance command, not the read-only comparison above. `tools/generate-fixtures.py` and `tools/generate-sdk-fixtures.mjs` likewise rewrite source fixtures and should not be part of a routine verification run. `tools/validate-live.mjs` only prepares an offline request-check packet; [live validation](LIVE-VALIDATION.md) explains its use.

The release contracts fit EIP-170 runtime and EIP-3860 initcode limits. `forge build --sizes` including tests has a recorded exit 1 because the **test-only** `SpecStateHandler` runtime is 25,040 bytes. It is never deployed by the Factory; this is not a hidden release-size PASS. The recorded `forge build --sizes --skip test` check succeeds; [`production-contract-sizes.txt`](validation/production-contract-sizes.txt) and [`measurements.json`](validation/measurements.json) retain the release measurements.

To reproduce focused execution-gas traces without overwriting historical evidence:

```sh
forge test --match-test test_maximumCompleteBinding -vvvv > /tmp/relay-a1-binding.txt 2>&1
forge test --match-test test_realEightAssetWitnessExact16384ByteRequestAndOneByteOverRejectedBeforePayment -vvvv > /tmp/relay-a1-body.txt 2>&1
```

Binding fixtures measure execution calls, not total transaction cost; calldata/intrinsic gas is extra. The body boundary accepts 16,384 UTF-8 bytes and rejects 16,385 before payment. The manifest cap is 8,192 bytes, reduced after measured gas excess in an earlier candidate. [Limits](LIMITS.md) gives all bounds, gas values and restrictions.

## Evidence and failure handling

Saved evidence under `evidence/`, `test/adversarial/evidence/` and `docs/validation/` belongs to different contributor passes. Do not overwrite a failure log with an unrelated later success or treat older test counts as a new run. The [documentation-pass record](validation/documentation-pass/README.md) keeps this assignment's reproductions separate from the earlier independent agent report.

If a build is unable to find solc or Anvil, provision the documented toolchain; do not change protected build configuration to make a different build appear equivalent. If the integration runner fails, retain stderr and the exit status; an empty/partial stdout JSON file is not a successful flow. Unknown transactions on a future external chain require reconciliation of the original hash, never an automatic re-buy. No default suite currently validates live Intake, live artifact availability or external catalog acceptance.
