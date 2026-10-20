// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "./RelaySetup.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";
import {SdkGolden} from "./fixtures/SdkGolden.sol";

contract CrossLanguageTest is RelaySetup {
    function test_sdkCalldataActuallyCreatesBranchWithoutPayment() public {
        (bool success, bytes memory returned) = address(factory).call(SdkGolden.createCalldata());
        assertTrue(success);
        RelayBranch created = RelayBranch(abi.decode(returned, (address)));
        assertTrue(factory.registered(address(created)));
        assertEq(created.goal(), "SDK golden goal");
        assertEq(created.projectId(), "");
        assertEq(created.latestJobId(), "");
        assertEq(intake.count(), 0);
        assertEq(token.transferCalls(), 0);
    }

    function test_sdkCanonicalWitnessMatchesSolidity() public view {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        (,, T.Asset[] memory witness) = branch.verifier()
            .verify(
                F.documentResult(),
                keccak256(F.documentResult()),
                p,
                _empty(),
                0x2000000000000000000000000000000000000002,
                1
            );
        assertEq(keccak256(abi.encode(witness)), SdkGolden.digest());
        assertEq(factory.encoder().assetsHash(witness), SdkGolden.digest());
    }
}
