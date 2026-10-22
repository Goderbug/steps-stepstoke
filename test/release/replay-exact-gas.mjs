// Local transaction evidence only. Uses Anvil's unlocked disposable accounts, never keys or a public RPC.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AbiCoder, Contract, ContractFactory, Interface, JsonRpcProvider, getCreate2Address,
  keccak256, sha256, toBeHex, toUtf8Bytes, encodeBytes32String,
} from '../../vendor/ethers/ethers.mjs';

const artifacts = resolve(process.argv[2] ?? 'test/scratch/out');
const artifact = async (file, name = file) => JSON.parse(await readFile(`${artifacts}/${file}.sol/${name}.json`));
const cap = 16_777_216n;
const fee = 500_000_000_000_000_000n;
const intakeAddress = '0xa43e6F75ee006411F79Ac1C84120606C2330DE82';
const tokenAddress = '0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7';
const open = encodeBytes32String('job.open@job-1');
const continuation = encodeBytes32String('job.continue@job-1');
const accepted = JSON.parse(await readFile(new URL('../../docs/validation/launch-packaging-v1/retained-binding.json', import.meta.url)));
const original = accepted.measurements.find(m => m.label === 'utf8-retained');
assert.equal(sha256(toUtf8Bytes(original.rawResult)), '0x8768318db71105397ac89eef44af007752b94e966eb8adebd237a2b97c9de805');
assert.equal(toUtf8Bytes(original.rawResult).length, 32768);

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const node = spawn('anvil', ['--host', '127.0.0.1', '--port', String(port), '--chain-id', '1',
  '--hardfork', 'prague', '--gas-limit', String(cap), '--silent'], { stdio: ['ignore', 'ignore', 'pipe'] });
let nodeError = '';
node.stderr.on('data', b => { nodeError += b.toString(); });
node.on('error', e => { nodeError += e.message; });
const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, 1, { staticNetwork: true, cacheTimeout: -1 });
provider.pollingInterval = 10;
const pause = () => new Promise(resolve => setTimeout(resolve, 20));

try {
  for (let i = 0; ; ++i) {
    try { assert.equal(await provider.send('eth_chainId', []), '0x1'); break; }
    catch (e) { if (i === 100 || node.exitCode !== null) throw new Error(`Local Anvil unavailable: ${nodeError || e}`); await pause(); }
  }
  assert.match(await provider.send('web3_clientVersion', []), /anvil/i);
  const payer = await provider.getSigner(0);
  const writer = await provider.getSigner(1);
  const beneficiary = await provider.getSigner(2);
  const mined = async promise => {
    const tx = await promise;
    assert.ok(tx.gasLimit <= cap, 'transaction gas limit exceeds the release ceiling');
    for (let i = 0; i < 500; ++i) {
      const r = await provider.getTransactionReceipt(tx.hash);
      if (r) { assert.equal(r.status, 1, `local transaction reverted: ${tx.hash}`); return r; }
      await pause();
    }
    throw new Error(`No local receipt for ${tx.hash}; transaction was not resent`);
  };
  const deploy = async (name, args = [], file = name) => {
    const a = await artifact(file, name);
    const c = await new ContractFactory(a.abi, a.bytecode.object, payer).deploy(...args, { gasLimit: cap });
    await mined(c.deploymentTransaction());
    return c;
  };
  const tokenArtifact = await artifact('MockToken');
  const intakeArtifact = await artifact('MockIntake');
  await provider.send('anvil_setCode', [tokenAddress, tokenArtifact.deployedBytecode.object]);
  await provider.send('anvil_setCode', [intakeAddress, intakeArtifact.deployedBytecode.object]);
  const token = new Contract(tokenAddress, tokenArtifact.abi, payer);
  const intake = new Contract(intakeAddress, intakeArtifact.abi, payer);
  await mined(intake.initialize(await writer.getAddress(), await beneficiary.getAddress(), tokenAddress, { gasLimit: cap }));
  await mined(intake.setPrice(open, fee, { gasLimit: cap }));
  await mined(intake.setPrice(continuation, fee, { gasLimit: cap }));
  await mined(token.mint(await payer.getAddress(), 100n * fee, { gasLimit: cap }));

  // Same local deployment nonces as the accepted archive; this preserves every
  // producer field in the ORIGINAL witness, rather than silently substituting it.
  const encoder = await deploy('RelayEncoder');
  const verifier = await deploy('RelayVerifier');
  const factory = await deploy('RelayFactory', [await encoder.getAddress(), await verifier.getAddress()]);
  const created = await mined(factory.createProject('G'.repeat(512), { gasLimit: cap }));
  const event = created.logs.map(l => { try { return factory.interface.parseLog(l); } catch { return null; } }).find(e => e?.name === 'BranchCreated');
  const branchArtifact = await artifact('RelayBranch');
  const branch = new Contract(event.args.branch, branchArtifact.abi, payer);
  const iface = new Interface(branchArtifact.abi);
  const abi = AbiCoder.defaultAbiCoder();
  const witnessType = iface.getFunction('bind').inputs[1];
  const archivedWitness = iface.decodeFunctionData('bind', original.calldata)[1];
  assert.equal(await branch.getAddress(), archivedWitness[0].producer);
  await mined(token.approve(await branch.getAddress(), 100n * fee, { gasLimit: cap }));
  let current = [];

  const record = async (proposal, raw) => {
    await mined(branch.propose(proposal, current, { gasLimit: cap }));
    await mined(branch.sponsor(await branch.proposalCount(), fee, current, { gasLimit: cap }));
    const a = await branch.attempt(await branch.activeAttempt());
    await mined(intake.connect(writer).complete(a.requestId, toUtf8Bytes(raw), { gasLimit: cap }));
    assert.equal(await branch.phase(), 3n);
  };
  const bind = async raw => {
    const r = await mined(branch.bind(toUtf8Bytes(raw), current, { gasLimit: cap }));
    const log = r.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).find(e => e?.name === 'CheckpointWritten');
    assert.ok(log, 'complete binding must emit the accepted witness');
    current = Array.from(abi.decode([witnessType], log.args.witness)[0], a => a.toObject());
    return r;
  };
  for (let i = 1; i <= 16; ++i) {
    const profile = i <= 14 ? 0 : i === 15 ? 2 : 4;
    const name = String.fromCharCode(65 + i).repeat(64);
    const path = i <= 14 ? `artifacts/${String.fromCharCode(97 + i).repeat(115)}.md`
      : i === 15 ? 'artifacts/index.html' : `artifacts/${'a'.repeat(114)}.png`;
    const proposal = { anchor: await branch.anchor(), profile, target: toBeHex(i, 32), inputs: [],
      outputName: name, outputPath: path, text: 'Perform the declared change.', publish: false };
    const raw = JSON.stringify({ jobId: name, projectId: 'metadata-project', state: 'completed', source: [], files: [{
      name, path, hash: sha256(toUtf8Bytes('local-fixture-content')).slice(2),
      mediaType: i <= 14 ? 'text/markdown' : i === 15 ? 'text/html' : 'image/png', bytes: 83,
      submissionHash: sha256(toUtf8Bytes('local-fixture-submission')).slice(2),
    }] });
    await record(proposal, raw);
    await bind(raw);
  }
  assert.equal(abi.encode([witnessType], [current]), abi.encode([witnessType], [archivedWitness]));
  const originalWitnessHash = keccak256(abi.encode([witnessType], [current]));
  assert.equal(originalWitnessHash, '0x45bf29418f29ab58d2166ef45615e718d720d4653c73e8a4fa1b333f72389828');
  const historical = await branch.checkpoint(16);
  const proposal = { anchor: await branch.anchor(), profile: 1, target: toBeHex(1, 32), inputs: [toBeHex(1, 32)],
    outputName: current[0].name, outputPath: current[0].path, text: 'Perform the declared change.', publish: false };
  await record(proposal, original.rawResult);
  assert.equal(iface.encodeFunctionData('bind', [toUtf8Bytes(original.rawResult), current]), original.calldata);
  const receipt = await bind(original.rawResult);
  assert.ok(receipt.gasUsed < cap);
  const transaction = await provider.getTransaction(receipt.hash);
  assert.equal(transaction.data, original.calldata);
  assert.equal(transaction.value, 0n);
  assert.equal(transaction.chainId, 1n);
  assert.equal(transaction.gasLimit, cap);
  assert.equal(await branch.revision(), 17n);
  assert.equal(await branch.phase(), 0n);
  assert.equal((await branch.checkpoint(16)).digest, historical.digest);
  assert.equal((await branch.checkpoint(17)).resultHash, keccak256(toUtf8Bytes(original.rawResult)));
  assert.equal(await token.balanceOf(await beneficiary.getAddress()), 17n * fee);
  assert.equal(await token.balanceOf(await branch.getAddress()), 0n);
  assert.equal(await token.allowance(await branch.getAddress(), intakeAddress), 0n);
  assert.equal((await provider.getBlock(receipt.blockNumber)).hash, receipt.blockHash);

  // Rehearse all named launch contracts in ONE CREATE2 transaction, with backward
  // references and zero value. This helper is not the official deployment service.
  const launcher = await deploy('NamedBatchProbe', [], 'LaunchCompatibility.t');
  const names = ['RelayEncoder', 'RelayVerifier', 'RelayFactory'];
  const codes = await Promise.all(names.map(async n => (await artifact(n)).bytecode.object));
  const salts = names.map(n => keccak256(toUtf8Bytes(`release-test:${n}`)));
  const addresses = [];
  for (let i = 0; i < 3; ++i) {
    if (i === 2) codes[i] += abi.encode(['address', 'address'], addresses).slice(2);
    assert.ok((codes[i].length - 2) / 2 <= 49_152);
    addresses.push(getCreate2Address(await launcher.getAddress(), salts[i], keccak256(codes[i])));
  }
  const launchReceipt = await mined(launcher.deployAll(codes, salts, { gasLimit: cap }));
  assert.equal((await provider.getTransaction(launchReceipt.hash)).value, 0n);
  const launchedFactory = new Contract(addresses[2], (await artifact('RelayFactory')).abi, payer);
  assert.equal(await launchedFactory.encoder(), addresses[0]);
  assert.equal(await launchedFactory.verifier(), addresses[1]);
  assert.equal(await launchedFactory.branchCount(), 0n);
  const runtimes = [];
  for (let i = 0; i < 3; ++i) {
    const a = await artifact(names[i]);
    const settings = a.metadata.settings;
    assert.equal(a.metadata.compiler.version, '0.8.26+commit.8a97fa7a');
    assert.equal(settings.evmVersion, 'cancun');
    assert.equal(settings.viaIR, true);
    assert.deepEqual(settings.optimizer, { enabled: true, runs: 200 });
    assert.equal(settings.metadata.bytecodeHash, 'none');
    assert.deepEqual(settings.libraries, {});
    assert.deepEqual(a.bytecode.linkReferences, {});
    assert.deepEqual(a.deployedBytecode.linkReferences, {});
    const ctor = a.abi.find(entry => entry.type === 'constructor');
    assert.equal(ctor?.stateMutability ?? 'nonpayable', 'nonpayable');
    assert.deepEqual((ctor?.inputs ?? []).map(input => input.type), i === 2 ? ['address', 'address'] : []);
    const exported = await readFile(new URL(`../../abi/${names[i]}.json`, import.meta.url));
    assert.deepEqual(a.abi, JSON.parse(exported));
    assert.equal(await provider.getTransactionCount(addresses[i]), 1, 'constructor created a child');
    const code = await provider.getCode(addresses[i]);
    assert.ok(code.length > 2 && (code.length - 2) / 2 <= 24_576);
    const runtime = Buffer.from(code.slice(2), 'hex');
    const compiled = Buffer.from(a.deployedBytecode.object.slice(2), 'hex');
    const immutableBindings = [];
    for (const [id, refs] of Object.entries(a.deployedBytecode.immutableReferences ?? {})) {
      const word = runtime.subarray(refs[0].start, refs[0].start + refs[0].length);
      for (const ref of refs) {
        assert.equal(ref.length, 32);
        assert.deepEqual(runtime.subarray(ref.start, ref.start + ref.length), word);
        word.copy(compiled, ref.start);
      }
      immutableBindings.push({ id, word: `0x${word.toString('hex')}`, offsets: refs });
    }
    assert.deepEqual(compiled, runtime, 'deployed runtime differs beyond immutable substitution');
    if (i === 2) {
      assert.deepEqual(immutableBindings.map(b => b.word).sort(), addresses.slice(0, 2).map(a => abi.encode(['address'], [a])).sort());
    } else assert.equal(immutableBindings.length, 0);
    // Same reachable-opcode rule as the protected floor; PUSH data is not executable.
    let reachable = true;
    for (let pc = 0; pc < runtime.length; ++pc) {
      const op = runtime[pc];
      if (op === 0x5b) reachable = true;
      if (op >= 0x60 && op <= 0x7f) { pc += op - 0x5f; continue; }
      if (reachable) assert.ok(![0xf4, 0xf2, 0xff].includes(op), 'forbidden reachable opcode');
      if ([0x00, 0x56, 0xf3, 0xfd, 0xfe, 0xff].includes(op)) reachable = false;
    }
    runtimes.push({ name: names[i], address: addresses[i], bytes: runtime.length, keccak256: keccak256(code),
      constructorArguments: i === 2 ? addresses.slice(0, 2) : [],
      constructorArgumentsAbi: i === 2 ? abi.encode(['address', 'address'], addresses.slice(0, 2)) : '0x',
      abiSha256: sha256(exported), immutableBindings });
  }
  await mined(launchedFactory.createProject('Local launch child rehearsal', { gasLimit: cap }));
  assert.equal(await launchedFactory.branchCount(), 1n);
  console.log(JSON.stringify({ scope: 'LOCAL_ANVIL_ONLY', chainId: 1, productionReady: false,
    liveProfileChecks: 'NOT_RUN', officialLaunchId: null, publicDeploymentTransaction: null,
    rawSha256: sha256(toUtf8Bytes(original.rawResult)), witnessKeccak256: originalWitnessHash,
    originalCalldataIdentical: true, transactionGasLimit: String(cap),
    buildSettings: { solc: '0.8.26+commit.8a97fa7a', evmVersion: 'cancun', viaIR: true,
      optimizer: true, optimizerRuns: 200, bytecodeHash: 'none', linkedLibraries: [] },
    bindGasUsed: String(receipt.gasUsed), localBindTransaction: receipt.hash,
    localBlock: receipt.blockNumber, localBlockHash: receipt.blockHash,
    batchGasUsed: String(launchReceipt.gasUsed), localBatchTransaction: launchReceipt.hash,
    localBatchSender: launchReceipt.from, localCreationCaller: await launcher.getAddress(), runtimes,
  }, null, 2));
} finally {
  provider.destroy();
  node.kill();
}
