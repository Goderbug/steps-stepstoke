# STEPS frontend

The existing English STEPS / Stepstoke Open Workshop is connected to the verified Ethereum deployment. Public reads need no wallet. Payments and all real signing stay disabled: all live profiles are NOT_RUN and productionReady is false.

From the repository root: `npm ci --ignore-scripts --prefix frontend`, then `npm run typecheck --prefix frontend`, `npm run test:unit --prefix frontend`, and `npm run build --prefix frontend`. Serve the committed export with `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist` and open `/` (live reads), `#/configuration` (deployment details) or `#/demo` (labelled fixtures).

Vite clears dist: import the authentic handoff AFTER rebuilding, using the commands in [../README.md](../README.md). Do not publish a freshly rebuilt export without that import and final inventory verification. A clone without the pinned IMD inputs can serve the complete committed export; it cannot manufacture a replacement handoff. Current results and hosting limits: [connection report](../docs/validation/live-connection-v1/README.md). Historical source/review evidence remains historical.
