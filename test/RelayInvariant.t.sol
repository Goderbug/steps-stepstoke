// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "./RelaySetup.sol";
import {TestBase, Vm} from "./TestBase.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {MockToken} from "./mocks/MockToken.sol";
import {MockIntake} from "./mocks/MockIntake.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {Text} from "../src/libraries/Text.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";

contract RelayHandler is TestBase {
    RelayBranch public branch;
    MockIntake public intake;
    MockToken public token;
    address public writer;
    T.Asset[] private assets;
    bytes private raw;
    uint256 public spent;
    uint256 public accepted;
    uint256 public purchases;
    uint256 private choiceA;
    uint256 private choiceB;
    bytes32[] private savedCheckpoints;

    constructor(RelayBranch branch_, MockIntake intake_, MockToken token_, address writer_) {
        branch = branch_;
        intake = intake_;
        token = token_;
        writer = writer_;
        token.approve(address(branch), 1000 ether);
        savedCheckpoints.push(branch.anchor());
    }

    function propose(uint256 textSeed) external {
        T.Proposal memory p;
        p.anchor = branch.anchor();
        p.profile = assets.length == 0 ? T.Profile.MarkdownCreate : T.Profile.MarkdownUpdate;
        p.target = bytes32(uint256(1));
        p.inputs = new bytes32[](assets.length == 0 ? 0 : 1);
        if (p.inputs.length != 0) p.inputs[0] = p.target;
        p.outputName = "main";
        p.outputPath = "artifacts/main.md";
        p.text = string.concat("Explicit request ", Text.decimal(textSeed));
        choiceA = choiceB;
        choiceB = branch.propose(p, assets);
    }

    function sponsor(uint256 which, uint96 amount) external {
        if (branch.phase() != T.Phase.Ready) return;
        uint256 id = which % 2 == 0 ? choiceA : choiceB;
        if (id == 0 || branch.proposal(id).anchor != branch.anchor()) return;
        uint256 fee = uint256(amount) % (1 ether) + 1;
        intake.setPrice(bytes(branch.latestJobId()).length == 0 ? Policy.OPEN : Policy.CONTINUE, fee);
        branch.sponsor(id, fee, assets);
        spent += fee;
        ++purchases;
    }

    function fail(uint8 mode) external {
        if (branch.phase() != T.Phase.Pending) return;
        bytes32 request = branch.attempt(branch.activeAttempt()).requestId;
        vm.prank(writer);
        assertTrue(intake.fail(request, mode == 255 ? 2 : 1, "failure"));
    }

    function recordResult() external {
        if (branch.phase() != T.Phase.Pending) return;
        raw = bytes.concat(
            '{"jobId":"invariant-job-',
            bytes(Text.decimal(purchases)),
            '","projectId":"invariant-project","state":"completed","files":[{"name":"main","path":"artifacts/main.md","hash":"',
            bytes(Text.hex32(sha256(F.document()))),
            '","mediaType":"text/markdown","bytes":',
            bytes(Text.decimal(F.document().length)),
            ',"submissionHash":"',
            bytes(Text.hex32(sha256("invariant-submission"))),
            '"}]}'
        );
        bytes32 request = branch.attempt(branch.activeAttempt()).requestId;
        vm.prank(writer);
        assertTrue(intake.complete(request, raw));
    }

    function retry(uint96 amount) external {
        if (branch.phase() != T.Phase.Refused) return;
        uint256 fee = uint256(amount) % (1 ether) + 1;
        intake.setPrice(bytes(branch.latestJobId()).length == 0 ? Policy.OPEN : Policy.CONTINUE, fee);
        branch.retry(fee, assets);
        spent += fee;
        ++purchases;
    }

    function bind() external {
        if (branch.phase() != T.Phase.ResultRecorded) return;
        vm.recordLogs();
        branch.bind(raw, assets);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (
                logs[i].emitter == address(branch)
                    && logs[i].topics[0] == keccak256("CheckpointWritten(uint64,bytes32,bytes)")
            ) {
                T.Asset[] memory next = abi.decode(abi.decode(logs[i].data, (bytes)), (T.Asset[]));
                delete assets;
                for (uint256 j; j < next.length; ++j) {
                    assets.push(next[j]);
                }
            }
        }
        ++accepted;
        savedCheckpoints.push(branch.anchor());
    }

    function check() external view {
        assertEq(branch.assetsHash(), keccak256(abi.encode(assets)));
        assertEq(branch.revision(), accepted);
        assertEq(branch.attemptCount(), purchases);
        for (uint256 i; i < savedCheckpoints.length; ++i) {
            assertEq(branch.checkpoint(uint64(i)).digest, savedCheckpoints[i]);
        }
    }
}

contract RelayInvariantTest is RelaySetup {
    RelayHandler private handler;

    function setUp() public override {
        super.setUp();
        handler = new RelayHandler(branch, intake, token, WRITER);
        token.mint(address(handler), 1000 ether);
    }

    function targetContracts() external view returns (address[] memory result) {
        result = new address[](1);
        result[0] = address(handler);
    }

    /// forge-config: default.invariant.runs = 128
    /// forge-config: default.invariant.depth = 64
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_conservationAndPermanentHistory() public view {
        assertEq(token.balanceOf(address(branch)), 0);
        assertEq(token.allowance(address(branch), Policy.INTAKE), 0);
        assertEq(token.balanceOf(TREASURY), handler.spent());
        assertEq(token.balanceOf(address(handler)) + token.balanceOf(TREASURY), 1000 ether);
        handler.check();
    }
}
