# Independent review of the A1 local repair candidate

Reviewed on 2026-10-21. This review is by a separate assistant agent, not an external human audit. It covers the local source candidate; it does not accept the product for deployment or real funds.

## Candidate and scope

- `src/libraries/ManifestJSON.sol` SHA-256: `b6d567634c20a7aaeb58ba496f648233ea417b2107aa37fbfa09b30f0afec409`.
- `test/MetadataScannerDifferential.t.sol` SHA-256: `e8957cf570438bb7b001053f84659ddfccc224879e0ee929fb196eae47ef2e28`.
- Reviewed manifest projection, full raw-byte authentication, duplicate decoded keys, strict Unicode/number handling, bounded scans, the SDK's matching budgets, name/path conflicts and reserved `dist/` rules.
- The final review supersedes the earlier `40a353…` parser snapshot. Its earlier independent log is retained as `independent-scanner-differential-intermediate-40a.txt`.

## Findings and disposition

The review identified file/directory ancestor collisions missed by exact-path equality, and high parsing costs for dense arrays, wide objects, long numbers and whitespace inside the initial expanded byte limit. The candidate adds segment-boundary path conflict rejection, bounded whole-document work accounting and optimized scans. SDK admission rules match the contract rules. Historical asset provenance and raw result authentication remain intact.

No further actionable code finding was identified within this reviewed repair scope. This conclusion is limited to the inspected source and tests; it is not a proof that all allowed manifests fit a universal gas ceiling or that the external writer will always produce compatible manifests.

**Retained medium residual: bounded-parser liveness.** An authenticated IMD result outside the fixed byte, depth, key, value, retained-token or combined-work envelope cannot be rewritten to satisfy the recorded raw hash. The Branch may remain at `ResultRecorded`; no override or refund mechanism was added. Larger metadata scenarios now work within the measured envelope, but this mitigates the original compatibility problem rather than eliminating all future oversized or incompatible results. Actual writer limits and real IMD continuation compatibility remain unverified. `liveCompatibility`, real IMD testing and public deployment are `NOT_RUN`.

## Independent local verification

The final candidate passed **6 tests, 0 failed**, including three fuzz tests at **1,000 runs each**. Every fuzz input is compared against the original strict parser in both ignored-metadata and retained-string positions; retained strings also compare decoded-content hashes. Additional cases cover malformed hex, surrogate/noncharacter/UTF-8 rejection, mixed raw and escaped Unicode, and ASCII copy boundaries from 1 to 1,024 bytes.

Evidence: [independent-scanner-differential.txt](independent-scanner-differential.txt). The suite was compiled with solc 0.8.26 using the project's optimizer, IR and Cancun settings in an isolated local build directory. It uses no external RPC, wallet or paid request. The same test is included for the root candidate's final full-suite run; that separate run must be checked in its own report.

The recorded parser and SDK checks do not validate real file availability, worker input consumption, Git delivery, W1 integration or public-chain compatibility. There is no external-audit or production-readiness claim.
