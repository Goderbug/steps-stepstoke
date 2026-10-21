# Final check results

| Check | Status | Count |
| --- | --- | --- |
| Production build | PASS |  |
| TypeScript typecheck | PASS |  |
| Foundry baseline and build | PASS | 125 |
| Node SDK suite (includes patched 27-test baseline) | PASS | 39 |
| W1 and provider/capability unit tests | PASS | 30 |
| Chromium fixture/UI regressions at 320/390/1440 | PASS | 72 |
| Actual W1 browser/local-contract acceptance | PASS | 12 |
| Node/browser encoding, witness, manifest and file hash parity; Unicode/duplicate/malformed/limits | PASS |  |
| Independent output-directory rebuild equals delivered export | PASS |  |
| Explicit local mock-delivery utility walkthrough | PASS |  |
| Better Interface / taste@1 | PASS | 16 |
| Source/ABI/config/lock/runtime asset structural audit | PASS | 32 |
| Independent contributor review of this frontend integration | NOT_RUN |  |
| WebKit interaction/rendering | NOT_RUN |  |
| Physical wallets/devices, Coinbase passkeys, native screen reader, reorg/long-history behavior | NOT_RUN |  |
| Real IMD admission/execution/callback/Git/publication and public deployment | NOT_RUN |  |

## Requested local matrix

All actual-local rows use the built W1 UI, final SDK/ABI/contracts, two temporary accounts, local mocks and deterministic real bytes. Real IMD remains NOT_RUN for every row.

| Item | Actual local | Real IMD |
| --- | --- | --- |
| Public config closed; local reads without wallet; EIP-6963 selected provider | PASS | NOT_RUN |
| Create / propose / explicit sponsor / bind / read Markdown, alternate funder update | PASS | NOT_RUN |
| HTML R1 -> PNG R2 -> HTML R3 continues R2, selected exact bytes and retained provenance | PASS | NOT_RUN |
| Fork non-head accepted R1 exactly; child opens then continues with separate sponsorship | PASS | NOT_RUN |
| Multiple current proposals, explicit older selection, missing callback, reload with corrupt/missing journal | PASS | NOT_RUN |
| Authenticated status1 explicit identical-body paid retry; corrected raw binding without repurchase; stale anchors | PASS | NOT_RUN |
| Exact allowance and fresh price/maxFee checks; double-click and signature rejection | PASS | NOT_RUN |
| Account/network changes invalidate prepared signing; no purchase | PASS | NOT_RUN |
| Authenticated status2 and unknown failure freeze permanently | PASS | NOT_RUN |
| Pending original hash/nonce saved before wait; missing/corrupt journal uses pending nonce; replaced transaction reconciles without rebuy | PASS | NOT_RUN |
| Same-call replacement recovers authenticated attempt; status1 retry uses chain truth despite original journal | PASS | NOT_RUN |
| Actual local file tampering/unavailability/stream bound; malicious preview and mobile keyboard/focus | PASS | NOT_RUN |

Browser wallet submissions: 71; mined successful originals: 69; dropped originals: 2. Original hashes and replacement controls are retained in the raw evidence.

Production readiness remains false. Independent contributor review and unperformed environments remain incomplete. See `review.md` for six-domain coverage, findings/fixes and concrete limitations.
