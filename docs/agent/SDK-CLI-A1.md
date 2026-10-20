# CTO Relay Station A1 SDK / CLI

The Node ESM SDK prepares ABI calldata only. It has no wallet, signer, private-key loader,
transaction broadcaster, indexer, database, browser, or automatic retry path.

## Six operations

| Operation | SDK export | CLI command |
| --- | --- | --- |
| Create root project | `createProject` | `create` |
| Propose work | `proposeWork` | `propose` |
| Explicitly sponsor | `sponsorProposal` | `sponsor` |
| Explicit funded retry | `retryRefused` | `retry` |
| Bind raw result | `bindResult` | `bind` |
| Fork accepted history | `forkHistory` | `fork` |

`previewProposal` and `readState` prepare only `eth_call` requests. `queryPrepared`,
`queryState`, and `queryPreview` accept an optional EIP-1193 object with `request`; they issue
only `eth_call`, never `eth_sendTransaction`, account enumeration, signing, or chain switching.
`recoverHistory` authenticates explicit `CheckpointWritten` logs against independently obtained
checkpoint reads. The CLI `recover-history` command consumes only supplied local JSON evidence.

The client performs fixed-policy checks known before a purchase: sorted current witness, slots,
profile/output mapping, selected current inputs, mandatory update target, disabled publication,
disabled image-reference mode, and conservative image data-URI overhead. It still does not claim
that a prepared call will execute: phase, anchor, fee, and competing transactions must be read or
simulated at the point of use.

## Artifact bytes and observations

`verifyManifest` retains the exact raw manifest digest; it never parses and reserializes a result.
`verifyFile` verifies SHA-256, stated byte length, enabled MIME, UTF-8/HTML signatures, and PNG
signature. `verifyHTMLDist` accepts an explicit local directory only when it has precisely one
regular `index.html`, and checks selected PNG data URI bytes without executing HTML.

`fetchPublicArtifact(url, descriptor)` is deliberately narrow: it accepts only credential-free
HTTPS hostnames, rejects IP literals, resolves every redirect host, rejects non-public DNS
answers, pins each TLS connection to the checked address, permits at most three HTTPS redirects,
uses a 15-second request timeout, rejects content encoding, bounds the response before buffering,
and verifies the returned bytes against the mandatory descriptor. It never writes or executes a
download. Successful values carry `status: "VERIFIED"`; failures are `ArtifactFetchError` values
with stable `code` and `details` fields. Direct IP URLs are intentionally unsupported, including
public IP literals, to keep TLS hostname verification and DNS checks coupled.

`lifecycleStatus` keeps transaction, admission, execution, callback, binding, file, Git, and
publication observations separate. A mined purchase remains `NOT_PROVEN_BY_TRANSACTION` for
admission and execution. Git stays `NOT_OBSERVED` absent an independent observation; publication
is `DISABLED` in this release. `reconcileTransaction` and `lifecycleStatus` never authorize or
construct an automatic re-buy.

CLI failures are JSON on stderr with `{ "ok": false, "error": { "code", "message" } }` and a
nonzero exit status. Artifact-fetch failures preserve their narrower `ArtifactFetchError.code`.

## Test stand-ins and live boundary

`test-sdk/mock-rpc.mjs` is an explicitly test-only EIP-1193 read stand-in. It accepts `eth_call`
and records it; it is not an Intake, token, wallet, signer, chain, or deployment proof. Contract
tests elsewhere use the repository's documented `MockIntake`; neither that mock nor this read
stand-in proves real IMD consumption.

The test suite reads real repository Markdown, HTML, PNG, and raw result fixtures and verifies
their actual hashes, lengths, MIME/signatures, HTML image bytes, and malformed variants. It does
not make a public HTTP call, because default verification is offline. As a result, live Intake
pricing/admission, public artifact availability, Git delivery, publication, external skill
compatibility, live IMD spending, and public-chain deployment are all `NOT_RUN`.

## Commands and raw results

The complete local command output is in [sdk-cli-checks.md](sdk-cli-checks.md). The commands were
run with Node's built-in test runner and no RPC URL, key, signer, wallet, or server.
