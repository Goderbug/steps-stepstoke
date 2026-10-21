# Local adversarial review and readiness record

Scope: Solidity authority, payments, callbacks, exact-byte manifest binding, persistent assets, historical forks, and the offline Node preparation layer.

The original IMD A1 source delivery is pinned at `9b0294e7ab19060bd00c489fbe032cf248528e0d`. This checkout is a local repair candidate under policy A1/2. Current review, regression outcomes and source-specific measurements are indexed in [review-fixes](validation/review-fixes/README.md). It is not a new IMD delivery, a deployed system or an external security audit. Live profile compatibility, real IMD runtime consumption and public deployment remain `NOT_RUN`.

## Findings addressed in this candidate

The later Swarm adversarial review executed and reported two Medium findings and one Low finding. The original documentation pass did not fully carry those findings into its handoff; it must not be used as the current review status.

| Finding | Risk | Candidate repair and remaining boundary |
| --- | --- | --- |
| Medium: create profiles allowed different slots to reuse public names/paths | Two accepted assets could compete for one workspace mapping | Reject an output name or equal path used by another current slot before payment; also reject file/directory ancestor conflicts in both directions. Updates retain their target mapping and check all other slots; historical descriptors remain readable |
| Medium: unrelated metadata could exceed the fully retained parser envelope | A completed authenticated result could never bind, leaving the Branch stopped | A binding-specific parser validates the whole raw document while retaining only acceptance fields; the SDK mirrors that projection. Metadata has finite raw/complexity budgets. This repairs demonstrated envelope cases, not every possible future manifest |
| Low: non-HTML assets could write under top-level `dist/` | Later HTML instructions requiring only `dist/index.html` conflict with those files | On-chain/SDK output-path checks reserve top-level `dist/` to the fixed HTML mapping |
| Local review follow-up: individually bounded JSON shapes can combine expensive work | An input within each separate limit could still exhaust the binding gas margin | Whole-document resource accounting and combined-shape regression measurement; final policy and measured outcomes are in [limits](LIMITS.md) and [current evidence](validation/review-fixes/README.md) |

Regression evidence records failing behavior before the relevant fixes, positive controls for legitimate mappings and metadata, and corrected behavior. Original full-capacity fixtures were changed to distinct names/paths without reducing their field lengths or capacity. Untouched asset structs retain their complete provenance. Test counts, final source hashes and gas figures must be read from current evidence, not copied from original delivery logs.

## Authority and lifecycle boundaries

- Factory embeds fixed code and creates fixed nonupgradeable clones; initialization is single-use, Factory-only and atomic with registration.
- The repair adds no owner, upgrade, arbitrary call, admin repair, callback replacement or raw-body entrypoint.
- Proposals share an anchor without FIFO; insertion does not invalidate other proposals. Purchases serialize execution and stale/invalid requests fail before payment.
- Sponsorship and retry retain guarded token/Intake calls, exact price/maxFee accounting and callback authentication.
- Status 1 pins the same active request for explicit funded retries; other failure statuses freeze. Missing callbacks remain pending indefinitely.
- Binding authenticates the original callback digest, rejects replay/project changes and preserves the prior checkpoint on failure. An authenticated manifest outside fixed policy can still leave the Branch at `ResultRecorded`; no truncation or substitute JSON can settle it.
- Forks authenticate the chosen permanent parent checkpoint; a child preserves inherited provenance and starts with its own execution identity unset.

## Parser and file trust

The binding parser validates syntax and decoded duplicate keys everywhere, including ignored metadata. Required result fields keep their semantic limits. Unknown metadata is validated and discarded from the retained projection, never cut out of the hashed input. Raw bytes, decoded keys, object members, depth, retained tokens and whole-document work all have bounds; see [LIMITS.md](LIMITS.md). The generic SDK `strictJSON` helper retains its original defaults; `strictManifestJSON` is used for binding preparation and manifest checks.

Malformed UTF-8, escaped/raw surrogates, noncharacters, duplicate escaped keys, malformed numbers/escapes, trailing data, extra outputs, wrong file types and resource excess remain rejection cases. Accepting a larger bounded envelope does not certify live IMD compatibility.

Contracts authenticate writer-supplied descriptors. They cannot prove file availability, quality, model input consumption or safe HTML. SDK checks compare actual local/publicly retrieved bytes without executing them; PNG signature checks are not a complete decoder audit. The fixed HTML output path and file checks do not grant the contract control over the remote runtime filesystem.

## Preserved original review history

The original contributor repaired an earlier gas-heavy fully retained parser by reducing its cap to 8 KiB, fixed an invalid PNG fixture CRC, corrected canonical newline/test expectations and prevented SDK numeric-wrapper impersonation. Those original fixes and measurements are historical; the candidate uses a different binding parser and must be measured separately.

An earlier independent agent review found a High-severity artifact-fetch bypass via IPv4-mapped IPv6 DNS answers. The delivered implementation uses a conservative global-unicast allowlist with special/transition ranges excluded; tests cover rejection before transport and checked-address pinning. Its report remains in [original independent review](validation/independent-review.md). This does not erase the later Swarm findings addressed above.

Original Foundry linter dispositions remain useful context: exact balance comparisons are deliberate; token/Intake interactions are guarded; Base64 overhead rounds upward; narrowing follows explicit bounds; bounded loops and zero-initialized accumulators are intentional. Raw original logs, [documentation reproduction](validation/documentation-pass/README.md) and source inventories remain untouched. They are not new validation of candidate bytecode.

## Remaining release gates

The local repair review is separate from an external human audit; no Slither/Mythril or external audit conclusion is claimed. Review status and any unresolved findings belong in [current repair evidence](validation/review-fixes/README.md). Confirmed Critical/High findings or core failures block readiness.

Before a release claim, validate actual IMD profiles/schema/result envelopes and files through separately authorized runtime tests and verify deployment addresses/code. The delivered English frontend now has actual disposable-contract integration, with final local evidence in [PLATFORM-UX-V1](validation/platform-ux-v1/final/README.md); neither its fixture flows nor its MockIntake receipts establish live acceptance. Independent contributor review of the final frontend remains NOT_RUN. See [handoff](HANDOFF.md) and [future runtime procedure](LIVE-VALIDATION.md).
