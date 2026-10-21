// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {TestBase, Vm} from "./TestBase.sol";
import {MockToken} from "./mocks/MockToken.sol";
import {MockIntake} from "./mocks/MockIntake.sol";
import {RelayFactory} from "../src/RelayFactory.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {RelayEncoder} from "../src/RelayEncoder.sol";
import {RelayVerifier} from "../src/RelayVerifier.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {Text} from "../src/libraries/Text.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";

abstract contract RelaySetup is TestBase {
    RelayFactory internal factory;
    RelayBranch internal branch;
    MockToken internal token;
    MockIntake internal intake;
    address internal constant SPONSOR = address(0xB0B);
    address internal constant WRITER = address(0xA11CE);
    address internal constant TREASURY = address(0xC0FE);
    uint256 internal constant PRICE = 0.5 ether;
    bytes32 internal constant WITNESS_EVENT = keccak256("CheckpointWritten(uint64,bytes32,bytes)");

    function setUp() public virtual {
        MockToken tokenCode = new MockToken();
        MockIntake intakeCode = new MockIntake();
        vm.etch(Policy.IMD, address(tokenCode).code);
        vm.etch(Policy.INTAKE, address(intakeCode).code);
        token = MockToken(Policy.IMD);
        intake = MockIntake(Policy.INTAKE);
        intake.initialize(WRITER, TREASURY, Policy.IMD);
        intake.setPrice(Policy.OPEN, PRICE);
        intake.setPrice(Policy.CONTINUE, PRICE);
        factory = new RelayFactory(new RelayEncoder(), new RelayVerifier());
        branch = factory.createProject("Maintain a public relay project.");
        token.mint(SPONSOR, 1000 ether);
        _approve(branch);
    }

    function _approve(RelayBranch b) internal {
        vm.prank(SPONSOR);
        token.approve(address(b), 1000 ether);
    }

    function _empty() internal pure returns (T.Asset[] memory) {
        return new T.Asset[](0);
    }

    function _proposal(RelayBranch b, T.Profile profile, uint256 key)
        internal
        view
        returns (T.Proposal memory p)
    {
        p.anchor = b.anchor();
        p.profile = profile;
        p.target = bytes32(key);
        p.inputs = new bytes32[](0);
        p.text = "Perform the declared change.";
        T.Kind k = Policy.kind(profile);
        p.outputName = k == T.Kind.Markdown ? "main" : k == T.Kind.HTML ? "site" : "illustration";
        p.outputPath = k == T.Kind.Markdown
            ? "artifacts/main.md"
            : k == T.Kind.HTML ? "artifacts/index.html" : "artifacts/illustration.png";
        if (Policy.update(profile)) {
            p.inputs = new bytes32[](1);
            p.inputs[0] = p.target;
        }
    }

    function _pay(RelayBranch b, uint256 id, T.Asset[] memory old) internal returns (bytes32) {
        vm.prank(SPONSOR);
        return b.sponsor(id, 10 ether, old);
    }

    function _record(bytes32 request, bytes memory raw) internal {
        vm.prank(WRITER);
        assertTrue(intake.complete(request, raw));
    }

    function _bind(RelayBranch b, bytes memory raw, T.Asset[] memory old)
        internal
        returns (T.Asset[] memory next)
    {
        vm.recordLogs();
        b.bind(raw, old);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(b) && logs[i].topics[0] == WITNESS_EVENT) {
                next = abi.decode(abi.decode(logs[i].data, (bytes)), (T.Asset[]));
            }
        }
        assertEq(b.assetsHash(), keccak256(abi.encode(next)));
    }

    function _accept(RelayBranch b, T.Proposal memory p, T.Asset[] memory old, bytes memory raw)
        internal
        returns (T.Asset[] memory next)
    {
        uint256 id = b.propose(p, old);
        bytes32 request = _pay(b, id, old);
        _record(request, raw);
        next = _bind(b, raw, old);
    }

    function _document() internal returns (T.Asset[] memory) {
        return _accept(branch, _proposal(branch, T.Profile.MarkdownCreate, 1), _empty(), F.documentResult());
    }

    function _manifest(string memory job, T.Kind kind, uint256 size) internal pure returns (bytes memory) {
        return bytes.concat(
            '{"jobId":',
            Text.quote(job),
            ',"projectId":',
            Text.quote(F.project()),
            ',"state":"completed","files":[{"name":',
            Text.quote(kind == T.Kind.Markdown ? "main" : kind == T.Kind.HTML ? "site" : "illustration"),
            ',"path":',
            Text.quote(
                kind == T.Kind.Markdown
                    ? "artifacts/main.md"
                    : kind == T.Kind.HTML ? "artifacts/index.html" : "artifacts/illustration.png"
            ),
            ',"hash":"',
            bytes(Text.hex32(sha256("local-fixture-content"))),
            '","mediaType":',
            Text.quote(Policy.mime(kind)),
            ',"bytes":',
            bytes(Text.decimal(size)),
            ',"submissionHash":"',
            bytes(Text.hex32(sha256("local-fixture-submission"))),
            '"}]}'
        );
    }
}
