# CTO Relay

An English workspace for public projects: create a fixed goal, propose work, explicitly fund an execution, read accepted files, continue, or fork an accepted historical checkpoint. The Open Workshop platform leads with sequence and selected output. [DESIGN.md](DESIGN.md) documents the implemented system.

**Local acceptance only.** `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. No public deployment, hosting, live IMD purchase, funded credential or child order was performed. A1 `src/`, `sdk/`, `cli/`, `abi/`, `config/`, root build configuration and root dependencies remain byte-identical to pinned source `878ba4ba1cf7c601656f3a25d17546a425ba1207`.

## Install, build and preview

Use Node.js 22 or newer. The frontend lockfile is delivered unchanged.

```sh
npm ci --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run preview --prefix frontend
```

Open `http://localhost:4173/`. The Vite build writes the committed repository-root `dist/`. It uses `base: './'`, local runtime assets and hash routes, so a static server needs no route rewrites. To check a gateway-like subpath:

```sh
node frontend/scripts/static-preview.mjs
# open http://127.0.0.1:4175/preview/
```

| Route | Data and behavior |
| --- | --- |
| `#/` | Public configuration state; fails closed with no fixture substitution |
| `#/local`, `#/local/b/<address>` | Actual disposable A1 contracts using local MockToken/MockIntake |
| `#/demo`, `#/demo/b/fx-branch-1` | Labelled deterministic local fixtures; default successful HTML → PNG → HTML sequence |
| `#/demo/b/fx-branch-sec` | Secondary hostile/broken-file fixtures |
| `#/showcase` | The eight production component families using labelled demo data |

Browsing never requires a wallet. Connection supports named EIP-6963 browser wallets, mobile wallet-browser links and Coinbase Smart Wallet behind one control. No relay project ID is required. Typography uses disclosed local Arial/Helvetica and Courier New fallbacks; no remote fonts are requested.

## Run local contracts

Foundry (`forge`, `anvil`) and solc 0.8.26 are needed. Core source dependencies are already delivered as ordinary files; no submodule initialization or root dependency change is needed.

```sh
forge build
node frontend/scripts/local-setup.mjs
# in another terminal:
npm run preview --prefix frontend
# open http://localhost:4173/#/local
```

Local setup creates a disposable loopback chain, installs MockToken/MockIntake, deploys the final A1 Factory and generates `frontend/public/local-config.json` from actual code hashes and policy/ABI identity. It also refreshes `dist/local-config.json`. Use a temporary local development wallet only; no funded public account or key is needed by the runner.

After an explicit purchase, no real worker runs on this local chain. To deliver a mock callback:

```sh
node frontend/scripts/local-deliver.mjs --branch <local-branch-address> --job <new-local-job-id>
```

The command prints the original `result.json` path. Select it under **Original callback-authenticated result.json**, then choose **Bind original result without purchase**. `--status 1` delivers a refusal; an explicit retry pays again for the identical body. `--status 2` or an unknown failure freezes purchases. A missing callback remains pending. HTTP cannot settle or unlock the Branch.

## Validate

```sh
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npx --prefix frontend playwright install chromium webkit
npm run test:e2e --prefix frontend
node frontend/tests/integration/browser-chain.mjs --browser chromium --group all
node frontend/tests/integration/browser-chain.mjs --browser webkit --group all
node frontend/tests/integration/browser-chain.mjs --browser chromium --group all --mobile
node frontend/tests/integration/browser-chain.mjs --browser webkit --group all --mobile
forge test
forge fmt --check
node --test test-sdk/*.test.mjs
node tools/check-release.mjs
python3 test/adversarial/check-inline-fixtures.py
```

Browser runtimes and shared libraries must be available locally. `PLAYWRIGHT_BROWSERS_PATH`, `W1_CHROMIUM_EXECUTABLE` and `W1_WEBKIT_EXECUTABLE` can point to test runtimes outside the repository. The current Playwright suite checks the committed export at `/preview/`, in Chromium at 320/390/1440 and WebKit at 390/1440. The actual-chain runner starts and closes its own Anvil and static/artifact servers. It drives the production app through a named test wallet forwarding unsigned calls to disposable unlocked Anvil accounts; it records receipts rather than substituting fixture state.

Final results, raw logs, screenshots, hashes, receipts, six-domain design review and limitations are in [final integration validation](docs/validation/platform-ux-v1/final/README.md). These are the worker's local observations, not independent certification or live acceptance. Earlier evidence is retained under `docs/validation/integration/` and `review-fixes/`; its counts and hashes describe earlier source. All original scenario files now use English and the production composition. Playwright includes every spec across all five original configured projects. The full `browser-chain.mjs` runner retains the original contract assertions and adds mixed-read recovery, cancellation and non-square download checks. Run local contract suites sequentially: each owns the disposable ports and deployment configuration.

## Behavior and boundaries

Continue opens preparation at the current checkpoint. Historical selection only changes the viewed snapshot. A Historical Fork copies the exact selected accepted nonzero checkpoint and its file provenance, and needs its own later funding. Genesis, inheritance and unaccepted attempts are not completed paid rounds.

A proposal is immutable. Any eligible proposal remains reachable and can be funded; sponsors cannot edit it. Before signing, the adapter rechecks account, network, provider, anchor, proposal, witness, parent, spender, price/max fee and exact allowance. Approval confirmation precedes a separate purchase. Duplicate guards remain active through receipts. Closing or unmounting preparation, editing its context, or changing account/network cancels delayed preparation before wallet submission. Already-submitted transactions are reconciled by original hash/nonce; they cannot be cancelled retroactively or automatically purchased again.

Files use trusted bounded retrieval, SHA-256, byte length and media checks. HTML stays in an opaque sandbox with a restrictive CSP; Markdown is sanitized. Downloads use the safe descriptor.path basename and preserve its extension and exact bytes. Failed or unavailable artifacts receive no verified label. The full asset table retains original producer Branch, job and checkpoint independently of the latest execution.

The protocol has no new authority, asset type, governance, treasury, automatic spending, auto-retry, refund or unlock. Publication remains disabled by the actual A1 release configuration. Demo publication controls only illustrate fixture states.

## Source map and documentation

- `frontend/src/components/`, `frontend/src/ui/`: shared platform components and current surfaces.
- `frontend/src/domain/`: existing adapter/SDK boundary, with derived read consistency and cancellation checks.
- `src/`, `sdk/`, `cli/`, `abi/`, `config/`: preserved A1 core.
- [Interface and state guide](docs/FRONTEND.md), [future frontend authoring](docs/PLATFORM-AUTHORING.md), [core build](docs/BUILD.md), [operations](docs/OPERATIONS.md).
- [Contract API](docs/CONTRACTS.md), [limits](docs/LIMITS.md), [CLI examples](docs/CLI.md), [browser SDK trust model](docs/SDK-BROWSER.md), [historical handoff](docs/HANDOFF.md).
- [Current design](DESIGN.md), [current validation](docs/validation/platform-ux-v1/README.md), [baseline hashes](docs/validation/platform-ux-v1/BASELINE.json).

## Submission storage

Five large historical raw traces are stored without loss in `docs/validation/platform-ux-v1/final/history-traces.tar.xz`. Their original paths contain restoration instructions and original SHA-256 values; `history-traces-index.json` indexes every byte. All other historical evidence stays at its original path. The unused Noto UI font was removed; its historical license/provenance notices remain. Active typography uses the disclosed system fallbacks. No required runtime asset, root dependency, lockfile or authenticated output was removed.

The final validation directory records the complete source snapshot Git bundle size against the 8 MiB budget. Temporary screenshots, browser runtimes and package caches stay outside the submission. No ignore file was changed.
