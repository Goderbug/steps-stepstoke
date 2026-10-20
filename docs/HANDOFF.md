# A1 → W1 handoff and readiness

**A1 is delivered local source and tooling; production readiness is false.** This documentation pass changes README/docs only. It does not change contracts, SDK, CLI, dependencies, configuration, ABIs or tests, repair code, or erase an open finding. Live catalog/Intake compatibility, actual IMD consumption and public deployment remain **`NOT_RUN`**. Publication is disabled. No Git remote delivery or final upload commit is established by a local test result.

W1 below names a future work stage, not an existing implementation or a promise that missing core work can be moved into a frontend. No frontend is delivered or needed for the six A1 operations. A1 already contains actual file descriptors/provenance, selected asset inputs and authenticated historical forks; their live behavior still needs validation.

## Delivered A1 surface

| Requirement | Delivered implementation / local evidence | Remaining boundary |
| --- | --- | --- |
| Create fixed public project | Factory creates and registers initialized root clone with fixed goal | No public deployment/code verification |
| Propose work | Current-anchor immutable proposals with one target, selected inputs, output mapping, text and publish flag | Live runtime schema/catalog acceptance unverified |
| Explicit sponsor | Nonzero selectable proposal, no FIFO, exact runtime fee/maxFee, Branch payer, guarded payment | Local mocked token/Intake only; no real IMD consumption |
| Read files/state/history | Public reads/events, exact raw manifests, witness recovery and actual fixture file checks | Public availability, RPC/log completeness and real artifacts unverified |
| Continue | Own latest job, one target per revision, no two-round limit; root has five local bound rounds | External continuation admission and Git prerequisites unverified |
| Historical fork | Permanent source checkpoint, full inherited table/provenance, child opens own project then continues | Local root-1 fork after root-5 and two child rounds; no live fork run |
| Markdown create/update | Fixed build-document profile; actual Markdown fixtures; both modes execute locally | Live skill/output contract unverified |
| HTML create/update | Fixed build-website profile; actual HTML → PNG → HTML, exact PNG embedding/marker check | Model restoration, dist equality and self-contained behavior are runtime/off-chain obligations |
| Single image generation | Fixed imagegen, no references/edits, actual PNG fixture and hashes | No AI generation performed; PNG signature check is not a full decoder audit |
| Failure/binding lifecycle | Stipend callbacks, pending indefinitely, same-body explicit refused retry, freeze otherwise, bad-bind preservation | No lost-callback recovery or incompatible-manifest repair by design |
| SDK/CLI | Unsigned operations/previews, canonical witnesses, history and file checks, optional restricted artifact fetch | No signer, broadcaster, approval/deploy command, mandatory service or complete live observer harness |

Root/child creation, proposals and forks never implicitly buy AI. Local fixtures simulate results, not model execution. A successful mock request, compiled ABI or accepted JSON shape is not proof of real protocol acceptance.

## Findings and repair status

These are **preexisting source repairs** recorded by earlier contributors, not fixes made by this documentation assignment. Read the original reports and raw checks before relying on their conclusions.

| Record | Finding and status | Evidence / qualification |
| --- | --- | --- |
| Implementer review | Initial large-manifest candidate exceeded conservative gas headroom; reduced to 8,192 bytes and measured full bindings | [REVIEW.md](REVIEW.md), [LIMITS.md](LIMITS.md), original diagnostic traces under `evidence/`. Initial defect was not silently relabelled PASS |
| Implementer review | Invalid PNG fixture CRC; replaced fixture, regenerated manifests/inline HTML and checked CRC/decompression | [Review](REVIEW.md), Python fixture check; fixture repair, not proof of arbitrary image validity |
| Implementer review | Incorrect newline golden expectation and getter consuming a revert expectation; corrected tests | [Review](REVIEW.md); test repairs do not themselves establish external behavior |
| Implementer review | SDK numeric wrapper impersonation; private Symbol branding and regression added | [Review](REVIEW.md), Node suite; Solidity parser unaffected |
| Independent agent review, **High** | Hexadecimal IPv4-mapped IPv6 DNS answers bypassed private-network guard; final positive global-unicast admission/exclusions and regressions repaired it | [Independent report](validation/independent-review.md), `test-sdk/network-address.test.mjs`. First attempted repair still allowed NaN bypass and was caught; final regression/replay passes |

The earlier independent agent report identifies **no unresolved Critical/High or concrete core failure after its final repair**. This is that report's scoped conclusion, not a certification of absence. It is a separate agent review with local replay, not an external human audit. Adversarial contributor tests separately cover contracts; no Slither/Mythril or external human audit result is delivered. `config/release.json` preserves `independentAgentReview:"PASS_WITH_REPAIRS"` alongside `independentContributorReview:"NOT_RUN"`; do not flatten these into an unqualified audit PASS. This documentation pass is not another independent review.

## Fixed restrictions and trust assumptions

The [measured envelope](LIMITS.md) is 16 current assets, 8 selected inputs, 1 output, ≤16,384-byte request, ≤8,192-byte manifest, ≤64 KiB Markdown, ≤2 MiB HTML, ≤256 KiB PNG and ≤512 KiB aggregate selected images. Parser/field bounds and reserved type slots apply in addition. Some theoretically valid edits can fail the conservative HTML-plus-Base64 budget or exactly-one-output rule. Image editing/reference/variation and publishing remain disabled; changing fixed release policy requires new reviewed code/deployment rather than a setter.

Writer/runtime honesty, actual artifact availability, input consumption, output quality, completion/project/job identity and profile compliance remain external assumptions. Hashes commit bytes/descriptors, not those semantic properties. Contracts do not fetch files or enforce HTML behavior/dist layout. SDK `verifyHTMLDist` checks local shape/bytes and optional PNG inclusion, not arbitrary JS safety or all remote references. `html-check` CLI omits the selected-image list. PNG verification checks the signature; the independent fixture checker only validates its fixture. The artifact-fetch guard is conservative and has no overall elapsed-time deadline across DNS/redirects/slow responses. Explicit local file checks are not a complete filesystem sandbox. See [CLI details](CLI.md).

Missing callback keeps Pending forever; invalid authenticated manifests can keep ResultRecorded forever; non-refusal failures freeze purchases. No administrator can repair these states, and there is no automatic refund. Anyone may fork an earlier accepted revision, if one exists, but that does not recover a spent fee or make the failed run accepted. Fixed client dependencies also cannot repair a future incompatible external protocol change.

## W1 work still required

1. **Validate protocol and profile compatibility.** Verify chain/code/token/action prices and exact body/schema/catalog acceptance for all enabled create/update/open/continue/inherited-input cases. Use [the future request/observer procedure](LIVE-VALIDATION.md). Local mocks do not check the runtime catalog or execute skills.
2. **Record separately authorized deployment and consumption evidence.** No public deployment script/address or live paid run is delivered. Only a future explicitly approved operator should handle deployment/signing/spending. Retain deployment/code verification, exact requests, receipts, admission/execution, callbacks and accepted raw results separately. Never use local fixture IDs as live parents.
3. **Validate real files, continuation and historical child identity.** Obtain actual returned file bytes; verify SHA-256/length/MIME, exact HTML dist/named bytes and image embedding, old-input restoration, untouched provenance and independent job/project identities. Exercise the full planned root and historical-child sequence. Do not defer asset/history correctness to a frontend.
4. **Observe external Git delivery.** `github:true` requests delivery; local mocks prove no Git push. Retain the actual delivered repository/commit and its relationship to accepted bytes. Do not claim that a manifest repo URL or a local `git rev-parse` proves remote delivery. Publication stays disabled; no publication-mode validation is supplied.
5. **Complete security review and address new findings.** External human audit and additional analysis are still owed before production claims. Confirmed unresolved Critical/High or core failures block readiness. Record failing inputs and expected/actual results, implement/review repairs in an appropriately scoped code task, then rerun relevant checks. Documentation cannot discharge this gate.
6. **Improve operator tooling only where needed.** Live observation/reorg-aware log retrieval, receipt reconciliation and exact approval preparation are manual/integrator responsibilities today. A future tool must preserve unsigned defaults, separate observations and never automatically rebuy. No server, signer service, frontend, governance, treasury or autonomous spending is required to close A1 correctness gaps.

If exact live bodies or accepted manifests are incompatible with fixed A1 policy, record a core failure and design a reviewed successor. Do not enable unsupported publishing/image modes, widen caps, substitute source metadata or add admin repair merely to force a success label.

## Evidence handoff

Use [the integrated evidence index](validation/README.md), [independent review](validation/independent-review.md), [implementer review](REVIEW.md), [source SHA-256 inventory](validation/source-sha256.json) and [documentation reproduction record](validation/documentation-pass/README.md). Earlier `evidence/` and `test/adversarial/evidence/` logs are historical records with their own scopes/test counts. `docs/agent/sdk-cli-checks.md` records an earlier 17-test SDK stage; the integrated suite has 20 tests after network regressions.

Keep these fields distinct in any W1 report: local checks, independent review, free preflight, chain reads/fork testing, public deployment, real IMD paid execution, callback, binding, actual files, Git delivery, publication and production readiness. Unknown stays unknown; `NOT_RUN` never means an implicit PASS. A source hash/commit is evidence only when actually observed and tied to the tested files; no final delivery commit is guessed in this documentation.
