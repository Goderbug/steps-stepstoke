// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {RelaySetup} from "./RelaySetup.sol";
import {RelayTypes as T} from "src/RelayTypes.sol";
import {PublicResults} from "./fixtures/PublicResults.sol";

contract PublicResultsTest is RelaySetup {
    // Public Completed events authenticate these exact bytes. They have no declared
    // files: recording succeeds, binding fails, and neither failure nor HTTP creates retry rights.
    function test_exactAuthenticatedPublicZeroFileResultsNeverSettleOrRebuy() public {
        for (uint256 i; i < 4; ++i) {
            if (i > 0) {
                branch = factory.createProject("Inspect exact public snapshot");
                _approve(branch);
            }
            bytes memory raw = PublicResults.raw(i);
            assertEq(keccak256(raw), PublicResults.recordedHash(i));
            uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
            bytes32 request = _pay(branch, id, _empty());
            _record(request, raw);
            uint256 count = intake.count();
            vm.expectRevert();
            branch.bind(raw, _empty());
            assertEq(uint256(branch.phase()), uint256(T.Phase.ResultRecorded));
            assertEq(branch.revision(), 0);
            vm.expectRevert();
            branch.retry(PRICE, _empty());
            vm.prank(SPONSOR);
            vm.expectRevert();
            branch.sponsor(id, PRICE, _empty());
            assertEq(intake.count(), count);
        }
    }
}
