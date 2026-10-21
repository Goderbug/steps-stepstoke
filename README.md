# CTO Relay

CTO Relay is an English workspace for public projects: create a fixed goal, propose work, explicitly fund execution, read accepted files, continue, or fork accepted history. Its Open Workshop interface puts the checkpoint sequence and complete selected output before the next action.

**Local product only; not ready for real funds.** Public create/funding is disabled. Demo results/signatures are simulated; disposable local contracts use MockToken and MockIntake, with manually delivered callbacks rather than a real AI worker. `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. External manifest/callback liveness, live execution and independent frontend review remain unaccepted. See [acceptance and open gates](docs/validation/platform-ux-v1/documentation/README.md).

## Build and test

From a fresh clone, use Node ≥22; frontend installation requires the locked npm registry packages. Foundry/solc are only needed for contract checks and local signing.

```sh
npm ci --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run preview --prefix frontend
```

Open `http://localhost:4173/#/demo/b/fx-branch-1`. The build emits root `dist/` with relative assets and hash routes. The committed export can also be viewed without npm installation:

```sh
node frontend/scripts/static-preview.mjs
# open http://127.0.0.1:4175/preview/#/demo/b/fx-branch-1
```

For the full browser matrix, after building:

```sh
npm run test:e2e:install --prefix frontend
npm run test:e2e --prefix frontend
```

For core regressions, provision Foundry (`forge`, `anvil`), solc 0.8.26 and Python 3:

```sh
forge build
forge test
forge fmt --check
node --test test-sdk/*.test.mjs
node tools/check-release.mjs
python3 test/adversarial/check-inline-fixtures.py
```

Core libraries and the SDK's ethers bundle are committed ordinary files. Frontend npm packages, browser runtimes and compilers are not bundled. An offline machine must provision those prerequisites before building; the committed static export needs only a local server. [Build guide](docs/BUILD.md) gives all commands, environments, side effects and browser-library limits.

## Use the workspace

Browse without connecting a wallet. Start at the demo URL above, select Round 1, 2 or 3, inspect the complete output and original asset provenance, then choose **Continue** or **Historical Fork**. **Continue** opens preparation against the current checkpoint even while history is selected. Proposing, approving tokens and purchasing are separate actions. Historical Fork copies the exact selected accepted nonzero snapshot and requires its own later funding. Genesis, inheritance and failed attempts are not completed paid rounds.

| Page | Access and limits |
| --- | --- |
| `#/` | Public configuration status and links; public mutations disabled |
| `#/demo`, `#/demo/b/fx-branch-1` | Labelled deterministic HTML → PNG → HTML fixtures; simulated accounts and secondary failure controls |
| `#/demo/b/fx-branch-sec` | Hostile/broken/unavailable-file demonstration |
| `#/local`, `#/local/b/<registered-address>` | Actual disposable contracts; wallet-free reads; verified local network/account required for signing |
| `#/showcase` | Production components and illustrative states; demo funding only |

To run disposable contracts, keep this command running in another terminal after `forge build`:

```sh
node frontend/scripts/local-setup.mjs
```

Open `http://localhost:4173/#/local` using the preview command above. Setup regenerates loopback deployment configuration and local mock balances; committed session addresses are not reusable public deployments. Use a temporary development wallet on chain 31337 only. No funded public account is required. The worker does not run locally; [operations](docs/OPERATIONS.md) explains mock callback delivery and binding.

Any account may create, propose, sponsor, bind or fork within the fixed protocol rules. Sponsors cannot edit proposals. Fresh signing checks enforce identity, anchor/witness/parent, price/maxFee and exact allowance; confirmed approval precedes purchase. Unknown transactions reconcile the original hash/nonce without rebuying. Missing callbacks remain pending; status 1 permits only an explicit identical paid retry; status 2/unknown failures freeze purchases. No refund, timeout unlock, governance, treasury or automatic spending exists. [Page/action failure modes](docs/frontend-README.md) and [complete public contract API](docs/CONTRACTS.md) describe permissions and errors.

Artifact checks authenticate exact bytes/provenance, not quality or availability. HTML previews are isolated by sandbox/CSP; Markdown is sanitized; verified PNGs retain natural aspect ratio. Downloads preserve safe descriptor basenames/extensions and exact bytes. Failed/unavailable files are never verified. Historical records and authenticated project artwork are not translated or restyled.

## Documentation and evidence

- [Current frontend README](docs/frontend-README.md), [design system](docs/DESIGN.md), [interface/state guide](docs/FRONTEND.md).
- [Build/test](docs/BUILD.md), [operations](docs/OPERATIONS.md), [developer/Agent guide](docs/AGENT-GUIDE.md), [future brief language policy](docs/PLATFORM-AUTHORING.md).
- [CLI/SDK reference](docs/CLI.md), [browser SDK](docs/SDK-BROWSER.md), [limits](docs/LIMITS.md), [handoff/readiness](docs/HANDOFF.md).
- [Requirement matrix and documentation checks](docs/validation/platform-ux-v1/documentation/README.md), [prior final local results](docs/validation/platform-ux-v1/final/README.md), [raw logs/screenshots/receipts](docs/validation/platform-ux-v1/final/), [read-only baseline/hash audit](docs/validation/platform-ux-v1/documentation/byte-audit.json).

Protected A1 sources, root build/dependencies and the existing frontend/export are unchanged by this documentation assignment. The pinned A1 baseline is `878ba4ba1cf7c601656f3a25d17546a425ba1207`; the starting checkout also includes accepted platform work. Historical hashes describe their recorded source, not updated prose. Current frontend/design guides live in `docs/` because this assignment permits only `README.md` and `docs/**`; contradictory earlier prose in `frontend/README.md` is superseded here.
