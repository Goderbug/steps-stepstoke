# A1 SDK: shared core, Node and browser entrypoints

| Module | Runtime | Contents |
| --- | --- | --- |
| `sdk/core.mjs` | both | Canonical witness encoding/hash, proposal validation (name/path/prefix collision guards, `dist/` HTML-only rule, input/image limits, publication off), the six unsigned A1 transactions, reads, manifest verification, lifecycle reporting, `createFileVerifier(sha256)` |
| `sdk/strict-json.mjs` | both | Strict bounded raw-JSON parser and manifest projection (whole document validated including ignored metadata; duplicate decoded keys, UTF-8, depth/work limits). No `Buffer`: `utf8Length` and `decodeUTF8` |
| `sdk/abi.mjs` | both | GENERATED from `abi/*.json` by `tools/generate-sdk-abi.mjs` (`--check` verifies byte hashes). Removes the browser's need for `fs` |
| `sdk/config.mjs` | both | Local config generation from deployed code (`observeLocalDeployment`), re-verification (`verifyDeploymentConfig`), `publicConfigStatus` (CLOSED while `productionDeployment` is null) |
| `sdk/index.mjs` | Node | `export * from core` + `verifyFile` using `node:crypto`. Same exports as before; the CLI is unchanged |
| `sdk/files.mjs` | Node | Unchanged: public-HTTPS fetch with DNS pinning, `O_NOFOLLOW` file reads, `dist/` directory check |
| `sdk/browser.mjs` | browser | `export * from core` + `verifyFile` using ethers' pure-JS SHA-256, optional `webCryptoSha256`, browser file adapter |
| `sdk/files-browser.mjs` | browser | `createArtifactPolicy`, `fetchTrustedArtifact`, `readBlobBounded`, `verifyHTMLExport`, `base64`; TEST-ONLY `createLoopbackFixturePolicy` |

Import the browser build as `sdk/browser.mjs` (the root `package.json` `exports` field is protected
configuration and still names the Node entrypoint). The browser import graph contains no `node:*`
module, `fs`, DNS, HTTPS socket, `process` or `Buffer`; `test-sdk/browser-sdk.test.mjs` scans it and
also runs it in a Node process with `Buffer` deleted, and `tools/sdk-local-check.mjs --chrome` runs it
in real Chromium.

## Added helpers (both runtimes, no new product rule)

- `approveExact(imd, branch, amount)`: an exact, bounded ERC-20 approval as a separate unsigned
  transaction. Callers confirm `readAllowance(imd, owner, branch)` equals the fee before `sponsor`/`retry`.
- `readPrice(intake, action, imd)`, `readAllowance`, `readBalance`, `readFactory(factory, method)`;
  `queryState` decodes these as well as Branch reads.
- `toWalletRequest(prepared, { from, chainId })`: shapes a prepared transaction for the user's
  selected EIP-1193/EIP-6963 wallet (`eth_sendTransaction`, value 0). The SDK holds no key and never
  submits, retries or purchases on its own.
- `keccak256Bytes(raw)`: the callback `resultHash` over exact manifest bytes.

## Browser artifact downloads

`fetchTrustedArtifact(url, descriptor, { policy })`:

- URL must sit under an operator-configured HTTPS origin + path prefix (`createArtifactPolicy`); no
  IP literals, loopback, credentials or fragments.
- `credentials: 'omit'`, `referrerPolicy: 'no-referrer'`, `cache: 'no-store'`, `mode: 'cors'`.
- Every redirect is refused (`redirect: 'error'`). Configure the final artifact URL directly.
  `allowRedirects:true` is rejected: browser fetch hides intermediate hops, so checking only the
  final `response.url` cannot prove that all contacted hosts were approved.
- Content-Length checked against the MIME cap; the body is read as a stream and cancelled as soon as
  it exceeds the cap; then SHA-256, exact length, UTF-8/PNG/HTML signature are checked on the bytes.
- **DNS limit (disclosed):** browsers expose neither DNS answers nor the connected IP, so the Node
  adapter's public-address check and IP pinning cannot be reproduced. DNS rebinding of a configured
  host is not detectable from page code; the trusted-location list is an explicit configuration
  decision. Results report `dns: 'NOT_OBSERVABLE_IN_BROWSER'`.
- `createLoopbackFixturePolicy` is **test-only**: it is refused unless the page origin itself is
  loopback, and every result is labelled `TEST_ONLY_LOOPBACK_FIXTURE`.
- No proxy, indexer, signer or backend is needed.

## Local configuration

`node tools/generate-local-config.mjs --rpc http://127.0.0.1:PORT --factory 0x...` reads
`config/release.json` (read-only) and the chain, refuses non-local chain ids, checks the Factory's
and Branch implementation's `policyId`, the Branch `intake()`/`imd()` constants, code presence and
observed prices, compares SDK limits with the release, and prints a config labelled
`LOCAL_DEPLOYMENT` with runtime code hashes and ABI hashes, `productionDeployment: null`,
`liveCompatibility: NOT_RUN`, `productionReady: false` and the release's manifest risk. Where the file
is materialised for the site is decided by the integration (build-website) stage.

## Retained risk

Finite manifest limits may leave an authenticated oversized result unbindable. Nothing here adds an
unlock, timeout, raw-result rewrite, refund or automatic retry.
