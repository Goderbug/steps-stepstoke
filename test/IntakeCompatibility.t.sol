// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {RelaySetup} from "./RelaySetup.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {RelayEncoder} from "src/RelayEncoder.sol";
import {Policy} from "src/libraries/Policy.sol";

contract IntakeCompatibilityTest is RelaySetup {
    function test_oldOutputNamespaceRejectedBeforePayment() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.outputPath = "docs/main.md";
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
        assertEq(intake.count(), 0);
        assertEq(token.transferCalls(), 0);
        p = _proposal(branch, T.Profile.HTMLCreate, 1);
        p.outputPath = "dist/index.html";
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
    }

    function test_currentCatalogShapeAndOutputNamespaceAreEncoded() public {
        for (uint256 i; i < 3; ++i) {
            T.Proposal memory p = _proposal(
                branch,
                i == 0 ? T.Profile.MarkdownCreate : i == 1 ? T.Profile.HTMLCreate : T.Profile.ImageCreate,
                1
            );
            uint256 id = branch.propose(p, _empty());
            (, bytes memory body) = branch.bodyOf(id, _empty());
            assertTrue(contains(body, '"shape":"chain"'));
            assertTrue(contains(body, '"path":"artifacts/'));
            assertTrue(
                contains(
                    body,
                    bytes(
                        i == 0
                            ? '"skill":"research-report"'
                            : i == 1 ? '"skill":"build-website"' : '"skill":"create-image"'
                    )
                )
            );
            assertFalse(contains(body, '"host":true'));
        }
        assertEq(intake.count(), 0);
    }

    function test_legacyDescriptorRemainsExactAndMigrationRequiresExplicitCanonicalUpdate() public {
        T.Asset[] memory legacy = _document();
        legacy[0].path = "docs/main.md";
        bytes32 beforeHash = keccak256(abi.encode(legacy));
        RelayEncoder e = factory.encoder();
        assertEq(e.assetsHash(legacy), beforeHash);
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        (, bytes memory body) = e.encode("Fixed goal", "", "own-latest-job", p, legacy);
        assertTrue(contains(body, '"path":"docs/main.md"'));
        assertTrue(contains(body, '"outputs":[{"name":"main","path":"artifacts/main.md"'));
        assertEq(keccak256(abi.encode(legacy)), beforeHash);
        p.outputPath = "artifacts/renamed.md";
        vm.expectRevert(Policy.Invalid.selector);
        e.encode("Fixed goal", "", "", p, legacy);
        p.outputPath = "artifacts/main.md";
        p.outputName = "renamed";
        vm.expectRevert(Policy.Invalid.selector);
        e.encode("Fixed goal", "", "", p, legacy);
    }

    function test_namesRequireInitialLetterButHistoricalNamesRemainReadable() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.outputName = "1file";
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
        p.outputName = "_file";
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, _empty());
        T.Asset[] memory legacy = _document();
        legacy[0].name = "1file";
        RelayEncoder e = factory.encoder();
        assertEq(e.assetsHash(legacy), keccak256(abi.encode(legacy)));
        p = _proposal(branch, T.Profile.MarkdownCreate, 2);
        p.inputs = new bytes32[](1);
        p.inputs[0] = legacy[0].key;
        p.outputName = "other";
        p.outputPath = "artifacts/other.md";
        vm.expectRevert(Policy.Invalid.selector);
        e.encode("Goal", "", "", p, legacy);
    }

    function test_legacyHTMLCannotCreateSecondHTMLSlotAndExplicitUpdateMigrates() public {
        T.Asset[] memory legacy = _document();
        legacy[0].kind = T.Kind.HTML;
        legacy[0].path = "dist/index.html";
        legacy[0].mediaType = "text/html";
        RelayEncoder e = factory.encoder();
        T.Proposal memory p = _proposal(branch, T.Profile.HTMLCreate, 2);
        vm.expectRevert(Policy.Invalid.selector);
        e.encode("Goal", "", "", p, legacy);
        p = _proposal(branch, T.Profile.HTMLUpdate, 1);
        p.outputName = legacy[0].name;
        (, bytes memory body) = e.encode("Goal", "", "latest", p, legacy);
        assertTrue(contains(body, '"path":"dist/index.html"'));
        assertTrue(contains(body, '"outputs":[{"name":"main","path":"artifacts/index.html"'));
        assertEq(legacy[0].path, "dist/index.html");
    }
}
