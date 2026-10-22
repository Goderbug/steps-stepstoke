// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {TestBase} from "../TestBase.sol";
import {SpecSetup, SpecData as D, SpecToken, SpecIntake} from "../adversarial/SpecSupport.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {RelayFactory} from "src/RelayFactory.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";

interface AtomicityVm {
    function chainId(uint256) external;
}

/// @dev Complements the existing lifecycle model with random dependency faults on
/// BOTH fresh purchases and retries. Successful calls and required reverts are checked;
/// unexpected reverts fail the campaign. All actors and dependencies are local mocks.
contract PurchaseAtomicityHandler is TestBase {
    struct Model {
        T.Phase phase;
        T.Asset[] assets;
        T.Attempt[] attempts;
        bytes32[] history;
        bytes raw;
        T.Asset output;
        uint256 proposalId;
        uint256 donations;
        uint256[2] paid;
    }

    SpecToken private token;
    SpecIntake private intake;
    RelayBranch[2] private branches;
    Model[2] private models;
    address[2] private actors;
    address private writer;
    address private treasury;
    uint256 private initial;
    uint256[2] private donated;
    uint256 public successes;
    uint256 public rejections;
    uint256 public retries;
    uint256 public bindings;
    uint256 public reentrancyProbes;
    uint256[12] public exercisedModes;
    bytes32 private constant OPEN = bytes32("job.open@job-1");
    bytes32 private constant CONTINUE = bytes32("job.continue@job-1");

    constructor(
        RelayBranch root,
        RelayFactory factory,
        SpecToken token_,
        SpecIntake intake_,
        address alice,
        address bob,
        address writer_,
        address treasury_,
        uint256 initial_
    ) {
        token = token_;
        intake = intake_;
        actors = [alice, bob];
        writer = writer_;
        treasury = treasury_;
        initial = initial_;
        branches[0] = root;
        branches[1] = factory.createProject("Independent payment fault campaign.");
        for (uint256 i; i < 2; ++i) {
            for (uint256 j; j < 2; ++j) {
                vm.prank(actors[j]);
                token.approve(address(branches[i]), initial);
            }
            models[i].history.push(branches[i].anchor());
            _propose(i);
        }
    }

    /// @dev Constructive bounds: fee 1..1 ether, two branches, two sponsors, twelve
    /// fault/hook modes. No assume/discard paths or privileged SUT storage writes.
    function purchase(uint256 branchSeed, bool secondActor, uint96 feeSeed, uint8 faultSeed) external {
        uint256 i = branchSeed % 2;
        uint256 actor = secondActor ? 1 : 0;
        uint8 fault = faultSeed % 12;
        uint256 fee = uint256(feeSeed) % 1 ether + 1;
        RelayBranch b = branches[i];
        Model storage m = models[i];
        bool retrying = m.phase == T.Phase.Refused;
        bool eligible = m.phase == T.Phase.Ready || retrying;
        bytes32 action = m.assets.length == 0 ? OPEN : CONTINUE;
        intake.setPrice(action, fee);
        bytes32 reused = m.attempts.length == 0 ? bytes32(0) : m.attempts[0].requestId;
        intake.setFault(fault <= 3 ? fault : fault == 4 ? 3 : 0, fault == 4 ? reused : bytes32(0));
        token.setRejectClear(fault == 5);
        uint256 allowanceBefore = token.allowance(actors[actor], address(b));
        if (fault == 7) {
            vm.prank(actors[actor]);
            token.approve(address(b), fee - 1);
        }
        _arm(i, fault);
        uint256 transfersBefore = token.transfers();
        uint256 countBefore = intake.count();
        uint256 allowanceAtCall = token.allowance(actors[actor], address(b));
        bytes memory body;
        if (eligible) (, body) = b.bodyOf(m.proposalId, m.assets);
        if (retrying) assertEq(keccak256(body), m.attempts[m.attempts.length - 1].bodyHash);
        bytes memory callData = retrying
            ? abi.encodeCall(b.retry, (fault == 6 ? fee - 1 : fee, m.assets))
            : abi.encodeCall(b.sponsor, (m.proposalId, fault == 6 ? fee - 1 : fee, m.assets));
        vm.prank(actors[actor]);
        (bool ok, bytes memory returned) = address(b).call(callData);
        bool expected = eligible && (fault == 0 || fault >= 8);
        require(ok == expected, "purchase acceptance differs from independent fault model");
        if (expected) {
            bytes32 request = abi.decode(returned, (bytes32));
            require(request != 0, "zero receipt accepted");
            m.attempts
                .push(T.Attempt(m.proposalId, actors[actor], fee, request, keccak256(body), 0, 0, false));
            m.paid[actor] += fee;
            m.phase = T.Phase.Pending;
            ++successes;
            if (retrying) ++retries;
            if (fault >= 8) {
                if (fault <= 9) require(!token.hookSucceeded(), "token hook reentered branch");
                else require(!intake.attackSucceeded(), "synchronous callback settled a purchase");
                ++reentrancyProbes;
            }
            assertEq(token.transfers(), transfersBefore + 2);
            assertEq(intake.count(), countBefore + 1);
            assertEq(intake.observedApproval(), fee);
        } else {
            ++rejections;
            assertEq(token.transfers(), transfersBefore);
            assertEq(intake.count(), countBefore);
            assertEq(token.allowance(actors[actor], address(b)), allowanceAtCall);
            if (!eligible) _selector(returned, RelayBranch.Busy.selector);
            else if (fault == 2) _selector(returned, RelayBranch.PaymentMismatch.selector);
            else if (fault == 3 || fault == 4) _selector(returned, RelayBranch.NotPending.selector);
            else if (fault == 6) _selector(returned, RelayBranch.FeeExceeded.selector);
        }
        if (eligible) ++exercisedModes[fault];
        // Reset only dependency faults, never Branch state, model state or earned history.
        token.setRejectClear(false);
        token.arm(address(0), "", 0);
        intake.setFault(0, 0);
        intake.arm(address(0), "");
        if (fault == 7) {
            vm.prank(actors[actor]);
            token.approve(address(b), allowanceBefore);
        }
        check();
    }

    function _arm(uint256 i, uint8 fault) private {
        RelayBranch b = branches[i];
        Model storage m = models[i];
        if (fault == 8 || fault == 9) {
            token.arm(
                address(b), abi.encodeCall(b.sponsor, (m.proposalId, type(uint256).max, m.assets)), fault - 7
            );
        } else if (fault >= 10) {
            // The real ID is predictable in this mock, so rejection cannot be due to
            // accidentally attacking a different receipt.
            bytes32 predicted = keccak256(abi.encode(address(b), intake.count() + 1));
            bytes memory attack = fault == 10
                ? abi.encodeCall(b.onIntakeResult, (predicted, keccak256("sync-result"), ""))
                : abi.encodeCall(
                    b.onIntakeFailure,
                    (predicted, uint8(1), bytes32("sync-refusal"), uint16(0), uint16(0), bytes(""))
                );
            intake.arm(address(b), attack);
        }
    }

    function respond(uint256 branchSeed, bool success) external {
        uint256 i = branchSeed % 2;
        Model storage m = models[i];
        if (m.phase != T.Phase.Pending) return;
        RelayBranch b = branches[i];
        T.Attempt storage a = m.attempts[m.attempts.length - 1];
        if (success) {
            string memory job = string.concat("fault-job-", D.decimal(i), "-", D.decimal(m.attempts.length));
            string memory project = string.concat("fault-project-", D.decimal(i));
            bytes memory file = bytes.concat(D.document(), bytes(D.decimal(m.history.length)));
            T.Proposal memory p = b.proposal(m.proposalId);
            m.raw = D.manifest(p, job, project, file);
            m.output = D.output(p, job, file, m.raw, address(b), uint64(m.history.length));
            a.outcome = keccak256(m.raw);
            vm.prank(writer);
            require(intake.result(a.requestId, a.outcome, "local://fault-model"), "result delivery failed");
            m.phase = T.Phase.ResultRecorded;
        } else {
            a.status = 1;
            a.outcome = keccak256("explicit refusal");
            vm.prank(writer);
            require(intake.failure(a.requestId, 1, a.outcome), "refusal delivery failed");
            m.phase = T.Phase.Refused;
        }
        a.delivered = true;
        check();
    }

    function bind(uint256 branchSeed, bool corrupt) external {
        uint256 i = branchSeed % 2;
        Model storage m = models[i];
        RelayBranch b = branches[i];
        bytes memory raw = corrupt ? bytes.concat(m.raw, " ") : m.raw;
        if (m.phase != T.Phase.ResultRecorded || corrupt) {
            (bool ok,) = address(b).call(abi.encodeCall(b.bind, (raw, m.assets)));
            require(!ok, "invalid bind changed the branch");
            ++rejections;
        } else {
            b.bind(raw, m.assets);
            delete m.assets;
            m.assets.push(m.output);
            m.phase = T.Phase.Ready;
            assertEq(b.revision(), m.history.length);
            assertEq(b.checkpoint(uint64(m.history.length)).resultHash, keccak256(raw));
            m.history.push(b.anchor());
            ++bindings;
            _propose(i);
        }
        check();
    }

    function donate(uint256 branchSeed, bool secondActor, uint64 amountSeed) external {
        uint256 i = branchSeed % 2;
        uint256 actor = secondActor ? 1 : 0;
        uint256 amount = uint256(amountSeed) % 1 ether;
        vm.prank(actors[actor]);
        token.transfer(address(branches[i]), amount);
        donated[actor] += amount;
        models[i].donations += amount;
        check();
    }

    function crossBranchCallback(uint256 branchSeed, uint256 attemptSeed, bool authenticSender) external {
        uint256 i = branchSeed % 2;
        Model storage foreign = models[1 - i];
        bytes32 request = foreign.attempts.length == 0
            ? bytes32(0)
            : foreign.attempts[attemptSeed % foreign.attempts.length].requestId;
        RelayBranch b = branches[i];
        if (authenticSender) vm.prank(address(intake));
        (bool ok, bytes memory reason) =
            address(b).call(abi.encodeCall(b.onIntakeResult, (request, keccak256("foreign"), "")));
        require(!ok, "foreign success callback accepted");
        _selector(reason, RelayBranch.NotPending.selector);
        if (authenticSender) vm.prank(address(intake));
        (ok, reason) = address(b)
            .call(
                abi.encodeCall(
                    b.onIntakeFailure,
                    (request, uint8(1), bytes32("foreign"), uint16(0), uint16(0), bytes(""))
                )
            );
        require(!ok, "foreign failure callback accepted");
        _selector(reason, RelayBranch.NotPending.selector);
        check();
    }

    function _propose(uint256 i) private {
        Model storage m = models[i];
        T.Proposal memory p;
        p.anchor = m.history[m.history.length - 1];
        p.profile = m.assets.length == 0 ? T.Profile.MarkdownCreate : T.Profile.MarkdownUpdate;
        p.target = bytes32(uint256(1));
        p.inputs = new bytes32[](m.assets.length);
        if (p.inputs.length != 0) p.inputs[0] = p.target;
        p.outputName = "notes";
        p.outputPath = "artifacts/notes.md";
        p.text = "Preserve the accepted notes.";
        m.proposalId = branches[i].propose(p, m.assets);
    }

    function check() public view {
        uint256 totalPaid;
        uint256 totalDonations;
        for (uint256 i; i < 2; ++i) {
            Model storage m = models[i];
            RelayBranch b = branches[i];
            assertEq(uint256(b.phase()), uint256(m.phase));
            assertEq(b.activeAttempt(), m.attempts.length);
            assertEq(b.attemptCount(), m.attempts.length);
            assertEq(
                b.activeProposal(), m.attempts.length == 0 ? 0 : m.attempts[m.attempts.length - 1].proposalId
            );
            assertEq(b.revision(), m.history.length - 1);
            assertEq(b.proposalCount(), m.history.length);
            assertEq(b.assetsHash(), keccak256(abi.encode(m.assets)));
            assertEq(token.balanceOf(address(b)), m.donations);
            assertEq(token.allowance(address(b), address(intake)), 0);
            totalDonations += m.donations;
            for (uint256 j; j < m.history.length; ++j) {
                assertEq(b.checkpoint(uint64(j)).digest, m.history[j]);
            }
            for (uint256 j; j < m.attempts.length; ++j) {
                T.Attempt storage a = m.attempts[j];
                assertEq(abi.encode(b.attempt(j + 1)), abi.encode(a));
                assertEq(b.requestAttempt(a.requestId), j + 1);
                SpecIntake.Receipt memory r = intake.receipt(a.requestId);
                assertEq(r.payer, address(b));
                assertEq(r.callback.target, address(b));
                assertEq(bytes32(r.callback.selector), bytes32(b.onIntakeResult.selector));
                assertEq(bytes32(r.failure), bytes32(b.onIntakeFailure.selector));
                assertEq(r.amount, a.fee);
                assertEq(keccak256(r.body), a.bodyHash);
                require(r.attempted == a.delivered && r.delivered == a.delivered, "callback receipt diverged");
                totalPaid += a.fee;
            }
            for (uint256 actor; actor < 2; ++actor) {
                assertEq(token.allowance(actors[actor], address(b)), initial - m.paid[actor]);
            }
        }
        for (uint256 actor; actor < 2; ++actor) {
            assertEq(
                token.balanceOf(actors[actor]),
                initial - models[0].paid[actor] - models[1].paid[actor] - donated[actor]
            );
        }
        assertEq(token.totalSupply(), 2 * initial);
        assertEq(token.balanceOf(treasury), totalPaid);
        assertEq(intake.collected(), totalPaid);
        assertEq(intake.count(), successes);
        assertEq(token.balanceOf(address(intake)), 0);
        assertEq(
            token.balanceOf(actors[0]) + token.balanceOf(actors[1]) + totalPaid + totalDonations, 2 * initial
        );
    }

    function _selector(bytes memory reason, bytes4 expected) private pure {
        require(reason.length == 4 && bytes4(reason) == expected, "unexpected rejection reason");
    }
}

contract PurchaseAtomicityInvariantTest is SpecSetup {
    PurchaseAtomicityHandler private handler;

    function setUp() public override {
        AtomicityVm(address(vm)).chainId(1);
        super.setUp();
        handler =
            new PurchaseAtomicityHandler(root, factory, token, intake, ALICE, BOB, WRITER, TREASURY, INITIAL);
        // Start with both a paid continuation and a refused request, so random
        // sequences immediately reach retry rollback and existing-receipt protection.
        handler.purchase(0, false, 0, 0);
        handler.respond(0, true);
        handler.bind(0, false);
        handler.purchase(1, true, 0, 0);
        handler.respond(1, false);
    }

    function targetContracts() external view returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    /// forge-config: default.invariant.runs = 256
    /// forge-config: default.invariant.depth = 96
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_faultsNeverSpendDonationsOrRewriteReceipts() public view {
        handler.check();
    }

    function test_allFaultsOnContinuationAndRetryThenRecovery() public {
        handler.donate(0, true, 1);
        handler.donate(1, false, 1 ether);
        for (uint8 fault = 1; fault <= 7; ++fault) {
            handler.purchase(0, false, 0, fault); // one-wei fee
            handler.purchase(1, true, type(uint96).max, fault);
            assertEq(handler.exercisedModes(fault), 2);
        }
        for (uint8 hook = 8; hook <= 11; ++hook) {
            handler.purchase(0, false, 123, hook);
            handler.purchase(1, true, 456, hook);
            handler.crossBranchCallback(0, 0, true);
            handler.crossBranchCallback(1, 0, false);
            handler.respond(0, false);
            handler.respond(1, false);
        }
        handler.purchase(0, true, 0, 0);
        handler.respond(0, true);
        handler.bind(0, true);
        handler.bind(0, false);
        handler.check();
        assertEq(handler.reentrancyProbes(), 8);
        assertEq(handler.bindings(), 2);
        assertEq(handler.rejections(), 15);
        assertTrue(handler.retries() >= 8);
    }
}
