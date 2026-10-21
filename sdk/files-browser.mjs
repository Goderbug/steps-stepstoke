// Browser file adapter. Uses only fetch, ReadableStream, Blob, URL and TextDecoder: no node:*
// module, Buffer, DNS or raw sockets. Every artifact is checked against the descriptor's SHA-256,
// exact length and format before a caller may show a verified badge or render it.
//
// DNS disclosure: a browser exposes neither DNS answers nor the connected IP address, so this
// adapter cannot repeat the Node adapter's public-address/pinned-IP check. It instead admits only
// operator-configured HTTPS origins and path prefixes, sends no credentials or referrer, refuses
// every redirect, and re-checks the final response URL. Browser fetch cannot expose intermediate
// redirect destinations, so a final-URL allowlist alone cannot constrain their network access. DNS rebinding
// of a configured hostname is outside what browser code can detect; trust in the configured
// artifact hosts is therefore an explicit configuration decision, not a property proved here.
import { sha256 } from '../vendor/ethers/ethers.mjs';
import { createFileVerifier, decodeUTF8, fileCap, LIMITS } from './core.mjs';

export const browserSha256 = bytes => sha256(bytes);
const defaultVerifyFile = createFileVerifier(browserSha256);

export class ArtifactFetchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ArtifactFetchError';
    this.code = code;
    this.details = Object.freeze(details);
  }
}
const fail = (code, message, details) => { throw new ArtifactFetchError(code, message, details); };
const ipLiteral = host => /^\[.*\]$/u.test(host) || /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(host) || /^(?:0x[0-9a-f]+|\d+)$/iu.test(host);
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function location(entry, allowLoopback) {
  if (!entry || typeof entry.origin !== 'string') fail('INVALID_POLICY', 'Each artifact location needs an origin');
  let url;
  try { url = new URL(entry.origin); } catch { fail('INVALID_POLICY', 'Artifact location origin is not a URL'); }
  if (url.origin !== entry.origin.replace(/\/$/u, '') || url.username || url.password) fail('INVALID_POLICY', 'Artifact location must be a bare origin');
  if (allowLoopback) {
    if (url.protocol !== 'http:' || !LOOPBACK.has(url.hostname)) fail('INVALID_POLICY', 'Fixture locations must be loopback HTTP');
  } else if (url.protocol !== 'https:' || ipLiteral(url.hostname) || LOOPBACK.has(url.hostname)) {
    fail('INVALID_POLICY', 'Trusted artifact locations must be HTTPS hostnames');
  }
  const pathPrefix = entry.pathPrefix ?? '/';
  if (typeof pathPrefix !== 'string' || !pathPrefix.startsWith('/') || pathPrefix.includes('..')) fail('INVALID_POLICY', 'Invalid artifact path prefix');
  return Object.freeze({ origin: url.origin, pathPrefix });
}

// Production policy: configured trusted HTTPS artifact locations only.
export function createArtifactPolicy({ locations, allowRedirects = false } = {}) {
  if (!Array.isArray(locations) || locations.length === 0 || locations.length > 16) fail('INVALID_POLICY', 'Configure one to sixteen trusted artifact locations');
  if (typeof allowRedirects !== 'boolean') fail('INVALID_POLICY', 'allowRedirects must be boolean');
  if (allowRedirects) fail('INVALID_POLICY', 'Browser redirect hops cannot be inspected; configure the final trusted artifact URL');
  return Object.freeze({ kind: 'TRUSTED_HTTPS', locations: Object.freeze(locations.map(entry => location(entry, false))), allowRedirects, dns: 'NOT_OBSERVABLE_IN_BROWSER' });
}

// TEST ONLY. Serves deterministic fixture bytes from a loopback HTTP server during local
// acceptance runs. It is refused unless the page itself runs on a loopback origin, and every
// result it yields is labelled TEST_ONLY_LOOPBACK_FIXTURE so it can never pass as a public artifact.
export function createLoopbackFixturePolicy({ locations, pageOrigin = globalThis.location?.origin } = {}) {
  let page;
  try { page = new URL(pageOrigin); } catch { fail('INVALID_POLICY', 'Loopback fixtures need a known page origin'); }
  if (!LOOPBACK.has(page.hostname)) fail('INVALID_POLICY', 'Loopback fixture policy is test-only and refused on a non-loopback page');
  if (!Array.isArray(locations) || locations.length === 0 || locations.length > 4) fail('INVALID_POLICY', 'Configure one to four loopback fixture locations');
  return Object.freeze({ kind: 'TEST_ONLY_LOOPBACK_FIXTURE', locations: Object.freeze(locations.map(entry => location(entry, true))), allowRedirects: false, dns: 'LOOPBACK_ONLY' });
}

export function isAllowedArtifactURL(policy, value) {
  if (!policy || !Array.isArray(policy.locations)) fail('INVALID_POLICY', 'An artifact policy is required');
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.username || url.password || url.hash) return false;
  return policy.locations.some(entry => url.origin === entry.origin && url.pathname.startsWith(entry.pathPrefix));
}

async function readBounded(body, maximum, abort) {
  if (!body || typeof body.getReader !== 'function') fail('NO_STREAM', 'Response body is not a readable stream');
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximum) {
      try { await reader.cancel(); } catch {}
      abort();
      fail('TOO_LARGE', 'Artifact response exceeds the checked limit', { maximum });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

// Downloads one artifact from a configured location with a bounded streaming read and verifies
// the actual bytes. No proxy, indexer or backend is involved. Never renders or executes bytes.
export async function fetchTrustedArtifact(url, descriptor, { policy, fetch: fetchImpl = globalThis.fetch, timeoutMs = 15_000, verifyFile = defaultVerifyFile } = {}) {
  if (!descriptor || typeof descriptor !== 'object') fail('INVALID_DESCRIPTOR', 'A file descriptor is required');
  const maximum = fileCap(descriptor.mediaType);
  if (!maximum) fail('INVALID_DESCRIPTOR', 'Descriptor MIME is not enabled');
  if (!isAllowedArtifactURL(policy, url)) fail('UNTRUSTED_LOCATION', 'Artifact URL is not a configured trusted location');
  if (typeof fetchImpl !== 'function') fail('NO_FETCH', 'fetch is unavailable');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
        redirect: 'error', signal: controller.signal
      });
    } catch (error) {
      fail(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR', 'Artifact request failed or was redirected without permission', { cause: error?.name });
    }
    if (response.type === 'opaque' || response.type === 'opaqueredirect') fail('OPAQUE_RESPONSE', 'Artifact response is not readable');
    const finalURL = response.url || url;
    if (response.redirected) fail('BAD_REDIRECT', 'Browser artifact redirects are refused; configure the final trusted URL');
    if (!isAllowedArtifactURL(policy, finalURL)) fail('BAD_REDIRECT', 'Artifact redirected outside the configured locations', { finalURL });
    if (response.status < 200 || response.status >= 300) fail('HTTP_STATUS', 'Artifact server returned a non-success status', { status: response.status });
    const length = response.headers.get('content-length');
    if (length !== null && (!/^\d+$/u.test(length) || Number(length) > maximum)) {
      controller.abort();
      fail('TOO_LARGE', 'Artifact Content-Length exceeds the checked limit', { maximum });
    }
    const bytes = await readBounded(response.body, maximum, () => controller.abort());
    let verification;
    try { verification = verifyFile(descriptor, bytes); } catch (error) { fail('VERIFY_FAILED', error.message); }
    return Object.freeze({
      status: 'VERIFIED', source: policy.kind, url: finalURL, redirected: Boolean(response.redirected),
      contentType: response.headers.get('content-type'), dns: policy.dns, bytes, verification
    });
  } finally {
    clearTimeout(timer);
  }
}

// A user-selected File/Blob (e.g. <input type=file>), read with the same bound.
export async function readBlobBounded(blob, maximum = LIMITS.html) {
  if (!Number.isSafeInteger(maximum) || maximum <= 0 || maximum > LIMITS.html) throw new Error('Invalid read limit');
  if (!blob || typeof blob.size !== 'number' || blob.size > maximum) throw new Error('Expected a bounded file');
  if (typeof blob.stream === 'function') return readBounded(blob.stream(), maximum, () => {});
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length > maximum) throw new Error('File exceeds limit');
  return bytes;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63]
      + (i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? ALPHABET[n & 63] : '=');
  }
  return out;
}

// Browser counterpart of files.mjs verifyHTMLDist: the dist export is a single index.html, so
// the caller supplies its bytes. Checks bytes and exact embedded image data URIs, executes nothing.
export function verifyHTMLExport(descriptor, raw, selectedImages = [], verifyFile = defaultVerifyFile) {
  if (!descriptor || !['dist/index.html', 'artifacts/index.html'].includes(descriptor.path) || descriptor.mediaType !== 'text/html') throw new Error('Wrong HTML output mapping');
  const result = verifyFile(descriptor, raw);
  const html = decodeUTF8(raw);
  if (!Array.isArray(selectedImages) || selectedImages.length > LIMITS.inputs) throw new Error('Input count limit');
  let total = 0;
  for (const input of selectedImages) {
    if (input.descriptor.mediaType !== 'image/png') throw new Error('Only PNG input slots are enabled');
    verifyFile(input.descriptor, input.bytes);
    total += input.bytes.length;
    if (total > LIMITS.imagesTotal) throw new Error('Selected image aggregate limit');
    if (!html.includes(`data:image/png;base64,${base64(input.bytes)}`)) throw new Error('Selected image bytes not embedded exactly');
  }
  return { ...result, distShapeVerified: true, selectedImagesVerified: selectedImages.length, behavior: 'NOT_EXECUTED_OR_PROVEN' };
}
