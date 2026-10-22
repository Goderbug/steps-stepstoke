// General strict parser plus the metadata-tolerant binding projection.
// Both validate the whole raw document; only the binding projection discards metadata.
// Environment-neutral: shared verbatim by the Node and browser entrypoints (no Buffer).
const numericToken = Symbol('strict JSON numeric token');
// UTF-8 byte length of a JS string, counting an unpaired surrogate as its 3-byte U+FFFD
// replacement exactly as Node's Buffer.byteLength and TextEncoder do.
// Fatal UTF-8 decoding with one error message in every runtime (engines word theirs differently).
export function decodeUTF8(raw, ignoreBOM = false) {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM }).decode(raw); } catch { throw new Error('Invalid UTF-8'); }
}
export function utf8Length(value) {
  let length = 0;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit < 0x80) length += 1;
    else if (unit < 0x800) length += 2;
    else if (unit >= 0xD800 && unit <= 0xDBFF && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xDC00 && next <= 0xDFFF) { length += 4; i++; } else length += 3;
    } else length += 3;
  }
  return length;
}
// work = raw bytes + 96 per value + 8 per decoded key byte + 4 per prior-key comparison
// + segmentFlushWork per simple escape that ends a raw segment of a retained string or key
// (the first of a run of consecutive simple escapes), exactly as ManifestJSON charges it.
export const MANIFEST_LIMITS = Object.freeze({ rawBytes: 32768, depth: 16, objectMembers: 128, keyBytes: 256, retainedTokens: 1024, retainedStringBytes: 1024, totalValues: 512, totalKeyBytes: 2048, work: 65536, segmentFlushWork: 8 });
export function strictJSON(raw, maxBytes = 8_192, maxString = 1024) {
  return parseJSON(raw, maxBytes, maxString, false);
}
export function strictManifestJSON(raw) {
  return parseJSON(raw, 32_768, 1024, true);
}
function parseJSON(raw, maxBytes, maxString, manifest) {
  if (!(raw instanceof Uint8Array) || raw.length === 0 || raw.length > maxBytes) {
    throw new Error('Expected bounded raw UTF-8 bytes');
  }
  const text = decodeUTF8(raw, true);
  let pos = 0;
  let tokens = 0;
  let values = 0;
  let keyBytes = 0;
  let comparisons = 0;
  let flushes = 0;
  const fail = () => { throw new Error('Invalid or excessive JSON'); };
  const space = () => { while (/[ \t\r\n]/u.test(text[pos] ?? '\uFFFF')) pos++; };
  const token = () => { if (++tokens > MANIFEST_LIMITS.retainedTokens) fail(); };
  const work = () => { if (manifest && raw.length + 96 * values + 8 * keyBytes + 4 * comparisons + MANIFEST_LIMITS.segmentFlushWork * flushes > MANIFEST_LIMITS.work) fail(); };
  function string(limit = maxString, retained = true) {
    if (text[pos++] !== '"') fail();
    const start = pos - 1;
    let previousSimple = false;
    while (pos < text.length) {
      const c = text[pos++];
      if (c.charCodeAt(0) < 32) fail();
      if (c === '\\') {
        const escape = text[pos++];
        if (!'"\\/bfnrtu'.includes(escape ?? '\uFFFF')) fail();
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/u.test(text.slice(pos, pos + 4))) fail();
          pos += 4;
          previousSimple = false;
        } else {
          // Retained strings and keys: a simple escape that does not directly follow another
          // simple escape ends a raw segment and is charged to the manifest work budget.
          if (manifest && retained && !previousSimple) flushes++;
          previousSimple = true;
        }
      } else if (c === '"') {
        const value = JSON.parse(text.slice(start, pos));
        for (const char of value) {
          const cp = char.codePointAt(0);
          if ((cp >= 0xD800 && cp <= 0xDFFF) || (cp >= 0xFDD0 && cp <= 0xFDEF) || (cp & 0xFFFF) >= 0xFFFE) fail();
        }
        if (utf8Length(value) > limit) fail();
        work();
        return value;
      } else previousSimple = false;
    }
    fail();
  }
  function value(depth, mode) {
    if (depth > (manifest ? 16 : 8)) fail();
    if (manifest && ++values > 512) fail();
    work();
    const keep = mode !== 0;
    if (keep) token();
    space();
    if (text[pos] === '"') return string(keep ? maxString : maxBytes, keep);
    if (text[pos] === '{') {
      pos++;
      const object = Object.create(null);
      const keys = new Set();
      space();
      if (text[pos] === '}') { pos++; return object; }
      while (true) {
        space();
        const key = string(manifest ? 256 : maxString);
        if (manifest && (keyBytes += utf8Length(key)) > 2048) fail();
        if (manifest) comparisons += keys.size;
        work();
        if ((!manifest && !key.length) || utf8Length(key) > (manifest ? 256 : 64) || keys.has(key) || keys.size >= (manifest ? 128 : 32)) fail();
        let child = mode;
        if (manifest) {
          if (mode === 1) child = key === 'files' ? 2 : ['state', 'jobId', 'projectId'].includes(key) ? 4 : 0;
          else if (mode === 3) child = ['name', 'path', 'hash', 'mediaType', 'bytes', 'submissionHash'].includes(key) ? 4 : 0;
          else child = mode === 0 ? 0 : 4;
        }
        if (child !== 0) token();
        keys.add(key);
        space();
        if (text[pos++] !== ':') fail();
        const parsed = value(depth + 1, child);
        if (child !== 0) object[key] = parsed;
        space();
        const separator = text[pos++];
        if (separator === '}') return object;
        if (separator !== ',') fail();
      }
    }
    if (text[pos] === '[') {
      pos++;
      const array = [];
      space();
      if (text[pos] === ']') { pos++; return array; }
      while (true) {
        if (!manifest && array.length === 32) fail();
        const child = manifest ? (mode === 0 ? 0 : mode === 2 ? 3 : 4) : 4;
        const parsed = value(depth + 1, child);
        if (child !== 0) array.push(parsed);
        space();
        const separator = text[pos++];
        if (separator === ']') return array;
        if (separator !== ',') fail();
      }
    }
    for (const [literal, result] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(literal, pos)) { pos += literal.length; return result; }
    }
    const number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/u.exec(text.slice(pos));
    if (!number || (keep && number[0].length > 64)) fail();
    pos += number[0].length;
    // Retain number spelling so an integer field cannot silently accept 1e0, 1.0 or -0.
    return Object.freeze({ [numericToken]: true, jsonNumber: number[0] });
  }
  const object = value(0, manifest ? 1 : 4);
  space();
  if (pos !== text.length || !object || Array.isArray(object) || Object.getPrototypeOf(object) !== null) fail();
  return object;
}

export function unsignedJSONInteger(value, max) {
  if (!value || value[numericToken] !== true || typeof value.jsonNumber !== 'string' || !/^(0|[1-9][0-9]*)$/u.test(value.jsonNumber)) {
    throw new Error('Expected an unsigned JSON integer');
  }
  const integer = BigInt(value.jsonNumber);
  if (integer > BigInt(max)) throw new Error('Integer exceeds limit');
  return Number(integer);
}
