// General strict parser plus the metadata-tolerant binding projection.
// Both validate the whole raw document; only the binding projection discards metadata.
const numericToken = Symbol('strict JSON numeric token');
export const MANIFEST_LIMITS = Object.freeze({ rawBytes: 32768, depth: 16, objectMembers: 128, keyBytes: 256, retainedTokens: 256, retainedStringBytes: 1024, totalValues: 512, totalKeyBytes: 2048, work: 65536 });
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
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw);
  let pos = 0;
  let tokens = 0;
  let values = 0;
  let keyBytes = 0;
  let comparisons = 0;
  const fail = () => { throw new Error('Invalid or excessive JSON'); };
  const space = () => { while (/[ \t\r\n]/u.test(text[pos] ?? '\uFFFF')) pos++; };
  const token = () => { if (++tokens > 256) fail(); };
  const work = () => { if (manifest && raw.length + 96 * values + 8 * keyBytes + 4 * comparisons > MANIFEST_LIMITS.work) fail(); };
  function string(limit = maxString) {
    if (text[pos++] !== '"') fail();
    const start = pos - 1;
    while (pos < text.length) {
      const c = text[pos++];
      if (c.charCodeAt(0) < 32) fail();
      if (c === '\\') {
        const escape = text[pos++];
        if (!'"\\/bfnrtu'.includes(escape ?? '\uFFFF')) fail();
        if (escape === 'u') {
          if (!/^[0-9a-fA-F]{4}$/u.test(text.slice(pos, pos + 4))) fail();
          pos += 4;
        }
      } else if (c === '"') {
        const value = JSON.parse(text.slice(start, pos));
        for (const char of value) {
          const cp = char.codePointAt(0);
          if ((cp >= 0xD800 && cp <= 0xDFFF) || (cp >= 0xFDD0 && cp <= 0xFDEF) || (cp & 0xFFFF) >= 0xFFFE) fail();
        }
        if (Buffer.byteLength(value) > limit) fail();
        return value;
      }
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
    if (text[pos] === '"') return string(keep ? maxString : maxBytes);
    if (text[pos] === '{') {
      pos++;
      const object = Object.create(null);
      const keys = new Set();
      space();
      if (text[pos] === '}') { pos++; return object; }
      while (true) {
        space();
        const key = string(manifest ? 256 : maxString);
        if (manifest && (keyBytes += Buffer.byteLength(key)) > 2048) fail();
        if (manifest) comparisons += keys.size;
        work();
        if ((!manifest && !key.length) || Buffer.byteLength(key) > (manifest ? 256 : 64) || keys.has(key) || keys.size >= (manifest ? 128 : 32)) fail();
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
