#!/usr/bin/env node
import * as relay from '../sdk/index.mjs';
import { readArtifactFile, verifyHTMLDist } from '../sdk/files.mjs';

const usage = `CTO Relay Station A1 — unsigned, offline transaction preparation
create    --factory ADDRESS --goal TEXT
propose   --branch ADDRESS --proposal FILE --witness FILE
sponsor   --branch ADDRESS --id INTEGER --max-fee RAW_IMD_UNITS --witness FILE
retry     --branch ADDRESS --max-fee RAW_IMD_UNITS --witness FILE
bind      --branch ADDRESS --manifest FILE --hash CALLBACK_KECCAK --witness FILE
fork      --factory ADDRESS --parent ADDRESS --revision INTEGER --witness FILE --direction TEXT
preview   --branch ADDRESS --id INTEGER --witness FILE
read      --branch ADDRESS [--method phase] [--args JSON_ARRAY]
witness   --witness FILE
file-check --descriptor FILE --file FILE
html-check --descriptor FILE --directory DIST_DIRECTORY
decode-checkpoint --log FILE

Outputs calldata or eth_call requests. Never signs, sends, downloads, opens a browser, or retries automatically.
All file arguments are explicit operator inputs, never paths taken from a manifest.`;
const [command = 'help', ...argv] = process.argv.slice(2);
const options = Object.create(null);
try {
  if (command === 'help' || command === '--help') {
    console.log(usage);
  } else {
    for (let i = 0; i < argv.length; i += 2) {
      if (!/^--[a-z-]+$/u.test(argv[i]) || argv[i + 1] === undefined || Object.hasOwn(options, argv[i].slice(2))) throw new Error('Invalid or duplicate option');
      options[argv[i].slice(2)] = argv[i + 1];
    }
    const required = name => { if (!options[name]) throw new Error(`Missing --${name}`); return options[name]; };
    const jsonFile = async name => JSON.parse((await readArtifactFile(required(name), 65_536)).toString('utf8'));
    const witness = () => jsonFile('witness');
    let result;
    switch (command) {
      case 'create': result = relay.createProject(required('factory'), required('goal')); break;
      case 'propose': result = relay.proposeWork(required('branch'), await jsonFile('proposal'), await witness()); break;
      case 'sponsor': result = relay.sponsorProposal(required('branch'), required('id'), required('max-fee'), await witness()); break;
      case 'retry': result = relay.retryRefused(required('branch'), required('max-fee'), await witness()); break;
      case 'bind': result = relay.bindResult(required('branch'), await readArtifactFile(required('manifest'), relay.LIMITS.manifest), required('hash'), await witness()); break;
      case 'fork': result = relay.forkHistory(required('factory'), required('parent'), required('revision'), await witness(), required('direction')); break;
      case 'preview': result = relay.previewProposal(required('branch'), required('id'), await witness()); break;
      case 'read': result = relay.readState(required('branch'), options.method ?? 'phase', JSON.parse(options.args ?? '[]')); break;
      case 'witness': result = { witness: relay.canonicalWitness(await witness()), hash: relay.witnessHash(await witness()) }; break;
      case 'file-check': result = relay.verifyFile(await jsonFile('descriptor'), await readArtifactFile(required('file'))); break;
      case 'html-check': result = await verifyHTMLDist(required('directory'), await jsonFile('descriptor')); break;
      case 'decode-checkpoint': result = relay.decodeCheckpoint(await jsonFile('log')); break;
      default: throw new Error('Unknown command; use help');
    }
    console.log(JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
