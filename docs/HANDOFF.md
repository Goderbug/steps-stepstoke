# A1 and W1 handoff and readiness

**This checkout is a local A1 repair candidate; production readiness remains false.** It builds on the original IMD-delivered commit [`9b0294e7ab19060bd00c489fbe032cf248528e0d`](https://github.com/identity-md-launches/launch-2294-build-cto-relay-station/tree/9b0294e7ab19060bd00c489fbe032cf248528e0d), with revised contracts, SDK/CLI and regression tests under policy A1/2. It is not a new IMD delivery or a public deployment. Use [current repair evidence](validation/review-fixes/README.md) for source-specific results. Older validation logs remain historical.

W1 was delivered separately at [`d48bc2117a06c79c3b8545d15eeff2675da94a31`](https://github.com/identity-md-launches/launch-2297-build-cto-relay-station/tree/d48bc2117a06c79c3b8545d15eeff2675da94a31). Its working interactions use fixtures and its real A1 interface remains `A1_INTEGRATION_PENDING`. Connecting and testing that webpage against accepted A1 contracts/SDK is outside this repair. A1's asset, history and payment correctness cannot be deferred to the webpage.

## A1 surface and remaining boundaries

| Surface | Implementation | Remaining boundary |
| --- | --- | --- |
| Create / propose / sponsor | Fixed goal, registered independent Branch payer, current-anchor immutable proposals, exact fee/maxFee, no FIFO | Public deployment and actual runtime request acceptance unverified |
| Read / continue / historical fork | Public state/events, exact raw result commitment, complete asset provenance, independent child job/project identity | Real file availability, runtime restoration and continuation admission unverified |
| Markdown / HTML / image | Fixed create/update profiles, one declared target, explicit authenticated selected inputs, real local file checks | Local fixtures are not AI-generated live deliveries; profile compliance remains to be checked |
| Callback / binding | Authenticated callback; permissionless exact-byte binding; finite metadata-aware parser | Missing callback or incompatible authenticated result can still stop purchases |
| SDK / CLI | Unsigned operations/read preparation, witnesses, local file checks, optional guarded download | No signer, public deployment command, automatic purchase or complete live observer |

Creation, proposals and forks do not buy AI. No frontend or centralized service is required for those A1 operations. Local mock successes do not prove live protocol acceptance.

## Current review repairs

| Finding | Candidate repair | Evidence boundary |
| --- | --- | --- |
| Medium: different slots could claim the same public mapping | Reject cross-slot names, equal paths and file/directory ancestor paths before payment; updates preserve their own mapping; historical provenance remains readable | Pre-fix failures and positive/negative regression controls in [review-fixes](validation/review-fixes/README.md) |
| Medium: unrelated metadata exhausted the retained JSON parser envelope | Validate the full raw document while retaining only acceptance fields; 32 KiB raw limit with strict total-value/key/depth budgets; matching SDK binding parser | Bounded compatibility repair, not guaranteed acceptance of every IMD result |
| Low: Markdown/PNG could occupy `dist/` | Reserve top-level `dist/` for the HTML profile's `dist/index.html` | On-chain/SDK proposal checks; actual runtime directory and HTML bytes still need file checks |
| Review follow-up: retained parser work and duplicate-key cost need bounds | Cap whole-document values and aggregate decoded key bytes, preserving strict malformed/duplicate rejection | Current worst-shape measurements and tests are indexed with the repair evidence |

The original implementing/independent review reports and earlier repairs, including the artifact-fetcher address guard, are preserved in [REVIEW.md](REVIEW.md) and [original validation](validation/README.md). A later Swarm review did execute and reported the three findings above; the original handoff's `independentContributorReview: NOT_RUN` narrative was incomplete. The current record distinguishes that review from local repair validation and from an external audit.

## Restrictions that remain

The [current envelope](LIMITS.md) limits assets, selected inputs, exactly one output, raw request/result bytes and parser complexity. The fixed HTML path means one HTML slot per Branch; update it or fork history. Image editing/reference/variation and publishing remain disabled.

The writer/runtime must truthfully report and retain accepted bytes, honor selected inputs and output profiles, and preserve job/project identity. Hashes do not prove quality, input consumption or safe HTML behavior. SDK `verifyHTMLDist` checks actual local shape/bytes and optional selected PNG inclusion; it does not certify arbitrary JavaScript safety. File/network checks are not a complete filesystem sandbox or end-to-end availability guarantee.

Missing callbacks leave `Pending`; incompatible authenticated documents can leave `ResultRecorded`; non-refusal failures freeze purchases. Status 1 allows only a separately funded retry of the same active proposal. No refund, timeout/admin unlock or automatic rebuy exists. Forking earlier accepted history, when available, does not recover the spent fee or accept a failed result.

## Remaining acceptance work

1. Complete source-specific local repair checks and independent review using [current evidence](validation/review-fixes/README.md); do not reuse original test counts or artifact hashes as current proof.
2. Integrate the separately delivered W1 with the accepted A1 ABI/SDK and test the actual local flow. Fixture/browser success alone is insufficient.
3. Under separate runtime-test authorization, verify live protocol/profile/schema acceptance, actual result envelopes and files, root continuation and historical-child identity. Follow [LIVE-VALIDATION.md](LIVE-VALIDATION.md); local mocks are not live compatibility evidence.
4. Treat public deployment, paid runtime requests, callbacks, binding, actual artifact checks and external Git delivery as separate observations. The original A1 source delivery is established; this repair and future runtime jobs require their own evidence.

Confirmed Critical/High findings or core failures block readiness. If an actual runtime result lies outside fixed candidate policy, record that incompatibility and design a reviewed successor rather than adding privileged repair or substituting manifest bytes. Live compatibility, real IMD runtime consumption and public deployment remain `NOT_RUN`.
