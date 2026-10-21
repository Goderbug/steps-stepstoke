// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {RelayVerifier} from "src/RelayVerifier.sol";
import {RelayEncoder} from "src/RelayEncoder.sol";

import {TestBase, Vm} from "../TestBase.sol";
import {RelayFactory} from "src/RelayFactory.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {IIntake} from "src/interfaces/IIntake.sol";

/// @dev Independent local token. Hooks exercise both transfer and approval interactions.
contract SpecToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;
    uint256 public transfers;
    address public hook;
    bytes public hookData;
    uint8 public hookOn;
    bool public hookSucceeded;
    bool public rejectClear;

    function mint(address who, uint256 amount) external {
        balanceOf[who] += amount;
        totalSupply += amount;
    }

    function arm(address target, bytes calldata data, uint8 operation) external {
        hook = target;
        hookData = data;
        hookOn = operation;
        hookSucceeded = false;
    }

    function setRejectClear(bool value) external {
        rejectClear = value;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (rejectClear && amount == 0) return false;
        allowance[msg.sender][spender] = amount;
        _hook(2);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "test token: allowance");
        allowance[from][msg.sender] -= amount;
        _move(from, to, amount);
        _hook(1);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "test token: balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        ++transfers;
    }

    function _hook(uint8 operation) private {
        if (hookOn != operation) return;
        hookOn = 0;
        (hookSucceeded,) = hook.call(hookData);
    }
}

/// @dev Models the documented v2 protocol: runtime price, Branch payer, immediate
/// treasury transfer, authenticated writer, one callback attempt with 200,000 gas.
/// Optional faults are isolated from the ordinary protocol path.
contract SpecIntake is IIntake {
    struct Receipt {
        address payer;
        Callback callback;
        bytes4 failure;
        bytes32 action;
        bytes body;
        uint256 amount;
        bool attempted;
        bool delivered;
    }

    SpecToken public token;
    address public writer;
    address public treasury;
    mapping(bytes32 => uint256) public prices;
    mapping(bytes32 => Receipt) private receipts;
    uint256 public count;
    uint256 public collected;
    uint8 public fault;
    bytes32 public forcedId;
    address public attackTarget;
    bytes public attackData;
    bool public attackSucceeded;
    uint256 public observedApproval;

    function initialize(SpecToken token_, address writer_, address treasury_) external {
        require(writer == address(0));
        token = token_;
        writer = writer_;
        treasury = treasury_;
    }

    function setPrice(bytes32 action, uint256 value) external {
        prices[action] = value;
    }

    function setFault(uint8 mode, bytes32 id) external {
        fault = mode;
        forcedId = id;
    }

    function arm(address target, bytes calldata data) external {
        attackTarget = target;
        attackData = data;
        attackSucceeded = false;
    }

    function priceOf(bytes32 action, address asset) external view returns (uint256) {
        return asset == address(token) ? prices[action] : 0;
    }

    function receipt(bytes32 id) external view returns (Receipt memory) {
        return receipts[id];
    }

    function requestWithFailure(
        bytes32 action,
        bytes calldata body,
        Callback calldata callback,
        bytes4 onFailure,
        address asset,
        uint256 amount
    ) external payable returns (bytes32 id) {
        require(msg.value == 0 && asset == address(token), "test intake: asset");
        require(prices[action] != 0 && amount >= prices[action], "test intake: price");
        require(body.length > 0 && body.length <= 16_384, "test intake: body");
        if (fault == 1) revert("test intake: unavailable");
        observedApproval = token.allowance(msg.sender, address(this));
        uint256 pull = fault == 2 ? amount - 1 : amount;
        require(token.transferFrom(msg.sender, treasury, pull));
        collected += pull;
        ++count;
        id = fault == 3 ? forcedId : keccak256(abi.encode(msg.sender, count));
        receipts[id] = Receipt(msg.sender, callback, onFailure, action, body, amount, false, false);
        if (attackTarget != address(0)) {
            (attackSucceeded,) = attackTarget.call(attackData);
        }
    }

    function result(bytes32 id, bytes32 digest, string calldata uri) external returns (bool delivered) {
        require(msg.sender == writer, "test intake: writer");
        Receipt storage r = receipts[id];
        require(r.payer != address(0) && !r.attempted, "test intake: settled");
        r.attempted = true;
        (delivered,) = r.callback.target.call{gas: 200_000}(
            abi.encodeWithSelector(r.callback.selector, id, digest, uri)
        );
        r.delivered = delivered;
    }

    function failure(bytes32 id, uint8 status, bytes32 reason) external returns (bool delivered) {
        require(msg.sender == writer, "test intake: writer");
        Receipt storage r = receipts[id];
        require(r.payer != address(0) && !r.attempted, "test intake: settled");
        r.attempted = true;
        (delivered,) = r.callback.target.call{gas: 200_000}(
            abi.encodeWithSelector(r.failure, id, status, reason, uint16(0), uint16(0), bytes(""))
        );
        r.delivered = delivered;
    }
}

/// @dev Test-only encoding and actual content, independent of production Text,
/// Assets, Policy, parser, encoder and the implementing contributor's fixtures.
library SpecData {
    function decimal(uint256 n) internal pure returns (string memory) {
        if (n == 0) return "0";
        bytes memory b;
        while (n != 0) {
            b = bytes.concat(bytes1(uint8(48 + n % 10)), b);
            n /= 10;
        }
        return string(b);
    }

    function hex32(bytes32 value) internal pure returns (string memory) {
        bytes memory out = new bytes(64);
        bytes16 alphabet = "0123456789abcdef";
        for (uint256 i; i < 32; ++i) {
            out[2 * i] = alphabet[uint8(value[i]) / 16];
            out[2 * i + 1] = alphabet[uint8(value[i]) % 16];
        }
        return string(out);
    }

    function repeat(bytes1 c, uint256 n) internal pure returns (bytes memory out) {
        out = new bytes(n);
        for (uint256 i; i < n; ++i) {
            out[i] = c;
        }
    }

    function document() internal pure returns (bytes memory) {
        return bytes(unicode"# Relay field notes\n\nCafé, 水, and 🚀.\n\n<!-- keep-document-marker -->\n");
    }

    function html() internal pure returns (bytes memory) {
        return bytes(
            '<!doctype html><html><head><meta charset="utf-8"><style>body{color:#123}</style></head>'
            '<body><h1 id="keep-html-marker">Relay field notes</h1><script>const localOnly=1;</script></body></html>'
        );
    }

    function png() internal pure returns (bytes memory) {
        // Valid one-pixel PNG: signature, IHDR, zlib-compressed IDAT, IEND including CRCs.
        return hex"89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63d02eddff1f00048d025f4502a01f0000000049454e44ae426082";
    }

    function pngBase64() internal pure returns (string memory) {
        return
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPQLt3/HwAEjQJfRQKgHwAAAABJRU5ErkJggg==";
    }

    function illustratedHtml() internal pure returns (bytes memory) {
        return bytes.concat(
            '<!doctype html><html><head><meta charset="utf-8"><style>body{color:#123}</style></head>'
            '<body><h1 id="keep-html-marker">Relay field notes</h1><img alt="pixel" src="data:image/png;base64,',
            bytes(pngBase64()),
            '"><script>const localOnly=1;</script></body></html>'
        );
    }

    function kind(T.Profile profile) internal pure returns (T.Kind) {
        if (profile == T.Profile.MarkdownCreate || profile == T.Profile.MarkdownUpdate) {
            return T.Kind.Markdown;
        }
        if (profile == T.Profile.HTMLCreate || profile == T.Profile.HTMLUpdate) return T.Kind.HTML;
        return T.Kind.Image;
    }

    function mime(T.Kind k) internal pure returns (string memory) {
        if (k == T.Kind.Markdown) return "text/markdown";
        if (k == T.Kind.HTML) return "text/html";
        return "image/png";
    }

    function submission(string memory job) internal pure returns (bytes32) {
        return sha256(abi.encode("inline-test-submission", job));
    }

    function manifest(T.Proposal memory p, string memory job, string memory project, bytes memory file)
        internal
        pure
        returns (bytes memory)
    {
        return bytes.concat(
            '{"jobId":"',
            bytes(job),
            '","projectId":"',
            bytes(project),
            '","state":"completed","source":[],"files":[{"name":"',
            bytes(p.outputName),
            '","path":"',
            bytes(p.outputPath),
            '","hash":"',
            bytes(hex32(sha256(file))),
            '","mediaType":"',
            bytes(mime(kind(p.profile))),
            '","bytes":',
            bytes(decimal(file.length)),
            ',"submissionHash":"',
            bytes(hex32(submission(job))),
            '"}]}'
        );
    }

    function output(
        T.Proposal memory p,
        string memory job,
        bytes memory file,
        bytes memory raw,
        address producer,
        uint64 revision
    ) internal pure returns (T.Asset memory) {
        return T.Asset(
            p.target,
            kind(p.profile),
            p.outputName,
            p.outputPath,
            sha256(file),
            mime(kind(p.profile)),
            uint32(file.length),
            submission(job),
            producer,
            job,
            keccak256(raw),
            revision
        );
    }

    function next(T.Asset[] memory old, T.Asset memory output_)
        internal
        pure
        returns (T.Asset[] memory result)
    {
        bool replaces;
        for (uint256 i; i < old.length; ++i) {
            if (old[i].key == output_.key) replaces = true;
        }
        result = new T.Asset[](old.length + (replaces ? 0 : 1));
        uint256 at;
        for (uint256 i; i < old.length; ++i) {
            if (old[i].key != output_.key) result[at++] = old[i];
        }
        result[at] = output_;
        // Independent simple sort of at most sixteen entries.
        for (uint256 i = 1; i < result.length; ++i) {
            uint256 j = i;
            while (j > 0 && result[j].key < result[j - 1].key) {
                (result[j], result[j - 1]) = (result[j - 1], result[j]);
                --j;
            }
        }
    }
}

abstract contract SpecSetup is TestBase {
    address internal constant INTAKE = 0xa43e6F75ee006411F79Ac1C84120606C2330DE82;
    address internal constant IMD = 0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7;
    bytes32 internal constant OPEN = bytes32("job.open@job-1");
    bytes32 internal constant CONTINUE = bytes32("job.continue@job-1");
    // Synthetic local actors, never used as deployment configuration or real credentials.
    address internal constant ALICE = address(uint160(uint256(keccak256("spec-sponsor-alice"))));
    address internal constant BOB = address(uint160(uint256(keccak256("spec-sponsor-bob"))));
    address internal constant WRITER = address(uint160(uint256(keccak256("spec-intake-writer"))));
    address internal constant TREASURY = address(uint160(uint256(keccak256("spec-intake-treasury"))));
    uint256 internal constant INITIAL = 1_000_000 ether;
    uint256 internal constant FEE = 0.5 ether;
    bytes32 internal constant CHECKPOINT_EVENT = keccak256("CheckpointWritten(uint64,bytes32,bytes)");
    RelayFactory internal factory;
    RelayBranch internal root;
    SpecToken internal token;
    SpecIntake internal intake;

    function setUp() public virtual {
        vm.etch(IMD, address(new SpecToken()).code);
        vm.etch(INTAKE, address(new SpecIntake()).code);
        token = SpecToken(IMD);
        intake = SpecIntake(INTAKE);
        intake.initialize(token, WRITER, TREASURY);
        intake.setPrice(OPEN, FEE);
        intake.setPrice(CONTINUE, FEE);
        factory = new RelayFactory(new RelayEncoder(), new RelayVerifier());
        vm.prank(BOB);
        root = factory.createProject("Preserve public field notes and illustrations.");
        token.mint(ALICE, INITIAL);
        token.mint(BOB, INITIAL);
        approveBoth(root);
    }

    function approveBoth(RelayBranch branch) internal {
        vm.prank(ALICE);
        token.approve(address(branch), INITIAL);
        vm.prank(BOB);
        token.approve(address(branch), INITIAL);
    }

    function empty() internal pure returns (T.Asset[] memory) {
        return new T.Asset[](0);
    }

    function proposal(RelayBranch branch, T.Profile profile, uint256 key)
        internal
        view
        returns (T.Proposal memory p)
    {
        p.anchor = branch.anchor();
        p.profile = profile;
        p.target = bytes32(key);
        p.text = "Preserve existing markers and produce the declared output.";
        T.Kind k = SpecData.kind(profile);
        p.outputName = k == T.Kind.Markdown ? "notes" : k == T.Kind.HTML ? "page" : "pixel";
        p.outputPath = k == T.Kind.Markdown
            ? "artifacts/notes.md"
            : k == T.Kind.HTML ? "artifacts/index.html" : "artifacts/pixel.png";
        bool update = profile == T.Profile.MarkdownUpdate || profile == T.Profile.HTMLUpdate;
        p.inputs = new bytes32[](update ? 1 : 0);
        if (update) p.inputs[0] = p.target;
    }

    function pay(RelayBranch branch, uint256 id, T.Asset[] memory assets, address sponsor)
        internal
        returns (bytes32 request)
    {
        vm.prank(sponsor);
        request = branch.sponsor(id, type(uint256).max, assets);
    }

    function record(bytes32 request, bytes memory raw) internal {
        vm.prank(WRITER);
        require(intake.result(request, keccak256(raw), "ipfs://inline-spec/result.json"), "callback stipend");
    }

    function accept(
        RelayBranch branch,
        T.Proposal memory p,
        T.Asset[] memory old,
        string memory job,
        string memory project,
        bytes memory file,
        address sponsor
    ) internal returns (T.Asset[] memory expected) {
        bytes memory raw = SpecData.manifest(p, job, project, file);
        uint64 revision = branch.revision() + 1;
        uint256 id = branch.propose(p, old);
        bytes32 request = pay(branch, id, old, sponsor);
        record(request, raw);
        expected = SpecData.next(old, SpecData.output(p, job, file, raw, address(branch), revision));
        bindAndCheck(branch, raw, old, expected);
    }

    function bindAndCheck(
        RelayBranch branch,
        bytes memory raw,
        T.Asset[] memory old,
        T.Asset[] memory expected
    ) internal {
        vm.recordLogs();
        branch.bind(raw, old);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 matches;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(branch) || logs[i].topics[0] != CHECKPOINT_EVENT) continue;
            ++matches;
            T.Asset[] memory fromEvent = abi.decode(abi.decode(logs[i].data, (bytes)), (T.Asset[]));
            assertEq(abi.encode(fromEvent), abi.encode(expected));
            assertEq(logs[i].topics[1], bytes32(uint256(branch.revision())));
            assertEq(logs[i].topics[2], branch.anchor());
        }
        assertEq(matches, 1);
        assertEq(branch.assetsHash(), keccak256(abi.encode(expected)));
        assertEq(branch.checkpoint(branch.revision()).assetsHash, keccak256(abi.encode(expected)));
        assertEq(branch.checkpoint(branch.revision()).resultHash, keccak256(raw));
        assertEq(uint256(branch.phase()), uint256(T.Phase.Ready));
    }

    function assertAccounting(uint256 paid, uint256 held) internal view {
        assertEq(token.balanceOf(TREASURY), paid);
        assertEq(intake.collected(), paid);
        assertEq(token.balanceOf(address(root)), held);
        assertEq(token.balanceOf(ALICE) + token.balanceOf(BOB) + paid + held, 2 * INITIAL);
        assertEq(token.balanceOf(INTAKE), 0);
        assertEq(token.allowance(address(root), INTAKE), 0);
    }
}
