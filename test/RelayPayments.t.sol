// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "./RelaySetup.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {IIntake} from "../src/interfaces/IIntake.sol";
import {MockIntake} from "./mocks/MockIntake.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";

contract RelayPaymentsTest is RelaySetup {
    function test_creationAndProposalsDoNotPurchaseOrMoveAnchor() public {
        bytes32 anchor = branch.anchor();
        uint256 first = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        uint256 second = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 2), _empty());
        assertEq(first, 1);
        assertEq(second, 2);
        assertEq(branch.anchor(), anchor);
        assertEq(intake.count(), 0);
        assertEq(token.transferCalls(), 0);
        assertEq(token.balanceOf(SPONSOR), 1000 ether);
        bytes32 req = _pay(branch, second, _empty()); // No FIFO.
        assertEq(branch.activeProposal(), second);
        _record(req, F.documentResult());
        T.Asset[] memory next = _bind(branch, F.documentResult(), _empty());
        assertEq(next[0].key, bytes32(uint256(2)));
        vm.expectRevert(RelayBranch.Stale.selector);
        branch.sponsor(first, PRICE, next);
    }

    function test_dynamicFeeBranchPayerExactBodyAndSelectors() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        intake.setPrice(Policy.OPEN, 0.73 ether);
        (bytes32 action, bytes memory body) = branch.bodyOf(id, _empty());
        assertEq(action, Policy.OPEN);
        assertEq(
            body,
            bytes(
                '{"objective":"Public project goal: Maintain a public relay project.\\u000aBranch direction: \\u000aRequested change: Perform the declared change.\\u000aCreate a new asset without replacing another slot. Write a UTF-8 Markdown document, at most 65536 bytes. Read only the explicit inputs at .imd/reads/artifacts/<as>. No website or IPFS publishing.\\u000aProduce exactly the declared named output. Do not delete or claim to have read unselected assets. No paid child jobs, autonomous spending, contract deployment or token launches.","github":true,"ipfs":false,"steps":[{"skill":"build-document","inputs":[],"outputs":[{"name":"main","path":"docs/main.md","mediaType":"text/markdown"}]}]}'
            )
        );
        bytes32 req = _pay(branch, id, _empty());
        MockIntake.Request memory r = intake.request(req);
        assertEq(r.payer, address(branch));
        assertEq(r.callback.target, address(branch));
        assertEq(bytes32(r.callback.selector), bytes32(branch.onIntakeResult.selector));
        assertEq(bytes32(r.failure), bytes32(branch.onIntakeFailure.selector));
        assertEq(r.body, body);
        assertEq(token.balanceOf(TREASURY), 0.73 ether);
        assertEq(token.balanceOf(SPONSOR), 1000 ether - 0.73 ether);
        assertEq(token.balanceOf(address(branch)), 0);
        assertEq(token.allowance(address(branch), address(intake)), 0);
        assertEq(branch.attempt(1).bodyHash, keccak256(body));
    }

    function test_zeroUnknownProposalFeeCapAndUnpricedRejectBeforeTransfer() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        vm.expectRevert(RelayBranch.UnknownProposal.selector);
        branch.sponsor(0, PRICE, _empty());
        vm.expectRevert(RelayBranch.UnknownProposal.selector);
        branch.sponsor(id + 1, PRICE, _empty());
        vm.expectRevert(RelayBranch.FeeExceeded.selector);
        branch.sponsor(id, PRICE - 1, _empty());
        intake.setPrice(Policy.OPEN, 0);
        vm.expectRevert(RelayBranch.FeeExceeded.selector);
        branch.sponsor(id, PRICE, _empty());
        assertEq(token.transferCalls(), 0);
        assertEq(uint256(branch.phase()), uint256(T.Phase.Ready));
        assertEq(branch.attemptCount(), 0);
    }

    function test_missingCallbackStaysPendingIndefinitely() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        _pay(branch, id, _empty());
        vm.warp(type(uint64).max);
        vm.expectRevert(RelayBranch.Busy.selector);
        branch.sponsor(id, PRICE, _empty());
        vm.expectRevert(RelayBranch.Busy.selector);
        branch.retry(PRICE, _empty());
        vm.expectRevert(RelayBranch.Busy.selector);
        branch.bind(F.documentResult(), _empty());
        assertEq(uint256(branch.phase()), uint256(T.Phase.Pending));
        assertEq(branch.revision(), 0);
        assertEq(token.balanceOf(TREASURY), PRICE);
    }

    function test_refusedOnlyExplicitIdenticalRetryWithNewReceipt() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        uint256 other = branch.propose(_proposal(branch, T.Profile.ImageCreate, 2), _empty());
        bytes32 first = _pay(branch, id, _empty());
        vm.prank(WRITER);
        assertTrue(intake.fail(first, 1, bytes32("admission_refused")));
        assertEq(uint256(branch.phase()), uint256(T.Phase.Refused));
        assertEq(branch.revision(), 0);
        vm.expectRevert(RelayBranch.Busy.selector);
        branch.sponsor(other, PRICE, _empty());
        intake.setPrice(Policy.OPEN, 0.8 ether);
        vm.prank(SPONSOR);
        bytes32 second = branch.retry(0.8 ether, _empty());
        assertTrue(first != second);
        assertEq(branch.attemptCount(), 2);
        assertEq(branch.attempt(1).status, 1);
        assertTrue(branch.attempt(1).delivered);
        assertEq(branch.attempt(2).proposalId, id);
        assertEq(intake.request(first).body, intake.request(second).body);
        assertEq(branch.attempt(1).bodyHash, branch.attempt(2).bodyHash);
        assertEq(token.balanceOf(TREASURY), PRICE + 0.8 ether);
        assertEq(token.allowance(address(branch), Policy.INTAKE), 0);
        _record(second, F.documentResult());
        _bind(branch, F.documentResult(), _empty());
        assertEq(branch.revision(), 1); // Failed attempts never count as revisions.
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_nonRefusalFailureAlwaysFreezes(uint8 status) public {
        if (status == 1) status = 2;
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        bytes32 request = _pay(branch, id, _empty());
        vm.prank(WRITER);
        assertTrue(intake.fail(request, status, bytes32("failure")));
        assertEq(uint256(branch.phase()), uint256(T.Phase.Frozen));
        vm.expectRevert(RelayBranch.Busy.selector);
        branch.retry(PRICE, _empty());
        vm.expectRevert(RelayBranch.Busy.selector);
        branch.sponsor(id, PRICE, _empty());
        assertEq(branch.revision(), 0);
        assertEq(token.balanceOf(TREASURY), PRICE);
    }

    function test_callbacksAuthenticateSenderOwnRequestAndSingleDelivery() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        bytes32 request = _pay(branch, id, _empty());
        vm.expectRevert(RelayBranch.NotPending.selector);
        branch.onIntakeResult(request, keccak256(F.documentResult()), "uri");
        vm.expectRevert(RelayBranch.NotPending.selector);
        branch.onIntakeFailure(request, 1, "refused", 0, 0, "");
        vm.prank(Policy.INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        branch.onIntakeResult(bytes32("foreign request"), keccak256(F.documentResult()), "");
        vm.prank(Policy.INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        branch.onIntakeFailure(bytes32("foreign request"), 2, "failed", 0, 0, "");
        _record(request, F.documentResult());
        vm.prank(Policy.INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        branch.onIntakeResult(request, keccak256(F.documentResult()), "");
        vm.prank(Policy.INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        branch.onIntakeFailure(request, 2, "failed", 0, 0, "");
    }

    function test_foreignIntakeRequestCannotSettleBranch() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        _pay(branch, id, _empty());
        token.mint(address(this), PRICE);
        token.approve(Policy.INTAKE, PRICE);
        bytes32 foreign = intake.requestWithFailure(
            Policy.OPEN,
            "{}",
            IIntake.Callback(address(branch), branch.onIntakeResult.selector),
            branch.onIntakeFailure.selector,
            Policy.IMD,
            PRICE
        );
        vm.prank(WRITER);
        assertFalse(intake.fail(foreign, 1, "refused"));
        assertEq(uint256(branch.phase()), uint256(T.Phase.Pending));
    }

    function test_stipendCallbackOnlyRecordsAndBindingIsPermissionless() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        bytes32 request = _pay(branch, id, _empty());
        bytes32 checkpoint = branch.anchor();
        _record(request, F.documentResult()); // Mock enforces 200,000 gas.
        assertEq(branch.anchor(), checkpoint);
        assertEq(branch.latestJobId(), "");
        assertEq(branch.projectId(), "");
        assertEq(branch.attempt(1).outcome, keccak256(F.documentResult()));
        assertEq(uint256(branch.phase()), uint256(T.Phase.ResultRecorded));
        _bind(branch, F.documentResult(), _empty()); // Binder is not the sponsor or writer.
        assertEq(uint256(branch.phase()), uint256(T.Phase.Ready));
        assertEq(branch.revision(), 1);
        assertEq(token.balanceOf(TREASURY), PRICE);
    }

    function test_tokenReentrancyAndSynchronousCallbackAreRejected() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        token.setHook(address(branch), abi.encodeCall(branch.sponsor, (id, PRICE, _empty())));
        intake.configure(false, true);
        bytes32 request = _pay(branch, id, _empty());
        assertFalse(token.hookSucceeded());
        assertFalse(intake.synchronousDelivered());
        assertEq(branch.attemptCount(), 1);
        _record(request, F.documentResult());
        _bind(branch, F.documentResult(), _empty());
    }

    function test_feeOnTransferSenderTaxFalseAndPartialPullRevertAtomically() public {
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        for (uint8 mode = 1; mode <= 3; ++mode) {
            token.configure(mode, false);
            vm.prank(SPONSOR);
            vm.expectRevert();
            branch.sponsor(id, PRICE, _empty());
            assertEq(token.balanceOf(SPONSOR), 1000 ether);
            assertEq(token.balanceOf(TREASURY), 0);
            assertEq(uint256(branch.phase()), uint256(T.Phase.Ready));
        }
        token.configure(0, false);
        intake.configure(true, false);
        vm.prank(SPONSOR);
        vm.expectRevert(RelayBranch.PaymentMismatch.selector);
        branch.sponsor(id, PRICE, _empty());
        assertEq(token.balanceOf(SPONSOR), 1000 ether);
        assertEq(token.allowance(address(branch), Policy.INTAKE), 0);
    }

    function test_noReturnTokenAndStickyAllowanceCleared() public {
        token.configure(4, true);
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        _pay(branch, id, _empty());
        assertEq(token.allowance(address(branch), Policy.INTAKE), 0);
        assertEq(token.balanceOf(address(branch)), 0);
        assertEq(token.balanceOf(TREASURY), PRICE);
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_exactDynamicFeeConservesBalances(uint96 rawPrice) public {
        uint256 price = uint256(rawPrice) % (10 ether) + 1;
        intake.setPrice(Policy.OPEN, price);
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        vm.prank(SPONSOR);
        branch.sponsor(id, price, _empty());
        assertEq(token.balanceOf(SPONSOR) + token.balanceOf(TREASURY), 1000 ether);
        assertEq(token.balanceOf(TREASURY), price);
        assertEq(token.balanceOf(address(branch)), 0);
        assertEq(token.allowance(address(branch), Policy.INTAKE), 0);
    }
}
