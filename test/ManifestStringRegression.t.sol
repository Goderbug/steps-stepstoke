// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {TestBase} from "./TestBase.sol";
import {ManifestJSON} from "../src/libraries/ManifestJSON.sol";
import {StrictJSON as J} from "../src/libraries/StrictJSON.sol";
import {Text} from "../src/libraries/Text.sol";
import {Policy} from "../src/libraries/Policy.sol";

contract ManifestStringHarness {
    function field(bytes memory raw) external pure returns (string memory) {
        J.Token[] memory t = ManifestJSON.parse(raw);
        return J.stringAt(t, J.field(t, 0, "state"));
    }

    function referenceField(bytes memory raw) external pure returns (string memory) {
        J.Token[] memory t = J.parse(raw);
        return J.stringAt(t, J.field(t, 0, "state"));
    }
}

/// @dev Retained strings and decoded-key semantics must survive the gas-path replacement.
contract ManifestStringRegressionTest is TestBase {
    ManifestStringHarness private parser;

    function setUp() public {
        parser = new ManifestStringHarness();
    }

    function _raw(bytes memory text) private pure returns (bytes memory) {
        return bytes.concat('{"state":"', text, '"}');
    }

    function test_mixedRawEscapedScalarsAndSimpleEscapesDecodeExactly() public view {
        bytes memory input = bytes.concat(
            unicode"Aé水🚀",
            "\\u0000\\u007f\\u0080\\u07ff\\u0800\\ud7ff\\ue000",
            "\\uFFFD\\uD800\\uDC00\\uDBFF\\uDFFD",
            '\\b\\f\\n\\r\\t\\/\\\\\\"Z'
        );
        bytes memory raw = _raw(input);
        assertEq(parser.field(raw), parser.referenceField(raw));
    }

    function test_retainedInvalidUnicodeAndEscapesReject() public {
        bytes[25] memory invalid = [
            bytes(hex"80"),
            bytes(hex"c080"),
            bytes(hex"c1bf"),
            bytes(hex"c2"),
            bytes(hex"c220"),
            bytes(hex"e08080"),
            bytes(hex"eda080"),
            bytes(hex"efb790"),
            bytes(hex"efbfbe"),
            bytes(hex"efbfbf"),
            bytes(hex"f0808080"),
            bytes(hex"f4908080"),
            bytes(hex"f5808080"),
            bytes(hex"f09f92"),
            bytes(hex"f48fbfbe"),
            bytes(hex"f48fbfbf"),
            bytes("\\ud800"),
            bytes("\\udfff"),
            bytes("\\ud800\\u0041"),
            bytes("\\ufffe"),
            bytes("\\ufdef"),
            bytes("\\udbff\\udfff"),
            bytes("\\u00g0"),
            bytes("\\x20"),
            bytes("\\u123")
        ];
        for (uint256 i; i < invalid.length; ++i) {
            vm.expectRevert(Policy.Invalid.selector);
            parser.field(_raw(invalid[i]));
        }
        vm.expectRevert(Policy.Invalid.selector);
        parser.field(bytes('{"state":"unterminated'));
        vm.expectRevert(Policy.Invalid.selector);
        parser.field(bytes('{"state":"trailing\\'));
    }

    function test_rawAndEscapedUnicodeKeysStillDetectDuplicates() public {
        vm.expectRevert(Policy.Invalid.selector);
        parser.field(bytes(unicode'{"state":"ok","é":0,"\\u00e9":1}'));
        vm.expectRevert(Policy.Invalid.selector);
        parser.field(bytes('{"state":"ok","\\u0073tate":"other"}'));
    }

    function test_retainedDecodedByteLimitAccepts1024Rejects1025() public {
        bytes memory rawText = new bytes(1024);
        for (uint256 i; i < rawText.length; i += 2) {
            rawText[i] = 0xc3;
            rawText[i + 1] = 0xa9;
        }
        assertEq(bytes(parser.field(_raw(rawText))), rawText);
        vm.expectRevert(Policy.Limit.selector);
        parser.field(_raw(bytes.concat(rawText, "a")));
        bytes memory escaped;
        for (uint256 i; i < 256; ++i) {
            escaped = bytes.concat(escaped, "\\uD83D\\uDE80");
        }
        assertEq(bytes(parser.field(_raw(escaped))).length, 1024);
        vm.expectRevert(Policy.Limit.selector);
        parser.field(_raw(bytes.concat(escaped, "\\u0000")));
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_retainedQuotedAsciiMatchesReference(bytes32 entropy, uint8 length) public view {
        bytes memory text = new bytes(length);
        for (uint256 i; i < text.length; ++i) {
            text[i] = bytes1(uint8(entropy[i % 32]) & 127);
        }
        bytes memory raw = bytes.concat('{"state":', Text.quote(string(text)), "}");
        assertEq(parser.field(raw), string(text));
        assertEq(parser.field(raw), parser.referenceField(raw));
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_validScalarRawAndEscapeMatchReference(uint32 seed, uint8 copies) public view {
        uint256 scalar = uint256(seed) % 0x110000;
        if (
            (scalar >= 0xd800 && scalar <= 0xdfff) || (scalar >= 0xfdd0 && scalar <= 0xfdef)
                || (scalar & 0xffff) >= 0xfffe
        ) scalar = 0x20;
        bytes memory encoded;
        if (scalar < 0x80) {
            encoded = abi.encodePacked(bytes1(uint8(scalar)));
        } else if (scalar < 0x800) {
            encoded =
                abi.encodePacked(bytes1(uint8(0xc0 | (scalar >> 6))), bytes1(uint8(0x80 | (scalar & 63))));
        } else if (scalar < 0x10000) {
            encoded = abi.encodePacked(
                bytes1(uint8(0xe0 | (scalar >> 12))),
                bytes1(uint8(0x80 | ((scalar >> 6) & 63))),
                bytes1(uint8(0x80 | (scalar & 63)))
            );
        } else {
            encoded = abi.encodePacked(
                bytes1(uint8(0xf0 | (scalar >> 18))),
                bytes1(uint8(0x80 | ((scalar >> 12) & 63))),
                bytes1(uint8(0x80 | ((scalar >> 6) & 63))),
                bytes1(uint8(0x80 | (scalar & 63)))
            );
        }
        bytes memory escaped = scalar < 0x10000
            ? _u16(scalar)
            : bytes.concat(
                _u16(0xd800 + ((scalar - 0x10000) >> 10)), _u16(0xdc00 + ((scalar - 0x10000) & 1023))
            );
        bytes memory text;
        bytes memory escapedText;
        for (uint256 i; i < uint256(copies) % 12 + 1; ++i) {
            text = bytes.concat(text, encoded);
            escapedText = bytes.concat(escapedText, escaped);
        }
        bytes memory raw = bytes.concat('{"state":', Text.quote(string(text)), "}");
        bytes memory escapedRaw = _raw(escapedText);
        assertEq(bytes(parser.field(raw)), text);
        assertEq(parser.field(raw), parser.referenceField(raw));
        assertEq(parser.field(escapedRaw), parser.referenceField(escapedRaw));
        assertEq(parser.field(raw), parser.field(escapedRaw));
    }

    function _u16(uint256 code) private pure returns (bytes memory) {
        bytes16 alphabet = "0123456789abcdef";
        return abi.encodePacked(
            bytes2("\\u"),
            alphabet[(code >> 12) & 15],
            alphabet[(code >> 8) & 15],
            alphabet[(code >> 4) & 15],
            alphabet[code & 15]
        );
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_retainedArbitraryBytesMatchReference(bytes32 entropy, uint8 length) public view {
        bytes memory text = new bytes(uint256(length) % 33);
        for (uint256 i; i < text.length; ++i) {
            text[i] = entropy[i];
        }
        bytes memory raw = _raw(text);
        (bool actual, bytes memory decoded) = address(parser).staticcall(abi.encodeCall(parser.field, (raw)));
        (bool referenceOK, bytes memory referenceDecoded) =
            address(parser).staticcall(abi.encodeCall(parser.referenceField, (raw)));
        assertTrue(actual == referenceOK);
        if (actual) assertEq(decoded, referenceDecoded);
    }
}
