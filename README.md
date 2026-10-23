# STEPS · Stepstoke

STEPS is an Open Workshop where anyone can create a fixed-goal project, propose a bounded job, and separately fund one Intake execution. A Branch records authenticated results as checkpoints so people can inspect, continue, or fork a selected historical output. Official X: https://x.com/stepstoke (no post is part of this release).

**Connected to verified Ethereum contracts; payments disabled.** The primary route opens the real chain-1 project view, with no wallet required for reads. Launch `cad0c789-2611-4392-bec0-456cb8e57d2c` deployed successfully in block **26248821**. The contract-source commit is **751f3901d4453e1477828e4f7ef0d6af8bc03485**; the website uses a later IMD delivery commit and never changes that contract-source pin. All five live profiles remain `NOT_RUN`, `liveCompatibility:NOT_RUN`, `productionReady:false`. Deployment verification permits reads, not wallet authority. Creating, proposing, funding, binding and forking transactions stay disabled while their gates remain open.

The exact local correction at [Goderbug/steps-stepstoke, a523c571e874a783967e212b303e4b81f5c9876f](https://github.com/Goderbug/steps-stepstoke/tree/a523c571e874a783967e212b303e4b81f5c9876f) was already present byte for byte on entry. [Import provenance](docs/validation/live-connection-v1/correction-import.json) preserves local versus IMD/Swarm authorship. No contract, compiler setting, ABI, launch manifest, package manifest or lockfile changed. The generic JSON cap stays 256, manifest retained-token capacity stays 1024, and the audited `8 * segmentFlushes` work charge and its narrower compatibility remain intact.

[Current connection report](docs/validation/live-connection-v1/README.md) records source/ABI/runtime verification, anonymous browser transport, final asset hashes, checks and publication limits. The committed `dist/` is the static export submitted for IMD GitHub and site/IPFS hosting. No actual website commit, hosted URL or CID has been returned to this worker; none is invented. `#/demo` remains explicitly simulated. No paid product execution, deployment, key access, worker broadcast or social posting occurred. Missing callbacks and unsupported authenticated results retain the disclosed liveness limits in [LIMITS.md](docs/LIMITS.md).

## Build, test, inspect

From a fresh clone with Node 22+, Python 3, Forge/Anvil 1.8.3 and solc 0.8.26 available, run from the repository root. Forge libraries and the Node SDK runtime are committed as ordinary files; these commands need no key or public RPC:

```sh
node tools/build-release.mjs
FOUNDRY_FUZZ_SEED=0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5 forge test
node --test test-sdk/*.test.mjs
python3 tools/verify-history.py --predecessor
node tools/check-release.mjs
```

The first command forces the unchanged 50-input Solidity compilation and checks frozen ABI/bytecode fingerprints. The historical candidate-only `tools/check-delivery.py` requires an undeployed state and is not the live-connection checker. The current source/export inventory, exact outcomes, raw logs and measured gas are in [reproduction evidence](docs/validation/documentation-v1/README.md); the current delivery measurement is [here](docs/validation/rc-v1/delivery-size.json). Old validation records are retained as [historical evidence](docs/history/README.md), not silently promoted to current passes.

To inspect the committed export offline, serve it on loopback and open `http://127.0.0.1:4173/`:

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

`node cli/relay.mjs help` lists every unsigned CLI operation. For a no-wallet tour, use `#/demo`; the demo's signatures, callbacks and outcomes are fixtures. For real candidate contracts on a disposable local chain, run `node frontend/scripts/local-setup.mjs` in one terminal, serve `dist/` on loopback in another, and open `#/local`. Local setup creates a new chain/configuration; the local configuration is generated only for that session, after building. Stop setup to discard its chain. [Build and rehearsal](docs/BUILD.md) explains the local tools.

The six workflows are **create, propose, explicitly fund, inspect outputs/history, continue, and historical fork**. Anyone can create, propose, sponsor, bind a valid recorded result, or fork a registered accepted checkpoint; only the fixed Intake may call result/failure callbacks. Funding has two distinct wallet transactions: approve the current exact IMD price to the Branch, then confirm `sponsor` with a reviewed `maxFee`. A Branch, not the sponsor wallet, is the Intake payer. `continue` prepares a proposal only. Forking creates an independent full Branch with inherited file provenance but no inherited IMD project or execution head. [Operator runbook](docs/OPERATIONS.md) keeps recovery and spending limits beside each step; [entry points](docs/ENTRYPOINTS.md) lists every contract function, CLI command, page and failure path.

Ethereum chain 1 is the verified public deployment; Sepolia cannot execute these job actions. No wallet switches implicitly. Public reads must verify the actual handoff, receipt, code, policy and Branch registration; public signing additionally requires all production gates and live profile evidence. This integration performed public reads only. No public signing, deployment transaction, paid IMD call, extra order, per-round site publication, image edit, artwork commission or X post occurred here.

## Verified launch and static export

The three live applications are Encoder `0xae9a9624e6354bbd029fefa762bafd43fb9f6886`, Verifier `0x52a459aaf8044c5bc7f5a8198ef7305367e98ec4` and Factory `0xff1519c0b9ae4053d1505bc0e5226178109e0abc`. These values come from the actual project handoff, never a rehearsal. Product-created Branches remain full runtime children. There is no token, pool, hook, owner or proxy added by this site.

The importer must run **after every build**, because Vite clears `dist/`. In the IMD workspace containing the authentic pinned handoff/network inputs:

```sh
node tools/verify-live-connection.mjs
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
node tools/import-deployment.mjs docs/validation/live-connection-v1/deployment-evidence.json https://ethereum-rpc.publicnode.com docs/validation/live-connection-v1/public-read-transport.json
node tools/check-release.mjs
node tools/observe-ethereum.mjs dist
```

A clone without the removed IMD inputs can preview the complete committed export as delivered. Reconnecting a newly built export requires authentic handoff/network inputs; never reconstruct them from this README or rename a local fixture. Runtime configuration, the three ABI arrays, deployment evidence and public RPC policy are all inventoried in `dist/imd-deployment.json`. [HANDOFF.md](docs/HANDOFF.md) describes fail-closed verification and [OPERATIONS.md](docs/OPERATIONS.md) describes manual file recovery, safe previews, exact approvals and bounded observation.

The primary route and `#/ethereum` read the same live deployment. `#/configuration` shows deployment/readiness details; `#/demo` and `#/local` are separate labelled development modes. The export uses relative asset URLs and hash navigation. The public read policy uses anonymous HTTPS PublicNode and dRPC; current availability and CORS are time-specific observations. Failure to obtain a live trace, receipt, historical code or matching immutables disables reads and signing.

All five profiles remain **NOT_RUN**. No profile PASS is carried from another deployment. The [seven-job validation proposal](docs/LIVE-VALIDATION.md) is historical planning only and is not spending authorization. Deployment alone cannot close the production gates or enable any paid control.
