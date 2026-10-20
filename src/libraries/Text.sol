// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Policy} from "./Policy.sol";

library Text {
    bytes16 private constant HEX = "0123456789abcdef";

    function equal(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    /// @dev Strict scalar UTF-8: rejects overlong encodings, surrogates, noncharacters and > U+10FFFF.
    function utf8(bytes memory s) internal pure {
        uint256 i;
        while (i < s.length) {
            uint256 c = uint8(s[i++]);
            if (c < 0x80) continue;
            uint256 n;
            uint256 minimum;
            if (c >= 0xc2 && c <= 0xdf) {
                n = 1;
                minimum = 0x80;
                c &= 0x1f;
            } else if (c >= 0xe0 && c <= 0xef) {
                n = 2;
                minimum = 0x800;
                c &= 0x0f;
            } else if (c >= 0xf0 && c <= 0xf4) {
                n = 3;
                minimum = 0x10000;
                c &= 7;
            } else {
                revert Policy.Invalid();
            }
            if (i + n > s.length) revert Policy.Invalid();
            for (uint256 j; j < n; ++j) {
                uint256 d = uint8(s[i++]);
                if (d < 0x80 || d > 0xbf) revert Policy.Invalid();
                c = (c << 6) | (d & 0x3f);
            }
            if (
                c < minimum || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff) || (c >= 0xfdd0 && c <= 0xfdef)
                    || (c & 0xffff) >= 0xfffe
            ) revert Policy.Invalid();
        }
    }

    function bounded(string memory s, uint256 max) internal pure {
        bytes memory b = bytes(s);
        if (b.length == 0 || b.length > max) revert Policy.Limit();
        utf8(b);
        for (uint256 i; i < b.length; ++i) {
            uint8 c = uint8(b[i]);
            if (c < 32 && c != 10 && c != 9) revert Policy.Invalid();
            if (c == 127) revert Policy.Invalid();
        }
    }

    function identifier(string memory s, uint256 max) internal pure {
        bytes memory b = bytes(s);
        if (b.length == 0 || b.length > max) revert Policy.Limit();
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (
                !(c >= "a" && c <= "z") && !(c >= "A" && c <= "Z") && !(c >= "0" && c <= "9") && c != "-"
                    && c != "_"
            ) revert Policy.Invalid();
        }
    }

    /// @dev Portable relative ASCII paths. No dot segments, hidden components, escapes, spaces or URLs.
    function path(string memory s) internal pure {
        bytes memory b = bytes(s);
        if (b.length == 0 || b.length > 128) revert Policy.Limit();
        bool start = true;
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            if (c == "/") {
                if (start) revert Policy.Invalid();
                start = true;
            } else {
                if (start && c == ".") revert Policy.Invalid();
                if (
                    !(c >= "a" && c <= "z") && !(c >= "A" && c <= "Z") && !(c >= "0" && c <= "9") && c != "-"
                        && c != "_" && c != "."
                ) revert Policy.Invalid();
                start = false;
            }
        }
        if (start || b[b.length - 1] == ".") revert Policy.Invalid();
    }

    function suffix(string memory s, string memory end) internal pure returns (bool) {
        bytes memory b = bytes(s);
        bytes memory e = bytes(end);
        if (b.length < e.length) return false;
        for (uint256 i; i < e.length; ++i) {
            if (b[b.length - e.length + i] != e[i]) return false;
        }
        return true;
    }

    function quote(string memory s) internal pure returns (bytes memory out) {
        bytes memory b = bytes(s);
        out = new bytes(b.length * 6 + 2);
        uint256 n;
        out[n++] = '"';
        for (uint256 i; i < b.length; ++i) {
            uint8 c = uint8(b[i]);
            if (c == 34 || c == 92) {
                out[n++] = "\\";
                out[n++] = b[i];
            } else if (c < 32) {
                out[n++] = "\\";
                out[n++] = "u";
                out[n++] = "0";
                out[n++] = "0";
                out[n++] = HEX[c >> 4];
                out[n++] = HEX[c & 15];
            } else {
                out[n++] = b[i];
            }
        }
        out[n++] = '"';
        assembly ("memory-safe") {
            mstore(out, n)
        }
    }

    function hex32(bytes32 h) internal pure returns (string memory) {
        bytes memory out = new bytes(64);
        for (uint256 i; i < 32; ++i) {
            out[2 * i] = HEX[uint8(h[i]) >> 4];
            out[2 * i + 1] = HEX[uint8(h[i]) & 15];
        }
        return string(out);
    }

    function unhex32(string memory s) internal pure returns (bytes32 h) {
        bytes memory b = bytes(s);
        uint256 offset;
        if (b.length == 66 && b[0] == "0" && b[1] == "x") offset = 2;
        else if (b.length != 64) revert Policy.Invalid();
        uint256 v;
        for (uint256 i = offset; i < b.length; ++i) {
            v = (v << 4) | nibble(b[i]);
        }
        h = bytes32(v);
        if (h == 0) revert Policy.Invalid();
    }

    function nibble(bytes1 c) internal pure returns (uint8) {
        if (c >= "0" && c <= "9") return uint8(c) - 48;
        if (c >= "a" && c <= "f") return uint8(c) - 87;
        if (c >= "A" && c <= "F") return uint8(c) - 55;
        revert Policy.Invalid();
    }

    function decimal(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 n = v;
        uint256 count;
        while (n != 0) {
            ++count;
            n /= 10;
        }
        bytes memory b = new bytes(count);
        while (v != 0) {
            b[--count] = bytes1(uint8(48 + v % 10));
            v /= 10;
        }
        return string(b);
    }
}
