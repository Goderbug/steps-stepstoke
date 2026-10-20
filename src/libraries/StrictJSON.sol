// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Policy} from "./Policy.sol";
import {Text} from "./Text.sol";

/// @notice Bounded, whole-document JSON parser. Strings and object keys are decoded before comparison.
/// @dev Unknown fields are parsed too, including duplicate-key, UTF-8, depth and resource checks.
library StrictJSON {
    enum Type {
        Object,
        Array,
        String,
        Number,
        Boolean,
        Null
    }

    struct Token {
        Type kind;
        uint16 end; // First token after this entire subtree.
        string value;
    }

    struct Parser {
        bytes raw;
        uint256 pos;
        uint16 count;
        Token[] tokens;
    }

    uint256 internal constant MAX_TOKENS = 256;
    uint256 internal constant MAX_DEPTH = 8;
    uint256 internal constant MAX_MEMBERS = 32;
    uint256 internal constant MAX_STRING = 1024;

    function parse(bytes memory raw) internal pure returns (Token[] memory tokens) {
        if (raw.length == 0 || raw.length > Policy.MAX_MANIFEST) revert Policy.Limit();
        Parser memory p = Parser(raw, 0, 0, new Token[](MAX_TOKENS));
        _value(p, 0);
        _space(p);
        if (p.pos != raw.length || p.tokens[0].kind != Type.Object) revert Policy.Invalid();
        tokens = p.tokens;
        uint256 count = p.count;
        assembly ("memory-safe") {
            mstore(tokens, count)
        }
    }

    function field(Token[] memory t, uint256 object, string memory key) internal pure returns (uint256) {
        if (t[object].kind != Type.Object) revert Policy.Invalid();
        uint256 i = object + 1;
        bytes32 wanted = keccak256(bytes(key));
        while (i < t[object].end) {
            if (keccak256(bytes(t[i].value)) == wanted) return i + 1;
            i = t[i + 1].end;
        }
        revert Policy.Invalid();
    }

    function stringAt(Token[] memory t, uint256 i) internal pure returns (string memory) {
        if (t[i].kind != Type.String) revert Policy.Invalid();
        return t[i].value;
    }

    function uintAt(Token[] memory t, uint256 i) internal pure returns (uint256 v) {
        if (t[i].kind != Type.Number) revert Policy.Invalid();
        bytes memory b = bytes(t[i].value);
        if (b.length > 10) revert Policy.Limit();
        for (uint256 j; j < b.length; ++j) {
            if (!_digit(b[j])) revert Policy.Invalid();
            v = v * 10 + uint8(b[j]) - 48;
        }
    }

    function _value(Parser memory p, uint256 depth) private pure returns (uint16 at) {
        if (depth > MAX_DEPTH || p.count >= MAX_TOKENS) revert Policy.Limit();
        _space(p);
        if (p.pos == p.raw.length) revert Policy.Invalid();
        at = p.count++;
        bytes1 c = p.raw[p.pos];
        if (c == "{") {
            p.tokens[at].kind = Type.Object;
            _object(p, depth);
        } else if (c == "[") {
            p.tokens[at].kind = Type.Array;
            _array(p, depth);
        } else if (c == '"') {
            p.tokens[at].kind = Type.String;
            p.tokens[at].value = _string(p);
        } else if (c == "t" || c == "f" || c == "n") {
            bytes memory word = c == "t" ? bytes("true") : c == "f" ? bytes("false") : bytes("null");
            p.tokens[at].kind = c == "n" ? Type.Null : Type.Boolean;
            if (p.pos + word.length > p.raw.length) revert Policy.Invalid();
            for (uint256 j; j < word.length; ++j) {
                if (p.raw[p.pos++] != word[j]) revert Policy.Invalid();
            }
        } else {
            p.tokens[at].kind = Type.Number;
            p.tokens[at].value = _number(p);
        }
        p.tokens[at].end = p.count;
    }

    function _object(Parser memory p, uint256 depth) private pure {
        ++p.pos;
        _space(p);
        if (_take(p, "}")) return;
        bytes32[32] memory keys;
        uint256 members;
        while (true) {
            _space(p);
            if (members == MAX_MEMBERS || p.count >= MAX_TOKENS) revert Policy.Limit();
            string memory key = _string(p);
            if (bytes(key).length == 0 || bytes(key).length > 64) revert Policy.Limit();
            bytes32 digest = keccak256(bytes(key));
            for (uint256 j; j < members; ++j) {
                if (keys[j] == digest) revert Policy.Invalid();
            }
            keys[members++] = digest;
            uint16 k = p.count++;
            p.tokens[k] = Token(Type.String, p.count, key);
            _space(p);
            if (!_take(p, ":")) revert Policy.Invalid();
            _value(p, depth + 1);
            _space(p);
            if (_take(p, "}")) return;
            if (!_take(p, ",")) revert Policy.Invalid();
        }
    }

    function _array(Parser memory p, uint256 depth) private pure {
        ++p.pos;
        _space(p);
        if (_take(p, "]")) return;
        uint256 members;
        while (true) {
            if (++members > MAX_MEMBERS) revert Policy.Limit();
            _value(p, depth + 1);
            _space(p);
            if (_take(p, "]")) return;
            if (!_take(p, ",")) revert Policy.Invalid();
        }
    }

    function _string(Parser memory p) private pure returns (string memory) {
        if (!_take(p, '"')) revert Policy.Invalid();
        bytes memory out = new bytes(MAX_STRING);
        uint256 n;
        while (p.pos < p.raw.length) {
            bytes1 c = p.raw[p.pos++];
            if (c == '"') {
                assembly ("memory-safe") {
                    mstore(out, n)
                }
                Text.utf8(out);
                return string(out);
            }
            if (uint8(c) < 32) revert Policy.Invalid();
            if (c == "\\") {
                if (p.pos == p.raw.length) revert Policy.Invalid();
                c = p.raw[p.pos++];
                if (c == "u") {
                    uint256 scalar = _u16(p);
                    if (scalar >= 0xd800 && scalar <= 0xdbff) {
                        if (!_take(p, "\\") || !_take(p, "u")) revert Policy.Invalid();
                        uint256 low = _u16(p);
                        if (low < 0xdc00 || low > 0xdfff) revert Policy.Invalid();
                        scalar = 0x10000 + ((scalar - 0xd800) << 10) + low - 0xdc00;
                    } else if (scalar >= 0xdc00 && scalar <= 0xdfff) {
                        revert Policy.Invalid();
                    }
                    uint256 width = scalar < 0x80 ? 1 : scalar < 0x800 ? 2 : scalar < 0x10000 ? 3 : 4;
                    if (n + width > MAX_STRING) revert Policy.Limit();
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
            if (n == MAX_STRING) revert Policy.Limit();
            out[n++] = c;
        }
        revert Policy.Invalid();
    }

    function _u16(Parser memory p) private pure returns (uint256 v) {
        if (p.pos + 4 > p.raw.length) revert Policy.Invalid();
        for (uint256 i; i < 4; ++i) {
            v = (v << 4) | Text.nibble(p.raw[p.pos++]);
        }
    }

    function _number(Parser memory p) private pure returns (string memory) {
        uint256 begin = p.pos;
        _take(p, "-");
        if (!_take(p, "0")) {
            if (p.pos == p.raw.length || p.raw[p.pos] < "1" || p.raw[p.pos] > "9") {
                revert Policy.Invalid();
            }
            while (p.pos < p.raw.length && _digit(p.raw[p.pos])) ++p.pos;
        }
        if (_take(p, ".")) _digits(p);
        if (_take(p, "e") || _take(p, "E")) {
            if (!_take(p, "+")) _take(p, "-");
            _digits(p);
        }
        uint256 length = p.pos - begin;
        if (length > 64) revert Policy.Limit();
        bytes memory value = new bytes(length);
        for (uint256 i; i < length; ++i) {
            value[i] = p.raw[begin + i];
        }
        return string(value);
    }

    function _digits(Parser memory p) private pure {
        uint256 begin = p.pos;
        while (p.pos < p.raw.length && _digit(p.raw[p.pos])) ++p.pos;
        if (begin == p.pos) revert Policy.Invalid();
    }

    function _digit(bytes1 c) private pure returns (bool) {
        return c >= "0" && c <= "9";
    }

    function _take(Parser memory p, bytes1 c) private pure returns (bool) {
        if (p.pos < p.raw.length && p.raw[p.pos] == c) {
            ++p.pos;
            return true;
        }
        return false;
    }

    function _space(Parser memory p) private pure {
        while (p.pos < p.raw.length) {
            bytes1 c = p.raw[p.pos];
            if (c != " " && c != 0x09 && c != 0x0a && c != 0x0d) return;
            ++p.pos;
        }
    }
}
