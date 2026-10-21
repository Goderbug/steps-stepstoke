# Current acceptance

**Local scope only.** `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`.

The authoritative [requirement matrix](validation/platform-ux-v1/documentation/README.md) links current byte checks, documentation reruns, recorded browser/core results, screenshots, local receipts and every unfinished gate. [Final integration evidence](validation/platform-ux-v1/final/README.md) records 175 browser passes and 16 actual local-chain scenarios in each Chromium/WebKit desktop/mobile run. Those are prior worker observations for the hashed source, not new runs or independent acceptance.

Fixtures, actual local contracts and live IMD are three separate evidence classes. Fixture mode uses simulated state. Local mode submits actual SDK-prepared transactions on disposable Anvil with MockToken/MockIntake. Neither proves a real worker, live manifest/callback liveness, native wallet compatibility, external Git delivery or production readiness.

The earlier WebKit RPC failures are preserved in [diagnostics](validation/platform-ux-v1/final/regressions/webkit-diagnostics.tar.xz). The final bounded-read transport repair and clean full local reruns are documented in [design review](validation/platform-ux-v1/final/design-review.md); they do not certify native Safari or every network condition. Core local regressions pass, while finite manifest limits and missing callbacks remain liveness risks without privileged recovery.

Historical matrices and raw records remain under [integration acceptance](validation/integration/acceptance/), [review-fixes](validation/review-fixes/), and earlier platform stage JSON/raw evidence. Read their source/run context before using their counts. [Open issues](validation/platform-ux-v1/documentation/open-issues.md) remain visible; no local PASS clears live gates.
