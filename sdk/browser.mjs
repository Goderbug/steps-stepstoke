// Browser entrypoint. Same canonical encoding, witness hashing, strict JSON and proposal
// validation as the Node entrypoint (both re-export core.mjs); only the file adapter differs.
// Imports no node:* module and never uses fs, DNS, HTTPS sockets or an implicit Buffer.
// No mandatory proxy, indexer, signer or backend: reads go through any EIP-1193 provider and
// unsigned transactions are handed to the wallet the user selected (see toWalletRequest).
import { createFileVerifier } from './core.mjs';
import { browserSha256 } from './files-browser.mjs';

export * from './core.mjs';
export {
  ArtifactFetchError, browserSha256, createArtifactPolicy, createLoopbackFixturePolicy, isAllowedArtifactURL,
  fetchTrustedArtifact, readBlobBounded, verifyHTMLExport, base64
} from './files-browser.mjs';
export const RUNTIME = 'browser';
export const verifyFile = createFileVerifier(browserSha256);

// Optional WebCrypto cross-check (secure contexts only). Never required for verification.
export async function webCryptoSha256(bytes) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto is unavailable in this context');
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return `0x${Array.from(digest, b => b.toString(16).padStart(2, '0')).join('')}`;
}

export * from './public.mjs';

export * from './handoff.mjs';
export * from './observation.mjs';
export * from './gates.mjs';
export * from './public-rpc.mjs';
