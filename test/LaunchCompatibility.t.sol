// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {RelaySetup} from "./RelaySetup.sol";
import {RelayFactory} from "src/RelayFactory.sol";
import {RelayBranch} from "src/RelayBranch.sol";
import {RelayEncoder} from "src/RelayEncoder.sol";
import {RelayVerifier} from "src/RelayVerifier.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {Policy} from "src/libraries/Policy.sol";

interface LaunchVm {
    function getNonce(address) external view returns (uint64);
}

contract WrongPolicy {
    function policyId() external pure returns (bytes32) {
        return bytes32(uint256(1));
    }
}

/// Local stand-in for the documented launch CREATE2 batch, not a delivered application.
contract NamedBatchProbe {
    function deployAll(bytes[] calldata codes, bytes32[] calldata salts)
        external
        returns (address[] memory out)
    {
        require(codes.length == 3 && salts.length == 3);
        out = new address[](3);
        for (uint256 i; i < 3; ++i) {
            bytes memory code = codes[i];
            bytes32 salt = salts[i];
            address a;
            assembly ("memory-safe") { a := create2(0, add(code, 32), mload(code), salt) }
            require(a != address(0) && a.code.length > 0);
            out[i] = a;
        }
    }
}

contract LaunchCompatibilityTest is RelaySetup {
    function test_staticFactoryConstructorAcceptsEmptyDependenciesWithoutCallsOrChildren() public {
        address e = address(0x1234);
        address v = address(0x5678);
        assertEq(e.code.length, 0);
        assertEq(v.code.length, 0);
        RelayFactory f = new RelayFactory(RelayEncoder(e), RelayVerifier(v));
        assertEq(address(f.encoder()), e);
        assertEq(address(f.verifier()), v);
        assertEq(f.branchCount(), 0);
        assertEq(LaunchVm(address(vm)).getNonce(address(f)), 1);
        vm.expectRevert(RelayFactory.InvalidDependency.selector);
        f.createProject("Valid goal");
        assertEq(f.branchCount(), 0);
        assertEq(LaunchVm(address(vm)).getNonce(address(f)), 1);
    }

    function test_constructorRejectsZeroAndDuplicateDependencies() public {
        RelayEncoder e = factory.encoder();
        RelayVerifier v = factory.verifier();
        vm.expectRevert(RelayFactory.InvalidDependency.selector);
        new RelayFactory(RelayEncoder(address(0)), v);
        vm.expectRevert(RelayFactory.InvalidDependency.selector);
        new RelayFactory(e, RelayVerifier(address(0)));
        vm.expectRevert(RelayFactory.InvalidDependency.selector);
        new RelayFactory(e, RelayVerifier(address(e)));
    }

    function test_badPolicyAndBadInputsFailBeforeCreateAndRegistration() public {
        WrongPolicy bad = new WrongPolicy();
        RelayFactory f = new RelayFactory(factory.encoder(), RelayVerifier(address(bad)));
        vm.expectRevert(RelayFactory.InvalidDependency.selector);
        f.createProject("Goal");
        assertEq(LaunchVm(address(vm)).getNonce(address(f)), 1);
        uint256 beforeNonce = LaunchVm(address(vm)).getNonce(address(factory));
        vm.expectRevert();
        factory.createProject("");
        assertEq(LaunchVm(address(vm)).getNonce(address(factory)), beforeNonce);
        assertEq(factory.branchCount(), 1);
    }

    function test_directChildrenAreCompleteIndependentPayers() public {
        RelayBranch second = factory.createProject("Second project");
        assertTrue(address(branch).code.length > 10000);
        assertEq(keccak256(address(second).code), keccak256(address(branch).code));
        assertEq(second.factory(), address(factory));
        assertTrue(factory.registered(address(second)));
        assertTrue(second.anchor() != branch.anchor());
        _approve(second);
        uint256 firstId = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        uint256 secondId = second.propose(_proposal(second, T.Profile.MarkdownCreate, 1), _empty());
        bytes32 firstRequest = _pay(branch, firstId, _empty());
        bytes32 secondRequest = _pay(second, secondId, _empty());
        assertEq(intake.request(firstRequest).payer, address(branch));
        assertEq(intake.request(secondRequest).payer, address(second));
        assertEq(token.allowance(address(branch), Policy.INTAKE), 0);
        assertEq(token.allowance(address(second), Policy.INTAKE), 0);
    }

    function test_launchAndRuntimeChildPassProtectedOpcodeRule() public view {
        _scan(address(factory).code);
        _scan(address(factory.encoder()).code);
        _scan(address(factory.verifier()).code);
        _scan(address(branch).code);
    }

    function _scan(bytes memory code) private pure {
        require(code.length > 0 && code.length <= 24576, "EIP170");
        bool reachable = true;
        for (uint256 j; j < code.length; ++j) {
            uint8 op = uint8(code[j]);
            if (op == 0x5b) reachable = true;
            if (op >= 0x60 && op <= 0x7f) {
                j += op - 0x5f;
                continue;
            }
            if (reachable) require(op != 0xf4 && op != 0xf2 && op != 0xff, "forbidden opcode");
            if (op == 0 || op == 0x56 || op == 0xf3 || op == 0xfd || op == 0xfe || op == 0xff) {
                reachable = false;
            }
        }
    }

    function test_callbackUriAtLimitWithinOfficialStipendAndAboveStaysPending() public {
        bytes32 req =
            _pay(branch, branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty()), _empty());
        bytes memory uri = new bytes(1025);
        for (uint256 i; i < uri.length; ++i) {
            uri[i] = "u";
        }
        vm.prank(Policy.INTAKE);
        (bool ok,) = address(branch).call{gas: 200000}(
            abi.encodeCall(branch.onIntakeResult, (req, keccak256("raw"), string(uri)))
        );
        assertFalse(ok);
        assertEq(uint256(branch.phase()), uint256(T.Phase.Pending));
        assembly ("memory-safe") { mstore(uri, 1024) }
        vm.prank(Policy.INTAKE);
        (ok,) = address(branch).call{gas: 200000}(
            abi.encodeCall(branch.onIntakeResult, (req, keccak256("raw"), string(uri)))
        );
        assertTrue(ok);
        assertEq(uint256(branch.phase()), uint256(T.Phase.ResultRecorded));
    }

    function test_namedBatchBackwardReferencesThenRuntimeChild() public {
        NamedBatchProbe probe = new NamedBatchProbe();
        bytes[] memory codes = new bytes[](3);
        bytes32[] memory salts = new bytes32[](3);
        codes[0] = type(RelayEncoder).creationCode;
        codes[1] = type(RelayVerifier).creationCode;
        salts[0] = keccak256("RelayEncoder");
        salts[1] = keccak256("RelayVerifier");
        salts[2] = keccak256("RelayFactory");
        address e = _predict(address(probe), salts[0], codes[0]);
        address v = _predict(address(probe), salts[1], codes[1]);
        codes[2] = abi.encodePacked(type(RelayFactory).creationCode, abi.encode(e, v));
        address f = _predict(address(probe), salts[2], codes[2]);
        address[] memory deployed = probe.deployAll(codes, salts);
        assertEq(deployed[0], e);
        assertEq(deployed[1], v);
        assertEq(deployed[2], f);
        RelayBranch child = RelayFactory(f).createProject("Batch-created product");
        assertEq(child.factory(), f);
        assertTrue(RelayFactory(f).registered(address(child)));
        assertEq(LaunchVm(address(vm)).getNonce(e), 1);
        assertEq(LaunchVm(address(vm)).getNonce(v), 1);
    }

    function _predict(address deployer, bytes32 salt, bytes memory code) private pure returns (address) {
        return
            address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, keccak256(code)))))
            );
    }
}
