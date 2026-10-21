# Unsigned CLI and Node SDK

This describes the local policy A1/2 repair candidate atop original IMD commit `9b0294e7ab19060bd00c489fbe032cf248528e0d`. See [current repair evidence](validation/review-fixes/README.md). The walkthrough below deliberately reads historical local fixtures; its sample addresses are not deployed services.

Use Node ≥22 from the repository root. `node cli/relay.mjs help` lists every CLI command. No npm installation, RPC, wallet, signer, server or indexer is required for preparation. Only the optional `fetch-check` command performs an artifact download. There is no send, deploy, approve, browser-preview or automatic retry command.

Preparation does not establish that a transaction is currently admissible. A Branch's phase/anchor, runtime price, allowance or another sponsor's transaction can change before submission. All examples below are **offline preparations against recorded local test state**, not authorizations to send live transactions.

## Reproducible local example inputs

This setup reads the committed integration report and actual fixture bytes. Its addresses, job IDs, hashes and checkpoint digests come from that temporary Anvil run, which has stopped. It creates only disposable files under `test/scratch/relay-docs/`. Reconstructed event/read envelopes are explicitly demonstration data, not independently fetched chain logs. Do not use them to authenticate a public deployment.

Run this block once before the command examples:

```sh
mkdir -p test/scratch/relay-docs
node --input-type=module <<'NODE'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { AbiCoder } from './vendor/ethers/ethers.mjs';
import * as relay from './sdk/index.mjs';
const report = JSON.parse(await readFile('docs/validation/local-integration.json', 'utf8'));
if (report.compatibility !== 'LOCAL_MOCK_ONLY') throw new Error('Expected local evidence');
const [html, image, updated, markdown] = report.rounds;
const directory = 'test/scratch/relay-docs';
const json = (name, value) => writeFile(`${directory}/${name}`, JSON.stringify(value, null, 2) + '\n');
const imageKey = image.witness.find(a => a.kind === 2).key;
const htmlKey = html.witness.find(a => a.kind === 1).key;
await json('witness-r1.json', html.witness);
await json('witness-r2.json', image.witness);
await json('witness-r4.json', markdown.witness);
await json('proposal-image.json', {
  anchor: html.checkpointDigest, profile: relay.PROFILES.ImageCreate,
  target: imageKey, inputs: [], outputName: image.fileCheck.name,
  outputPath: image.fileCheck.path, text: 'Generate one PNG.', publish: false
});
await json('proposal-html-update.json', {
  anchor: image.checkpointDigest, profile: relay.PROFILES.HTMLUpdate,
  target: htmlKey, inputs: image.witness.map(a => a.key).sort(),
  outputName: updated.fileCheck.name, outputPath: updated.fileCheck.path,
  text: 'Restore selected HTML, retain original-marker and inline the selected PNG exactly.',
  publish: false
});
await writeFile(`${directory}/manifest-image.raw.json`, Buffer.from(image.rawManifestHex.slice(2), 'hex'));
await json('descriptor-image.json', image.fileCheck);
await json('descriptor-html.json', updated.fileCheck);
await mkdir(`${directory}/dist`, { recursive: true });
await copyFile('test/fixtures/html-3.html', `${directory}/dist/index.html`);
const encoded = AbiCoder.defaultAbiCoder().encode([relay.ASSET_TYPE], [relay.canonicalWitness(html.witness)]);
const log = {
  ...relay.interfaces.branch.encodeEventLog('CheckpointWritten', [html.revision, html.checkpointDigest, encoded]),
  address: report.parent, removed: false
};
await json('checkpoint-log.json', log);
await json('checkpoint-logs.json', [log]);
await json('checkpoint-reads.json', {
  [html.revision]: { digest: html.checkpointDigest, assetsHash: html.assetsHash }
});
// An ABI response envelope reconstructed from the recorded exact request bytes.
await json('preview-result.json', relay.interfaces.branch.encodeFunctionResult('bodyOf', [image.action, image.rawBodyHex]));
console.log('Prepared local-only CLI inputs in ' + directory);
NODE

relay_factory=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("docs/validation/local-integration.json")).factory)')
relay_branch=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("docs/validation/local-integration.json")).parent)')
relay_result_hash=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("docs/validation/local-integration.json")).rounds[1].resultHash)')
```

These shell variables hold only public local-test data. They are not deployment settings. The runner's root image is proposal 2; its Markdown update is proposal 5. The commands below illustrate those **different points in history**, not a sequence to submit together against one present state.

## Prepare creation, proposal and previews

```sh
node cli/relay.mjs create --factory "$relay_factory" --goal 'Maintain a public relay project.'
node cli/relay.mjs propose --branch "$relay_branch" --proposal test/scratch/relay-docs/proposal-image.json --witness test/scratch/relay-docs/witness-r1.json
node cli/relay.mjs preview --branch "$relay_branch" --id 2 --witness test/scratch/relay-docs/witness-r1.json
node cli/relay.mjs read --branch "$relay_branch" --method anchor
node cli/relay.mjs read --branch "$relay_branch" --method checkpoint --args '["1"]'
node cli/relay.mjs witness --witness test/scratch/relay-docs/witness-r1.json
```

`create` prepares `Factory.createProject`, with no payment. `propose` prepares `Branch.propose` after checking the fixed local rules; it does not submit or allocate an ID. The actual ID must come from the mined `Proposed` event/read, not a prediction from a proposal count. `preview` and `read` prepare `eth_call` objects; printing the call is not executing it. `witness` prints the canonical table and ABI hash, not an authentication verdict about its source.

For current use, obtain `anchor()`, `checkpoint(revision)` and full witness at one consistent block. Check `Factory.registered(branch)` and immutable dependencies via the ABI, then compare the witness hash to the checkpoint. All nonempty asset fields, including original provenance, must be retained. `inputs` contains selected sorted keys, not file paths; an update must select its target. Profile IDs and fixed rules are in [the contract reference](CONTRACTS.md).

## Prepare sponsor and explicit retry

The following cap is **the local mock's 0.5 IMD price**, in raw units. It is not a quoted live price. The sponsor chooses their own cap after reading `Intake.priceOf(action,IMD)` for the exact action from `bodyOf`.

```sh
node cli/relay.mjs sponsor --branch "$relay_branch" --id 2 --max-fee 500000000000000000 --witness test/scratch/relay-docs/witness-r1.json
node cli/relay.mjs retry --branch "$relay_branch" --max-fee 500000000000000000 --witness test/scratch/relay-docs/witness-r4.json
```

The image sponsor uses revision-one state. The retry example instead uses the witness immediately before the recorded proposal-five refusal. Only phase Refused permits retry; the contract selects the active proposal itself and requires identical body/snapshot. A retry is another paid purchase with a new attempt; it is never an automatic consequence of a timeout, rejected bind or missing callback.

There is no CLI approve command. To prepare an unsigned **separate** IMD allowance call in an application, use an ERC-20 ABI, the verified token address, the Branch as spender and an explicit raw-unit amount. For example, with actual reviewed `branch` and `maxFee` variables already in scope:

```js
import { Interface } from './vendor/ethers/ethers.mjs';
const erc20 = new Interface(['function approve(address spender,uint256 amount) returns (bool)']);
const approval = { to: release.imd, data: erc20.encodeFunctionData('approve', [branch, maxFee]), value: '0x0' };
```

Here `release` is parsed from `config/release.json`. This fragment needs those application-supplied variables; it does not load a key or send a transaction. A cap may leave unused **sponsor → Branch** allowance when the actual fee is smaller. The contract separately clears **Branch → Intake** allowance after each purchase. Never approve a different token/spender merely because an untrusted result names one.

## Bind recorded raw bytes, continue and fork

```sh
node cli/relay.mjs bind --branch "$relay_branch" --manifest test/scratch/relay-docs/manifest-image.raw.json --hash "$relay_result_hash" --witness test/scratch/relay-docs/witness-r1.json
node cli/relay.mjs propose --branch "$relay_branch" --proposal test/scratch/relay-docs/proposal-html-update.json --witness test/scratch/relay-docs/witness-r2.json
node cli/relay.mjs fork --factory "$relay_factory" --parent "$relay_branch" --revision 1 --witness test/scratch/relay-docs/witness-r1.json --direction 'Illustrate and extend the original HTML.'
```

Bind uses the exact recorded image manifest and the **old** table. The hash must come from the authenticated `ResultRecorded` event/attempt on the real Branch; hashing an arbitrary local document and supplying that hash does not authenticate it. Do not format, normalize newlines, reserialize, decode/re-encode or otherwise change the raw bytes. `bindResult` checks digest and syntax; the contract additionally enforces the proposal mapping, phase, job/project and old witness.

Continue is another proposal plus explicit sponsor, not a separate ABI method. The example updates the old HTML using both current HTML and PNG keys after the image round. The encoder uses the Branch's newest own job (the image job) as `parentJobId`; no `repoUrl`, `baseCommit` or parent's project ID is supplied. The selected older HTML supplies the update baseline.

Fork uses accepted historical revision 1 even after the parent advances. Its complete witness is not the parent's latest table. A child inherits files/provenance but starts with empty own job/project and proposals. Its first funded run uses open, then later runs continue its own bound job. A fork itself buys no work.

## Files and history

```sh
node cli/relay.mjs file-check --descriptor test/scratch/relay-docs/descriptor-image.json --file test/fixtures/image-2.png
node cli/relay.mjs html-check --descriptor test/scratch/relay-docs/descriptor-html.json --directory test/scratch/relay-docs/dist
node cli/relay.mjs decode-checkpoint --log test/scratch/relay-docs/checkpoint-log.json
node cli/relay.mjs recover-history --branch "$relay_branch" --logs test/scratch/relay-docs/checkpoint-logs.json --checkpoints test/scratch/relay-docs/checkpoint-reads.json
node cli/relay.mjs status --phase 3 --checkpoint-verified false --file-verified false
node tools/validate-live.mjs test/scratch/relay-docs/preview-result.json
```

The last command prints an offline preflight packet, still `NOT_RUN`; it does not contact `/requests/check`. The walkthrough's reconstructed log/read pair demonstrates formats only. For actual recovery, independently obtain raw `CheckpointWritten` logs (`address`, `topics`, `data`, optional `removed`) and checkpoint reads keyed by decimal revision, such as `{ "1": { "digest": "…", "assetsHash": "…" } }`. `recoverHistory` checks address, removed flag, duplicate revision, canonical witness encoding and digest/asset commitment. It does not prove logs are complete, fetch them, check confirmations/reorg finality, or independently trust the supplied read provider.

`file-check` accepts either a manifest descriptor (`hash`, `bytes`) or an asset (`fileHash`, `size`), plus `mediaType`. It compares actual SHA-256 and length, enforces type caps, decodes UTF-8 without NUL for text, requires a leading doctype/HTML signature for HTML and an eight-byte PNG signature for images. It is not a complete PNG decoder or HTML safety validator. Names/paths alone do not authenticate content.

`html-check` requires precisely one regular `index.html` in the explicitly supplied directory, verifies its descriptor and never executes it. **The CLI supplies no selected-image arguments**, so this command alone does not verify image embedding. Use `verifyHTMLDist(directory,descriptor,[{descriptor,bytes},…])` from `sdk/files.mjs` to require exact selected PNG data URIs. The local integration runner exercises that form and checks retention of the old marker. Neither form proves absence of remote references, symlinks in a remote workspace, script safety or runtime input consumption.

`fetch-check --url HTTPS_URL --descriptor FILE` is optional and not run by this walkthrough. It accepts only explicit credential-free HTTPS hostnames (no IP literals), checks all DNS answers and redirects, pins a checked public address while retaining TLS hostname verification, allows at most three redirects and bounds response bytes by MIME cap. It rejects content encoding and uses a 15-second socket/request inactivity timeout, not an overall DNS-to-completion deadline. It verifies bytes before returning success, writes nothing and executes nothing. DNS/network/address restrictions can reject otherwise reachable artifacts; use independently obtained explicit bytes instead, never disable checks for a manifest-suggested URL.

Local files are explicit operator choices; `readArtifactFile` never chooses a filesystem path from a manifest. It checks a bounded regular file with final-component `O_NOFOLLOW`; that is not a sandbox against every ancestor-directory symlink. Do not give an untrusted manifest control of your command arguments or execute a file to verify it.

## Command and error reference

Every command is public local tooling; no role or credentials are required to prepare it. On-chain permissions/failures remain in [CONTRACTS.md](CONTRACTS.md).

| Command | Required arguments / output | Principal local rejection |
| --- | --- | --- |
| `help`, `--help` (also default) | Usage text | No external action |
| `create` | `--factory --goal`; unsigned create | Invalid/zero address or text |
| `propose` | `--branch --proposal --witness`; unsigned proposal | Fixed-profile, mapping, selection, capacity and data errors |
| `sponsor` | `--branch --id --max-fee --witness`; unsigned purchase | Nonpositive ID/cap or invalid witness; does not read phase/fee |
| `retry` | `--branch --max-fee --witness`; unsigned retry | Nonpositive cap or invalid witness; no local assertion of Refused |
| `bind` | `--branch --manifest --hash --witness`; unsigned bind | Raw digest, manifest size/syntax or witness errors |
| `fork` | `--factory --parent --revision --witness --direction`; unsigned fork | Nonpositive revision, addresses/text/witness; parent registration/checkpoint checked on chain |
| `preview` | `--branch --id --witness`; read request | Nonpositive ID or bad witness |
| `read` | `--branch`, optional `--method phase --args JSON_ARRAY`; read request | Read allowlist, ABI/argument errors |
| `witness` | `--witness`; canonical table/hash | Duplicates, bounds, invalid descriptors/provenance/reservation |
| `file-check` | `--descriptor --file`; verification observation | Length/hash/MIME/signature mismatch |
| `html-check` | `--descriptor --directory`; shape/byte observation | Extra entry, nonregular file, mapping/byte mismatch |
| `fetch-check` | `--url --descriptor`; checked download observation, no artifact dump | Unsafe URL/address, DNS/network/redirect/size/encoding/byte errors |
| `status` | Optional `--receipt --phase --checkpoint-verified true\|false --file-verified true\|false`; lifecycle observations | Invalid phase (0–5), booleans or file JSON |
| `decode-checkpoint` | `--log`; decoded canonical event | Wrong event or noncanonical/invalid witness |
| `recover-history` | `--branch --logs --checkpoints`; sorted authenticated comparisons | Wrong/removed/duplicate log, missing or mismatched checkpoint |

Options are `--name value` pairs; duplicates/missing values fail. Use only documented options: unused options are not all rejected by this implementation. JSON argument files are bounded regular files: ordinary inputs up to 65,536 bytes, history JSON up to 2 MiB, raw manifests up to 32,768 bytes; actual artifact caps depend on type. Integers are safest as decimal strings. Output represents BigInts as decimal strings.

Successful commands emit JSON except help. Failures exit nonzero and emit `{"ok":false,"error":{"code":"…","message":"…"}}` on stderr. Most validation/file errors use `INVALID_INPUT`; fetch errors include `INVALID_DESCRIPTOR`, `INVALID_URL`, `UNSAFE_URL`, `DNS_FAILED`, `PRIVATE_NETWORK`, `ENCODED_RESPONSE`, `TOO_LARGE`, `TIMEOUT`, `NETWORK_ERROR`, `BAD_REDIRECT`, `TOO_MANY_REDIRECTS`, `HTTP_STATUS`. Post-fetch file verification can still throw a generic validation error. CLI output does not include `ArtifactFetchError.details` even though the SDK error carries it.

## SDK export reference

Import core exports from `./sdk/index.mjs` and file/network helpers separately from `./sdk/files.mjs`. All returned transaction objects have native value `0x0`; no SDK method signs or broadcasts.

| Exports | Purpose / limits |
| --- | --- |
| `ethersVersion`, `ASSET_TYPE`, `PHASES`, `PROFILES`, `LIMITS`, `MANIFEST_LIMITS`, `interfaces` | Pinned bundle version, ABI tuple, enum/limit tables and Factory/Branch/encoder/verifier ethers Interfaces; ABI encoding available without a provider |
| `canonicalWitness(assets)`, `witnessHash(assets)` | Validate/copy/sort a table, reject duplicate keys, hash canonical ABI; preserves provenance, does not retrieve or authenticate source |
| `validateProposal(proposal,witness)` | Fixed profile and mapping checks, including cross-slot name/equal-path/file-directory-prefix conflicts and non-HTML top-level `dist/`; defaults missing publish to false. Does not read current anchor or encode the complete runtime request size |
| `createProject`, `proposeWork`, `sponsorProposal`, `retryRefused`, `bindResult`, `forkHistory` | Corresponding unsigned transactions; see command examples. Bind preparation validates digest/syntax, not all contract semantics |
| `previewProposal(branch,id,witness)`, `readState(branch,method,args)` | Prepare read requests. Allowed reads: `goal`, `direction`, `source`, `revision`, `assetsHash`, `latestJobId`, `projectId`, `phase`, `proposalCount`, `attemptCount`, `activeProposal`, `activeAttempt`, `proposal`, `attempt`, `checkpoint`, `anchor`, `factory`, `encoder`, `verifier`. Other public getters use `interfaces.branch` directly |
| `decodeRead(method,result)`, `decodePreview(result)` | Decode ABI response; preview retains exact raw request bytes/action/hash/length |
| `queryPrepared(provider,prepared,blockTag)`, `queryState`, `queryPreview` | Optional EIP-1193 adapter using only `eth_call`; validates request/result, propagates provider errors. No accounts, signing, chain switching or sending |
| `decodeCheckpoint(log)`, `recoverHistory(branch,logs,checkpoints)` | Decode canonical witness events and compare with supplied reads; no automatic fetching/indexer/ancestry walk |
| `verifyManifest(raw,recordedHash)` | Strict raw digest, completed job/project and one enabled file descriptor; no comparison against a particular proposal or Branch history |
| `verifyFile(descriptor,bytes)` | Actual SHA-256/length/MIME signature checks as above |
| `strictJSON(raw,maxBytes=8192,maxString=1024)`, `unsignedJSONInteger(value,max)` | General strict parser with unchanged defaults; number tokens preserve original grammar via a private Symbol. Use `unsignedJSONInteger` rather than treating wrappers as ordinary numbers |
| `strictManifestJSON(raw)` | Binding-specific strict parser: 32,768 raw bytes, validates all metadata and returns the acceptance-field projection. Retained strings, decoded keys, per-object/depth/total-value/aggregate-key/combined-work limits are listed in [LIMITS.md](LIMITS.md). Used by `bindResult` and `verifyManifest`; does not authenticate the hash source or replace contract semantic checks |
| `reconcileTransaction({receipt,phase})` | Unknown receipt → look up original hash; reverted → review; mined → separate observations; always `purchase:false` |
| `lifecycleStatus({receipt,phase,checkpointVerified,fileVerified,git,publication})` | Observation formatting only; caller-provided flags are not independently verified; always `automaticPurchase:"NEVER"` |
| `readArtifactFile(filename,maximum)` | Explicit bounded regular-file read; default/max 2 MiB |
| `verifyHTMLDist(directory,descriptor,selectedImages=[])` | Local dist shape, file verification and optional exact selected PNG embedding; never execute HTML |
| `isPublicArtifactAddress(address)` | Conservative address classifier, not DNS resolution or a reachability guarantee |
| `fetchPublicArtifact(url,descriptor)`, `ArtifactFetchError` | Checked optional download; frozen observation with verified bytes, or thrown error with stable code/details; no write/execute |

A minimal optional read adapter, with an application-supplied read-only provider and real Branch, is:

```js
import { readState, queryState } from './sdk/index.mjs';
const [phase] = await queryState(provider, readState(branch, 'phase'), 'latest');
```

To prepare unlisted reads such as Factory registration or Branch request mappings, use `interfaces.factory.encodeFunctionData` / `interfaces.branch.encodeFunctionData` and your chosen read provider. Native ABI use remains available independently of the CLI allowlist.

## Reconcile before another purchase

A printed transaction has not been submitted. A returned hash has not necessarily mined. A mined purchase has not proven admission, execution, callback, binding, file validity, Git delivery or publication. Reconcile the **original** transaction hash/receipt and Branch attempt/request/phase first. `status` only formats explicit observations; it never queries or makes a funding decision. A missing callback stays pending indefinitely; status 1 alone permits an explicit same-body funded retry; status 2/unknown freezes purchases. [Operations](OPERATIONS.md) and [future validation](LIVE-VALIDATION.md) keep those stages separate.
