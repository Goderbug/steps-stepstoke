// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {RelayTypes as T} from "./RelayTypes.sol";
import {RelayBranch} from "./RelayBranch.sol";
import {RelayEncoder} from "./RelayEncoder.sol";
import {RelayVerifier} from "./RelayVerifier.sol";
import {Policy} from "./libraries/Policy.sol";

/// @notice Permissionless project creation and authenticated historical forks. No owner or upgrades.
contract RelayFactory {
    RelayEncoder public immutable encoder;
    RelayVerifier public immutable verifier;
    address public immutable implementation;
    mapping(address => bool) public registered;
    mapping(uint256 => address) public branches;
    uint256 public branchCount;

    error InvalidParent();
    error InvalidCheckpoint();

    event BranchCreated(
        address indexed branch,
        address indexed parent,
        uint64 parentRevision,
        bytes32 parentCheckpoint,
        address creator
    );

    constructor() {
        encoder = new RelayEncoder();
        verifier = new RelayVerifier();
        implementation = address(new RelayBranch(encoder, verifier));
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
        branch = RelayBranch(Clones.clone(implementation));
        branch.initialize(goal, direction, source, inheritedProjectHash, inherited);
        registered[address(branch)] = true;
        branches[++branchCount] = address(branch);
        emit BranchCreated(address(branch), source.parent, source.revision, source.checkpoint, msg.sender);
    }
}
