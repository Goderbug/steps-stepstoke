# Documentation pass: rerun evidence (2026-10-21)

This pass rewrote `README.md` and added `docs/FRONTEND.md`, `docs/ACCEPTANCE.md` and `docs/PROTOCOL-OVERVIEW.md` (the previous README, preserved). **No source, test, config, dependency or `dist/` file was changed.** Before writing, the documented commands were rerun on the starting tree (HEAD `28fbb8a`) so the docs describe observed behavior. Earlier evidence directories are untouched.

| File | Command | Result |
| --- | --- | --- |
| [forge-build.log](forge-build.log) | `forge build` | PASS |
| [forge-test.log](forge-test.log) | `FOUNDRY_FUZZ_SEED=0x1466…9118 forge test` | 125 passed, 0 failed, 0 skipped |
| [forge-fmt.log](forge-fmt.log) | `forge fmt --check` | exit 0 |
| [sdk-test.log](sdk-test.log) | `node --test test-sdk/*.test.mjs` | 39 passed |
| [fixture-integrity.log](fixture-integrity.log) | `python3 test/adversarial/check-inline-fixtures.py` | PASS |
| [release-check.log](release-check.log) | `node tools/check-release.mjs` | exit 0 |
| [abi-check.log](abi-check.log) | `node tools/generate-sdk-abi.mjs --check` | `ok: true` |
| [cli-help.log](cli-help.log) | `node cli/relay.mjs help` | prints the 15 commands |
| [frontend-typecheck.log](frontend-typecheck.log), [frontend-unit.log](frontend-unit.log), [frontend-build.log](frontend-build.log) | `npm ci`, `typecheck`, `test:unit`, `build` in `frontend/` | PASS / 30 passed / PASS; `git status` clean afterwards, so `dist/` was rebuilt byte-identically |
| [browser-chain-chromium-flow.log](browser-chain-chromium-flow.log) | `browser-chain.mjs --browser chromium --group flow` | 4/4 PASS |
| [browser-chain-chromium-all.log](browser-chain-chromium-all.log), [chromium-all/browser-chain.json](chromium-all/browser-chain.json) | `browser-chain.mjs --browser chromium` (all 13 cases, one chain) | 13/13 PASS; `result`, `functionalResult` and `browserRuntimeStatus` PASS; 0 browser errors, 0 unexpected requests; generated config equals the committed `local-config.json` |
| [trace-audit-chromium-all.log](trace-audit-chromium-all.log) | `audit-local-evidence.mjs` on that run | PASS: 78 receipts, 2 dropped originals |
| [fixture-chromium-desktop.log](fixture-chromium-desktop.log) | `playwright test --project=chromium-desktop --workers=1 --reporter=line` | 24/24 PASS (fixture, not chain evidence) |
| [chromium-all/screenshots/](chromium-all/screenshots/) | from the full run | Local workspace at 390 and 1440 px; isolated HTML preview (`actual-web.jpg`) |
| [tool-versions.txt](tool-versions.txt) | — | Node 22.23.2, Forge/Anvil 1.8.3, Playwright 1.64.1 |
| [final-sha256.json](final-sha256.json) | SHA-256 of every `git ls-files` path outside `docs/validation/` after this pass | — |

Environment notes:

- Chromium needed system libraries the machine lacked (`libatk-1.0.so.0` and others). They were extracted with `apt-get download` and `dpkg-deb -x` into a temporary directory and used through an `LD_LIBRARY_PATH` wrapper passed as `W1_CHROMIUM_EXECUTABLE`. Nothing was installed system-wide or committed.
- WebKit, the browser SDK parity check and the other fixture projects were **not** rerun in this pass. Their earlier results are cited from `../acceptance/`.
- Absolute machine paths in the logs were replaced with `<repo>`/`<home>`.

Classification: actual local contracts with MockToken/MockIntake. `productionDeployment: null`, `liveCompatibility: NOT_RUN`, `productionReady: false`. No real IMD was used.
