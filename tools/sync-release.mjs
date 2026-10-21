// Refresh exact compiler outputs only; never deployment/readiness claims.
import { readFile, writeFile } from 'node:fs/promises';
import { keccak256, toUtf8Bytes } from '../vendor/ethers/ethers.mjs';
const root = new URL('../', import.meta.url);
const release = JSON.parse(await readFile(new URL('config/release.json', root)));
release.contracts = {}; release.runtimeChecks = {};
for (const name of ['RelayFactory', 'RelayBranch', 'RelayEncoder', 'RelayVerifier']) {
  const a = JSON.parse(await readFile(new URL(`out/${name}.sol/${name}.json`, root)));
  const sz = h => (h.length - 2) / 2;
  const runtime = a.deployedBytecode;
  release.contracts[name] = { creationCodeHash: keccak256(a.bytecode.object), runtimeBytesBeforeImmutablePatching: sz(runtime.object), initcodeBytes: sz(a.bytecode.object) };
  release.runtimeChecks[name] = { bytes: sz(runtime.object), normalizedKeccak: keccak256(runtime.object), immutableReferences: runtime.immutableReferences ?? {} };
}
release.policyId = keccak256(toUtf8Bytes('STEPS/RELEASE-CANDIDATE-V1/fixed-profiles/artifacts/unpublished'));
release.profiles.filter(p => p.mime === 'text/html').forEach(p => p.path = 'artifacts/index.html');
release.profiles.forEach(p => { if (p.skill === 'build-document') p.skill = 'research-report'; if (p.skill === 'imagegen') p.skill = 'create-image'; });
release.name = 'STEPS (Stepstoke)'; release.version = 'RELEASE-CANDIDATE-V1';
release.officialX = 'https://x.com/stepstoke';
release.validationReport = 'docs/validation/rc-v1/README.md';
release.sourceBaseline = { ...release.sourceBaseline, importedCommit: 'd29eedf8e7d6608ed109972c179b367ac07ce91f', scope: 'Undeployed Ethereum contracts-only candidate; liveCompatibility NOT_RUN' };
release.productionDeployment = null; release.productionReady = false; release.liveCompatibility = 'NOT_RUN';
release.independentContributorReview = 'NOT_RUN_FOR_RELEASE_CANDIDATE_V1';
release.independentAgentReview = 'NOT_RUN_FOR_RELEASE_CANDIDATE_V1';
await writeFile(new URL('config/release.json', root), JSON.stringify(release, null, 2) + '\n');
