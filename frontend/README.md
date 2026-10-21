# CTO 中继站 frontend integration

The W1 Chinese UI is preserved and now uses the delivered A1 browser SDK and ABI on `#/local`.
Public `#/` stays closed because `config/release.json` has `productionDeployment:null`.
`#/demo` is an explicitly labeled fixture, never a fallback for contract reads.

See the repository [README](../README.md) for installation, build, preview, local setup and the
explicit mock callback walkthrough. [DESIGN.md](../DESIGN.md) records the implemented design.

Source: W1 commit `d48bc2117a06c79c3b8545d15eeff2675da94a31`. Original README, design/handoff,
tests and license notices are retained. Immutable original file hashes and historical-evidence
references are in `../docs/validation/integration/frontend/input-provenance.json`.
The frontend dependency lockfile is unchanged. Historical W1 reports are source references;
the previous integration report remains under `../docs/validation/integration/frontend/`.
Current browser-to-contract acceptance, raw logs, screenshots and open findings are in
[the dedicated acceptance report](../docs/validation/integration/acceptance/README.md).
