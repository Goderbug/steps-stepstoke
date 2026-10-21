// Runtime-neutral actual-local-contract scenario for the browser SDK entrypoint. Runs unchanged in
// Node (tools/sdk-local-check.mjs) and inside a real browser page. Every step sends a real
// transaction to a local chain through an EIP-1193 provider; nothing is replayed or faked.
// LOCAL ONLY: MockIntake/MockToken stand in for the live Intake/IMD; the writer callbacks are the
// mock writer's, and the accounts are the local chain's unlocked development accounts.
export async function runLocalScenario({ sdk, provider, config, accounts, writer, intakeInterface, fixtures, label }) {
  const trace = { label, runtime: sdk.RUNTIME, configKind: config.kind, steps: [] };
  const check = (condition, message) => { if (!condition) throw new Error(`${label}: ${message}`); };
  const read = async prepared => (await sdk.queryState(provider, prepared))[0];
  const receiptOf = async hash => {
    for (let i = 0; i < 400; i++) {
      const receipt = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
      if (receipt) return receipt;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`${label}: receipt not observed for original hash ${hash}; no resubmission`);
  };
  const send = async (step, prepared, from) => {
    // Simulate on current state, then hand the unsigned transaction to the account's provider.
    await provider.request({ method: 'eth_call', params: [{ from, to: prepared.to, data: prepared.data }, 'latest'] });
    const request = sdk.toWalletRequest(prepared, { from, chainId: config.chainId });
    const hash = await provider.request({ method: request.method, params: [{ ...request.params[0], gas: '0x1c9c380' }] });
    const receipt = await receiptOf(hash);
    check(BigInt(receipt.status) === 1n, `${step} reverted`);
    trace.steps.push({ step, from, to: prepared.to, hash, gasUsed: BigInt(receipt.gasUsed).toString(), block: BigInt(receipt.blockNumber).toString() });
    return receipt;
  };
  const writerSend = async (step, data) => {
    const hash = await provider.request({ method: 'eth_sendTransaction', params: [{ from: writer, to: config.contracts.intake, data, gas: '0x1e8480' }] });
    const receipt = await receiptOf(hash);
    check(BigInt(receipt.status) === 1n, `${step} reverted`);
    trace.steps.push({ step, from: writer, hash, mock: 'MOCK_WRITER_CALLBACK' });
  };
  const [creator, funderA, funderB] = accounts;
  const { factory, imd, intake } = config.contracts;
  const price = await read(sdk.readPrice(intake, config.actions.open, imd));
  check(price.toString() === config.observedPrices.open, 'price differs from generated config');
  check(await read(sdk.readFactory(factory, 'policyId')) === config.release.policyId, 'policy');

  // 1. Anyone creates a project (root Branch). No AI is bought.
  const created = await send('createProject', sdk.createProject(factory, `Relay ${label}: public goal 公开目标`), creator);
  const createdLog = created.logs.map(log => { try { return sdk.interfaces.factory.parseLog(log); } catch { return null; } }).find(log => log?.name === 'BranchCreated');
  check(createdLog, 'BranchCreated');
  const branch = createdLog.args.branch;
  check(await read(sdk.readFactory(factory, 'registered', [branch])) === true, 'registered');
  const key = n => `0x${n.toString(16).padStart(64, '0')}`;
  const round = async ({ name, profile, target, inputs, witness, raw, file, funder, refuseFirst }) => {
    const verified = sdk.verifyManifest(raw, sdk.keccak256Bytes(raw));
    sdk.verifyFile(verified.file, file);
    const anchor = await read(sdk.readState(branch, 'anchor'));
    // 2. Propose (no purchase); proposer differs from the funder.
    const proposal = { anchor, profile, target, inputs, outputName: verified.file.name, outputPath: verified.file.path, text: `${name} 中文`, publish: false };
    await send(`propose ${name}`, sdk.proposeWork(branch, proposal, witness), creator);
    check(BigInt(await read(sdk.readState(branch, 'phase'))) === 0n, 'proposing never buys');
    const id = await read(sdk.readState(branch, 'proposalCount'));
    const preview = await sdk.queryPreview(provider, sdk.previewProposal(branch, id, witness));
    // 3. Explicit sponsorship: exact allowance confirmed first, then purchase with maxFee = price.
    const fund = async step => {
      const currentPrice = await read(sdk.readPrice(intake, preview.action, imd));
      await send(`approve exact ${step}`, sdk.approveExact(imd, branch, currentPrice), funder);
      check(await read(sdk.readAllowance(imd, funder, branch)) === currentPrice, 'exact allowance confirmed');
      return currentPrice;
    };
    const fee = await fund(`sponsor ${name}`);
    await send(`sponsor ${name}`, sdk.sponsorProposal(branch, id, fee, witness), funder);
    check(await read(sdk.readAllowance(imd, funder, branch)) === 0n, 'allowance consumed exactly');
    let attempt = await read(sdk.readState(branch, 'attempt', [await read(sdk.readState(branch, 'activeAttempt'))]));
    check(attempt.bodyHash === preview.bodyHash, 'purchased body equals previewed body');
    if (refuseFirst) {
      await writerSend(`mock status1 refusal ${name}`, intakeInterface.encodeFunctionData('fail', [attempt.requestId, 1, key(1)]));
      check(BigInt(await read(sdk.readState(branch, 'phase'))) === 4n, 'refused phase');
      const retryFee = await fund(`retry ${name}`);
      await send(`explicit funded identical retry ${name}`, sdk.retryRefused(branch, retryFee, witness), funder);
      const retried = await read(sdk.readState(branch, 'attempt', [await read(sdk.readState(branch, 'activeAttempt'))]));
      check(retried.bodyHash === attempt.bodyHash && retried.requestId !== attempt.requestId, 'identical body, new request');
      attempt = retried;
    }
    await writerSend(`mock result callback ${name}`, intakeInterface.encodeFunctionData('complete', [attempt.requestId, raw]));
    check(BigInt(await read(sdk.readState(branch, 'phase'))) === 3n, 'result recorded, binding pending');
    // 4. Bind the original raw result (no purchase) and read back the checkpoint.
    const bound = await send(`bind ${name}`, sdk.bindResult(branch, raw, sdk.keccak256Bytes(raw), witness), creator);
    const log = bound.logs.find(item => { try { return sdk.interfaces.branch.parseLog(item)?.name === 'CheckpointWritten'; } catch { return false; } });
    const checkpoint = sdk.decodeCheckpoint(log);
    check(await read(sdk.readState(branch, 'assetsHash')) === sdk.witnessHash(checkpoint.witness), 'assetsHash');
    for (const asset of witness.filter(a => a.key !== target)) check(JSON.stringify(checkpoint.witness.find(a => a.key === asset.key), (_, v) => typeof v === 'bigint' ? v.toString() : v) === JSON.stringify(asset, (_, v) => typeof v === 'bigint' ? v.toString() : v), 'untouched provenance');
    return checkpoint;
  };
  const first = await round({ name: 'markdown create', profile: 0, target: key(1), inputs: [], witness: [], raw: fixtures.documentResult, file: fixtures.document, funder: funderA });
  const second = await round({ name: 'markdown update', profile: 1, target: key(1), inputs: [key(1)], witness: first.witness, raw: fixtures.updatedResult, file: fixtures.updated, funder: funderB, refuseFirst: true });
  check(second.witness[0].producer === branch && second.revision === 2n, 'revision 2');
  // 5. Read files/history: verify the actual Markdown bytes named by the checkpoint.
  const asset = second.witness[0];
  const fileCheck = sdk.verifyFile({ hash: asset.fileHash, bytes: asset.size, mediaType: asset.mediaType }, fixtures.updated);
  const checkpoint1 = await read(sdk.readState(branch, 'checkpoint', [1]));
  trace.history = { revision1Digest: checkpoint1.digest ?? checkpoint1[0], revision2: second.digest, fileSha256: fileCheck.sha256 };
  // 6. Fork the non-head historical checkpoint (revision 1); no purchase, separate project.
  const forked = await send('fork revision 1', sdk.forkHistory(factory, branch, 1, first.witness, 'Fork from revision 1'), funderB);
  const forkLog = forked.logs.map(log => { try { return sdk.interfaces.factory.parseLog(log); } catch { return null; } }).find(log => log?.name === 'BranchCreated');
  check(forkLog, 'fork BranchCreated');
  const child = forkLog.args.branch;
  check(await read(sdk.readState(child, 'assetsHash')) === sdk.witnessHash(first.witness), 'fork copies exactly revision 1 assets');
  check(BigInt(await read(sdk.readState(child, 'phase'))) === 0n && BigInt(await read(sdk.readState(child, 'proposalCount'))) === 0n, 'fork copies no proposals or purchase');
  trace.branch = branch;
  trace.child = child;
  trace.result = 'PASS';
  return trace;
}
