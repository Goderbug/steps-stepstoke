// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Policy} from "./Policy.sol";
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
    // Every retained token is either a retained value or the key that introduces one, so the
    // retained count never exceeds 2 * MAX_VALUES: the value, key-byte and work budgets bind
    // first and this cap is a structural ceiling, not a limit a well-formed result can reach.
    uint256 internal constant MAX_RETAINED_TOKENS = 2 * MAX_VALUES;
    uint256 internal constant MAX_RETAINED_STRING = 1024;
    uint256 internal constant MAX_VALUES = 512;
    uint256 internal constant MAX_TOTAL_KEY_BYTES = 2048;
    // Combined envelope: raw bytes + 96 per JSON value + 8 per decoded key byte
    // + 4 per prior-key comparison (0+1+...+members-1 separately for every object)
    // + 8 per simple escape that ends a raw segment of a retained string or key
    // (the first of a run of consecutive simple escapes; the rest are charged as raw bytes).
    uint256 internal constant MAX_WORK = 65_536;
    uint256 internal constant SEGMENT_FLUSH_WORK = 8;

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
        // The scanned prefix is plain ASCII without quote or escape: it is the first raw
        // segment and is never walked a second time by the general loop below.
        uint256 pos = end;
        uint256 status;
        uint256 flushes;
        // Decode and validate each scalar once. In particular, retained raw UTF-8 must not
        // incur Solidity byte-array checks followed by a second full Text.utf8 replay.
        // All reads which affect acceptance and every output write are bounded explicitly.
        assembly ("memory-safe") {
            function simpleEscape(e) -> c {
                c := e
                if iszero(or(or(eq(e, 34), eq(e, 92)), eq(e, 47))) {
                    // The five control escapes are indexed from ASCII 'b'. BYTE returns
                    // zero for out-of-range indices; zero is not a simple JSON escape.
                    c := byte(sub(e, 98), 0x080000000c000000000000000a0000000d000900000000000000000000000000)
                }
            }
            function scalarOK(c) -> ok {
                ok := and(
                    and(lt(c, 0x110000), iszero(and(iszero(lt(c, 0xd800)), lt(c, 0xe000)))),
                    and(iszero(and(iszero(lt(c, 0xfdd0)), lt(c, 0xfdf0))), lt(and(c, 0xffff), 0xfffe))
                )
            }
            function hexDigitOK(c) -> ok {
                let lower := or(c, 32)
                ok := or(and(gt(c, 47), lt(c, 58)), and(gt(lower, 96), lt(lower, 103)))
            }
            function hex4(data, i, length) -> v, ok {
                ok := iszero(gt(add(i, 4), length))
                if ok {
                    let word := mload(add(data, i))
                    ok := and(hexDigitOK(byte(2, word)), hexDigitOK(byte(3, word)))
                    if iszero(eq(shr(240, word), 0x3030)) {
                        ok := and(ok, and(hexDigitOK(byte(0, word)), hexDigitOK(byte(1, word))))
                    }
                    let packed := shr(224, word)
                    // ASCII digits have bit 6 clear; A-F/a-f have it set. Add nine to
                    // their low nibble, then pack the four independently validated digits.
                    let digits := add(and(packed, 0x0f0f0f0f), mul(and(shr(6, packed), 0x01010101), 9))
                    v := or(
                        or(shl(12, and(shr(24, digits), 15)), shl(8, and(shr(16, digits), 15))),
                        or(shl(4, and(shr(8, digits), 15)), and(digits, 15))
                    )
                }
            }
            function escaped(data, i, length) -> c, next, ok {
                c, ok := hex4(data, i, length)
                next := add(i, 4)
                // The common BMP prefix contains neither surrogates nor noncharacters.
                if lt(c, 0xd800) { leave }
                if and(ok, and(iszero(lt(c, 0xd800)), lt(c, 0xdc00))) {
                    ok := iszero(gt(add(next, 6), length))
                    if ok {
                        ok := and(
                            eq(byte(0, mload(add(data, next))), 92),
                            eq(byte(0, mload(add(data, add(next, 1)))), 117)
                        )
                    }
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
                // Canonical scalar UTF-8, classified by encoded width. Two-byte scalars
                // cannot be surrogates or noncharacters, so they need no scalar replay.
                let word := mload(add(data, i))
                let b := byte(0, word)
                ok := and(iszero(lt(b, 0x80)), lt(b, 0xc0))
                if and(iszero(lt(c, 0xc2)), lt(c, 0xe0)) {
                    next := add(i, 1)
                    ok := and(ok, iszero(gt(next, length)))
                    leave
                }
                let d := byte(1, word)
                ok := and(ok, and(iszero(lt(d, 0x80)), lt(d, 0xc0)))
                if and(iszero(lt(c, 0xe0)), lt(c, 0xf0)) {
                    next := add(i, 2)
                    ok := and(ok, iszero(gt(next, length)))
                    if and(eq(c, 0xe0), lt(b, 0xa0)) { ok := 0 }
                    if and(eq(c, 0xed), iszero(lt(b, 0xa0))) { ok := 0 }
                    if eq(c, 0xef) {
                        if and(eq(b, 0xb7), and(iszero(lt(d, 0x90)), lt(d, 0xb0))) { ok := 0 }
                        if and(eq(b, 0xbf), iszero(lt(d, 0xbe))) { ok := 0 }
                    }
                    leave
                }
                let e := byte(2, word)
                next := add(i, 3)
                ok := and(ok, and(iszero(lt(e, 0x80)), lt(e, 0xc0)))
                ok := and(ok, and(and(iszero(lt(c, 0xf0)), lt(c, 0xf5)), iszero(gt(next, length))))
                if and(eq(c, 0xf0), lt(b, 0x90)) { ok := 0 }
                if and(eq(c, 0xf4), iszero(lt(b, 0x90))) { ok := 0 }
                if and(eq(and(b, 15), 15), and(eq(d, 0xbf), iszero(lt(e, 0xbe)))) { ok := 0 }
            }
            let data := add(raw, 32)
            let length := mload(raw)
            let dst := add(out, 32)
            let n := 0
            let segment := begin
            for {} lt(pos, length) {} {
                let start := pos
                let c := byte(0, mload(add(data, pos)))
                pos := add(pos, 1)
                if eq(c, 34) {
                    let size := sub(start, segment)
                    if size {
                        if gt(add(n, size), max) {
                            status := 2
                            break
                        }
                        mcopy(add(dst, n), add(data, segment), size)
                        n := add(n, size)
                    }
                    mstore(out, n)
                    status := 1
                    break
                }
                if lt(c, 32) { break }
                if eq(c, 92) {
                    let size := sub(start, segment)
                    if size {
                        if gt(add(n, size), max) {
                            status := 2
                            break
                        }
                        mcopy(add(dst, n), add(data, segment), size)
                        n := add(n, size)
                    }
                    if eq(pos, length) { break }
                    let e := byte(0, mload(add(data, pos)))
                    pos := add(pos, 1)
                    switch e
                    case 117 {
                        let ok
                        c, pos, ok := escaped(data, pos, length)
                        if iszero(ok) { break }
                        let width := 1
                        if gt(c, 0x7f) { width := 2 }
                        if gt(c, 0x7ff) { width := 3 }
                        if gt(c, 0xffff) { width := 4 }
                        if gt(add(n, width), max) {
                            status := 2
                            break
                        }
                        let at := add(dst, n)
                        switch width
                        case 1 { mstore8(at, c) }
                        case 2 {
                            mstore8(at, or(0xc0, shr(6, c)))
                            mstore8(add(at, 1), or(0x80, and(c, 63)))
                        }
                        case 3 {
                            mstore8(at, or(0xe0, shr(12, c)))
                            mstore8(add(at, 1), or(0x80, and(shr(6, c), 63)))
                            mstore8(add(at, 2), or(0x80, and(c, 63)))
                        }
                        case 4 {
                            mstore8(at, or(0xf0, shr(18, c)))
                            mstore8(add(at, 1), or(0x80, and(shr(12, c), 63)))
                            mstore8(add(at, 2), or(0x80, and(shr(6, c), 63)))
                            mstore8(add(at, 3), or(0x80, and(c, 63)))
                        }
                        n := add(n, width)
                        segment := pos
                        continue
                    }
                    default {
                        c := simpleEscape(e)
                        if iszero(c) { break }
                        // Each general-loop dispatch of a simple escape flushed a raw segment and
                        // re-enters this loop; its cost is charged to the work budget below.
                        flushes := add(flushes, 1)
                    }
                    if eq(n, max) {
                        status := 2
                        break
                    }
                    mstore8(add(dst, n), c)
                    n := add(n, 1)
                    // Consecutive simple escapes need no raw-segment flush, scalar decoder
                    // or repeated outer dispatch. Unicode/unknown escapes return to the
                    // general path without consuming a byte; unknown forms still reject.
                    for {} lt(add(pos, 1), length) {} {
                        let pair := mload(add(data, pos))
                        if iszero(eq(byte(0, pair), 92)) { break }
                        let decoded := simpleEscape(byte(1, pair))
                        if iszero(decoded) { break }
                        if eq(n, max) {
                            status := 2
                            break
                        }
                        mstore8(add(dst, n), decoded)
                        n := add(n, 1)
                        pos := add(pos, 2)
                    }
                    if eq(status, 2) { break }
                    segment := pos
                    continue
                }
                if gt(c, 127) {
                    let ok
                    pos, ok := utf8(data, pos, length, c)
                    if iszero(ok) { break }
                }
            }
        }
        if (status == 2) revert Policy.Limit();
        if (status != 1) revert Policy.Invalid();
        _charge(p, flushes * SEGMENT_FLUSH_WORK);
        p.pos = pos;
        return string(out);
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
            function hexDigitOK(c) -> ok {
                let lower := or(c, 32)
                ok := or(and(gt(c, 47), lt(c, 58)), and(gt(lower, 96), lt(lower, 103)))
            }
            function hex4(data, i, length) -> v, ok {
                ok := iszero(gt(add(i, 4), length))
                if ok {
                    let word := mload(add(data, i))
                    ok := and(hexDigitOK(byte(2, word)), hexDigitOK(byte(3, word)))
                    if iszero(eq(shr(240, word), 0x3030)) {
                        ok := and(ok, and(hexDigitOK(byte(0, word)), hexDigitOK(byte(1, word))))
                    }
                    let packed := shr(224, word)
                    // ASCII digits have bit 6 clear; A-F/a-f have it set. Add nine to
                    // their low nibble, then pack the four independently validated digits.
                    let digits := add(and(packed, 0x0f0f0f0f), mul(and(shr(6, packed), 0x01010101), 9))
                    v := or(
                        or(shl(12, and(shr(24, digits), 15)), shl(8, and(shr(16, digits), 15))),
                        or(shl(4, and(shr(8, digits), 15)), and(digits, 15))
                    )
                }
            }
            function escaped(data, i, length) -> next, ok {
                let c
                c, ok := hex4(data, i, length)
                next := add(i, 4)
                // The common BMP prefix contains neither surrogates nor noncharacters.
                if lt(c, 0xd800) { leave }
                if and(ok, and(iszero(lt(c, 0xd800)), lt(c, 0xdc00))) {
                    ok := iszero(gt(add(next, 6), length))
                    if ok {
                        ok := and(
                            eq(byte(0, mload(add(data, next))), 92),
                            eq(byte(0, mload(add(data, add(next, 1)))), 117)
                        )
                    }
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
