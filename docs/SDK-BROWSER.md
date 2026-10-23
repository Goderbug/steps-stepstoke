# Browser SDK

STEPS (Stepstoke), deployed on Ethereum mainnet. The current reference is [CLI.md](CLI.md); checks and operating details are in [OPERATIONS.md](OPERATIONS.md).

`productionDeployment`: Ethereum mainnet (chain 1), receipt 0x6377bb6862896730e68c455685bd057d87ddeafca57633370df20c196479bad6 in block 26248821, contract source 751f3901d4453e1477828e4f7ef0d6af8bc03485. `liveCompatibility:NOT_RUN`, `productionReady:false`. The site is hosted with payments disabled; no paid execution occurred. Earlier source/review material is preserved in the indexed `docs/history` archive at the repository root, not used as current readiness evidence.

The website repeats verified deployment checks at public project-list and Branch-read boundaries. Chain, canonical deployment receipt or code drift revokes that deployment and its cached views until explicit re-verification succeeds. Disconnected or wrong-chain wallets still permit verified public reads. Deployment verification alone does not enable paid controls or prevent direct calls to permissionless contracts.

Attempt projections keep the original `txHash` and, when correlated, a separate `replacementHash` and `replacementState`. Account/nonce alone cannot establish a same-call replacement: destination and calldata must match too. All replacements use canonical receipts and twelve Ethereum confirmations before their journal outcome becomes final. Unknown, reorged and unfinalized outcomes retain the original hash and cannot authorize another purchase. Callback identity and contract phase remain the sole retry authority.
