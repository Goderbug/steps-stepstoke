# PLATFORM-UX-V1 documentation delivery

The delivered product is an English, sequence-first Open Workshop frontend with A1 browser SDK integration and root relative static export. This pass documents existing code; it does not implement missing behavior. **Local scope only: `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`.** Real funds/live runtime acceptance remains unverified.

Current operator/developer documentation: [root README](../../../../README.md), [frontend README](../../../frontend-README.md), [design system](../../../DESIGN.md), [build](../../../BUILD.md), [operations](../../../OPERATIONS.md), [Agent guide](../../../AGENT-GUIDE.md), [future brief policy](../../../PLATFORM-AUTHORING.md), [page/action permissions](../../../frontend-README.md#routes-actions-and-failure-states), [complete contract API](../../../CONTRACTS.md).

## Evidence classes and source identity

**Recorded** below means the accepted final implementation-stage evidence, preserved unchanged under `../final/`. **Rerun** means this documentation pass's local command. Neither is independent certification. A byte comparison establishes which implementation those recorded results concern; it does not recertify behavior.

Pinned repository: identity-md-launches/launch-2294-build-cto-relay-station, A1 commit `878ba4ba1cf7c601656f3a25d17546a425ba1207`, tree `c7838395fec7b493f61a1cf7a08cf5c9db6966b9`. The starting checkout `bb2a495491fac5b2c27bccd46c530f8290f84dd9` additionally contains accepted platform work. [byte-audit.json](byte-audit.json) compares 42 pinned protected core/build/dependency files, plus 120 final source-manifest entries outside README/docs and all eight export files: no mismatch. Historical README/docs hashes intentionally describe earlier prose.

Reproduce this read-only byte audit from the root:

```sh
python3 docs/validation/platform-ux-v1/documentation/verify.py
```

[Final source manifest](../final/source-sha256.json), [final export manifest](../final/dist-sha256.json), [final integrity](../final/integrity-final.json), [evidence SHA256SUMS](../final/SHA256SUMS) and [original baseline](../BASELINE.json) remain unchanged. The [documentation manifest](documentation-sha256.json) added by this pass hashes updated prose separately, excluding itself and mutable reports to avoid self-reference. Frontend source is 663,890 bytes; export 878,491 bytes; combined 1,542,381 bytes, below 8,388,608. These are tracked-source measurements, excluding caches/dependencies. The earlier complete-source snapshot bundle size is [historical](../final/submission-size-final.json), not a measurement of these new docs.

## Requirement matrix

PASS means the indicated local/source scope only. FAIL means a known gap. NOT_RUN means acceptance was not performed; it never means assumed success.

| Requirement / stage | Status | Evidence and limits |
| --- | --- | --- |
| Read delivered project and verify pinned baseline | PASS | [byte audit](byte-audit.json), [baseline](../BASELINE.json); protected source compared to actual Git objects |
| Preserve A1 src/sdk/cli/abi/config and root build/dependencies | PASS | [per-file hashes](byte-audit.json); no core/config mutation |
| Documentation write boundary README.md + docs/** | PASS | [documentation checks](documentation-checks.json); frontend/design replacement located under docs |
| Planning and stage records retained | PASS | [plan](../PLAN.md), [planning checks](../planning-check-results.json), [final stage results](../final/check-results.json) |
| Platform-only design; no Second Life artwork redesign | PASS | [source manifest](../final/source-sha256.json), [design](../../../DESIGN.md); authenticated output unchanged |
| Exact light semantic colors, labelled states, no dark theme | PASS | [rendered measurements](../final/design-measurements-chromium.json), [review](../final/design-review.md) |
| Local licensed fonts or disclosed fallback | PASS | [design typography](../../../DESIGN.md#typography); Arial/Helvetica and Courier New; no named bundled-font claim |
| Body16/meta13/title36/28, spacing/radii/max width/gutters/targets | PASS | [design](../../../DESIGN.md), [both-engine measurements](../final/design-measurements-webkit.json), [screenshots](../final/screenshots/) |
| Motion 140–200ms and reduced motion | PASS | 160ms source; [175-case report](../final/e2e-final.json), [six-domain review](../final/design-review.md) |
| Whitespace, thin rules, overlay-only shadows | PASS | [desktop](../final/screenshots/chromium-desktop-workspace.jpg), [mobile funding](../final/screenshots/chromium-mobile-funding.jpg) |
| Contrast/focus/accessibility local samples | PASS | [measurements](../final/design-measurements-chromium.json), [focus screenshot](../final/screenshots/webkit-focus-390.jpg); not a full accessibility certification |
| Eight production families and reused local showcase | PASS | [design component/source table](../../../DESIGN.md#components), [rendered showcase review](../final/rendered-review-chromium.json) |
| Project list/create/workspace/contribution/funding/status routes | PASS | [page inventory](../../../frontend-README.md#routes-actions-and-failure-states), [full report](../final/e2e-final.json); public writes intentionally disabled |
| Goal → sequence → complete selected output → next action | PASS | [workspace capture](../final/screenshots/chromium-mobile-workspace.jpg), [actual local output](../final/local/chromium/screenshots/actual-web.jpg) |
| Browse without wallet; all eligible proposals reachable | PASS | [full local receipts/scenarios](../final/local/chromium/browser-chain.json), [production browser report](../final/e2e-final.json) |
| Six functions preserved; Continue preparation only | PASS | [interface flow](../../../FRONTEND.md#interaction-sequence), [local scenarios](../final/local/webkit/browser-chain.json) |
| Historical fork beside output; exact selected witness and later own funding | PASS | [four local run summary](../final/local-run-results.json), [actual Chromium run](../final/local/chromium/browser-chain.json) |
| Numeric history, stable chain/Factory/Branch/checkpoint IDs | PASS | [local receipts](../final/local/chromium/browser-chain.json), [contract identity/events](../../../CONTRACTS.md) |
| Latest ≠ Selected; genesis/inheritance/attempts not paid completed rounds | PASS | [full local scenarios](../final/local/webkit-mobile/browser-chain.json), [state guide](../../../FRONTEND.md) |
| Full asset table retains original producer Branch/job/checkpoint | PASS | [actual local run](../final/local/chromium-mobile/browser-chain.json), [original result bytes](../final/local/chromium-mobile/files/) |
| No inferred winners/relationships/new authority/ABI/backend | PASS | [core byte comparison](byte-audit.json), [Agent boundaries](../../../AGENT-GUIDE.md) |
| Fresh identity/anchor/proposal/parent/spender/price/maxFee/exact allowance | PASS | [local safety scenarios](../final/local/chromium/browser-chain.json), [unit log](../final/raw/unit-final.log) |
| Immutable sponsorship, confirmed approval then purchase, duplicate guards | PASS | [local receipts](../final/local/webkit/browser-chain.json), [final review](../final/design-review.md) |
| Close/unmount/account/network cancels delayed wallet preparation | PASS | `cancellations` in [actual chain record](../final/local/chromium/browser-chain.json); submitted requests cannot be retracted |
| Original hash/nonce reconciliation without rebuy | PASS | [local records](../final/local/webkit-mobile/browser-chain.json); two deliberately replaced original hashes per run remain unconfirmed originals |
| Missing callback pending; status1 explicit identical paid retry; status2/unknown frozen | PASS | [full chain record](../final/local/chromium/browser-chain.json), [operational failure policy](../../../OPERATIONS.md) |
| Correct binding without purchase; HTTP cannot settle | PASS | [local tests/receipts](../final/local/webkit/browser-chain.json), [contract API](../../../CONTRACTS.md) |
| No new governance/token/treasury/autospend/retry/unlock/asset mechanisms | PASS | [core comparison](byte-audit.json), [fixed limits](../../../LIMITS.md) |
| Bounded trusted retrieval/SHA256/length/media/version checks | PASS | [file safety scenarios](../final/local/chromium/browser-chain.json), [browser trust/DNS limits](../../../SDK-BROWSER.md) |
| Sanitized Markdown and isolated HTML sandbox/CSP | PASS | [negative artifact cases](../final/e2e-final.json), [source guide](../../../AGENT-GUIDE.md#artifact-contract); arbitrary downloaded content remains untrusted |
| Lazy bounded verified thumbnails/fallback | PASS | [browser cases](../final/e2e-final.json), [design](../../../DESIGN.md#components) |
| Mixed branch/history: paired refetch and visible read-only Retry | PASS | `mixedReads` in [real local record](../final/local/chromium/browser-chain.json); no reload or signing required |
| PNG natural ratio; safe path basename/extension and exact download | PASS | `wideImage` in [local record](../final/local/webkit/browser-chain.json): 48×24; wide.png; digest 8b63958ad4c026fd27f4219e16cebfefaa93191d3f139850997a28d7870398bb |
| Unavailable/bad files never verified | PASS | [negative cases](../final/e2e-final.json), [preview rules](../../../FRONTEND.md#files) |
| English UI/a11y/default demo and current allowed-path docs | PASS | [writing review](../final/design-review.md), [current guide](../../../frontend-README.md) |
| All current prose throughout protected frontend tree | FAIL | frontend/README.md and package description retain stale wording; docs replacement linked prominently; outside this pass's write allowance |
| Preserve authenticated bytes/IDs/historical records | PASS | [source/export audit](byte-audit.json), [historical archive index](../final/history-traces-index.json); original validation evidence unmodified |
| Labelled successful HTML → PNG → HTML default demo; secondary failures | PASS | [browser cases](../final/e2e-final.json), [demo captures](../final/screenshots/); simulated signatures and deterministic bytes |
| Never fixtures on real routes | PASS | [public/local behavior](../../../frontend-README.md), [local negative configuration checks](../final/local/chromium/browser-chain.json) |
| Source/root dist relative export/hash routes/gateway-like prefix | PASS | [hashes](../final/dist-sha256.json), [byte-identical rebuild](../final/export-rebuild.json), [browser report](../final/e2e-final.json) |
| Frontend source ≤8MiB; no delivered dependencies/caches | PASS | [byte audit](byte-audit.json), [structural final audit](../final/structural-review.json) |
| Logs/screenshots/receipts/hashes/open issues delivered | PASS | [raw](../final/raw/), [screenshots](../final/screenshots/), [four local runs](../final/local-run-results.json), [open gates](open-issues.md) |
| Six-domain design/structural worker reviews | PASS | [review outcomes/corrections](../final/design-review.md), [structural report](../final/structural-review.json); not independent approval |
| Independent final frontend contributor review / external audit | NOT_RUN | [final limits](../final/open-issues.md) |
| Core local tests | PASS | Recorded [125 Solidity](../final/raw/forge-test.log), [39 SDK](../final/raw/sdk-test.log); reruns below |
| WebKit clean local runtime after repair | PASS | [full WebKit run](../final/local/webkit/browser-chain.json), [mobile](../final/local/webkit-mobile/browser-chain.json); earlier failures retained in [archive](../final/regressions/webkit-diagnostics.tar.xz) |
| Native Safari/devices/screen reader/zoom/real wallet journeys | NOT_RUN | [open gates](open-issues.md) |
| Historical task-only taste probe reproduction from fresh clone | NOT_RUN | Script absent from delivery; historical [16/16 result](../final/taste-final.json) retained |
| Live manifest/callback liveness and real IMD compatibility | NOT_RUN | [future acceptance procedure](../../../LIVE-VALIDATION.md), [limits](open-issues.md); local structure cannot settle this gate |
| Public deployment/hosting, real funded tests, new orders | NOT_RUN | Out of scope; no such action performed |
| Nonproduction flags retained | PASS | [release byte comparison](byte-audit.json), [explicit final flags](../final/check-results.json) |

## Review outcomes

The final implementing-worker review reports no remaining confirmed High/Medium issue in its exercised local scope. It repaired excluded original tests, overflow, small mobile controls, funding-step visibility, fixture callback recovery, branch/journal selection and WebKit navigation reads. [The six-domain review](../final/design-review.md) links source findings and final rechecks. Earlier failures are still recorded, including [intermediate report archives](../final/intermediate-browser-reports-index.json) and [WebKit diagnostics](../final/regressions/webkit-diagnostics.tar.xz). A passing local WebKit run resolves that tested regression only; it does not clear native or live gates.

This documentation review corrected stale current guides claiming no frontend, pending integration, only platform.spec.ts coverage, an eight-case runner, or still-open final WebKit local failures. It relocated current frontend/design guidance to allowed docs paths, documented unbundled prerequisites and removed task-only tools from the clean-checkout instructions. Historical final/initial result records remain intact. The protected frontend README/package-description discrepancy remains an explicit FAIL rather than a fictional source fix.

## Documentation reproduction

Commands ran against unchanged sources; frontend install/build and Solidity compilation ran in a disposable copy under test/scratch to respect this assignment's paths. Log paths are normalized to `<checkout>`/`<scratch>` only; assertions, diagnostics, counts and outcomes are retained. No live RPC, deployment, paid runtime or new order was used. Exact fresh-clone equivalents and required tool/runtime settings are in [BUILD.md](../../../BUILD.md).

The rerun environment uses Node 24.21.0, npm as recorded in [environment.json](environment.json), Foundry/Anvil 1.8.3, solc 0.8.26, Linux, and frontend's unchanged lockfile. The old root documentation reproduction used Node 22.23.3; it is not this rerun's version.

| Command from repo root (scratch equivalent for generated files) | Status | Result / log |
| --- | --- | --- |
| `npm ci --prefix frontend` | PASS | 146 locked packages, [install](raw/frontend-install.log); no new dependency files delivered |
| `npm run typecheck --prefix frontend` | PASS | [typecheck](raw/typecheck.log) |
| `npm run test:unit --prefix frontend` | PASS | 43/43, [units](raw/unit.log); retained missing source-map warning from vendored bundle |
| `npm run build --prefix frontend` | PASS | [build](raw/build.log), [fresh export comparison](rebuild.json) |
| `forge test --offline` | PASS | 125/125, [Solidity rerun](raw/forge-test.log), solc provisioned before invocation |
| `forge fmt --check` | PASS | [format](raw/forge-fmt.log), exit 0 with no output |
| `node --test test-sdk/*.test.mjs` | PASS | 39/39, [SDK](raw/sdk-test.log) |
| `python3 test/adversarial/check-inline-fixtures.py` | PASS | [fixture bytes](raw/inline-fixtures.log) |
| `node cli/relay.mjs help` | PASS | [CLI usage](raw/cli-help.log) |
| `python3 docs/validation/platform-ux-v1/documentation/verify.py` | PASS | [byte comparison](byte-audit.json) |

Additional local observations:

| Command/check | Status | Result / limit |
| --- | --- | --- |
| `npm run test:e2e --prefix frontend -- --project chromium-desktop --project chromium-mobile --project chromium-narrow` | PASS | 105/105, zero skipped/flaky/unexpected; [raw output](raw/chromium-e2e.log), [JSON report](chromium-e2e.json) |
| `npm run test:e2e:install --prefix frontend` | PASS for download only | Browser binaries installed; [host-library warnings and initial mirror DNS failures retained](raw/browser-install.log); no dependency/runtime bundled |
| WebKit launch/full suite rerun | NOT_RUN | Launch refused missing host libraries (including GTK4/GStreamer); [exact diagnostic](rendered-samples.json). Recorded final implementation WebKit passes remain distinct |
| Four actual-chain browser runs in this documentation pass | NOT_RUN | Existing final receipts/source hashes preserved; no claim of rerunning them here |
| `node tools/check-release.mjs` before build in the original checkout | FAIL | [missing out/ artifact](raw/release-check.log); the build intentionally ran only in scratch |
| `node tools/check-release.mjs` after scratch compilation | PASS | [ABI/code hashes/limits](raw/release-check-scratch.log); same delivered tool/source with required built artifacts |
| `node tools/generate-sdk-abi.mjs --check` in scratch | PASS | [SDK ABI](raw/sdk-abi.log) |
| Rendered Chromium sample at 1440/390 | PASS | [observations](rendered-samples.json), [desktop capture](screenshots/chromium-workspace-1440.jpg), [mobile capture](screenshots/chromium-workspace-390.jpg); verified output loaded before capture, no page errors/host overflow |
| Changed-document link/path/whitespace checks | PASS | [check record](documentation-checks.json); byte/path checks do not certify behavior |

The full 175-case/four-chain-browser matrix above remains tied to its original source hashes, not relabelled as this pass's run. This pass does not clear independent review, native wallet/device, live compatibility or liveness gates. The initial root release-check failure is a missing-build precondition, not a core regression; its exact diagnostic is retained alongside the successful scratch check.


To reproduce the two documentation screenshots after the frontend install/build and Chromium installation, run:

```sh
node docs/validation/platform-ux-v1/documentation/capture.mjs
```

This starts/closes a temporary loopback static server, waits for verified HTML content inside the sandbox, captures a full page at 1440px and a scrolled selected-output viewport at 390px, and probes WebKit launch availability without treating launch as behavioral acceptance. It writes this pass's rendered-sample JSON/screenshots; copy earlier evidence before rerunning. It uses the same locked Playwright package and optional `PLAYWRIGHT_BROWSERS_PATH` runtime location as the fixture tests. Both final screenshots were opened for documentation review; no claim of full native-device review follows.
