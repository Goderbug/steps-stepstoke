// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SpecSetup, SpecData as D, SpecToken, SpecIntake} from "./SpecSupport.sol";
import {TestBase} from "../TestBase.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {RelayFactory} from "src/RelayFactory.sol";

/// @dev A ghost model, not a handler which reads phase/revision from the SUT to
/// decide what must succeed. Each operation checks the model's own state.
contract SpecStateHandler is TestBase {
    struct Model {
        T.Asset[] assets;
        T.Checkpoint[] history;
        bytes[] witnesses;
        T.Attempt[] attempts;
        T.Phase phase;
        T.Source source;
        string goal;
        string direction;
        string latestJob;
        string project;
        uint256 lastProposal;
        uint256 previousProposal;
        uint256 proposalCount;
        uint256 activeProposal;
        uint256 donation;
        bytes raw;
        T.Asset pendingOutput;
        string pendingProject;
    }

    RelayFactory private factory;
    SpecToken private token;
    SpecIntake private intake;
    address private alice;
    address private bob;
    address private writer;
    address private treasury;
    uint256 private initial;
    RelayBranch[] private branches;
    mapping(address => Model) private models;
    mapping(address => mapping(uint256 => bytes)) private proposals;
    uint256 private spentAlice;
    uint256 private spentBob;
    uint256 private donatedAlice;
    uint256 private donatedBob;
    uint256 private paidAttempts;
    uint256 public boundRounds;
    uint256 public forkedBranches;
    uint256 public refusedAttempts;
    uint256 public rejectedCalls;
    uint256 public retriedAttempts;

    constructor(
        RelayFactory factory_,
        RelayBranch root_,
        SpecToken token_,
        SpecIntake intake_,
        address alice_,
        address bob_,
        address writer_,
        address treasury_,
        uint256 initial_
    ) {
        factory = factory_;
        token = token_;
        intake = intake_;
        alice = alice_;
        bob = bob_;
        writer = writer_;
        treasury = treasury_;
        initial = initial_;
        createModel(root_, new T.Asset[](0), T.Source(address(0), 0, 0), "");
    }

    function propose(uint256 branchSeed, uint8 kindSeed, uint256 words) external {
        RelayBranch b = pick(branchSeed);
        Model storage m = models[address(b)];
        uint8 k = kindSeed % 3;
        uint256 key = k == 0 ? 30 : k == 1 ? 10 : 20;
        bool exists = has(m, bytes32(key));
        // Image editing is disabled. Revisit the document slot instead.
        if (k == 2 && exists) {
            k = 0;
            key = 30;
            exists = has(m, bytes32(key));
        }
        T.Proposal memory p;
        p.anchor = m.history[m.history.length - 1].digest;
        p.target = bytes32(key);
        p.profile = k == 0
            ? (exists ? T.Profile.MarkdownUpdate : T.Profile.MarkdownCreate)
            : k == 1 ? (exists ? T.Profile.HTMLUpdate : T.Profile.HTMLCreate) : T.Profile.ImageCreate;
        p.outputName = k == 0 ? "notes" : k == 1 ? "page" : "pixel";
        p.outputPath = k == 0 ? "docs/notes.md" : k == 1 ? "dist/index.html" : "art/pixel.png";
        p.text = string.concat("Explicit model change ", D.decimal(words));
        bool imageInput = k == 1 && has(m, bytes32(uint256(20)));
        p.inputs = new bytes32[]((exists ? 1 : 0) + (imageInput ? 1 : 0));
        if (exists) p.inputs[0] = bytes32(key);
        if (imageInput) p.inputs[p.inputs.length - 1] = bytes32(uint256(20));
        uint256 id = b.propose(p, m.assets);
        ++m.proposalCount;
        assertEq(id, m.proposalCount);
        proposals[address(b)][id] = abi.encode(p);
        m.previousProposal = m.lastProposal;
        m.lastProposal = id;
    }

    function purchase(uint256 branchSeed, bool secondActor, uint96 feeSeed, bool older, bool capTooLow)
        external
    {
        RelayBranch b = pick(branchSeed);
        Model storage m = models[address(b)];
        uint256 id = older ? m.previousProposal : m.lastProposal;
        uint256 fee = uint256(feeSeed) % (1 ether) + 1;
        bytes32 action =
            bytes(m.latestJob).length == 0 ? bytes32("job.open@job-1") : bytes32("job.continue@job-1");
        intake.setPrice(action, fee);
        bool valid = m.phase == T.Phase.Ready && id != 0 && !capTooLow;
        if (id != 0) {
            T.Proposal memory p = abi.decode(proposals[address(b)][id], (T.Proposal));
            if (p.anchor != m.history[m.history.length - 1].digest) valid = false;
        }
        address payer = secondActor ? bob : alice;
        if (!valid) {
            vm.prank(payer);
            (bool ok,) = address(b).call(abi.encodeCall(b.sponsor, (id, capTooLow ? fee - 1 : fee, m.assets)));
            require(!ok, "model: invalid purchase succeeded");
            ++rejectedCalls;
            return;
        }
        (, bytes memory body) = b.bodyOf(id, m.assets);
        vm.prank(payer);
        bytes32 request = b.sponsor(id, fee, m.assets);
        m.activeProposal = id;
        bought(b, m, request, body, payer, fee, action);
    }

    function retry(uint256 branchSeed, bool secondActor, uint96 feeSeed, bool wrongWitness) external {
        RelayBranch b = pick(branchSeed);
        Model storage m = models[address(b)];
        uint256 fee = uint256(feeSeed) % (1 ether) + 1;
        bytes32 action =
            bytes(m.latestJob).length == 0 ? bytes32("job.open@job-1") : bytes32("job.continue@job-1");
        intake.setPrice(action, fee);
        T.Asset[] memory witness = m.assets;
        bool corrupted = wrongWitness && witness.length > 0;
        if (corrupted) witness[0].fileHash = sha256("unaccepted substitution");
        address payer = secondActor ? bob : alice;
        if (m.phase != T.Phase.Refused || corrupted) {
            vm.prank(payer);
            (bool ok,) = address(b).call(abi.encodeCall(b.retry, (fee, witness)));
            require(!ok, "model: invalid retry succeeded");
            ++rejectedCalls;
            return;
        }
        (, bytes memory body) = b.bodyOf(m.activeProposal, witness);
        assertEq(keccak256(body), m.attempts[m.attempts.length - 1].bodyHash);
        vm.prank(payer);
        bytes32 request = b.retry(fee, witness);
        bought(b, m, request, body, payer, fee, action);
        ++retriedAttempts;
    }

    function fail(uint256 branchSeed, uint8 statusSeed) external {
        RelayBranch b = pick(branchSeed);
        Model storage m = models[address(b)];
        if (m.phase != T.Phase.Pending) return;
        uint8 status = statusSeed % 16 == 0 ? (statusSeed % 3 == 0 ? 0 : 2) : 1;
        T.Attempt storage attempt_ = m.attempts[m.attempts.length - 1];
        vm.prank(writer);
        require(intake.failure(attempt_.requestId, status, "model-outcome"), "model: failure not delivered");
        attempt_.status = status;
        attempt_.outcome = "model-outcome";
        attempt_.delivered = true;
        m.phase = status == 1 ? T.Phase.Refused : T.Phase.Frozen;
        if (status == 1) ++refusedAttempts;
    }

    function recordResult(uint256 branchSeed) external {
        RelayBranch b = pick(branchSeed);
        Model storage m = models[address(b)];
        if (m.phase != T.Phase.Pending) return;
        T.Proposal memory p = abi.decode(proposals[address(b)][m.activeProposal], (T.Proposal));
        string memory job = D.hex32(keccak256(abi.encode("model-job", address(b), m.attempts.length)));
        string memory project = bytes(m.project).length == 0
            ? D.hex32(keccak256(abi.encode("model-project", address(b))))
            : m.project;
        bytes memory file = D.kind(p.profile) == T.Kind.HTML
            ? D.illustratedHtml()
            : D.kind(p.profile) == T.Kind.Image
                ? D.png()
                : bytes.concat(D.document(), bytes(D.decimal(m.attempts.length)));
        bytes memory raw = D.manifest(p, job, project, file);
        T.Attempt storage attempt_ = m.attempts[m.attempts.length - 1];
        vm.prank(writer);
        require(
            intake.result(attempt_.requestId, keccak256(raw), "ipfs://model/result.json"),
            "model: result not delivered"
        );
        m.raw = raw;
        m.pendingProject = project;
        m.pendingOutput = D.output(p, job, file, raw, address(b), uint64(m.history.length));
        attempt_.delivered = true;
        attempt_.outcome = keccak256(raw);
        m.phase = T.Phase.ResultRecorded;
    }

    function bind(uint256 branchSeed, bool corruptBytes) external {
        RelayBranch b = pick(branchSeed);
        Model storage m = models[address(b)];
        bytes memory raw = corruptBytes ? bytes.concat(m.raw, " ") : m.raw;
        if (m.phase != T.Phase.ResultRecorded || corruptBytes) {
            (bool ok,) = address(b).call(abi.encodeCall(b.bind, (raw, m.assets)));
            require(!ok, "model: invalid binding succeeded");
            ++rejectedCalls;
            return;
        }
        T.Asset[] memory expected = D.next(m.assets, m.pendingOutput);
        b.bind(raw, m.assets);
        copyAssets(m, expected);
        m.latestJob = m.pendingOutput.jobId;
        m.project = m.pendingProject;
        m.phase = T.Phase.Ready;
        appendCheckpoint(b, m, keccak256(raw));
        ++boundRounds;
    }

    function forkHistory(uint256 branchSeed, uint64 revisionSeed, bool forged) external {
        RelayBranch parent = pick(branchSeed);
        Model storage m = models[address(parent)];
        if (m.history.length == 1 || branches.length == 4) return;
        uint64 at = uint64(uint256(revisionSeed) % (m.history.length - 1) + 1);
        T.Asset[] memory witness = abi.decode(m.witnesses[at], (T.Asset[]));
        if (forged) {
            witness[0].producer = address(this);
            (bool ok,) = address(factory)
                .call(abi.encodeCall(factory.fork, (address(parent), at, witness, "Model child direction.")));
            require(!ok, "model: forged fork succeeded");
            ++rejectedCalls;
            return;
        }
        RelayBranch child = factory.fork(address(parent), at, witness, "Model child direction.");
        createModel(
            child, witness, T.Source(address(parent), at, m.history[at].digest), "Model child direction."
        );
        ++forkedBranches;
        vm.prank(alice);
        token.approve(address(child), initial);
        vm.prank(bob);
        token.approve(address(child), initial);
    }

    function donate(uint256 branchSeed, bool secondActor, uint64 amountSeed) external {
        RelayBranch b = pick(branchSeed);
        uint256 amount = uint256(amountSeed) % (1 ether);
        vm.prank(secondActor ? bob : alice);
        token.transfer(address(b), amount);
        models[address(b)].donation += amount;
        if (secondActor) donatedBob += amount;
        else donatedAlice += amount;
    }

    function hostileCallback(uint256 branchSeed, uint256 attemptSeed, bool authenticSender) external {
        RelayBranch b = pick(branchSeed);
        Model storage m = models[address(b)];
        bytes32 request;
        if (m.attempts.length != 0) {
            uint256 index = attemptSeed % m.attempts.length;
            request = m.attempts[index].requestId;
            if (authenticSender && m.phase == T.Phase.Pending && index == m.attempts.length - 1) {
                request = keccak256(abi.encode("foreign-request", request));
            }
        }
        if (authenticSender) vm.prank(address(intake));
        (bool ok,) = address(b).call(abi.encodeCall(b.onIntakeResult, (request, keccak256("attack"), "")));
        require(!ok, "model: hostile result succeeded");
        if (authenticSender) vm.prank(address(intake));
        (ok,) = address(b)
            .call(
                abi.encodeCall(
                    b.onIntakeFailure, (request, uint8(1), bytes32("attack"), uint16(0), uint16(0), bytes(""))
                )
            );
        require(!ok, "model: hostile failure succeeded");
        ++rejectedCalls;
    }

    function advanceTime(uint32 seconds_) external {
        vm.warp(block.timestamp + uint256(seconds_));
    }

    function check() external view {
        assertEq(token.balanceOf(alice), initial - spentAlice - donatedAlice);
        assertEq(token.balanceOf(bob), initial - spentBob - donatedBob);
        assertEq(token.balanceOf(treasury), spentAlice + spentBob);
        assertEq(intake.collected(), spentAlice + spentBob);
        assertEq(intake.count(), paidAttempts);
        assertEq(token.totalSupply(), 2 * initial);
        assertEq(token.balanceOf(address(intake)), 0);
        assertEq(factory.branchCount(), branches.length);
        uint256 allDonations;
        uint256 allFees;
        for (uint256 i; i < branches.length; ++i) {
            RelayBranch b = branches[i];
            Model storage m = models[address(b)];
            assertTrue(factory.registered(address(b)));
            assertEq(b.factory(), address(factory));
            assertEq(b.goal(), m.goal);
            assertEq(b.direction(), m.direction);
            assertEq(uint256(b.phase()), uint256(m.phase));
            assertEq(b.revision(), m.history.length - 1);
            assertEq(b.assetsHash(), keccak256(abi.encode(m.assets)));
            assertEq(b.latestJobId(), m.latestJob);
            assertEq(b.projectId(), m.project);
            assertEq(b.proposalCount(), m.proposalCount);
            assertEq(b.activeProposal(), m.activeProposal);
            assertEq(b.attemptCount(), m.attempts.length);
            assertEq(b.activeAttempt(), m.attempts.length);
            assertEq(token.balanceOf(address(b)), m.donation);
            assertEq(token.allowance(address(b), address(intake)), 0);
            allDonations += m.donation;
            for (uint256 j; j < m.history.length; ++j) {
                assertEq(abi.encode(b.checkpoint(uint64(j))), abi.encode(m.history[j]));
            }
            for (uint256 j; j < m.attempts.length; ++j) {
                assertEq(abi.encode(b.attempt(j + 1)), abi.encode(m.attempts[j]));
                assertEq(b.requestAttempt(m.attempts[j].requestId), j + 1);
                allFees += m.attempts[j].fee;
            }
        }
        assertEq(allFees, spentAlice + spentBob);
        assertEq(allDonations, donatedAlice + donatedBob);
        assertEq(
            token.balanceOf(alice) + token.balanceOf(bob) + token.balanceOf(treasury) + allDonations,
            2 * initial
        );
    }

    function bought(
        RelayBranch b,
        Model storage m,
        bytes32 request,
        bytes memory body,
        address payer,
        uint256 fee,
        bytes32 action
    ) private {
        require(request != 0, "model: zero receipt");
        for (uint256 i; i < m.attempts.length; ++i) {
            require(m.attempts[i].requestId != request, "model: reused receipt");
        }
        SpecIntake.Receipt memory r = intake.receipt(request);
        assertEq(r.payer, address(b));
        assertEq(r.callback.target, address(b));
        assertEq(bytes32(r.callback.selector), bytes32(b.onIntakeResult.selector));
        assertEq(bytes32(r.failure), bytes32(b.onIntakeFailure.selector));
        assertEq(r.action, action);
        assertEq(r.body, body);
        assertEq(r.amount, fee);
        m.attempts.push(T.Attempt(m.activeProposal, payer, fee, request, keccak256(body), 0, 0, false));
        m.phase = T.Phase.Pending;
        if (payer == alice) spentAlice += fee;
        else spentBob += fee;
        ++paidAttempts;
    }

    function createModel(
        RelayBranch b,
        T.Asset[] memory assets,
        T.Source memory source,
        string memory direction
    ) private {
        branches.push(b);
        Model storage m = models[address(b)];
        m.goal = "Preserve public field notes and illustrations.";
        m.direction = direction;
        m.source = source;
        copyAssets(m, assets);
        appendCheckpoint(b, m, 0);
    }

    function appendCheckpoint(RelayBranch b, Model storage m, bytes32 result) private {
        bytes32 assetsHash = keccak256(abi.encode(m.assets));
        bytes32 jobHash = bytes(m.latestJob).length == 0 ? bytes32(0) : keccak256(bytes(m.latestJob));
        bytes32 projectHash = bytes(m.project).length == 0 ? bytes32(0) : keccak256(bytes(m.project));
        bytes32 digest = keccak256(
            abi.encode(
                block.chainid,
                address(factory),
                address(b),
                keccak256("CTO-Relay-A1/1/fixed-profiles/unpublished"),
                address(factory.encoder()),
                address(factory.verifier()),
                keccak256(bytes(m.goal)),
                keccak256(bytes(m.direction)),
                m.source,
                uint64(m.history.length),
                assetsHash,
                result,
                jobHash,
                projectHash
            )
        );
        m.history.push(T.Checkpoint(digest, assetsHash, result, jobHash, projectHash));
        m.witnesses.push(abi.encode(m.assets));
    }

    function copyAssets(Model storage m, T.Asset[] memory values) private {
        delete m.assets;
        for (uint256 i; i < values.length; ++i) {
            m.assets.push(values[i]);
        }
    }

    function has(Model storage m, bytes32 key) private view returns (bool) {
        for (uint256 i; i < m.assets.length; ++i) {
            if (m.assets[i].key == key) return true;
        }
        return false;
    }

    function pick(uint256 seed) private view returns (RelayBranch) {
        return branches[seed % branches.length];
    }
}

contract StateMachineSpecTest is SpecSetup {
    SpecStateHandler private handler;

    function setUp() public override {
        super.setUp();
        handler = new SpecStateHandler(factory, root, token, intake, ALICE, BOB, WRITER, TREASURY, INITIAL);
        // Start random sequences with all three actual asset types and accepted history.
        for (uint8 i; i < 3; ++i) {
            handler.propose(0, i, i);
            handler.purchase(0, i % 2 == 0, uint96(FEE - 1), false, false);
            handler.recordResult(0);
            handler.bind(0, false);
        }
        // Historical child, with its own first execution still to be purchased.
        handler.forkHistory(0, 1, false);
    }

    function targetContracts() external view returns (address[] memory result) {
        result = new address[](1);
        result[0] = address(handler);
    }

    /// forge-config: default.invariant.runs = 256
    /// forge-config: default.invariant.depth = 96
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_modelFeesReceiptsAssetsAndPermanentCheckpoints() public view {
        handler.check();
    }

    function test_modelExercisesRefusalRetryChildContinuationAndHistoricalFork() public {
        handler.propose(1, 1, 100);
        handler.purchase(1, true, uint96(FEE - 1), false, false);
        handler.fail(1, 1);
        handler.retry(1, false, uint96(FEE), false);
        handler.hostileCallback(1, 0, true);
        handler.recordResult(1);
        handler.bind(1, true);
        handler.bind(1, false);
        handler.propose(1, 0, 101);
        handler.purchase(1, false, uint96(FEE - 1), false, false);
        handler.recordResult(1);
        handler.bind(1, false);
        handler.forkHistory(1, 0, true);
        handler.forkHistory(1, 0, false);
        handler.donate(2, true, 1234);
        handler.check();
        assertEq(handler.boundRounds(), 5);
        assertEq(handler.forkedBranches(), 2);
        assertEq(handler.refusedAttempts(), 1);
        assertEq(handler.retriedAttempts(), 1);
        assertTrue(handler.rejectedCalls() >= 3);
    }
}
