// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StepsBranch, IIntake, IERC20} from "../src/StepsBranch.sol";
import {MockToken} from "../src/MockToken.sol";

/// Behaves like IMD's intake: takes payment, remembers the callback, delivers on demand.
contract MockIntake {
    struct Req { address target; bytes4 selector; bytes4 failure; }
    mapping(bytes32 => Req) public reqs;
    MockToken public token;
    uint256 public n;
    constructor(MockToken t) { token = t; }

    function requestWithFailure(bytes32, bytes calldata, IIntake.Callback calldata cb, bytes4 onFailure, address asset, uint256 amount)
        external
        returns (bytes32 requestId)
    {
        if (amount > 0) MockToken(asset).transferFrom(msg.sender, address(this), amount);
        requestId = keccak256(abi.encode(msg.sender, n++));
        reqs[requestId] = Req(cb.target, cb.selector, onFailure);
    }

    function deliver(bytes32 requestId, bytes32 resultHash, string calldata uri) external {
        Req memory r = reqs[requestId];
        (bool ok,) = r.target.call(abi.encodeWithSelector(r.selector, requestId, resultHash, uri));
        require(ok, "callback failed");
    }

    function deliverFailure(bytes32 requestId, uint8 status, bytes32 reason) external {
        Req memory r = reqs[requestId];
        (bool ok,) = r.target.call(abi.encodeWithSelector(r.failure, requestId, status, reason, uint16(0), uint16(0), bytes("")));
        require(ok, "failure callback failed");
    }
}

interface Vm2 {
    struct Log { bytes32[] topics; bytes data; address emitter; }
    function prank(address sender) external;
    function warp(uint256 t) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract ReviewTest {
    StepsBranch branch;
    MockIntake intake;
    MockToken token;
    Vm2 vm = Vm2(address(uint160(uint256(keccak256("hevm cheat code")))));

    function setUp() public {
        token = new MockToken();
        intake = new MockIntake(token);
        branch = new StepsBranch(IIntake(address(intake)), address(token), 500 ether,address(this));
        token.mint(address(this), 10_000 ether);
        token.approve(address(branch), type(uint256).max);
    }

    function _body(string memory s) internal pure returns (bytes memory) {
        return bytes(string.concat('{"objective":"', s, '"}'));
    }

    function _propose(string memory s) internal returns (uint256 id, bytes memory body) {
        body = _body(s);
        id = branch.propose(0, bytes32(0), body);
    }

    /// H1 FIXED: a silent proposal no longer bricks the branch — expiry releases it.
    function testSilentProposalExpires() public {
        (uint256 id, bytes memory body) = _propose("stuck");
        branch.fundWithPayment(id, body, 500 ether);

        // before the window: still busy, and expiry is refused
        bool tooEarly;
        try branch.expirePending(id) { } catch { tooEarly = true; }
        require(tooEarly, "expired before the window");

        vm.warp(block.timestamp + 7 days + 1);

        // anyone may release it, and the local timeout is recorded separately from a protocol failure
        branch.expirePending(id);
        (, uint64 branchId, StepsBranch.Status status, , , , , , , ) = branch.proposals(id);
        require(branchId == 0 && status == StepsBranch.Status.Expired, "proposal expired");

        // the branch is usable again
        (uint256 id2, bytes memory body2) = _propose("next");
        branch.fundWithPayment(id2, body2, 500 ether);
        require(branch.count() == 0, "no checkpoint invented");
    }

    /// The failure callback does clear the lock, but only if IMD calls it.
    function testConflictClearsLock() public {
        (uint256 id, bytes memory body) = _propose("first");
        bytes32 rid = branch.fundWithPayment(id, body, 500 ether);
        intake.deliverFailure(rid, 1, bytes32("refused"));
        (uint256 id2, bytes memory body2) = _propose("second");
        branch.fundWithPayment(id2, body2, 500 ether);
        require(branch.count() == 0, "no checkpoint on failure");
    }

    /// Same-chain scope: a delivery contract is not a second settlement authority.
    function testDeliveryRejected() public {
        MockIntake delivery = new MockIntake(token);
        StepsBranch b = new StepsBranch(IIntake(address(intake)), address(token), 500 ether,address(this));
        token.approve(address(b), type(uint256).max);
        bytes memory body = _body("first");
        uint256 id = b.propose(0, bytes32(0), body);
        bytes32 rid = b.fundWithPayment(id, body, 500 ether);

        vm.prank(address(0xBAD));
        bool refused;
        try b.onResult(rid, keccak256("r"), "ipfs://x") { } catch { refused = true; }
        require(refused, "random sender accepted");

        vm.prank(address(delivery));
        bool deliveryRefused;
        try b.onResult(rid, keccak256("r"), "ipfs://x") { } catch { deliveryRefused = true; }
        require(deliveryRefused && b.count() == 0, "foreign delivery accepted");
        intake.deliver(rid, keccak256("r"), "ipfs://x");
        require(b.count() == 1, "same-chain result recorded");
    }

    /// M2 FIXED: the snapshot is stored and readable from the child branch.
    function testSnapshotIsPersisted() public {
        (uint256 id, bytes memory body) = _propose("first");
        bytes32 rid = branch.fundWithPayment(id, body, 500 ether);
        bytes memory result = bytes('{"jobId":"abc","files":[]}');
        intake.deliver(rid, keccak256(result), "ipfs://bafy/result.json");

        uint64 child = branch.forkWithSnapshot(0, result);
        require(child == 1, "child created");
        require(keccak256(branch.snapshotOf(child)) == keccak256(result), "snapshot stored");
        (,, uint64 headCp,) = branch.branches(child);
        require(headCp == 1, "points at the parent checkpoint");
    }

    /// L1 FIXED: a dropped URI is announced instead of silently becoming an empty string.
    function testLongUriAnnounced() public {
        (uint256 id, bytes memory body) = _propose("first");
        bytes32 rid = branch.fundWithPayment(id, body, 500 ether);
        string memory longUri = string.concat("ipfs://", _repeat("a", 3000));
        vm.recordLogs();
        intake.deliver(rid, keccak256("r"), longUri);
        StepsBranch.CheckpointView memory v = branch.checkpoint(0);
        require(v.uriHash == keccak256(bytes(longUri)), "hash kept");
        bool announced;
        Vm2.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == keccak256("UriOmitted(bytes32)")) announced = true;
        }
        require(announced, "UriOmitted not emitted");
        // the branch event omits long URI bytes; its commitment remains onchain
    }

    /// L2 FIXED: a zero result hash is refused by the callback itself.
    function testZeroResultHashRejected() public {
        (uint256 id, bytes memory body) = _propose("first");
        bytes32 rid = branch.fundWithPayment(id, body, 500 ether);
        bool reverted;
        try intake.deliver(rid, bytes32(0), "ipfs://x") { } catch { reverted = true; }
        require(reverted, "zero result accepted");
        require(branch.count() == 0, "no checkpoint");
    }

    /// Sanity: the happy path works, price cap is enforced, and approvals are cleared.
    function testHappyPathAndCap() public {
        (uint256 id, bytes memory body) = _propose("first");
        bool capped;
        try branch.fundWithPayment(id, body, 100 ether) { } catch { capped = true; }
        require(capped, "maxPayment not enforced");
        bytes32 rid = branch.fundWithPayment(id, body, 500 ether);
        require(token.allowance(address(branch), address(intake)) == 0, "approval cleared");
        intake.deliver(rid, keccak256("r"), "ipfs://x");
        require(branch.count() == 1, "checkpoint");
        (, uint64 rev,,) = branch.branches(0);
        (bytes32 head,,,) = branch.branches(0);
        require(rev == 1 && head != bytes32(0), "branch advanced");
    }

    function _repeat(string memory c, uint256 n) internal pure returns (string memory out) {
        bytes memory one = bytes(c);
        bytes memory buf = new bytes(one.length * n);
        for (uint256 i = 0; i < n; i++) for (uint256 j = 0; j < one.length; j++) buf[i * one.length + j] = one[j];
        return string(buf);
    }
}
