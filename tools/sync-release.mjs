// Refresh exact compiler outputs only; never deployment/readiness claims.
import { readFile, writeFile } from 'node:fs/promises';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
import { compilationContext } from './compilation-context.mjs';
const root = new URL('../', import.meta.url);
const release = JSON.parse(await readFile(new URL('config/release.json', root)));
if (release.productionDeployment !== null) throw new Error('A deployed release cannot be silently re-frozen');
release.contracts = {}; release.runtimeChecks = {};
const frozen = { compiler: release.compiler, settings: null, sources: {} };
for (const name of ['RelayFactory', 'RelayBranch', 'RelayEncoder', 'RelayVerifier']) {
  const a = JSON.parse(await readFile(new URL(`out/${name}.sol/${name}.json`, root)));
  const sz = h => (h.length - 2) / 2;
  const runtime = a.deployedBytecode;
  release.contracts[name] = { creationCodeHash: keccak256(a.bytecode.object), runtimeBytesBeforeImmutablePatching: sz(runtime.object), initcodeBytes: sz(a.bytecode.object) };
  const names = { RelayFactory: ['encoder','verifier'], RelayBranch: ['factory','encoder','verifier'], RelayEncoder: [], RelayVerifier: [] }[name];
  const ids = Object.keys(runtime.immutableReferences ?? {});
  if (ids.length !== names.length) throw new Error('Review changed compiler immutable layout');
  release.runtimeChecks[name] = { bytes: sz(runtime.object), normalizedKeccak: keccak256(runtime.object), immutableReferences: runtime.immutableReferences ?? {}, immutableBindings: Object.fromEntries(ids.map((id,i)=>[id,names[i]])) };
  const metadata = typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata;
  const settings = { ...metadata.settings }; delete settings.compilationTarget;
  if (frozen.settings && JSON.stringify(frozen.settings) !== JSON.stringify(settings)) throw new Error('Compiler settings differ');
  frozen.compiler = metadata.compiler.version; frozen.settings = settings;
  for (const [path, source] of Object.entries(metadata.sources)) frozen.sources[path] = source.keccak256;
}
const context = await compilationContext(root);
frozen.sources = context.sources;
frozen.compilation = context.compilation;
release.frozenBuild = frozen;
// Version, policy, provenance and review status are explicit editorial decisions.
// Rebuilding must never reset them to a historical candidate or grant acceptance.
await writeFile(new URL('config/release.json', root), JSON.stringify(release, null, 2) + '\n');
