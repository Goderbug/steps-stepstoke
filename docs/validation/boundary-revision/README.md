# Public boundary and clean-build revision

Worker-local evidence for the revision of `61c829259507587220062d62ef5120beb0781deb`. These checks are not independent security approval or production evidence. The candidate remains **productionDeployment: null**, **liveCompatibility: NOT_RUN**, **productionReady: false**. The Open Workshop design, six operations and all Solidity source/ABI signatures are preserved.

## Final results

| Check | Actual result |
| --- | --- |
| Clean full compilation | Two separate cache-free builds, 45 repository inputs, Forge 1.8.3 / solc 0.8.26; identical contract fingerprints and immutable metadata |
| Strict release / embedded ABI / opcode checks | PASS; no forbidden reachable application/child opcodes; protected configuration unchanged |
| Solidity | 143 passed, 0 failed, 18 suites; includes all five exact-source multi-file cases |
| Node SDK | 71 passed, 0 failed |
| Frontend typecheck / unit / production build | PASS / 100 passed / PASS |
| Existing fixture browser matrix | **180/180**, 36 existing cases in each of all five configured projects; all requested legacy cases and safety assertions retained |
| Actual local contract journeys | **64/64**: all 16 journeys in Chromium/WebKit desktop/mobile; browser runtime, unexpected page/console/request checks pass |
| Actual chain-1 public adapter rehearsal | **11/11**; real candidate contracts, actual importer/handoff and read-only HTTPS intercepted to an owned disposable node |
| Preview readiness regression | **32/32** repeated WebKit desktop/mobile interactions after the fixture readiness correction |
| Pinned taste probe | **16/16** on final root `dist/` |
| Rendered review | 320/390/768/1440, 32-checkpoint rail, keyboard selection, focus, wallet states, reduced motion, metadata/X and gateway subpaths checked |
| History integrity | All archive members and immutable predecessor references byte-verified |

The repository already contains 36 fixture cases per browser project. None was removed to match the brief's count of 35. The actual contract journeys additionally assert that cancellation and same-call replacement views preserve both hashes and that there is one authenticated replacement attempt. Local setup regenerates its loopback configuration for each disposable chain; each report retains that configuration and its receipts. Final application JS/CSS/HTML/image bytes are the same across the rehearsals and final export. Temporary public handoff/ABI evidence is test setup and is removed by the final clean Vite build.

The supplied browser tool could not initialize its Chrome distribution (**NOT_RUN**). Installed Playwright ran every browser project above. WebKit uses a disposable software-rendering launcher outside the repository. Physical devices, real wallet/passkey sessions, native screen readers and browser-native zoom are **NOT_RUN**; emulated widths do not establish them. Unexpected errors remain visible and fail the checks. The public rehearsal retains its deliberately aborted artifact request and console diagnostic as an expected, exact-URL transport failure.

## Findings and repairs

- `8040aeecc4a9`: reproduced the unchanged adapter resolving an empty project list after verification when RPC chain changed to 31337. `frontend/src/domain/chainAdapter.ts:89` now repeats full SDK deployment verification at public list/Branch boundaries, sharing only concurrent checks. Failure revokes capabilities and replaces the event cache. `frontend/src/ui/LocalApp.tsx:41` cancels/removes query data, clears file observations and unmounts stale output/preparation. Only explicit successful re-verification restores the deployment. The actual chain-1 rehearsal changes chain, Encoder code and canonical deployment receipt at both 1440 and 390; accepted output disappears and recovery succeeds. No wallet or implicit switch is involved.
- `998665a673ef`: reproduced the complete clean build rejecting the 11,498-byte frozen Encoder. The intended full build produces **12,020 runtime / 12,046 initcode bytes**, runtime keccak `0xae8388a986e56b5f750aa15b291cbd9402166f1315c71ce9704dca7c7f28ddc6`, creation hash `0x17851ae68096e2ce6ef106cb75cd75647dece459039e59d5e46bb5f266c3bbe8`. `tools/compilation-context.mjs`, `tools/build-release.mjs`, strict checker and explicit re-freeze now bind all repository compiler inputs, source IDs, generated-helper context and Forge version. No settings, dependencies or Solidity were changed. A separate clean compilation and actual named constructor/importer rehearsal pass; SDK/CLI/frontend use the synchronized release configuration.
- `a584e9c36ce3`: reproduced loss of original hash `a1` after a successful same-call replacement `b2`. `chainAdapter.ts:229` correlates account, nonce, destination and calldata; the single authenticated attempt retains original `txHash`, replacement hash and observation. `Workspace.tsx:117` labels both hashes separately. Unit projection/rendering and all four actual browser journeys assert the identities and no duplicate attempt.
- `ade281f4d1f3`: reproduced a one-confirmation cancellation being treated as final and unblocking preparation. `chainAdapter.ts:324` now observes every public replacement using canonical receipt/depth checks before a final outcome. One/eleven confirmations, a missing receipt or reorg remain unresolved and retain the original hash. Twelve-confirmation status-0/status-1 cancellations can become final journal failures; an authenticated status-1 refusal alone remains the retry authority.
- `8bb323f8a866`: not reproduced. Nine isolated unchanged Chromium runs and all final browser projects pass the original first-Tab assertion. The first-Tab test body is byte-identical to the accepted baseline; another fixture in that file waits for its loaded preview before its callback control. Skip-link, ring, trap and focus-return assertions remain intact.
- Informational multi-file confirmation and refusal/catalog risks: accepted as existing behavior. No contract change was requested or made. Existing `REVIEW.md` warnings and exact-source tests remain.

`.imd-responses.json` answers every supplied ID individually.

## Initial failures and observed harness repairs

The first full fixture matrix was **173/180**: five failures came from this revision temporarily renaming the original hash copy control; the established accessible name was restored without weakening its assertions. Two WebKit cases also failed during asynchronous preview rendering. A subsequent matrix was **178/180**, reproducing two WebKit readiness failures; neither is relabelled a pass.

Instrumented repeat runs reproduced the disclosure failure (**31/32 passed**). In the failed document-event trace, the last document click opens the child route; the supposed disclosure click never reaches the parent document while the arriving iframe occupies the previous loading area. The output is verified by the final snapshot, but the disclosure remains closed. A short loading line grows into a complete preview, so controls below it can move while the test is clicking.

`frontend/tests/e2e/actions.ts:6` now waits for preview loading to finish, and for the verified download control when applicable, before body-level clicks. Modal controls keep their own readiness. The historical-fork fixture additionally waits for the child's verified download before clicking its table disclosure. A subsequent 179/180 run exposed the same condition in showcase funding, and another 179/180 run exposed it in the post-reload callback control. Those controls and the shared workspace helper now wait for the verified download as well. The showcase case passes 16 repeated WebKit runs; the latest full matrix passes 180/180. All original safety/interaction assertions remain; there is no retry, forced click, timeout increase or application payment/layout change. The corrected cases pass 32 repeated runs, followed by the complete **180/180** matrix. The first-Tab test was not modified for this separate issue.

A final projection check also reproduced duplicate journal hints when a hash used uppercase hex. The comparison now uses case-insensitive hash equality, with a dedicated regression. Initial negative unit reproductions, incomplete synthetic handoff/account setup, empty fixture-attempt setup and an incorrect diagnostic `expect` import are retained with their logs. Their harness corrections and final passes are separate. The Vite mixed static/dynamic import warning remains visible; the build passes. Compiler warnings remain in both clean-build logs. No current failure/test record is replaced by an historical pass.

## Better Interface review

The implemented visual idea remains an ordered project sequence leading to a complete selected output and its next action; technical evidence sits in native disclosures. The pinned workflow and all six domain principles were applied. Root `DESIGN.md` records the source tokens, typography, spacing, components and responsive rules. Existing marks, artwork and historical content are preserved.

| Domain | Coverage, finding and outcome |
| --- | --- |
| Accessibility | Native controls, full hash/copy names, first-Tab skip link, keyboard selection, visible focus, modal trap/Escape/return, wallet states and reduced motion checked. The temporary copy-name regression at `Workspace.tsx:117` was repaired. Native screen-reader and native zoom sessions NOT_RUN. |
| Layout | Actual 390 home, 1440 selected full output and 390 unavailable-state screenshots inspected. Primary action is on the first 390 screen. 320/390/768/1440 checks and the 32-checkpoint rail report no host overflow. Desktop rail scrolls internally; mobile keeps its existing two-column vertical grid. Async previews grow to content height; fixture readiness now accounts for that observed growth. |
| Writing | Candidate absence, failed deployment verification and explicit recovery are truthful. Replacement identities/outcomes are labelled beside their attempt. Missing callbacks, invalid binding, separate approval/purchase and identical paid retry remain explicit. Current UI/instructions remain English; authenticated content/identifiers stay unchanged. |
| Typography | Existing six-step scale, Arial/Helvetica and evidence monospace, 400/600 weights, complete wrapping hashes and full file provenance retained. No new font or type style. |
| Colors | No token changes. The final homepage probe reports all measured text at 4.5:1, or 3:1 for large text. State has explicit text. Arbitrary producer content and every possible state are outside that measured contrast claim. |
| UI details | Existing flat surfaces, primary-action hierarchy, separately confirmed approval/purchase, safe Markdown, isolated HTML/CSP, exact downloads and natural PNG ratio checked. No new logo, slogan, animation system or admin control. Public failure removes the affected workspace instead of leaving stale accepted output visible. |

Attribution and the pinned MIT/Apache notices remain in `frontend/docs/licenses/`. These finite checks are not a universal accessibility or live-wallet certification.

## Fresh sizes, gas and remaining gates

| Contract | Runtime bytes | Initcode bytes |
| --- | ---: | ---: |
| RelayFactory | 21,195 | 21,475 |
| RelayBranch | 12,876 | 16,219 |
| RelayEncoder | 12,020 | 12,046 |
| RelayVerifier | 14,719 | 14,745 |

The actual three-name constructor batch used **10,509,092 gas**. Maximum-goal root creation used **3,419,527**; the full 16-asset historical fork used **4,653,112**, with child initcode 30,875 bytes. The largest of eight finite binding shapes used **13,579,287**. Raw calldata, manifests and receipts are retained. These are disposable Prague/MockIntake measurements within a declared 16,777,216 limit, not a universal maximum, current public block-policy observation or live Intake cost. The service's actual launch/child-policy/byte/gas acceptance remains open.

Full public read verification needs historical code and CREATE traces and adds RPC work. A changed compiler input set or toolchain requires an authorized re-freeze and later deployment byte comparison. Twelve confirmations are an application observation policy, not consensus finality. CORS/redirect/unavailable artifact cases are mocks/intercepted local transport here; prior official observations remain historical. Live profile execution, current public endpoint availability, physical wallets, final independent security review and actual deployment verification remain open.

Existing raw/JSON complexity limits can still leave a result permanently unbindable. Deterministic refusal can charge repeatedly for identical retries, and a withdrawn compiled-in catalog can strand branches. Missing callbacks stay pending; status 2/unknown freezes. No new recovery authority is introduced. Disabled UI does not prevent direct calls to permissionless contracts.

## Commands, exact bytes and recovery

Run from the repository root, with the existing pinned dependencies/toolchain:

```sh
node tools/build-release.mjs
FOUNDRY_FUZZ_SEED=0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5 forge test
node --test test-sdk/*.test.mjs
node tools/generate-sdk-abi.mjs --check
node tools/inspect-bytecode.mjs
node tools/deployment-rehearsal.mjs
node tools/sdk-local-check.mjs
node tools/local-integration.mjs --review-fixes
node tools/measure-binding.mjs
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
node frontend/tests/integration/browser-chain.mjs --browser chromium --out test/scratch/local-chromium
node frontend/tests/integration/browser-chain.mjs --browser chromium --mobile --out test/scratch/local-chromium-mobile
node frontend/tests/integration/browser-chain.mjs --browser webkit --out test/scratch/local-webkit
node frontend/tests/integration/browser-chain.mjs --browser webkit --mobile --out test/scratch/local-webkit-mobile
node frontend/tests/integration/public-chain.mjs
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
python3 tools/verify-history.py --predecessor
python3 tools/check-delivery.py
```

Frontend installation/build/checks ran in an external temporary mirror using the unchanged pinned manifests. Browser executable/report paths used the existing runner options. An initial importer rehearsal used a temporary exact-source Git object store. The final public rehearsal authenticates all 45 frozen compiler-input files against the real accepted baseline commit; its attestation remains an explicit local test identity, never production approval. Re-run the clean build after adding temporary Solidity tests; scratch Solidity is not a release input. The taste command uses the supplied pinned review input, which is removed before submission; its actual report remains archived.

`summary.json` gives actual counts and final export hashes. `evidence.tar.xz` preserves raw local result/file/calldata/receipt bytes, final reports, every initial failure report/error context, the failed document-event trace, representative screenshots and current source/test/export SHA-256 inventory. Reporter filesystem paths are normalized; authenticated raw documents/files/calldata are unchanged. Redundant passing progress snapshots, optional trace packaging and duplicate screenshots are omitted. `archive-index.json.xz` losslessly records every member's path, length and SHA-256 plus the archive digest. Extract into a separate directory with `tar -xJf evidence.tar.xz -C <directory>`; decode the index with Python `lzma.decompress`. The delivery checker verifies every member.

The complete prior multi-file archive and imported historical text archive are retained by byte-verified immutable predecessor references described in [history](../../history/README.md), including every original failure/test member. No future project head was fetched. Current payload bytes are measured in `../rc-v1/delivery-size.json`, and `../rc-v1/source-manifest.json.xz` inventories all delivered source/export bytes. Root `dist/` has eight files, relative assets/hash routing and no production handoff, `launch.json`, `node_modules`, caches or registry mirror. No hosting, public-chain transaction/spending, paid IMD call, extra order, artwork commission or X post occurred.
