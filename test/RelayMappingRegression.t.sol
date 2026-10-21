// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "./RelaySetup.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {RelayEncoder} from "../src/RelayEncoder.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";

/// @notice Regression coverage for the delivered A1 name/path and dist findings.
contract RelayMappingRegressionTest is RelaySetup {
    function test_createRejectsExistingNameEvenWhenPathAndSlotDifferBeforePayment() public {
        T.Asset[] memory current = _document();
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 2);
        p.outputPath = "artifacts/second.md";
        _rejectWithoutSpending(p, current);
    }

    function test_createRejectsExistingPathEvenWhenNameAndSlotDifferBeforePayment() public {
        T.Asset[] memory current = _document();
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 2);
        p.outputName = "second";
        _rejectWithoutSpending(p, current);
    }

    function test_namesCannotCollideAcrossDifferentAssetKinds() public {
        T.Asset[] memory current = _document();
        T.Proposal memory p = _proposal(branch, T.Profile.ImageCreate, 2);
        p.outputName = "main";
        _rejectWithoutSpending(p, current);
    }

    function test_pathDescendantCannotTreatAnExistingFileAsDirectoryBeforePayment() public {
        T.Asset[] memory current = _document();
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 2);
        p.outputName = "second";
        p.outputPath = "artifacts/main.md/next.md";
        _rejectWithoutSpending(p, current);
    }

    function test_pathAncestorCannotReplaceAnExistingDirectoryWithFileBeforePayment() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.outputPath = "artifacts/main.md/next.md";
        bytes memory raw =
            replace(F.documentResult(), '"path":"artifacts/main.md"', '"path":"artifacts/main.md/next.md"');
        T.Asset[] memory current = _accept(branch, p, _empty(), raw);
        p = _proposal(branch, T.Profile.MarkdownCreate, 2);
        p.outputName = "second";
        _rejectWithoutSpending(p, current);
    }

    function test_pathAncestorCollisionWithOtherSlotAlsoRejectsUpdates() public {
        T.Asset[] memory original = _document();
        T.Asset[] memory inherited = new T.Asset[](2);
        inherited[0] = original[0];
        inherited[1] = abi.decode(abi.encode(original[0]), (T.Asset));
        inherited[1].key = bytes32(uint256(2));
        inherited[1].name = "second";
        inherited[1].path = "artifacts/main.md/next.md";
        RelayEncoder encoder = factory.encoder();
        assertEq(encoder.assetsHash(inherited), keccak256(abi.encode(inherited)));
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        vm.expectRevert(Policy.Invalid.selector);
        encoder.encode("Goal", "", "", p, inherited);
        p = _proposal(branch, T.Profile.MarkdownUpdate, 2);
        p.outputName = "second";
        p.outputPath = "artifacts/main.md/next.md";
        vm.expectRevert(Policy.Invalid.selector);
        encoder.encode("Goal", "", "", p, inherited);
    }

    function test_pathCommonDirectoriesAndNonBoundaryPrefixesAreAllowed() public {
        T.Asset[] memory current = _document();
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 2);
        p.outputName = "second";
        p.outputPath = "artifacts/second.md";
        branch.propose(p, current);
        p.outputPath = "artifacts/main.md-more/next.md";
        branch.propose(p, current);
        assertEq(intake.count(), 1);
    }

    function test_secondHtmlSlotRejectsFixedPathCollision() public {
        T.Asset[] memory current =
            _accept(branch, _proposal(branch, T.Profile.HTMLCreate, 1), _empty(), F.htmlFirstResult());
        T.Proposal memory p = _proposal(branch, T.Profile.HTMLCreate, 2);
        p.outputName = "another-site";
        _rejectWithoutSpending(p, current);
        // The existing HTML is still updatable with its authenticated selected input.
        uint256 id = branch.propose(_proposal(branch, T.Profile.HTMLUpdate, 1), current);
        (, bytes memory body) = branch.bodyOf(id, current);
        assertTrue(contains(body, '"path":"artifacts/index.html"'));
    }

    function test_markdownAndImageCannotWriteAnyTopLevelDistDescendant() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.outputPath = "dist/notes.md";
        _rejectWithoutSpending(p, _empty());
        p.outputPath = "dist/nested/notes.md";
        _rejectWithoutSpending(p, _empty());
        p = _proposal(branch, T.Profile.ImageCreate, 1);
        p.outputPath = "dist/pixel.png";
        _rejectWithoutSpending(p, _empty());
        p.outputPath = "dist/nested/pixel.png";
        _rejectWithoutSpending(p, _empty());
    }

    function test_distLikeNamesAndNestedNonWebsiteDistDirectoryRemainAllowed() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.outputPath = "artifacts/distribution/notes.md";
        branch.propose(p, _empty());
        p.outputPath = "artifacts/dist-notes.md";
        branch.propose(p, _empty());
        p.outputPath = "artifacts/dist/notes.md";
        branch.propose(p, _empty());
        assertEq(intake.count(), 0);
    }

    function test_uniqueCreateAndUpdatePreserveOtherAssetProvenance() public {
        T.Asset[] memory current = _document();
        bytes32 untouched = keccak256(abi.encode(current[0]));
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 2);
        p.outputName = "second";
        p.outputPath = "artifacts/second.md";
        bytes memory raw = replace(F.documentUpdatedResult(), '"name":"main"', '"name":"second"');
        raw = replace(raw, '"path":"artifacts/main.md"', '"path":"artifacts/second.md"');
        current = _accept(branch, p, current, raw);
        assertEq(current.length, 2);
        assertEq(keccak256(abi.encode(current[0])), untouched);
        bytes32 second = keccak256(abi.encode(current[1]));
        raw = replace(
            F.documentUpdatedResult(), bytes("0add330c-9c9a-5392-9da0-16a8e1882d6d"), bytes("new-update-job")
        );
        current = _accept(branch, _proposal(branch, T.Profile.MarkdownUpdate, 1), current, raw);
        assertEq(keccak256(abi.encode(current[1])), second);
        assertEq(current[0].name, "main");
        assertEq(current[0].path, "artifacts/main.md");
    }

    function test_historicalForkKeepsSourceProvenanceAndCanUpdateInheritedSlot() public {
        T.Asset[] memory current = _document();
        RelayBranch child = factory.fork(address(branch), 1, current, "Continue the inherited document.");
        T.Proposal memory conflict = _proposal(child, T.Profile.MarkdownCreate, 2);
        conflict.outputName = "another";
        vm.expectRevert(Policy.Invalid.selector);
        child.propose(conflict, current);
        uint256 id = child.propose(_proposal(child, T.Profile.MarkdownUpdate, 1), current);
        (bytes32 action, bytes memory body) = child.bodyOf(id, current);
        assertEq(action, Policy.OPEN);
        assertTrue(contains(body, '"as":"asset-0"'));
        assertEq(current[0].producer, address(branch));
        assertEq(current[0].revision, 1);
    }

    function test_legacyIndependentDescriptorsStayReadableButCollidingUpdateIsRejected() public {
        T.Asset[] memory original = _document();
        T.Asset[] memory inherited = new T.Asset[](2);
        inherited[0] = original[0];
        inherited[1] = abi.decode(abi.encode(original[0]), (T.Asset));
        inherited[1].key = bytes32(uint256(2));
        inherited[1].producer = address(0x1234);
        inherited[1].jobId = "independent-origin";
        inherited[1].submissionHash = sha256("independent immutable submission");
        // Historical descriptors are not reinterpreted as mutable workspace files.
        RelayEncoder encoder = factory.encoder();
        assertEq(encoder.assetsHash(inherited), keccak256(abi.encode(inherited)));
        T.Proposal memory p = _proposal(branch, T.Profile.ImageCreate, 3);
        encoder.encode("Goal", "", "", p, inherited);
        p = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        vm.expectRevert(Policy.Invalid.selector);
        encoder.encode("Goal", "", "", p, inherited);
    }

    function _rejectWithoutSpending(T.Proposal memory p, T.Asset[] memory current) private {
        uint256 requests = intake.count();
        uint256 transfers = token.transferCalls();
        uint256 proposals = branch.proposalCount();
        bytes32 anchor = branch.anchor();
        vm.expectRevert(Policy.Invalid.selector);
        branch.propose(p, current);
        assertEq(intake.count(), requests);
        assertEq(token.transferCalls(), transfers);
        assertEq(branch.proposalCount(), proposals);
        assertEq(branch.anchor(), anchor);
    }
}
