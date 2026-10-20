# Final integrated local validation

The accepted core, SDK/CLI and adversarial suites are integrated without replacing their public interfaces or changing the fixed contract policy. This pass added actual SDK-to-contract execution, repaired an SDK private-network download bypass, corrected CLI/operations documentation, exported/checked final ABIs, and independently reviewed and replayed the result.

**Local integration passes. Live Intake/catalog compatibility, real IMD consumption, public deployment and publication remain `NOT_RUN`.** No real credentials, external wallets, public-chain transactions or paid jobs were used. Anvil uses temporary unlocked test accounts; only Intake and IMD are mocked. The actual release Factory deploys the actual fixed encoder, verifier and Branch implementation, and creates its actual Branch clones.

## Executed outcomes

| Check | Outcome | Raw evidence |
| --- | --- | --- |
| `forge build` | Exit 0; compiler/linter warnings preserved | [build](forge-build.txt) |
| `forge test -vv` | 91 passed, 0 failed, 0 skipped; 11 suites | [tests](forge-test.txt) |
| `forge fmt --check` | Exit 0 | [format](forge-fmt.txt) |
| `node --test test-sdk/*.test.mjs` | 20 passed, 0 failed | [Node tests](node-test.txt) |
| `node tools/local-integration.mjs` | Exit 0; 7 bound rounds, 8 explicitly funded mock attempts | [actual flow](local-integration.json), [stderr](local-integration.stderr.txt) |
| `node tools/export-abi.mjs` then `node tools/measure-release.mjs` | ABI and fixed release artifact hashes/sizes match final build | [artifact check](artifact-check.txt), [measurements](measurements.json) |
| `python3 test/adversarial/check-inline-fixtures.py` | Valid independent inline PNG fixture and exact Base64 | [fixture output](fixture-check.txt) |
| Independent agent review and replay | High network guard defect repaired; 91 Foundry / 20 Node tests and actual flow pass | [review](independent-review.md), [Foundry](independent-forge-test.txt), [Node](independent-node-test.txt), [flow](independent-local-integration.json) |

The independent review is by a separate agent, not an external human audit. No unresolved Critical/High finding or concrete core behavior failure was identified after repair. Slither/Mythril and live protocol validation were not run. Earlier contributor logs under `evidence/` and `test/adversarial/evidence/` are preserved historical records; the files in this directory describe the final integration.

## Actual temporary-chain flow

The runner starts its own loopback-only Anvil instance, obtains unlocked local test actors without reading keys, and destroys the process and temporary HTML directories afterward. It accepts no external RPC URL. Build artifacts must exist first (`forge build`). The SDK remains unsigned; only this explicit local test runner submits prepared transactions.

The flow purchases and binds these root rounds:

1. HTML create from the actual `test/fixtures/html-1.html` bytes.
2. PNG generation from the actual `test/fixtures/image-2.png` bytes, retaining the old HTML descriptor/provenance.
3. HTML update selecting both earlier HTML and current PNG. The execution parent is round two's job. The actual `html-3.html` retains `original-marker`, contains the exact selected PNG data URI, and is checked as the sole regular `index.html` in a temporary dist directory. No HTML or JS is executed.
4. Markdown create using actual `document.md`.
5. Markdown update using actual `document-updated.md`. A mock status-1 refusal first records an attempt without a revision; `retryRefused` explicitly funds a new attempt with the identical body, proposal and snapshot.

After root revision five, the SDK forks **historical revision one**, authenticating its original HTML witness. The child begins with no own project/job/proposals, opens its own project for a PNG round, then continues its own latest job to update the inherited HTML using both assets. The root remains unchanged. The child manifests are explicitly mock writer results with a distinct local project identity; their exact raw bytes are passed to callback and binding, without rewriting callback-authenticated data.

SDK-created/proposed/sponsored/retried/bound/forked transactions execute against the real local contracts. Exact request bytes, actions, selected descriptors/aliases, hashes, zero leftover Branch allowances/balances, per-transaction gas receipts and checkpoint identities are asserted. History events are decoded through the SDK and authenticated against contract checkpoint reads. Wrong-witness binding calls reject while preserving the recorded digest/old anchor, followed by correct binding without another purchase. Actual fixture SHA-256, lengths and enabled MIME signatures are checked separately from raw manifest keccak256. Evidence includes exact request body hex, raw manifest hex and complete decoded checkpoint witnesses/digests; parsed bodies are for readability only. Git delivery, actual runtime input consumption and HTML behavior are not inferred from these checks.

## Measured resource limits

| Release contract | Runtime bytes before immutable patching | Initcode bytes |
| --- | ---: | ---: |
| Factory | 4,249 | 41,221 |
| Branch implementation | 15,472 | 15,724 |
| Encoder | 10,310 | 10,336 |
| Verifier | 10,590 | 10,616 |

All release contracts fit EIP-170 (24,576) and EIP-3860 (49,152). `forge build --sizes` returned exit 1 because **test-only** `SpecStateHandler` is 25,040 bytes; its raw diagnostic is preserved in [contract-sizes.txt](contract-sizes.txt). This invariant scaffolding is never deployed by the Factory. The normal full build and tests pass. `forge build --sizes --skip test` exits 0 and confirms the release envelope in [production-contract-sizes.txt](production-contract-sizes.txt). The artifact checker independently enforces the limits on all four release artifacts.

The accepted worst runtime request body is **16,384 UTF-8 bytes**, with eight authenticated selected assets; **16,385 bytes is rejected before transfers/payment**. Both outcomes are exercised through the public proposal/purchase flow in [worst-body-trace.txt](worst-body-trace.txt), not inferred from a short example.

The three complete maximum binding fixtures use 16 accepted assets, maximum descriptor fields, an exactly **8,192-byte** raw manifest and a **13,280-byte** witness ABI payload:

| Shape | Measured binding execution gas |
| --- | ---: |
| ASCII padding | 11,705,957 |
| Escaped Unicode padding | 11,560,978 |
| Wide objects | 12,336,043 |

All enforce a 14,000,000 execution-gas budget. Full raw traces are in [maximum-binding-trace.txt](maximum-binding-trace.txt). These call-level measurements exclude transaction intrinsic/calldata gas; actual small-fixture transaction receipts, including deployment and callbacks, are separately recorded in `local-integration.json` and `measurements.json`. The fixed caps and restrictions in [LIMITS.md](../LIMITS.md) remain unchanged. Image slots are PNG-only; image references/edits and publication are disabled.

## Reproduce offline

```sh
forge build
forge test -vv
forge fmt --check
node --test test-sdk/*.test.mjs
node tools/export-abi.mjs
node tools/local-integration.mjs > docs/validation/local-integration.json
forge test --match-test test_maximumCompleteBinding -vvvv > docs/validation/maximum-binding-trace.txt 2>&1
forge test --match-test test_realEightAssetWitnessExact16384ByteRequestAndOneByteOverRejectedBeforePayment -vvvv > docs/validation/worst-body-trace.txt 2>&1
node tools/measure-release.mjs
```

The [check summary](check-results.json) records outcomes, and [source fingerprints](source-sha256.json) identify the source/config/test bytes used. These commands require the existing pinned compiler/Foundry tools, Node and Anvil, with no package installation or external network. `tools/measure-release.mjs` reads the saved measurement traces and fresh flow report, rejects ABI/config drift and writes `measurements.json`. `tools/validate-live.mjs` remains an offline preflight-packet generator; it performs no settlement or paid execution and does not mark compatibility verified.
