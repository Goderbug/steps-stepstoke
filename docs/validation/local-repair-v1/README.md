# STEPS local repair v1

Local runtime validation: **PASS**. Production deployment, paid live compatibility and website publication: **NOT_RUN**. The final source/export inventory is generated separately after the clean frontend export. This is a bounded local acceptance record, not a security guarantee or official IMD deployment approval.

The source baseline is IMD candidate `b7747bf377e292f44b35fb0acc55c6ee1772cee4` from `identity-md-launches/launch-2393-prepare-steps-stepstoke-release-candidat`. These repairs are local work requested by the project owner, not a new IMD delivery. The original protocol policy ID, ABI, asset/output schema, exact raw result binding, authority, ordering, payments, parser budgets and dependency/compiler settings remain unchanged.

## Repaired findings

- **C-GAS-01:** retained Unicode strings previously incurred expensive repeated processing. The retained parser now validates canonical UTF-8 and escapes once, copies validated raw segments, decodes checked hexadecimal digits, and handles consecutive simple escapes with bounded writes. The exact original 32,768-byte input (SHA-256 `8768318db71105397ac89eef44af007752b94e966eb8adebd237a2b97c9de805`) with the 16-asset witness now binds in **13,361,083 total gas**, compared with the previous 37,184,113 diagnostic. The original bytes are not projected or rewritten. Six retained-string full transactions use 11,705,216–13,372,980 gas; eight metadata cases use 9,941,200–12,861,561. All declare a 16,777,216 limit. These finite cases do not prove a universal maximum.
- **F1:** public verification now uses bounded anonymous HTTPS read-only fallback, with the policy stored as a separately inventoried asset. The official network object remains unchanged. Chain, transaction, canonical block, CREATE trace, constructor, source, ABI, runtime and immutable checks remain mandatory; final canonical receipt/block checks detect changes during verification. Semantic failures never search another endpoint for an acceptable answer. Independent review found and repaired generic/nested JSON-RPC execution errors incorrectly falling back, including HTTP 500 envelopes. Anonymous dRPC tracing and historical reads worked in current probes, including Chromium/WebKit CORS; this is an observation, not a durable free-service promise. Actual deployment evidence must still be verified when delivered.
- **F2:** modal close restores the actual activating button, the skip link is an explicit keyboard stop, and focused Markdown table regions support horizontal keys. Existing safety assertions remain, with added actual-opener and keyboard regressions. No wallet gate, mode or action was removed.

## Final local results

| Check | Observed result |
| --- | --- |
| Clean full compilation and frozen output/ABI check | PASS; Forge 1.8.3, solc 0.8.26, Cancun, optimizer 200, viaIR, bytecode hash none; 46 compiler inputs |
| Full contract suite | **156/156 PASS**, 19 suites, no skips; includes 3,000 retained-string differential fuzz runs |
| Independent isolated parser review | **13/13 PASS**, including a separate 3,000 fuzz runs; all 256 simple-escape bytes, 17 Unicode-plane noncharacters, scratch/duplicate keys and 1,024/1,025-byte transitions checked |
| SDK suite | **84/84 PASS**; includes availability/semantic-error/timeout/tamper/reorg and inventory cases |
| Frontend typecheck / unit | PASS / **100/100 PASS** |
| Complete fixture browser matrix | **185/185 PASS**, five projects, no failures, skips or flaky cases; all original eight WebKit failures resolved |
| Actual local contract browser journeys | **32/32 PASS**, 16 each in Chromium and WebKit desktop; zero unexpected browser, console or request errors |
| Public-mode chain-1 rehearsal | **11/11 PASS**, actual disposable contracts and importer, local intercepted HTTPS transport; no public deployment |
| Three-contract constructor and importer rehearsal | PASS; actual local CREATE2 batch **10,239,841 gas**, exact committed compiler inputs, immutable runtime and asset inventory checked |
| Retained result / metadata full transactions | **6/6 + 8/8 PASS**; raw inputs, calldata and transaction measurements preserved |
| Bytecode policy and embedded SDK ABI checks | PASS |
| Historical evidence recovery | All original archive members and immutable predecessor bytes independently verified |

The clean build changes the Encoder fingerprint even though Encoder source is unchanged: complete via-IR compilation context includes the additional test source. The current frozen 46-input build is authoritative, not an earlier incremental artifact. Current runtimes are Factory 21,195, Branch 12,876, Encoder 11,498 and Verifier 13,999 bytes, all below EIP-170. Use the delivered fingerprints and exact compiler context.

Browser fixture evidence predates the final conservative HTTP classification and editorial review metadata. The nine UI/test file hashes remained identical; the final real-chain and public-handoff tests cover the integrated transport. Final clean-export hashes are recorded separately. Narrow and desktop WebKit output screenshots were inspected for wrapping, verified previews and file evidence. Physical devices, real-wallet sessions, native screen readers and a universal accessibility assessment were not performed.

## Reproduction and evidence

Use the pinned toolchain and locked dependencies. `FOUNDRY_SOLC` may point to an independently installed exact solc 0.8.26 binary for offline runs; do not change the compiler settings or protected dependencies.

```sh
node tools/build-release.mjs
FOUNDRY_FUZZ_SEED=0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5 forge test --offline
node --test test-sdk/*.test.mjs
node tools/generate-sdk-abi.mjs --check
node tools/inspect-bytecode.mjs
node tools/measure-retained-binding.mjs
node tools/measure-binding.mjs
node tools/deployment-rehearsal.mjs
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
node frontend/tests/integration/browser-chain.mjs --browser chromium --out test/scratch/local-chromium
node frontend/tests/integration/browser-chain.mjs --browser webkit --out test/scratch/local-webkit
node frontend/tests/integration/public-chain.mjs
python3 tools/verify-history.py --predecessor
python3 tools/check-delivery.py
```

Browser scripts create and own disposable local chains and transient handoffs. Preserve their evidence, restore the original local-only configuration, remove the transient public handoff and rebuild before distributing an undeployed candidate. Never copy disposable addresses into a production handoff. The archived reports identify local mocks and intercepted transport explicitly.

`measurements.json` summarizes full-transaction gas and sizes. The compact `evidence.tar.xz` and `archive-index.json.xz` preserve current raw tests, failure histories, review reports, a selected narrow WebKit screenshot, exact raw inputs and calldata. Decode the archive index with `xz -dc archive-index.json.xz`. The optional desktop screenshot remains in the local evidence directory and is indexed by hash; it was omitted from the compact public bundle. The original interim contract run had 154 passes and two newly added stress failures; those logs are retained, followed by final corrected targeted and complete passing runs. Early sandbox bind failures were execution-environment limits, not contract acceptance. Historical reports under other directories retain their original scope.

## Release boundary

Local acceptance permits preparation of **one separately bounded IMD contracts-only launch**. IMD still performs its mandatory imported audit/adaptation/review; local repair does not guarantee recovery from the earlier worker/runtime/model failures. Material final-source changes require renewed review, and no website is included in this order.

Only actual official source delivery, canonical deployment receipts, actual deployer/creation caller, correct code and constructor bindings establish deployment. Connect and publish the website after independent deployment acceptance. Paid public controls stay gated until separately authorized live checks pass. No funded STEPS round, public signature, token/pool/hook, new administrator, social post or hackathon submission is part of this local validation. The organizer's cutoff time/timezone remains unverified; an open form does not establish eligibility or an extension.
