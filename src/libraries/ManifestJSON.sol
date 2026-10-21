// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Policy} from "./Policy.sol";
import {Text} from "./Text.sol";
import {StrictJSON as J} from "./StrictJSON.sol";

/// @notice Strict whole-document validation with a small retained result projection.
/// @dev Metadata is authenticated and validated, never truncated or reserialized. Its arrays and
/// strings consume the raw byte budget, not the accepted output's token/string budgets.
library ManifestJSON {
    struct Parser {
        bytes raw;
        uint256 pos;
        uint16 count;
        J.Token[] tokens;
        bytes32[] keys;
        bytes keyBuffer;
        uint256 values;
        uint256 keyBytes;
        uint256 work;
    }

    uint256 internal constant MAX_DEPTH = 16;
    uint256 internal constant MAX_OBJECT_MEMBERS = 128;
    uint256 internal constant MAX_KEY = 256;
    uint256 internal constant MAX_RETAINED_TOKENS = 256;
    uint256 internal constant MAX_RETAINED_STRING = 1024;
    uint256 internal constant MAX_VALUES = 512;
    uint256 internal constant MAX_TOTAL_KEY_BYTES = 2048;
    // Combined envelope: raw bytes + 96 per JSON value + 8 per decoded key byte
    // + 4 per prior-key comparison (0+1+...+members-1 separately for every object).
    uint256 internal constant MAX_WORK = 65_536;

    // Modes: 0=validated metadata, 1=result root, 2=files array, 3=file, 4=retained scalar.
    function parse(bytes memory raw) internal pure returns (J.Token[] memory tokens) {
        if (raw.length == 0 || raw.length > Policy.MAX_MANIFEST) revert Policy.Limit();
        Parser memory p = Parser(
            raw,
            0,
            0,
            new J.Token[](MAX_RETAINED_TOKENS),
            new bytes32[]((MAX_DEPTH + 1) * MAX_OBJECT_MEMBERS),
            new bytes(MAX_KEY),
            0,
            0,
            raw.length
        );
        _value(p, 0, 1);
        _space(p);
        if (p.pos != raw.length || p.tokens[0].kind != J.Type.Object) revert Policy.Invalid();
        tokens = p.tokens;
        uint256 count = p.count;
        assembly ("memory-safe") { mstore(tokens, count) }
    }

    function _value(Parser memory p, uint256 depth, uint8 mode) private pure {
        if (depth > MAX_DEPTH || ++p.values > MAX_VALUES) revert Policy.Limit();
        _charge(p, 96);
        _space(p);
        if (p.pos == p.raw.length) revert Policy.Invalid();
        bool keep = mode != 0;
        uint16 at;
        if (keep) {
            if (p.count == MAX_RETAINED_TOKENS) revert Policy.Limit();
            at = p.count++;
        }
        bytes1 c = p.raw[p.pos];
        J.Type kind;
        if (c == "{") {
            kind = J.Type.Object;
            _object(p, depth, mode);
        } else if (c == "[") {
            kind = J.Type.Array;
            _array(p, depth, mode);
        } else if (c == '"') {
            kind = J.Type.String;
            if (keep) p.tokens[at].value = _string(p, MAX_RETAINED_STRING);
            else _skipString(p);
        } else if (c == "t" || c == "f" || c == "n") {
            bytes memory word = c == "t" ? bytes("true") : c == "f" ? bytes("false") : bytes("null");
            kind = c == "n" ? J.Type.Null : J.Type.Boolean;
            if (p.pos + word.length > p.raw.length) revert Policy.Invalid();
            for (uint256 j; j < word.length; ++j) {
                if (p.raw[p.pos++] != word[j]) revert Policy.Invalid();
            }
        } else {
            kind = J.Type.Number;
            uint256 begin = p.pos;
            _number(p);
            if (keep) {
                uint256 length = p.pos - begin;
                if (length > 64) revert Policy.Limit();
                bytes memory out = new bytes(length);
                for (uint256 j; j < length; ++j) {
                    out[j] = p.raw[begin + j];
                }
                p.tokens[at].value = string(out);
            }
        }
        if (keep) {
            p.tokens[at].kind = kind;
            p.tokens[at].end = p.count;
        }
    }

    function _object(Parser memory p, uint256 depth, uint8 mode) private pure {
        ++p.pos;
        _space(p);
        if (_take(p, "}")) return;
        uint256 count;
        uint256 keyOffset = depth * MAX_OBJECT_MEMBERS;
        while (true) {
            _space(p);
            if (count == MAX_OBJECT_MEMBERS) revert Policy.Limit();
            string memory key = _stringInto(p, p.keyBuffer, MAX_KEY);
            p.keyBytes += bytes(key).length;
            if (p.keyBytes > MAX_TOTAL_KEY_BYTES) revert Policy.Limit();
            _charge(p, bytes(key).length * 8 + count * 4);
            bytes32 digest = keccak256(bytes(key));
            _unique(p.keys, keyOffset, count, digest);
            p.keys[keyOffset + count++] = digest;
            uint8 child = _childMode(mode, digest);
            if (child != 0) {
                if (p.count == MAX_RETAINED_TOKENS) revert Policy.Limit();
                uint16 at = p.count++;
                // The reusable scratch key buffer must never alias a retained token.
                bytes memory copy = new bytes(bytes(key).length);
                for (uint256 i; i < copy.length; ++i) {
                    copy[i] = bytes(key)[i];
                }
                p.tokens[at] = J.Token(J.Type.String, p.count, string(copy));
            }
            _space(p);
            if (!_take(p, ":")) revert Policy.Invalid();
            _value(p, depth + 1, child);
            _space(p);
            if (_take(p, "}")) return;
            if (!_take(p, ",")) revert Policy.Invalid();
        }
    }

    function _charge(Parser memory p, uint256 amount) private pure {
        p.work += amount;
        if (p.work > MAX_WORK) revert Policy.Limit();
    }

    function _unique(bytes32[] memory keys, uint256 offset, uint256 count, bytes32 digest) private pure {
        bool unique = true;
        // offset+count is bounded by MAX_DEPTH/MAX_OBJECT_MEMBERS before this helper is called.
        assembly ("memory-safe") {
            let first := add(add(keys, 32), mul(offset, 32))
            let end := add(first, mul(count, 32))
            for { let at := first } lt(at, end) { at := add(at, 32) } {
                if eq(mload(at), digest) {
                    unique := 0
                    break
                }
            }
        }
        if (!unique) revert Policy.Invalid();
    }

    function _childMode(uint8 mode, bytes32 key) private pure returns (uint8) {
        if (mode == 0) return 0;
        if (mode == 1) {
            if (key == keccak256("files")) return 2;
            if (key == keccak256("state") || key == keccak256("jobId") || key == keccak256("projectId")) {
                return 4;
            }
            return 0;
        }
        if (mode == 3) {
            if (
                key == keccak256("name") || key == keccak256("path") || key == keccak256("hash")
                    || key == keccak256("mediaType") || key == keccak256("bytes")
                    || key == keccak256("submissionHash")
            ) return 4;
            return 0;
        }
        // Wrongly typed required values must still be retained so the verifier rejects their type.
        return 4;
    }

    function _array(Parser memory p, uint256 depth, uint8 mode) private pure {
        ++p.pos;
        _space(p);
        if (_take(p, "]")) return;
        uint8 child = mode == 0 ? 0 : mode == 2 ? 3 : 4;
        while (true) {
            _value(p, depth + 1, child);
            _space(p);
            if (_take(p, "]")) return;
            if (!_take(p, ",")) revert Policy.Invalid();
        }
    }

    function _string(Parser memory p, uint256 max) private pure returns (string memory) {
        return _stringInto(p, new bytes(max), max);
    }

    function _stringInto(Parser memory p, bytes memory out, uint256 max)
        private
        pure
        returns (string memory)
    {
        if (!_take(p, '"')) revert Policy.Invalid();
        assembly ("memory-safe") { mstore(out, max) }
        bytes memory raw = p.raw;
        uint256 begin = p.pos;
        uint256 end = begin;
        bool ascii;
        assembly ("memory-safe") {
            let data := add(raw, 32)
            let length := mload(raw)
            for {} lt(end, length) { end := add(end, 1) } {
                let c := byte(0, mload(add(data, end)))
                if eq(c, 34) {
                    ascii := 1
                    break
                }
                if or(or(lt(c, 32), gt(c, 127)), eq(c, 92)) { break }
            }
        }
        if (ascii) {
            uint256 length = end - begin;
            if (length > max) revert Policy.Limit();
            assembly ("memory-safe") {
                let src := add(add(raw, 32), begin)
                let dst := add(out, 32)
                for { let i := 0 } lt(i, length) { i := add(i, 32) } {
                    mstore(add(dst, i), mload(add(src, i)))
                }
                mstore(out, length)
            }
            p.pos = end + 1;
            return string(out);
        }
        uint256 n;
        bool rawNonASCII;
        while (p.pos < p.raw.length) {
            bytes1 c = p.raw[p.pos++];
            if (c == '"') {
                assembly ("memory-safe") { mstore(out, n) }
                // Escaped scalars were validated before encoding; only raw multibyte input
                // needs a second UTF-8 pass. ASCII-only escaped keys need no bytewise replay.
                if (rawNonASCII) Text.utf8(out);
                return string(out);
            }
            if (uint8(c) < 32) revert Policy.Invalid();
            if (uint8(c) >= 128) rawNonASCII = true;
            if (c == "\\") {
                if (p.pos == p.raw.length) revert Policy.Invalid();
                c = p.raw[p.pos++];
                if (c == "u") {
                    uint256 scalar = _escapedScalar(p);
                    uint256 width = scalar < 0x80 ? 1 : scalar < 0x800 ? 2 : scalar < 0x10000 ? 3 : 4;
                    if (n + width > max) revert Policy.Limit();
                    if (width == 1) {
                        out[n++] = bytes1(uint8(scalar));
                    } else {
                        if (width == 2) {
                            out[n++] = bytes1(uint8(0xc0 | (scalar >> 6)));
                        } else if (width == 3) {
                            out[n++] = bytes1(uint8(0xe0 | (scalar >> 12)));
                            out[n++] = bytes1(uint8(0x80 | ((scalar >> 6) & 63)));
                        } else {
                            out[n++] = bytes1(uint8(0xf0 | (scalar >> 18)));
                            out[n++] = bytes1(uint8(0x80 | ((scalar >> 12) & 63)));
                            out[n++] = bytes1(uint8(0x80 | ((scalar >> 6) & 63)));
                        }
                        out[n++] = bytes1(uint8(0x80 | (scalar & 63)));
                    }
                    continue;
                }
                if (c == "b") c = 0x08;
                else if (c == "f") c = 0x0c;
                else if (c == "n") c = 0x0a;
                else if (c == "r") c = 0x0d;
                else if (c == "t") c = 0x09;
                else if (c != '"' && c != "\\" && c != "/") revert Policy.Invalid();
            }
            if (n == max) revert Policy.Limit();
            out[n++] = c;
        }
        revert Policy.Invalid();
    }

    function _skipString(Parser memory p) private pure {
        if (!_take(p, "\"")) revert Policy.Invalid();
        bytes memory raw = p.raw;
        uint256 pos = p.pos;
        bool valid;
        // Validate ignored strings in-place without metadata-sized allocation or decoding.
        // Lookahead bytes outside the input cannot determine success. Position includes the quote.
        assembly ("memory-safe") {
            function scalarOK(c) -> ok {
                ok := and(
                    and(lt(c, 0x110000), iszero(and(iszero(lt(c, 0xd800)), lt(c, 0xe000)))),
                    and(iszero(and(iszero(lt(c, 0xfdd0)), lt(c, 0xfdf0))), lt(and(c, 0xffff), 0xfffe))
                )
            }
            function hex4(data, i, length) -> v, ok {
                ok := iszero(gt(add(i, 4), length))
                if ok {
                    let word := mload(add(data, i))
                    for { let j := 0 } lt(j, 4) { j := add(j, 1) } {
                        let c := byte(j, word)
                        let d := sub(c, 48)
                        if gt(d, 9) {
                            d := sub(or(c, 32), 97)
                            if gt(d, 5) { ok := 0 }
                            d := add(d, 10)
                        }
                        v := or(shl(4, v), d)
                    }
                }
            }
            function escaped(data, i, length) -> next, ok {
                let c
                c, ok := hex4(data, i, length)
                next := add(i, 4)
                if and(ok, and(iszero(lt(c, 0xd800)), lt(c, 0xdc00))) {
                    ok := and(
                        iszero(gt(add(next, 6), length)),
                        and(
                            eq(byte(0, mload(add(data, next))), 92),
                            eq(byte(0, mload(add(data, add(next, 1)))), 117)
                        )
                    )
                    if ok {
                        let low
                        low, ok := hex4(data, add(next, 2), length)
                        ok := and(ok, and(iszero(lt(low, 0xdc00)), lt(low, 0xe000)))
                        c := add(0x10000, add(shl(10, sub(c, 0xd800)), sub(low, 0xdc00)))
                        next := add(next, 6)
                    }
                }
                ok := and(ok, scalarOK(c))
            }
            function utf8(data, i, length, c) -> next, ok {
                let n := 0
                let minimum := 0
                switch and(iszero(lt(c, 0xc2)), lt(c, 0xe0))
                case 1 {
                    n := 1
                    minimum := 0x80
                    c := and(c, 0x1f)
                }
                default {
                    switch and(iszero(lt(c, 0xe0)), lt(c, 0xf0))
                    case 1 {
                        n := 2
                        minimum := 0x800
                        c := and(c, 0xf)
                    }
                    default {
                        if and(iszero(lt(c, 0xf0)), lt(c, 0xf5)) {
                            n := 3
                            minimum := 0x10000
                            c := and(c, 7)
                        }
                    }
                }
                next := add(i, n)
                ok := and(iszero(iszero(n)), iszero(gt(next, length)))
                if ok {
                    for {} lt(i, next) { i := add(i, 1) } {
                        let d := byte(0, mload(add(data, i)))
                        if or(lt(d, 0x80), gt(d, 0xbf)) { ok := 0 }
                        c := or(shl(6, c), and(d, 63))
                    }
                    ok := and(ok, and(iszero(lt(c, minimum)), scalarOK(c)))
                }
            }
            let data := add(raw, 32)
            let length := mload(raw)
            for {} lt(pos, length) {} {
                let c := byte(0, mload(add(data, pos)))
                pos := add(pos, 1)
                if eq(c, 34) {
                    valid := 1
                    break
                }
                if lt(c, 32) { break }
                if eq(c, 92) {
                    if eq(pos, length) { break }
                    let e := byte(0, mload(add(data, pos)))
                    pos := add(pos, 1)
                    switch e
                    case 117 {
                        let ok
                        pos, ok := escaped(data, pos, length)
                        if iszero(ok) { break }
                    }
                    default {
                        if iszero(
                            or(
                                or(or(eq(e, 34), eq(e, 92)), or(eq(e, 47), eq(e, 98))),
                                or(or(eq(e, 102), eq(e, 110)), or(eq(e, 114), eq(e, 116)))
                            )
                        ) { break }
                    }
                }
                if gt(c, 127) {
                    let ok
                    pos, ok := utf8(data, pos, length, c)
                    if iszero(ok) { break }
                }
            }
        }
        if (!valid) revert Policy.Invalid();
        p.pos = pos;
    }

    function _escapedScalar(Parser memory p) private pure returns (uint256 scalar) {
        scalar = _u16(p);
        if (scalar >= 0xd800 && scalar <= 0xdbff) {
            if (!_take(p, "\\") || !_take(p, "u")) revert Policy.Invalid();
            uint256 low = _u16(p);
            if (low < 0xdc00 || low > 0xdfff) revert Policy.Invalid();
            scalar = 0x10000 + ((scalar - 0xd800) << 10) + low - 0xdc00;
        }
        _scalar(scalar);
    }

    function _scalar(uint256 scalar) private pure {
        if (
            scalar > 0x10ffff || (scalar >= 0xd800 && scalar <= 0xdfff)
                || (scalar >= 0xfdd0 && scalar <= 0xfdef) || (scalar & 0xffff) >= 0xfffe
        ) revert Policy.Invalid();
    }

    function _u16(Parser memory p) private pure returns (uint256 v) {
        if (p.pos + 4 > p.raw.length) revert Policy.Invalid();
        bytes memory raw = p.raw;
        uint256 pos = p.pos;
        bool valid = true;
        // Decode four ASCII hex digits directly; bounds were checked above. Unknown strings can
        // contain thousands of escapes and must not pay four dynamic-array checks per digit.
        assembly ("memory-safe") {
            let word := mload(add(add(raw, 32), pos))
            let start := 0
            if eq(shr(240, word), 0x3030) { start := 2 }
            for { let i := start } lt(i, 4) { i := add(i, 1) } {
                let c := byte(i, word)
                let digit := sub(c, 48)
                if gt(digit, 9) {
                    digit := sub(or(c, 32), 97)
                    if gt(digit, 5) { valid := 0 }
                    digit := add(digit, 10)
                }
                v := or(shl(4, v), digit)
            }
        }
        if (!valid) revert Policy.Invalid();
        p.pos = pos + 4;
    }

    function _number(Parser memory p) private pure {
        _take(p, "-");
        if (!_take(p, "0")) {
            if (p.pos == p.raw.length || p.raw[p.pos] < "1" || p.raw[p.pos] > "9") revert Policy.Invalid();
            _digits(p);
        }
        if (_take(p, ".")) _digits(p);
        if (_take(p, "e") || _take(p, "E")) {
            if (!_take(p, "+")) _take(p, "-");
            _digits(p);
        }
    }

    function _digits(Parser memory p) private pure {
        uint256 begin = p.pos;
        uint256 pos = begin;
        bytes memory raw = p.raw;
        assembly ("memory-safe") {
            let length := mload(raw)
            let data := add(raw, 32)
            for {} lt(pos, length) { pos := add(pos, 1) } {
                let c := byte(0, mload(add(data, pos)))
                if or(lt(c, 48), gt(c, 57)) { break }
            }
        }
        if (begin == pos) revert Policy.Invalid();
        p.pos = pos;
    }

    function _take(Parser memory p, bytes1 c) private pure returns (bool) {
        if (p.pos < p.raw.length && p.raw[p.pos] == c) {
            ++p.pos;
            return true;
        }
        return false;
    }

    function _space(Parser memory p) private pure {
        bytes memory raw = p.raw;
        uint256 pos = p.pos;
        assembly ("memory-safe") {
            let length := mload(raw)
            let data := add(raw, 32)
            for {} lt(pos, length) { pos := add(pos, 1) } {
                let c := byte(0, mload(add(data, pos)))
                if iszero(or(or(eq(c, 32), eq(c, 9)), or(eq(c, 10), eq(c, 13)))) { break }
            }
        }
        p.pos = pos;
    }
}
