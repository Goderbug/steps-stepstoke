// Frontend configuration derived from deployed code, never from fixture constants. Environment-
// neutral: works over any EIP-1193 provider in Node (tools/generate-local-config.mjs) or in the
// browser (re-verification at load). Reads config/release.json content passed in; writes nothing.
import { getAddress, keccak256 } from '../vendor/ethers/ethers.mjs';
import { interfaces, queryPrepared, readFactory, readPrice, LIMITS } from './core.mjs';
import { ABI_SOURCE_SHA256 } from './abi.mjs';

export const LOCAL_CHAIN_IDS = Object.freeze([31337]);
const call = async (provider, prepared) => interfaces[prepared.abi].decodeFunctionResult(prepared.method, await queryPrepared(provider, prepared))[0];
const code = async (provider, target) => {
  const value = await provider.request({ method: 'eth_getCode', params: [target, 'latest'] });
  if (typeof value !== 'string' || !/^0x[0-9a-f]*$/iu.test(value)) throw new Error('Invalid eth_getCode result');
  if (value === '0x') throw new Error(`No code at ${target}`);
  return value;
};
const same = (a, b) => getAddress(a) === getAddress(b);

// A public deployment is configured only when the release names one. A1 has none, so public
// network operations stay closed rather than falling back to a local or fixture deployment.
export function publicConfigStatus(release) {
  if (!release || release.productionDeployment === null || release.productionDeployment === undefined) {
    return Object.freeze({ status: 'CLOSED', reason: 'productionDeployment is null in config/release.json' });
  }
  return Object.freeze({ status: 'UNVERIFIED', reason: 'A configured deployment must be verified on chain before use' });
}

// Observes an actual local deployment and returns the configuration the browser app consumes.
// Every value is read from chain or from release.json; mismatches throw instead of defaulting.
export async function observeLocalDeployment(provider, { release, factory }) {
  if (!release || typeof release.policyId !== 'string') throw new Error('release.json content is required');
  const chainId = Number(BigInt(await provider.request({ method: 'eth_chainId', params: [] })));
  if (!LOCAL_CHAIN_IDS.includes(chainId)) throw new Error(`Chain ${chainId} is not a local development chain; public configuration stays closed`);
  const factoryAddress = getAddress(factory);
  const factoryCode = await code(provider, factoryAddress);
  const policyId = await call(provider, readFactory(factoryAddress, 'policyId'));
  if (policyId.toLowerCase() !== release.policyId.toLowerCase()) throw new Error('Factory policyId differs from release.json');
  const implementation = await call(provider, readFactory(factoryAddress, 'implementation'));
  const encoder = await call(provider, readFactory(factoryAddress, 'encoder'));
  const verifier = await call(provider, readFactory(factoryAddress, 'verifier'));
  const implementationCode = await code(provider, implementation);
  const encoderCode = await code(provider, encoder);
  const verifierCode = await code(provider, verifier);
  const branchRead = async method => interfaces.branch.decodeFunctionResult(method, await queryPrepared(provider, { kind: 'eth_call', transaction: { to: implementation, data: interfaces.branch.encodeFunctionData(method, []) } }))[0];
  const intake = await branchRead('intake');
  const imd = await branchRead('imd');
  const branchPolicy = await branchRead('policyId');
  if (!same(intake, release.intake) || !same(imd, release.imd)) throw new Error('Branch intake/IMD constants differ from release.json');
  if (branchPolicy.toLowerCase() !== release.policyId.toLowerCase()) throw new Error('Branch policyId differs from release.json');
  const intakeCode = await code(provider, intake);
  const imdCode = await code(provider, imd);
  const prices = {};
  for (const [name, action] of Object.entries(release.actions)) {
    const price = await call(provider, readPrice(intake, action, imd));
    prices[name] = price.toString();
  }
  for (const [key, value] of Object.entries(LIMITS)) {
    const named = { assets: 'assets', inputs: 'inputs', body: 'requestBytes', manifest: 'manifestBytes', document: 'markdownBytes', html: 'htmlBytes', image: 'imageBytes', imagesTotal: 'selectedImagesBytes' }[key];
    if (release.limits?.[named] !== value) throw new Error(`SDK limit ${key} differs from release.json`);
  }
  return Object.freeze({
    kind: 'LOCAL_DEPLOYMENT',
    label: 'Local development chain (not a public deployment)',
    chainId,
    release: { name: release.name, version: release.version, policyId: release.policyId },
    contracts: {
      factory: factoryAddress, implementation: getAddress(implementation), encoder: getAddress(encoder), verifier: getAddress(verifier),
      intake: getAddress(intake), imd: getAddress(imd)
    },
    runtimeCodeKeccak: {
      factory: keccak256(factoryCode), implementation: keccak256(implementationCode), encoder: keccak256(encoderCode),
      verifier: keccak256(verifierCode), intake: keccak256(intakeCode), imd: keccak256(imdCode)
    },
    actions: { ...release.actions },
    observedPrices: prices,
    limits: { ...release.limits },
    profiles: release.profiles,
    abiSha256: { ...ABI_SOURCE_SHA256 },
    publicNetwork: publicConfigStatus(release),
    productionDeployment: null,
    liveCompatibility: 'NOT_RUN',
    productionReady: false,
    remainingReviewRisk: release.remainingReviewRisk
  });
}

// Re-checks a generated configuration against the connected chain before any signing flow.
// Returns the list of mismatches; an empty list is required to enable operations.
export async function verifyDeploymentConfig(provider, config, release) {
  const problems = [];
  try {
    const observed = await observeLocalDeployment(provider, { release, factory: config.contracts.factory });
    if (observed.chainId !== config.chainId) problems.push('chainId');
    for (const key of Object.keys(observed.contracts)) if (observed.contracts[key] !== config.contracts[key]) problems.push(`contracts.${key}`);
    for (const key of Object.keys(observed.runtimeCodeKeccak)) if (observed.runtimeCodeKeccak[key] !== config.runtimeCodeKeccak?.[key]) problems.push(`code.${key}`);
    for (const key of Object.keys(observed.abiSha256)) if (observed.abiSha256[key] !== config.abiSha256?.[key]) problems.push(`abi.${key}`);
  } catch (error) {
    problems.push(error.message);
  }
  return problems;
}
