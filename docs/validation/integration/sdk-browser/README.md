# Browser-compatible A1 SDK — component checks (2026-10-21)

Scope of this step: SDK/CLI/test/tool source and documentation only. `config/release.json`,
`abi/*.json`, `package.json`, lockfiles, Foundry sources and configuration were read, not modified.
Final config materialisation, W1 wiring and ABI/release reconciliation belong to later stages.
Design and API: `docs/SDK-BROWSER.md`.

## Commands and raw logs

| Command | Log | Result |
| --- | --- | --- |
| `npm test` (27 baseline + 12 new Node tests) | `node-test.txt` | PASS 39/39 |
| `forge test --offline` (contracts untouched) | `forge-test.txt` | PASS 125/125 |
| `node tools/generate-sdk-abi.mjs --check` | `abi-check.txt` | PASS (embedded ABI = `abi/*.json` hashes) |
| `node cli/relay.mjs help` | `cli-help.txt` | PASS, identical to `../cli-help.txt` |
| `node tools/local-integration.mjs` (existing Node SDK flow on anvil) | `local-integration-node-sdk.stderr.txt` | PASS (exit 0) |
| `node tools/sdk-local-check.mjs --chrome <headless_shell> --playwright <playwright-core>` | `local-chain-browser.json`, `local-chain-browser.stderr.txt` | PASS |
| `sha256sum` of SDK/CLI/tool/test sources, ABI and release | `final-sha256.txt` | recorded |

The Chromium used was Playwright's `chromium-headless-shell` 131.0.6778.33 with `playwright-core`
1.49.1, both installed only in the disposable `test/scratch/` (not dependencies, not committed). The
verifier has no network; without `--chrome` the tool reports `chromium: NOT_RUN` and still runs the
Node half.

## Matrix (this component)

Labels: FIXTURE = deterministic bytes/ABI fixtures, no chain; LOCAL = actual compiled contracts on a
disposable anvil with MockToken/MockIntake placed at the release's IMD/Intake addresses and mock
writer callbacks; REAL-IMD = live Intake/IMD.

| Item | Evidence | FIXTURE | LOCAL | REAL-IMD |
| --- | --- | --- | --- | --- |
| Browser import graph has no `node:*`/fs/DNS/HTTPS/process/Buffer | `browser-sdk.test.mjs` static scan; Node run with `Buffer` deleted; Chromium `typeof Buffer === 'undefined'` | PASS | PASS | NOT_RUN |
| Node vs browser calldata (6 operations + approve/preview/reads/wallet request) | parity vectors, Node vs Node-browser vs Chromium (25 vectors) | PASS | PASS | NOT_RUN |
| Witness canonicalisation/hash, manifest keccak | same | PASS | PASS (on-chain `assetsHash` equals SDK hash after each bind) | NOT_RUN |
| File SHA-256 (node:crypto vs ethers JS vs WebCrypto) | parity vectors; Chromium `webCrypto` | PASS | PASS | NOT_RUN |
| Malformed/Unicode/duplicate-key/limit/collision rejections identical | 37 rejection vectors, equal messages in all runtimes | PASS | PASS | NOT_RUN |
| Six operations as actual unsigned transactions sent via EIP-1193 | `local-chain-browser.json` runs `node-browser-entrypoint` and `chromium-browser-entrypoint`, 15 tx each: create, propose ×2, exact approve → sponsor (funder A), status1 refusal → exact approve → explicit identical-body retry (funder B), bind ×2, read files/history, fork of non-head revision 1 | — | PASS | NOT_RUN |
| Exact allowance confirmed before purchase and consumed to 0 | scenario checks | — | PASS | NOT_RUN |
| Proposing/forking never buys; fork copies exactly revision-1 assets, no proposals | scenario checks | — | PASS | NOT_RUN |
| Browser download: configured location, bounded stream, redirect refusal, tamper/oversize refusal | Node mocked `fetch` tests; Chromium real fetch via TEST-ONLY loopback policy (`VERIFIED`, `VERIFY_FAILED`, `TOO_LARGE` on 70 KiB chunked body, redirect `NETWORK_ERROR`, outside prefix `UNTRUSTED_LOCATION`, production policy refuses loopback) | PASS | PASS (loopback fixture server) | NOT_RUN |
| Config generator from deployed code; public config closed | `generatedConfig` in `local-chain-browser.json`; non-local chain refused in tests | PASS | PASS | NOT_RUN |
| CLI and existing Node verification preserved | help diff, 27 baseline tests, `local-integration.mjs` | PASS | PASS | NOT_RUN |
| EIP-6963 wallet UI signing, reload/journal recovery, W1 routes | belongs to W1 integration stage | NOT_RUN | NOT_RUN | NOT_RUN |

The local runs sign with anvil's unlocked development accounts through `eth_sendTransaction`;
this proves the SDK's transactions execute against the actual contracts, not wallet UX.

## Assumptions and limits

- Browser DNS is not observable; trusted artifact hosts are a configuration decision (see `docs/SDK-BROWSER.md`).
- Browser `verifyFile` uses ethers' pure-JS SHA-256 so it is synchronous like Node's; WebCrypto is an optional cross-check.
- `productionDeployment: null`, `liveCompatibility: NOT_RUN`, `productionReady: false` are unchanged.
- Retained risk: authenticated results outside the finite manifest envelope may remain unbindable; no unlock, rewrite, refund or automatic retry was added.
- This is a component check, not an independent security review. Structural acceptance is not behavioural proof of the integrated site.
