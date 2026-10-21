# CTO Relay frontend

The English Open Workshop platform preserves A1 operations and uses the delivered browser SDK. Public operations fail closed while `productionDeployment` is null. `#/local` reads disposable local contracts. `#/demo` uses explicitly labelled deterministic fixtures; real routes never fall back to fixtures. `#/showcase` reuses production components.

From the repository root:

```sh
npm ci --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run preview --prefix frontend
```

Open `http://localhost:4173/`. The build writes the repository-root `dist/` with relative assets and hash routes. To preview a gateway-like subpath, run `node frontend/scripts/static-preview.mjs` and open `http://127.0.0.1:4175/preview/`.

Browser checks:

```sh
npx --prefix frontend playwright install chromium webkit
npm run test:e2e --prefix frontend
forge build
node frontend/tests/integration/platform-chain.mjs
node frontend/tests/integration/platform-chain.mjs --webkit
```

`W1_CHROMIUM_EXECUTABLE`, `W1_WEBKIT_EXECUTABLE` and `PLAYWRIGHT_BROWSERS_PATH` may select externally installed test runtimes. The current Playwright configuration runs `platform.spec.ts` at desktop/mobile/narrow Chromium and desktop/mobile WebKit widths. Original W1 test files and the older `browser-chain.mjs` are retained historical selector coverage, not the active English acceptance suite.

The local-chain runner starts and closes its own disposable Anvil and artifact/static servers. It records actual wallet submissions and receipts under `docs/validation/platform-ux-v1/receipts/`. No key or public RPC is required. See the root [README](../README.md), [interface guide](../docs/FRONTEND.md), [authoring guide](../docs/PLATFORM-AUTHORING.md) and [current validation](../docs/validation/platform-ux-v1/README.md).

System Arial/Helvetica and Courier New are the disclosed local font fallbacks. The old Noto subset/license remains in source for historical continuity; the current bundle does not load it.
