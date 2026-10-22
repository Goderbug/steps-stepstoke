// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SpecSetup, SpecData as D} from "./adversarial/SpecSupport.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {RelayBranch} from "../src/RelayBranch.sol";
import {RelayVerifier} from "../src/RelayVerifier.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {ManifestJSON} from "../src/libraries/ManifestJSON.sol";
import {StrictJSON as J} from "../src/libraries/StrictJSON.sol";

/// @dev Measures a complete bind from a contract with fresh memory, so the figure approximates
/// the execution gas of a real transaction instead of the test contract's memory expansion.
contract BindMeasurer {
    uint256 internal constant TRANSACTION_GAS_CAP = 16_777_216;

    function bind(RelayBranch root, bytes memory raw, T.Asset[] memory old)
        external
        returns (uint256 execution, uint256 total)
    {
        bytes memory data = abi.encodeCall(root.bind, (raw, old));
        uint256 tokens;
        uint256 intrinsic = 21_000;
        for (uint256 i; i < data.length; ++i) {
            bool zero = data[i] == 0;
            intrinsic += zero ? 4 : 16;
            tokens += zero ? 1 : 4;
        }
        uint256 before = gasleft();
        (bool ok,) = address(root).call(data);
        execution = before - gasleft();
        require(ok, "bind reverted");
        // EIP-7623 floor: the larger of regular pricing and 10 gas per calldata token.
        total = intrinsic + execution;
        if (21_000 + 10 * tokens > total) total = 21_000 + 10 * tokens;
    }
}

contract SegmentHarness {
    function field(bytes memory raw, string memory key) external pure returns (string memory) {
        J.Token[] memory t = ManifestJSON.parse(raw);
        return J.stringAt(t, J.field(t, 0, key));
    }

    function referenceField(bytes memory raw, string memory key) external pure returns (string memory) {
        J.Token[] memory t = J.parse(raw);
        return J.stringAt(t, J.field(t, 0, key));
    }
}

/// @dev Audit finding 28bdccb2: the retained-string parser bounded raw bytes, values and keys
/// but not segment flushes, and walked a plain-ASCII prefix twice. Both are now bounded and
/// measured as complete sixteen-asset bind transactions against the 16,777,216 ceiling.
contract ManifestSegmentBudgetTest is SpecSetup {
    uint256 internal constant TRANSACTION_GAS_CAP = 16_777_216;
    SegmentHarness private parser;

    function setUp() public override {
        super.setUp();
        parser = new SegmentHarness();
    }

    function _repeat(bytes memory scalar, uint256 n) private pure returns (bytes memory text) {
        text = new bytes(scalar.length * n);
        for (uint256 i; i < text.length; ++i) {
            text[i] = scalar[i % scalar.length];
        }
    }

    // --- Semantics: the ASCII prefix is copied once and decoded exactly as before. ---

    function test_asciiPrefixBeforeEscapeOrScalarDecodesExactly() public view {
        bytes[6] memory texts = [
            bytes("abc\\n"),
            bytes("abc\\u00e9"),
            bytes(unicode"abcé"),
            bytes("abc\\\"\\\\\\/x"),
            bytes(unicode"abc🚀\\n\\tz\\u0041"),
            bytes.concat(_repeat("a", 1022), hex"c3a9")
        ];
        for (uint256 i; i < texts.length; ++i) {
            bytes memory raw = bytes.concat('{"state":"', texts[i], '"}');
            assertEq(parser.field(raw, "state"), parser.referenceField(raw, "state"));
        }
        // Keys take the same path: an ASCII prefix before a Unicode escape decodes to a retained key.
        assertEq(parser.field('{"stat\\u0065":"ok"}', "state"), "ok");
    }

    function test_asciiPrefixKeysStillDetectDuplicates() public {
        bytes memory prefix = _repeat("k", 250);
        bytes memory distinct =
            bytes.concat('{"state":"ok","', prefix, '\\n":0,"', prefix, '\\t":0,"', prefix, 'n":0}');
        assertEq(parser.field(distinct, "state"), "ok");
        bytes memory duplicate = bytes.concat('{"state":"ok","', prefix, '\\n":0,"', prefix, '\\u000a":0}');
        vm.expectRevert(Policy.Invalid.selector);
        parser.field(duplicate, "state");
    }

    function test_asciiPrefixStillCountsTowardRetainedLimit() public {
        bytes memory accepted = bytes.concat('{"state":"', _repeat("a", 1022), hex"c3a9", '"}');
        assertEq(bytes(parser.field(accepted, "state")).length, 1024);
        bytes memory over = bytes.concat('{"state":"', _repeat("a", 1023), hex"c3a9", '"}');
        vm.expectRevert(Policy.Limit.selector);
        parser.field(over, "state");
        bytes memory overEscape = bytes.concat('{"state":"', _repeat("a", 1024), '\\n"}');
        vm.expectRevert(Policy.Limit.selector);
        parser.field(overEscape, "state");
        bytes memory unterminated = bytes.concat('{"state":"', _repeat("a", 40), hex"c3a9");
        vm.expectRevert(Policy.Invalid.selector);
        parser.field(unterminated, "state");
        bytes memory control = bytes.concat('{"state":"', _repeat("a", 40), hex"01", '"}');
        vm.expectRevert(Policy.Invalid.selector);
        parser.field(control, "state");
    }

    // --- Budget: a segment-ending simple escape costs eight work units, exactly. ---

    function _flushManifest(uint256 files, uint256 cycles)
        private
        pure
        returns (bytes memory raw, uint256 work)
    {
        // Root (state, files), `files` objects of name/path = ("a\n" x cycles): every escape
        // ends a one-byte raw segment, so every escape is one flush.
        bytes memory text = _repeat("a\\n", cycles);
        raw = '{"state":"completed","files":[';
        for (uint256 i; i < files; ++i) {
            raw = bytes.concat(
                raw, i == 0 ? bytes("") : bytes(","), '{"name":"', text, '","path":"', text, '"}'
            );
        }
        raw = bytes.concat(raw, "]}");
        uint256 values = 3 + 3 * files;
        uint256 keyBytes = 10 + 8 * files;
        uint256 comparisons = 1 + files;
        work = raw.length + 96 * values + 8 * keyBytes + 4 * comparisons + 8 * (2 * files * cycles);
    }

    /// @dev Closes `open` (a root object without its final brace, holding `members` keys that
    /// cost `values`/`keyBytes`/`comparisons`/`flushes`) with a numeric "pad" array and spaces so
    /// the document costs exactly MAX_WORK while staying far below the raw-byte limit.
    function _exact(
        bytes memory open,
        uint256 members,
        uint256 values,
        uint256 keyBytes,
        uint256 comparisons,
        uint256 flushes
    ) private pure returns (bytes memory raw) {
        uint256 fixed_ = open.length + 9 + 96 * (values + 1) + 8 * (keyBytes + 3) + 4
            * (comparisons + members) + ManifestJSON.SEGMENT_FLUSH_WORK * flushes;
        uint256 numbers = (ManifestJSON.MAX_WORK - fixed_) / 98;
        if (numbers + values + 1 > ManifestJSON.MAX_VALUES) numbers = ManifestJSON.MAX_VALUES - values - 1;
        assertTrue(numbers >= 1);
        raw = bytes.concat(open, ',"pad":[0');
        for (uint256 i = 1; i < numbers; ++i) {
            raw = bytes.concat(raw, ",0");
        }
        raw = bytes.concat(raw, "]}", D.repeat(" ", ManifestJSON.MAX_WORK - fixed_ - 98 * numbers));
        assertTrue(raw.length <= Policy.MAX_MANIFEST);
    }

    function test_segmentFlushBudgetAcceptsBoundaryRejectsOneMore() public {
        (bytes memory open, uint256 work) = _flushManifest(5, 512);
        assertTrue(work < ManifestJSON.MAX_WORK);
        // Without the flush charge this document would sit 40,960 units below the budget.
        bytes memory raw = _exact(_strip(open), 2, 3 + 15, 10 + 40, 1 + 5, 2 * 5 * 512);
        assertEq(parser.field(raw, "state"), "completed");
        bytes memory over = bytes.concat(raw, " ");
        vm.expectRevert(Policy.Limit.selector);
        parser.field(over, "state");
    }

    function test_consecutiveSimpleEscapesAreChargedOnlyOnce() public {
        // One flush per run: "\n\n\n..." x 1000 is 1 flush, not 1000.
        bytes memory raw = _exact(bytes.concat('{"state":"', _repeat("\\n", 1000), '"'), 1, 2, 5, 0, 1);
        assertEq(bytes(parser.field(raw, "state")).length, 1000);
        vm.expectRevert(Policy.Limit.selector);
        parser.field(bytes.concat(raw, " "), "state");
        // A run broken by one plain byte is two flushes.
        raw = _exact(
            bytes.concat('{"state":"', _repeat("\\n", 500), "a", _repeat("\\n", 500), '"'), 1, 2, 5, 0, 2
        );
        assertEq(bytes(parser.field(raw, "state")).length, 1001);
        vm.expectRevert(Policy.Limit.selector);
        parser.field(bytes.concat(raw, " "), "state");
    }

    function test_unicodeEscapesAndIgnoredStringsAreNotCharged() public {
        // \u escapes do not re-enter from a flushed simple escape; metadata strings are skipped.
        bytes memory raw = _exact(bytes.concat('{"state":"', _repeat("a\\u0041", 170), '"'), 1, 2, 5, 0, 0);
        assertEq(bytes(parser.field(raw, "state")).length, 340);
        vm.expectRevert(Policy.Limit.selector);
        parser.field(bytes.concat(raw, " "), "state");
        raw = _exact(bytes.concat('{"state":"ok","meta":"', _repeat("a\\n", 4000), '"'), 2, 3, 9, 1, 0);
        assertEq(parser.field(raw, "state"), "ok");
        vm.expectRevert(Policy.Limit.selector);
        parser.field(bytes.concat(raw, " "), "state");
        // A simple escape directly after a \u escape ends a (possibly empty) segment: one flush.
        raw = _exact(bytes.concat('{"state":"', _repeat("\\u0041\\n", 100), '"'), 1, 2, 5, 0, 100);
        assertEq(bytes(parser.field(raw, "state")).length, 200);
        vm.expectRevert(Policy.Limit.selector);
        parser.field(bytes.concat(raw, " "), "state");
    }

    function _strip(bytes memory closed) private pure returns (bytes memory open) {
        open = new bytes(closed.length - 1);
        for (uint256 i; i < open.length; ++i) {
            open[i] = closed[i];
        }
    }

    // --- Complete transactions with the full sixteen-asset witness. ---

    function _witness() private returns (T.Asset[] memory old) {
        old = empty();
        for (uint256 i = 1; i <= 16; ++i) {
            T.Profile profile =
                i <= 14 ? T.Profile.MarkdownCreate : i == 15 ? T.Profile.HTMLCreate : T.Profile.ImageCreate;
            T.Proposal memory p = proposal(root, profile, i);
            p.outputName = string(D.repeat(bytes1(uint8(65 + i)), 64));
            if (i <= 14) {
                p.outputPath = string(bytes.concat("artifacts/", D.repeat(bytes1(uint8(97 + i)), 115), ".md"));
            }
            if (i == 16) p.outputPath = string(bytes.concat("artifacts/", D.repeat("a", 114), ".png"));
            old = accept(
                root,
                p,
                old,
                string(D.repeat(bytes1(uint8(65 + i)), 64)),
                "metadata-project",
                D.document(),
                ALICE
            );
        }
    }

    /// @dev Greedy fill like the audit's proof: `maxFiles` extra files of the scalar repeated,
    /// shorter fills when a full one no longer fits, then spaces to exactly 32,768 bytes.
    function _manifest(T.Asset[] memory old, bytes memory scalar, uint256 repetitions, uint256 maxFiles)
        private
        view
        returns (T.Proposal memory update, bytes memory raw)
    {
        update = proposal(root, T.Profile.MarkdownUpdate, 1);
        update.outputName = old[0].name;
        update.outputPath = old[0].path;
        raw = D.manifest(update, "metadata-limits-job", "metadata-project", D.document());
        bytes memory extra;
        uint256 files;
        uint256 reps = repetitions;
        while (files < maxFiles && reps > 0) {
            bytes memory named = bytes.concat(_repeat(scalar, reps), bytes(D.decimal(files)));
            bytes memory entry = bytes.concat(
                files == 0 ? bytes("") : bytes(","), '{"name":"', named, '","path":"', named, '"}'
            );
            if (raw.length + extra.length + entry.length <= Policy.MAX_MANIFEST) {
                extra = bytes.concat(extra, entry);
                ++files;
            } else {
                reps = reps * 3 / 4;
            }
        }
        raw = replace(raw, '"files":[{', bytes.concat('"files":[', extra, ",{"));
        raw = bytes.concat(raw, D.repeat(" ", Policy.MAX_MANIFEST - raw.length));
        assertEq(raw.length, Policy.MAX_MANIFEST);
    }

    function _bindBelowCap(bytes memory scalar, uint256 repetitions, uint256 maxFiles, string memory label)
        private
    {
        T.Asset[] memory old = _witness();
        (T.Proposal memory update, bytes memory raw) = _manifest(old, scalar, repetitions, maxFiles);
        record(pay(root, root.propose(update, old), old, ALICE), raw);
        BindMeasurer m = new BindMeasurer();
        (uint256 execution, uint256 total) = m.bind(root, raw, old);
        emit Metric(string.concat(label, " bind execution gas"), execution);
        emit Metric(string.concat(label, " complete transaction gas estimate"), total);
        assertTrue(total < TRANSACTION_GAS_CAP);
        assertEq(uint256(root.phase()), uint256(T.Phase.Ready));
        assertEq(root.revision(), 17);
        assertEq(root.checkpoint(17).resultHash, keccak256(raw));
    }

    function test_auditAlternatingEscapeShapeIsRejectedByBudgetNotGas() public {
        // The audit's 32,768-byte "a\n"-alternating manifest: about 10,700 flushes, far over
        // the budget. The verifier rejects it deterministically instead of running out of gas.
        T.Asset[] memory old = _witness();
        (T.Proposal memory update, bytes memory raw) = _manifest(old, "a\\n", 500, 40);
        RelayVerifier verifier = root.verifier();
        vm.expectRevert(Policy.Limit.selector);
        verifier.verify(raw, keccak256(raw), update, old, address(root), 17);
        (update, raw) = _manifest(old, 'a\\"', 500, 40);
        vm.expectRevert(Policy.Limit.selector);
        verifier.verify(raw, keccak256(raw), update, old, address(root), 17);
    }

    function test_bindMaximumBudgetedSegmentFlushesWithFullWitness() public {
        // 3 extra files x 2 strings x 500 flushes = 3,000 flushes (24,000 units) plus the
        // remaining bytes as two-byte scalars: the heaviest shape the budget still admits.
        T.Asset[] memory old = _witness();
        T.Proposal memory update = proposal(root, T.Profile.MarkdownUpdate, 1);
        update.outputName = old[0].name;
        update.outputPath = old[0].path;
        bytes memory raw = D.manifest(update, "metadata-limits-job", "metadata-project", D.document());
        bytes memory flushText = _repeat("a\\n", 500);
        bytes memory extra;
        for (uint256 i; i < 3; ++i) {
            bytes memory named = bytes.concat(flushText, bytes(D.decimal(i)));
            extra = bytes.concat(
                extra, i == 0 ? bytes("") : bytes(","), '{"name":"', named, '","path":"', named, '"}'
            );
        }
        bytes memory scalarText = _repeat(hex"c3a9", 500);
        for (uint256 i = 3; i < 14; ++i) {
            bytes memory named = bytes.concat(scalarText, bytes(D.decimal(i)));
            bytes memory entry = bytes.concat(',{"name":"', named, '","path":"', named, '"}');
            if (raw.length + extra.length + entry.length > Policy.MAX_MANIFEST) break;
            extra = bytes.concat(extra, entry);
        }
        raw = replace(raw, '"files":[{', bytes.concat('"files":[', extra, ",{"));
        raw = bytes.concat(raw, D.repeat(" ", Policy.MAX_MANIFEST - raw.length));
        record(pay(root, root.propose(update, old), old, ALICE), raw);
        BindMeasurer m = new BindMeasurer();
        (uint256 execution, uint256 total) = m.bind(root, raw, old);
        emit Metric("budgeted flush and scalar mix bind execution gas", execution);
        emit Metric("budgeted flush and scalar mix complete transaction gas estimate", total);
        assertTrue(total < TRANSACTION_GAS_CAP);
        assertEq(root.revision(), 17);
    }

    function test_bindAsciiPrefixThenRawScalarWithFullWitness() public {
        // Previously walked twice: 999 ASCII bytes then one raw two-byte scalar per string.
        _bindBelowCap(bytes.concat(_repeat("a", 999), hex"c3a9"), 1, 15, "ascii prefix then raw scalar");
    }

    function test_bindAsciiPrefixThenSimpleEscapeWithFullWitness() public {
        _bindBelowCap(bytes.concat(_repeat("a", 999), "\\n"), 1, 15, "ascii prefix then simple escape");
    }

    function test_bindAsciiPrefixThenUnicodeEscapeWithFullWitness() public {
        _bindBelowCap(bytes.concat(_repeat("a", 995), "\\u00e9"), 1, 15, "ascii prefix then unicode escape");
    }

    function test_bindOriginalCGas01ShapeWithFullWitnessBelowCap() public {
        _bindBelowCap(hex"c3a9", 500, 15, "C-GAS-01 two-byte scalar shape");
    }

    function test_bindBudgetedAlternatingEscapesWithFullWitness() public {
        // Five files of "a\n" x 500 (5,000 flushes, 40,000 units) within the budget.
        T.Asset[] memory old = _witness();
        T.Proposal memory update = proposal(root, T.Profile.MarkdownUpdate, 1);
        update.outputName = old[0].name;
        update.outputPath = old[0].path;
        bytes memory raw = D.manifest(update, "metadata-limits-job", "metadata-project", D.document());
        bytes memory text = _repeat("a\\n", 500);
        bytes memory extra;
        for (uint256 i; i < 5; ++i) {
            bytes memory named = bytes.concat(text, bytes(D.decimal(i)));
            extra = bytes.concat(
                extra, i == 0 ? bytes("") : bytes(","), '{"name":"', named, '","path":"', named, '"}'
            );
        }
        raw = replace(raw, '"files":[{', bytes.concat('"files":[', extra, ",{"));
        record(pay(root, root.propose(update, old), old, ALICE), raw);
        BindMeasurer m = new BindMeasurer();
        (uint256 execution, uint256 total) = m.bind(root, raw, old);
        emit Metric("five alternating-escape files bind execution gas", execution);
        emit Metric("five alternating-escape files complete transaction gas estimate", total);
        assertTrue(total < TRANSACTION_GAS_CAP);
        assertEq(root.revision(), 17);
    }
}
