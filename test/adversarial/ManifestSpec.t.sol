// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SpecSetup, SpecData as D} from "./SpecSupport.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {RelayVerifier} from "src/RelayVerifier.sol";
import {Policy} from "src/libraries/Policy.sol";
import {StrictJSON as J} from "src/libraries/StrictJSON.sol";

contract SpecJSONHarness {
    function count(bytes memory raw) external pure returns (uint256) {
        return J.parse(raw).length;
    }

    function value(bytes memory raw) external pure returns (string memory) {
        J.Token[] memory tokens = J.parse(raw);
        return J.stringAt(tokens, J.field(tokens, 0, "value"));
    }
}

contract ManifestSpecTest is SpecSetup {
    SpecJSONHarness private parser;
    RelayVerifier private verifier;

    function setUp() public override {
        super.setUp();
        parser = new SpecJSONHarness();
        verifier = root.verifier();
    }

    function test_callbackDigestBindsWhitespaceAndKeyOrderOfOriginalBytes() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        bytes memory compact = D.manifest(p, "raw-job", "raw-project", D.document());
        bytes memory raw = bytes.concat("\r\n\t", compact, " \n");
        uint256 id = root.propose(p, empty());
        bytes32 oldAnchor = root.anchor();
        record(pay(root, id, empty(), ALICE), raw);
        vm.expectRevert(Policy.Invalid.selector);
        root.bind(compact, empty());
        bytes memory reordered = replace(
            raw, '"jobId":"raw-job","projectId":"raw-project"', '"projectId":"raw-project","jobId":"raw-job"'
        );
        vm.expectRevert(Policy.Invalid.selector);
        root.bind(reordered, empty());
        assertEq(root.anchor(), oldAnchor);
        assertEq(root.attempt(1).outcome, keccak256(raw));
        T.Asset[] memory expected =
            D.next(empty(), D.output(p, "raw-job", D.document(), raw, address(root), 1));
        bindAndCheck(root, raw, empty(), expected);
        assertEq(expected[0].fileHash, sha256(D.document()));
        assertTrue(expected[0].fileHash != keccak256(raw));
        assertAccounting(FEE, 0);
    }

    function test_sourceAndLaterGitMetadataNeverReplaceAcceptedFilesDescriptor() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        bytes memory raw = D.manifest(p, "metadata-job", "metadata-project", D.document());
        raw = replace(
            raw,
            '"source":[]',
            '"source":[{"name":"notes","path":"docs/notes.md","hash":"evil-source"}],'
            '"delivery":{"repoUrl":"https://untrusted.invalid/repo","commit":"newer-commit"},'
            '"publication":{"status":"published","url":"https://untrusted.invalid/site"}'
        );
        record(pay(root, root.propose(p, empty()), empty(), ALICE), raw);
        T.Asset[] memory expected =
            D.next(empty(), D.output(p, "metadata-job", D.document(), raw, address(root), 1));
        bindAndCheck(root, raw, empty(), expected);
        assertEq(expected[0].submissionHash, D.submission("metadata-job"));
        assertEq(expected[0].size, D.document().length);
        assertEq(expected[0].fileHash, sha256(D.document()));
        assertEq(expected[0].mediaType, "text/markdown");
        assertEq(expected[0].producer, address(root));
        assertEq(expected[0].jobId, "metadata-job");
        assertEq(expected[0].resultHash, keccak256(raw));
        assertEq(expected[0].revision, 1);
    }

    function test_manifestRejectionsKeepRecordedDigestAndOldHistory() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        bytes memory good = D.manifest(p, "manifest-job", "manifest-project", D.document());
        bytes[] memory bad = new bytes[](18);
        bad[0] = replace(good, '"state":"completed"', '"state":"blocked"');
        bad[1] = replace(good, '"jobId":"manifest-job"', '"jobId":null');
        bad[2] = replace(good, '"projectId":"manifest-project"', '"projectId":""');
        bad[3] = replace(good, '"name":"notes"', '"name":"undeclared"');
        bad[4] = replace(good, '"path":"docs/notes.md"', '"path":"dist/index.html"');
        bad[5] = replace(good, '"mediaType":"text/markdown"', '"mediaType":"text/plain"');
        bad[6] = replace(good, '"files"', '"sourceOnly"');
        bad[7] = replace(good, '"files":[{', '"files":[{"name":"notes"}, {');
        bad[8] = replace(good, '"name":"notes"', '"name":"notes","na\\u006de":"notes"');
        bad[9] = replace(good, '"state":"completed"', '"state":"completed","\\u0073tate":"completed"');
        bad[10] = replace(good, '"source":[]', '"source":[{"ignored":{"x":0,"\\u0078":1}}]');
        bad[11] = bytes.concat(good, "{}");
        bad[12] = bytes.concat(hex"efbbbf", good); // BOM is not JSON whitespace.
        bad[13] = replace(good, '"source":[]', bytes.concat('"source":["', hex"c080", '"]'));
        bad[14] = replace(good, '"source":[]', '"source":["\\ud800"]');
        bad[15] = replace(good, '"source":[]', '"source":["\\udfff"]');
        bad[16] = replace(good, '"source":[]', '"source":["\\uDBFF\\uDFFF"]'); // U+10FFFF noncharacter.
        bad[17] = replace(good, '"submissionHash"', '"missingSubmissionHash"');
        for (uint256 i; i < bad.length; ++i) {
            rejectRecorded(bad[i]);
        }
        assertEq(intake.count(), bad.length);
        assertAccounting(FEE * bad.length, 0);
    }

    function test_projectSwitchAndHistoricalJobReplayPreservePreviousCheckpoint() public {
        T.Asset[] memory old = accept(
            root,
            proposal(root, T.Profile.MarkdownCreate, 1),
            empty(),
            "old-job",
            "stable-project",
            D.document(),
            ALICE
        );
        T.Proposal memory p = proposal(root, T.Profile.MarkdownUpdate, 1);
        bytes memory switched = D.manifest(p, "new-job", "foreign-project", D.document());
        record(pay(root, root.propose(p, old), old, BOB), switched);
        bytes32 cp = root.anchor();
        vm.expectRevert(RelayBranch.IdentityMismatch.selector);
        root.bind(switched, old);
        assertEq(root.anchor(), cp);
        assertEq(root.latestJobId(), "old-job");
        assertEq(root.projectId(), "stable-project");
        assertEq(root.attempt(2).outcome, keccak256(switched));
        assertEq(uint256(root.phase()), uint256(T.Phase.ResultRecorded));

        RelayBranch other = factory.createProject("Replay regression.");
        approveBoth(other);
        old = accept(
            other,
            proposal(other, T.Profile.MarkdownCreate, 1),
            empty(),
            "job-first",
            "replay-project",
            D.document(),
            ALICE
        );
        old = accept(
            other,
            proposal(other, T.Profile.MarkdownUpdate, 1),
            old,
            "job-second",
            "replay-project",
            D.document(),
            BOB
        );
        p = proposal(other, T.Profile.MarkdownUpdate, 1);
        bytes memory replay =
            D.manifest(p, "job-first", "replay-project", bytes.concat(D.document(), "Changed."));
        record(pay(other, other.propose(p, old), old, ALICE), replay);
        cp = other.anchor();
        vm.expectRevert(RelayBranch.IdentityMismatch.selector);
        other.bind(replay, old);
        assertEq(other.anchor(), cp);
        assertEq(other.revision(), 2);
        assertEq(other.latestJobId(), "job-second");
    }

    function test_hashEncodingTypeWidthNonhexAndZeroAreCheckedForBothDigests() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        bytes memory raw = D.manifest(p, "hash-job", "hash-project", D.document());
        bytes memory fileHex = bytes(D.hex32(sha256(D.document())));
        bytes memory submissionHex = bytes(D.hex32(D.submission("hash-job")));
        bytes memory uppercase = bytes.concat("0x", fileHex);
        for (uint256 i = 2; i < uppercase.length; ++i) {
            if (uppercase[i] >= "a" && uppercase[i] <= "f") uppercase[i] = bytes1(uint8(uppercase[i]) - 32);
        }
        bytes memory alternate = replace(raw, fileHex, uppercase);
        alternate = replace(alternate, submissionHex, bytes.concat("0x", submissionHex));
        (,, T.Asset[] memory assets) =
            verifier.verify(alternate, keccak256(alternate), p, empty(), address(root), 1);
        assertEq(assets[0].fileHash, sha256(D.document()));
        assertEq(assets[0].submissionHash, D.submission("hash-job"));
        bytes[] memory invalid = new bytes[](9);
        invalid[0] = "";
        invalid[1] = D.repeat("a", 63);
        invalid[2] = D.repeat("a", 65);
        invalid[3] = D.repeat("a", 128);
        invalid[4] = D.repeat("g", 64);
        invalid[5] = D.repeat("0", 64);
        invalid[6] = bytes.concat("0x", D.repeat("0", 64));
        invalid[7] = bytes.concat("0z", fileHex);
        invalid[8] = bytes.concat("0X", fileHex);
        for (uint256 i; i < invalid.length; ++i) {
            bytes memory badFile = replace(raw, fileHex, invalid[i]);
            vm.expectRevert();
            verifier.verify(badFile, keccak256(badFile), p, empty(), address(root), 1);
            bytes memory badSubmission = replace(raw, submissionHex, invalid[i]);
            vm.expectRevert();
            verifier.verify(badSubmission, keccak256(badSubmission), p, empty(), address(root), 1);
        }
        bytes memory wrongType = replace(raw, bytes.concat('"', fileHex, '"'), "123");
        vm.expectRevert(Policy.Invalid.selector);
        verifier.verify(wrongType, keccak256(wrongType), p, empty(), address(root), 1);
    }

    function test_identityLengthDecodedFieldsAndEmptyAcceptedFiles() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        string memory job = string(D.repeat("j", 64));
        string memory project = string(D.repeat("p", 64));
        bytes memory raw = D.manifest(p, job, project, D.document());
        raw = replace(raw, '"state":"completed"', '"st\\u0061te":"co\\u006dpleted"');
        raw = replace(raw, '"path":"docs/notes.md"', '"path":"docs\\/notes.md"');
        (string memory decodedJob, string memory decodedProject, T.Asset[] memory assets) =
            verifier.verify(raw, keccak256(raw), p, empty(), address(root), 1);
        assertEq(decodedJob, job);
        assertEq(decodedProject, project);
        assertEq(assets[0].path, "docs/notes.md");
        bytes memory longJob = replace(raw, bytes(job), bytes.concat(bytes(job), "j"));
        vm.expectRevert(Policy.Limit.selector);
        verifier.verify(longJob, keccak256(longJob), p, empty(), address(root), 1);
        bytes memory longProject = replace(raw, bytes(project), bytes.concat(bytes(project), "p"));
        vm.expectRevert(Policy.Limit.selector);
        verifier.verify(longProject, keccak256(longProject), p, empty(), address(root), 1);
        // The valid output is present only in source[], never in accepted files[].
        bytes memory sourceOnly = replace(raw, '"source":[],"files"', '"files":[],"source"');
        vm.expectRevert(Policy.Invalid.selector);
        verifier.verify(sourceOnly, keccak256(sourceOnly), p, empty(), address(root), 1);
    }

    function test_exactManifestAndStringByteLimitsAcceptBoundaryRejectOneMore() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        bytes memory raw = D.manifest(p, "limit-job", "limit-project", D.document());
        raw = bytes.concat(raw, D.repeat(" ", Policy.MAX_MANIFEST - raw.length));
        assertEq(raw.length, Policy.MAX_MANIFEST);
        (,, T.Asset[] memory assets) = verifier.verify(raw, keccak256(raw), p, empty(), address(root), 1);
        assertEq(assets[0].fileHash, sha256(D.document()));
        bytes memory tooLong = bytes.concat(raw, " ");
        vm.expectRevert(Policy.Invalid.selector);
        verifier.verify(tooLong, keccak256(tooLong), p, empty(), address(root), 1);
        bytes memory atStringLimit = bytes.concat('{"value":"', D.repeat("x", 1024), '"}');
        assertEq(bytes(parser.value(atStringLimit)).length, 1024);
        vm.expectRevert(Policy.Limit.selector);
        parser.value(bytes.concat('{"value":"', D.repeat("x", 1025), '"}'));

        // 256 escaped surrogate pairs decode to exactly 1,024 UTF-8 bytes.
        bytes memory emoji;
        for (uint256 i; i < 256; ++i) {
            emoji = bytes.concat(emoji, "\\ud83d\\ude80");
        }
        assertEq(bytes(parser.value(bytes.concat('{"value":"', emoji, '"}'))).length, 1024);
        vm.expectRevert(Policy.Limit.selector);
        parser.value(bytes.concat('{"value":"', emoji, "\\ud83d\\ude80", '"}'));
    }

    function test_exactDepthMemberKeyAndTokenBoundaries() public {
        assertEq(parser.count('{"x":[[[[[[[0]]]]]]]}'), 10); // Scalar at depth 8.
        vm.expectRevert(Policy.Limit.selector);
        parser.count('{"x":[[[[[[[[0]]]]]]]]}');
        bytes memory object = "{";
        for (uint256 i; i < 32; ++i) {
            object = bytes.concat(object, i == 0 ? bytes("") : bytes(","), '"k', bytes(D.decimal(i)), '":0');
        }
        assertEq(parser.count(bytes.concat(object, "}")), 65);
        vm.expectRevert(Policy.Limit.selector);
        parser.count(bytes.concat(object, ',"extra":0}'));
        bytes memory array = '{"x":[';
        for (uint256 i; i < 32; ++i) {
            array = bytes.concat(array, i == 0 ? bytes("0") : bytes(",0"));
        }
        assertEq(parser.count(bytes.concat(array, "]}")), 35);
        vm.expectRevert(Policy.Limit.selector);
        parser.count(bytes.concat(array, ",0]}"));
        assertEq(parser.count(bytes.concat('{"', D.repeat("k", 64), '":0}')), 3);
        vm.expectRevert(Policy.Limit.selector);
        parser.count(bytes.concat('{"', D.repeat("k", 65), '":0}'));
        assertEq(parser.count(tokenBoundary(21)), 256);
        vm.expectRevert(Policy.Limit.selector);
        parser.count(tokenBoundary(22));
    }

    function test_fileSizeIntegerGrammarAndAllProfileDeclaredCaps() public {
        string[12] memory invalid = [
            "0",
            "-0",
            "-1",
            "1.0",
            "1e0",
            "01",
            "+1",
            "\"1\"",
            "true",
            "null",
            "4294967296",
            "9999999999999999999999999999999999999999999999999999999999999999"
        ];
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        bytes memory raw = D.manifest(p, "size-job", "size-project", D.document());
        bytes memory original = bytes.concat('"bytes":', bytes(D.decimal(D.document().length)));
        for (uint256 i; i < invalid.length; ++i) {
            bytes memory bad = replace(raw, original, bytes.concat('"bytes":', bytes(invalid[i])));
            vm.expectRevert();
            verifier.verify(bad, keccak256(bad), p, empty(), address(root), 1);
        }
        // These assertions test on-chain descriptor limits, not proof of file content.
        uint256[3] memory caps = [uint256(65_536), 2_097_152, 262_144];
        T.Profile[3] memory profiles = [T.Profile.MarkdownCreate, T.Profile.HTMLCreate, T.Profile.ImageCreate];
        for (uint256 i; i < 3; ++i) {
            p = proposal(root, profiles[i], 1);
            raw = D.manifest(p, "size-job", "size-project", D.document());
            raw = replace(raw, original, bytes.concat('"bytes":', bytes(D.decimal(caps[i]))));
            (,, T.Asset[] memory assets) = verifier.verify(raw, keccak256(raw), p, empty(), address(root), 1);
            assertEq(assets[0].size, caps[i]);
            bytes memory oversized = replace(
                raw,
                bytes.concat('"bytes":', bytes(D.decimal(caps[i]))),
                bytes.concat('"bytes":', bytes(D.decimal(caps[i] + 1)))
            );
            vm.expectRevert(Policy.Limit.selector);
            verifier.verify(oversized, keccak256(oversized), p, empty(), address(root), 1);
        }
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_unicodeScalarEscapesDecodeAndDuplicateKeysReject(uint32 seed) public {
        uint256 scalar = uint256(seed) % 0x110000;
        if (scalar >= 0xd800 && scalar <= 0xdfff) scalar = 0x61;
        if ((scalar >= 0xfdd0 && scalar <= 0xfdef) || (scalar & 0xffff) >= 0xfffe) scalar = 0x62;
        bytes memory decoded = utf8(scalar);
        bytes memory escaped = scalar < 0x10000
            ? u16(scalar)
            : bytes.concat(
                u16(0xd800 + ((scalar - 0x10000) >> 10)), u16(0xdc00 + ((scalar - 0x10000) & 1023))
            );
        assertEq(bytes(parser.value(bytes.concat('{"value":"', escaped, '"}'))), decoded);
        // Literal controls, quote and slash need JSON escaping in the alternate spelling.
        bytes memory alternate = scalar < 32 || scalar == 34 || scalar == 92 ? escaped : decoded;
        assertEq(bytes(parser.value(bytes.concat('{"value":"', alternate, '"}'))), decoded);
        vm.expectRevert(Policy.Invalid.selector);
        parser.count(bytes.concat('{"metadata":{"', escaped, '":0,"', alternate, '":1}}'));
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_nonWhitespaceTrailingByteAlwaysRejected(uint8 value) public {
        if (value == 32 || value == 9 || value == 10 || value == 13) value = 0;
        vm.expectRevert(Policy.Invalid.selector);
        parser.count(bytes.concat('{"x":0}', bytes1(value)));
    }

    function rejectRecorded(bytes memory raw) private {
        RelayBranch b = factory.createProject("Manifest rejection must preserve receipt.");
        approveBoth(b);
        T.Proposal memory p = proposal(b, T.Profile.MarkdownCreate, 1);
        uint256 id = b.propose(p, empty());
        bytes32 cp = b.anchor();
        record(pay(b, id, empty(), ALICE), raw);
        vm.expectRevert();
        b.bind(raw, empty());
        assertEq(b.anchor(), cp);
        assertEq(b.revision(), 0);
        assertEq(b.assetsHash(), keccak256(abi.encode(empty())));
        assertEq(b.attempt(1).outcome, keccak256(raw));
        assertEq(uint256(b.phase()), uint256(T.Phase.ResultRecorded));
        assertEq(token.allowance(address(b), INTAKE), 0);
        assertEq(token.balanceOf(address(b)), 0);
    }

    function tokenBoundary(uint256 lastItems) private pure returns (bytes memory raw) {
        raw = '{"x":[';
        for (uint256 i; i < 8; ++i) {
            raw = bytes.concat(raw, i == 0 ? bytes("[") : bytes(",["));
            uint256 n = i == 7 ? lastItems : 32;
            for (uint256 j; j < n; ++j) {
                raw = bytes.concat(raw, j == 0 ? bytes("0") : bytes(",0"));
            }
            raw = bytes.concat(raw, "]");
        }
        return bytes.concat(raw, "]}");
    }

    function u16(uint256 scalar) private pure returns (bytes memory out) {
        bytes16 alphabet = "0123456789abcdef";
        out = "\\u0000";
        for (uint256 i; i < 4; ++i) {
            out[5 - i] = alphabet[scalar & 15];
            scalar >>= 4;
        }
    }

    function utf8(uint256 c) private pure returns (bytes memory) {
        if (c < 128) return abi.encodePacked(uint8(c));
        if (c < 2048) return abi.encodePacked(uint8(0xc0 | (c >> 6)), uint8(0x80 | (c & 63)));
        if (c < 65536) {
            return
                abi.encodePacked(
                    uint8(0xe0 | (c >> 12)), uint8(0x80 | ((c >> 6) & 63)), uint8(0x80 | (c & 63))
                );
        }
        return abi.encodePacked(
            uint8(0xf0 | (c >> 18)),
            uint8(0x80 | ((c >> 12) & 63)),
            uint8(0x80 | ((c >> 6) & 63)),
            uint8(0x80 | (c & 63))
        );
    }
}
