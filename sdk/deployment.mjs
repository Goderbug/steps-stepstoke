// Read-only deployment provenance. Runtime templates/hashes come from the frozen build,
// never from downloaded evidence. Immutables are checked as actual address words.
import { keccak256 } from '../vendor/ethers/ethers.mjs';
import { canonicalJSON, validateHandoff } from './handoff.mjs';
import { verifyRuntime } from './config.mjs';
const eq = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const tag = n => '0x' + n.toString(16);
export function verifyBoundRuntime(code, name, release, addresses) {
  const hash = verifyRuntime(code, name, release);
  const bindings = release.runtimeChecks[name].immutableBindings ?? {};
  for (const [id, slots] of Object.entries(release.runtimeChecks[name].immutableReferences)) {
    const expected = addresses[bindings[id]];
    if (!/^0x[0-9a-f]{40}$/iu.test(expected ?? '')) throw new Error(`${name} missing frozen immutable binding`);
    const word = expected.slice(2).toLowerCase().padStart(64, '0');
    for (const { start, length } of slots) if (length !== 32 || code.slice(2 + start * 2, 2 + (start + length) * 2).toLowerCase() !== word) throw new Error(`${name} wrong immutable ${bindings[id]}`);
  }
  return hash;
}
export async function verifyPublicDeployment(provider, h, evidence, release) {
  validateHandoff(h);
  if (Number(BigInt(await provider.request({ method:'eth_chainId', params:[] }))) !== 1) throw new Error('Wrong chain; no implicit switch');
  if (!evidence || evidence.sourceCommit !== h.sourceCommit || evidence.attestationHash !== h.attestationHash || !Number.isSafeInteger(evidence.blockNumber) || evidence.blockNumber < 1 || !/^0x[0-9a-f]{64}$/iu.test(evidence.transactionHash ?? '') || !/^0x[0-9a-f]{64}$/iu.test(evidence.blockHash ?? '')) throw new Error('Missing deployment receipt evidence');
  if (canonicalJSON(evidence.build) !== canonicalJSON(release.frozenBuild)) throw new Error('Source/compiler/settings differ from frozen build');
  const receipt = await provider.request({ method:'eth_getTransactionReceipt', params:[evidence.transactionHash] });
  const block = await provider.request({ method:'eth_getBlockByNumber', params:[tag(evidence.blockNumber),false] });
  if (!receipt || !eq(receipt.transactionHash,evidence.transactionHash) || BigInt(receipt.status) !== 1n || Number(BigInt(receipt.blockNumber)) !== evidence.blockNumber || !eq(receipt.blockHash,evidence.blockHash) || !eq(block?.hash,evidence.blockHash) || Number(BigInt(block.number)) !== evidence.blockNumber || !block.transactions.some(t => eq(typeof t === 'string' ? t : t.hash,evidence.transactionHash))) throw new Error('Deployment receipt/block mismatch');
  const addresses = Object.fromEntries(h.contracts.map(c => [c.name.replace('Relay','').toLowerCase(),c.address]));
  // A batched factory launch has no receipt.contractAddress. Require actual CREATE traces.
  // Providers without historical code or callTracer support fail closed, not a guessed receipt.
  const trace = await provider.request({ method:'debug_traceTransaction', params:[evidence.transactionHash,{tracer:'callTracer'}] });
  const creates=[]; const visit = t => { if (!t || t.error) throw new Error('Failed deployment trace'); if (['CREATE','CREATE2'].includes(t.type)) creates.push(t); for (const c of t.calls ?? []) visit(c); }; visit(trace);
  for (const c of h.contracts) {
    const create = creates.filter(t => eq(t.to,c.address));
    if (create.length !== 1) throw new Error(`No unique creation trace for ${c.name}`);
    const argsBytes = c.name === 'RelayFactory' ? 64 : 0;
    const input = create[0].input;
    if (!/^0x(?:[0-9a-f]{2})+$/iu.test(input ?? '') || keccak256(input.slice(0,input.length-argsBytes*2)) !== release.contracts[c.name].creationCodeHash) throw new Error('Creation code differs from frozen compiler output');
    if (argsBytes && input.slice(-128).toLowerCase() !== addresses.encoder.slice(2).toLowerCase().padStart(64,'0') + addresses.verifier.slice(2).toLowerCase().padStart(64,'0')) throw new Error('Factory constructor arguments mismatch');
    const previous = await provider.request({ method:'eth_getCode',params:[c.address,tag(evidence.blockNumber-1)] });
    if (previous !== '0x') throw new Error('Address predates supplied deployment');
    for (const at of [tag(evidence.blockNumber),'latest']) {
      const code = await provider.request({method:'eth_getCode',params:[c.address,at]});
      verifyBoundRuntime(code,c.name,release,addresses);
      if (create[0].output && !eq(create[0].output,code)) throw new Error('Creation trace runtime differs');
    }
  }
  return { validity:'VERIFIED_DEPLOYMENT', chainId:1, contracts:addresses, deploymentBlock:evidence.blockNumber, blockHash:evidence.blockHash, transactionHash:evidence.transactionHash, liveCompatibility:'NOT_RUN', productionReady:false };
}
