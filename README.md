# STEPS · Stepstoke

STEPS is an Open Workshop where anyone can create a fixed-goal project, propose a bounded job, and separately fund one Intake execution. A Branch records authenticated results as checkpoints so people can inspect, continue, or fork a selected historical output. Official X: https://x.com/stepstoke (no post is part of this release).

**RELEASE-CANDIDATE-V1 is development only.** It is undeployed on Ethereum, has no official deployment handoff, and has never run a paid STEPS job. `productionDeployment:null`, `liveCompatibility:NOT_RUN`, `productionReady:false`. The `#/demo` UI is simulated, `#/local` uses disposable contracts with MockIntake/MockToken, and `#/ethereum` shows unavailable until a later verified chain-1 deployment. The delivered `dist/` is a static export, not a hosted service. Local/free checks do not establish that Intake will return a bindable result. A missing callback can leave a paid Branch pending; a malformed or oversized authenticated result can leave it unbindable. There is no timeout, admin unlock, refund promise, or automatic retry. [Release gates and risks](docs/REVIEW.md) are open.

## Build, test, inspect

From a fresh clone with Node 22+, Python 3, Forge/Anvil 1.8.3 and solc 0.8.26 available, run from the repository root. Forge libraries and the Node SDK runtime are committed as ordinary files; these commands need no key or public RPC:

```sh
node tools/build-release.mjs
FOUNDRY_FUZZ_SEED=0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5 forge test
node --test test-sdk/*.test.mjs
python3 tools/verify-history.py --predecessor
python3 tools/check-delivery.py
```

The first command forces a clean Solidity compilation and checks frozen ABI/bytecode fingerprints. The current source/export inventory, exact outcomes, raw logs and measured gas are in [reproduction evidence](docs/validation/documentation-v1/README.md); the current delivery measurement is [here](docs/validation/rc-v1/delivery-size.json). Old validation records are retained as [historical evidence](docs/history/README.md), not silently promoted to current passes.

To inspect the committed export offline, serve it on loopback and open `http://127.0.0.1:4173/#/demo`:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

To rebuild the frontend source in a networked development clone, use its exact lockfile, then compare the rebuilt `dist/` with the recorded export hashes. This command installs build tools locally; the export itself is already committed for offline inspection:

```sh
npm ci --ignore-scripts --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
```

## Use

`node cli/relay.mjs help` lists every unsigned CLI operation. For a no-wallet tour, use `#/demo`; the demo's signatures, callbacks and outcomes are fixtures. For real candidate contracts on a disposable local chain, run `node frontend/scripts/local-setup.mjs` in one terminal, serve `dist/` on loopback in another, and open `#/local`. Local setup creates a new chain/configuration; the committed `local-config.json` describes an old disposable session. Stop setup to discard its chain. [Build and rehearsal](docs/BUILD.md) explains the local tools.

The six workflows are **create, propose, explicitly fund, inspect outputs/history, continue, and historical fork**. Anyone can create, propose, sponsor, bind a valid recorded result, or fork a registered accepted checkpoint; only the fixed Intake may call result/failure callbacks. Funding has two distinct wallet transactions: approve the current exact IMD price to the Branch, then confirm `sponsor` with a reviewed `maxFee`. A Branch, not the sponsor wallet, is the Intake payer. `continue` prepares a proposal only. Forking creates an independent full Branch with inherited file provenance but no inherited IMD project or execution head. [Operator runbook](docs/OPERATIONS.md) keeps recovery and spending limits beside each step; [entry points](docs/ENTRYPOINTS.md) lists every contract function, CLI command, page and failure path.

Only Ethereum chain 1 is a possible later public target; Sepolia cannot execute these job actions. No wallet switches implicitly. Public reads must verify the actual handoff, receipt, code, policy and Branch registration; public signing additionally requires all production gates and live profile evidence. No public signing, deployment, hosting, paid IMD call, extra order, per-round site publication, image edit, artwork commission, or X post occurred here.

## Later launch boundary

The proposed `workflow.open` **evm_contracts** launch has exactly three named constructor-complete applications: `RelayEncoder()`, `RelayVerifier()`, then `RelayFactory($contract:RelayEncoder,$contract:RelayVerifier)`. Product-created `RelayBranch` instances are full runtime children, not proxies or separate manifest entries. [Contract roles and policy](docs/CONTRACTS.md) and [handoff](docs/HANDOFF.md) explain the unresolved runtime-child service acceptance and exact deployment/config import. This checkout intentionally has no `launch.json`; only the later manifest stage writes it after acceptance. The final submission must be pinned by its immutable repository URL and **actual final commit ID**, with frozen source/export hashes, before that stage or any independent review. A pinned baseline inside `config/release.json` identifies imported ancestry, not the final candidate commit.

Profiles for any later live validation remain separate: **undeployed candidate** (this tree), **verified public pilot** (real deployment/reads with paid execution still unproved), and **live-validated** (independently reviewed authenticated jobs and closed gates). None triggers the next order automatically. [Seven-job acceptance proposal](docs/LIVE-VALIDATION.md) is unrun and requires separate spending authorization and fresh `priceOf` reads.
