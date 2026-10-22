// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelaySetup} from "./RelaySetup.sol";
import {RelayVerifier} from "../src/RelayVerifier.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {ManifestJSON} from "../src/libraries/ManifestJSON.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {Text} from "../src/libraries/Text.sol";

/// @dev Review finding 16331cb9: with MAX_RETAINED_TOKENS = 256 a completed result listing
/// twenty standard file entries (13 retained tokens each plus 9 for the root) reverted
/// Policy.Limit although every entry was well formed and the document was under 5 KB, which
/// stranded the paid Branch in ResultRecorded. The cap is now 2 * MAX_VALUES, so the value,
/// key-byte and work budgets are always reached first.
contract ManifestRetainedTokensTest is RelaySetup {
    RelayVerifier internal verifier;

    uint256 private constant ROOT_TOKENS = 9;
    uint256 private constant FILE_TOKENS = 13;

    function setUp() public override {
        super.setUp();
        verifier = new RelayVerifier();
    }

    function _entry(bytes memory name, bytes memory path, bytes memory mediaType, uint256 salt)
        private
        pure
        returns (bytes memory)
    {
        return bytes.concat(
            '{"name":"',
            name,
            '","path":"',
            path,
            '","hash":"',
            bytes(Text.hex32(sha256(abi.encode(salt)))),
            '","mediaType":"',
            mediaType,
            '","bytes":12,"submissionHash":"',
            bytes(Text.hex32(sha256(abi.encode(salt + 1000)))),
            '"}'
        );
    }

    /// A completed result with `extras` ordinary produced files followed by the declared output.
    function _result(uint256 extras) private pure returns (bytes memory raw) {
        raw = '{"jobId":"job-many-files","projectId":"project-a","state":"completed","files":[';
        for (uint256 i; i < extras; ++i) {
            raw = bytes.concat(
                raw,
                _entry(
                    bytes.concat("f", bytes(Text.decimal(i))),
                    bytes.concat("src/f", bytes(Text.decimal(i)), ".txt"),
                    "text/plain",
                    i
                ),
                ","
            );
        }
        raw = bytes.concat(raw, _entry("main", "artifacts/main.md", "text/markdown", 7777), "]}");
    }

    function _declared() private pure returns (T.Proposal memory p) {
        p.profile = T.Profile.MarkdownCreate;
        p.target = bytes32(uint256(1));
        p.inputs = new bytes32[](0);
        p.outputName = "main";
        p.outputPath = "artifacts/main.md";
        p.text = "Perform the declared change.";
    }

    function _verify(bytes memory raw) private view returns (T.Asset[] memory next) {
        (,, next) = verifier.verify(raw, keccak256(raw), _declared(), _empty(), address(0xB), 1);
    }

    /// Combined parser work of `_result(extras)`: raw bytes, 96 per value, 8 per decoded key
    /// byte and 4 per prior-key comparison (no escapes, so no segment flushes).
    function _work(uint256 extras) private pure returns (uint256) {
        uint256 files = extras + 1;
        uint256 values = 5 + 7 * files;
        uint256 keyBytes = 24 + 40 * files;
        uint256 comparisons = 6 + 15 * files;
        return _result(extras).length + 96 * values + 8 * keyBytes + 4 * comparisons;
    }

    function test_capIsTwiceTheValueBudget() public pure {
        assertEq(ManifestJSON.MAX_RETAINED_TOKENS, 2 * ManifestJSON.MAX_VALUES);
        assertEq(ManifestJSON.MAX_RETAINED_TOKENS, 1024);
    }

    function test_twentyFileResultVerifiesUnderFiveKilobytes() public view {
        bytes memory raw = _result(19);
        assertTrue(raw.length < 5_000);
        T.Asset[] memory next = _verify(raw);
        assertEq(next.length, 1);
        assertEq(keccak256(bytes(next[0].name)), keccak256("main"));
        assertEq(keccak256(bytes(next[0].path)), keccak256("artifacts/main.md"));
    }

    function test_twentyFileResultBindsAsCompleteBranchTransaction() public {
        T.Proposal memory p = _proposal(branch, T.Profile.MarkdownCreate, 1);
        p.outputName = "main";
        p.outputPath = "artifacts/main.md";
        bytes memory raw = _result(19);
        T.Asset[] memory next = _accept(branch, p, _empty(), raw);
        assertEq(uint256(branch.phase()), uint256(T.Phase.Ready));
        assertEq(branch.checkpoint(1).resultHash, keccak256(raw));
        assertEq(next.length, 1);
        assertEq(keccak256(bytes(next[0].name)), keccak256("main"));
        assertEq(next[0].producer, address(branch));
    }

    /// The old 256-token cap was the binding limit for standard entries (19 files). Now the
    /// first refused shape is refused by the unchanged combined work budget, well before the
    /// retained-token cap and the value budget: at that boundary the retained count is far
    /// below 1,024 and the value count is below 512, so no other limit moved.
    function test_workBudgetRefusesBeforeRetainedTokenCap() public {
        uint256 extras = 19;
        while (_work(extras + 1) <= ManifestJSON.MAX_WORK) {
            ++extras;
        }
        assertTrue(_work(extras) <= ManifestJSON.MAX_WORK);
        assertTrue(_work(extras + 1) > ManifestJSON.MAX_WORK);
        uint256 files = extras + 1;
        assertTrue(files > 20);
        assertTrue(ROOT_TOKENS + FILE_TOKENS * (files + 1) < ManifestJSON.MAX_RETAINED_TOKENS);
        assertTrue(5 + 7 * (files + 1) < ManifestJSON.MAX_VALUES);
        assertEq(_verify(_result(extras)).length, 1);
        bytes memory over = _result(extras + 1);
        vm.expectRevert(Policy.Limit.selector);
        verifier.verify(over, keccak256(over), _declared(), _empty(), address(0xB), 1);
    }

    /// Retained tokens are a retained value or the key introducing one, so they never exceed
    /// twice the value budget: a shape whose values are the binding limit (two-key file
    /// objects, 5 retained tokens per 3 values) is refused by the value budget while its
    /// retained count and combined work are still below their limits.
    function test_valueBudgetRefusesBeforeRetainedTokenCap() public {
        bytes memory body =
            '{"jobId":"j","projectId":"p","state":"completed","files":[{"name":"main","path":"artifacts/main.md","hash":"';
        body = bytes.concat(
            body,
            bytes(Text.hex32(sha256("x"))),
            '","mediaType":"text/markdown","bytes":1,"submissionHash":"',
            bytes(Text.hex32(sha256("y"))),
            '"}'
        );
        // root 1 + 3 scalars + files 1 + declared object 1 + 6 members = 12 values,
        // 24 + 40 decoded key bytes, 6 + 15 prior-key comparisons, 9 + 13 retained tokens.
        uint256 values = 12;
        uint256 keyBytes = 64;
        uint256 comparisons = 21;
        uint256 tokens = 22;
        while (values + 3 <= ManifestJSON.MAX_VALUES) {
            body = bytes.concat(body, ',{"name":"q","path":"r"}');
            values += 3;
            keyBytes += 8;
            comparisons += 1;
            tokens += 5;
        }
        bytes memory raw = bytes.concat(body, "]}");
        bytes memory over = bytes.concat(body, ',{"name":"q","path":"r"}]}');
        assertTrue(values <= ManifestJSON.MAX_VALUES && values + 3 > ManifestJSON.MAX_VALUES);
        assertTrue(tokens + 5 < ManifestJSON.MAX_RETAINED_TOKENS);
        assertTrue(keyBytes + 8 <= ManifestJSON.MAX_TOTAL_KEY_BYTES);
        // The refused document is within the work budget, so only the value budget rejects it.
        assertTrue(
            over.length + 96 * (values + 3) + 8 * (keyBytes + 8) + 4 * (comparisons + 1)
                <= ManifestJSON.MAX_WORK
        );
        assertEq(_verify(raw).length, 1);
        vm.expectRevert(Policy.Limit.selector);
        verifier.verify(over, keccak256(over), _declared(), _empty(), address(0xB), 1);
    }
}
