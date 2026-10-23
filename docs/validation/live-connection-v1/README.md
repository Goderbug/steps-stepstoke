# STEPS verified Ethereum website connection

The static site is connected to the actual verified Ethereum deployment, with payments and all real signing disabled. The primary `/` route and `#/ethereum` read the live project, never fixture rows. At the recorded check the Factory had zero Branches, so there are no live project outputs or histories to display. All five live profiles remain **NOT_RUN**; `liveCompatibility:NOT_RUN`, `productionReady:false`.

## Publication status and source identity

The actual contract-source commit is **751f3901d4453e1477828e4f7ef0d6af8bc03485**, from [official launch 2455](https://github.com/identity-md-launches/launch-2455-relayencoder-relayverifier-relayfactory/tree/751f3901d4453e1477828e4f7ef0d6af8bc03485). The separate website-source commit is assigned by IMD when this work is committed after review. The inherited workspace HEAD is not claimed as the website commit. No website commit, public site URL or IPFS CID was returned by a publication service to this worker. Those fields remain null in [final-assets.json](final-assets.json). The committed static export is the IMD site delivery; this report does not claim that an unavailable or unobserved URL is live. The final hosted-origin fetch, asset hashes and CORS must be checked when IMD returns its actual URL/CID. Relative Open Graph metadata is retained until that origin exists.

No worker deployment, public transaction, paid product test, child order, key access, automatic purchase/retry, per-round publication, social post or hackathon submission occurred. The existing launch manifest, contracts, compiler settings, ABI arrays, SDK ABI, package manifests and lockfiles remain unchanged.

## Exact local correction and authorship

All eleven allowed correction files already matched [Goderbug/steps-stepstoke at a523c571e874a783967e212b303e4b81f5c9876f](https://github.com/Goderbug/steps-stepstoke/tree/a523c571e874a783967e212b303e4b81f5c9876f) byte for byte on entry. The remote Git blob IDs and SHA-256 values were independently checked; see [correction-import.json](correction-import.json). No remote Solidity, ABI, rehearsal address, history or unrelated file was imported. Subsequent README/release/gate changes record the actual live connection only. Local requester correction authorship is separate from IMD/Swarm contract delivery and from this website integration.

The complete frozen inventory is 50 unchanged Solidity inputs. Generic strict JSON remains limited to 256 retained tokens; the manifest parser remains at 1024. The gas guard and `rawBytes + 96 * totalValues + 8 * totalDecodedKeyBytes + 4 * priorKeyComparisons + 8 * segmentFlushes` work policy are retained. This audited policy intentionally accepts fewer shapes than the pre-audit candidate. Raw manifest byte length does not prove bindability. The pinned correction evidence is preserved as historical evidence, including its then-pending deployment wording; this report and current configuration supersede that status without rewriting its authorship.

## Deployment verification

The source of addresses and identity is the actual pinned `.imd/reads/deployment.json`, with the supplied project and network handoffs. Cross-check coordinates in task prose were not substituted for that handoff. [chain-report.json](chain-report.json) records all 50 current/official input hashes, all five unchanged ABI files, the three canonical handoff ABI hashes, actual creation/runtime fingerprints and immutable checks. [deployment-evidence.json](deployment-evidence.json) contains receipt coordinates, the exact frozen build and matching production gates; it is not a substitute issuer attestation.

| Item | Independently observed |
| --- | --- |
| Chain / launch | Ethereum 1 / cad0c789-2611-4392-bec0-456cb8e57d2c |
| Successful transaction | 0x6377bb6862896730e68c455685bd057d87ddeafca57633370df20c196479bad6 |
| Canonical block | 26248821 / 0x700af02aa56a2917a53049a31db6c392d85ae856973d02fb3eb9999f5c293540 |
| Outer sender | 0xcecc29b037f5064fcdf45a5c318f132ef76aa551 |
| Outer recipient / actual CREATE2 caller | 0xff03410d0fe5fa8f7f59f743de35e333d9857120 |
| Attestation identity from actual handoff | e1bfa2900f7b58e29f97514ac45694a4869136e95821dc31ca8a8375437315ce |

| Application | Actual handoff address | Runtime bytes | Init bytes with arguments |
| --- | --- | ---: | ---: |
| RelayEncoder | 0xae9a9624e6354bbd029fefa762bafd43fb9f6886 | 11498 | 11524 |
| RelayVerifier | 0x52a459aaf8044c5bc7f5a8198ef7305367e98ec4 | 14138 | 14164 |
| RelayFactory | 0xff1519c0b9ae4053d1505bc0e5226178109e0abc | 21195 | 21539 |

The transaction, receipt and live trace agree on outer sender/recipient/calldata. Every named address has one successful CREATE2, empty code in block 26248820, exact creation code, exact runtime at deployment and latest, and matching trace output. The Factory's constructor words and every immutable slot bind the actual Encoder/Verifier; on-chain getters agree. Successful receipt, block hash/number and transaction membership are checked on two independent public operators and checked again after deployment reads. No cached/downloaded trace, fabricated receipt, guessed sender, replacement contract or permissive verifier is used. The existing `tools/import-deployment.mjs`, SDK `verifyPublicDeployment` and `verifyDeploymentConfig` are used unchanged. The existing importer's full official-source check and the clean compiler check both pass.

## Public HTTPS and browser transport

[public-read-transport.json](public-read-transport.json) selects anonymous credential-free HTTPS PublicNode and dRPC. The authentic `network` and `walletAddChain` objects are copied unchanged into the final handoff; this separate hashed policy supplies no addresses or wallet authority. No local RPC proxy, API key, wallet, intercepted route or downloaded trace supplies the public verification.

[browser-public-reads.json](browser-public-reads.json) records **19/19** real Chromium fetch checks across **all ten** read methods exposed by the shipped transport: chain ID, head number, transaction, transaction count, receipt, block, code, calls, logs and callTracer. The first fifteen specifically cover the canonical receipt/block, trace, all nine before/deployment/latest code reads and both immutable getters. Both HTTPS hosts return `Access-Control-Allow-Origin: *` on the observed responses. Browser POSTs with JSON content type succeeded, including the browser's CORS enforcement; no `no-cors` or security-disabled browser was used.

PublicNode returns method-unavailable for tracing and HTTP 403 for some historical code reads (personal-token archive tier). The existing bounded availability fallback obtains those responses from anonymous dRPC. Wrong network, malformed responses, null/missing receipts/code, runtime/immutable mismatch and reorg remain semantic failures; they do not cause a search for a convenient passing answer. Anonymous trace access is an observed capability, not a service guarantee. If the configured public policy stops serving any required verification data, the UI fails closed.

[live-browser.json](live-browser.json) records actual unmocked production-export checks at 390×844, 320×844 and 1440×900: live primary route, verified empty project state, disabled creation/payments, wallet-sheet opening/Escape/focus return, digest-checked deployment details, zero host horizontal overflow and no uncaught page errors. Some browser network entries report `net::ERR_ABORTED`; these are retained, not relabelled as successful requests. Despite those entries, the complete digest loader and live verifier reached their success states in every tested viewport. The separate method checks and static probe passed. These observations are from a real local static-preview origin, not the future public hosted origin.

There are no authenticated STEPS checkpoints in this deployment, so actual deployment-specific artifact/result retrieval and paid profile behavior are **NOT_RUN**. No unrelated public file or fixture is promoted to an authenticated live STEPS output. Exact SHA-256/length/media checks, image decoding, sanitized Markdown and opaque HTML sandboxing remain implemented. Transport failure keeps preview/download unverified and retains the manual original-file path (`frontend/src/preview/FilePreview.tsx:106`) and original callback-result selection (`frontend/src/ui/Workspace.tsx:141`). These are covered with labelled fixtures and unit regressions, not claimed as a new paid live result. Public artifact-server availability/CORS and real mobile wallet sessions remain limits.

## Final build and checks

Commands were run locally; these results are worker observations, not independent approval. Raw final logs and the fixture-suite JSON are retained in the checks archive. The final build is followed by the authentic importer, the strict release check, observer and final asset inventory. Rebuilding clears the imported handoff, so never publish the intermediate build alone.

| Check | Actual result |
| --- | --- |
| `node tools/build-release.mjs` | PASS; unchanged clean compilation of 50 files with solc 0.8.26 and frozen ABI/bytecode/source verification |
| `forge test --offline` | 180 passed, 0 failed; no public RPC or paid product execution |
| `forge fmt --check` | PASS; no Solidity edit |
| `node test/release/check-generic-json.mjs` | PASS against compiled StrictJSON and both SDKs: 256 accepted, 257 rejected, disposable local differential check only |
| `node --test test-sdk/*.test.mjs` | 89 passed, 0 failed |
| `npm run typecheck --prefix frontend` | PASS |
| `npm run test:unit --prefix frontend` | 100 passed, 0 failed |
| `npm run build --prefix frontend` | PASS; relative static assets in root dist |
| Chromium fixture suite, 1440 / 390 / 320 | 111 passed, 0 failed; all six operations, exact separate approval/purchase, history, continuation, fork, safe previews, wrong network/account, replacement/recovery and focus |
| Pinned taste@1 probe | 16/16 checks PASS on the export at 320 / 390 / 1440 and reduced motion |
| `node tools/verify-live-connection.mjs` | PASS; actual source/ABI/creation/runtime/immutable/canonicality cross-check |
| `node tools/import-deployment.mjs …` AFTER build | PASS; authentic live handoff and final hashes, no local rehearsal config |
| `node tools/check-release.mjs` | PASS; exact frozen compilation/artifacts, gate coherence and every final export byte inventoried |
| `node tools/observe-ethereum.mjs dist` | VERIFIED_DEPLOYMENT with matching policy/dependencies; NOT_RUN compatibility, false readiness |
| `node tools/check-connected-export.mjs` | PASS; thirteen files, complete hashes including handoff, unchanged protected files and no signing authority |
| Production gate Draft 2020-12 schema | PASS against unchanged `config/production-gate.schema.json` using jsonschema |
| `git diff --check` | PASS |

The first fixture run exposed tests still navigating to the old configuration landing screen. Their routes/assertions were updated to the explicit configuration page; the fixture harness continues to block external traffic. The primary route is checked separately with actual public transport. Generated fixture downloads/reports now stay in test/scratch and are not published as product output. Nonblocking inherited build diagnostics concern test-variable shadowing, the vendored ethers source-map reference and an ineffective dynamic-import split; no dependency was edited to suppress them.

## Better Interface review

The established STEPS workshop design is preserved: one sequence/history, the complete selected output, then continuation/fork/proposals/funding. The design idea is a warm working canvas organized by ordered checkpoints. The pinned Better Interface workflow and the core principles of all six domains were read and applied. Attribution and licenses remain in `frontend/docs/licenses/`; final implemented tokens, typography, components and breakpoints are in root [DESIGN.md](../../../DESIGN.md).

| Domain | Coverage / result | Honest limits |
| --- | --- | --- |
| Accessibility | Native controls/disabled states, labels, stable status/alert roles, skip link, keyboard focus/trap/return; Chromium fixture and actual wallet-sheet checks pass. | No screen reader, physical assistive technology or complete accessibility certification. |
| Layout | Actual 320/390/1440 screenshots, no horizontal page overflow; product and main disabled action visible on first 390 screen in both loading and verified states. Long values and table/rail overflow checked in fixtures. | No native zoom/RTL-device session. |
| Writing | English identity/content, explicit live deployment and disabled payments, separate readiness/transport/signing vocabulary; no demo rows on primary route. | Authenticated future external outputs are never rewritten. |
| Typography | Existing 13/16/20/24/28/36px scale, Arial/Helvetica/Courier fallbacks, 400/600 weights; probe passes. | System-font rendering varies by platform. |
| Colors | Existing semantic tokens; measured solid text pairs pass probe threshold 4.5:1 (3:1 large), without inferring arbitrary artifact contrast. | No claim for external artwork or every possible embedded artifact. |
| UI | Existing controls/disclosures/sheets, reduced motion, verified/unavailable/empty states; all 16 probe checks pass. | WebKit, physical wallets and paid live pending/success/failure states not exercised here. |

Observed findings and fixes:

- `frontend/src/App.tsx:26`: the former primary landing emphasized the demo and said no deployment existed. It now opens the real Ethereum view and labels the demo separately; footer and current docs describe verified deployment with payments disabled.
- `frontend/src/ui/LocalApp.tsx:55`: the initial rendered phone screen contained only a verification message. The loading state now keeps the Projects title and disabled Create project control above the fold while preserving fail-closed verification.
- `frontend/src/ui/ProjectList.tsx:24`: the empty view formerly invited creation regardless of readiness. The hint above it explains the disabled actions; the live empty state now reads "No projects have been created on Ethereum yet." (see the review revision below).
- The inherited rehearsal JSON was moved from public assets to `frontend/tests/fixtures/local-config.json`; local setup generates its own session file after building. No rehearsal address/config is in the final public handoff or static JSON export.

No unresolved first-screen or repeated probe failure was observed in this bounded review. Two inline links are below the comfortable 44px size but meet the probe's spacing/24px rule. Final screenshots are in [screenshots/](screenshots/). The probe primarily captured the initial loading screen; actual fully verified screenshots and the separate live browser report cover the settled state.

## Review revision (2026-10-23)

An independent review reopened this delivery with one high and four advisory findings. Each one was reproduced from the source before it was changed:

- `docs/AGENT-GUIDE.md:1-5`: still described an "undeployed development candidate" and forbade hosting. It now states the Ethereum mainnet deployment (chain 1, block 26248821, source 751f3901d4453e1477828e4f7ef0d6af8bc03485), the hosted site with payments disabled, NOT_RUN profile checks and productionReady false. The same stale `productionDeployment:null` / "no hosting" header in `docs/PLATFORM-AUTHORING.md`, `docs/ACCEPTANCE.md`, `docs/DESIGN.md`, `docs/FRONTEND.md`, `docs/SDK-BROWSER.md`, `docs/frontend-README.md` and one sentence in `docs/PROTOCOL-OVERVIEW.md` were corrected the same way.
- `frontend/src/ui/ProjectList.tsx:25`: the live empty state said "No projects observed in this read window", although `listBranches` reads the Factory's full `branchCount`. It now reads "No projects have been created on Ethereum yet." The banner, hint and footer are unchanged.
- `frontend/src/App.tsx:37`: "Open local contracts" now renders only on loopback hosts (localhost, 127.0.0.1, [::1], the list `chainAdapter.ts` enforces). The local integration test still uses it on 127.0.0.1.
- `frontend/src/styles.css:61`: `.site-footer` gains `align-items:center`. The reviewer said the phone column was unaffected, but `center` would also have centred the stacked phone column, so the 640px rule (line 245) now sets `align-items:stretch` explicitly to keep the earlier phone layout.
- `frontend/src/App.tsx:26`: the Projects tab no longer carries `aria-current="page"` on `#/configuration`.

Checks after the change, run in order: `npm run typecheck` PASS; `npm run test:unit` 100/100; `node --test test-sdk/*.test.mjs` 89/89; `node tools/verify-live-connection.mjs` ok (50 sources, 3 applications, live chain); `npm run build`; `node tools/import-deployment.mjs …` AFTER the build, ok (12 assets plus handoff); `node tools/build-release.mjs` then `node tools/check-release.mjs` ok (ABI MATCH, releaseContracts MATCH); `node tools/observe-ethereum.mjs dist` VERIFIED_DEPLOYMENT, NOT_RUN, productionReady false; `node tools/check-connected-export.mjs` ok (13 files, signing false). The Chromium fixture suite at 1440/390/320 passed 111/111 (WebKit projects not run in this revision). The pinned taste@1 probe passed 16/16 at 320/390/1440.

A Chromium script served `dist/` under the non-loopback host name `steps.test` (mapped to 127.0.0.1) and under 127.0.0.1. On `steps.test` at `#/configuration` there was no "Open local contracts" link, no nav item had `aria-current`, and the text of all three footer items started at the same y (672) at 1440. On 127.0.0.1 the link was present. At 390 on `steps.test`, the primary route finished its live public reads with no page errors and showed "No projects have been created on Ethereum yet." The page was 390px wide with no horizontal overflow, and the footer items were stacked at full width. This used real public RPC transport from this machine, not the hosted origin.

## Delivery and remaining limits

[final-assets.json](final-assets.json) hashes every final static asset, the three ABIs, deployment evidence, RPC policy and the handoff itself. The handoff inventories every other export file; its own digest is kept externally to avoid a self-hash. [chain-report.json](chain-report.json) also hashes the full source and ABI inventory. Current changes and the complete payload/bundle size are recorded separately with the delivery evidence.

Only the deploymentVerification gate is promoted to PASS. Security review, runtime-child service acceptance, manifest compatibility and gas ceilings stay OPEN; live execution and all profiles stay NOT_RUN. No profile PASS is inherited without matching actual evidence. Missing/underfunded callbacks, unsupported authenticated result shapes and permanent failures retain the documented liveness risks; there is no timeout, admin unlock or refund promise. The known local gas witness is not promoted into a universal/live gas bound.

The static export is ready for IMD's GitHub/IPFS/site review and hosting pipeline. Actual publication, exact website commit, actual URL/CID and that hosted origin's availability/hash/CORS check remain unobserved until the service returns them. No substitute site, demo primary route, computed-but-unpinned CID, made-up URL or hosting-success claim is supplied.
