# PLATFORM-UX-V1 evidence index

The delivered English platform source and root relative `dist/` are preserved. This documentation assignment makes no implementation or deployment changes.

`productionDeployment:null` · `liveCompatibility:NOT_RUN` · `productionReady:false`.

Start with the [current requirement matrix and documentation reproduction](documentation/README.md), [current open gates](documentation/open-issues.md), and [read-only source/core/export comparison](documentation/byte-audit.json).

The [final integration stage](final/README.md) supersedes earlier platform-stage counts: 43 frontend unit tests, 175 fixture-browser tests, 16 actual local-chain scenarios in each Chromium/WebKit desktop/mobile run, 125 Solidity tests and 39 SDK tests. Final [source hashes](final/source-sha256.json), [export hashes](final/dist-sha256.json), [raw logs](final/raw/), [screenshots](final/screenshots/), [receipts](final/local/), [review](final/design-review.md) and [open issues](final/open-issues.md) remain unchanged historical evidence for that source. Worker reports are not independent certification.

Earlier top-level JSON/raw reports, `receipts/`, planning [PLAN.md](PLAN.md) and [BASELINE.json](BASELINE.json) are retained. Their 41-unit/50-browser/eight-local-case counts and open WebKit diagnostics describe earlier revisions. The final transport repair and four clean local runs do not erase those failures. Use the [final review](final/design-review.md) for the resolved local regression and the [current gates](documentation/open-issues.md) for native-device and live limits.

Reproduce from [the current build guide](../../BUILD.md). Every `tests/e2e/*.spec.ts` is active; the complete local runner is `frontend/tests/integration/browser-chain.mjs`. Task-only taste tooling from removed `.imd` inputs is not a clean-checkout command. The protected `frontend/README.md` retains earlier prose; [docs/frontend-README.md](../../frontend-README.md) supersedes it.

Five historical large raw traces and intermediate diagnostic/audit reports are stored in indexed lossless archives under `final/`; restoration commands and original SHA-256/lengths remain in [the final index](final/README.md). New documentation evidence is separate so historical manifests and results are not silently rewritten.
