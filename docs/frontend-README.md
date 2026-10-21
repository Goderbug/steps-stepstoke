# CTO Relay frontend

The delivered English Open Workshop frontend supports six A1 operations through the browser SDK. **Public deployment is closed; demo signatures and worker results are simulated, local contracts use MockToken/MockIntake, and real funds are not accepted by a configured public product.** `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`.

This is the current frontend README. The protected `frontend/README.md` retains contradictory earlier test-runner prose; use this guide and [BUILD.md](BUILD.md) for the delivered tree.

## Clean checkout

Use Node ≥22. Run from the repository root:

```sh
npm ci --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run preview --prefix frontend
```

Open `http://localhost:4173/#/demo/b/fx-branch-1` for the labelled HTML → PNG → HTML example. Demo settings select simulated accounts, wrong network and reset; funding controls expose secondary failure cases. These are deterministic browser-local fixtures, not purchased AI. The global wallet control is real wallet connection UI, but demo actions use the selected simulated account.

The build emits repository-root `dist/`, with Vite `base: './'`, bundled local assets and hash routes. No route rewrites or server backend are required. Serve the same export under a gateway-like prefix:

```sh
node frontend/scripts/static-preview.mjs
```

Open `http://127.0.0.1:4175/preview/#/demo/b/fx-branch-1`. This command needs only Node and the committed export; dependency installation is unnecessary to inspect it. It is a local static server, not public hosting. Absolute social-preview URLs and a public gateway are unverified because no production domain is configured.

For real disposable contracts, run `forge build`, then `node frontend/scripts/local-setup.mjs` in a separate terminal. Keep it running and open `http://localhost:4173/#/local`; see [operations](OPERATIONS.md). The committed local configuration identifies an earlier ephemeral chain and must be regenerated for a new session. Do not treat it as a production address book.

## Routes, actions and failure states

| Reachable page | Permissions | Failure and recovery |
| --- | --- | --- |
| `#/` (also unknown non-demo/local/showcase hashes) | Anyone; wallet-free status, demo/local links | Public create is disabled; no public Factory or fixture substitution |
| `#/demo` | Anyone, simulated account for mutations | Local-storage/read failure is visible; reset demo in settings; resetting discards demo progress |
| `#/demo/b/fx-branch-1` and created demo Branches | Anyone reads; simulated create/propose/approve/purchase/bind/fork | Stale anchor, wrong simulated network, rejection, refusal, unknown outcome and frozen states are illustrative |
| `#/demo/b/fx-branch-sec` | Anyone | Secondary unavailable, tampered and hostile-file cases; verification fails closed |
| `#/local` | Anyone reads verified loopback config/chain; connected selected account on chain 31337 for signing | Missing/stale config, occupied setup ports, wrong code/policy or stopped Anvil blocks access; regenerate setup, then **Verify local configuration again** |
| `#/local/b/<registered-address>` | Public reads; any connected account may propose/fund/fork/bind subject to A1 phase/rules | Unregistered/invalid Branch, inconsistent reads, stale proposal/witness, price/allowance/phase changes, token or wallet error; see contract API and recovery below |
| `#/showcase` | Anyone; production components with labelled demo data | Sample stages are illustrative, not receipts; demo funding cannot spend live tokens |

Create, proposal, funding and fork are sheets within these pages; they are not additional routes. File tabs, history selection, evidence disclosures, refresh, mixed-read Retry, and copying/downloading verified data need no wallet. Continue opens preparation at the current checkpoint; it does not submit, approve or buy. See [six functions](FRONTEND.md#interaction-sequence) and [contract permissions/errors](CONTRACTS.md).

One WalletButton supports named EIP-6963 extensions, mobile **Open in** links and Coinbase Smart Wallet without a relay project ID. Wrong-chain actions offer switching; rejection and provider changes invalidate preparation. Real extension/passkey/native wallet-app journeys are **NOT_RUN**. Wallet connection alone gives no spending permission. No ENS resolution or physical-device certification is claimed.

## Tests and evidence

The full suite matches **every `tests/e2e/*.spec.ts`**: 35 cases in five configured projects. The full actual-chain runner is **`browser-chain.mjs`**. The narrower `platform-chain.mjs` remains available but does not replace it.

```sh
npm run test:e2e:install --prefix frontend
npm run test:e2e --prefix frontend
forge build
node frontend/tests/integration/browser-chain.mjs --browser chromium --group all
node frontend/tests/integration/browser-chain.mjs --browser webkit --group all
node frontend/tests/integration/browser-chain.mjs --browser chromium --group all --mobile
node frontend/tests/integration/browser-chain.mjs --browser webkit --group all --mobile
```

Run the local-chain commands sequentially; they own ports and regenerate local config/export config. The Playwright fixture suite checks `/preview/` at Chromium 1440/390/320 and WebKit 1440/390. Optional browser executable/runtime settings and exact environments are in [BUILD.md](BUILD.md). Tests write reports; archive prior evidence or use a disposable checkout when reproducing.

[Design system](DESIGN.md) · [states and provenance](FRONTEND.md) · [developer/Agent guide](AGENT-GUIDE.md) · [final requirement matrix](validation/platform-ux-v1/documentation/README.md). Prior local counts are evidence for the hashed delivered source, not a new run or independent approval.
