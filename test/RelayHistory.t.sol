// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "./RelaySetup.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {RelayFactory} from "../src/RelayFactory.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {Text} from "../src/libraries/Text.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";

contract RelayHistoryTest is RelaySetup {
    function test_htmlImageHtmlLatestJobAndOlderSelectedInputs() public {
        T.Asset[] memory first =
            _accept(branch, _proposal(branch, T.Profile.HTMLCreate, 10), _empty(), F.htmlFirstResult());
        bytes32 firstCheckpoint = branch.anchor();
        assertEq(first[0].fileHash, sha256(F.htmlFirst()));
        assertEq(first[0].size, F.htmlFirst().length);
        string memory firstJob = branch.latestJobId();

        T.Asset[] memory second =
            _accept(branch, _proposal(branch, T.Profile.ImageCreate, 20), first, F.imageSecondResult());
        string memory secondJob = branch.latestJobId();
        assertEq(keccak256(abi.encode(first[0])), keccak256(abi.encode(second[0])));
        assertEq(second[1].fileHash, sha256(F.imageSecond()));
        assertEq(second[1].size, F.imageSecond().length);
        assertEq(branch.checkpoint(1).digest, firstCheckpoint);
        assertTrue(!Text.equal(firstJob, secondJob));

        T.Proposal memory p = _proposal(branch, T.Profile.HTMLUpdate, 10);
        p.inputs = new bytes32[](2);
        p.inputs[0] = bytes32(uint256(10));
        p.inputs[1] = bytes32(uint256(20));
        uint256 id = branch.propose(p, second);
        (bytes32 action, bytes memory body) = branch.bodyOf(id, second);
        assertEq(action, Policy.CONTINUE);
        assertTrue(contains(body, bytes.concat('"parentJobId":', Text.quote(secondJob))));
        assertFalse(contains(body, bytes.concat('"parentJobId":', Text.quote(firstJob))));
        assertTrue(contains(body, bytes(Text.hex32(first[0].fileHash))));
        assertTrue(contains(body, bytes(Text.hex32(second[1].fileHash))));
        assertTrue(contains(body, '"as":"asset-0"'));
        assertTrue(contains(body, '"as":"asset-1"'));
        assertTrue(contains(body, '"path":"dist/index.html"'));
        assertFalse(contains(body, '"projectId"'));
        assertFalse(contains(body, '"repoUrl"'));
        assertFalse(contains(body, '"baseCommit"'));
        _record(_pay(branch, id, second), F.htmlThirdResult());
        T.Asset[] memory third = _bind(branch, F.htmlThirdResult(), second);
        assertEq(branch.revision(), 3);
        assertEq(third[0].fileHash, sha256(F.htmlThird()));
        assertEq(third[0].producer, address(branch));
        assertEq(third[0].revision, 3);
        assertEq(third[0].resultHash, keccak256(F.htmlThirdResult()));
        assertEq(keccak256(abi.encode(second[1])), keccak256(abi.encode(third[1])));
        assertTrue(contains(F.htmlThird(), 'id="original-marker"'));
        assertTrue(contains(F.htmlThird(), bytes.concat("data:image/png;base64,", bytes(F.imageBase64()))));
        // Continuations have no two-round limit, even when changing type after round three.
        T.Asset[] memory fourth =
            _accept(branch, _proposal(branch, T.Profile.MarkdownCreate, 5), third, F.documentResult());
        assertEq(branch.revision(), 4);
        assertEq(fourth.length, 3);
        T.Asset[] memory fifth = _accept(
            branch, _proposal(branch, T.Profile.MarkdownUpdate, 5), fourth, F.documentUpdatedResult()
        );
        assertEq(branch.revision(), 5);
        assertEq(fifth[0].fileHash, sha256(F.documentUpdated()));
        assertEq(keccak256(abi.encode(fourth[1])), keccak256(abi.encode(fifth[1])));
        assertEq(keccak256(abi.encode(fourth[2])), keccak256(abi.encode(fifth[2])));
    }

    function test_forkChosenHistoricalCheckpointStartsOwnProjectAndPayer() public {
        T.Asset[] memory first = _document();
        bytes32 historical = branch.anchor();
        T.Asset[] memory second =
            _accept(branch, _proposal(branch, T.Profile.MarkdownUpdate, 1), first, F.documentUpdatedResult());
        assertTrue(branch.assetsHash() != keccak256(abi.encode(first)));
        uint256 paidBefore = intake.count();
        RelayBranch child = factory.fork(address(branch), 1, first, "Illustrate the original document.");
        assertEq(intake.count(), paidBefore);
        assertTrue(factory.registered(address(child)));
        assertEq(child.goal(), branch.goal());
        assertEq(child.direction(), "Illustrate the original document.");
        assertEq(child.projectId(), "");
        assertEq(child.latestJobId(), "");
        assertEq(child.proposalCount(), 0);
        assertEq(child.attemptCount(), 0);
        assertEq(child.revision(), 0);
        assertEq(child.assetsHash(), keccak256(abi.encode(first)));
        (address parent, uint64 revision, bytes32 checkpoint) = child.source();
        assertEq(parent, address(branch));
        assertEq(revision, 1);
        assertEq(checkpoint, historical);
        assertEq(child.checkpoint(0).assetsHash, keccak256(abi.encode(first)));
        _approve(child);
        uint256 id = child.propose(_proposal(child, T.Profile.ImageCreate, 2), first);
        (bytes32 action, bytes memory body) = child.bodyOf(id, first);
        assertEq(action, Policy.OPEN);
        assertFalse(contains(body, '"parentJobId"'));
        assertFalse(contains(body, bytes(branch.projectId())));
        assertFalse(contains(body, '"repoUrl"'));
        assertFalse(contains(body, '"baseCommit"'));
        bytes32 req = _pay(child, id, first);
        assertEq(intake.request(req).payer, address(child));
        assertTrue(intake.request(req).payer != address(branch));
        bytes memory childResult =
            replace(F.imageSecondResult(), bytes(F.project()), bytes("local-child-project"));
        _record(req, childResult);
        T.Asset[] memory childAssets = _bind(child, childResult, first);
        assertEq(child.projectId(), "local-child-project");
        assertEq(keccak256(abi.encode(childAssets[0])), keccak256(abi.encode(first[0])));
        assertEq(childAssets[0].producer, address(branch));
        assertEq(childAssets[1].producer, address(child));
        id = child.propose(_proposal(child, T.Profile.MarkdownUpdate, 1), childAssets);
        (action, body) = child.bodyOf(id, childAssets);
        assertEq(action, Policy.CONTINUE);
        assertTrue(contains(body, bytes.concat('"parentJobId":', Text.quote(child.latestJobId()))));
        assertFalse(contains(body, bytes.concat('"parentJobId":', Text.quote(branch.latestJobId()))));
        assertEq(branch.assetsHash(), keccak256(abi.encode(second)));
    }

    function test_forkCannotAuthenticateFakeParentLatestWitnessOrForgedProvenance() public {
        T.Asset[] memory first = _document();
        T.Asset[] memory second =
            _accept(branch, _proposal(branch, T.Profile.MarkdownUpdate, 1), first, F.documentUpdatedResult());
        address implementation = factory.implementation();
        vm.expectRevert(RelayFactory.InvalidParent.selector);
        factory.fork(implementation, 1, first, "fork");
        vm.expectRevert(RelayFactory.InvalidCheckpoint.selector);
        factory.fork(address(branch), 0, _empty(), "fork");
        vm.expectRevert(RelayFactory.InvalidCheckpoint.selector);
        factory.fork(address(branch), 3, second, "fork");
        vm.expectRevert(RelayFactory.InvalidCheckpoint.selector);
        factory.fork(address(branch), 1, second, "fork");
        first[0].producer = address(factory);
        vm.expectRevert(RelayFactory.InvalidCheckpoint.selector);
        factory.fork(address(branch), 1, first, "fork");
        assertEq(intake.count(), 2);
        assertEq(factory.branchCount(), 1);
    }

    function test_forkIsAllowedWhileParentPendingOrFrozen() public {
        T.Asset[] memory first = _document();
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownUpdate, 1), first);
        bytes32 req = _pay(branch, id, first);
        RelayBranch child1 = factory.fork(address(branch), 1, first, "While pending");
        vm.prank(WRITER);
        assertTrue(intake.fail(req, 2, "failed"));
        RelayBranch child2 = factory.fork(address(branch), 1, first, "While frozen");
        assertEq(child1.assetsHash(), child2.assetsHash());
        assertTrue(child1.anchor() != child2.anchor());
        assertEq(intake.count(), 2);
    }

    function test_reinitializeAndImplementationInitializationCannotChangeAuthority() public {
        RelayBranch implementation = RelayBranch(factory.implementation());
        vm.expectRevert(RelayBranch.Unauthorized.selector);
        branch.initialize("different goal", "", T.Source(address(0), 0, 0), 0, _empty());
        vm.prank(address(factory));
        vm.expectRevert(RelayBranch.Unauthorized.selector);
        branch.initialize("different goal", "", T.Source(address(0), 0, 0), 0, _empty());
        vm.prank(address(factory));
        vm.expectRevert(RelayBranch.Unauthorized.selector);
        implementation.initialize("different goal", "", T.Source(address(0), 0, 0), 0, _empty());
        (bool ok,) = address(branch).call(abi.encodeWithSignature("setIntake(address)", address(this)));
        assertFalse(ok);
        (ok,) = address(branch)
            .call(abi.encodeWithSignature("execute(address,uint256,bytes)", address(token), 0, ""));
        assertFalse(ok);
        assertEq(branch.goal(), "Maintain a public relay project.");
        assertEq(branch.intake(), Policy.INTAKE);
        assertEq(branch.imd(), Policy.IMD);
        assertEq(branch.factory(), address(factory));
        assertEq(address(branch.encoder()), address(factory.encoder()));
        assertEq(address(branch.verifier()), address(factory.verifier()));
    }

    function test_badBindingPreservesResultThenCorrectWitnessWorksWithoutPurchase() public {
        T.Asset[] memory first = _document();
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownUpdate, 1), first);
        bytes32 oldCheckpoint = branch.anchor();
        _record(_pay(branch, id, first), F.documentUpdatedResult());
        vm.expectRevert(RelayBranch.InvalidWitness.selector);
        branch.bind(F.documentUpdatedResult(), _empty());
        vm.expectRevert(Policy.Invalid.selector);
        branch.bind(bytes.concat(F.documentUpdatedResult(), " "), first);
        assertEq(uint256(branch.phase()), uint256(T.Phase.ResultRecorded));
        assertEq(branch.anchor(), oldCheckpoint);
        assertEq(branch.attempt(2).outcome, keccak256(F.documentUpdatedResult()));
        assertEq(branch.revision(), 1);
        T.Asset[] memory second = _bind(branch, F.documentUpdatedResult(), first);
        assertEq(second[0].fileHash, sha256(F.documentUpdated()));
        assertEq(intake.count(), 2);
        assertEq(token.balanceOf(TREASURY), 2 * PRICE);
    }

    function test_projectMismatchCannotOverwriteCheckpoint() public {
        T.Asset[] memory first = _document();
        bytes32 checkpoint = branch.anchor();
        bytes memory wrong = replace(F.documentUpdatedResult(), bytes(F.project()), bytes("another-project"));
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownUpdate, 1), first);
        _record(_pay(branch, id, first), wrong);
        vm.expectRevert(RelayBranch.IdentityMismatch.selector);
        branch.bind(wrong, first);
        assertEq(branch.anchor(), checkpoint);
        assertEq(branch.projectId(), F.project());
        assertEq(uint256(branch.phase()), uint256(T.Phase.ResultRecorded));
    }

    function test_reusedJobCannotCreateNewRevision() public {
        T.Asset[] memory first = _document();
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownUpdate, 1), first);
        _record(_pay(branch, id, first), F.documentResult());
        vm.expectRevert(RelayBranch.IdentityMismatch.selector);
        branch.bind(F.documentResult(), first);
        assertEq(branch.revision(), 1);
    }

    function test_childCannotBindParentsProjectAsOwn() public {
        T.Asset[] memory first = _document();
        RelayBranch child = factory.fork(address(branch), 1, first, "Separate direction");
        _approve(child);
        uint256 id = child.propose(_proposal(child, T.Profile.MarkdownUpdate, 1), first);
        _record(_pay(child, id, first), F.documentUpdatedResult());
        vm.expectRevert(RelayBranch.IdentityMismatch.selector);
        child.bind(F.documentUpdatedResult(), first);
        assertEq(child.projectId(), "");
        assertEq(child.revision(), 0);
    }
}
