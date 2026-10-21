# STEPS · Stepstoke

**RELEASE-CANDIDATE-V1 — development only, undeployed, not production ready.** Ethereum chain 1 is the only public target. Official X: https://x.com/stepstoke.

STEPS preserves the Open Workshop flow: create a project, propose work, explicitly fund it, inspect accepted outputs/history, continue, or fork a selected historical checkpoint. Every Branch is a full independent contract and its own Intake payer. Proposal, approval and purchase are separate actions.

The static export is in `dist/`. Open it through a static HTTP server; hash routes and relative assets also support subpaths. `#/demo` is labelled fixture data; `#/local` uses actual candidate contracts with local mocks; `#/ethereum` requires a later confirmed deployment. The public handoff is unavailable until the later official deployment; no handoff or addresses are invented. There is no hosting in this delivery.

Install the pinned frontend dependencies, check/rebuild the export, then preview it on loopback:

```sh
npm ci --ignore-scripts --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run preview --prefix frontend -- --host 127.0.0.1
```

The build writes root `dist/` with relative assets. Validation uses a `/tmp` mirror with the same unchanged manifests so no dependency/cache directory enters the repository. [Current revision evidence](docs/validation/boundary-revision/README.md) records public-read invalidation, transaction replacement handling, reproducible clean compilation and actual check results. The [previous revision](docs/validation/multi-file-revision/README.md) records the accepted multi-file repair; earlier evidence remains recoverable as described in [history](docs/history/README.md).

## Review and run

- [ADAPTATION.md](ADAPTATION.md): exact launch and reproduced compatibility changes.
- [Build and local rehearsal](docs/BUILD.md), [operations/runbook](docs/OPERATIONS.md), [SDK and CLI](docs/CLI.md).
- [Three constructor proposal and runtime-child policy](docs/CONTRACTS.md).
- [Protocol evidence](docs/PROTOCOL-OVERVIEW.md), [limits](docs/LIMITS.md), [open release gates](docs/REVIEW.md).
- [Integration checks](docs/validation/integration-v1/README.md), [contract measurements](docs/validation/rc-v1/README.md), [historical byte recovery](docs/history/README.md).
- [Open Workshop design](DESIGN.md), [agent guide](docs/AGENT-GUIDE.md).

```sh
forge build
FOUNDRY_FUZZ_SEED=0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5 forge test
node --test test-sdk/*.test.mjs
node tools/check-release.mjs
node tools/deployment-rehearsal.mjs
```

The delivered SDK uses vendored ethers and runs without package installation. The existing Foundry configuration and dependencies were not changed. Root package names/CLI technical identifiers are retained for compatibility.

`productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. Free API checks and disposable local transactions do not prove live readiness. The later platform manifest stage alone writes `launch.json`; this tree contains none.
