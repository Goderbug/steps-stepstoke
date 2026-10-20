// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SpecSetup, SpecData as D} from "./SpecSupport.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {IIntake} from "src/interfaces/IIntake.sol";

contract PaymentSpecTest is SpecSetup {
    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_priceChangeCapAndDonationsConserveEveryWei(uint96 priceSeed, uint64 donation) public {
        uint256 price = uint256(priceSeed) % (100 ether) + 1;
        vm.prank(BOB);
        token.transfer(address(root), donation);
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        intake.setPrice(OPEN, price);
        uint256 transfers = token.transfers();
        vm.prank(ALICE);
        vm.expectRevert(RelayBranch.FeeExceeded.selector);
        root.sponsor(id, price - 1, empty());
        assertEq(token.transfers(), transfers);
        assertEq(token.balanceOf(ALICE), INITIAL);
        assertEq(root.attemptCount(), 0);
        vm.prank(ALICE);
        bytes32 request = root.sponsor(id, price, empty());
        assertEq(token.balanceOf(ALICE), INITIAL - price);
        assertEq(token.balanceOf(BOB), INITIAL - donation);
        assertEq(intake.observedApproval(), price);
        assertEq(intake.receipt(request).amount, price);
        assertEq(root.attempt(1).fee, price);
        assertEq(root.attempt(1).sponsor, ALICE);
        assertAccounting(price, donation);
    }

    function test_exactWholeBalanceAndMaxFeeDoesNotOvercharge() public {
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        intake.setPrice(OPEN, INITIAL);
        pay(root, id, empty(), ALICE);
        assertEq(token.balanceOf(ALICE), 0);
        assertEq(token.balanceOf(BOB), INITIAL);
        assertAccounting(INITIAL, 0);
    }

    function test_insufficientApprovalAndBalanceRollbackBeforeAnyReceipt() public {
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        vm.prank(ALICE);
        token.approve(address(root), FEE - 1);
        vm.prank(ALICE);
        vm.expectRevert(bytes("test token: allowance"));
        root.sponsor(id, FEE, empty());
        vm.prank(ALICE);
        token.approve(address(root), type(uint256).max);
        intake.setPrice(OPEN, INITIAL + 1);
        vm.prank(ALICE);
        vm.expectRevert(bytes("test token: balance"));
        root.sponsor(id, type(uint256).max, empty());
        assertEq(root.attemptCount(), 0);
        assertEq(root.activeProposal(), 0);
        assertEq(intake.count(), 0);
        assertEq(uint256(root.phase()), uint256(T.Phase.Ready));
        assertAccounting(0, 0);
        intake.setPrice(OPEN, FEE);
        pay(root, id, empty(), BOB);
        assertAccounting(FEE, 0);
    }

    function test_intakeRevertPartialPullZeroIdAndClearFailureRollbackAllEffects() public {
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        for (uint8 fault = 1; fault <= 4; ++fault) {
            intake.setFault(fault == 4 ? 0 : fault, bytes32(0));
            token.setRejectClear(fault == 4);
            vm.prank(ALICE);
            vm.expectRevert();
            root.sponsor(id, FEE, empty());
            assertEq(root.attemptCount(), 0);
            assertEq(root.activeAttempt(), 0);
            assertEq(root.activeProposal(), 0);
            assertEq(intake.count(), 0);
            assertEq(token.transfers(), 0);
            assertEq(token.allowance(ALICE, address(root)), INITIAL);
            assertEq(uint256(root.phase()), uint256(T.Phase.Ready));
            assertAccounting(0, 0);
        }
        token.setRejectClear(false);
        intake.setFault(0, 0);
        pay(root, id, empty(), ALICE);
        assertAccounting(FEE, 0);
    }

    function test_reusedIntakeRequestIdOnRetryCannotOverwriteAttemptOrDoubleCharge() public {
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        bytes32 request = pay(root, id, empty(), ALICE);
        vm.prank(WRITER);
        assertTrue(intake.failure(request, 1, "body_refused"));
        bytes memory receiptBefore = abi.encode(root.attempt(1));
        intake.setFault(3, request);
        vm.prank(BOB);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.retry(FEE, empty());
        assertEq(abi.encode(root.attempt(1)), receiptBefore);
        assertEq(root.requestAttempt(request), 1);
        assertEq(root.attemptCount(), 1);
        assertEq(uint256(root.phase()), uint256(T.Phase.Refused));
        assertAccounting(FEE, 0);
        intake.setFault(0, 0);
        vm.prank(BOB);
        bytes32 retry = root.retry(FEE, empty());
        assertTrue(retry != request);
        assertEq(root.requestAttempt(retry), 2);
        assertAccounting(2 * FEE, 0);
    }

    function test_refusalCannotSubstituteProposalAndRetryRacesCostOnlyWinner() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        uint256 id = root.propose(p, empty());
        bytes32 first = pay(root, id, empty(), ALICE);
        bytes memory boughtBody = intake.receipt(first).body;
        bytes32 anchorBefore = root.anchor();
        vm.prank(WRITER);
        assertTrue(intake.failure(first, 1, "admission_refused"));
        assertEq(root.revision(), 0);
        p.text = "Substitution after refusal.";
        uint256 substitute = root.propose(p, empty());
        vm.prank(BOB);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.sponsor(substitute, FEE, empty());
        intake.setPrice(OPEN, FEE + 1);
        vm.prank(BOB);
        vm.expectRevert(RelayBranch.FeeExceeded.selector);
        root.retry(FEE, empty());
        assertEq(root.activeProposal(), id);
        vm.prank(BOB);
        bytes32 second = root.retry(FEE + 1, empty());
        vm.prank(ALICE);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.retry(FEE + 1, empty());
        assertEq(intake.receipt(second).body, boughtBody);
        assertEq(root.attempt(2).bodyHash, root.attempt(1).bodyHash);
        assertEq(root.attempt(2).proposalId, id);
        assertEq(root.attempt(2).sponsor, BOB);
        assertEq(root.anchor(), anchorBefore);
        assertEq(root.revision(), 0);
        // Correct sender, old refused request: both callback selectors must reject.
        vm.prank(INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeResult(first, keccak256("late old result"), "");
        vm.prank(INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeFailure(first, 2, "late failure", 0, 0, "");
        assertEq(uint256(root.phase()), uint256(T.Phase.Pending));
        assertEq(root.attempt(2).outcome, bytes32(0));
        bytes memory raw = D.manifest(root.proposal(id), "retry-job", "retry-project", D.document());
        record(second, raw);
        root.bind(raw, empty());
        assertEq(root.revision(), 1);
        assertAccounting(2 * FEE + 1, 0);
    }

    function test_continuationRetryRetainsParentAndFullSelectedSnapshot() public {
        T.Asset[] memory old = accept(
            root,
            proposal(root, T.Profile.MarkdownCreate, 3),
            empty(),
            "own-parent",
            "own-project",
            D.document(),
            ALICE
        );
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownUpdate, 3), old);
        bytes32 first = pay(root, id, old, BOB);
        bytes memory body = intake.receipt(first).body;
        assertTrue(contains(body, '"parentJobId":"own-parent"'));
        vm.prank(WRITER);
        assertTrue(intake.failure(first, 1, "admission_refused"));
        T.Asset[] memory changed = abi.decode(abi.encode(old), (T.Asset[]));
        changed[0].submissionHash = sha256("later Git export");
        vm.prank(ALICE);
        vm.expectRevert(RelayBranch.InvalidWitness.selector);
        root.retry(FEE, changed);
        vm.prank(ALICE);
        bytes32 second = root.retry(FEE, old);
        assertEq(intake.receipt(second).body, body);
        assertEq(intake.receipt(second).action, CONTINUE);
        assertEq(root.latestJobId(), "own-parent");
        assertEq(root.revision(), 1);
        assertAccounting(3 * FEE, 0);
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_unknownFailureFrozenDespiteNewProposalsAndTime(uint8 status) public {
        if (status == 1) status = 0;
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        bytes32 request = pay(root, id, empty(), ALICE);
        vm.prank(WRITER);
        assertTrue(intake.failure(request, status, "unknown-outcome"));
        uint256 competing = root.propose(proposal(root, T.Profile.HTMLCreate, 2), empty());
        vm.warp(type(uint64).max);
        vm.prank(BOB);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.sponsor(competing, type(uint256).max, empty());
        vm.prank(BOB);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.retry(type(uint256).max, empty());
        vm.prank(INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeResult(request, keccak256("later answer"), "");
        assertEq(uint256(root.phase()), uint256(T.Phase.Frozen));
        assertEq(root.attempt(1).status, status);
        assertEq(root.revision(), 0);
        assertAccounting(FEE, 0);
    }

    function test_missingCallbackHasNoTimeoutButAuthenticLateCallbackStillWorks() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        uint256 id = root.propose(p, empty());
        bytes32 request = pay(root, id, empty(), ALICE);
        vm.warp(type(uint64).max);
        vm.prank(BOB);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.sponsor(id, FEE, empty());
        vm.prank(BOB);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.retry(FEE, empty());
        bytes memory raw = D.manifest(p, "late-job", "late-project", D.document());
        vm.expectRevert(RelayBranch.Busy.selector);
        root.bind(raw, empty());
        assertEq(uint256(root.phase()), uint256(T.Phase.Pending));
        record(request, raw);
        root.bind(raw, empty());
        assertEq(root.revision(), 1);
        assertAccounting(FEE, 0);
    }

    function test_maximumCallbackURIWithinStipendAndOversizeFailureStaysPending() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        uint256 id = root.propose(p, empty());
        bytes32 request = pay(root, id, empty(), ALICE);
        bytes memory raw = D.manifest(p, "uri-job", "uri-project", D.document());
        vm.prank(WRITER);
        assertTrue(intake.result(request, keccak256(raw), string(D.repeat("u", 1024))));
        assertEq(root.revision(), 0);
        root.bind(raw, empty());
        T.Asset[] memory assets = D.next(empty(), D.output(p, "uri-job", D.document(), raw, address(root), 1));
        id = root.propose(proposal(root, T.Profile.MarkdownUpdate, 1), assets);
        request = pay(root, id, assets, BOB);
        vm.prank(WRITER);
        assertFalse(intake.result(request, keccak256(raw), string(D.repeat("u", 1025))));
        assertTrue(intake.receipt(request).attempted);
        assertFalse(intake.receipt(request).delivered);
        assertFalse(root.attempt(2).delivered);
        assertEq(uint256(root.phase()), uint256(T.Phase.Pending));
        vm.warp(type(uint64).max);
        vm.prank(ALICE);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.retry(FEE, assets);
        assertEq(root.revision(), 1);
        assertAccounting(2 * FEE, 0);
    }

    function test_malformedResultIsRecordedWithoutParsingThenBadBindingPreservesIt() public {
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        bytes32 request = pay(root, id, empty(), ALICE);
        bytes memory raw = hex"ff00c0";
        bytes32 checkpointBefore = root.anchor();
        record(request, raw);
        assertEq(root.attempt(1).outcome, keccak256(raw));
        assertEq(uint256(root.phase()), uint256(T.Phase.ResultRecorded));
        vm.expectRevert();
        root.bind(raw, empty());
        assertEq(root.anchor(), checkpointBefore);
        assertEq(root.attempt(1).outcome, keccak256(raw));
        assertEq(root.revision(), 0);
        vm.prank(INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeFailure(request, 1, "replacement", 0, 0, "");
        vm.prank(BOB);
        vm.expectRevert(RelayBranch.Busy.selector);
        root.retry(FEE, empty());
        assertAccounting(FEE, 0);
    }

    function test_spoofForeignCrossBranchAndReplayCallbacksCannotSettleOwnRequest() public {
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        bytes32 own = pay(root, id, empty(), ALICE);
        RelayBranch other = factory.createProject("Another independent public project.");
        approveBoth(other);
        uint256 otherId = other.propose(proposal(other, T.Profile.MarkdownCreate, 1), empty());
        bytes32 otherRequest = pay(other, otherId, empty(), BOB);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeResult(own, keccak256("spoof"), "");
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeFailure(own, 1, "spoof", 0, 0, "");
        vm.prank(INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeResult(otherRequest, keccak256("cross-branch"), "");
        vm.prank(INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeFailure(otherRequest, 2, "cross-branch", 0, 0, "");

        // A stranger can purchase an Intake request naming the victim callback.
        vm.prank(BOB);
        token.approve(INTAKE, FEE);
        vm.prank(BOB);
        bytes32 foreign = intake.requestWithFailure(
            OPEN,
            "{}",
            IIntake.Callback(address(root), root.onIntakeResult.selector),
            root.onIntakeFailure.selector,
            IMD,
            FEE
        );
        vm.prank(WRITER);
        assertFalse(intake.failure(foreign, 1, "body_refused"));
        assertEq(uint256(root.phase()), uint256(T.Phase.Pending));
        T.Proposal memory p = root.proposal(id);
        bytes memory raw = D.manifest(p, "own-job", "own-project", D.document());
        record(own, raw);
        vm.prank(INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeResult(own, keccak256(raw), "");
        vm.prank(INTAKE);
        vm.expectRevert(RelayBranch.NotPending.selector);
        root.onIntakeFailure(own, 2, "replay", 0, 0, "");
        root.bind(raw, empty());
        assertEq(other.revision(), 0);
        assertEq(uint256(other.phase()), uint256(T.Phase.Pending));
        assertAccounting(3 * FEE, 0);
    }

    function test_reentrancyAtTransferApprovalAndIntakeCannotProposeOrBuyAgain() public {
        for (uint8 operation = 1; operation <= 3; ++operation) {
            RelayBranch b = operation == 1 ? root : factory.createProject("Reentrancy test project.");
            approveBoth(b);
            T.Proposal memory p = proposal(b, T.Profile.MarkdownCreate, 1);
            uint256 id = b.propose(p, empty());
            bytes memory attack = abi.encodeCall(b.propose, (p, empty()));
            if (operation < 3) token.arm(address(b), attack, operation);
            else intake.arm(address(b), attack);
            pay(b, id, empty(), ALICE);
            if (operation < 3) assertFalse(token.hookSucceeded());
            else assertFalse(intake.attackSucceeded());
            assertEq(b.proposalCount(), 1);
            assertEq(b.attemptCount(), 1);
            assertEq(token.allowance(address(b), INTAKE), 0);
            assertEq(uint256(b.phase()), uint256(T.Phase.Pending));
        }
        assertAccounting(3 * FEE, 0);
    }

    function test_synchronousIntakeResultAndFailureCannotSettlePurchasingState() public {
        uint256 id = root.propose(proposal(root, T.Profile.MarkdownCreate, 1), empty());
        bytes32 predictedRequest = keccak256(abi.encode(address(root), uint256(1)));
        intake.arm(
            address(root), abi.encodeCall(root.onIntakeResult, (predictedRequest, keccak256("sync"), ""))
        );
        bytes32 request = pay(root, id, empty(), ALICE);
        assertEq(request, predictedRequest);
        assertFalse(intake.attackSucceeded());
        vm.prank(WRITER);
        assertTrue(intake.failure(request, 1, "refused"));
        predictedRequest = keccak256(abi.encode(address(root), uint256(2)));
        intake.arm(
            address(root),
            abi.encodeCall(
                root.onIntakeFailure,
                (predictedRequest, uint8(2), bytes32("sync"), uint16(0), uint16(0), bytes(""))
            )
        );
        vm.prank(BOB);
        root.retry(FEE, empty());
        assertFalse(intake.attackSucceeded());
        assertEq(uint256(root.phase()), uint256(T.Phase.Pending));
        assertFalse(root.attempt(2).delivered);
        assertAccounting(2 * FEE, 0);
    }
}
