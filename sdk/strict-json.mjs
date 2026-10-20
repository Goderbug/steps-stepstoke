// Same intentionally narrow resource envelope as the Solidity manifest parser.
const numericToken = Symbol('strict JSON numeric token');
export function strictJSON(raw, maxBytes = 8_192, maxString = 1024) {
  if (!(raw instanceof Uint8Array) || raw.length === 0 || raw.length > maxBytes) {
    throw new Error('Expected bounded raw UTF-8 bytes');
  }
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(raw);
  let pos = 0;
  let tokens = 0;
  const fail = () => { throw new Error('Invalid or excessive JSON'); };
  const space = () => { while (/[ \t\r\n]/u.test(text[pos] ?? '\uFFFF')) pos++; };
  const token = () => { if (++tokens > 256) fail(); };
  function string() {
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
        if (Buffer.byteLength(value) > maxString) fail();
        return value;
      }
    }
    fail();
  }
  function value(depth) {
    if (depth > 8) fail();
    token();
    space();
    if (text[pos] === '"') return string();
    if (text[pos] === '{') {
      pos++;
      const object = Object.create(null);
      const keys = new Set();
      space();
      if (text[pos] === '}') { pos++; return object; }
      while (true) {
        space();
        token();
        const key = string();
        if (!key.length || Buffer.byteLength(key) > 64 || keys.has(key) || keys.size >= 32) fail();
        keys.add(key);
        space();
        if (text[pos++] !== ':') fail();
        object[key] = value(depth + 1);
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
        if (array.length === 32) fail();
        array.push(value(depth + 1));
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
    if (!number || number[0].length > 64) fail();
    pos += number[0].length;
    // Retain number spelling so an integer field cannot silently accept 1e0, 1.0 or -0.
    return Object.freeze({ [numericToken]: true, jsonNumber: number[0] });
  }
  const object = value(0);
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
