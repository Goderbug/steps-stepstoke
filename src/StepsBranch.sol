// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IERC20 {
    function balanceOf(address who) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// The official Intake v2 ABI. Callback is one tuple, not two flat parameters.
interface IIntake {
    struct Callback { address target; bytes4 selector; }
    function requestWithFailure(
        bytes32 action, bytes calldata body, Callback calldata callback,
        bytes4 onFailure, address asset, uint256 amount
    ) external returns (bytes32 requestId);
}

/// An append-only STEPS ledger with independent logical branches.
/// Branch 0 starts at the origin. A fork creates a branch, never a successful step.
/// An authenticated success while Pending appends a checkpoint; expired results are archived separately.
/// Same-chain Intake only. Remote-chain request admission is not implemented.
contract StepsBranch {
    enum Status { Draft, Pending, Succeeded, Refused, Failed, Expired }

    struct Proposal {
        address proposer;
        uint64 branchId;
        Status status;
        address funder;
        uint64 baseRevision;
        bytes32 anchor;
        bytes32 bodyHash;
        bytes32 requestId;
        bytes32 failureReason;
        uint64 fundedAt;
    }

    struct Branch {
        bytes32 head;
        uint64 revision;
        uint64 headCheckpointPlusOne;
        uint64 pendingProposalPlusOne;
    }

    // Parent, branch, revision and request are already immutable in the proposal.
    // URI bytes are emitted, not stored again. Keeping the receipt compact is necessary
    // for Intake's 200,000 gas mainnet callback allowance.
    struct Checkpoint {
        bytes32 resultHash;
        bytes32 uriHash;
        bytes32 digest;
        uint256 proposalId;
    }

    struct CheckpointView {
        uint64 branchId;
        uint64 revision;
        bytes32 parent;
        uint256 proposalId;
        bytes32 requestId;
        bytes32 resultHash;
        bytes32 uriHash;
        bytes32 digest;
    }

    // An expired proposal stays expired. A later protocol outcome never advances a branch.
    // `received` distinguishes an absent record from a genuine status-0 success.
    struct LateReceipt {
        bool received;
        uint8 status; // Intake: 0 success, 1 refused, 2 no result
        bytes32 resultHash;
        bytes32 uriHash;
        bytes32 reason;
    }

    bytes32 public constant ACTION = "job.open@job-1";
    bytes4 public constant ON_RESULT = 0x4374622e;
    bytes4 public constant ON_FAILURE = 0x5a0df71e;
    uint256 public constant MAX_BODY_BYTES = 16 * 1024;
    uint256 public constant MAX_EVENT_URI_BYTES = 2048;
    // Larger results can still be inherited by reference without copying their bytes.
    uint256 public constant MAX_SNAPSHOT_BYTES = 4 * 1024;
    // Local waiting policy, not a claim that IMD has failed or can no longer settle.
    uint64 public constant PENDING_TIMEOUT = 7 days;

    IIntake public immutable intake;
    address public immutable asset;
    uint256 public price;
    address public owner;
    address public pendingOwner;
    Proposal[] public proposals;
    Branch[] public branches;
    Checkpoint[] public checkpoints;
    mapping(bytes32 => uint256) public proposalOfRequest; // proposal id + 1
    mapping(uint256 => LateReceipt) public lateReceiptOf; // proposal id; never a checkpoint
    mapping(uint64 => bytes) private snapshots;           // result.json copied by a snapshot fork
    uint256 private entered = 1;

    event Proposed(uint256 indexed id, uint64 indexed branchId, address indexed proposer, bytes32 anchor, bytes32 bodyHash, bytes body);
    event Funded(uint256 indexed id, uint64 indexed branchId, address indexed funder, bytes32 requestId, uint256 amount);
    event CheckpointRecorded(uint256 indexed checkpointId, uint64 indexed branchId, uint256 indexed proposalId, bytes32 requestId, bytes32 digest, bytes32 resultHash, bytes32 uriHash, string uri);
    event FailureRecorded(uint256 indexed proposalId, uint64 indexed branchId, bytes32 indexed requestId, uint8 status, bytes32 reason);
    // parentCheckpointPlusOne == 0 denotes the origin, not checkpoint zero.
    event Forked(uint64 indexed childBranchId, uint256 indexed parentCheckpointPlusOne, address indexed creator, bytes32 anchor);
    // Exact result.json bytes are stored and readable via snapshotOf; not its referenced files.
    event SnapshotCopied(uint64 indexed branchId, bytes32 resultHash, uint256 bytesCopied);
    event PendingExpired(uint256 indexed proposalId, uint64 indexed branchId, address indexed by);
    event LateResultRecorded(uint256 indexed proposalId, uint64 indexed branchId, bytes32 indexed requestId, bytes32 resultHash, bytes32 uriHash, string uri);
    event LateFailureRecorded(uint256 indexed proposalId, uint64 indexed branchId, bytes32 indexed requestId, uint8 status, bytes32 reason);
    event UriOmitted(bytes32 uriHash);
    event PriceChanged(uint256 price);
    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnerChanged(address indexed from, address indexed to);

    error InvalidConfiguration();
    error NotOwner();
    error NotPendingOwner();
    error Reentrancy();
    error UnknownBranch();
    error UnknownProposal();
    error UnknownCheckpoint();
    error StaleAnchor();
    error BranchBusy();
    error NotDraft();
    error InvalidBody();
    error BodyMismatch();
    error PriceAboveLimit();
    error TokenCallFailed();
    error PaymentMismatch();
    error InvalidRequestId();
    error NotIntake();
    error UnknownRequest();
    error AlreadySettled();
    error InvalidFailureStatus();
    error NotPending();
    error TooEarly();
    error SnapshotMismatch();
    error SnapshotTooLarge();
    error IndexOverflow();

    modifier nonReentrant() {
        if (entered != 1) revert Reentrancy();
        entered = 2;
        _;
        entered = 1;
    }

    constructor(IIntake intake_, address asset_, uint256 price_, address initialOwner_) {
        if (address(intake_) == address(0) || asset_ == address(0) || price_ == 0 || initialOwner_ == address(0)) revert InvalidConfiguration();
        intake = intake_;
        asset = asset_;
        price = price_;
        owner = initialOwner_;
        branches.push(Branch(bytes32(0), 0, 0, 0));
    }

    /// The exact JSON body is the canonical instruction; there is no competing display string.
    /// Semantic API validation and specifying the actual prior source remain client duties.
    function propose(uint64 branchId, bytes32 anchor, bytes calldata body) external nonReentrant returns (uint256 id) {
        if (branchId >= branches.length) revert UnknownBranch();
        Branch storage b = branches[branchId];
        if (anchor != b.head) revert StaleAnchor();
        if (body.length == 0 || body.length > MAX_BODY_BYTES) revert InvalidBody();
        id = proposals.length;
        if (id >= type(uint64).max) revert IndexOverflow();
        proposals.push(Proposal(msg.sender, branchId, Status.Draft, address(0), b.revision, anchor, keccak256(body), bytes32(0), bytes32(0), 0));
        emit Proposed(id, branchId, msg.sender, anchor, keccak256(body), body);
    }

    /// One pending request per branch; different branches can be funded concurrently.
    /// The caller must approve this ledger and supply their maximum acceptable payment.
    function fundWithPayment(uint256 id, bytes calldata body, uint256 maxPayment) external nonReentrant returns (bytes32 requestId) {
        if (id >= proposals.length) revert UnknownProposal();
        Proposal storage p = proposals[id];
        if (p.status != Status.Draft) revert NotDraft();
        if (keccak256(body) != p.bodyHash) revert BodyMismatch();
        Branch storage b = branches[p.branchId];
        if (b.pendingProposalPlusOne != 0) revert BranchBusy();
        if (b.head != p.anchor || b.revision != p.baseRevision) revert StaleAnchor();
        uint256 amount = price;
        if (amount > maxPayment) revert PriceAboveLimit();

        // Reserve before any external call; every failure below rolls the entire payment back.
        p.status = Status.Pending;
        p.funder = msg.sender;
        p.fundedAt = uint64(block.timestamp);
        b.pendingProposalPlusOne = uint64(id + 1);
        uint256 beforeBalance = IERC20(asset).balanceOf(address(this));
        _tokenCall(abi.encodeCall(IERC20.transferFrom, (msg.sender, address(this), amount)));
        if (IERC20(asset).balanceOf(address(this)) != beforeBalance + amount) revert PaymentMismatch();
        _tokenCall(abi.encodeCall(IERC20.approve, (address(intake), 0)));
        _tokenCall(abi.encodeCall(IERC20.approve, (address(intake), amount)));
        requestId = intake.requestWithFailure(ACTION, body, IIntake.Callback(address(this), ON_RESULT), ON_FAILURE, asset, amount);
        if (requestId == bytes32(0) || proposalOfRequest[requestId] != 0) revert InvalidRequestId();
        p.requestId = requestId;
        proposalOfRequest[requestId] = id + 1;
        if (IERC20(asset).balanceOf(address(this)) != beforeBalance) revert PaymentMismatch();
        _tokenCall(abi.encodeCall(IERC20.approve, (address(intake), 0)));
        emit Funded(id, p.branchId, msg.sender, requestId, amount);
    }

    function onResult(bytes32 requestId, bytes32 resultHash, string calldata uri) external nonReentrant {
        uint256 id = _ownUnsettled(requestId);
        if (resultHash == bytes32(0)) revert InvalidRequestId();
        Proposal storage p = proposals[id];
        bytes32 uriHash = keccak256(bytes(uri));
        if (p.status == Status.Expired) {
            LateReceipt storage receipt = lateReceiptOf[id];
            receipt.received = true;
            receipt.resultHash = resultHash;
            receipt.uriHash = uriHash;
            bool fits = bytes(uri).length <= MAX_EVENT_URI_BYTES;
            emit LateResultRecorded(id, p.branchId, requestId, resultHash, uriHash, fits ? uri : "");
            if (!fits) emit UriOmitted(uriHash);
            return;
        }
        Branch storage b = branches[p.branchId];
        uint64 revision = p.baseRevision + 1;
        bytes32 digest = keccak256(abi.encode(block.chainid, address(this), p.branchId, p.anchor, requestId, id, resultHash, uriHash, revision));
        uint256 checkpointId = checkpoints.length;
        if (checkpointId >= type(uint64).max) revert IndexOverflow();
        checkpoints.push(Checkpoint(resultHash, uriHash, digest, id));
        p.status = Status.Succeeded;
        b.head = digest;
        b.revision = revision;
        b.headCheckpointPlusOne = uint64(checkpointId + 1);
        b.pendingProposalPlusOne = 0;
        _emitCheckpoint(checkpointId, uri);
    }

    function onFailure(bytes32 requestId, uint8 status, bytes32 reason, uint16, uint16, bytes calldata) external nonReentrant {
        uint256 id = _ownUnsettled(requestId);
        if (status != 1 && status != 2) revert InvalidFailureStatus();
        Proposal storage p = proposals[id];
        if (p.status == Status.Expired) {
            LateReceipt storage receipt = lateReceiptOf[id];
            receipt.received = true;
            receipt.status = status;
            receipt.reason = reason;
            emit LateFailureRecorded(id, p.branchId, requestId, status, reason);
            return;
        }
        p.status = status == 1 ? Status.Refused : Status.Failed;
        p.failureReason = reason;
        branches[p.branchId].pendingProposalPlusOne = 0;
        // No checkpoint, refund, retry, or successful revision is invented on failure.
        emit FailureRecorded(id, p.branchId, requestId, status, reason);
    }

    /// Anyone may stop waiting after seven days. This does not cancel IMD, prove failure,
    /// refund payment, or create a checkpoint. Later authenticated outcomes are archived.
    function expirePending(uint256 id) external nonReentrant {
        if (id >= proposals.length) revert UnknownProposal();
        Proposal storage p = proposals[id];
        if (p.status != Status.Pending) revert NotPending();
        if (block.timestamp < uint256(p.fundedAt) + PENDING_TIMEOUT) revert TooEarly();
        _checkPendingBranch(id, p);
        p.status = Status.Expired;
        Branch storage b = branches[p.branchId];
        b.pendingProposalPlusOne = 0;
        emit PendingExpired(id, p.branchId, msg.sender);
    }

    /// The snapshot a fork copied, if it asked for one. Empty for reference forks.
    function snapshotOf(uint64 branchId) external view returns (bytes memory) {
        if (branchId >= branches.length) revert UnknownBranch();
        return snapshots[branchId];
    }

    /// Inherits the recorded result commitment without changing the source or creating a step.
    function fork(uint256 parentId) external nonReentrant returns (uint64 childBranchId) {
        return _fork(parentId);
    }

    /// Optional onchain copy of the exact result snapshot, authenticated without a recorder.
    /// The snapshot's referenced file bytes are not copied by this call.
    function forkWithSnapshot(uint256 parentId, bytes calldata resultJson) external nonReentrant returns (uint64 childBranchId) {
        if (parentId >= checkpoints.length) revert UnknownCheckpoint();
        if (resultJson.length > MAX_SNAPSHOT_BYTES) revert SnapshotTooLarge();
        if (keccak256(resultJson) != checkpoints[parentId].resultHash) revert SnapshotMismatch();
        childBranchId = _fork(parentId);
        snapshots[childBranchId] = resultJson;
        emit SnapshotCopied(childBranchId, checkpoints[parentId].resultHash, resultJson.length);
    }

    /// Allows work from the origin even if another origin branch has a missing callback.
    /// This is a separate branch, not cancellation or settlement of the pending request.
    function forkFromOrigin() external nonReentrant returns (uint64 childBranchId) {
        childBranchId = _nextBranchId();
        branches.push(Branch(bytes32(0), 0, 0, 0));
        emit Forked(childBranchId, 0, msg.sender, bytes32(0));
    }

    function checkpoint(uint256 id) external view returns (CheckpointView memory v) {
        if (id >= checkpoints.length) revert UnknownCheckpoint();
        Checkpoint storage c = checkpoints[id];
        Proposal storage p = proposals[c.proposalId];
        v = CheckpointView(p.branchId, p.baseRevision + 1, p.anchor, c.proposalId, p.requestId, c.resultHash, c.uriHash, c.digest);
    }

    function setPrice(uint256 next) external nonReentrant {
        if (msg.sender != owner) revert NotOwner();
        if (next == 0) revert InvalidConfiguration();
        price = next;
        emit PriceChanged(next);
    }

    function transferOwner(address next) external nonReentrant {
        if (msg.sender != owner) revert NotOwner();
        if (next == address(0)) revert InvalidConfiguration();
        pendingOwner = next;
        emit OwnershipTransferStarted(owner, next);
    }

    function acceptOwner() external nonReentrant {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnerChanged(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function count() external view returns (uint256) { return checkpoints.length; }
    function proposalCount() external view returns (uint256) { return proposals.length; }
    function branchCount() external view returns (uint256) { return branches.length; }

    function _ownUnsettled(bytes32 requestId) private view returns (uint256 id) {
        if (msg.sender != address(intake)) revert NotIntake();
        uint256 stored = proposalOfRequest[requestId];
        if (stored == 0) revert UnknownRequest();
        id = stored - 1;
        Proposal storage p = proposals[id];
        if (p.requestId != requestId) revert UnknownRequest();
        if (p.status == Status.Expired) {
            if (lateReceiptOf[id].received) revert AlreadySettled();
            return id;
        }
        if (p.status != Status.Pending) revert AlreadySettled();
        _checkPendingBranch(id, p);
    }

    function _checkPendingBranch(uint256 id, Proposal storage p) private view {
        Branch storage b = branches[p.branchId];
        if (b.pendingProposalPlusOne != id + 1 || b.head != p.anchor || b.revision != p.baseRevision) revert StaleAnchor();
    }

    function _fork(uint256 parentId) private returns (uint64 childBranchId) {
        if (parentId >= checkpoints.length) revert UnknownCheckpoint();
        Checkpoint storage parent = checkpoints[parentId];
        childBranchId = _nextBranchId();
        branches.push(Branch(parent.digest, proposals[parent.proposalId].baseRevision + 1, uint64(parentId + 1), 0));
        emit Forked(childBranchId, parentId + 1, msg.sender, parent.digest);
    }

    function _nextBranchId() private view returns (uint64) {
        if (branches.length > type(uint64).max) revert IndexOverflow();
        return uint64(branches.length);
    }

    function _tokenCall(bytes memory data) private {
        (bool ok, bytes memory returned) = asset.call(data);
        if (!ok || (returned.length != 0 && (returned.length != 32 || !abi.decode(returned, (bool))))) revert TokenCallFailed();
    }

    function _emitCheckpoint(uint256 id, string calldata uri) private {
        Checkpoint storage c = checkpoints[id];
        Proposal storage p = proposals[c.proposalId];
        // Exceptionally long locators stay committed by hash. Read their bytes from the
        // official Intake Completed event instead of spending unbounded callback log gas.
        bool fits = bytes(uri).length <= MAX_EVENT_URI_BYTES;
        string memory eventUri = fits ? uri : "";
        emit CheckpointRecorded(id, p.branchId, c.proposalId, p.requestId, c.digest, c.resultHash, c.uriHash, eventUri);
        if (!fits) emit UriOmitted(c.uriHash);
    }
}
