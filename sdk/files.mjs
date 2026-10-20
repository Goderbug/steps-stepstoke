import { open, lstat, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { LIMITS, verifyFile } from './index.mjs';

export class ArtifactFetchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ArtifactFetchError';
    this.code = code;
    this.details = Object.freeze(details);
  }
}

const badURL = (code, message, details) => { throw new ArtifactFetchError(code, message, details); };
const ipv4Private = value => {
  const octets = value.split('.').map(Number);
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168 || (b === 0 && c === 2)))
    || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0 && c === 113);
};
const ipv6Private = value => {
  const lower = value.toLowerCase().replace(/^\[|\]$/gu, '');
  if (lower === '::' || lower === '::1' || lower.includes('%')) return true;
  if (lower.startsWith('::ffff:')) return ipv4Private(lower.slice(7));
  const first = Number.parseInt(lower.split(':')[0] || '0', 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
};
const isPublicIP = value => isIP(value) === 4 ? !ipv4Private(value) : isIP(value) === 6 ? !ipv6Private(value) : false;
const safeURL = value => {
  let url;
  try { url = new URL(value); } catch { badURL('INVALID_URL', 'Expected an absolute HTTPS artifact URL'); }
  const hostname = url.hostname.replace(/^\[|\]$/gu, '');
  if (url.protocol !== 'https:' || url.username || url.password || !hostname || isIP(hostname)) {
    badURL('UNSAFE_URL', 'Only credential-free HTTPS hostnames are allowed');
  }
  return url;
};
const resolvePublic = async hostname => {
  let answers;
  try { answers = await lookup(hostname, { all: true, verbatim: true }); } catch (error) {
    throw new ArtifactFetchError('DNS_FAILED', 'Artifact hostname could not be resolved', { hostname, cause: error.code });
  }
  if (!answers.length || answers.some(answer => !isPublicIP(answer.address))) {
    badURL('PRIVATE_NETWORK', 'Artifact hostname resolved to a non-public address', { hostname });
  }
  // Pin the connection to a checked answer rather than letting a second DNS lookup choose a
  // different address. TLS still verifies the original hostname through `servername`.
  return answers[0];
};
const receive = (url, resolved, maximum) => new Promise((resolve, reject) => {
  const req = httpsRequest({
    protocol: 'https:', hostname: resolved.address, family: resolved.family, port: url.port || 443,
    path: `${url.pathname}${url.search}`, method: 'GET', servername: url.hostname, agent: false,
    headers: { host: url.host, accept: 'application/octet-stream', 'accept-encoding': 'identity', connection: 'close' },
    lookup: (_host, _options, callback) => callback(null, resolved.address, resolved.family)
  }, response => {
    const length = response.headers['content-length'];
    if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {
      response.resume();
      reject(new ArtifactFetchError('ENCODED_RESPONSE', 'Artifact response must not use content encoding'));
      return;
    }
    if (length !== undefined && (!/^\d+$/u.test(String(length)) || Number(length) > maximum)) {
      response.resume();
      reject(new ArtifactFetchError('TOO_LARGE', 'Artifact Content-Length exceeds the checked limit', { maximum }));
      return;
    }
    const chunks = [];
    let total = 0;
    response.on('data', chunk => {
      total += chunk.length;
      if (total > maximum) {
        req.destroy(new ArtifactFetchError('TOO_LARGE', 'Artifact response exceeds the checked limit', { maximum }));
      } else chunks.push(chunk);
    });
    response.on('end', () => resolve({ statusCode: response.statusCode ?? 0, headers: response.headers, bytes: Buffer.concat(chunks, total) }));
  });
  req.setTimeout(15_000, () => req.destroy(new ArtifactFetchError('TIMEOUT', 'Artifact request timed out')));
  req.on('error', error => reject(error instanceof ArtifactFetchError ? error : new ArtifactFetchError('NETWORK_ERROR', 'Artifact request failed', { cause: error.code })));
  req.end();
});

// Downloads only an explicit public HTTPS URL, follows at most three checked HTTPS redirects,
// retains no credentials, and never writes or executes the returned bytes.  The descriptor is
// mandatory: success means the actual response bytes passed SHA-256, length and MIME checks.
export async function fetchPublicArtifact(urlValue, descriptor) {
  if (!descriptor || typeof descriptor !== 'object') throw new ArtifactFetchError('INVALID_DESCRIPTOR', 'A file descriptor is required');
  const maximum = descriptor.mediaType === 'text/markdown' ? LIMITS.document
    : descriptor.mediaType === 'text/html' ? LIMITS.html
      : descriptor.mediaType === 'image/png' ? LIMITS.image : 0;
  if (!maximum) throw new ArtifactFetchError('INVALID_DESCRIPTOR', 'Descriptor MIME is not enabled');
  let url = safeURL(urlValue);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const resolved = await resolvePublic(url.hostname);
    const response = await receive(url, resolved, maximum);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      if (!response.headers.location) throw new ArtifactFetchError('BAD_REDIRECT', 'Redirect response had no Location header');
      if (redirects === 3) throw new ArtifactFetchError('TOO_MANY_REDIRECTS', 'Artifact exceeded the redirect limit');
      try { url = safeURL(new URL(response.headers.location, url).toString()); } catch (error) {
        if (error instanceof ArtifactFetchError) throw error;
        throw new ArtifactFetchError('BAD_REDIRECT', 'Redirect Location was invalid');
      }
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new ArtifactFetchError('HTTP_STATUS', 'Artifact server returned a non-success status', { status: response.statusCode });
    }
    const verified = verifyFile(descriptor, response.bytes);
    return Object.freeze({ status: 'VERIFIED', source: 'PUBLIC_HTTPS', url: url.toString(), redirects, bytes: response.bytes, verification: verified });
  }
  throw new ArtifactFetchError('TOO_MANY_REDIRECTS', 'Artifact exceeded the redirect limit');
}

// Explicit operator-selected paths only. This module never resolves paths from a result manifest.
export async function readArtifactFile(filename, maximum = LIMITS.html) {
  if (!Number.isSafeInteger(maximum) || maximum <= 0 || maximum > LIMITS.html) throw new Error('Invalid read limit');
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximum) throw new Error('Expected a bounded regular file');
    const buffer = Buffer.alloc(maximum + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maximum) throw new Error('File exceeds limit');
    return buffer.subarray(0, total);
  } finally {
    await handle.close();
  }
}

// Checks actual dist shape and bytes. It does not execute or certify arbitrary HTML/JS behavior.
export async function verifyHTMLDist(directory, descriptor, selectedImages = []) {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Expected a real dist directory');
  const entries = await readdir(directory, { withFileTypes: true });
  if (entries.length !== 1 || entries[0].name !== 'index.html' || !entries[0].isFile()) throw new Error('dist must contain only a regular index.html');
  if (descriptor.path !== 'dist/index.html' || descriptor.mediaType !== 'text/html') throw new Error('Wrong HTML output mapping');
  const raw = await readArtifactFile(join(directory, 'index.html'), LIMITS.html);
  const result = verifyFile(descriptor, raw);
  const html = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  if (!Array.isArray(selectedImages) || selectedImages.length > LIMITS.inputs) throw new Error('Input count limit');
  let total = 0;
  for (const input of selectedImages) {
    if (input.descriptor.mediaType !== 'image/png') throw new Error('Only PNG input slots are enabled');
    verifyFile(input.descriptor, input.bytes);
    total += input.bytes.length;
    if (total > LIMITS.imagesTotal) throw new Error('Selected image aggregate limit');
    const uri = `data:image/png;base64,${Buffer.from(input.bytes).toString('base64')}`;
    if (!html.includes(uri)) throw new Error('Selected image bytes not embedded exactly');
  }
  return { ...result, distShapeVerified: true, selectedImagesVerified: selectedImages.length, behavior: 'NOT_EXECUTED_OR_PROVEN' };
}
