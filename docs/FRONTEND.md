# Web app (W1): pages, actions, permissions and failure modes

The W1 app is a Chinese, responsive React/Vite/wagmi app. Its source is in `frontend/` and the committed static export is in root `dist/`. It uses relative asset paths and hash routes, so it works from any static host or gateway subpath. It has no backend, indexer, proxy or signer service. Every read goes straight to the configured RPC, and every write is an SDK-built unsigned transaction signed by the wallet the visitor selected.

This page describes the code as it is in `frontend/src/`. The contract behavior behind each action is in [CONTRACTS.md](CONTRACTS.md).

## Routes

| Route | What it is | Who can use it | Fails closed when |
| --- | --- | --- | --- |
| `#/` | Public mode. It explains that no public deployment is configured (`A1_INTEGRATION_PENDING`), lists what is missing, and shows the connected account/network and the pinned A1 source. **Create is disabled.** | Anyone; no wallet needed | Always closed in this release (`productionDeployment: null`). It never substitutes fixture or local data |
| `#/local` | Project list on the **actual local A1 contracts**, using `./local-config.json` | Anyone on a loopback page. Reads need no wallet; writes need a selected EIP-6963 wallet on chain 31337 | Missing config shows "缺少本地配置…". It also refuses to start if the page host is not `localhost`/`127.0.0.1`/`[::1]`, if the RPC or artifact URL is not credential-free loopback HTTP, if chain ≠ 31337, or if `kind` ≠ `LOCAL_DEPLOYMENT`. Deployed code hashes, policy ID, Factory/encoder/verifier/implementation and ABI digests must all match the config; any mismatch shows "部署核验失败：…". There is no fallback to fixtures |
| `#/local/b/<branch>` | Workspace for one Branch: assets, proposals, sponsorship progress, history and fork | Same as above | Branch not registered with the configured Factory ("Factory 未注册此分支"); Branch `factory`/`encoder`/`verifier` or proxy code mismatch |
| `#/demo`, `#/demo/b/<id>` | **Fixture** demo with two simulated accounts and a "simulate wrong network" switch. It never asks the real wallet to sign | Anyone | It is permanently labelled 演示模式. Fixture results are not chain evidence |

The header has one **Connect** control. It opens a sheet listing EIP-6963 wallets by name and icon, then Coinbase Wallet, and on phones "Open in MetaMask/Coinbase/Rabby/Phantom" (`frontend/src/wallet/`). A wrong chain shows a switch prompt. Disconnecting is always possible.

## Actions on `#/local`

Every write first shows a **签名前确认** (confirm before signing) review. Right before the wallet prompt, the adapter (`frontend/src/domain/chainAdapter.ts`) re-reads the account, chain, selected provider, anchor, witness, price and exact allowance. If anything changed, it refuses with "账户或网络已变更，请重新预览" or "签名前状态已变更，请重新预览" and you start over. While a signature or an unresolved transaction is in flight, every other write is locked ("已有签名或待对账交易，请等待"). Double-clicks therefore send one transaction.

| Action (button) | Contract call | Permission | Cost | Failure modes shown |
| --- | --- | --- | --- | --- |
| 创建项目根分支 → 预览创建 | `createProject(title + goal)` | Any connected account | Gas only, no AI purchase | Text over 512 bytes; wallet rejection; revert |
| 预览提案 (proposal form) | `propose` | Any connected account | Gas only, no AI purchase | Stale anchor (`StaleProposalError`, refresh and re-preview); input not in current witness; text over 1024 bytes; encoded body over 16384 bytes ("完整请求体超限"); path/name collision |
| Select a current proposal → **1. 授权精确额度** | `IMD.approve(branch, price)` | The sponsor (any account) | Gas | Price changed since preview ("价格或提案已变更…"); confirmed allowance not exactly the price ("确认后的 Branch 额度不是精确价格") |
| **2. 购买执行** | `sponsor(id, maxFee, witness)` | The same sponsor, after a confirmed exact allowance | **Exact current price in (Mock) IMD, never refunded** | Price above your max fee; action not sold (price 0); Branch not `Ready` ("分支仍在等待或已冻结…"); allowance ≠ price; account still has a pending nonce ("账户仍有待确认交易…") |
| **2. 购买重试** (after an authenticated status 1) | `retry(maxFee, witness)` | Any account, with a fresh quote and its own exact allowance | Exact price again, a new attempt | Only for the active attempt, delivered, status 1, same body hash ("只有认证状态 1 的相同请求体可以明确重试") |
| **提交原始结果绑定（不重新购买）** | `bind(rawManifest, oldWitness)` | Anyone | Gas only, no purchase | No authenticated result yet ("尚无可绑定的认证结果"); wrong bytes (keccak ≠ callback); verifier/policy rejection. The result stays recorded, so you can resubmit the correct original bytes |
| 从此检查点分叉 → 预览分叉 | `fork(parent, revision, witness, direction)` | Any connected account | Gas only, no AI purchase | Revision 0 or an unaccepted checkpoint; witness mismatch; empty direction |
| 刷新链上状态 | reads only | Anyone | — | RPC errors are shown and never treated as success |

Notes:

- **Proposals.** Every current proposal is selectable, in any order (no FIFO). Adding one does not move the anchor. A successful bind does, and older proposals then show as stale. Nobody can edit a proposal after it is made. Sponsoring commits to its exact body, which you can open under 查看完整请求体 (bytes / 16384, plus the keccak).
- **Continue** means proposing and sponsoring again on the same Branch. The body continues the Branch's own `latestJobId`. Saved assets keep their original producing Branch, job and revision.
- **Fork** creates a new Branch holding exactly the selected checkpoint's assets and provenance. It does not copy the parent's job, proposals or publishing identity. The child's first sponsored run opens a new project, and later runs continue it. Each run needs its own explicit approval and purchase.
- **Status display.** Transaction, admission, execution, callback, binding, files, Git and publication are shown as separate stages. A missing callback stays pending with no timeout. Authenticated status 2 or any unknown failure freezes the Branch for good. HTTP responses and result URIs cannot unlock or settle anything.

## Transaction journal and recovery

Before waiting for a receipt, the app writes the original hash, nonce, account, chain and operation to `localStorage` (`loadJournal()`, last 100 entries). That journal only helps matching. After a reload, state comes from the chain:

- The Branch phase, active attempt and `Sponsored` events are read again.
- If the journal is missing or corrupt, a connected account whose pending nonce is above its latest nonce is still treated as having an unresolved transaction, so no new purchase is offered.
- A dropped, replaced or unknown transaction is reported as such ("交易 … 结果未知。原哈希与 nonce 已记录；请刷新对账，不会自动重购。"). A replacement with the same call is recovered from the authenticated attempt on chain. **Nothing is ever bought again automatically.**

## Files and previews

Files are downloaded only from the configured `artifactBase`, at `<producerJobId>/<path>`, where the producer is the asset's **original** job. The download uses the browser SDK (`fetchTrustedArtifact`): bounded streaming, an approved scheme/host/path, **all redirects refused**, and byte length, SHA-256 and MIME signature checked against the on-chain descriptor. A badge (已校验) or preview appears only after that check passes. Otherwise you see "校验失败：内容不予预览，也不提供下载。"

- **Markdown:** rendered with `marked`, then sanitized with DOMPurify. External resources and active content are removed.
- **HTML:** shown in an `<iframe sandbox="">` with `referrerPolicy="no-referrer"` and a restrictive CSP in the `srcdoc`. That gives an opaque origin with no scripts, forms, popups, top navigation, storage or wallet access, and no network requests.
- **PNG:** shown from a blob URL of the verified bytes.

The local policy (`createLoopbackFixturePolicy`) is **test-only**. A public deployment would need configured trusted HTTPS artifact locations. Browsers cannot check DNS answers or the connected IP, so an approved host remains a trust decision ([SDK-BROWSER.md](SDK-BROWSER.md)).

## Accessibility and layout

There is a skip link and a visible focus ring. The wallet sheet traps focus, closes on Escape and returns focus to the control that opened it. On route changes, focus moves to `<main>`. Mobile controls are at least 16px, and long identifiers wrap. Layout was checked at 320/390/1440 px in Chromium and Playwright WebKit. Native screen readers, 200% zoom, RTL and physical phones are **NOT_RUN**. Design tokens are in [../DESIGN.md](../DESIGN.md).

## Scripts in `frontend/`

| Command | Purpose |
| --- | --- |
| `npm run build` | Typecheck + Vite build into root `../dist` |
| `npm run preview` | Serve `dist/` on port 4173 (`--strictPort`) |
| `npm run typecheck`, `npm run test:unit` | TypeScript; Vitest unit/security tests (30) |
| `npm run test:e2e` | Playwright **fixture** UI suite (simulated adapter) |
| `npm run local:setup` = `node scripts/local-setup.mjs` | Local Anvil + mocks + actual Factory + generated config |
| `node scripts/local-deliver.mjs --branch … --job … [--file] [--status]` | Deliver a mock writer callback with deterministic bytes |
| `npm run test:local` = `node tests/integration/browser-chain.mjs` | Browser-to-local-contract matrix (`--browser`, `--group`, `--out`) |
| `node scripts/audit-local-evidence.mjs DIR` | Re-encode every recorded wallet transaction with the Node SDK and check receipts |
| `scripts/check-integration.mjs`, `measure-submission.mjs`, `record-release.mjs`, `design-review.mjs`, `validate.mjs` | Worker audit helpers; they write reports under `docs/validation/integration/acceptance/` |
