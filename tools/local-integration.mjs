// Offline SDK -> real EVM integration. No private keys or external RPCs are used.
// Run `forge build` first. Anvil's unlocked ephemeral accounts are local test actors only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Contract, ContractFactory, JsonRpcProvider, keccak256, hexlify, toBeHex } from '../vendor/ethers/ethers.mjs';
import * as sdk from '../sdk/index.mjs';
import { verifyHTMLDist } from '../sdk/files.mjs';

const root = new URL('../', import.meta.url);
const artifact = async name => JSON.parse(await readFile(new URL(`out/${name}.sol/${name}.json`, root)));
const config = JSON.parse(await readFile(new URL('config/release.json', root)));
const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
const anvil = spawn('anvil', ['--host', '127.0.0.1', '--port', String(port), '--silent', '--gas-limit', '30000000'], { stdio: ['ignore', 'ignore', 'pipe'] });
let anvilError = '';
anvil.stderr.on('data', data => { anvilError += data; });
let spawnError;
anvil.on('error', error => { spawnError = error; });
const provider = new JsonRpcProvider(`http://127.0.0.1:${port}`, 31337, { cacheTimeout: -1, staticNetwork: true });
provider.pollingInterval = 20;
const temp = await mkdtemp(join(tmpdir(), 'relay-a1-'));
const evidence = { compatibility: 'LOCAL_MOCK_ONLY', liveCompatibility: 'NOT_RUN', chainId: 31337, checks: [], transactions: [], rounds: [] };
const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item, 2);
try {
  // Short bounded startup polling, never an external service wait.
  let started = false;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    if (anvil.exitCode !== null) throw new Error(`Anvil exited: ${anvilError}`);
    try { await provider.send('eth_chainId', []); started = true; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(started, 'Anvil startup');
  const sponsor = await provider.getSigner(0);
  const writer = await provider.getSigner(1);
  const treasury = await provider.getSigner(2);
  const payer = await sponsor.getAddress();
  const tx = async (label, prepared, signer = sponsor) => {
    // Every prepared transaction is simulated against the current state before submission.
    await provider.call({ ...prepared, from: await signer.getAddress() });
    const receipt = await (await signer.sendTransaction({ ...prepared, gasLimit: 29000000n })).wait();
    assert.equal(receipt.status, 1);
    evidence.transactions.push({ label, hash: receipt.hash, gasUsed: receipt.gasUsed, block: receipt.blockNumber });
    return receipt;
  };
  const tokenArtifact = await artifact('MockToken');
  const intakeArtifact = await artifact('MockIntake');
  await provider.send('anvil_setCode', [config.imd, tokenArtifact.deployedBytecode.object]);
  await provider.send('anvil_setCode', [config.intake, intakeArtifact.deployedBytecode.object]);
  const token = new Contract(config.imd, tokenArtifact.abi, sponsor);
  const intake = new Contract(config.intake, intakeArtifact.abi, sponsor);
  await (await intake.initialize(await writer.getAddress(), await treasury.getAddress(), config.imd)).wait();
  const fee = 500000000000000000n;
  for (const action of Object.values(config.actions)) await (await intake.setPrice(action, fee)).wait();
  await (await token.mint(payer, fee * 20n)).wait();
  const factoryArtifact = await artifact('RelayFactory');
  const factory = await new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode.object, sponsor).deploy({ gasLimit: 29000000n });
  const deployReceipt = await factory.deploymentTransaction().wait();
  evidence.transactions.push({ label: 'deploy fixed factory and dependencies', hash: deployReceipt.hash, gasUsed: deployReceipt.gasUsed });
  const factoryAddress = await factory.getAddress();
  assert.equal((await factory.policyId()).toLowerCase(), config.policyId);
  const branchFrom = receipt => {
    const event = receipt.logs.map(log => { try { return sdk.interfaces.factory.parseLog(log); } catch { return null; } }).find(log => log?.name === 'BranchCreated');
    assert.ok(event);
    return new Contract(event.args.branch, sdk.interfaces.branch, sponsor);
  };
  const branch = branchFrom(await tx('SDK create project', sdk.createProject(factoryAddress, 'Maintain a public relay project.')));
  assert.equal(await intake.count(), 0n);
  const branchAddress = await branch.getAddress();
  await (await token.approve(branchAddress, fee * 10n)).wait();
  let current = [];
  const histories = new Map();
  const logsByBranch = new Map();
  const round = async (b, profile, target, inputs, file, text, projectOverride) => {
    const bAddress = await b.getAddress();
    const old = current;
    const rawFixture = await readFile(new URL(`test/fixtures/${file}.result.json`, root));
    // Child manifests are separate mock writer results with their own project identity.
    const manifest = projectOverride ? { ...JSON.parse(rawFixture), projectId: projectOverride } : null;
    const raw = manifest ? Buffer.from(JSON.stringify(manifest)) : rawFixture;
    const verified = sdk.verifyManifest(raw, keccak256(raw));
    const bytes = await readFile(new URL(`test/fixtures/${file}`, root));
    sdk.verifyFile(verified.file, bytes);
    if (verified.file.mediaType === 'text/html') {
      const dist = join(temp, `dist-${evidence.rounds.length}`);
      await mkdir(dist);
      await writeFile(join(dist, 'index.html'), bytes);
      const images = old.filter(a => inputs.includes(a.key) && a.kind === 2);
      const selectedImages = await Promise.all(images.map(async descriptor => ({ descriptor, bytes: await readFile(new URL('test/fixtures/image-2.png', root)) })));
      await verifyHTMLDist(dist, verified.file, selectedImages);
    }
    const proposal = {
      anchor: await b.anchor(), profile, target, inputs,
      outputName: verified.file.name, outputPath: verified.file.path, text, publish: false
    };
    const before = await intake.count();
    await tx(`SDK propose ${file}`, sdk.proposeWork(bAddress, proposal, old));
    assert.equal(await intake.count(), before, 'proposing never buys');
    const id = await b.proposalCount();
    const readProvider = { request: ({ method, params }) => provider.send(method, params) };
    const preview = await sdk.queryPreview(readProvider, sdk.previewProposal(bAddress, id, old));
    const body = JSON.parse(Buffer.from(preview.raw).toString('utf8'));
    const latest = await b.latestJobId();
    assert.equal(preview.action, latest ? config.actions.continue : config.actions.open);
    assert.equal(body.parentJobId, latest || undefined);
    for (const forbidden of ['repoUrl', 'baseCommit', 'projectId']) assert.equal(body[forbidden], undefined);
    assert.equal(body.github, true);
    assert.equal(body.ipfs, false);
    assert.equal(body.steps[0].inputs.length, inputs.length);
    for (let i = 0; i < inputs.length; i++) {
      const source = old.find(a => a.key === inputs[i]);
      const actual = body.steps[0].inputs[i];
      assert.deepEqual(actual, { name: source.name, path: source.path, hash: source.fileHash.slice(2), mediaType: source.mediaType, bytes: Number(source.size), submissionHash: source.submissionHash.slice(2), as: `asset-${i}` });
    }
    await tx(`SDK sponsor ${file}`, sdk.sponsorProposal(bAddress, id, fee, old));
    let attempt = await b.attempt(await b.activeAttempt());
    const requested = await intake.request(attempt.requestId);
    assert.equal(requested.payer, bAddress);
    assert.equal(requested.body.toLowerCase(), hexlify(preview.raw).toLowerCase());
    assert.equal(await token.allowance(bAddress, config.intake), 0n);
    assert.equal(await token.balanceOf(bAddress), 0n);
    if (file === 'document-updated.md') {
      const refusal = await (await intake.connect(writer).fail(attempt.requestId, 1, toBeHex(1, 32), { gasLimit: 500000n })).wait();
      evidence.transactions.push({ label: 'mock refusal callback under 200k stipend', hash: refusal.hash, gasUsed: refusal.gasUsed });
      assert.equal(await b.phase(), 4n);
      const revisionBeforeRetry = await b.revision();
      await tx('SDK explicit funded identical retry', sdk.retryRefused(bAddress, fee, old));
      const retried = await b.attempt(await b.activeAttempt());
      assert.notEqual(retried.requestId, attempt.requestId);
      assert.equal(retried.proposalId, attempt.proposalId);
      assert.equal(retried.bodyHash, attempt.bodyHash);
      assert.equal((await intake.request(retried.requestId)).body, requested.body);
      assert.equal(await b.revision(), revisionBeforeRetry);
      attempt = retried;
    }
    const completion = await (await intake.connect(writer).complete(attempt.requestId, raw, { gasLimit: 500000n })).wait();
    evidence.transactions.push({ label: `mock result callback ${file} under 200k stipend`, hash: completion.hash, gasUsed: completion.gasUsed });
    assert.equal(await b.phase(), 3n, 'callback succeeds within 200k stipend');
    if (old.length) {
      const oldAnchor = await b.anchor();
      await assert.rejects(provider.call({ ...sdk.bindResult(bAddress, raw, keccak256(raw), []), from: payer }));
      assert.equal(await b.phase(), 3n);
      assert.equal(await b.anchor(), oldAnchor);
      assert.equal((await b.attempt(await b.activeAttempt())).outcome, keccak256(raw));
    }
    const receipt = await tx(`SDK bind ${file}`, sdk.bindResult(bAddress, raw, keccak256(raw), old));
    const log = receipt.logs.find(log => { try { return sdk.interfaces.branch.parseLog(log)?.name === 'CheckpointWritten'; } catch { return false; } });
    const checkpoint = sdk.decodeCheckpoint(log);
    current = checkpoint.witness;
    assert.equal(await b.assetsHash(), sdk.witnessHash(current));
    assert.equal(await b.phase(), 0n);
    for (const asset of old.filter(a => a.key !== target)) assert.deepEqual(current.find(a => a.key === asset.key), asset, 'untouched provenance');
    const output = current.find(a => a.key === target);
    assert.equal(output.fileHash, verified.file.hash);
    assert.equal(output.resultHash, keccak256(raw));
    assert.equal(output.producer, bAddress);
    const history = histories.get(bAddress) ?? {};
    history[checkpoint.revision.toString()] = await b.checkpoint(checkpoint.revision);
    histories.set(bAddress, history);
    const logs = logsByBranch.get(bAddress) ?? [];
    logs.push(log);
    logsByBranch.set(bAddress, logs);
    sdk.recoverHistory(bAddress, logs, history);
    evidence.rounds.push({ branch: bAddress, profile, file, action: preview.action, parentJobId: body.parentJobId ?? null, bodyBytes: preview.byteLength, bodyHash: preview.bodyHash, rawBodyHex: hexlify(preview.raw), rawBody: body, resultHash: keccak256(raw), rawManifestHex: hexlify(raw), fileCheck: verified.file, revision: checkpoint.revision, checkpointDigest: checkpoint.digest, assetsHash: checkpoint.assetsHash, witness: checkpoint.witness });
    return checkpoint;
  };
  const key = n => toBeHex(n, 32);
  await round(branch, 2, key(10), [], 'html-1.html', 'Create the original HTML with its marker.');
  const historical = current;
  const historicalDigest = await branch.anchor();
  await round(branch, 4, key(20), [], 'image-2.png', 'Generate one PNG.');
  await round(branch, 3, key(10), [key(10), key(20)], 'html-3.html', 'Restore selected HTML, retain original-marker and inline the selected PNG exactly.');
  assert.equal(evidence.rounds[2].parentJobId, JSON.parse(await readFile(new URL('test/fixtures/image-2.png.result.json', root))).jobId);
  assert.ok((await readFile(new URL('test/fixtures/html-3.html', root), 'utf8')).includes('id="original-marker"'));
  await round(branch, 0, key(5), [], 'document.md', 'Create the Markdown document.');
  await round(branch, 1, key(5), [key(5)], 'document-updated.md', 'Update the selected Markdown document.');
  const parentCurrentHash = await branch.assetsHash();
  const paid = await intake.count();
  const child = branchFrom(await tx('SDK fork historical revision 1', sdk.forkHistory(factoryAddress, branchAddress, 1, historical, 'Illustrate and extend the original HTML.')));
  const childAddress = await child.getAddress();
  assert.equal(await intake.count(), paid);
  assert.equal(await child.projectId(), '');
  assert.equal(await child.latestJobId(), '');
  assert.equal(await child.proposalCount(), 0n);
  assert.equal(await child.assetsHash(), sdk.witnessHash(historical));
  assert.equal((await child.source()).checkpoint, historicalDigest);
  await (await token.approve(childAddress, fee * 10n)).wait();
  current = historical;
  await round(child, 4, key(20), [], 'image-2.png', 'Generate a PNG for this child.', 'local-child-project');
  await round(child, 3, key(10), [key(10), key(20)], 'html-3.html', 'Continue this child using its own latest job and the inherited HTML.', 'local-child-project');
  assert.equal(await branch.assetsHash(), parentCurrentHash);
  assert.equal(await intake.count(), 8n);
  assert.equal(await token.balanceOf(await treasury.getAddress()), fee * 8n);
  evidence.checks.push('All five fixed profile modes executed', 'HTML -> image -> HTML selects both authenticated older HTML and latest image', 'Exact PNG data URI and old marker checked without executing HTML', 'Historical fork uses revision 1 after parent revision 5', 'Child opens its own project then continues its own latest job', 'Untouched descriptors and provenance preserved', 'No implicit purchases; exact fees, zero Branch residual balance/allowance', 'SDK canonical witness, raw manifest, transaction and history encoding agree with EVM', 'Explicit SDK-funded status-1 retry retains exact body/snapshot and does not create a revision', 'Rejected wrong-witness binding preserves recorded result/anchor and correct SDK binding succeeds without purchase');
  evidence.factory = factoryAddress;
  evidence.parent = branchAddress;
  evidence.child = childAddress;
  console.log(json(evidence));
} finally {
  provider.destroy();
  const exited = once(anvil, 'exit').catch(() => {});
  anvil.kill('SIGTERM');
  if (anvil.exitCode === null && !spawnError) await exited;
  await rm(temp, { recursive: true, force: true });
}
