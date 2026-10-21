# Build and test from a clean checkout

Run commands from the repository root. No public deployment, funded wallet, API credential or RPC endpoint is needed for these checks.

## Prerequisites and dependencies

Use Node.js ≥22 (the package engine), Foundry providing `forge` and `anvil`, and the native solc **0.8.26** compiler available to Foundry. Python 3 is optional for the independent image-fixture check. The documentation rerun used Node 24.21.0 and Forge 1.8.3; the delivered frontend acceptance used the environments recorded in [final evidence](validation/platform-ux-v1/final/README.md). Tool versions for the documentation rerun are in [its environment record](validation/platform-ux-v1/documentation/environment.json).

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
node tools/local-integration.mjs --review-fixes > /tmp/relay-a1-local.json
node tools/measure-release.mjs --review-fixes
node cli/relay.mjs help
```

`npm run build`, `npm run test:contracts`, `npm test` and `npm run cli -- help` are package-script equivalents for the corresponding steps. `npm run check` covers Node tests, build, Foundry tests and formatting; it does **not** include the integration runner or Python check. A failing command should be investigated before continuing toward readiness.

| Step | What it establishes | Boundary |
| --- | --- | --- |
| `forge build` | Root contracts and tests compile with pinned settings | Lint warnings remain in raw logs; compilation is not a security audit |
| `forge test -vv` | Current contract regressions plus fuzz/invariant suites on fresh local EVM deployments; counts are in current evidence | Mock Intake/token, no fork of live chain state |
| `forge fmt --check` | Solidity formatting | No source rewrite |
| `node --test …` | Current SDK/CLI tests, actual fixture checks, unsigned ABI/read/history preparation and network/parser/mapping regressions | No real DNS/HTTP or wallet; controlled transport stand-ins |
| Python fixture check | Independent inline PNG chunk CRCs, decompression and exact Base64 equivalence | Fixture integrity, not a general hostile-image decoder |
| `local-integration.mjs --review-fixes` | Actual release deployment on temporary Anvil and SDK-prepared transactions through seven bound rounds | Mock IMD/Intake at fixed addresses; no AI, live admission, Git delivery or real IMD consumption |
| `measure-release.mjs --review-fixes` | Four release ABIs and artifact hashes/sizes match fixed config; saved measurement report consistency | Reads saved review-fixes measurement traces and integration report; it does not create new gas measurements |

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

Check production runtime/initcode limits with `forge build --sizes --skip test`; use [current repair evidence](validation/review-fixes/README.md) for the candidate's result. Original [`production-contract-sizes.txt`](validation/production-contract-sizes.txt) and [`measurements.json`](validation/measurements.json) remain historical. A size failure from a test-only contract must be reported separately from release-contract sizes; it is never deployed by the Factory.

To reproduce focused execution-gas traces without overwriting historical evidence:

```sh
forge test --match-test test_maximumCompleteBinding -vvvv > /tmp/relay-a1-binding.txt 2>&1
forge test --match-test test_realEightAssetWitnessExact16384ByteRequestAndOneByteOverRejectedBeforePayment -vvvv > /tmp/relay-a1-body.txt 2>&1
```

Binding fixtures measure execution calls, not total transaction cost; calldata/intrinsic gas is extra. The body boundary accepts 16,384 UTF-8 bytes and rejects 16,385 before payment. The current binding parser accepts at most 32,768 raw bytes, validates unknown metadata without retaining it, and enforces total value/key budgets. The generic strict parser still defaults to 8,192 bytes. [Limits](LIMITS.md) and [current repair evidence](validation/review-fixes/README.md) specify the candidate envelope and measured results; historical gas traces do not establish the revised bound.

## Evidence and failure handling

Saved evidence under `evidence/`, `test/adversarial/evidence/` and `docs/validation/` belongs to different contributor passes. Do not overwrite a failure log with an unrelated later success or treat older test counts as a new run. The [documentation-pass record](validation/documentation-pass/README.md) belongs to the original delivery. New repair reproductions and failed intermediate runs are kept in [review-fixes](validation/review-fixes/README.md).

If a build is unable to find solc or Anvil, provision the documented toolchain; do not change protected build configuration to make a different build appear equivalent. If the integration runner fails, retain stderr and the exit status; an empty/partial stdout JSON file is not a successful flow. Unknown transactions on a future external chain require reconciliation of the original hash, never an automatic re-buy. No default suite currently validates live Intake, live artifact availability or external catalog acceptance.

## Current English frontend

The authoritative [frontend README](frontend-README.md) describes clean install, build, static preview and every route. Use Node ≥22. The locked frontend npm packages and Playwright browser runtimes are **not vendored**; registry access (or a preprovisioned matching cache) is required for `npm ci --prefix frontend`. This differs from the root SDK's committed offline dependencies. Build once before the browser checks:

```sh
npm ci --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run test:e2e:install --prefix frontend
npm run test:e2e --prefix frontend
```

The build writes root `dist/` (not `frontend/dist/`). `npm run preview --prefix frontend` serves port 4173. `node frontend/scripts/static-preview.mjs` serves the committed export at `http://127.0.0.1:4175/preview/` using Node alone. The relative base and hash routes need no rewrite or backend. A public/IPFS deployment was not attempted.

The retained earlier integration report covers **all `tests/e2e/*.spec.ts`**, including 24 original cases, 10 platform cases and one reduced-motion regression in each of five configured projects. Chromium viewports are 1440×900, 390×844 and 320×844; WebKit is 1440×900 and 390×844. That historical report records 175 passes, not the earlier 50-case subset. Its source/export hashes differ from this checkout; see the [current comparison](validation/platform-ux-v1/documentation/current-tree-hashes.json). Re-run the suites above to establish results for the current exact bytes.

Run the full actual-contract runner sequentially after `forge build`:

```sh
node frontend/tests/integration/browser-chain.mjs --browser chromium --group all
node frontend/tests/integration/browser-chain.mjs --browser webkit --group all
node frontend/tests/integration/browser-chain.mjs --browser chromium --group all --mobile
node frontend/tests/integration/browser-chain.mjs --browser webkit --group all --mobile
```

Each owns disposable Anvil plus static/artifact ports, regenerates `frontend/public/local-config.json` and `dist/local-config.json`, and records 16 scenarios. Stop manual local setup first. `--out test/scratch/local-check` redirects this runner's evidence, but deployment configuration still changes; use a disposable checkout to preserve the delivered bytes. The narrower `platform-chain.mjs` is not a substitute for the full regression suite. These transactions use MockToken/MockIntake and unlocked Anvil accounts, not live IMD or a production signer.

Optional rendered probes:

```sh
node frontend/scripts/design-review.mjs
node frontend/scripts/design-review.mjs --webkit
node frontend/scripts/platform-review.mjs
node frontend/scripts/platform-review.mjs --webkit
```

They write evidence in the final validation directory; run in a disposable checkout when preserving history. The historical taste probe referenced a removed task-only `.imd` script and is **not reproducible from this checkout alone**. Its recorded 16/16 result remains historical evidence, not an install instruction or a fresh result.

## Test environments and output handling

Frontend versions are locked in `frontend/package-lock.json`: React 19.3.1, TypeScript 5.9.3, Vite 8.3.4, Vitest 5.0.5, Playwright 1.64.1. Core compiler settings remain solc 0.8.26/Cancun/viaIR/optimizer 200. Historical final tool observations and source hashes remain in [final evidence](validation/platform-ux-v1/final/README.md); the documentation rerun's actual tool versions/results are [recorded separately](validation/platform-ux-v1/documentation/README.md).

Install Chromium/WebKit and their required host shared libraries before browser tests. `PLAYWRIGHT_BROWSERS_PATH` selects a preinstalled runtime location; `W1_CHROMIUM_EXECUTABLE` / `W1_WEBKIT_EXECUTABLE` select compatible launchers. On a supported host missing WebKit libraries, `bash frontend/scripts/prepare-webkit.sh /tmp/cto-relay-webkit` downloads/extracts temporary libraries and prints a launcher setting; it is not an offline or universal OS installer. Emulated WebKit is not native Safari certification.

`W1_PREVIEW_PORT`, `W1_E2E_OUTPUT` and `W1_E2E_REPORT` isolate fixture-suite ports/artifacts. For example:

```sh
W1_E2E_REPORT=../test/scratch/e2e-report.json npm run test:e2e --prefix frontend
```

The default suite writes `docs/validation/platform-ux-v1/final/e2e.json`; do not overwrite retained acceptance evidence when comparing runs. Browser scripts need loopback networking and disposable ports, but no external RPC, private key or account. Checks must report original failures alongside later successful revisions. The structural checker `node frontend/scripts/check-integration.mjs` writes a report and checks bytes/configuration only; it is not behavioral or independent review.

To compare protected core bytes and the delivered source/export against their recorded hashes without writing any runtime/configuration files:

```sh
python3 docs/validation/platform-ux-v1/documentation/verify.py
```

This excludes intentionally updated README/docs from the old source manifest, prints all compared hashes and exits nonzero on mismatch. It does not certify behavior. The [current acceptance matrix](validation/platform-ux-v1/documentation/README.md) separates historical local acceptance, documentation reruns and unperformed live gates.
