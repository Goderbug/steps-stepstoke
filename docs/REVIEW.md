# Release review and open risks

This is the worker's local source review and evidence record, not independent production approval. `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. The imported source already contained reviewed parser/payment/mapping repairs; those tests and all historical failures are retained by archive/index. Current changes and reproductions are enumerated in [ADAPTATION.md](../ADAPTATION.md).

| Gate | Current result | Required before launch |
| --- | --- | --- |
| Final security review | OPEN: local regressions/fuzz/invariants pass; new construction and public adapter need independent review | Review exact final source/ABI and custody, callback, lineage, input limits and external dependency assumptions |
| Runtime-child launch policy | Mechanical floor PASS; service acceptance OPEN | Confirm full runtime-created Branch is permitted without being a static manifest entry; no hidden child or init call |
| Manifest/profile compatibility | OPEN | Real authenticated one-output results and continuation/input materialization for all profiles, especially HTML update; resolve zero/multiple/oversized envelopes |
| Size/gas/service limits | EIP size floor PASS; service/global gas bounds OPEN | Service simulation of exact three-entry batch, full calldata and worst allowed operations; documented service limits and margin |
| Live execution | NOT_RUN | Separately authorized mainnet validation; local mocks and free syntax checks do not qualify |
| Deployment verification | NOT_RUN | Confirm chain-1 transaction/block/hash, addresses, exact runtimes/dependencies, policy and ABI hashes |

`config/production-gate.schema.json` defines these gates; `config/production-gate.json` is the closed candidate record. `productionReady:true` requires a nonnull deployment, live PASS, all six gate statuses PASS and nonempty evidence. The adapter also requires the record's addresses/block to match its verified configuration. Editing a JSON status is not authorization or independent evidence.

Specific unresolved boundaries:

- Four callback-authenticated public snapshots contain no named output. Actual HTTP results with 2/4/17 files are refused by the one-output parser. Do not strip extra files or metadata, reserialize JSON or accept a projection hash. Oversized authenticated real results were not obtained. A recorded but unbindable result remains stopped, with no paid retry.
- Official protocol does not promise our raw JSON complexity limits or a universal 1,024-byte URI maximum. Unsupported delivery can leave a Branch permanently pending/recorded. The assignment explicitly preserves that behavior; no timeout/admin settlement is added.
- Current catalog routing and shape/path changes pass eight exact free samples. The two HTML-update samples fail because their selected HTML is a local fixture, not a public accepted artifact. Real HTML update and HTML+PNG materialization remain unproved. Research-report's semantic behavior for arbitrary Markdown edits must be observed; syntax approval is not proof.
- A full child costs substantially more gas than a clone. Stress bind cases reach near 13.58M gas. The finite budget is tested, not a global proof. Launch service gas/calldata limits are unverified.
- Runtime dependency checks establish code presence/policy identity. Exact deployment source/runtimes must still be verified at handoff. Intake/IMD and action semantics are external dependencies fixed in this no-admin release; a protocol change requires a separately reviewed release.
- Default frontend history scans stop beyond 100,000 blocks/10,000 logs and replacement lookup covers only 128 blocks. An authenticated pagination/indexing design is required for longer-lived deployments. It must preserve full checkpoint proof and never infer recovery from missing logs.
- Public HTTPS gateways/API/RPC may be unavailable or restrict CORS. Browser code cannot verify DNS/IP. Only allowlisted result/artifact routes are used; custom trusted IPFS gateway selection remains an operator configuration. Direct file selection still requires exact callback hash.
- Browser checks cover the actual static export and local EIP-6963 shim. They do not prove every real wallet app/passkey flow. Engine availability and checks actually run are recorded; no absent engine is marked passed.

No new owner/admin, upgrade, pause, treasury, voting, scoring, token, pool, hook, asset type, publication path or automatic spending/retry was introduced. No finding is considered repaired by turning off a config flag or accepting mocked success. Required source changes and their negative tests are documented; unsupported behavior stays visible.
