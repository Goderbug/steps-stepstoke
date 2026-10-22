// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "../RelaySetup.sol";
import {RelayFactory} from "src/RelayFactory.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {Policy} from "src/libraries/Policy.sol";
import {SpecData as D} from "../adversarial/SpecSupport.sol";

interface ReplayVm {
    function chainId(uint256) external;
    function setNonce(address, uint64) external;
}

/// @dev These are archived LOCAL rehearsal addresses, not mainnet deployment addresses.
/// The fixture regenerates the original bytes without filesystem permissions or FFI.
library CGas01 {
    address internal constant FACTORY = 0x0165878A594ca255338adfa4d48449f69242Eb8F;
    address internal constant BRANCH = 0x3B02fF1e626Ed7a8fd6eC5299e2C54e1421B626B;
    bytes32 internal constant RAW_SHA256 = 0x8768318db71105397ac89eef44af007752b94e966eb8adebd237a2b97c9de805;
    bytes32 internal constant WITNESS_HASH =
        0x45bf29418f29ab58d2166ef45615e718d720d4653c73e8a4fa1b333f72389828;
    bytes32 internal constant WITNESS_SHA256 =
        0x8f6860eac45bba3eed686ad0e7f989fe0fed521760c9e9961427203420992b79;

    function name(uint256 index) internal pure returns (string memory) {
        return string(D.repeat(bytes1(uint8(65 + index)), 64));
    }

    function path(uint256 index) internal pure returns (string memory) {
        if (index == 15) return "artifacts/index.html";
        if (index == 16) return string(bytes.concat("artifacts/", D.repeat("a", 114), ".png"));
        return string(bytes.concat("artifacts/", D.repeat(bytes1(uint8(97 + index)), 115), ".md"));
    }

    function base(uint256 index, string memory job) internal pure returns (bytes memory) {
        return bytes.concat(
            '{"jobId":"',
            bytes(job),
            '","projectId":"metadata-project","state":"completed","source":[],"files":[{"name":"',
            bytes(name(index)),
            '","path":"',
            bytes(path(index)),
            '","hash":"76421de3bab201606a931fb868ce04304275c8d5cc5bd421037af7a2b8aebe3c","mediaType":"',
            bytes(index <= 14 ? "text/markdown" : index == 15 ? "text/html" : "image/png"),
            '","bytes":83,"submissionHash":"db9e4455dca25214107114ec484edf4d223cb5d6967b82458d0716a2af4e8bdb"}]}'
        );
    }

    function raw() internal pure returns (bytes memory result) {
        result = base(1, "metadata-limits-job");
        // Remove only the final ]}; every field, byte, order and whitespace is pinned below.
        assembly ("memory-safe") { mstore(result, sub(mload(result), 2)) }
        bytes memory scalarRun = new bytes(1000);
        for (uint256 i; i < 1000; i += 2) {
            scalarRun[i] = 0xc3;
            scalarRun[i + 1] = 0xa9;
        }
        for (uint256 i; i < 15; ++i) {
            bytes memory value = bytes.concat(scalarRun, bytes(D.decimal(i)));
            result = bytes.concat(result, ',{"name":"', value, '","path":"', value, '"}');
        }
        result = bytes.concat(result, "]}");
        result = bytes.concat(result, D.repeat(" ", 32768 - result.length));
        require(sha256(result) == RAW_SHA256, "C-GAS-01 original bytes changed");
    }
}

/// @dev Fresh memory and an explicit call gas allowance. Includes calldata intrinsic gas
/// and the EIP-7623 floor; CALL overhead is conservatively counted, refunds are not deducted.
/// An actual local-chain transaction replay accompanies this Foundry regression.
contract CappedBindTransaction {
    uint256 internal constant CAP = 16_777_216;

    function execute(RelayBranch branch, bytes calldata raw, T.Asset[] calldata old)
        external
        returns (uint256 execution, uint256 total)
    {
        bytes memory data = abi.encodeCall(branch.bind, (raw, old));
        uint256 tokens;
        for (uint256 i; i < data.length; ++i) {
            tokens += data[i] == 0 ? 1 : 4;
        }
        uint256 intrinsic = 21_000 + 4 * tokens;
        uint256 beforeGas = gasleft();
        (bool ok, bytes memory reason) = address(branch).call{gas: CAP - intrinsic - 5_000}(data);
        execution = beforeGas - gasleft();
        if (!ok) {
            assembly ("memory-safe") { revert(add(reason, 32), mload(reason)) }
        }
        total = intrinsic + execution;
        uint256 floor = 21_000 + 10 * tokens;
        if (floor > total) total = floor;
        require(total < CAP, "complete binding exceeds Ethereum transaction cap");
    }
}

contract ExactGasRegressionTest is RelaySetup {
    T.Asset[] private witness;
    CappedBindTransaction private meter;

    function setUp() public override {
        ReplayVm(address(vm)).chainId(1);
        super.setUp();
        // Like the protected launch probe, position a complete factory runtime at a
        // known local address. No Branch storage is injected. All sixteen checkpoints
        // below are earned through propose -> sponsor -> authenticated result -> bind.
        vm.etch(CGas01.FACTORY, address(factory).code);
        ReplayVm(address(vm)).setNonce(CGas01.FACTORY, 1);
        factory = RelayFactory(CGas01.FACTORY);
        branch = factory.createProject(string(D.repeat("G", 512)));
        assertEq(address(branch), CGas01.BRANCH);
        _approve(branch);
        T.Asset[] memory old = _empty();
        for (uint256 i = 1; i <= 16; ++i) {
            T.Profile profile =
                i <= 14 ? T.Profile.MarkdownCreate : i == 15 ? T.Profile.HTMLCreate : T.Profile.ImageCreate;
            T.Proposal memory p = _proposal(branch, profile, i);
            p.outputName = CGas01.name(i);
            p.outputPath = CGas01.path(i);
            old = _accept(branch, p, old, CGas01.base(i, CGas01.name(i)));
        }
        assertEq(old.length, 16);
        assertEq(keccak256(abi.encode(old)), CGas01.WITNESS_HASH);
        assertEq(sha256(abi.encode(old)), CGas01.WITNESS_SHA256);
        for (uint256 i; i < old.length; ++i) {
            witness.push(old[i]);
        }
        meter = new CappedBindTransaction();
    }

    function _pendingOriginal() private returns (bytes memory raw) {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownUpdate, 1);
        p.outputName = CGas01.name(1);
        p.outputPath = CGas01.path(1);
        uint256 id = branch.propose(p, witness);
        bytes32 request = _pay(branch, id, witness);
        raw = CGas01.raw();
        assertEq(raw.length, 32768);
        _record(request, raw);
        assertEq(branch.attempt(17).outcome, keccak256(raw));
    }

    function test_exactOriginalBytesAndOriginalWitnessBindBelowTransactionCap() public {
        bytes memory raw = _pendingOriginal();
        bytes32 beforeHistory = branch.checkpoint(16).digest;
        (uint256 execution, uint256 total) = meter.execute(branch, raw, witness);
        emit Metric("exact C-GAS-01 execution upper bound", execution);
        emit Metric("exact C-GAS-01 full transaction upper bound", total);
        assertEq(block.chainid, 1);
        assertEq(branch.revision(), 17);
        assertEq(uint256(branch.phase()), uint256(T.Phase.Ready));
        assertEq(branch.checkpoint(17).resultHash, keccak256(raw));
        assertEq(branch.checkpoint(16).digest, beforeHistory);
        T.Asset[] memory expected = witness;
        expected[0].jobId = "metadata-limits-job";
        expected[0].resultHash = keccak256(raw);
        expected[0].revision = 17;
        assertEq(branch.assetsHash(), keccak256(abi.encode(expected)));
        assertEq(branch.checkpoint(17).assetsHash, keccak256(abi.encode(expected)));
        assertEq(branch.latestJobId(), "metadata-limits-job");
        assertEq(branch.projectId(), "metadata-project");
        assertEq(token.balanceOf(TREASURY), 17 * PRICE);
        assertEq(token.balanceOf(address(branch)), 0);
        assertEq(token.allowance(address(branch), Policy.INTAKE), 0);
    }

    /// forge-config: default.fuzz.runs = 128
    function testFuzz_anyOriginalByteMutationKeepsResultAndHistory(uint16 offset, uint8 mask) public {
        bytes memory raw = _pendingOriginal();
        bytes32 recorded = keccak256(raw);
        bytes32 beforeHistory = branch.anchor();
        // All offsets are in-domain; every generated mask changes one byte.
        raw[uint256(offset) % raw.length] ^= bytes1(uint8(uint256(mask) % 255 + 1));
        vm.expectRevert(Policy.Invalid.selector);
        branch.bind(raw, witness);
        assertEq(branch.anchor(), beforeHistory);
        assertEq(branch.revision(), 16);
        assertEq(branch.attempt(17).outcome, recorded);
        assertEq(uint256(branch.phase()), uint256(T.Phase.ResultRecorded));
        assertEq(branch.assetsHash(), CGas01.WITNESS_HASH);
        assertEq(token.balanceOf(TREASURY), 17 * PRICE);
    }

    function test_ignoredMetadataAndWhitespaceRemainBoundThenOriginalStillSucceeds() public {
        bytes memory raw = _pendingOriginal();
        // A valid, different JSON envelope with the same declared output is insufficient.
        bytes memory projected = CGas01.base(1, "metadata-limits-job");
        vm.expectRevert(Policy.Invalid.selector);
        branch.bind(projected, witness);
        bytes memory whitespace = bytes.concat(raw);
        whitespace[whitespace.length - 1] = 0x09;
        vm.expectRevert(Policy.Invalid.selector);
        branch.bind(whitespace, witness);
        meter.execute(branch, raw, witness);
        assertEq(branch.checkpoint(17).resultHash, keccak256(raw));
        assertEq(branch.attemptCount(), 17);
        assertEq(token.balanceOf(TREASURY), 17 * PRICE);
    }

    function test_originalWitnessMutationCannotBeUsedForBindingOrHistoricalFork() public {
        bytes memory raw = _pendingOriginal();
        T.Asset[] memory altered = witness;
        altered[15].submissionHash = sha256("unaccepted later submission");
        vm.expectRevert(RelayBranch.InvalidWitness.selector);
        branch.bind(raw, altered);
        vm.expectRevert(RelayFactory.InvalidCheckpoint.selector);
        factory.fork(address(branch), 16, altered, "Historical continuation");
        RelayBranch child = factory.fork(address(branch), 16, witness, "Historical continuation");
        assertEq(child.assetsHash(), CGas01.WITNESS_HASH);
        assertEq(branch.revision(), 16);
        assertEq(uint256(branch.phase()), uint256(T.Phase.ResultRecorded));
        assertEq(token.balanceOf(TREASURY), 17 * PRICE);
    }
}
