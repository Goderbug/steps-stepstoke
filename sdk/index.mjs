// Node entrypoint. Canonical encoding and strict validation live in core.mjs and are shared
// verbatim with the browser entrypoint (browser.mjs); only the SHA-256 implementation is Node's.
// No dependency installation, keys, wallet, signer, HTTP client, indexer or browser is required.
import { createHash } from 'node:crypto';
import { createFileVerifier } from './core.mjs';

export * from './core.mjs';
export const RUNTIME = 'node';
export const nodeSha256 = bytes => `0x${createHash('sha256').update(bytes).digest('hex')}`;
export const verifyFile = createFileVerifier(nodeSha256);

export * from './public.mjs';
