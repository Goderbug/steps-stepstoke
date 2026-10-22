# Contracts-only launch proposal

This is documentation, not a manifest or launch authorization. The later manifest stage should resolve these three entries in order:

```json
{
  "kind": "evm_contracts",
  "contracts": [
    {"contract":"RelayEncoder","constructorArgs":[]},
    {"contract":"RelayVerifier","constructorArgs":[]},
    {"contract":"RelayFactory","constructorArgs":["$contract:RelayEncoder","$contract:RelayVerifier"]}
  ],
  "notes":"STEPS LOCAL-REPAIR-V1; launch after independent local source review and official service approval. Deployment and live-use acceptance are verified afterward. Runtime product operations create full independent RelayBranch contracts."
}
```

There is no token, owner placeholder, administrator, initializer transaction or ETH deployment value. Encoder and verifier use their default nonpayable zero-argument constructors. Factory takes two static addresses and checks only nonzero/distinct. The launch factory can deploy them in one atomic batch using backward references. No named constructor makes an external call, checks dependency code or deploys a child.

At product use, Factory checks both dependency addresses have code and return the expected policy ID. It checks goal/direction, registered parent, accepted selected checkpoint and exact witness before CREATE. Root and fork use constructor-complete full Branch instances. Factory registration follows CREATE atomically. Branches retain the product Factory identity, independent balances and Intake payer identities. A fork starts with inherited assets/source checkpoint but no own project/job/proposals; its first purchase opens a new project and the next continues that child's newest job.

There is no callable initializer. The historical `Initialized` event name remains. A directly deployed foreign Branch is not a registered product Branch and is refused by Factory fork and public adapter verification.

## Runtime-child policy

The current official `evm-contracts-launch` text and supplied protected floor prohibit proxies, DELEGATECALL, CALLCODE and SELFDESTRUCT; they do not prohibit runtime CREATE. Dynamic child-constructor parameters are supplied by a product operation, not by the three-entry static launch manifest. The full Branch creation code is embedded in Factory runtime and is visible to compilation, size measurements, source review and disassembly. Tests scan both the Factory containing that code and deployed children. All product libraries are internal/inlined, with zero external link references.

`tools/deployment-rehearsal.mjs` owns an empty disposable Anvil chain with chain ID 1. It eth_calls the constructors against empty-code dependencies, parses and replays the exact fenced manifest proposal above as a three-name CREATE2 batch, observes exact resulting runtimes and creates a direct root Branch. Full create/fork and child-open/continue are exercised by `tools/local-integration.mjs` and browser tests. The batch helper is a test-only implementation of the supplied batch mechanism; no production launch service is called and its unpublished policy/ceiling is not inferred from this simulation.

Mechanical compatibility with the supplied policy floor is PASS. Final service acceptance is OPEN. If the later service treats every runtime child as a launch application and demands static arguments for it, that conflicts precisely with dynamic user goals, inherited witnesses and permissionless runtime creation. Do not hide the child, restore proxies or add a launch initialization transaction; resolve that policy conflict before launch.

The earlier [candidate measurements](validation/rc-v1/measurements.json) are historical and do not certify the repaired source. Current repair validation is recorded in [LOCAL-REPAIR-V1](validation/local-repair-v1/README.md). The unchanged compiler configuration uses solc 0.8.26, Cancun, optimizer 200, viaIR and `bytecode_hash = "none"`.

Deployment acceptance and permission to enable paid product operations are separate gates. A successful local review permits preparation of the contracts-only IMD launch. Only actual official delivery, canonical receipts, source-matched runtime code and constructor bindings can establish deployment. The website is connected after that verification. Live compatibility remains `NOT_RUN` and paid UI remains disabled until separately authorized live checks pass; merely deploying the permissionless contracts does not prevent direct external calls.
