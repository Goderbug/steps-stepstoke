# SDK / CLI local check record

Date: 2026-10-20 (offline local run)

Historical SDK contributor record: the 17 tests below predate the three network-guard regressions. The integrated suite has 20 tests; see [final validation](../validation/README.md) and [the documentation-pass replay](../validation/documentation-pass/README.md). These raw results are preserved as originally recorded, not relabelled as a newer run.

Command:

```text
node --test test-sdk/*.test.mjs && node --check sdk/index.mjs && node --check sdk/files.mjs && node --check cli/relay.mjs && git diff --check
```

Raw output:

```text
✔ actual HTML directory rejects symlinks/extras and verifies exact inline image bytes without execution
✔ public artifact fetcher rejects local, credentialed and unsupported sources before any artifact is read
✔ vendored ethers is exactly 6.17.0 and every locked dependency is present offline
✔ all six functions have unsigned ABI transaction/read preparation
✔ proposal zero, unsigned funding caps, publishing and invalid inputs are rejected
✔ client rejects fixed-profile violations before it prepares a purchaseable proposal
✔ raw binding preserves exact bytes and refuses a reserialization with a different digest
✔ canonical witnesses sort, retain provenance, detect duplication and encode deterministically
✔ SDK golden witness and calldata are shared with executed Solidity tests
✔ history is recoverable from full witness logs and permanent checkpoint reads
✔ optional EIP-1193 querying makes eth_call only and decodes the prepared ABI read
✔ actual Markdown, HTML and PNG bytes verify length, SHA-256 and MIME signature
✔ strict raw parser rejects Unicode, duplicates, trailing content and excessive resources
✔ unknown transactions never trigger an automatic rebuy; stages remain separate
✔ lifecycle status never treats a receipt as admission, execution, file, Git or publication proof
✔ CLI prepares calldata without any RPC, key or signer
✔ CLI recovers authenticated checkpoint history from explicit local evidence only
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

`node --check` and `git diff --check` produced no output and completed successfully.

Focused CLI status observation command:

```text
node cli/relay.mjs status --phase 3 --checkpoint-verified false --file-verified false
```

Raw output:

```json
{
  "transaction": "UNKNOWN",
  "admission": "NOT_OBSERVED",
  "execution": "NOT_PROVEN_BY_TRANSACTION",
  "callback": "RESULT_RECORDED",
  "binding": "REQUIRED",
  "file": "NOT_CHECKED",
  "git": "NOT_OBSERVED",
  "publication": "DISABLED",
  "automaticPurchase": "NEVER"
}
```

Structured CLI failure check:

```text
node cli/relay.mjs send
```

Raw stderr (exit status 1):

```json
{"ok":false,"error":{"code":"INVALID_INPUT","message":"Unknown command; use help"}}
```

Assumptions: ABI files in `abi/` are the delivered contract ABI; local fixtures are static,
checked bytes rather than public-plane responses; and the EIP-1193 stand-in represents only the
optional `eth_call` boundary. No real wallet, IMD approval, paid request, callback, or deployment
was used.
