// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelayTypes as T} from "./RelayTypes.sol";
import {RelayBranch} from "./RelayBranch.sol";
import {RelayEncoder} from "./RelayEncoder.sol";
import {RelayVerifier} from "./RelayVerifier.sol";
import {Policy} from "./libraries/Policy.sol";

/// @notice Permissionless project creation and authenticated historical forks. No owner or upgrades.
contract RelayFactory {
    RelayEncoder public immutable encoder;
    RelayVerifier public immutable verifier;
    mapping(address => bool) public registered;
    mapping(uint256 => address) public branches;
    uint256 public branchCount;

    error InvalidDependency();
    error InvalidParent();
    error InvalidCheckpoint();

    event BranchCreated(
        address indexed branch,
        address indexed parent,
        uint64 parentRevision,
        bytes32 parentCheckpoint,
        address creator
    );

    /// @dev Launch-safe: static arguments only, no calls, code inspection or child deployment.
    constructor(RelayEncoder encoder_, RelayVerifier verifier_) {
        if (
            address(encoder_) == address(0) || address(verifier_) == address(0)
                || address(encoder_) == address(verifier_)
        ) revert InvalidDependency();
        encoder = encoder_;
        verifier = verifier_;
    }

    function intake() external pure returns (address) {
        return Policy.INTAKE;
    }

    function imd() external pure returns (address) {
        return Policy.IMD;
    }

    /// @dev Validate fixed dependencies at use, not on the launch's empty-chain constructor probe.
    function _dependencies() private view {
        if (address(encoder).code.length == 0 || address(verifier).code.length == 0) {
            revert InvalidDependency();
        }
        if (encoder.policyId() != Policy.ID || verifier.policyId() != Policy.ID) revert InvalidDependency();
    }

    function policyId() external pure returns (bytes32) {
        return Policy.ID;
    }

    function createProject(string calldata goal) external returns (RelayBranch branch) {
        branch = _create(goal, "", T.Source(address(0), 0, 0), 0, new T.Asset[](0));
    }

    /// @notice Fork precisely a registered parent's chosen accepted revision, even after later purchases.
    function fork(address parent, uint64 at, T.Asset[] calldata witness, string calldata direction)
        external
        returns (RelayBranch branch)
    {
        _dependencies();
        if (!registered[parent]) revert InvalidParent();
        T.Checkpoint memory cp = RelayBranch(parent).checkpoint(at);
        if (at == 0 || cp.digest == 0 || cp.resultHash == 0 || encoder.witnessHash(witness) != cp.assetsHash)
        {
            revert InvalidCheckpoint();
        }
        if (bytes(direction).length == 0) revert Policy.Invalid();
        branch = _create(
            RelayBranch(parent).goal(), direction, T.Source(parent, at, cp.digest), cp.projectHash, witness
        );
    }

    function _create(
        string memory goal,
        string memory direction,
        T.Source memory source,
        bytes32 inheritedProjectHash,
        T.Asset[] memory inherited
    ) private returns (RelayBranch branch) {
        _dependencies();
        encoder.validateText(goal, direction);
        bytes32 inheritedAssetsHash = encoder.witnessHash(inherited);
        // All external validation precedes CREATE. The child constructor only stores/hashes/emits.
        branch = new RelayBranch(
            encoder, verifier, goal, direction, source, inheritedProjectHash, inheritedAssetsHash, inherited
        );
        registered[address(branch)] = true;
        branches[++branchCount] = address(branch);
        emit BranchCreated(address(branch), source.parent, source.revision, source.checkpoint, msg.sender);
    }
}
