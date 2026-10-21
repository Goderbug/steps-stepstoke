# CTO Relay Station W1 + A1 local integration

This delivery imports W1, preserves its Chinese responsive design, and connects its project and
workspace UI to the delivered browser SDK, final ABI and actual local A1 contracts. Root `dist/`
is the static export. There is no public deployment, real IMD purchase, funded credential, paid
child job, backend requirement or automatic purchase. `#/local` is actual A1 with explicit local
MockToken/MockIntake/files; `#/demo` remains a labeled fixture; public `#/` stays closed.

`productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false` are retained.
Local behavioral checks and structural integrity checks have separate evidence. The implementing
worker ran the checks; they do not have independent network authority. This frontend integration
has not received an independent contributor review. See [review coverage and limitations](review.md).

## Inputs and preservation

Starting HEAD was `0d5b4720f75eccb6d6c9ef73d554d07d0e13965b`, containing earlier accepted repairs
and browser SDK work. The required A1 commit `9b0294e7ab19060bd00c489fbe032cf248528e0d` is its
ancestor. The exact patch was downloaded: **194891 bytes**, SHA-256
`3028547365dae0b93d9a6191f15b9023fd59821c791d205e8c79cc16375a2989`.
It passed `git apply --check` and applied to an archived copy of that pinned ancestor; every file
in the patched-baseline `source-sha256.json` matched. The current contract/ABI/config source still
matches that patched baseline. Accepted SDK changes were preserved, rather than reapplying an
already-applied patch or reconstructing repairs from prose.

W1 repository `identity-md-launches/launch-2297-build-cto-relay-station` at
`d48bc2117a06c79c3b8545d15eeff2675da94a31` was downloaded into `frontend/` with original source,
tests, notices and exact locked dependencies. `input-provenance.json` records every original W1
file hash, archive SHA-256, starting HEAD and patch verification. W1 historical reports/binaries
are immutable references at that commit; current evidence is here. Root compiler, dependencies,
CLI, contract rules, SDK and ABI were not changed by this frontend stage.

## Commands and raw evidence

Commands were run locally, with outputs retained here. Browser executable overrides selected the
available Chromium; browsers/dependencies/caches are excluded from the submission.

| Command | Evidence |
| --- | --- |
| `npm ci --prefix frontend --cache /tmp/cto-relay-npm-cache` | `install.log` |
| `npm run build --prefix frontend` | `build.log` |
| `npm run typecheck --prefix frontend` | `typecheck.log` |
| `npm run test:unit --prefix frontend` | `unit.log` |
| `forge build`; `forge test`; `forge fmt --check` | `forge-build.log`, `forge-test.log`, `forge-fmt.log` |
| `node --test test-sdk/*.test.mjs` | `sdk-test.log` |
| `python3 test/adversarial/check-inline-fixtures.py`; `node tools/check-release.mjs` | `fixture-integrity.log`, `release-check.log` |
| `node cli/relay.mjs help` | `cli-help.log` |
| `node tools/sdk-local-check.mjs --out … --chrome … --playwright …` | `sdk-browser-chain.json`, stdout/stderr logs |
| `node frontend/tests/integration/local-command.mjs` | `local-command-check.json`, log (separate SDK/mock utility walkthrough, not browser proof) |
| `node frontend/tests/integration/browser-chain.mjs` | `browser-chain.log`, `browser-chain.json` (UI wallet calls, actual receipts, config, requests, witnesses, traces) |
| `cd frontend && node node_modules/@playwright/test/cli.js test --project=chromium-desktop --project=chromium-mobile --project=chromium-narrow` | `fixture-final-all.log`, `e2e.json`, per-test `browser/` audits |
| `node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | `taste-command.log`, `taste.json`, screenshot |
| `node frontend/scripts/check-integration.mjs` | `structural-review.json`, log |
| `node frontend/scripts/measure-submission.mjs` | `submission-size.json`, log |

The local test setup executes `tools/generate-local-config.mjs` against the actual deployed
Factory. Config values are observed code addresses/hashes and fixed policy/ABI/limits, not made-up
addresses. Browser actions sign SDK unsigned transactions through the **selected named EIP-6963
provider**, backed only by two temporary unlocked Anvil accounts. Mock writer callbacks are test
controls; they are separate from app transactions. This is not a replay of old CLI evidence.

The source README includes a reproducible clean-checkout local setup and an explicit mock-result
walkthrough (`local-setup.mjs`, `local-deliver.mjs`). Local artifact service is a deterministic,
test-only static transport. Browser trusted-host/DNS limitations remain documented in
`docs/SDK-BROWSER.md`; no HTTP observation can settle or unlock a Branch.

## Results and matrix

Final results: 125 Foundry, 39 SDK, 30 unit, 72 Chromium UI, 12 actual-local matrix cases, 16/16 taste checks; all eight exported files match the independent rebuild. Browser traces contain 71 wallet submissions (69 mined originals and two deliberately dropped originals). See [the check/matrix table](results.md) and `results.json`. `PASS` is limited to
the specified fixture/actual-local-contract check; it never means real-IMD compatibility.
Historical failing runs, packaging supersessions and repaired findings are retained separately;
final reports identify the current runs rather than counting a failed earlier run as success.

## Limitations and readiness

- Independent contributor review of this integration: **NOT_RUN**. Worker review and structural
  probes are recorded separately from the earlier independent A1 review.
- WebKit: **NOT_RUN**. Binary download completed, but required native libraries were missing and
  sandbox restrictions prevented dependency installation. Chromium desktop/mobile emulation was
  used; real devices, extension wallets and Coinbase passkeys were not exercised.
- Real IMD execution/admission, live delivery, Git publication and public hosting: **NOT_RUN**.
  Mock authenticated callbacks prove the local contract/UI path, not service compatibility.
- Reorg/finality, pruned or very long history/RPC pagination and long-duration worker behavior:
  **NOT_RUN**. Reads currently scan local Factory/Branch logs directly, without a mandatory indexer.
- An authenticated result can exceed the finite manifest envelope and remain permanently
  unbindable. This risk is preserved, with no administrator, timeout, refund, rewriting or
  automatic retry. Status2/unknown failure freezes; missing callbacks stay pending.

The local frontend deliverable is implemented and exercised. Overall integration readiness is
**incomplete pending independent review and unperformed environments**, and production readiness
remains false. Final source/export hashes, byte budgets and detailed result counts accompany this
report. Structural acceptance alone is not behavioral proof.
