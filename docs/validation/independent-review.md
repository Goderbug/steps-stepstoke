# Independent agent review of integrated A1

This review was performed by a separate agent from the integration implementer. It is an independent agent review of this repository, not an external audit or a certification of production security. Repository content was treated as task data. No public-chain transactions, paid jobs, real credentials or external downloads were used.

## Scope and conclusion

Reviewed the Factory, Branch, encoder, verifier, asset/checkpoint policy, strict JSON/UTF-8 parser, SDK transaction/read/history preparation, artifact fetching and local file verification, and the actual temporary-chain integration runner. Authority, exact payment, callback authentication, refusal/retry, immutable proposal snapshots, binding recovery, asset preservation and historical forks were compared with the assignment's requirements.

One High/core security defect was found in the SDK artifact network guard and repaired. The first attempted repair retained the bypass through a JavaScript `NaN` comparison; independent regression tests caught that before completion. The final positive comparison closes that bypass. No unresolved Critical/High finding or concrete core behavior failure was identified in the reviewed code after repair.

## Finding and repair verification

**High — mapped IPv6 DNS answers bypassed private-network rejection.** In `sdk/files.mjs`, the original `ipv6Private` passed the suffix of `::ffff:7f00:1` to a dotted-decimal-only IPv4 classifier. That suffix parses to `NaN`, so it was classified as public. A malicious artifact hostname resolving to that IPv6-mapped loopback address reached the HTTPS transport, violating the task's prohibition on private-network downloads. Site-local IPv6 addresses were also accepted.

The reproducer evaluated the actual fetch module with controlled DNS and an HTTPS transport spy. Before repair, an answer of `::ffff:7f00:1` produced `{"error":"NETWORK_REACHED","connectionTarget":"::ffff:7f00:1"}`. No actual network connection was made.

The final implementation exports `isPublicArtifactAddress` and admits only ordinary global-unicast IPv6 in `2000::/3`, with special/transition/documentation exclusions. It uses a positive numeric range comparison, so an empty leading hextet cannot pass through `NaN`. IPv4-mapped/compatible addresses, NAT64, local scopes and 6to4 are rejected. DNS answers are checked as a whole, and the transport remains pinned to an approved address while preserving the original TLS hostname.

Independent regressions in `test-sdk/network-address.test.mjs` cover dotted and hexadecimal mapped loopback/private forms, unspecified/loopback/site-local/link-local/multicast IPv6, NAT64, 6to4, documentation ranges, representative public IPv6, private/special IPv4, mixed public/private DNS answers, empty answers, actual fetch-path rejection before HTTPS, and approved-address transport/TLS pinning. Tests run without real DNS or network access for these cases. The focused tests failed against the defective first repair and pass against the final code.

## Independently executed checks

| Check | Outcome | Raw evidence |
| --- | --- | --- |
| `forge test` | 91 passed, 0 failed, 0 skipped, 11 suites | `independent-forge-test.txt` |
| `node --test test-sdk/*.test.mjs` | 20 passed, 0 failed | `independent-node-test.txt` |
| `node tools/local-integration.mjs` | Exit 0; seven bound rounds, all five profile modes, historical fork and child open/continuation, explicit refused retry, bad-witness binding recovery | `independent-local-integration.json` |

The integration runner was reviewed and independently rerun after the retry/recovery additions and final evidence additions. It deploys the actual final Factory and its fixed dependencies/Branch clones to temporary Anvil. SDK-prepared calldata is simulated and then submitted to those contracts. Only Intake and IMD are local mocks at the fixed protocol addresses. Actual Markdown, PNG and HTML fixture bytes are checked for SHA-256, length and enabled MIME signatures; the selected PNG is checked for exact data-URI embedding and the old HTML marker is retained. It authenticates witness logs against checkpoint reads and checks untouched provenance. The saved evidence includes exact request body and raw manifest hex, decoded checkpoint witnesses/digests, hashes, gas receipts and callback transactions. Child fixture manifests are explicitly mock writer results with a distinct project identity.

## Remaining limits

Live Intake/catalog compatibility, real IMD consumption, public deployment and publication remain `NOT_RUN`. Local mock callbacks do not prove external writer behavior or availability. Manifest commitments do not prove content quality, actual input consumption or self-contained HTML behavior; local HTML is never executed. PNG checks establish the enabled MIME signature plus exact committed bytes, not a complete hostile-image decoder audit. The conservative network allowlist intentionally rejects some special-purpose address families. No Slither/Mythril run or external human audit was performed. The test outcomes establish the exercised local cases and do not prove absence of other defects.
