# Multi-file result revision

Worker validation of the revision from exact imported commit `1c5a3339f09b98516fe3f364147acce0b8c55b9c`. No future project head was fetched. This is development evidence, not independent security approval or live compatibility evidence. `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`.

The unchanged supplied proof first failed with `Invalid()`. The revised verifier selects the unique declared output among extra files while authenticating the complete original bytes. Only that descriptor enters the checkpoint. SDK selection requires proposal context for multi-file results, and browser history reads that stored proposal. No payment, callback, retry, checkpoint or lineage transition was changed. Missing, ambiguous, oversized or over-complex results remain unbindable without another purchase right. All three finding responses are in [`.imd-responses.json`](../../../.imd-responses.json).

## Actual final checks

| Check | Result |
| --- | --- |
| Forge build and seeded full suite | PASS: 146 tests / 20 suites; 143 delivered tests plus the unchanged supplied proof and two scratch advisory tests |
| Supplied multi-file proof | Starting source FAIL; final source PASS |
| New contract regressions | PASS: exact captured two-file result, independent historical child, 4/17-file ordering, collisions, malformed metadata, ignored-entry tampering and no repurchase |
| Node/browser SDK units | PASS: 71 tests, including exact captured fixture parity and contextual multi-file selection |
| Frontend typecheck / unit / production build | PASS / 83 passed / PASS |
| Final static browser matrix | PASS: 180 cases, 36 in each of all five configured projects; zero skipped, unexpected or flaky cases |
| Actual local contract browser matrix | PASS: all 16 journeys on Chromium desktop/mobile and WebKit desktop/mobile, 64 total; zero unexpected page/console/network errors |
| Public adapter rehearsal | PASS: five checks on actual disposable chain-1 contracts with intercepted HTTPS; two listed files produce one accepted asset, verified reads/downloads without wallet, paid UI closed |
| Constructor, bytecode, source/ABI/config checks | PASS: actual atomic batch, source/immutable verification, supplied opcode/size floor and synchronized release fingerprints |
| Gas measurements | PASS for the eight sampled stress shapes and full local transactions; service ceilings/global bound remain OPEN |
| Pinned taste@1 probe | PASS: all 16 checks after the final build; 320/390/1440 reflow measured |
| Long history | PASS: synthetic 32-checkpoint keyboard selection and no horizontal page overflow at 1440/390/320 |
| History and delivery integrity | Verified archive members, predecessor commit/path/blob/SHA-256 references, source/export inventory and the 8 MiB payload guard |

The browser projects are Chromium desktop 1440×900, mobile 390×844, narrow 320×844, WebKit desktop 1440×900 and mobile 390×844. Actual local journeys retain their original safety assertions, including reverted/replaced transaction journals versus authenticated refusal, unknown original-hash recovery, exact approval before purchase, price/allowance/account/network changes, cancelled preparation, duplicate clicks, missing callbacks, status-2/unknown freezes, historical fork and safe exact-byte file downloads. The first local Markdown journey additionally binds and reads 2/17-file results with exactly two explicitly funded rounds and one accepted asset.

All browser interactions are automated emulations. Physical devices, real wallet/passkey sessions, native screen readers and browser-native zoom are **NOT_RUN**. The supplied browser MCP could not initialize because its Chrome distribution was missing; installed Playwright 1.64.1 performed the actual browser work. WebKit used a disposable software-rendering launcher and native libraries outside the repository. No browser binary, dependency/cache directory, registry mirror or new dependency archive is delivered.

## Reproduction and commands

```sh
forge build
FOUNDRY_FUZZ_SEED=0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5 forge test
node --test test-sdk/*.test.mjs
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
node frontend/tests/integration/browser-chain.mjs --browser chromium
node frontend/tests/integration/browser-chain.mjs --browser chromium --mobile
node frontend/tests/integration/browser-chain.mjs --browser webkit
node frontend/tests/integration/browser-chain.mjs --browser webkit --mobile
node frontend/tests/integration/public-chain.mjs
node tools/local-integration.mjs --review-fixes
node tools/measure-binding.mjs
node tools/deployment-rehearsal.mjs
node tools/check-release.mjs
python3 tools/verify-history.py --predecessor
python3 tools/check-delivery.py
```

Frontend commands ran in a `/tmp` mirror with the unchanged pinned manifests. Browser paths/report destinations were selected through the existing test runner environment options. The public handoff/importer rehearsal used a separate temporary Git object store containing the exact compiler inputs, so source-commit verification remained real without editing this repository's `.git/`. It is a test identity, not a production deployment. The public browser rehearsal temporarily inventories its local handoff; the final clean Vite build removes it. Root `dist/` contains eight files, relative assets/hash routing and no public deployment handoff, public deployment evidence or `launch.json`. Its explicit `LOCAL_DEPLOYMENT` configuration records disposable loopback addresses and cannot configure a public deployment.

The pinned probe ran from the repository root using an explicitly selected installed Playwright module:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste-final
```

## Findings, repairs and retained failures

- **High, `src/RelayVerifier.sol:35` / `:58`:** the exact supplied two-file proof reached ResultRecorded then reverted on binding. Unique name/path selection fixes the cause; partial identity collisions reject. The complete raw envelope remains keccak-bound. `test/MultiFileResults.t.sol` also replays the captured HTTP bytes and proves a historical child can inherit the accepted snapshot.
- **Affected read path, `sdk/core.mjs:295`, `frontend/src/domain/chainAdapter.ts:154`:** the SDK also assumed one file. It now accepts the actual proposal or `{name,path}` context, refuses to guess without it, and preserves existing single-file calls. The adapter fetches the bound attempt's proposal before parsing history. Node/browser units, two adapter unit cases and all four actual local browser runs recheck this path.
- **Advisories:** repeated deterministic status 1 remains Refused and charges for each identical explicit retry; an unpriced compiled-in action reverts FeeExceeded before a transfer/request. Both were reproduced as required no-admin semantics and disputed as code changes. [REVIEW.md](../../REVIEW.md) now states the consequences directly.
- **Initial browser run:** 179/180 passed, with one Chromium first-Tab focus assertion failure. The same assertion passed five fresh reruns and the final 180-case matrix. No assertion or focus behavior was weakened or changed. The initial log, full Playwright report and error context remain in the archive.
- Initial development/harness failures are retained: a reserved Solidity test-local name, compiler stack depth repaired by the private selection helper, expected-revert setup order, JSDOM/Node typed-array realm mismatch in a new unit harness, a duplicated test-local name, incomplete mirror setup and a grep selecting zero tests. Final reruns above passed. The existing Vite mixed-import warning remains visible; it does not prevent the build.

## Better Interface review

The existing Open Workshop visual system and artwork were preserved. Root [DESIGN.md](../../../DESIGN.md) documents the implemented source tokens and components. The one visual idea remains an ordered project sequence leading to a complete selected output and its next action, with technical proof in disclosures.

| Domain | Coverage and result |
| --- | --- |
| Accessibility | Checked native controls/names, first-Tab skip link, sheet focus trap/return, Escape, wallet states, keyboard history selection, reduced motion and touch targets. Native screen-reader/zoom sessions NOT_RUN. |
| Layout | Inspected actual 390px home and 1440/390px workspace screenshots; primary home action visible at 390. Automated 320/390/1440 reflow and 32-checkpoint checks report zero page overflow. Existing phone history uses a two-column vertical grid, so long histories require scrolling. |
| Writing | Candidate absence, pending/unknown callbacks, unbindable results and explicit identical paid retry remain truthful beside affected controls. New SDK errors describe missing/ambiguous output. Current instructions remain English; historical technical/content identifiers are preserved. |
| Typography | Existing six-step scale, system font stacks, wrapped full hashes, source labels and provenance retained. Narrow verified-file evidence remains readable; producer HTML typography is isolated content. |
| Colors | Final probe measured rendered root text against its actual backgrounds and passed 4.5:1 / 3:1-large checks. Existing semantic colors and text status cues retained; arbitrary producer content is not covered by that contrast claim. |
| UI details | Existing flat surfaces, primary/secondary action hierarchy, approval-before-purchase states, loading/error/read-only controls, isolated HTML/CSP, safe Markdown and natural PNG aspect ratio checked. No new logo, slogan, motion system or unrelated redesign. |

No additional reproduced design defect required a visual source change. Attribution and the pinned MIT/Apache notices remain in `frontend/docs/licenses/`. A narrow viewport is not native zoom, and emulated mobile checks are not physical-device evidence.

## Measurements and open limits

Verifier runtime is **14,719 bytes** (175 bytes larger); its initcode is 14,745 bytes. Factory/Branch/Encoder runtimes remain 21,195 / 12,876 / 11,498 bytes. The three named constructor batch used 10,395,917 gas. Sampled full root/fork creation used 3,419,527 / 4,653,154 gas; the full-witness child's initcode was 30,875 bytes.

Local UI multi-file binds used 744,275 gas for two entries (428 raw bytes) and 1,626,294 for seventeen (1,910 raw bytes), including transaction intrinsic/calldata costs. The largest of the eight full-witness stress binds used **13,579,287 gas**. Declared limits and full calldata are retained separately; all measured transactions satisfy the 16,777,216 declared-limit check. These finite shapes do not establish a global maximum or the launch service's unpublished ceiling. MockIntake purchase/completion costs differ from live Intake.

The raw 32,768-byte limit and every JSON complexity bound remain unchanged. Recorded invalid results cannot rebuy. Missing callbacks remain pending; status 2/unknown freezes. Refusal and catalog migration risks remain intentional constraints. Authorized live profile execution, independent final security review, service child-policy/gas acceptance and a confirmed deployment remain open. Disabled paid UI is not a claim that permissionless contracts prevent direct calls. No hosting, public-chain signing/broadcast/deployment/spending, paid IMD call, extra order or X post occurred.

## Exact evidence and recovery

`summary.json` gives actual counts and final export hashes. `evidence.tar.xz` retains current raw result/file/calldata bytes, all local receipts and browser reports, initial failure evidence, the exact supplied proof, advisory reproduction source, measured gas and final source/test/export SHA-256 inventory. Log/reporter filesystem paths are normalized; authenticated manifest, file and calldata bytes are unchanged. Passing intermediate progress files and redundant screenshots are omitted. Selected screenshots are under `shots/` inside the archive.

`archive-index.json.xz` is losslessly compressed JSON with every member's path/byte length/SHA-256 and the complete archive digest. Extract to a separate directory with `tar -xJf evidence.tar.xz -C <directory>`; decode the index with Python `lzma.decompress`. `tools/check-delivery.py` verifies every member. Earlier evidence is recoverable through [history](../../history/README.md), including every original failure/test record. The current global source/export manifest and exact payload size are in `../rc-v1/source-manifest.json.xz` and `../rc-v1/delivery-size.json`.

Complete for this revision's local implementation and validation scope. Production readiness remains false.
