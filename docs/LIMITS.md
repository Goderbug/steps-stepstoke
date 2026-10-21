# Finite limits and gas gates

The candidate retains 16 assets, 8 selected inputs and exactly 1 declared output. The result may list extra produced files, but only the unique declared name/path is admitted. Name or path collisions reject binding. Extra files remain authenticated JSON and consume the same raw/complexity budgets; they never become accepted assets. A reserved slot remains available for each enabled asset kind. New asset names are 1–64 ASCII identifier bytes starting with a letter; paths are portable relative ASCII up to 128 bytes. Goal/direction are bounded at 512 UTF-8 bytes each; request text at 1,024 bytes. The complete encoded request is bounded at 16,384 bytes. The official API's larger text/input limits do not enlarge these product limits.

| Item | Candidate bound |
| --- | ---: |
| Original result JSON | 32,768 raw bytes |
| Markdown file | 65,536 bytes |
| HTML file | 2,097,152 bytes |
| PNG file | 262,144 bytes |
| Selected PNG total | 524,288 bytes |
| Callback URI | 1,024 bytes |
| JSON depth / object members / key bytes | 16 / 128 / 256 |
| Total JSON values / decoded key bytes | 512 / 2,048 |
| Retained tokens / retained string bytes | 256 / 1,024 |
| Combined parser work | 65,536 |

Combined work is `rawBytes + 96*totalValues + 8*totalDecodedKeyBytes + 4*priorKeyComparisons`. All metadata is syntactically validated, including duplicate escaped keys, invalid UTF-8/scalars and malformed numbers; only acceptance fields are retained. Unknown fields are not stripped from the bytes or hash. The combined budget can reject a document smaller than the raw byte cap. Metadata limits and unsupported deliveries remain explicit, finite release gates.

HTML has one slot, including legacy `dist/index.html` versus new `artifacts/index.html`. Selected image Base64 overhead is charged against the HTML bound. Publishing and image editing remain off. SDK and contracts enforce matching limits; byte content checks additionally occur off chain and are never settlement authority.

## Measurements

See [actual candidate sizes and full transaction measurements](validation/rc-v1/measurements.json). Every launch runtime is below EIP-170's 24,576 bytes; raw creation bytecode is below EIP-3860's 49,152 bytes. The static Factory arguments add 64 bytes to its launch initcode. Dynamic runtime-child arguments are bounded by product checks; the full-witness fork transaction is measured separately. The final branch is full code, not a 45-byte clone.

Local transactions record complete calldata, zero/nonzero bytes, ordinary intrinsic gas, Prague EIP-7623 calldata floor, declared gasLimit, receipt gasUsed and net execution (receipt minus ordinary intrinsic). Net execution includes refunds/floor effects and is not an opcode trace. The reproducible tool uses a 16,777,216 declared transaction gas-limit ceiling for the batch and binding stress runs; the public observed block limit is 60,000,000. A block limit is not a per-transaction or launch-service guarantee.

Eight final synthetic manifest shapes use a complete 16-asset witness and include maximum raw ASCII, escaped strings, wide metadata, escaped keys, numbers, whitespace and combined-work boundaries. The worst measured shape is identified in the final evidence table. The historical roughly 13.85M-gas case is retained in the byte-recoverable history. Passing selected shapes is not a proof that every admitted input has a safe global maximum.

The ordinary seven-round flow measures deployment, full root creation, historical full child creation, all profiles, exact approvals, purchase, refusal/retry, callbacks and binding. MockIntake stores complete bodies, unlike the real Intake's event-only body path; mock completion takes the raw manifest, unlike real completion's hash/URI. Therefore local purchase/completion transaction totals are **not** claimed to be live service costs. Call traces additionally measure the Branch result callback at 61,958 execution gas and failure callback at 61,332 in the ordinary local flow. Stipend tests separately prove Branch callback behavior at 200,000 gas, including maximum URI and undelivered-overlimit behavior.

The service's total deployment/bind gas and calldata ceilings are not published in the observed reference. Final source simulation through that service and a global gas/security review remain OPEN. Multi-file selection is supported within existing bounds; oversized/over-complex deliveries remain unsupported. Captured HTTP replay and synthetic envelopes do not establish live all-profile compatibility. No size/gas/policy blocker may be waived silently for launch. Revision measurements are recorded separately from historical measurements in [revision evidence](validation/multi-file-revision/README.md).

The EIP-7825 reference (https://eips.ethereum.org/EIPS/eip-7825, saved with current evidence) states: “This cap applies regardless of the block gas limit set by miners or validators.” The tools explicitly use its 16,777,216 gas budget; no claim about a launch-service allowance is inferred from that protocol ceiling.
