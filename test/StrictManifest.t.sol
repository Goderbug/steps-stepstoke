// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {TestBase} from "./TestBase.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {RelayVerifier} from "../src/RelayVerifier.sol";
import {StrictJSON as J} from "../src/libraries/StrictJSON.sol";
import {Text} from "../src/libraries/Text.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";

contract JSONHarness {
    function parse(bytes memory raw) external pure returns (uint256) {
        return J.parse(raw).length;
    }

    function field(bytes memory raw, string memory key) external pure returns (string memory) {
        J.Token[] memory t = J.parse(raw);
        return J.stringAt(t, J.field(t, 0, key));
    }
}

contract StrictManifestTest is TestBase {
    JSONHarness private parser;
    RelayVerifier private verifier;

    function setUp() public {
        parser = new JSONHarness();
        verifier = new RelayVerifier();
    }

    function _proposal() private pure returns (T.Proposal memory p) {
        p.target = bytes32(uint256(1));
        p.profile = T.Profile.MarkdownCreate;
        p.outputName = "main";
        p.outputPath = "artifacts/main.md";
    }

    function _verify(bytes memory raw) private view returns (T.Asset[] memory a) {
        (,, a) = verifier.verify(raw, keccak256(raw), _proposal(), new T.Asset[](0), address(this), 1);
    }

    function _reject(bytes memory raw) private {
        vm.expectRevert();
        verifier.verify(raw, keccak256(raw), _proposal(), new T.Asset[](0), address(this), 1);
    }

    function test_actualFileHashesAndManifestKeccakAreDistinct() public view {
        T.Asset[] memory a = _verify(F.documentResult());
        assertEq(a[0].fileHash, sha256(F.document()));
        assertEq(a[0].size, F.document().length);
        assertEq(a[0].resultHash, keccak256(F.documentResult()));
        assertTrue(a[0].fileHash != a[0].resultHash);
        assertEq(a[0].name, "main");
        assertEq(a[0].path, "artifacts/main.md");
        assertEq(a[0].mediaType, "text/markdown");
    }

    function test_whitespaceIsLegalButDigestIsOverExactRawBytes() public {
        bytes memory spaced = bytes.concat(" \n", F.documentResult(), "\t\r\n");
        T.Asset[] memory a = _verify(spaced);
        assertEq(a[0].fileHash, sha256(F.document()));
        vm.expectRevert(Policy.Invalid.selector);
        verifier.verify(
            spaced, keccak256(F.documentResult()), _proposal(), new T.Asset[](0), address(this), 1
        );
    }

    function test_onlyDeclaredFilesNotSourceOrGitMetadataSupplyAcceptedFile() public {
        bytes memory raw = replace(
            F.documentResult(),
            '"source":[]',
            '"source":[{"name":"main","path":"artifacts/main.md","hash":"untrusted-source-not-an-output"}]'
        );
        T.Asset[] memory a = _verify(raw);
        assertEq(a[0].fileHash, sha256(F.document()));
        raw = replace(F.documentResult(), '"files"', '"onlySource"');
        _reject(raw);
        raw = replace(F.documentResult(), '"name":"main"', '"name":"undeclared"');
        _reject(raw);
    }

    function test_rejectDuplicateKeysIncludingDecodedEscapesAtEveryDepth() public {
        _reject(replace(F.documentResult(), '"state":"completed"', '"state":"completed","state":"blocked"'));
        _reject(
            replace(
                F.documentResult(), '"state":"completed"', '"state":"completed","st\\u0061te":"completed"'
            )
        );
        _reject(replace(F.documentResult(), '"name":"main"', '"name":"main","\\u006eame":"main"'));
        _reject(replace(F.documentResult(), '"source":[]', '"source":[{"x":1,"\\u0078":2}]'));
        _reject(replace(F.documentResult(), '"source":[]', '"source":[{"x":{"a":1,"a":2}}]'));
    }

    function test_rejectTrailingAndMalformedJSON() public {
        bytes[] memory bad = new bytes[](12);
        bad[0] = bytes.concat(F.documentResult(), "{}");
        bad[1] = '{"x":01}';
        bad[2] = '{"x":1.}';
        bad[3] = '{"x":1e}';
        bad[4] = '{"x":+1}';
        bad[5] = '{"x":truee}';
        bad[6] = '{"x":null,}';
        bad[7] = '{"x":[1,]}';
        bad[8] = '{"x":"unterminated}';
        bad[9] = '{"x":"bad\\xescape"}';
        bad[10] = '{"x":"raw\nnewline"}';
        bad[11] = "[]";
        for (uint256 i; i < bad.length; ++i) {
            vm.expectRevert();
            parser.parse(bad[i]);
        }
    }

    function test_rejectInvalidUTF8UnicodeSurrogatesAndNoncharacters() public {
        bytes[] memory invalid = new bytes[](12);
        invalid[0] = hex"c080"; // Overlong NUL.
        invalid[1] = hex"eda080"; // Raw surrogate.
        invalid[2] = hex"f4908080"; // Above U+10FFFF.
        invalid[3] = hex"e282"; // Truncated sequence.
        invalid[4] = hex"80"; // Stray continuation.
        invalid[5] = hex"f880808080"; // Invalid width.
        invalid[6] = bytes("\\ud800");
        invalid[7] = bytes("\\udc00");
        invalid[8] = bytes("\\ud800\\u0041");
        invalid[9] = bytes("\\uffff");
        invalid[10] = bytes("\\ufdd0");
        invalid[11] = hex"efbfbe";
        for (uint256 i; i < invalid.length; ++i) {
            vm.expectRevert();
            parser.parse(bytes.concat('{"x":"', invalid[i], '"}'));
        }
    }

    function test_validUTF8EscapesAndSurrogatePairsDecodeExactly() public view {
        assertEq(parser.field('{"x":"caf\\u00e9 \\ud83d\\ude80"}', "x"), unicode"café 🚀");
        assertEq(parser.field(bytes(unicode'{"x":"café 🚀"}'), "x"), unicode"café 🚀");
        assertEq(parser.field('{"\\u0078":"quote\\\" slash\\/ tab\\t"}', "x"), "quote\" slash/ tab\t");
        assertTrue(parser.parse('{"x":-1.25e+3,"y":null,"z":[true,false]}') != 0);
        T.Asset[] memory a =
            _verify(replace(F.documentResult(), '"state":"completed"', '"st\\u0061te":"co\\u006dpleted"'));
        assertEq(a[0].fileHash, sha256(F.document()));
    }

    function test_rejectIncompleteWrongIdentityTypesAndWrongFileTypes() public {
        _reject(replace(F.documentResult(), '"completed"', '"blocked"'));
        _reject(replace(F.documentResult(), '"completed"', "true"));
        _reject(replace(F.documentResult(), '"jobId"', '"missingJob"'));
        _reject(replace(F.documentResult(), '"projectId"', '"missingProject"'));
        _reject(replace(F.documentResult(), bytes(F.project()), ""));
        _reject(replace(F.documentResult(), '"mediaType":"text/markdown"', '"mediaType":"text/html"'));
        _reject(replace(F.documentResult(), '"submissionHash"', '"missingSubmissionHash"'));
        _reject(replace(F.documentResult(), '"hash"', '"missingHash"'));
        _reject(replace(F.documentResult(), '"bytes"', '"missingBytes"'));
    }

    function test_rejectPathsTraversalHiddenURLAbsoluteAndDecodedControl() public {
        string[10] memory bad = [
            "../main.md",
            "/main.md",
            "artifacts/../main.md",
            "artifacts//main.md",
            "artifacts/.hidden.md",
            "https://host/main.md",
            "artifacts/main.md/",
            "docs\\\\main.md",
            "artifacts/\\u002e\\u002e/main.md",
            "artifacts/main\\u0000.md"
        ];
        for (uint256 i; i < bad.length; ++i) {
            _reject(replace(F.documentResult(), "artifacts/main.md", bytes(bad[i])));
        }
    }

    function test_rejectZeroOversizedNonIntegerAndStringFileBytes() public {
        bytes memory original = bytes.concat('"bytes":', bytes(Text.decimal(F.document().length)));
        string[8] memory bad = ["0", "65537", "-1", "1.0", "1e0", "\"31\"", "4294967296", "null"];
        for (uint256 i; i < bad.length; ++i) {
            _reject(replace(F.documentResult(), original, bytes.concat('"bytes":', bytes(bad[i]))));
        }
    }

    function test_rejectEmptyOrMalformedExtraFileEntries() public {
        bytes memory raw = F.documentResult();
        _reject(replace(raw, '"files":[{', '"files":[{}, {'));
        _reject(replace(raw, '"files":[{', '"files":[null, {'));
        _reject(replace(raw, '"files":[{', '"files":{"ignored":[{'));
    }

    function test_parserBoundsManifestStringDepthMembersAndTokens() public {
        bytes memory oversized = new bytes(Policy.MAX_MANIFEST + 1);
        vm.expectRevert(Policy.Limit.selector);
        parser.parse(oversized);
        bytes memory s = new bytes(1025);
        for (uint256 i; i < s.length; ++i) {
            s[i] = "x";
        }
        vm.expectRevert(Policy.Limit.selector);
        parser.parse(bytes.concat('{"x":"', s, '"}'));
        vm.expectRevert(Policy.Limit.selector);
        parser.parse('{"x":[[[[[[[[[1]]]]]]]]]}');
        bytes memory object = "{";
        for (uint256 i; i < 33; ++i) {
            object = bytes.concat(object, i == 0 ? bytes("") : bytes(","), Text.quote(Text.decimal(i)), ":0");
        }
        vm.expectRevert(Policy.Limit.selector);
        parser.parse(bytes.concat(object, "}"));
        // Width at each level is legal, but the global token count is not.
        bytes memory many = '{"x":[';
        for (uint256 i; i < 32; ++i) {
            many = bytes.concat(many, i == 0 ? bytes("") : bytes(","), '{"a":0,"b":1,"c":2,"d":3}');
        }
        vm.expectRevert(Policy.Limit.selector);
        parser.parse(bytes.concat(many, "]}"));
    }

    function test_boundedLargeManifestMeasurement() public {
        bytes memory padding = new bytes(225);
        for (uint256 i; i < padding.length; ++i) {
            padding[i] = "a";
        }
        bytes memory extra = '"source":[';
        for (uint256 i; i < 32; ++i) {
            extra = bytes.concat(extra, i == 0 ? bytes("") : bytes(","), '"', padding, '"');
        }
        bytes memory raw = replace(F.documentResult(), '"source":[]', bytes.concat(extra, "]"));
        assertTrue(raw.length <= Policy.MAX_MANIFEST);
        uint256 start = gasleft();
        _verify(raw);
        uint256 used = start - gasleft();
        emit Metric("large manifest raw bytes", raw.length);
        emit Metric("large manifest verify gas", used);
        assertTrue(used < 15_000_000);
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_asciiJSONQuoteDecodeRoundTrip(bytes32 entropy, uint8 length) public view {
        bytes memory s = new bytes(length);
        for (uint256 i; i < s.length; ++i) {
            s[i] = bytes1(uint8(entropy[i % 32]) & 127);
        }
        assertEq(parser.field(bytes.concat('{"x":', Text.quote(string(s)), "}"), "x"), string(s));
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_decodedDuplicateKeyAlwaysRejected(uint8 letter) public {
        bytes1 c = bytes1(uint8(97 + uint256(letter) % 26));
        bytes16 hexChars = "0123456789abcdef";
        bytes memory raw =
            bytes.concat('{"', c, '":1,"\\u00', hexChars[uint8(c) >> 4], hexChars[uint8(c) & 15], '":2}');
        vm.expectRevert(Policy.Invalid.selector);
        parser.parse(raw);
    }
}
