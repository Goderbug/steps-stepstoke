# STEPS local repair v1

Status: IN PROGRESS. No production deployment or live compatibility is claimed.

The source baseline is IMD candidate `b7747bf377e292f44b35fb0acc55c6ee1772cee4` from `identity-md-launches/launch-2393-prepare-steps-stepstoke-release-candidat`. The following repairs are local work requested by the project owner; they are not represented as new IMD deliveries.

1. Reduce retained Unicode manifest parsing cost without changing the accepted schema, exact result digest, parser budgets, asset witnesses or settlement authority. Reproduce the original failing 32 KiB result as a full transaction.
2. Add bounded, anonymous read-only RPC fallback for deployment trace and historical reads. Preserve the official network object, bind the fallback policy in the asset inventory, and fail closed on verification or semantic failures.
3. Repair WebKit keyboard access, table scrolling and modal focus restoration without weakening browser assertions.

Required acceptance includes the complete contract and SDK suites, full-transaction gas regressions, exact source/build fingerprints, a disposable three-contract deployment and handoff importer rehearsal, browser fixture regression, and actual local-chain integration. Review findings and exact commands will be recorded when those checks finish.

Release order: local repair and independent review; a separately bounded IMD contracts-only deployment; independent verification of official deployment evidence; website integration and publication. Local tests do not establish IMD worker availability, deployment-service acceptance, future anonymous RPC availability or real paid product compatibility. Historical reports under other validation directories retain their original scope and results.
