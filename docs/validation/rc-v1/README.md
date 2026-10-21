# RELEASE-CANDIDATE-V1 evidence

Checked 2026-10-21 against the exact imported project, with the existing Foundry configuration. This is development evidence, not independent production approval. `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`.

## Final checks

| Check | Result |
| --- | --- |
| `forge build` | PASS, solc 0.8.26 / Cancun / viaIR / optimizer 200 / bytecode hash none |
| `forge test` | 138 tests, 17 suites, zero failures; fuzz/invariants included |
| Node SDK and measurement regressions | 52 passed |
| ABI/config/runtime fingerprint synchronization | PASS |
| Empty-chain constructors and exact documented three-name batch | PASS, disposable chain 1; backward references resolved from docs/CONTRACTS.md |
| Executable capability scan | No forbidden DELEGATECALL/CALLCODE/SELFDESTRUCT in launch or child creation/runtime code; zero external library links |
| Seven-round SDK/EVM flow | PASS, root plus independent historical child, all five profiles, explicit status-1 retry, exact approvals |
| Maximum binding and creation shapes | Eight bindings plus maximum goal and 16-asset fork PASS; full transaction calldata retained |
| Frontend typecheck/build and unit tests | PASS; 44 unit tests |
| Final static Chromium e2e | 72 passed at desktop and 320px width |
| Final actual local-chain browser suite | 16 desktop cases and 4 mobile flow cases PASS, no page/console errors or unexpected requests |
| Configured Ethereum browser adapter | Four checks PASS on actual candidate contracts on disposable chain 1, using explicitly intercepted local HTTPS transports; no production deployment |
| Public CLI reads | Original snapshot, artifact SHA-256/length/MIME and Intake observation PASS; no public transactions |
| Exact official free body checks | Eight have no blockers; two HTML-update samples return expected invalid_artifacts for local-only input |
| Formatting/diff/protected paths | PASS; protected configuration/dependencies untouched |
| Historical archive/predecessor integrity | PASS, including every indexed immutable binary blob and original fixtures |

Fuzz seed: `0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5`. The larger state-machine suite runs 256 invariant campaigns / 24,576 calls; the conservation suite runs 128 / 8,192 calls. Default fuzz campaigns ran 256 inputs each; the extended regression campaigns declare 1,000 runs. Tests include stale anchors, unauthorized/repeated old initialization selectors, independent payers, root/fork checkpoint integrity, child open/continue, callback sender/request/duplicate/mismatch, exact token movement/allowance, reentrancy and refusal/failure behavior.

WebKit was NOT_RUN: its downloaded engine needs system libraries unavailable here. Real mobile wallet apps, Coinbase passkey execution and paid mainnet work were not exercised. Chromium EIP-6963 tests use disposable unlocked local actors. The JSON schema is supplied as Draft 2020-12; runtime production-gate semantics have regression tests. A separate Python JSON Schema engine was unavailable (ModuleNotFoundError: jsonschema), so no independent schema-engine validation is claimed.

## Actual candidate sizes

| Contract | Runtime bytes | Raw initcode bytes |
| --- | ---: | ---: |
| RelayFactory | 21,195 | 21,475 |
| RelayBranch | 12,876 | 16,219 |
| RelayEncoder | 11,498 | 11,524 |
| RelayVerifier | 14,544 | 14,570 |

Factory launch initcode includes 64 static argument bytes: 21,539 bytes total. The measured maximum-shape runtime child has 30,875 initcode bytes, including all constructor arguments. Runtime EIP-170 limit is 24,576; initcode EIP-3860 limit is 49,152. All candidate product code fits.

## Full local transaction gas

| Operation | Calldata bytes | Intrinsic gas | Receipt gas | Net execution gas |
| --- | ---: | ---: | ---: | ---: |
| three named constructors in one atomic batch | 48,132 | 774,708 | 10,357,822 | 9,583,114 |
| maximum 512-byte root goal | 580 | 29,536 | 3,419,527 | 3,389,991 |
| full 16-asset fork with 512-byte goal and direction | 13,924 | 158,956 | 4,653,154 | 4,494,198 |
| deploy RelayEncoder | 11,524 | 236,954 | 2,539,029 | 2,302,075 |
| deploy RelayVerifier | 14,570 | 285,316 | 3,197,314 | 2,911,998 |
| deploy RelayFactory with static dependencies | 21,539 | 390,020 | 4,634,480 | 4,244,460 |
| SDK create project | 100 | 21,856 | 2,874,652 | 2,852,796 |
| SDK propose html-3.html | 2,116 | 36,388 | 1,250,060 | 1,213,672 |
| SDK sponsor html-3.html | 1,540 | 32,308 | 2,628,224 | 2,595,916 |
| mock result callback html-3.html under 200k stipend | 612 | 29,712 | 125,859 | 96,147 |
| SDK bind html-3.html | 2,052 | 40,116 | 884,814 | 844,698 |
| SDK fork historical revision 1 | 964 | 28,108 | 3,055,659 | 3,027,551 |

All 43 flow receipts, declared gas limits and calldata are retained in the archive. The maximum declared limit is 16,777,216 and every final flow/binding/creation transaction satisfies that declared-limit ceiling. The old harness's 29–30M declared limits were a reproduced evidence defect; the regression and previous flow are retained and explicitly superseded. Receipt usage alone does not establish EIP-7825 validity.

Branch call traces measure result callback execution at 61,958 gas and failure callback at 61,332 gas. Separate tests exercise a 1,024-byte URI under the official 200,000 stipend and confirm a larger URI remains undelivered/pending. The mock completion outer call includes raw result calldata; the real service completion ABI carries hash/URI, so outer mock costs are not quoted as live service costs.

| Stress shape (16 assets, maximum-width descriptors and 512-byte goal) | Raw JSON bytes | Full receipt gas |
| --- | ---: | ---: |
| 110-key combined complexity | 26,180 | 12,022,843 |
| 498-value escaped-unicode combined complexity | 15,648 | 10,635,059 |
| maximum escaped key bytes | 32,768 | 13,576,162 |
| maximum ignored number | 32,768 | 10,539,964 |
| maximum whitespace | 32,768 | 11,312,296 |
| maximum ASCII strings | 32,768 | 12,422,485 |
| maximum escaped strings | 32,768 | 12,868,029 |
| maximum wide objects | 32,768 | 12,859,768 |

The largest measured shape uses 46,116 calldata bytes, 674,544 ordinary intrinsic gas and 12,901,618 net execution gas. Its EIP-7623 floor is 1,654,860. These are measured shapes, not a proof of a universal maximum. The observed Ethereum block gas limit was 60,000,000; the launch service's gas/calldata limits remain unknown. See [limits](../../LIMITS.md).

## Original results and protocol evidence

Four original public snapshots match Ethereum Completed result hashes exactly; all have zero files and remain unsupported by the one-output binder. Their current job-result HTTP responses differ byte-for-byte. Exact Solidity/SDK tests reject unsupported binding without granting purchase/retry rights. A 1,230-byte actual one-file result equals the embedded Solidity fixture byte-for-byte and binds in local tests. Public 2/4/17-file HTTP results are explicitly rejected/unsupported and are not labelled callback-authenticated. No authenticated real oversized envelope was obtained.

Current official docs/catalog/free-check responses, EIP-7825, initial rejected bodies and final exact encoder bytes are archived. Public chain reads are attributed to https://ethereum-rpc.publicnode.com. [Protocol details](../../PROTOCOL-OVERVIEW.md) distinguish free syntax approval, HTTP observations, authenticated snapshots and live execution.

## Files and recovery

- [Measurements](measurements.json): compact sizes, all operation gas, maximum shapes and limitations.
- [Archive index](archive-index.json): SHA-256 and byte count for every raw evidence file.
- [Current evidence archive](current-evidence.tar.xz): raw requests/results, receipts/calldata, exact disassembly, constructor replay, Foundry/Node/browser logs and preserved intermediate failures.
- [Rendered review](rendered-review.json), [desktop](desktop.webp), [320px](mobile-320.webp): actual final static export. Historical artifact text remains unchanged.
- [Ethereum read evidence](ethereum-read-evidence.json), [authenticated result index](authenticated-results-index.json) and [multi-file observations](public-multiple-file-observations.json).
- `source-manifest.json`: SHA-256 of final reviewed source, tests, ABI, config, tools and export; `delivery-size.json`: final payload size excluding caches and provided inputs.
- [Historical recovery](../../history/README.md): original text/failures and verified immutable predecessor references; no future head is substituted.

Extract current evidence into a separate directory:

```sh
mkdir -p /tmp/steps-current-evidence
tar -xJf docs/validation/rc-v1/current-evidence.tar.xz -C /tmp/steps-current-evidence
```

Current archive: 196,572 bytes; SHA-256 `a5ff5a35eb4909806d6b35e75ad429d899a94b1cb373146daef2f55e435d05a6`. The compact disassembly retains every opcode and PUSH immediate; widths reconstruct byte offsets and JUMPDEST labels give absolute offsets. R/U is the supplied protected reachability floor, not a formal proof. The JSON form can be regenerated with the delivered inspector.

Initial failures are retained alongside final passes: constructor-expectation harness ordering, missing Workspace helper import, old path/policy/SDK expectations, renamed UI text expectations, old initializer selector compile typo, public download locator harness and declared-gas accounting. Contract/profile fixes and test-harness-only corrections are distinguished in ADAPTATION.md. A failed raw binding is never relabelled accepted.

All open security, service-policy, protocol-envelope and gas gates remain in [REVIEW.md](../../REVIEW.md) and `config/production-gate.json`. This evidence does not authorize or prove a launch.
