// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SpecSetup, SpecData as D} from "./SpecSupport.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {RelayEncoder} from "src/RelayEncoder.sol";
import {Policy} from "src/libraries/Policy.sol";

contract ProfileBoundarySpecTest is SpecSetup {
    RelayEncoder private encoder;

    function setUp() public override {
        super.setUp();
        encoder = factory.encoder();
    }

    function test_realEightAssetWitnessExact16384ByteRequestAndOneByteOverRejectedBeforePayment() public {
        RelayBranch parent = factory.createProject(string(D.repeat(0x09, 512)));
        approveBoth(parent);
        T.Asset[] memory assets = empty();
        for (uint256 i = 1; i <= 8; ++i) {
            T.Proposal memory documentProposal = proposal(parent, T.Profile.MarkdownCreate, i);
            documentProposal.outputName = string(D.repeat(bytes1(uint8(65 + i)), 64));
            documentProposal.outputPath =
                string(bytes.concat("artifacts/", D.repeat(bytes1(uint8(97 + i)), 115), ".md"));
            assets = accept(
                parent,
                documentProposal,
                assets,
                D.hex32(keccak256(abi.encode(i))),
                "body-limit-project",
                bytes.concat(D.document(), bytes(D.decimal(i))),
                i % 2 == 0 ? ALICE : BOB
            );
        }
        RelayBranch child = factory.fork(address(parent), 8, assets, string(D.repeat(0x09, 512)));
        approveBoth(child);
        T.Proposal memory p = proposal(child, T.Profile.HTMLCreate, 9);
        p.inputs = new bytes32[](8);
        for (uint256 i; i < 8; ++i) {
            p.inputs[i] = bytes32(i + 1);
        }
        p.text = "x";
        (, bytes memory minimal) = encoder.encode(parent.goal(), child.direction(), "", p, assets);
        uint256 encodedTextLength = 16_384 - (minimal.length - 1);
        p.text =
            string(bytes.concat(D.repeat(0x09, encodedTextLength / 6), D.repeat("x", encodedTextLength % 6)));
        assertTrue(bytes(p.text).length < 1024);
        (, bytes memory boundary) = encoder.encode(parent.goal(), child.direction(), "", p, assets);
        assertEq(boundary.length, 16_384);
        emit Metric("independent exact runtime request UTF-8 bytes", boundary.length);
        T.Proposal memory tooLarge = abi.decode(abi.encode(p), (T.Proposal));
        tooLarge.text = string.concat(p.text, "x");
        uint256 transfers = token.transfers();
        uint256 count = intake.count();
        bytes32 anchor = child.anchor();
        vm.expectRevert(Policy.Limit.selector);
        child.propose(tooLarge, assets);
        assertEq(child.proposalCount(), 0);
        assertEq(child.anchor(), anchor);
        assertEq(token.transfers(), transfers);
        assertEq(intake.count(), count);
        uint256 id = child.propose(p, assets);
        bytes32 request = pay(child, id, assets, BOB);
        assertEq(intake.receipt(request).body, boundary);
        assertEq(intake.receipt(request).action, OPEN);
        assertEq(intake.receipt(request).payer, address(child));
        assertEq(token.allowance(address(child), INTAKE), 0);
        assertEq(token.balanceOf(address(child)), 0);
        assertAccounting(9 * FEE, 0);
    }

    function test_utf8TextLimitsCountBytesAndOutputMappingLengthsAreBounded() public {
        bytes memory twoByte;
        for (uint256 i; i < 256; ++i) {
            twoByte = bytes.concat(twoByte, hex"c3a9");
        }
        RelayBranch b = factory.createProject(string(twoByte)); // 256 scalars, 512 bytes.
        vm.expectRevert(Policy.Limit.selector);
        factory.createProject(string(bytes.concat(twoByte, hex"c3a9")));
        T.Proposal memory p = proposal(b, T.Profile.MarkdownCreate, 1);
        p.text = string(bytes.concat(twoByte, twoByte)); // Exactly 1,024 bytes.
        p.outputName = string(D.repeat("n", 64));
        p.outputPath = string(bytes.concat("artifacts/", D.repeat("p", 115), ".md")); // Exactly 128 bytes.
        uint256 id = b.propose(p, empty());
        (, bytes memory body) = b.bodyOf(id, empty());
        assertTrue(contains(body, bytes(p.text)));
        p.text = string.concat(p.text, "x");
        vm.expectRevert(Policy.Limit.selector);
        b.propose(p, empty());
        p.text = "valid";
        p.outputName = string(D.repeat("n", 65));
        vm.expectRevert(Policy.Limit.selector);
        b.propose(p, empty());
        p.outputName = "notes";
        p.outputPath = string(bytes.concat("artifacts/", D.repeat("p", 116), ".md"));
        vm.expectRevert(Policy.Limit.selector);
        b.propose(p, empty());
        assertEq(b.proposalCount(), 1);
        assertAccounting(0, 0);
    }

    function test_unsafePathComponentsInvalidUtf8AndDisabledModesRejectWithoutSpending() public {
        string[13] memory paths = [
            "/notes.md",
            "../notes.md",
            "a/../notes.md",
            "a/.private.md",
            "a//notes.md",
            "a/notes.md/",
            "a\\notes.md",
            "https://host/notes.md",
            "a/%2e%2e/notes.md",
            "a/notes.md.",
            "a/notes.md?x=1",
            "a/notes.md#fragment",
            "a/notes\u0000.md"
        ];
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        for (uint256 i; i < paths.length; ++i) {
            p.outputPath = paths[i];
            vm.expectRevert(Policy.Invalid.selector);
            root.propose(p, empty());
        }
        p = proposal(root, T.Profile.HTMLCreate, 1);
        p.publish = true;
        vm.expectRevert(Policy.Invalid.selector);
        root.propose(p, empty());
        p.publish = false;
        p.outputPath = "site/index.html";
        vm.expectRevert(Policy.Invalid.selector);
        root.propose(p, empty());
        p = proposal(root, T.Profile.MarkdownCreate, 1);
        bytes[7] memory invalid =
            [bytes(hex"80"), hex"c180", hex"e08080", hex"eda080", hex"f0808080", hex"f4908080", hex"f09f92"];
        for (uint256 i; i < invalid.length; ++i) {
            p.text = string(invalid[i]);
            vm.expectRevert(Policy.Invalid.selector);
            root.propose(p, empty());
        }
        assertEq(root.proposalCount(), 0);
        assertAccounting(0, 0);
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_htmlBase64RoundingAndOneByteOverTheKnownInputBudget(uint32 sizeSeed) public {
        uint256 imageBytes = uint256(sizeSeed) % 262_144 + 1;
        uint256 encodedImage = ((imageBytes + 2) / 3) * 4 + 32;
        T.Asset[] memory assets = table(2);
        assets[0].kind = T.Kind.HTML;
        assets[0].name = "page";
        assets[0].path = "artifacts/index.html";
        assets[0].mediaType = "text/html";
        assets[0].size = uint32(2_097_152 - encodedImage);
        assets[1].kind = T.Kind.Image;
        assets[1].name = "pixel";
        assets[1].path = "artifacts/pixel.png";
        assets[1].mediaType = "image/png";
        assets[1].size = uint32(imageBytes);
        T.Proposal memory p = proposal(root, T.Profile.HTMLUpdate, 1);
        p.inputs = new bytes32[](2);
        p.inputs[0] = bytes32(uint256(1));
        p.inputs[1] = bytes32(uint256(2));
        // Descriptor-only unit boundary: files are not provided to the EVM.
        encoder.encode("Goal", "", "own-job", p, assets);
        ++assets[0].size;
        vm.expectRevert(Policy.Limit.selector);
        encoder.encode("Goal", "", "own-job", p, assets);
    }

    function test_slotReservationInputCountAndFullCapacityUpdateBoundaries() public {
        T.Asset[] memory assets = table(14);
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 15);
        vm.expectRevert(Policy.Limit.selector);
        encoder.encode("Goal", "", "latest-job", p, assets);
        p = proposal(root, T.Profile.HTMLCreate, 15);
        encoder.encode("Goal", "", "latest-job", p, assets);
        p.inputs = new bytes32[](8);
        for (uint256 i; i < 8; ++i) {
            p.inputs[i] = bytes32(i + 1);
        }
        encoder.encode("Goal", "", "latest-job", p, assets);
        p.inputs = new bytes32[](9);
        for (uint256 i; i < 9; ++i) {
            p.inputs[i] = bytes32(i + 1);
        }
        vm.expectRevert(Policy.Invalid.selector);
        encoder.encode("Goal", "", "latest-job", p, assets);

        assets = table(16);
        assets[14].kind = T.Kind.HTML;
        assets[14].name = "page";
        assets[14].path = "artifacts/index.html";
        assets[14].mediaType = "text/html";
        assets[15].kind = T.Kind.Image;
        assets[15].name = "pixel";
        assets[15].path = "artifacts/pixel.png";
        assets[15].mediaType = "image/png";
        p = proposal(root, T.Profile.MarkdownUpdate, 1);
        encoder.encode("Goal", "", "latest-job", p, assets);
        p = proposal(root, T.Profile.HTMLUpdate, 15);
        encoder.encode("Goal", "", "latest-job", p, assets);
        p = proposal(root, T.Profile.ImageCreate, 17);
        vm.expectRevert(Policy.Limit.selector);
        encoder.encode("Goal", "", "latest-job", p, assets);
        p = proposal(root, T.Profile.ImageCreate, 16);
        vm.expectRevert(Policy.Invalid.selector);
        encoder.encode("Goal", "", "latest-job", p, assets);
        assets = table(17);
        vm.expectRevert(Policy.Limit.selector);
        encoder.assetsHash(assets);
    }

    function table(uint256 n) private view returns (T.Asset[] memory assets) {
        assets = new T.Asset[](n);
        for (uint256 i; i < n; ++i) {
            T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, i + 1);
            if (i != 0) {
                p.outputName = string.concat("notes-", D.decimal(i + 1));
                p.outputPath = string.concat("artifacts/notes-", D.decimal(i + 1), ".md");
            }
            bytes memory raw = D.manifest(p, "descriptor-job", "descriptor-project", D.document());
            assets[i] = D.output(p, "descriptor-job", D.document(), raw, address(root), 1);
        }
    }
}
