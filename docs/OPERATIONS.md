# STEPS operator runbook

Release candidate only: `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. Ethereum chain 1 is the sole public target. No mainnet transaction is authorized by this document. Sepolia cannot execute the required Intake job actions. Local chain 31337 is a disposable test mode, never a substitute for live evidence.

## The six operations

1. **Create** fixes the project goal and deploys a full Branch through RelayFactory. It costs gas only and buys no IMD work. Check the registered Branch and its product Factory before using it.
2. **Propose** selects the current checkpoint, fixed profile, target and explicit input assets. Show exact `bodyOf` bytes, action and body hash. A proposal pays nothing. Stale anchors fail before purchase. New named outputs live under `artifacts/`; accepted historical descriptors remain exact.
3. **Fund explicitly** reads the current `priceOf` and exact proposal body. Review nonrefundable cost and current parent job. Approve exactly that price to the **Branch**, then separately confirm the purchase with the same explicit maxFee. The Branch pulls the exact price, approves Intake for exactly that price, buys once and clears allowance. No autoapproval, autosigning, spending timer or automatic retry exists.
4. **Inspect** reads the purchase receipt, authenticated callback, bound checkpoint, original raw result and independently verified files as separate facts. The selected checkpoint, current latest checkpoint and each asset's original producer are different identities. A transaction receipt is not successful work; a file/Git/HTTP observation is not settlement.
5. **Continue** prepares work at the Branch's current checkpoint; it does not purchase. If the Branch has its own latest accepted job, encoding uses `job.continue` and that job. The selected old input file still uses its original producer/submission hash. Changing inputs never rewrites the continuation parent.
6. **Historical fork** uses the selected accepted revision and exact complete witness even after later parent purchases. It creates a separate Branch/payer with inherited asset provenance and no own project/job. Its first purchase uses `job.open`; only after acceptance does it continue its own latest job. The parent is unchanged.

## Results and failures

| Observed state | Permitted next step |
| --- | --- |
| Transaction unknown or pending | Read original hash and nonce; reconcile. Never rebuy because a timeout, reload or missing local journal occurred |
| Callback missing | Remain Pending. Read-only HTTP diagnostics may explain progress but cannot release the state |
| Authenticated status 1 | Only an explicit, separately funded identical-body retry of that attempt; new price/allowance/maxFee confirmation is required |
| Authenticated status 2 or unknown failure status | Frozen permanently; no recovery authority |
| Authenticated result recorded | Retrieve the original bytes from the recorded URI, verify keccak, and bind separately |
| Invalid/oversized/multi-file binding | Keep the same recorded result; diagnose without stripping metadata, synthesizing a smaller document, changing the hash or purchasing again |

Only Intake and the Branch's own pending request may deliver the result/failure. Duplicates, cross-Branch requests and impersonation revert. The callback only stores/emits under 200,000 gas. Parsing and checkpoint construction occur later. The 1,024-byte URI bound is a candidate limit: official documentation gives no universal maximum URI length. Above it the callback is undelivered and the Branch stays pending.

`Download original result` verifies the authenticated Branch event and its attempt hash. The supported HTTP snapshot location is `https://api.imd.fun/intake-results/<id>`. An `ipfs://CID/result.json` needs an explicitly configured trusted HTTPS `/ipfs/` gateway; no silent fallback occurs. Preserve raw bytes exactly. `/jobs/<id>/result` may change after completion and is not a substitute unless its exact hash independently matches. Browser original-result downloads stop at 32,768 bytes; unsupported larger files must not be trimmed to pass.

Artifact downloads use the accepted descriptor SHA-256, byte length and MIME; public files are addressed by hash under `https://api.imd.fun/artifacts/`. HTML preview is isolated, scripts/forms/network disabled; a downloadable exact original file and a sanitized preview serve different purposes. File integrity does not validate all content or settle a Branch.

## Public configuration and wallet behavior

A later confirmed handoff supplies the Factory address, deployment transaction/block/hash and exact deployed dependencies. `node tools/observe-ethereum.mjs CONFIRMED_FACTORY [HTTPS_RPC]` is read-only and refuses other chains. Record its observed runtime/ABI hashes. For the frontend's `ethereum-config.json`, add the confirmed deployment block, credential-free HTTPS RPC, optional trusted IPFS gateway, and the independently approved production-gate record to that observation. Do not turn a local-config address into a public address.

The adapter verifies the chain, product code, immutable dependencies, registration, policy and checkpoint witnesses. Writes require all six evidence gates and a matching deployment. Connect supports discovered EIP-6963 browser wallets, Coinbase Wallet/Smart Wallet and mobile wallet-browser links. A wrong network requires the user to choose the visible switch control; reads and signing preparation never switch implicitly. Every signing step rechecks the selected account/network/provider and proposal state.

Recovery retains original hash, account, chain, nonce and calldata. Replacement search is bounded to the last 128 blocks. An older unresolved nonce remains unknown, not permission to spend. Public log scans are chunked at 2,000 blocks and bounded at 100,000 blocks/10,000 logs per call; older deployments need an authenticated indexed/paginated history extension before this default frontend can serve the entire history. Exceeding a bound fails visibly rather than fabricating an empty history. This scalability gate is open.

## Before a later launch

Review [REVIEW.md](REVIEW.md) and the production-gate schema/data. Obtain final independent security review, explicit runtime-child policy acceptance, service simulation limits, real result-envelope evidence for every profile and properly authorized live checks. Refresh official deployment/action/price/code evidence. Replay the final three-name batch and include full calldata in the service simulation. Keep no material security/size/gas/policy blocker open. Only the later manifest assignment creates `launch.json`; only an independently authorized launch process may sign/broadcast. Platform publication later is separate from per-round site publishing, which remains disabled.
