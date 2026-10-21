// SPDX-License-Identifier: MIT
// Independent review: compare metadata scan acceptance with the original strict JSON parser.
// Inputs remain within the original resource envelope so only lexical/Unicode behavior is compared.
pragma solidity 0.8.26;
import {ManifestJSON as M} from "../src/libraries/ManifestJSON.sol";
import {StrictJSON as J} from "../src/libraries/StrictJSON.sol";

contract MetadataScannerDifferentialTest {
    function original(bytes memory raw) external pure returns (bool) {
        J.parse(raw);
        return true;
    }

    function updated(bytes memory raw) external pure returns (bool) {
        M.parse(raw);
        return true;
    }

    function originalRetained(bytes memory raw) external pure returns (bytes32) {
        J.Token[] memory tokens = J.parse(raw);
        return keccak256(bytes(J.stringAt(tokens, J.field(tokens, 0, "state"))));
    }

    function updatedRetained(bytes memory raw) external pure returns (bytes32) {
        J.Token[] memory tokens = M.parse(raw);
        return keccak256(bytes(J.stringAt(tokens, J.field(tokens, 0, "state"))));
    }

    function compare(bytes memory content) public {
        bytes memory raw = bytes.concat('{"metadata":"', content, '"}');
        (bool a,) = address(this).call(abi.encodeCall(this.original, (raw)));
        (bool b,) = address(this).call(abi.encodeCall(this.updated, (raw)));
        require(a == b, "strict metadata scanner mismatch");
        raw = bytes.concat('{"state":"', content, '"}');
        (bool c, bytes memory oldValue) = address(this).call(abi.encodeCall(this.originalRetained, (raw)));
        (bool d, bytes memory newValue) = address(this).call(abi.encodeCall(this.updatedRetained, (raw)));
        require(c == d, "retained string scanner mismatch");
        if (c) require(keccak256(oldValue) == keccak256(newValue), "retained string decode mismatch");
    }

    function testFuzz_ArbitraryRawString(bytes32 a, bytes32 b) public {
        compare(bytes.concat(a, b));
    }

    function testFuzz_UnicodeEscape(uint16 a, uint16 b) public {
        bytes16 h = "0123456789abcdef";
        bytes memory out = new bytes(12);
        out[0] = "\\";
        out[1] = "u";
        out[6] = "\\";
        out[7] = "u";
        for (uint256 i; i < 4; ++i) {
            out[2 + i] = h[(a >> ((3 - i) * 4)) & 15];
            out[8 + i] = h[(b >> ((3 - i) * 4)) & 15];
        }
        compare(out);
    }

    function testFuzz_RawUnicode(uint32 scalar) public {
        scalar = scalar % 0x110000;
        bytes memory s;
        if (scalar < 0x80) {
            s = abi.encodePacked(uint8(scalar));
        } else if (scalar < 0x800) {
            s = abi.encodePacked(uint8(0xc0 | (scalar >> 6)), uint8(0x80 | (scalar & 63)));
        } else if (scalar < 0x10000) {
            s = abi.encodePacked(
                uint8(0xe0 | (scalar >> 12)), uint8(0x80 | ((scalar >> 6) & 63)), uint8(0x80 | (scalar & 63))
            );
        } else {
            s = abi.encodePacked(
                uint8(0xf0 | (scalar >> 18)),
                uint8(0x80 | ((scalar >> 12) & 63)),
                uint8(0x80 | ((scalar >> 6) & 63)),
                uint8(0x80 | (scalar & 63))
            );
        }
        compare(s);
    }

    function test_MixedRawAndEscapedUnicode() public {
        compare(bytes.concat(hex"e4b8ad", bytes("\\u6587"), hex"f09f9a80"));
        compare(bytes.concat(bytes("\\uD83D\\uDE80"), hex"e4b8ad", bytes("\\u0061")));
        compare(bytes.concat(hex"e4", bytes("\\u00B8"), hex"ad"));
        compare(bytes.concat(hex"f09f", bytes("\\u0080"), hex"80"));
        compare(bytes.concat(bytes("\\u0080"), hex"80"));
        compare(bytes.concat(bytes("\\u0061"), hex"eda080"));
    }

    function test_RetainedASCIICopyAtWordBoundaries() public {
        uint256[12] memory lengths = [uint256(1), 31, 32, 33, 63, 64, 65, 255, 256, 257, 1023, 1024];
        for (uint256 i; i < lengths.length; ++i) {
            bytes memory value = new bytes(lengths[i]);
            for (uint256 j; j < value.length; ++j) {
                value[j] = bytes1(uint8(65 + j % 26));
            }
            compare(value);
        }
    }

    function test_ControlsInvalidHexAndSurrogates() public {
        compare(hex"c080");
        compare(hex"edb080");
        compare(hex"f4908080");
        compare(hex"f48fbfbf");
        compare(bytes("\\uD800"));
        compare(bytes("\\uDC00"));
        compare(bytes("\\uD800\\uDC00"));
        compare(bytes("\\uDBFF\\uDFFD"));
        compare(bytes("\\uDBFF\\uDFFF"));
        compare(bytes("\\u12g4"));
        compare(bytes("\\u12:4"));
        compare(bytes("\\u12@4"));
        compare(bytes("\\u12`4"));
        compare(bytes("\\u12{4"));
        compare(bytes("\\uFFFF"));
        compare(bytes("\\uFDEF"));
        compare(bytes("\\uFDF0"));
    }
}
