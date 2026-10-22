> Historical report: its archive is now retained byte-for-byte at the pinned original candidate commit `b7747bf377e292f44b35fb0acc55c6ee1772cee4`. See `docs/history/integration-predecessor.json` for its original path, Git blob, length and SHA-256. Retrieve with `git show COMMIT:PATH` into a separate directory before using the historical extraction commands below. This report does not certify LOCAL-REPAIR-V1.

# Documentation revision: reproducibility and evidence

This documentation-only assignment starts from checkout `f2b63705e355cf93046a5d8dfddc569ded5d4048` of the imported STEPS repository. It changes only `README.md` and `docs/`; no runtime, tests, ABI, configuration, dependencies or `dist/` bytes were changed. That checkout ID is an ancestry pin, **not** the final submission commit. Pin the actual accepted final commit as described in [handoff](../../HANDOFF.md). The candidate remains `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`; no mainnet signature, broadcast, deployment, IMD payment, hosting, new order or X post occurred.

## Fresh check commands and outcomes

The local rerun used a byte-exact `git archive HEAD` of the starting checkout in `test/scratch/repro`, so compiler outputs and temporary logs could not alter delivered paths. Forge 1.8.3 (`cae51ad458f6abb64852b7709eb784352429825d`), solc 0.8.26, Node 24.21.0 and Python 3.12.3 were available. Run from a fresh clone with the same toolchain; commands below need no public RPC, secret or frontend package install:

```sh
node tools/build-release.mjs
FOUNDRY_FUZZ_SEED=0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5 forge test
node --test test-sdk/*.test.mjs
node tools/deployment-rehearsal.mjs
node tools/local-integration.mjs --review-fixes
node tools/measure-binding.mjs
python3 tools/verify-history.py --predecessor
python3 tools/check-delivery.py
```

| Check in this documentation run | Outcome | Raw evidence |
| --- | --- | --- |
| Forced full compilation, release ABI/runtime/code checks | **PASS**; 45 compiler inputs, frozen fingerprints matched | `build.log` |
| Seeded Solidity suite, including exact raw-result regressions | **PASS**; 143 passed, 0 failed, 0 skipped, 18 suites | `forge-test.log` |
| Node SDK/CLI tests | **PASS**; 71 passed, 0 failed, 0 skipped | `sdk.log` |
| Empty-chain three-name constructor batch and handoff rehearsal | **PASS** on disposable chain 1 with local test transport; no official launch service | `deployment-rehearsal.log` |
| Seven-round root/child flow with MockIntake, exact allowances, status-1 retry and corrected bind | **PASS**; 43 local transaction records, all five profiles represented | `local-integration.log` |
| Eight finite binding shapes, maximum root/fork | **PASS** under the rehearsal's declared 16,777,216 gas limit | `measure-binding.log` |
| Historical archive and immutable predecessor bytes | **PASS** | `history.log` |
| Delivery paths, hash inventory and size | **PASS** after final docs/manifest generation; result in `../rc-v1/delivery-size.json` | `python3 tools/check-delivery.py` |
| Frontend typecheck/unit/build/browser and screenshot capture **in this docs-only run** | **NOT_RUN**; frontend source and committed export are unchanged. The prior accepted boundary revision reports typecheck/build PASS, 100 unit, 180 fixture browser, 64 actual local browser and 11 public-adapter rehearsal cases. | [Prior raw archive and outcome table](../boundary-revision/README.md) |
| Official paid Intake jobs, mainnet deployment/hosting, live-wallet/device, current CORS, independent security and launch-service acceptance | **NOT_RUN** | No live receipt exists |

There were **zero current test failures**. Earlier reproduced failures and repair logs are retained in the [boundary revision archive](../boundary-revision/README.md) and [history index](../../history/README.md); they are not relabelled as passes for this run. The earlier public-adapter HTTPS transport was locally intercepted, and previous free syntax checks were not live job executions. A later source/export change needs its affected checks rerun.

The fresh unredacted local logs, complete transaction calldata, local receipts and finite gas cases are in [`checks.tar.xz`](checks.tar.xz), SHA-256 `8706e8a53747a5d42da6fd93815df7056ca0b0e670b4bcc8eeea96893490d933`, 52,028 bytes. [`archive-index.json`](archive-index.json) gives each original log's length and SHA-256. Recover without overwriting the candidate:

```sh
mkdir -p test/scratch/docs-evidence
tar -xJf docs/validation/documentation-v1/checks.tar.xz -C test/scratch/docs-evidence
sha256sum docs/validation/documentation-v1/checks.tar.xz
```

The unchanged export's prior rendered screenshots (`shots/home-390.jpg`, `shots/workspace-1440.jpg`, `shots/deployment-unavailable-390.jpg`) and raw browser records are in [boundary-revision `evidence.tar.xz`](../boundary-revision/evidence.tar.xz), SHA-256 `92363a0e39e6d150d2bc941289ab757b688df19ac538f9ebbb069c40076f4112`; its compressed archive index verifies every member. Those are prior observations of the **same unchanged export**, not new screenshots. Its local constructor/receipt and browser reports are historical evidence. [History recovery](../../history/README.md) preserves earlier failures and evidence by archive or verified immutable predecessor commit/path/hash; no future project head was fetched.

## Current source, export and measured limits

[`runtime-export.sha256.json.xz`](runtime-export.sha256.json.xz) inventories the current ordinary runtime, tests, assets and static export by path, byte count and SHA-256 after these checks. Decode it with `xz -dc`. [`docs-hashes.sha256.json.xz`](docs-hashes.sha256.json.xz) separately inventories README and documentation, excluding itself and generated delivery reports so it is non-self-referential. The repository's broader [`source-manifest.json.xz`](../rc-v1/source-manifest.json.xz) and [`delivery-size.json`](../rc-v1/delivery-size.json) are regenerated after final docs. Exact export examples: `dist/index.html` SHA-256 `ab5574aa2c662dcbcd7a6239408eb0372cb9ecf61d74ebf11288657f37755282`; `dist/assets/index-CM7iRyMh.js` `d9bfdafaac16575674c097514144a421e4046c63128469d6c58a1a93f3d89cea`; all eight files appear in the manifest. `dist/imd-deployment.json` and `launch.json` are absent.

| Contract | Runtime bytes | Raw initcode bytes |
| --- | ---: | ---: |
| RelayFactory | 21,195 | 21,475 |
| RelayBranch (runtime child) | 12,876 | 16,219 |
| RelayEncoder | 12,020 | 12,046 |
| RelayVerifier | 14,719 | 14,745 |

The local atomic batch used **10,509,092 gas**. The maximum-goal root used **3,419,527**; the 16-asset historical child fork **4,653,112**; and the largest of eight binding shapes, maximum escaped key bytes, **13,579,287** gas with 46,116 calldata bytes. These are actual disposable Prague/MockIntake receipts and finite cases, not live service gas ceilings or a universal input bound. The real Intake callback sends a digest/URI; MockIntake's completion call carries the raw manifest, so its outer gas is not a live-service estimate. The full raw measurement/calldata and receipts are in this revision's archive. EIP-170/EIP-3860 size checks pass locally; final launch-service simulation and runtime-child policy acceptance remain open.

The starting tracked payload measured **8,276,274 bytes** before this documentation pass. The final tracked payload size, file count and 8,388,608-byte limit are recorded by `../rc-v1/delivery-size.json`; it excludes `.git`, provided `.imd` inputs, compiler caches, `node_modules` and `test/scratch`. The delivery checker verifies historical archive members, source/export inventory and unchanged protected paths. It is a local integrity check, not independent behavior certification.

## Release blockers beside the evidence

- Independent final security review, explicit runtime-created full Branch acceptance by the launch service, its actual calldata/gas simulation limits and a canonical three-name deployment are still open. The protected mechanical floor and empty-chain rehearsal do not grant service acceptance.
- Real authenticated result envelopes and materialized HTML/PNG inputs for every profile, especially HTMLUpdate, have not been shown in a paid STEPS job. Existing exact public snapshots and free checks have narrower claims. The candidate's 32,768-byte raw JSON/complexity and 1,024-byte URI limits may leave an authenticated result unbindable or callback undelivered.
- A missing callback stays Pending. Only Intake's authenticated status 1 permits an explicitly reapproved, separately paid identical-body retry; status 2/unknown freezes. Bad binding cannot rebuy. There is no refund, admin recovery or HTTP/Git settlement.
- Official actions and Intake/IMD addresses are compiled in; if the catalog/price/service changes, existing Branches cannot be retargeted. `priceOf` must be read immediately before later spending. Browser CORS, real wallets, archival RPC/trace availability, bounded indexing and transaction replacement observation remain practical limits.

The [two-job pilot and seven-job acceptance proposal](../../LIVE-VALIDATION.md) are **NOT_RUN** and require separate authorization. Neither free preflight nor admission guarantees execution, callback, binding or publication. This documentation change does not authorize another order.
