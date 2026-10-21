# SDK, CLI and read-only tools

The Node SDK (`sdk/index.mjs`) and browser SDK (`sdk/browser.mjs`) share encoding, canonical witnesses, strict raw parser, exact runtime verification and limits. Vendored ethers is the delivered runtime dependency. Root `cto-relay`/package identifiers remain technical compatibility names; the product is STEPS/Stepstoke.

Run `node cli/relay.mjs help` for exact options. Commands return unsigned calldata or read requests; they never sign, broadcast or retry. `create`, `propose`, `preview`, `sponsor`, `retry`, `bind`, `fork`, `read`, `witness`, `decode-checkpoint` and `recover-history` preserve their prior argument separation. Amounts are integer base units (IMD has 18 decimals), never floating point. The SDK's `approveExact` prepares a separate exact Branch allowance; approval is not purchase.

`result-fetch --uri URI --hash CALLBACK_KECCAK [--gateway HTTPS_IPFS_BASE]` fetches original bytes, enforces the recorded hash and 32 KiB bound, and returns raw hex. It does not parse and reserialize. `intake-read --tx ORIGINAL_PURCHASE_HASH` reads `GET /intake/1/<hash>` with `settlement:false`. `file-check`, `html-check` and `fetch-check` check descriptor/content integrity only. Supplied file paths are explicit operator inputs, never filesystem paths copied from an untrusted manifest.

`observeDeployment(provider,{release,factory,chainId:1})` requires the provider already be on chain 1. `observeLocalDeployment` is deliberately limited to chain 31337. Exact runtime validation normalizes only compiler-reported immutable slots and requires repeated slots for each immutable to agree, then validates actual dependency getter values. ABI/code/policy drift fails closed. A public provider must be explicitly chosen; no function silently switches a wallet.

`node tools/observe-ethereum.mjs CONFIRMED_FACTORY [HTTPS_RPC]` emits a read-only observation. It does not invent an address, readiness or deployment receipt. See [operations](OPERATIONS.md) for the later frontend handoff fields.

`node tools/check-official-bodies.mjs` runs the candidate encoder on its own disposable local chain and prints exact raw request bytes and hash for every profile/open/continue case. Adding `--free-check` sends only `POST https://api.imd.fun/requests/check`; this is free validation and never an order. The built-in Markdown descriptor and parent are explicitly sourced public observations; HTML inputs are labelled local fixtures and expected to be refused by public validation. These samples are not ready-to-buy user requests or live proof. `tools/validate-live.mjs BODY_OF_RESULT_JSON` only makes a preflight packet from an actual eth_call result and contacts no service.

The original result callback/event and exact chain checkpoint remain the authority. No SDK, CLI, file download, local journal, Git record or free check can move a Branch out of Pending/Recorded/Frozen or authorize a new purchase.
