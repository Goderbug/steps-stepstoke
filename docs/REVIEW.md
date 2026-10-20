# Local adversarial review and readiness record

Scope: Solidity authority, payment, callbacks, strict JSON binding, persistent assets, historical forks, and the initial offline Node preparation layer.

The [A1 → W1 handoff](HANDOFF.md) collects repair status, fixed restrictions and missing work across contributor stages. The current [documentation reproduction](validation/documentation-pass/README.md) checks the unchanged source and runnable examples; it is not a new independent security review and does not fix code.

This is the implementing contributor's local review, supported by Foundry's linter and adversarial tests. **It is not an independent contributor audit.** A later independent agent review and rerun of the final integration are recorded in [docs/validation/independent-review.md](validation/independent-review.md); production readiness is not asserted. No unresolved Critical/High finding was identified in this local pass. Live profile/API compatibility, real IMD consumption and public deployment remain `NOT_RUN`.

## Findings repaired

| Finding | Impact | Repair and evidence |
| --- | --- | --- |
| Original 16 KiB manifest candidate combined with maximum witness fields used 16.0M verifier gas before Branch overhead | A valid-looking result could exceed a conservative transaction gas budget | Reduced manifest cap to 8 KiB; bounded commitment authentication avoids redundant revalidation; full Branch maximum-field ASCII/Unicode tests remain below 14M execution gas |
| Initial tiny PNG fixture had an invalid IDAT CRC | The fixture was not a reliable actual-image success case | Replaced it with a deterministic generated valid PNG; verified every chunk CRC and decompressed scanline; regenerated raw manifests and HTML data-URI fixture |
| Early tests expected `\\n` while the encoder canonically emits `\\u000a` | Exact-byte request test was incorrect | Corrected the golden bytes; the final test compares the complete request body |
| Early negative tests evaluated a getter after `expectRevert` | The getter consumed the expectation, weakening the intended assertion | Cached the implementation address before setting the expectation; authority and forged-parent tests now exercise the intended call |
| The initial SDK numeric-token wrapper could be imitated by a JSON object | A client could label an object-valued `bytes` field as valid even though the contract rejects it | Branded numeric tokens with an inaccessible Symbol and added a regression case; the Solidity parser was unaffected |

## Authority and lifecycle review

- Factory embeds and deploys fixed code; its immutable implementation creates fixed nonupgradeable clones. Initialization is single-use, Factory-only and atomic with registration.
- A Branch cannot execute arbitrary calls or change dependencies, profiles, goals, source, proposal terms, callbacks, body templates or token approvals through an admin.
- Current proposals share a checkpoint anchor, without FIFO or invalidation on insertion. The purchase guard serializes execution; stale or invalid selections fail before payment.
- Both sponsor and retry are guarded through token/Intake calls. Callback authentication rejects synchronous purchase callbacks, token-hook reentrancy, foreign requests, old requests and duplicates.
- Status 1 retains the exact active body/snapshot. Other failure statuses freeze. A missing callback cannot be repaired by time, HTTP or a privileged party.
- Bad binding preserves the digest and old checkpoint. Job replay, project switching, parent's project reuse and rewritten raw JSON cannot advance history.
- Each accepted round changes one target. The full old witness is authenticated and all untouched structs retain their complete provenance.
- Factory forks authenticate a registered parent and its chosen permanent historical asset commitment. Child state starts without an own execution identity.

## Parser and resource review

The parser validates the entire raw document, including ignored metadata, and rejects decoded duplicate keys at every object level. Fuzz tests cover ASCII quote/decode equivalence and escaped duplicate keys. Adversarial fixtures cover overlong UTF-8, stray/truncated sequences, raw and escaped surrogates, noncharacters, malformed numbers/escapes, trailing input, path attacks, file identity/type/size mismatches, additional outputs and depth/count/length limits.

The SDK's golden witness digest is checked independently by Solidity ABI encoding, and SDK-prepared creation calldata is actually executed against the local Factory. Explicit local file reading is bounded and rejects final-component symlinks and nonregular files; HTML directory checks require exactly a regular `index.html` and compare selected PNG data-URI bytes without executing content.

The witness has at most 16 entries; all hashing paths first bound each variable field. Request construction is bounded by policy, selected inputs and final UTF-8 body length. Global JSON token and container limits bound duplicate-key comparisons and recursion. History is a mapping with direct access; no settlement path walks all revisions or recursive ancestry.

## Linter disposition

`forge build`'s available Solidity lint pass was run. Its generic warnings are retained in the raw build evidence:

- Reentrancy warnings around the Intake call are covered by `guarded`, `Purchasing`, and pending-request authentication. The Factory's initialization call targets only freshly cloned fixed code, whose external dependency calls are read-only.
- Balance equality is deliberate: exact incoming and outgoing fee deltas are required; donations are measured relative to the pre-call balance.
- Base64 division before multiplication is deliberate integer ceiling arithmetic: `4 * ((n + 2) / 3)`.
- Narrowing casts follow explicit scalar, parser token/string, size, or decimal digit bounds. Action strings fit within 32 bytes.
- Zero-initialized local accumulators and reverts inside bounded validation loops are intentional.

Slither/Mythril and a separate contributor audit were not run. Automated checks cannot establish external writer honesty, runtime skill compatibility, content quality, actual input consumption, file availability or publication success.

## Release gates still outside this assignment's local evidence

The final integration received a separate agent review and replay; see [the report](validation/independent-review.md). An external audit has not been performed. A future release operator must validate fixed skill identifiers and the exact `steps[].inputs`/`outputs` shape against the live catalog, exercise each profile with real accepted manifests under separately authorized spending, and verify deployment addresses/code. Any confirmed Critical/High defect or core failure blocks readiness. Local mocks are not evidence that those live gates passed.

## Final integration repair

The independent review found that the optional artifact fetcher admitted hexadecimal IPv4-mapped IPv6 DNS answers such as `::ffff:7f00:1`, allowing a private-network connection. The repair uses a conservative positive IPv6 global-unicast allowlist with special/transition ranges excluded, including rejecting nonnumeric leading hextets. Regression tests evaluate the actual fetch implementation with synthetic DNS/HTTPS dependencies and prove rejection before transport, mixed-answer rejection and public-address pinning. See the final independent report and Node output in `docs/validation/`.
