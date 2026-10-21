# PLATFORM-UX-V1 final integration

Worker-executed local acceptance for the delivered Open Workshop platform. This is not independent certification or live acceptance.

`productionDeployment:null` · `liveCompatibility:NOT_RUN` · `productionReady:false`.

## Results

| Check | Actual result |
| --- | --- |
| Pinned A1/core and protected dependency hashes | PASS; [baseline](baseline.json), final integrity report |
| Frontend TypeScript / production build | PASS; relative root `dist/`, hash routes, local metadata/assets |
| Frontend units | 43 passed; original 41 plus callback-reload and bounded read-transport regressions |
| Production browser matrix | 175 passed, zero skipped/flaky/unexpected; [complete report](e2e-final.json) |
| Actual local signing | 16 scenarios in each of Chromium 1440/390 and WebKit 1440/390; [run results](local-run-results.json) |
| Core regression checks | 125 Solidity tests and 39 SDK tests passed; ABI, SDK ABI, format, release and inline-fixture checks passed |
| Pinned taste@1 | 16/16; [raw result](raw/taste-targets-final.log) |
| Rendered design review | Both engines, four routes at 320/390/768/1440; contrast, focus, targets and reduced motion checked |
| Complete source submission budget | See `submission-size-final.json`; complete file snapshot Git bundle, limit 8,388,608 bytes |

All 24 original fixture scenarios remain, alongside the 10 existing platform scenarios and one added reduced-motion case. Every configured browser project remains: Chromium desktop/mobile/320px and WebKit desktop/mobile. All original fixture-file assertion counts are unchanged; the complete local suite increases its assertions. [Migration audit](migration-audit.json) records counts and composition mappings; counts alone do not prove behavior.

## Actual contract evidence

Each [local run](local/) has `browser-chain.json`, original deterministic files/result manifests, and representative screenshots. These actions use a named EIP-6963 provider forwarding SDK-created unsigned transactions to two disposable unlocked Anvil accounts. The actual A1 Factory/Branches run against MockToken/MockIntake. This is distinct from `#/demo` and fixture callbacks.

Each run records 87 application wallet submissions: 85 successful original receipts and two original hashes deliberately dropped/replaced. Their null receipts are intentional; replacement hashes, original nonce/calldata and chain reconciliation outcomes remain recorded. They are not reported as confirmed original receipts. Both signing accounts participate (49 and 38 submissions). Setup and authenticated mock-writer transactions remain separate.

The 16 scenarios retain the original 13 local cases and add three final regressions. Coverage includes Markdown create/update; HTML R1 → PNG R2 → HTML R3 with original marker, exact embedded PNG and producer provenance; non-head R1 fork; child first `job.open` and next `job.continue`; eligible/stale proposals; exact approval, price/maxFee changes, immutable sponsorship, double clicks/rejections and account/network changes; missing/corrupt journals, unknown/dropped/replaced original transactions; missing callbacks, identical paid status-1 retry, status-2/unknown freeze and corrected binding without repurchase; malicious/tampered/unavailable/oversized files; mixed reads; and cancellation before wallet submission.

`mixedReads` records automatic paired refetch and visible read-only Retry recovery without reload, wallet or payment. Selection stays on R1 while the head remains R3. `cancellations` records unchanged submission counts on close/account/network changes. `wideImage` records 48×24 dimensions, `images/wide.png` → `wide.png`, and identical downloaded/descriptor SHA-256 `8b63958ad4c026fd27f4219e16cebfefaa93191d3f139850997a28d7870398bb`.

## Diagnostics and repairs

The full pre-repair WebKit suite reproduced uncaught RPC access-control errors in receipt polling and branch reads around reload/navigation. The complete failed record is [preserved losslessly](regressions/webkit-diagnostics.tar.xz). Bounded public reads now use navigation keepalive; wallet submissions and request bodies over 16,384 bytes use ordinary transport, preserving complete simulation bytes. No runtime-error listener suppresses these errors. The final four local runs have zero unexpected page/console errors.

The intentionally injected HTTP 503 is recorded separately as `expectedResourceDiagnostics`, matched to its exact artifact URL/status during that negative test. It does not settle an attempt, mark a file verified, or conceal other errors. A separate six-cycle navigation interruption probe did not reproduce the earlier error before the fix; the full signing suite did. Its narrower result is retained, not promoted to proof of a fix.

Other repairs and their rechecks are in [the six-domain review](design-review.md). Intermediate failed browser reports are retained exactly in `intermediate-browser-reports.tar.xz`; their index includes original paths, byte lengths and SHA-256. Final command logs remain directly readable in `raw/`; earlier exact logs are in `raw/intermediate-logs.tar.xz` with a path index. All 175 final per-scenario runtime audit files are preserved byte-for-byte in `browser-runtime-audits.tar.xz` (see `browser-audits-index.json`), while `e2e-final.json` remains directly readable. Extract these repository-relative tar archives with `tar -xJf <archive> -C .`. Playwright trace-enabled diagnostics themselves injected sandbox-denied snapshot scripts; those diagnostic failures are retained in raw logs and were not used for final acceptance, which runs without traces. Unexpected final runtime errors still fail the harness.

## Reproduce

From the repository root, install the unchanged frontend lockfile, then run:

```sh
npm ci --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
forge build
node frontend/tests/integration/browser-chain.mjs --browser chromium --group all
node frontend/tests/integration/browser-chain.mjs --browser webkit --group all
node frontend/tests/integration/browser-chain.mjs --browser chromium --group all --mobile
node frontend/tests/integration/browser-chain.mjs --browser webkit --group all --mobile
node frontend/scripts/design-review.mjs
node frontend/scripts/design-review.mjs --webkit
node frontend/scripts/platform-review.mjs
node frontend/scripts/platform-review.mjs --webkit
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
node frontend/scripts/check-integration.mjs
```

Install the locked Playwright browser runtimes first. On a host missing WebKit shared libraries, `frontend/scripts/prepare-webkit.sh /tmp/cto-relay-webkit` downloads/extracts them into temporary storage and prints the launcher setting. It installs no system files. Set `PLAYWRIGHT_BROWSERS_PATH`, `W1_WEBKIT_EXECUTABLE` and/or `W1_CHROMIUM_EXECUTABLE` as needed. Set `IMD_PLAYWRIGHT` to the frontend Playwright `index.mjs` for the pinned probe when discovery needs it. Run actual local suites sequentially: they own ports and generated local configuration. No keys or live credentials are needed.

## Preserved history and scope

`src/`, `sdk/`, `cli/`, `abi/`, `config/`, root build/dependencies and frontend dependency manifests/lockfile remain byte-identical. No public deployment/hosting, funded credential, live IMD test or child order was used. No Second Life artwork was changed.

Five multi-megabyte historical raw traces are stored losslessly in `history-traces.tar.xz`. Original paths contain restoration instructions and original hashes; `history-traces-index.json` verifies every byte. Restore with `tar -xJf docs/validation/platform-ux-v1/final/history-traces.tar.xz -C .`. All other historical evidence retains its original bytes and paths. Required root offline dependency archives stay intact. The unused Noto font was removed; its historical notices remain. No ignore file was changed. Temporary dependency/runtime/cache directories and redundant captures are excluded from the submission.

See [open issues and limits](open-issues.md). Local success does not establish manifest/callback liveness on external Intake, live AI execution, publication or production readiness.

`source-sha256.json` and `dist-sha256.json` pin the final source and export. `SHA256SUMS` pins the final evidence files, excluding itself and size-measurement files to avoid self-reference. Reproduce the complete file-snapshot budget with `node frontend/scripts/measure-platform.mjs docs/validation/platform-ux-v1/final/submission-size-final.json`.
