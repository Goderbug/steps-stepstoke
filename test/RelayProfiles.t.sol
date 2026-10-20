// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "./RelaySetup.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {RelayEncoder} from "../src/RelayEncoder.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {Text} from "../src/libraries/Text.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";

contract RelayProfilesTest is RelaySetup {
    function _table(uint256 count) private pure returns (T.Asset[] memory a) {
        a = new T.Asset[](count);
        for (uint256 i; i < count; ++i) {
            a[i] = T.Asset(
                bytes32(i + 1),
                T.Kind.Markdown,
                "main",
                "docs/main.md",
                sha256(F.document()),
                "text/markdown",
                uint32(F.document().length),
                sha256("local-submission"),
                address(0xBEEF),
                "fixture-job",
                keccak256(F.documentResult()),
                1
            );
        }
    }

    function _kind(T.Asset memory a, T.Kind k) private pure returns (T.Asset memory) {
        a.kind = k;
        a.mediaType = Policy.mime(k);
        a.name = k == T.Kind.HTML ? "site" : "illustration";
        a.path = k == T.Kind.HTML ? "dist/index.html" : "assets/illustration.png";
        return a;
    }

    function test_publishDisabledAndOutputMappingFixedBeforePayment() public {
        T.Proposal memory p = _proposal(branch, T.Profile.HTMLCreate, 1);
        p.publish = true;
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
        p.publish = false;
        p.outputPath = "website/index.html";
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
        p = _proposal(branch, T.Profile.ImageCreate, 1);
        p.outputPath = "image.svg";
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
        assertEq(token.transferCalls(), 0);
        assertEq(intake.count(), 0);
    }

    function test_updateTargetMandatoryCreateCannotOverwriteAndRenameDisabled() public {
        T.Asset[] memory current = _document();
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        p.inputs = new bytes32[](0);
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p = _proposal(branch, T.Profile.MarkdownUpdate, 2);
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        p.outputName = "renamed";
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p = _proposal(branch, T.Profile.HTMLUpdate, 1);
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        assertEq(intake.count(), 1);
    }

    function test_selectedInputsMustBeCurrentSortedUniqueAndWithinEight() public {
        T.Asset[] memory first = _document();
        T.Asset[] memory current =
            _accept(branch, _proposal(branch, T.Profile.ImageCreate, 2), first, F.imageSecondResult());
        T.Proposal memory p = _proposal(branch, T.Profile.HTMLCreate, 3);
        p.inputs = new bytes32[](1);
        p.inputs[0] = bytes32(uint256(9));
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p.inputs = new bytes32[](2);
        p.inputs[0] = bytes32(uint256(2));
        p.inputs[1] = bytes32(uint256(1));
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p.inputs[1] = bytes32(uint256(2));
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p.inputs = new bytes32[](9);
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p.inputs = new bytes32[](1);
        p.inputs[0] = bytes32(uint256(1));
        uint256 id = branch.propose(p, current);
        (, bytes memory body) = branch.bodyOf(id, current);
        assertTrue(contains(body, bytes(Text.hex32(current[0].fileHash))));
        assertFalse(contains(body, bytes(Text.hex32(current[1].fileHash))));
        assertTrue(contains(body, '"github":true,"ipfs":false'));
        current[0].fileHash = sha256("unaccepted replacement");
        vm.expectRevert(RelayBranch.InvalidWitness.selector);
        branch.sponsor(id, PRICE, current);
        assertEq(intake.count(), 2);
    }

    function test_imageReferencesAndMarkdownImageInputsDisabled() public {
        T.Asset[] memory current =
            _accept(branch, _proposal(branch, T.Profile.ImageCreate, 1), _empty(), F.imageSecondResult());
        T.Proposal memory p = _proposal(branch, T.Profile.ImageCreate, 2);
        p.inputs = new bytes32[](1);
        p.inputs[0] = bytes32(uint256(1));
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        p.profile = T.Profile.MarkdownCreate;
        p.outputName = "main";
        p.outputPath = "docs/main.md";
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
    }

    function test_reserveEachEnabledTypeAndExistingSlotsUpdatableAtCapacity() public {
        RelayEncoder encoder = factory.encoder();
        T.Asset[] memory current = _table(14);
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 15);
        vm.expectRevert(Policy.Limit.selector);
        encoder.encode("Goal", "", "", p, current);
        p = _proposal(branch, T.Profile.HTMLCreate, 15);
        encoder.encode("Goal", "", "", p, current);
        current = _table(16);
        current[14] = _kind(current[14], T.Kind.HTML);
        current[15] = _kind(current[15], T.Kind.Image);
        p = _proposal(branch, T.Profile.MarkdownCreate, 17);
        vm.expectRevert(Policy.Limit.selector);
        encoder.encode("Goal", "", "own-job", p, current);
        p = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        encoder.encode("Goal", "", "own-job", p, current);
        p = _proposal(branch, T.Profile.HTMLUpdate, 15);
        encoder.encode("Goal", "", "own-job", p, current);
    }

    function test_capacityEndToEndSixteenAssetsThenUpdate() public {
        T.Asset[] memory current = _empty();
        for (uint256 i = 1; i <= 16; ++i) {
            T.Profile profile =
                i <= 14 ? T.Profile.MarkdownCreate : i == 15 ? T.Profile.HTMLCreate : T.Profile.ImageCreate;
            current = _accept(
                branch,
                _proposal(branch, profile, i),
                current,
                _manifest(string.concat("capacity-job-", Text.decimal(i)), Policy.kind(profile), 32)
            );
        }
        assertEq(current.length, 16);
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 17);
        vm.expectRevert(Policy.Limit.selector);
        branch.propose(p, current);
        bytes32 lastAsset = keccak256(abi.encode(current[15]));
        uint256 start = gasleft();
        current = _accept(
            branch,
            _proposal(branch, T.Profile.MarkdownUpdate, 1),
            current,
            _manifest("capacity-job-17", T.Kind.Markdown, 42)
        );
        emit Metric("capacity round proposal purchase callback bind gas", start - gasleft());
        assertEq(current.length, 16);
        assertEq(keccak256(abi.encode(current[15])), lastAsset);
        assertEq(branch.revision(), 17);
        assertEq(current[0].size, 42);
    }

    function test_htmlImagesPerFileAggregateAndBase64OverheadBounds() public {
        RelayEncoder encoder = factory.encoder();
        T.Asset[] memory current = _table(4);
        for (uint256 i; i < 3; ++i) {
            current[i] = _kind(current[i], T.Kind.Image);
            current[i].size = 262_144;
        }
        current[3] = _kind(current[3], T.Kind.HTML);
        T.Proposal memory p = _proposal(branch, T.Profile.HTMLUpdate, 4);
        p.inputs = new bytes32[](4);
        for (uint256 i; i < 4; ++i) {
            p.inputs[i] = bytes32(i + 1);
        }
        vm.expectRevert(Policy.Limit.selector);
        encoder.encode("Goal", "", "latest-job", p, current);
        p.inputs = new bytes32[](3);
        p.inputs[0] = bytes32(uint256(1));
        p.inputs[1] = bytes32(uint256(2));
        p.inputs[2] = bytes32(uint256(4));
        encoder.encode("Goal", "", "latest-job", p, current); // Exactly 512 KiB selected images.
        current[3].size = 2_097_152 - 524_288;
        vm.expectRevert(Policy.Limit.selector); // Raw bytes would fit, encoded Base64 does not.
        encoder.encode("Goal", "", "latest-job", p, current);
        current[3].size = 32;
        current[0].size = 262_145;
        vm.expectRevert(Policy.Invalid.selector);
        encoder.encode("Goal", "", "latest-job", p, current);
    }

    function test_requestBodyUTF8ByteLimitCheckedBeforePayment() public {
        RelayEncoder encoder = factory.encoder();
        T.Asset[] memory current = _table(8);
        bytes memory tabs = new bytes(512);
        for (uint256 i; i < tabs.length; ++i) {
            tabs[i] = 0x09;
        }
        T.Proposal memory p = _proposal(branch, T.Profile.HTMLCreate, 9);
        p.text = string(bytes.concat(tabs, tabs));
        p.inputs = new bytes32[](8);
        for (uint256 i; i < 8; ++i) {
            p.inputs[i] = bytes32(i + 1);
            current[i].name = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijkl";
            current[i].path =
                "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu.md";
        }
        vm.expectRevert(Policy.Limit.selector);
        encoder.encode(string(tabs), string(tabs), "", p, current);
        assertEq(token.transferCalls(), 0);
    }

    function test_invalidTextAndCanonicalWitnessRejectBeforePayment() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.text = "";
        vm.expectRevert(Policy.Limit.selector);
        branch.propose(p, _empty());
        bytes memory invalidUtf8 = hex"eda080";
        p.text = string(invalidUtf8);
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
        p.text = "safe";
        p.target = 0;
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
        T.Asset[] memory table = _table(2);
        table[1].key = table[0].key;
        RelayEncoder encoder = factory.encoder();
        vm.expectRevert(Policy.Invalid.selector);
        encoder.assetsHash(table);
        assertEq(token.transferCalls(), 0);
    }

    function test_jsonEscapingCannotInjectRuntimeFields() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.text = unicode"quote \", \\ and\n Unicode: café";
        uint256 id = branch.propose(p, _empty());
        (, bytes memory body) = branch.bodyOf(id, _empty());
        assertTrue(contains(body, 'quote \\", \\\\ and\\u000a'));
        assertTrue(body.length <= 16_384);
        assertEq(intake.count(), 0);
    }

    function test_measureMaximumWitnessAndLargeManifestTogether() public {
        T.Asset[] memory current = _table(16);
        for (uint256 i; i < 16; ++i) {
            current[i].name = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijkl";
            current[i].path =
                "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstu.md";
            current[i].jobId = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijkl";
        }
        current[14] = _kind(current[14], T.Kind.HTML);
        current[15] = _kind(current[15], T.Kind.Image);
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        p.outputName = current[0].name;
        p.outputPath = current[0].path;
        bytes memory raw =
            replace(F.documentResult(), '"name":"main"', bytes.concat('"name":', Text.quote(p.outputName)));
        raw = replace(raw, '"path":"docs/main.md"', bytes.concat('"path":', Text.quote(p.outputPath)));
        bytes memory padding = new bytes(225);
        for (uint256 i; i < padding.length; ++i) {
            padding[i] = "a";
        }
        bytes memory extra = '"source":[';
        for (uint256 i; i < 32; ++i) {
            extra = bytes.concat(extra, i == 0 ? bytes("") : bytes(","), '"', padding, '"');
        }
        raw = replace(raw, '"source":[]', bytes.concat(extra, "]"));
        assertTrue(raw.length <= Policy.MAX_MANIFEST);
        uint256 start = gasleft();
        branch.verifier().verify(raw, keccak256(raw), p, current, address(branch), 2);
        emit Metric("maximum witness plus large manifest verifier gas", start - gasleft());
        emit Metric("maximum witness large manifest bytes", raw.length);
        emit Metric("maximum witness ABI bytes", abi.encode(current).length);
    }

    function test_maximumCompleteBindingASCIIFitsGasBudget() public {
        _maximumBinding(0);
    }

    function test_maximumCompleteBindingEscapedUnicodeFitsGasBudget() public {
        _maximumBinding(1);
    }

    function test_maximumCompleteBindingWideObjectsFitsGasBudget() public {
        _maximumBinding(2);
    }

    function _repeat(uint256 size, bytes1 c) private pure returns (string memory) {
        bytes memory b = new bytes(size);
        for (uint256 i; i < size; ++i) {
            b[i] = c;
        }
        return string(b);
    }

    function _maximumBinding(uint256 shape) private {
        T.Asset[] memory current = _empty();
        for (uint256 i = 1; i <= 16; ++i) {
            T.Profile profile =
                i <= 14 ? T.Profile.MarkdownCreate : i == 15 ? T.Profile.HTMLCreate : T.Profile.ImageCreate;
            T.Proposal memory p = _proposal(branch, profile, i);
            string memory shortName = p.outputName;
            string memory shortPath = p.outputPath;
            p.outputName = _repeat(64, "n");
            if (i <= 14) p.outputPath = string.concat(_repeat(125, "a"), ".md");
            if (i == 16) p.outputPath = string.concat(_repeat(124, "a"), ".png");
            bytes memory raw = _manifest(Text.hex32(keccak256(abi.encode(i))), Policy.kind(profile), 32);
            raw = replace(raw, Text.quote(shortName), Text.quote(p.outputName));
            raw = replace(raw, Text.quote(shortPath), Text.quote(p.outputPath));
            current = _accept(branch, p, current, raw);
        }
        T.Proposal memory update = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        update.outputName = current[0].name;
        update.outputPath = current[0].path;
        bytes memory raw = _manifest(Text.hex32(keccak256("new job")), T.Kind.Markdown, 42);
        raw = replace(raw, '"main"', Text.quote(update.outputName));
        raw = replace(raw, '"docs/main.md"', Text.quote(update.outputPath));
        raw = replace(raw, '"state":"completed"', '"state":"completed","source":[]');
        if (shape == 2) {
            bytes memory emptyObjects = _wideObjects(0);
            uint256 available = Policy.MAX_MANIFEST - raw.length - emptyObjects.length + 2;
            raw = replace(raw, '"source":[]', bytes.concat('"source":', _wideObjects(available)));
        } else {
            uint256 available = Policy.MAX_MANIFEST - raw.length - 23; // Eight quotes pairs and seven commas.
            bytes memory array = "[";
            for (uint256 i; i < 8; ++i) {
                uint256 length = available / 8 + (i < available % 8 ? 1 : 0);
                bytes memory text = new bytes(length);
                for (uint256 j; j < length; ++j) {
                    text[j] = shape == 1 && j < length - length % 6 ? bytes("\\u00e9")[j % 6] : bytes1("a");
                }
                array = bytes.concat(array, i == 0 ? bytes("") : bytes(","), '"', text, '"');
            }
            raw = replace(raw, '"source":[]', bytes.concat('"source":', array, "]"));
        }
        assertEq(raw.length, Policy.MAX_MANIFEST);
        uint256 id = branch.propose(update, current);
        _record(_pay(branch, id, current), raw);
        uint256 start = gasleft();
        branch.bind(raw, current);
        uint256 used = start - gasleft();
        emit Metric(
            shape == 2
                ? "max complete wide object binding gas"
                : shape == 1 ? "max complete escaped binding gas" : "max complete ASCII binding gas",
            used
        );
        emit Metric("max complete binding manifest bytes", raw.length);
        emit Metric("max complete binding witness ABI bytes", abi.encode(current).length);
        assertTrue(used < 14_000_000);
        assertEq(branch.revision(), 17);
    }

    function _wideObjects(uint256 padding) private pure returns (bytes memory out) {
        out = "[";
        for (uint256 i; i < 3; ++i) {
            out = bytes.concat(out, i == 0 ? bytes("{") : bytes(",{"));
            for (uint256 j; j < 32; ++j) {
                uint256 at = i * 32 + j;
                out = bytes.concat(
                    out,
                    j == 0 ? bytes("") : bytes(","),
                    Text.quote(string.concat("k", Text.decimal(j))),
                    ":",
                    Text.quote(_repeat(padding / 96 + (at < padding % 96 ? 1 : 0), "a"))
                );
            }
            out = bytes.concat(out, "}");
        }
        return bytes.concat(out, "]");
    }
}
