# CTO Relay Station

CTO Relay Station is a set of Solidity contracts, a Node/browser SDK with an Agent CLI, and a Chinese web app for public, forkable AI work projects. Anyone can create a project with a fixed goal, propose the next piece of work, explicitly pay IMD for one proposal through the IdentityMD Intake, bind the authenticated result as a new file checkpoint, and fork any accepted historical checkpoint.

## Status: read this first

- **Not deployed. Not production-ready.** `productionDeployment: null`, `liveCompatibility: NOT_RUN`, `productionReady: false` (`config/release.json`). No public chain deployment, hosting or real IMD purchase has been made by any job on this project.
- **Everything that ran used mocks.** End-to-end tests run on a disposable local Anvil chain (31337). They use `MockToken` instead of IMD and `MockIntake` plus a scripted mock writer instead of the real IdentityMD Intake and workers. The local files are deterministic test bytes, not AI output. **No real IMD runtime has run anything, including a contract-payer `job.continue`.**
- **The public route (`#/`) is closed on purpose.** No public deployment config exists, so it shows `A1_INTEGRATION_PENDING` and does nothing. The `#/local` route accepts only a loopback page and a loopback RPC. `#/demo` runs a labelled fixture with simulated accounts.
- **Do not use with real funds.** Paid fees are never refunded, including on refusal. The contracts have no admin, no timeout, no cancel and no rescue. If the writer's authenticated `result.json` exceeds the finite parser limits (32 KiB raw, plus the limits in [docs/LIMITS.md](docs/LIMITS.md)), that Branch stays at `ResultRecorded` forever. If a callback never arrives, the Branch stays `Pending` forever. Forking earlier accepted history is the only way forward in either case.
- **The three runtime profiles have not been checked against the live IMD catalog.** These are `build-document`, `build-website` and `imagegen` with fixed `steps[].inputs`/`outputs`. A paid release would first need to be authorized separately and run through [docs/LIVE-VALIDATION.md](docs/LIVE-VALIDATION.md). That procedure has never been run.
- **Open findings.** In earlier runs, WebKit reported 3 intermittent loopback RPC page errors on reload-heavy pages (Medium, root cause unknown). No fresh independent contributor review of this integration has been done (`NOT_RUN`). Browsers cannot see DNS answers, so the trusted artifact hosts are a trust decision. Physical wallets, phones and assistive technology have not been tested. Details: [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md#unresolved-issues).

## Build and test from a fresh clone

Prerequisites: **Node.js 22+ with npm**, **Foundry** (`forge`, `anvil`; checked with 1.8.3) and **solc 0.8.26** available to Foundry, plus Python 3 for one fixture check. The root needs no `npm install` and no `forge install`. `lib/openzeppelin-contracts` and the root `ethers` dependency (`vendor/`) are committed as ordinary files. The Solidity tests use their own `test/TestBase.sol`, not forge-std. Frontend dependencies are installed from `frontend/package-lock.json`.

```sh
# Contracts and Node SDK/CLI (root, offline)
forge build
FOUNDRY_FUZZ_SEED=0x146644c630d7548a74d043e2779607ab2def960ac3890b548af84b4eb4db9118 forge test   # 125 tests
forge fmt --check
node --test test-sdk/*.test.mjs          # 39 tests (27 A1 baseline + browser-SDK/parity/regressions)
python3 test/adversarial/check-inline-fixtures.py
node tools/check-release.mjs             # release artifacts, ABI digests, policy
node tools/generate-sdk-abi.mjs --check  # SDK-embedded ABI matches abi/
node cli/relay.mjs help

# Frontend (W1) — dependencies stay under frontend/
npm ci --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend      # 30 tests
npm run build --prefix frontend          # writes the static export to root dist/
```

On 2026-10-21 these commands were run from this commit's tree. All passed, and `npm run build` rebuilt `dist/` byte-identically. Logs are in [docs/validation/integration/documentation/](docs/validation/integration/documentation/README.md).

### Browser-to-local-contract tests

These start their own Anvil (ports 8545/8546). They deploy the final contracts and serve the production `dist/`. W1 is then driven in a real browser through a named EIP-6963 test wallet that signs with two disposable Anvil accounts. Stop any manual local setup first.

```sh
export PLAYWRIGHT_BROWSERS_PATH=/tmp/cto-relay-browsers
frontend/node_modules/.bin/playwright install chromium webkit
node frontend/tests/integration/browser-chain.mjs --browser chromium --out test/scratch/chromium
# WebKit, one group at a time (each on a fresh chain): flow | recovery | payments | failures | files
node frontend/tests/integration/browser-chain.mjs --browser webkit --group flow --out test/scratch/webkit-flow
node frontend/scripts/audit-local-evidence.mjs test/scratch/chromium   # re-encodes every wallet tx with the Node SDK
# Fixture UI suite (simulated adapter, NOT chain evidence)
(cd frontend && npx playwright test --project=chromium-desktop --workers=1 --reporter=line)
```

Without `--out`, the runner writes into `docs/validation/integration/acceptance/` and overwrites retained evidence, so pass `--out`. The fixture suite's default JSON reporter also writes there. Use `--reporter=line` or set `W1_E2E_REPORT`.

Minimal Ubuntu 24.04 machines may lack browser system libraries:

- **WebKit:** `bash frontend/scripts/prepare-webkit.sh /tmp/cto-relay-webkit`, then `export W1_WEBKIT_EXECUTABLE=/tmp/cto-relay-webkit/webkit-headless`.
- **Chromium:** if it fails on a missing `libatk-1.0.so.0` or similar, `apt-get download` the missing packages into a temporary directory and extract them with `dpkg-deb -x`. Then point `W1_CHROMIUM_EXECUTABLE` at a small wrapper that sets `LD_LIBRARY_PATH`. The packages used here were libatk1.0-0t64, libatk-bridge2.0-0t64, libatspi2.0-0t64, libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libxrender1, libxi6, libgbm1, libdrm2 and libasound2t64. This needs no sudo and does not change the project.

## Run the product locally

```sh
forge build
node frontend/scripts/local-setup.mjs          # terminal 1 — leave running
npm run build --prefix frontend && npm run preview --prefix frontend   # terminal 2
# open http://localhost:4173/#/local
```

`local-setup.mjs` does the following:

- It refuses to start if the ports are already in use.
- It starts Anvil on chain 31337 at `127.0.0.1:8545`.
- It installs `MockToken` and `MockIntake` at the real Intake/IMD addresses, **on this throwaway chain only**.
- It deploys the final `RelayFactory()` and writes `frontend/public/local-config.json` with `tools/generate-local-config.mjs` from the deployed runtime code (code hashes, policy ID, ABI digests, profiles, limits, prices). It also refreshes `dist/local-config.json`.
- It prints two funded temporary accounts. Import one into a development wallet on the loopback network. These are well-known Anvil keys, so never use them anywhere else.

The committed config is byte-identical to one freshly generated in this pass.

No real worker exists on the local chain. After a purchase, deliver a mock result explicitly:

```sh
node frontend/scripts/local-deliver.mjs --branch 0xYOUR_LOCAL_BRANCH --job some-new-job-id [--file PATH] [--status 1|2|7]
```

It prints the path of the original `result.json`. In the workspace, choose **提交原始结果绑定（不重新购买）** and select that file. `--status 1` sends an authenticated refusal, after which an explicit, newly funded identical-body retry is allowed. `--status 2` or `7` freezes the Branch. None of these options buys anything.

The web app's pages, actions, permissions and failure modes are in [docs/FRONTEND.md](docs/FRONTEND.md).

## The six functions

| User action | Contract call (anyone may call) | Pays IMD? | Main failures |
| --- | --- | --- | --- |
| Create project | `RelayFactory.createProject(goal)` → new root Branch | No (gas only) | Empty/overlong (>512 B)/invalid UTF-8/control text |
| Propose work | `RelayBranch.propose(proposal, currentWitness)` | No | `Stale` anchor, `InvalidWitness`, profile/path/name collision, text >1024 B, encoded body >16384 B |
| Sponsor (buy one execution) | `RelayBranch.sponsor(proposalId, maxFee, currentWitness)` after `IMD.approve(branch, exactPrice)` | **Yes, exact current price, never refunded** | `Busy` (not `Ready`), zero/unknown/stale proposal, `FeeExceeded` (price 0 or > `maxFee`), allowance/balance/payment-delta errors |
| Read files, state, history | Branch getters (`phase`, `anchor`, `proposal`, `attempt`, `checkpoint`, `bodyOf`, …) and `CheckpointWritten`/`Bound` events | No | None beyond ABI decoding; file bytes are fetched off-chain and checked against SHA-256/length/MIME |
| Continue | Propose + sponsor again on the same Branch; the encoder uses the Branch's own `latestJobId` (`job.continue@job-1`) | Yes, per sponsorship | As propose/sponsor |
| Fork history | `RelayFactory.fork(parent, acceptedRevision, completeWitness, direction)` | No | `InvalidParent`, `InvalidCheckpoint` (revision 0, unaccepted, witness mismatch), empty direction |

Recovery and settlement:

- `retry(maxFee, witness)`: anyone, only in `Refused` (authenticated status 1). Same proposal and body, a new paid attempt.
- `bind(rawManifest, oldWitness)`: anyone, only in `ResultRecorded`. It must be the exact original raw bytes whose keccak the callback recorded. A failed bind can be resubmitted without buying again.
- `onIntakeResult` and `onIntakeFailure`: only the fixed Intake, only for the Branch's own pending request, only once.
- `initialize`: only the Factory, once.

No owner, setter, upgrade, sweep, refund, timeout or HTTP settlement exists. Every entry point, getter, event and error is in [docs/CONTRACTS.md](docs/CONTRACTS.md). The fixed limits are in [docs/LIMITS.md](docs/LIMITS.md).

Branch phases:

- `Ready`: any current nonzero proposal may be sponsored, with no FIFO.
- `Purchasing`: reentrancy blocked.
- `Pending`: no purchase. Stays here indefinitely if no callback arrives.
- `ResultRecorded`: no purchase until a bind succeeds.
- `Refused`: explicit funded retry only.
- `Frozen`: status 2 or any other status. Final.

A new proposal does not move the anchor. A successful bind does, which makes older proposals stale. Sponsors cannot edit proposals.

**Who is the payer.** The **Branch** is `msg.sender` at the Intake. It is therefore the IMD project's payer, and only it can continue its own project. A fork is a new Branch and therefore a new payer. Its first purchase is `job.open@job-1`, and later ones continue only its own job. A sponsor approves the **Branch**, not the Intake. The Branch pulls exactly the price, approves exactly that amount to the Intake, calls `requestWithFailure` and clears the allowance. Publication is fixed off (`github:true, ipfs:false`, `publish:true` rejected).

Fixed profiles:

- Markdown create/update (`build-document`, `.md` up to 64 KiB)
- HTML create/update (`build-website`, exact `dist/index.html` up to 2 MiB, may select Markdown/HTML/PNG inputs)
- Single PNG image (`imagegen`, up to 256 KiB, no inputs)

## Agent CLI and SDK handoff

- **CLI** (`node cli/relay.mjs …`). It only prepares unsigned `{to,data,value}` transactions or `eth_call` requests: `create`, `propose`, `sponsor`, `retry`, `bind`, `fork`, `preview`, `read`, `witness`. It checks files with `file-check`, `html-check` and `fetch-check` (explicit public HTTPS only, pinned DNS). It also has `status`, `decode-checkpoint` and `recover-history`. It never signs, broadcasts, approves or retries. Walkthrough: [docs/CLI.md](docs/CLI.md).
- **Node SDK:** `sdk/index.mjs` (the package `exports`). It uses Node `crypto`/`fs`/DNS/HTTPS through `sdk/files.mjs`.
- **Browser SDK:** `sdk/browser.mjs`. It has no `Buffer` or `process`, and uses `sdk/files-browser.mjs` for bounded streaming downloads from configured trusted locations, with all redirects refused. Both share `sdk/core.mjs` (canonical encoding/validation) and `sdk/strict-json.mjs`. Parity between the runtimes is tested. Trust model: [docs/SDK-BROWSER.md](docs/SDK-BROWSER.md).
- **ABI:** `abi/*.json` (SHA-256 digests in `tools/check-release.mjs` output and `local-config.json`).
- **Operator procedure:** [docs/OPERATIONS.md](docs/OPERATIONS.md).
- **Historical A1 handoff:** [docs/HANDOFF.md](docs/HANDOFF.md). It predates the browser integration.

Handing a project from an agent to the browser needs no server. Both read the same chain state and events. An agent can prepare a transaction with the CLI and have any wallet sign it, and the web app will show the result after a refresh. The browser journal in `localStorage` only helps match transactions. Chain state is the source of truth.

## Source inputs and hashes

| Input | Pin | Verified |
| --- | --- | --- |
| A1 source | `identity-md-launches/launch-2294-build-cto-relay-station` @ `9b0294e7ab19060bd00c489fbe032cf248528e0d` | Ancestor of this tree |
| A1 review patch | gist `a1-review-fixes.patch`, 194891 bytes, SHA-256 `3028547365dae0b93d9a6191f15b9023fd59821c791d205e8c79cc16375a2989` | `git apply --check` + apply on the ancestor archive; all 70 patched-baseline hashes matched ([source-inputs.json](docs/validation/integration/acceptance/source-inputs.json), [input-verification.log](docs/validation/integration/acceptance/input-verification.log)) |
| W1 frontend | `identity-md-launches/launch-2297-build-cto-relay-station` @ `d48bc2117a06c79c3b8545d15eeff2675da94a31`, imported into `frontend/` | 319 original file hashes checked; lockfile unchanged |
| Manifest of inputs | [docs/validation/integration/SOURCE-INPUTS.json](docs/validation/integration/SOURCE-INPUTS.json) | — |

How the brief and the repository differ:

- The previous job blocked because the patch touches `config/release.json`. A later contributor applied it. `config/release.json` is therefore part of the patched baseline, not an edit made by this documentation pass.
- The integration started from accepted integration HEAD `8c0d6da`, not directly from `9b0294e`.
- `sdk/index.mjs` and `sdk/strict-json.mjs` were intentionally refactored after the patched baseline to add the browser entrypoint.

The final hashes of every delivered source, runtime, ABI, SDK, config and export file are in [final-sha256.json](docs/validation/integration/acceptance/final-sha256.json). On 2026-10-21 all 217 entries matched this tree byte-for-byte before this documentation pass. Only `README.md` and the new `docs/` files differ now, and [documentation/final-sha256.json](docs/validation/integration/documentation/final-sha256.json) records them.

## Acceptance summary

The full matrix, with separate **Fixture UI**, **Actual local contract** and **Real IMD** columns, is in [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md). In short:

- **Actual local contract:** all 13 browser-to-chain cases PASS in Chromium. They were rerun in this pass with 80 wallet submissions, 78 receipts and 2 deliberately dropped originals, and the trace audit passed. Earlier, all 13 also passed in Playwright WebKit across five groups.
- **WebKit browser cleanliness:** FAIL in 3 original runs because of the open RPC page error.
- **Fixture UI:** 120/120 in the earlier five-project run. 24/24 chromium-desktop in this pass.
- **Real IMD:** every item NOT_RUN.

Structural and local acceptance is not behavioral proof against the real Intake. Live readiness is still blocked by missing public config, unverified live compatibility and the retained finite-manifest risk.

## Repository map

- **Contracts:** `src/`. `RelayFactory`, `RelayBranch`, `RelayEncoder`, `RelayVerifier` and the libraries (`ManifestJSON`, `Policy`, `Assets`, …).
- **Solidity tests:** `test/`, including `test/adversarial/`, `test/fixtures/` and mocks.
- **SDK and CLI:** `sdk/` and `cli/`. Their tests are in `test-sdk/`.
- **Tools:** `tools/` (local integration, config generator, ABI and release checks, measurements).
- **Web app:** `frontend/` (W1 React/Vite/wagmi app, its tests and local scripts). `dist/` holds the committed static export, with relative assets and hash routes, which also works under a gateway subpath.
- **Fixed release data:** `config/release.json`.
- **Committed dependencies:** `vendor/` and `lib/`.
- **Evidence:** `docs/validation/` and `evidence/`. Earlier reports are kept unchanged. Their counts and hashes describe the code as it was when each report was written.
