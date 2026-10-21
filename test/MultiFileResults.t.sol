// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "./RelaySetup.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {RelayVerifier} from "../src/RelayVerifier.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {Text} from "../src/libraries/Text.sol";
import {FixtureData as F} from "./fixtures/FixtureData.sol";
import {MultiFileResult as M} from "./fixtures/MultiFileResult.sol";

contract MultiFileResultsTest is RelaySetup {
    function test_exactObservedTwoFileResultBindsDeclaredOutputAndForks() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.outputName = "r5-report";
        p.outputPath = "artifacts/r5-report.md";
        bytes memory raw = M.raw();
        T.Asset[] memory next = _accept(branch, p, _empty(), raw);
        assertEq(uint256(branch.phase()), uint256(T.Phase.Ready));
        assertEq(branch.checkpoint(1).resultHash, keccak256(raw));
        assertEq(next.length, 1);
        assertEq(next[0].name, p.outputName);
        assertEq(next[0].fileHash, 0x77ddc8340baa239e79c2f6360bbd08b8e8ed221c28667532917b6a8da853fa25);
        assertEq(next[0].size, 25123);
        assertEq(next[0].producer, address(branch));
        RelayBranch child = factory.fork(address(branch), 1, next, "Continue the accepted report");
        assertEq(child.assetsHash(), branch.assetsHash());
        assertEq(child.latestJobId(), "");
        assertEq(child.inheritedProjectHash(), keccak256(bytes(branch.projectId())));
        assertEq(intake.count(), 1);
    }

    function _extra(uint256 i) private pure returns (bytes memory) {
        // Extra producer artifacts are not accepted assets, so their MIME/size do not
        // introduce a new supported type or consume a slot in the accepted witness.
        return bytes.concat(
            '{"name":"data-',
            bytes(Text.decimal(i)),
            '","path":"artifacts/data-',
            bytes(Text.decimal(i)),
            '.json","mediaType":"application/json","bytes":999999999}'
        );
    }

    function _envelope(uint256 count, uint256 position) private pure returns (bytes memory raw) {
        bytes memory files;
        for (uint256 i; i < count; ++i) {
            if (i != position) files = bytes.concat(files, _extra(i), ",");
            else files = bytes.concat(files, "{");
        }
        // Insert extras either before or after the declared descriptor, retaining exact bytes.
        if (position == count - 1) {
            return replace(F.documentResult(), '"files":[{', bytes.concat('"files":[', files));
        }
        bytes memory trailing;
        for (uint256 i = 1; i < count; ++i) {
            trailing = bytes.concat(trailing, ",", _extra(i));
        }
        return replace(F.documentResult(), "}]}", bytes.concat("}", trailing, "]}"));
    }

    function test_declaredOutputAtBeginningOrEndOfFourAndSeventeenFiles() public view {
        for (uint256 count = 4; count <= 17; count += 13) {
            for (uint256 position; position < 2; ++position) {
                bytes memory raw = _envelope(count, position == 0 ? 0 : count - 1);
                (,, T.Asset[] memory next) = factory.verifier()
                    .verify(
                        raw,
                        keccak256(raw),
                        _proposal(branch, T.Profile.MarkdownCreate, 1),
                        _empty(),
                        address(branch),
                        1
                    );
                assertEq(next.length, 1);
                assertEq(next[0].fileHash, sha256(F.document()));
            }
        }
    }

    function _reject(bytes memory raw) private {
        RelayVerifier verifier = factory.verifier();
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        vm.expectRevert();
        verifier.verify(raw, keccak256(raw), p, _empty(), address(branch), 1);
    }

    function test_duplicateOutputNamePathOrExactMatchIsAmbiguous() public {
        bytes memory raw = F.documentResult();
        _reject(replace(raw, '"files":[{', '"files":[{"name":"main","path":"artifacts/other.md"},{'));
        _reject(replace(raw, '"files":[{', '"files":[{"name":"other","path":"artifacts/main.md"},{'));
        _reject(replace(raw, '"files":[{', '"files":[{"name":"main","path":"artifacts/main.md"},{'));
        _reject(replace(raw, '"name":"main"', '"name":"other"'));
    }

    function test_invalidExtraJSONAndRetainedBoundsStillReject() public {
        _reject(
            replace(
                F.documentResult(),
                '"files":[{',
                '"files":[{"name":"data","path":"artifacts/data.json","x":0,"\\u0078":1},{'
            )
        );
        _reject(
            replace(
                F.documentResult(),
                '"files":[{',
                '"files":[{"name":"data","path":"artifacts/data.json","x":"\\ud800"},{'
            )
        );
        _reject(new bytes(Policy.MAX_MANIFEST + 1));
    }

    function test_changingEvenIgnoredFileBytesCannotBindOrBuyAgain() public {
        bytes memory raw = _envelope(4, 3);
        uint256 id = branch.propose(_proposal(branch, T.Profile.MarkdownCreate, 1), _empty());
        _record(_pay(branch, id, _empty()), raw);
        bytes memory changed = replace(raw, "999999999", "999999998");
        vm.expectRevert();
        branch.bind(changed, _empty());
        vm.prank(SPONSOR);
        vm.expectRevert();
        branch.sponsor(id, PRICE, _empty());
        vm.expectRevert();
        branch.retry(PRICE, _empty());
        assertEq(intake.count(), 1);
        T.Asset[] memory next = _bind(branch, raw, _empty());
        assertEq(next.length, 1);
        assertEq(branch.revision(), 1);
        assertEq(intake.count(), 1);
    }
}
