// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IIntake} from "./interfaces/IIntake.sol";
import {RelayTypes as T} from "./RelayTypes.sol";
import {RelayEncoder} from "./RelayEncoder.sol";
import {RelayVerifier} from "./RelayVerifier.sol";
import {Policy} from "./libraries/Policy.sol";

/// @notice A permanent public continuation branch and the sole payer for its own Intake project.
/// @dev Full independent runtime instance, constructor-complete and atomically registered by its Factory.
contract RelayBranch {
    using SafeERC20 for IERC20;

    address public immutable factory;
    RelayEncoder public immutable encoder;
    RelayVerifier public immutable verifier;

    bool private entered;
    string public goal;
    string public direction;
    T.Source public source;
    bytes32 public inheritedProjectHash;
    uint64 public revision;
    bytes32 public assetsHash;
    string public latestJobId;
    string public projectId;
    T.Phase public phase;
    uint256 public proposalCount;
    uint256 public attemptCount;
    uint256 public activeProposal;
    uint256 public activeAttempt;

    mapping(uint256 => T.Proposal) private proposals;
    mapping(uint256 => bytes32) public proposalBodyHash;
    mapping(uint256 => T.Attempt) private attempts;
    mapping(bytes32 => uint256) public requestAttempt;
    mapping(uint64 => T.Checkpoint) private checkpoints;
    mapping(bytes32 => bool) public usedJob;

    error Busy();
    error Stale();
    error UnknownProposal();
    error InvalidWitness();
    error FeeExceeded();
    error PaymentMismatch();
    error NotPending();
    error IdentityMismatch();

    event Initialized(string goal, string direction, T.Source source);
    event Proposed(uint256 indexed proposalId, bytes32 indexed anchor, bytes32 bodyHash, bytes proposal);
    event Purchased(
        uint256 indexed attempt,
        uint256 indexed proposalId,
        bytes32 indexed requestId,
        address sponsor,
        bytes32 action,
        uint256 fee,
        bytes32 bodyHash
    );
    event ResultRecorded(uint256 indexed attempt, bytes32 indexed requestId, bytes32 resultHash, string uri);
    event FailureRecorded(uint256 indexed attempt, bytes32 indexed requestId, uint8 status, bytes32 reason);
    event CheckpointWritten(uint64 indexed revision, bytes32 indexed digest, bytes witness);
    event Bound(
        uint64 indexed revision, uint256 indexed proposalId, uint256 indexed attempt, bytes rawManifest
    );

    modifier guarded() {
        if (entered) revert Busy();
        entered = true;
        _;
        entered = false;
    }

    /// @dev Runtime child only (not a named launch contract). Factory validates before CREATE.
    /// No external calls, initializer, proxy implementation or usable partial instance exists.
    constructor(
        RelayEncoder encoder_,
        RelayVerifier verifier_,
        string memory goal_,
        string memory direction_,
        T.Source memory source_,
        bytes32 inheritedProjectHash_,
        bytes32 inheritedAssetsHash_,
        T.Asset[] memory inherited
    ) {
        factory = msg.sender;
        encoder = encoder_;
        verifier = verifier_;
        goal = goal_;
        direction = direction_;
        source = source_;
        inheritedProjectHash = inheritedProjectHash_;
        assetsHash = inheritedAssetsHash_;
        _checkpoint(bytes32(0), inherited);
        emit Initialized(goal_, direction_, source_);
    }

    function intake() external pure returns (address) {
        return Policy.INTAKE;
    }

    function imd() external pure returns (address) {
        return Policy.IMD;
    }

    function policyId() external pure returns (bytes32) {
        return Policy.ID;
    }

    function anchor() public view returns (bytes32) {
        return checkpoints[revision].digest;
    }

    function checkpoint(uint64 at) external view returns (T.Checkpoint memory) {
        return checkpoints[at];
    }

    function proposal(uint256 id) external view returns (T.Proposal memory) {
        _known(id);
        return proposals[id];
    }

    function attempt(uint256 id) external view returns (T.Attempt memory) {
        if (id == 0 || id > attemptCount) revert NotPending();
        return attempts[id];
    }

    /// @notice A new proposal does not alter the anchor, active request, or any existing proposal.
    function propose(T.Proposal calldata p, T.Asset[] calldata current)
        external
        guarded
        returns (uint256 id)
    {
        if (p.anchor != anchor()) revert Stale();
        _witness(current);
        (, bytes memory body) = encoder.encode(goal, direction, latestJobId, p, current);
        id = ++proposalCount;
        proposals[id] = p;
        proposalBodyHash[id] = keccak256(body);
        emit Proposed(id, p.anchor, keccak256(body), abi.encode(p));
    }

    /// @notice Preview exact bytes for any current proposal, without a purchase or queue ordering.
    function bodyOf(uint256 id, T.Asset[] calldata current)
        public
        view
        returns (bytes32 action, bytes memory body)
    {
        _known(id);
        if (proposals[id].anchor != anchor()) revert Stale();
        _witness(current);
        (action, body) = encoder.encode(goal, direction, latestJobId, proposals[id], current);
        if (keccak256(body) != proposalBodyHash[id]) revert Stale();
    }

    /// @notice Funds one nonzero proposal. All local admission checks precede the first token transfer.
    function sponsor(uint256 id, uint256 maxFee, T.Asset[] calldata current)
        external
        guarded
        returns (bytes32 requestId)
    {
        if (phase != T.Phase.Ready) revert Busy();
        (bytes32 action, bytes memory body) = bodyOf(id, current);
        activeProposal = id;
        return _purchase(id, action, body, maxFee);
    }

    /// @notice Status 1 permits only a new, explicitly paid attempt with identical proposal and body.
    function retry(uint256 maxFee, T.Asset[] calldata current) external guarded returns (bytes32 requestId) {
        if (phase != T.Phase.Refused) revert Busy();
        (bytes32 action, bytes memory body) = bodyOf(activeProposal, current);
        if (keccak256(body) != attempts[activeAttempt].bodyHash) revert Stale();
        return _purchase(activeProposal, action, body, maxFee);
    }

    function _purchase(uint256 id, bytes32 action, bytes memory body, uint256 maxFee)
        private
        returns (bytes32 requestId)
    {
        phase = T.Phase.Purchasing;
        IIntake intake_ = IIntake(Policy.INTAKE);
        IERC20 token = IERC20(Policy.IMD);
        uint256 price = intake_.priceOf(action, Policy.IMD);
        if (price == 0 || price > maxFee) revert FeeExceeded();
        uint256 beforeBalance = token.balanceOf(address(this));
        uint256 beforeSponsor = token.balanceOf(msg.sender);
        token.safeTransferFrom(msg.sender, address(this), price);
        if (
            token.balanceOf(address(this)) != beforeBalance + price
                || token.balanceOf(msg.sender) + price != beforeSponsor
        ) revert PaymentMismatch();
        token.forceApprove(Policy.INTAKE, price);
        requestId = intake_.requestWithFailure(
            action,
            body,
            IIntake.Callback(address(this), this.onIntakeResult.selector),
            this.onIntakeFailure.selector,
            Policy.IMD,
            price
        );
        token.forceApprove(Policy.INTAKE, 0);
        if (
            token.balanceOf(address(this)) != beforeBalance
                || token.allowance(address(this), Policy.INTAKE) != 0
        ) {
            revert PaymentMismatch();
        }
        if (requestId == 0 || requestAttempt[requestId] != 0) revert NotPending();
        uint256 number = ++attemptCount;
        activeAttempt = number;
        requestAttempt[requestId] = number;
        attempts[number] = T.Attempt(id, msg.sender, price, requestId, keccak256(body), 0, 0, false);
        phase = T.Phase.Pending;
        emit Purchased(number, id, requestId, msg.sender, action, price, keccak256(body));
    }

    /// @dev Stipend-safe: authenticate, record digest/phase and emit. No parsing, binding, calls or transfers.
    function onIntakeResult(bytes32 requestId, bytes32 resultHash, string calldata uri) external {
        T.Attempt storage a = _pending(requestId);
        if (bytes(uri).length > 1024) revert Policy.Limit();
        a.delivered = true;
        a.outcome = resultHash;
        phase = T.Phase.ResultRecorded;
        emit ResultRecorded(activeAttempt, requestId, resultHash, uri);
    }

    function onIntakeFailure(bytes32 requestId, uint8 status, bytes32 reason, uint16, uint16, bytes calldata)
        external
    {
        T.Attempt storage a = _pending(requestId);
        a.delivered = true;
        a.status = status;
        a.outcome = reason;
        phase = status == 1 ? T.Phase.Refused : T.Phase.Frozen;
        emit FailureRecorded(activeAttempt, requestId, status, reason);
    }

    /// @notice Anyone may bind or resubmit a corrected binding. A revert preserves the recorded result.
    function bind(bytes calldata rawManifest, T.Asset[] calldata oldAssets) external guarded {
        if (phase != T.Phase.ResultRecorded) revert Busy();
        _witness(oldAssets);
        T.Attempt memory a = attempts[activeAttempt];
        (string memory job, string memory project, T.Asset[] memory next) = verifier.verify(
            rawManifest, a.outcome, proposals[a.proposalId], oldAssets, address(this), revision + 1
        );
        bytes32 jobHash = keccak256(bytes(job));
        bytes32 projectHash = keccak256(bytes(project));
        if (
            usedJob[jobHash] || (bytes(projectId).length != 0 && projectHash != keccak256(bytes(projectId)))
                || (bytes(projectId).length == 0
                    && inheritedProjectHash != 0
                    && projectHash == inheritedProjectHash)
        ) revert IdentityMismatch();
        usedJob[jobHash] = true;
        latestJobId = job;
        projectId = project;
        ++revision;
        // The fixed verifier has already validated every entry of this table.
        assetsHash = keccak256(abi.encode(next));
        _checkpoint(a.outcome, next);
        phase = T.Phase.Ready;
        emit Bound(revision, a.proposalId, activeAttempt, rawManifest);
    }

    function _checkpoint(bytes32 resultHash, T.Asset[] memory witness) private {
        bytes32 jobHash = bytes(latestJobId).length == 0 ? bytes32(0) : keccak256(bytes(latestJobId));
        bytes32 projectHash = bytes(projectId).length == 0 ? bytes32(0) : keccak256(bytes(projectId));
        bytes32 digest = keccak256(
            abi.encode(
                block.chainid,
                factory,
                address(this),
                Policy.ID,
                address(encoder),
                address(verifier),
                keccak256(bytes(goal)),
                keccak256(bytes(direction)),
                source,
                revision,
                assetsHash,
                resultHash,
                jobHash,
                projectHash
            )
        );
        checkpoints[revision] = T.Checkpoint(digest, assetsHash, resultHash, jobHash, projectHash);
        emit CheckpointWritten(revision, digest, abi.encode(witness));
    }

    function _witness(T.Asset[] calldata current) private view {
        if (encoder.witnessHash(current) != assetsHash) revert InvalidWitness();
    }

    function _known(uint256 id) private view {
        if (id == 0 || id > proposalCount) revert UnknownProposal();
    }

    function _pending(bytes32 requestId) private view returns (T.Attempt storage a) {
        if (
            msg.sender != Policy.INTAKE || entered || phase != T.Phase.Pending || activeAttempt == 0
                || requestAttempt[requestId] != activeAttempt
        ) revert NotPending();
        a = attempts[activeAttempt];
        if (a.requestId != requestId || a.delivered) revert NotPending();
    }
}
