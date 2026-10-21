> Current English platform results are in [PLATFORM-UX-V1](validation/platform-ux-v1/README.md). The retained matrix below is historical integration evidence, not a new platform run.

# Acceptance matrix and unresolved issues

**Overall: INCOMPLETE. `productionDeployment: null`, `liveCompatibility: NOT_RUN`, `productionReady: false`.**

There are three kinds of evidence. They are kept apart and never merged:

- **Fixture UI:** the W1 app driven against its simulated `FixtureAdapter` (`#/demo` and the harness). This checks UI behavior only. No chain, no contracts.
- **Actual local contract:** the production `dist/` driven in a real headless browser on a disposable Anvil chain. The final Solidity is deployed by `frontend/scripts/local-setup.mjs`, with `MockToken` and `MockIntake` installed at the fixed addresses. A named EIP-6963 test wallet signs the SDK's unsigned transactions with two temporary Anvil accounts. A scripted mock writer sends callbacks and serves deterministic Markdown/HTML/PNG bytes. This is not a CLI replay or a fixture adapter: every wallet transaction is a real local transaction, and the post-run audit re-encodes each one with the Node SDK and checks its receipt.
- **Real IMD:** the live IdentityMD Intake, a real worker and real IMD. **Nothing in this category has run.** No real IMD contract-payer continuation (`job.continue` paid by a Branch) has been tested.

## Browser-to-contract matrix

The case names are the runner's names (`frontend/tests/integration/browser-chain.mjs`).

| # | Case | Fixture UI | Actual local, Chromium (this pass, 2026-10-21) | Actual local, Chromium (earlier) | Actual local, WebKit (earlier, 5 groups) | Real IMD |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Public config closed; local reads without wallet; EIP-6963 selected provider | PASS (`live mode fails closed…`, `EIP-6963 named browser wallet…`) | PASS | PASS | PASS | NOT_RUN |
| 2 | Create / propose / explicit sponsor / bind / read Markdown; alternate funder updates | PASS (`create root branch…`, `propose, sponsor with exact allowance (account B)…`) | PASS | PASS | PASS | NOT_RUN |
| 3 | HTML R1 → PNG R2 → HTML R3: R3 continues R2, selects R1 HTML + R2 image, provenance untouched | PASS (`two accounts execute all six functions…HTML-image-HTML…`) | PASS | PASS | PASS | NOT_RUN |
| 4 | Fork a non-head accepted R1 exactly; child opens, then continues with separate sponsorship | PASS for the fork asset copy (`fork an accepted historical checkpoint…`) | PASS | PASS | PASS | NOT_RUN |
| 5 | Multiple current proposals, explicit older selection, missing callback, reload with corrupt/missing journal | PASS (`missing callback stays pending…`, `unknown purchase reconciles…`) | PASS | PASS | PASS | NOT_RUN |
| 6 | Authenticated status 1 → explicit identical-body paid retry; corrected raw binding without repurchase; stale anchors | PASS (`…refused retry; bad binding resubmits without repurchase…`, `stale proposal resubmission…`) | PASS | PASS | PASS | NOT_RUN |
| 7 | Exact allowance and fresh price/maxFee checks; double-click and signature rejection | PASS (`refused retry goes through a fresh fee/spender review…`) | PASS | PASS | PASS | NOT_RUN |
| 8 | Account/network changes invalidate prepared signing; no purchase | PASS (`account and network changes invalidate…`) | PASS | PASS | PASS | NOT_RUN |
| 9 | Purchase signature rejection and double-click send exactly one paid attempt | PASS (`create root branch…double click sends one signature`, `…sign rejection…`) | PASS | PASS | PASS | NOT_RUN |
| 10 | Authenticated status 2 and unknown failure freeze permanently | PASS (`…status 2 freezes`) | PASS | PASS | PASS | NOT_RUN |
| 11 | Pending hash/nonce saved before wait; missing/corrupt journal uses pending nonce; replaced tx reconciles without rebuy | PASS for the unknown/reload part only | PASS | PASS | PASS | NOT_RUN |
| 12 | Same-call replacement recovers the authenticated attempt; status 1 retry uses chain truth despite the original journal | NOT_RUN (no fixture case) | PASS | PASS | PASS | NOT_RUN |
| 13 | Tampered/unavailable/oversized files; malicious Markdown/HTML preview; mobile keyboard/focus | PASS (`malicious files stay isolated…`, `preview navigation, forms…inert`, `an unavailable output…`, `keyboard…`) | PASS | PASS | PASS | NOT_RUN |
| — | Browser runtime cleanliness (no page errors or external requests) | n/a | PASS (0 page errors, 0 unexpected requests) | PASS | **FAIL**: 3 loopback RPC page errors in the original recovery/payments/failures runs; instrumented reruns were clean ([browser-diagnostics.json](validation/integration/acceptance/browser-diagnostics.json)) | NOT_RUN |

Totals:

- **This pass:** 80 wallet submissions, 78 successful original receipts and 2 deliberately dropped originals. By operation: 12 createProject, 19 propose, 20 approve, 16 sponsor, 2 retry, 10 bind, 1 fork. The trace audit gave PASS. The chain recorded 17 paid MockIntake requests. Per case, the purchase count rose only in cases that ran `sponsor`/`retry`. Create, propose, fork and bind never added one, and case 8 added no transaction at all. The operation counts include the dropped originals.
- **Earlier WebKit:** 85 submissions, 83 receipts and 2 dropped.
- **Fixture suite:** 120/120 earlier across chromium-desktop/mobile/narrow and webkit-desktop/mobile ([fixture-summary.json](validation/integration/acceptance/fixture-summary.json)). This pass reran only chromium-desktop: 24/24.

Raw evidence:

- This pass: [documentation/](validation/integration/documentation/README.md). Earlier: [acceptance/](validation/integration/acceptance/README.md), which holds `chromium/`, `webkit-*/` and `matrix.json`.
- Each `browser-chain.json` records SDK calldata, original hashes and nonces, receipts and logs, the mock writer trace, the generated config and per-case purchase counts before and after.
- Screenshots: the `screenshots/` folders and `fixtures/screenshots/`.
- Exact file bytes: `acceptance/chromium/files/`.

## Build, SDK and core checks

| Check | This pass (2026-10-21) | Earlier evidence |
| --- | --- | --- |
| `forge build` | PASS | [acceptance/forge-build.log](validation/integration/acceptance/forge-build.log) |
| Seeded `forge test` | **125 passed, 0 failed, 0 skipped** | same count |
| `forge fmt --check` | PASS | PASS |
| `node --test test-sdk/*.test.mjs` | **39 passed** (includes the 27 A1 baseline tests) | 39 |
| Inline fixture integrity | PASS | PASS |
| `tools/check-release.mjs`, `generate-sdk-abi.mjs --check` | PASS (ABI SHA-256 digests match `local-config.json`) | PASS |
| Frontend typecheck / unit / build | PASS / 30 passed / PASS | same |
| Static export reproducible | Rebuilt `dist/` byte-identical to the committed export | 8/8 files identical |
| Generated local config | Config generated from a fresh deployment equals `frontend/public/local-config.json` and `dist/local-config.json` | [release-consistency.json](validation/integration/acceptance/release-consistency.json) |
| Node ↔ browser SDK parity (calldata, witness/hash, manifest keccak, file SHA-256; malformed/Unicode/duplicate/limit rejection) | Not rerun in a browser; Node side covered by `test-sdk/browser-sdk.test.mjs` | Chromium + WebKit PASS, 25 accepted + 37 rejected vectors ([sdk-browser-chain.json](validation/integration/acceptance/sdk-browser-chain.json), [sdk-webkit-chain.json](validation/integration/acceptance/sdk-webkit-chain.json)) |
| Final source hashes | All 217 entries of [final-sha256.json](validation/integration/acceptance/final-sha256.json) matched before the docs edit | — |

## Review outcomes

- **A1 core:** the independent reviews and repairs that the pinned patch delivered are recorded in [validation/review-fixes/](validation/review-fixes/README.md) and [REVIEW.md](REVIEW.md).
- **Integration:** the worker review is in [acceptance/review.md](validation/integration/acceptance/review.md). Its one High finding is fixed: browser redirects are now always refused. Its Medium metadata finding is fixed too. The Medium WebKit RPC diagnostic is **open**.
- **Fresh independent contributor review of the integration:** **NOT_RUN**. This documentation pass reran checks; it did not review the code.

## Unresolved issues

1. **Finite-manifest liveness (retained by design).** An authenticated `result.json` that is valid for IMD but exceeds the bounded parser limits ([LIMITS.md](LIMITS.md)) can never bind. That Branch stays at `ResultRecorded`, and its fee is spent. There is no admin unlock, timeout, rewrite, refund or automatic retry. The only way forward is to fork earlier accepted history.
2. **Missing callbacks.** A Branch whose callback never arrives stays `Pending` indefinitely.
3. **Live compatibility NOT_RUN.** The three fixed profiles, their `steps[].inputs`/`outputs` shapes and the HTML input-budget assumptions have not been checked against the live IMD catalog or runtime. A future check needs a separately authorized, funded test following [LIVE-VALIDATION.md](LIVE-VALIDATION.md).
4. **No public deployment or config.** `#/` stays closed. A deployer must verify the chain, the Intake/IMD code, prices and artifacts, and must configure trusted HTTPS artifact locations.
5. **Browser trust limits.** Browsers cannot see DNS answers or the connected IP. Approved hosts are a trust decision, and redirects are refused.
6. **WebKit RPC page error** (Medium, open, root cause unknown). See above.
7. **Not tested:** physical wallets and extensions, Coinbase Smart Wallet passkeys, physical phones and Safari, screen readers, 200% zoom and RTL, long histories, pruned RPCs and reorgs, and real IMD admission, execution, callback, Git and publication.
