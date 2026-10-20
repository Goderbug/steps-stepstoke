# Fixed resource envelope

All sizes are bytes, including UTF-8 text and JSON escapes in the encoded request.

| Resource | Release limit |
| --- | ---: |
| Current asset slots | 16 |
| Explicit selected inputs | 8 |
| Declared and accepted output files | 1 |
| Runtime request body | 16,384 |
| Exact raw result manifest | **8,192** |
| Markdown output | 65,536 |
| HTML output including embedded data | 2,097,152 |
| Generated/selected PNG | 262,144 each |
| Selected image aggregate | 524,288 |
| Public goal / child direction | 512 each |
| Proposal text | 1,024 |
| File name / job ID / project ID | 64 each |
| Relative file path | 128 |
| JSON decoded string | 1,024 |
| JSON decoded object key | 64 |
| JSON tokens including object keys | 256 |
| Object members / array items | 32 each |
| JSON nesting below top level | 8 |
| Callback URI emitted | 1,024 |

The asset table reserves room for one slot of each enabled type: Markdown, HTML and image. Until those types exist, capacity is held for them. Existing Markdown/HTML slots remain updatable at full capacity. Image edits are not enabled.

Names and IDs use ASCII letters, digits, `_` and `-`. Paths use ASCII letters, digits, `_`, `-`, `.`, and `/`, with no absolute, empty, hidden or traversal components; no trailing slash/dot, percent escapes, URLs or backslashes. Markdown paths end in `.md`; PNG paths end in `.png`; HTML is exactly `dist/index.html`. An update keeps its target's name and path. Different slots may use the same relative path in different immutable producing submissions.

Only one `files[]` entry is accepted; additional outputs, even unrelated ones, are rejected in this release. Unknown manifest metadata is allowed only within the complete parser's resource envelope. JSON numbers use full strict grammar, but file `bytes` must be a nonzero unsigned integer with no exponent, fraction or negative sign.

## Measurement and repair

The initial 16,384-byte manifest candidate was tested with a full witness. A 16,109-byte manifest plus 16 maximum-field asset descriptors cost **16,018,511 gas in the verifier alone**, before the remaining Branch binding work. That candidate was reduced to **8,192 bytes**. Witness authentication was also changed to bounded-shape hashing against an already validated permanent commitment, avoiding redundant full field validation. Newly accepted tables still receive complete descriptor, ordering, provenance and reservation checks in the fixed verifier.

The final integration measurements populate all 16 slots through actual public proposal/purchase/callback/bind calls, use maximum-length names, paths and producing job IDs, then bind an exactly 8,192-byte raw result:

| Measured call | Execution gas |
| --- | ---: |
| Complete bind, maximum witness and ASCII padding | 11,705,957 |
| Complete bind, maximum witness and escaped Unicode padding | 11,560,978 |
| Complete bind, maximum witness and wide 32-member objects | 12,336,043 |
| Full witness ABI payload in these tests | 13,280 bytes |

These are local EVM call measurements, not mainnet receipts. Calldata/intrinsic transaction costs and external protocol execution must be accounted for separately. Tests enforce a 14,000,000-gas call budget for all three worst-field binding fixtures. The aggregate gas reported for a test includes constructing 16 prior revisions in one test invocation; it is not the gas of one production transaction.

The HTML known-input check sums selected HTML byte lengths and adds `4 * ceil(imageBytes / 3) + 32` for each image's Base64 and data-URI overhead. It rejects sums above the HTML cap or images over the per-file/aggregate limits before payment. This conservative rule can reject an edit that could theoretically fit after compression or removal. No implicit deletion or transcoding exception is offered.

File content itself is not passed to the EVM. A declared HTML byte limit or PNG MIME does not prove valid content; actual file checks and writer honesty remain separate assumptions.
