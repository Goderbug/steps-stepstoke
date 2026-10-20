// Generates a reviewable preflight packet from an actual bodyOf eth_call return.
// Deliberately does not contact a server, spend IMD, sign, or treat HTTP as settlement.
import { decodePreview, strictJSON } from '../sdk/index.mjs';
import { readArtifactFile } from '../sdk/files.mjs';
const filename = process.argv[2];
if (!filename) {
  console.error('Usage: npm run validate:live -- <JSON file containing bodyOf eth_call hex result>');
  process.exitCode = 1;
} else {
  const result = JSON.parse((await readArtifactFile(filename, 65_536)).toString('utf8'));
  const preview = decodePreview(typeof result === 'string' ? result : result.result);
  strictJSON(preview.raw, 16_384, 8000);
  const action = new TextDecoder().decode(Buffer.from(preview.action.slice(2), 'hex')).replace(/\0+$/u, '');
  if (!['job.open@job-1', 'job.continue@job-1'].includes(action)) throw new Error('Unexpected action');
  console.log(JSON.stringify({
    compatibility: 'NOT_RUN',
    bodyHash: preview.bodyHash,
    bodyBytes: preview.byteLength,
    rawBodyHex: Buffer.from(preview.raw).toString('hex'),
    preflight: { action: action.split('@')[0], input: JSON.parse(new TextDecoder().decode(preview.raw)) },
    next: 'An operator may submit preflight to the official free /requests/check endpoint. Keep its exact response as evidence. This is not purchase authorization or settlement.'
  }, null, 2));
}
