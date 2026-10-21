# Fixed resource envelope

This is the local policy A1/2 repair candidate atop the original IMD delivery at `9b0294e7ab19060bd00c489fbe032cf248528e0d`. All sizes are bytes, including UTF-8 and JSON escapes. Current results and source-specific measurements are in [review-fixes](validation/review-fixes/README.md); original validation logs are preserved as historical evidence.

| Resource | Candidate limit |
| --- | ---: |
| Current asset slots | 16 |
| Explicit selected inputs | 8 |
| Declared and accepted output files | 1 |
| Runtime request body | 16,384 |
| Exact raw result manifest | **32,768** |
| Markdown output | 65,536 |
| HTML output including embedded data | 2,097,152 |
| Generated/selected PNG | 262,144 each |
| Selected image aggregate | 524,288 |
| Public goal / child direction | 512 each |
| Proposal text | 1,024 |
| File name / job ID / project ID | 64 each |
| Relative file path | 128 |
| Manifest retained decoded string | 1,024 |
| Manifest decoded object key | 256 |
| Manifest retained tokens including retained keys | 256 |
| Manifest members per object | 128 |
| Manifest nesting below top level | 16 |
| Manifest total JSON values, including containers | 512 |
| Manifest aggregate decoded key bytes across all objects | 2,048 |
| Manifest combined work budget | 65,536 |
| Retained numeric literal spelling | 64 |
| File `bytes` integer spelling | 10 |
| Witness MIME string shape before commitment comparison | 32 |
| Callback URI emitted | 1,024 |

The binding-specific `ManifestJSON` / SDK `strictManifestJSON` validates the entire exact document, including metadata that is not retained for acceptance. Unknown strings and arrays consume the raw byte and global complexity budgets; they no longer consume the retained-field string/token budgets. Duplicate decoded keys, malformed UTF-8/escapes/surrogates/noncharacters, malformed numbers and trailing data still fail anywhere in the document. Required result/file fields remain subject to their tighter semantic limits. The SDK's separate general-purpose `strictJSON(raw,maxBytes=8192,maxString=1024)` keeps its original defaults and is not the binding parser.

The combined budget is `rawBytes + 96 * totalValues + 8 * totalDecodedKeyBytes + 4 * duplicateComparisons <= 65,536`. For each object, duplicate comparisons count `0 + 1 + ... + (members - 1)`; totals include all objects and ignored metadata. All individual limits also apply. Therefore one document cannot necessarily reach every individual maximum at once. `MANIFEST_LIMITS` exports the SDK constants.

These are finite candidate limits, not a promise that all current or future IMD manifests fit. A success callback authenticating a document outside the envelope can still leave the Branch at `ResultRecorded`. No admin unlock, manifest truncation, reserialization, or substitute hash is introduced. Actual IMD compatibility remains a separate gate.

## Asset mapping and profile restrictions

The asset table reserves space for one slot of each enabled type: Markdown, HTML and image. Existing Markdown/HTML slots remain updatable at full capacity. Image edits are not enabled.

Names and IDs use ASCII letters, digits, `_` and `-`. Paths use ASCII letters, digits, `_`, `-`, `.`, and `/`, with no absolute, empty, hidden or traversal components, trailing slash/dot, percent escapes, URLs or backslashes. Markdown paths end in `.md`; PNG paths end in `.png`; HTML is exactly `dist/index.html`. Non-HTML outputs cannot occupy top-level `dist/`.

A proposed write must not reuse another current slot's name or path. It also cannot make one slot's file path an ancestor of another: `docs/main.md` and `docs/main.md/next.md` conflict in both directions. Shared directories and non-boundary text prefixes are allowed. An update retains its own name/path and checks conflicts with every other slot. Historical independently produced descriptors remain readable with their immutable provenance. The fixed HTML path permits one HTML slot per Branch; update that slot or fork its accepted history.

Goals, directions and proposal text accept strict scalar UTF-8; tab/newline are JSON-escaped, other ASCII controls and DEL are rejected. The root direction is empty; a fork direction is nonempty. File size/hash/submissionHash and producing Branch/result/revision are nonzero. Enum values and integer widths are defined in [the ABI reference](CONTRACTS.md).

Only one `files[]` entry is accepted. File `bytes` must be a nonzero unsigned integer without exponent, fraction or negative sign. Image editing/reference/variation and publishing remain disabled.

## Measurement and remaining trust boundaries

The original implementation reduced a fully retained parser's manifest cap from 16 KiB to 8 KiB after a maximum-witness gas failure. Those old measurements remain under `evidence/` and `docs/validation/`; they do not measure the revised metadata-aware parser. Current test counts, complete binding gas and production contract sizes must come from [review-fixes](validation/review-fixes/README.md). The existing 14,000,000 execution-gas assertions for the maximum-witness binding fixtures remain acceptance checks; they are not a universal upper-bound proof for every possible JSON document.

Execution-call gas excludes calldata/intrinsic transaction costs and external protocol work. Whole-test gas also includes constructing prior revisions, so it is not the gas of one production transaction. Re-running an aggregation tool over saved traces is not a new gas experiment.

The HTML input check adds selected HTML bytes and `4 * ceil(imageBytes / 3) + 32` per image for Base64/data-URI overhead. It rejects over-budget inputs before payment, even if a hypothetical edit could fit after removal/compression. No implicit deletion or transcoding exception exists.

Contracts authenticate descriptors, not actual file bytes, availability, quality or runtime behavior. SDK file checks remain separate; see [CLI and SDK](CLI.md) for local-file, MIME and network restrictions. This candidate is neither deployed nor a new IMD source delivery.
