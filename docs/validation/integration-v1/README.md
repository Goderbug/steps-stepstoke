# RC-V1 integration evidence

Historical accepted integration evidence. The current multi-file revision is recorded [separately](../multi-file-revision/README.md). This directory's original evidence archive is retained by a verified immutable predecessor reference in `docs/history/integration-predecessor.json`, with the original member index beside this file. All earlier 220 platform browser records/screenshots are byte-recoverable through the verified predecessor references in `docs/history/accepted-platform-validation-index.json.xz`. See [exact recovery](../../history/README.md).

Development only, starting from imported commit `9e53d2b1e6af36513cbf17a1756ac5af24a06825`. Solidity source/bytecode are unchanged from the accepted direct-Branch adaptation. No public deployment, signing, paid request, extra order, hosting or posting occurred. productionDeployment:null; liveCompatibility:NOT_RUN; productionReady:false.

## Actual checks

| Check | Outcome / coverage |
|---|---|
| Forge build / seeded suite | Passed; 138 tests in 17 suites, including invariants |
| SDK Node tests | 62 passed; mocked transport faults are labelled in source |
| Frontend units / typecheck / static build | 44 passed / passed / passed |
| Chromium static export | 72 passed, desktop and 320px; fixture signatures only |
| Local-chain browser | 16 passed; actual contracts with mock Intake |
| Public-mode browser rehearsal | 5 checks passed; actual disposable chain1, mocked HTTPS, no public transaction |
| Deployment importer | Actual disposable atomic CREATE2 batch, canonical receipt/trace, frozen sources and child immutable checks passed |
| Seven-round SDK flow | Passed on disposable local chain; mock Intake |
| Exact encoder/free official preflight | 20 vectors (five profiles × four root/child open/continue contexts); 16 clear screens; four HTML-update invalid_artifacts from local HTML fixture |
| ABI / executable scan / history / release | Passed; raw results archived |

Commands: `forge build`; `forge test --fuzz-seed 0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5`; `node --test test-sdk/*.test.mjs`; frontend `npm run test:unit`, `npm run build`, `npm run test:e2e`; `node tools/deployment-rehearsal.mjs`; `node tools/check-official-bodies.mjs --free-check`; `node tools/check-release.mjs`; `python3 tools/verify-history.py --predecessor`; `python3 tools/check-delivery.py`. Frontend dependencies/build ran in a /tmp mirror using unchanged pinned manifests, never repository node_modules. The installed Chromium executable was selected explicitly; default Playwright browser version was unavailable. WebKit unrun.

## Measurements and public evidence

Runtime/initcode bytes: Factory 21,195/21,475; Branch 12,876/16,219; Encoder 11,498/11,524; Verifier 14,544/14,570. Actual atomic batch gas 10,357,822. Largest finite binding measurement 13,576,162; declared ceiling 16,777,216. These are measured shapes, not a universal bound. Exact raw transactions, estimates/receipts and finite stress measurements are in the indexed archive. Earlier adaptation evidence and failure cases remain in ../rc-v1 and ../../history.

Current official docs, capabilities, frontend handoff format, free requests/responses and read-only Intake evidence are archived. The read block is 26242457, hash 0x00432bac65f2ab54b7e5ab3ba4181d6101d9483fd97303fec13c9d16be46a107; both official job actions quote 500000000000000000. Evidence identifies the public Ethereum source, not machine-specific RPC plumbing. Free screens prove structural acceptance only. Existing authenticated public raw-result replay remains exact-source coverage, not a live STEPS job. The seven-job live matrix and stop gates are in ../../LIVE-VALIDATION.md and were not executed.

Current official artifact SHA URLs returned HTTP200 with no redirect: Markdown 83 bytes and PNG 19,699 bytes. SDK byte SHA-256/length/media checks pass; headers omit ACAO and fresh Chromium requests fail CORS. Raw bodies, headers and browser diagnostics are recoverable. Manual authenticated byte selection is implemented and tested, including wrong-byte refusal. No server was added; ../../RESOLVER-PROPOSAL.md is a minimal unhosted proposal only.

## Failures, repairs and remaining limits

Preserved initial runs include wrong-cwd static harness failure, fixture actions accidentally disabled by live gates, and stale missing-handoff assertions/resource auditing. Repairs keep fixture simulation distinct and assert only the expected missing imd-deployment.json 404; the final 72-case suite passes. Earlier SDK/unit runs are retained with their actual outcomes, not relabelled as failures when overwritten. The first evidence-size check failed at 8,498,346 bytes. Retaining the prior accepted archive by independently verified immutable predecessor reference, alongside its unchanged per-member index, brings the delivery below 8 MiB without removing current integration failures/tests. The final manual browser review forced a fresh document load, checked final bundle index-BA0j1PXQ.js, and saw no page overflow at 1440 or 390. Screenshots are display-only WebP recompressions. CORS errors are expected reproduced external limitations.

No future handoff exists. Trace/archive RPC support is required and fails closed if unavailable. Public event cache requests are bounded (20k blocks/read, 2k RPC chunks, 10k cached events); larger histories require explicit incremental reads. Twelve confirmations are not consensus finality. Actual official callback/file limits, multi-file and oversized results, five-profile runtime compatibility, child policy, service ceilings, final independent security review and public deployment verification remain open. No automatic rebuy or administrative recovery exists. A deployment verification alone cannot enable spending. See ../../HANDOFF.md for the later importer and ../../LIVE-VALIDATION.md for authorized live work.

`archive-index.json` inventories every byte-recoverable member of `evidence.tar.xz` with SHA-256 and byte length. The previous source manifest and deleted pending-only config are included. Older accepted adaptation archive and screenshots use verified immutable predecessor references in ../../history/integration-predecessor.json. Final source inventory and total size are in ../rc-v1/source-manifest.json.xz and delivery-size.json.
