// Exact candidate code validation, shared by the browser and no-key Node tools.
import { getAddress, keccak256 } from '../vendor/ethers/ethers.mjs';
import { interfaces, queryPrepared, readFactory, readPrice, LIMITS } from './core.mjs';
import { ABI_SOURCE_SHA256 } from './abi.mjs';
export const LOCAL_CHAIN_IDS = Object.freeze([31337]);
export const PUBLIC_CHAIN_ID = 1;
const call = async (provider, prepared) => interfaces[prepared.abi].decodeFunctionResult(prepared.method, await queryPrepared(provider, prepared))[0];
const same = (a, b) => getAddress(a) === getAddress(b);
export async function readCode(provider, target) {
  const value = await provider.request({ method: 'eth_getCode', params: [target, 'latest'] });
  if (typeof value !== 'string' || !/^0x(?:[0-9a-f]{2})+$/iu.test(value)) throw new Error(`No valid code at ${target}`);
  return value;
}
// Hash all code bytes, masking only compiler-reported immutable slots. Every occurrence of a
// given immutable must be identical. Getters below authenticate the actual dependency values.
export function verifyRuntime(code, name, release) {
  const spec = release.runtimeChecks?.[name];
  if (!spec || (code.length - 2) / 2 !== spec.bytes) throw new Error(`${name} runtime size mismatch`);
  let normalized = code.slice(2).toLowerCase();
  for (const slots of Object.values(spec.immutableReferences)) {
    let value;
    for (const { start, length } of slots) {
      const word = normalized.slice(start * 2, (start + length) * 2);
      if (value !== undefined && word !== value) throw new Error(`${name} inconsistent immutable`);
      value = word;
    }
    for (const { start, length } of slots) normalized = normalized.slice(0, start * 2) + '0'.repeat(length * 2) + normalized.slice((start + length) * 2);
  }
  if (keccak256('0x' + normalized) !== spec.normalizedKeccak) throw new Error(`${name} runtime code mismatch`);
  return keccak256(code);
}
export function publicConfigStatus(release) {
  if (!release?.productionDeployment) return Object.freeze({ status: 'CLOSED', reason: 'productionDeployment is null in config/release.json' });
  return Object.freeze({ status: 'UNVERIFIED', reason: 'Deployment and production gates require verification' });
}
export async function observeDeployment(provider, { release, factory, chainId: expectedChainId }) {
  if (![1, 31337].includes(expectedChainId)) throw new Error('Only Ethereum chain 1 or disposable chain 31337 is supported');
  if (!release || release.intendedChainId !== 1) throw new Error('Ethereum release configuration is required');
  const chainId = Number(BigInt(await provider.request({ method: 'eth_chainId', params: [] })));
  if (chainId !== expectedChainId) throw new Error(`Wrong chain ${chainId}; expected ${expectedChainId}. No implicit switch`);
  const contracts = { factory: getAddress(factory) };
  const runtimeCodeKeccak = { factory: verifyRuntime(await readCode(provider, factory), 'RelayFactory', release) };
  const policy = await call(provider, readFactory(factory, 'policyId'));
  if (policy.toLowerCase() !== release.policyId.toLowerCase()) throw new Error('Factory policy mismatch');
  for (const key of ['encoder', 'verifier', 'intake', 'imd']) contracts[key] = getAddress(await call(provider, readFactory(factory, key)));
  if (!same(contracts.intake, release.intake) || !same(contracts.imd, release.imd)) throw new Error('Intake/IMD policy mismatch');
  if (same(contracts.encoder, contracts.verifier)) throw new Error('Duplicate dependencies');
  for (const key of ['encoder', 'verifier']) {
    runtimeCodeKeccak[key] = verifyRuntime(await readCode(provider, contracts[key]), key === 'encoder' ? 'RelayEncoder' : 'RelayVerifier', release);
    const iface = interfaces[key];
    const p = iface.decodeFunctionResult('policyId', await provider.request({ method: 'eth_call', params: [{ to: contracts[key], data: iface.encodeFunctionData('policyId') }, 'latest'] }))[0];
    if (p !== release.policyId) throw new Error('Dependency policy mismatch');
  }
  for (const key of ['intake', 'imd']) runtimeCodeKeccak[key] = keccak256(await readCode(provider, contracts[key]));
  const { verifyBoundRuntime } = await import('./deployment.mjs');
  for (const [key,name] of [['factory','RelayFactory'],['encoder','RelayEncoder'],['verifier','RelayVerifier']]) verifyBoundRuntime(await readCode(provider,contracts[key]),name,release,contracts);
  const prices = {};
  for (const [name, action] of Object.entries(release.actions)) prices[name] = (await call(provider, readPrice(contracts.intake, action, contracts.imd))).toString();
  for (const [key, value] of Object.entries(LIMITS)) {
    const named = { assets: 'assets', inputs: 'inputs', body: 'requestBytes', manifest: 'manifestBytes', document: 'markdownBytes', html: 'htmlBytes', image: 'imageBytes', imagesTotal: 'selectedImagesBytes' }[key];
    if (release.limits?.[named] !== value) throw new Error(`SDK limit ${key} differs from release.json`);
  }
  return { kind: chainId === 1 ? 'ETHEREUM_DEPLOYMENT' : 'LOCAL_DEPLOYMENT', label: chainId === 1 ? 'Ethereum mainnet' : 'Local mock deployment', chainId,
    release: { name: release.name, version: release.version, policyId: release.policyId }, contracts, runtimeCodeKeccak,
    actions: { ...release.actions }, observedPrices: prices, limits: { ...release.limits }, profiles: release.profiles,
    abiSha256: { ...ABI_SOURCE_SHA256 }, publicNetwork: publicConfigStatus(release),
    productionDeployment: null, liveCompatibility: 'NOT_RUN', productionReady: false, remainingReviewRisk: release.remainingReviewRisk };
}
export async function observeLocalDeployment(provider, options) {
  const id = Number(BigInt(await provider.request({ method: 'eth_chainId', params: [] })));
  if (id !== 31337) throw new Error(`Chain ${id} is not a local development chain`);
  return observeDeployment(provider, { ...options, chainId: 31337 });
}
export async function verifyDeploymentConfig(provider, config, release) {
  const problems = [];
  try {
    if (config.chainId === 1) {
      if (!config.handoff || !config.evidence) throw new Error('Official deployment handoff and receipt verification required');
      const { verifyPublicDeployment } = await import('./deployment.mjs');
      const verified = await verifyPublicDeployment(provider, config.handoff, config.evidence, release);
      if (verified.deploymentBlock !== config.deploymentBlock || Object.keys(verified.contracts).some(k => !same(verified.contracts[k],config.contracts[k]))) throw new Error('Runtime config differs from authoritative handoff');
    }
    const observed = await observeDeployment(provider, { release, factory: config.contracts.factory, chainId: config.chainId });
    if (observed.kind !== config.kind) problems.push('kind');
    for (const key of Object.keys(observed.contracts)) if (!(config.chainId === 1 && ['intake','imd'].includes(key)) && !same(observed.contracts[key], config.contracts[key])) problems.push(`contracts.${key}`);
    for (const key of Object.keys(observed.runtimeCodeKeccak)) if (config.chainId !== 1 && observed.runtimeCodeKeccak[key] !== config.runtimeCodeKeccak?.[key]) problems.push(`code.${key}`);
    for (const key of Object.keys(observed.abiSha256)) if (config.chainId !== 1 && observed.abiSha256[key] !== config.abiSha256?.[key]) problems.push(`abi.${key}`);
    if (config.chainId === 1 && !problems.length) { config.contracts.intake = observed.contracts.intake; config.contracts.imd = observed.contracts.imd; }
  } catch (error) { problems.push(error.message); }
  return problems;
}
