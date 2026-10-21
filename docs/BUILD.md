# Build and disposable rehearsal

Use the existing `foundry.toml`, remappings and vendored libraries unchanged. No environment, private key or public RPC is needed for the following checks:

```sh
forge build
FOUNDRY_FUZZ_SEED=0x0658c4410aa492d0cfda058f7f13f56d416689bcd97d746fd69793d6a2483bd5 forge test
node --test test-sdk/*.test.mjs
node tools/check-release.mjs
node tools/inspect-bytecode.mjs
node tools/deployment-rehearsal.mjs
node tools/sdk-local-check.mjs
node tools/local-integration.mjs --review-fixes
node tools/measure-binding.mjs
python3 tools/verify-history.py
```

The three rehearsal tools start their own disposable Anvil. They accept no public transaction RPC or private key. Output is JSON to stdout; redirect scratch output under `/tmp`, not into source paths. Their unlocked local actors and mock assets are test fixtures, never production addresses.

After an authorized source change, synchronize generated files in this order:

```sh
forge build
node tools/export-abi.mjs
node tools/generate-sdk-abi.mjs
node tools/sync-release.mjs
node tools/check-release.mjs
```

Re-run tests and measurements after changes. `tools/measure-release.mjs FLOW_JSON BINDING_JSON CONSTRUCTOR_JSON` summarizes fresh outputs of local-integration, measure-binding and deployment-rehearsal, checking the current artifacts/ABI/config. It never reads old clone gas evidence. `inspect-bytecode --disassemble` (or `--compact-disassembly` for a byte-recoverable instruction listing) emits every instruction and PUSH immediate, marking reachability according to the supplied floor; data bytes are not blindly counted as executable capabilities.

## Frontend

The already-built public static export is `dist/`; no server runtime is required. Rebuilding uses the existing exact `frontend/package-lock.json` and dependency configuration:

```sh
npm ci --ignore-scripts --prefix frontend
npm run typecheck --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
```

During this bounded assignment dependencies/builds were installed and run in a `/tmp` mirror so repository `node_modules/` and protected package files remained untouched. The delivery contains the static export. Browser test runners need their own Playwright browser installation and system libraries; these are check tools, not a website runtime dependency.

For an interactive disposable session, run `node frontend/scripts/local-setup.mjs`, then serve `dist/` on loopback and open `#/local`. Setup refuses occupied service ports, starts its own Anvil 31337, deploys Encoder, Verifier and Factory, generates configuration from their actual code and serves deterministic local artifacts. Stop the process to discard the chain. The committed `local-config.json` records only a disposable rehearsal and must be regenerated for a new session; it is never a deployment handoff.

`frontend/tests/integration/browser-chain.mjs` tests actual local contracts through the selected EIP-6963 browser wallet shim. The shim forwards unsigned transactions only to the disposable local node and has no private key. Fixture e2e suites separately inspect static layout, funding sequence, keyboard/focus and artifact isolation. Current coverage and unavailable engines are recorded in the evidence index.
