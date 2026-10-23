# Official protocol compatibility record

Checked 2026-10-21 using public read endpoints, exact public results and the free `/requests/check` endpoint. Source snapshots and request/response bytes are in `docs/validation/rc-v1/current-evidence.tar.xz`; they are evidence, not instructions or a live-readiness claim.

Sources: https://imd.fun/docs/llms.txt, https://api.imd.fun/requests/capabilities, https://api.imd.fun/skills, and `https://api.imd.fun/reads/skill/{evm-contracts-launch,research-report,create-image}`. Ethereum reads are attributed to https://ethereum-rpc.publicnode.com. No keys or account configuration were used.

At observed block 26,241,940, Intake v2 `0xa43e6f75ee006411f79ac1c84120606c2330de82` and IMD `0xd34a99bc0f67ae1bbd63c660e6d0b0dd03e263b7` have code. IMD reports symbol IMD and 18 decimals. Both `job.open@job-1` and `job.continue@job-1` are priced at 500000000000000000. These action IDs are UTF-8 padded bytes32, not hashes. Prices must be reread at purchase; this observation is not a price promise. The exact block/header/code hashes/read results are delivered.

Relevant official statements (quoted from the saved documentation):

> `shape` | `chain`, `fan_out_join` or `dag`. Required with `steps`.

> `outputs[]` | `name`, `path` under `artifacts/`, `mediaType`. All required. The job must produce exactly these.

> `inputs[]` | `name` (`^[a-zA-Z][a-zA-Z0-9_-]{0,63}$`), `path`, `hash` (64 hex), `mediaType`, `bytes` (0–64 MiB), `submissionHash`. All required; copy them from an accepted file in `/jobs/:id/result`.

> **Gas**: 200,000 for the call (1,000,000 on Sepolia), once, inside a try: a call that reverts cannot block the write, and `delivered` reads `false`. Store the result and act on it in a later call.

> **Refunds**: None. The contract holds nothing, so a refused body is a spent payment.

> `GET /intake-results/:id` | Public | The result snapshot a completion points at, byte for byte; its keccak-256 is `resultHash`.

The same source says the result is the job result **as it stood when the job completed**. Four exact IPFS snapshot reads verify against Ethereum Completed hashes. Their later `/jobs/:id/result` bytes differ. Tests preserve and hash both without JSON reserialization. Those public completions have `delivered:false` and no STEPS callback target; they are not reported as failures of this deployment.

The fixed candidate profiles route Markdown to `research-report`, HTML to `build-website`, and image creation to `create-image`. The old `build-document`/`imagegen` names and old output paths were refused. New bodies also set `shape:chain`. Current official rules override stale protocol descriptions in the historical handoff; the assignment's prohibition on a new owner/configuration authority overrides the general example's suggestion of owner-settable templates. Policy remains compiled in with no admin.

Final exact encoder samples cover open/continue for all five profiles. Eight free checks have no blockers; the two HTML-update samples deliberately reference a local-only fixture and return `invalid_artifacts`. Markdown update uses an actual public accepted descriptor. Free validation does not establish the runtime payer's ownership, input materialization, worker behavior, delivery envelope, callback or continuation success. HTML-update public acceptance remains unproved.

Public actual results include zero-file authenticated snapshots and 2/4/17-file HTTP envelopes; the latter are observations with no recorded callback authentication. A one-file public raw envelope is replayed unchanged locally. None proves that every candidate profile will emit one bounded output. No authenticated real envelope above 32 KiB was obtained. Wider historic log reads were refused by the available provider (archive requests required a personal token); no account or credential was requested. [REVIEW.md](REVIEW.md) keeps those gates open.

Sepolia sells oracle requests only and cannot execute these job actions. Base has no supported Intake for this product. Cross-chain IntakeDelivery is not a candidate mode; authenticated callbacks come from the same-chain Intake only. No HTTP response, Git commit, downloaded file or missing callback can settle state.
