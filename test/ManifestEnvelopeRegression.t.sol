// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {SpecSetup, SpecData as D} from "./adversarial/SpecSupport.sol";
import {RelayTypes as T} from "../src/RelayTypes.sol";
import {Policy} from "../src/libraries/Policy.sol";
import {RelayVerifier} from "../src/RelayVerifier.sol";
import {LiveResultFixture} from "./fixtures/LiveResultFixture.sol";

/// @dev Real Branch.bind regressions for writer-added metadata, not parser-only acceptance.
contract ManifestEnvelopeRegressionTest is SpecSetup {
    function test_exactPreviouslyObservedIMDResultBindsWithoutReserialization() public {
        T.Proposal memory p = proposal(root, T.Profile.MarkdownCreate, 1);
        p.outputName = "chronicle";
        p.outputPath = "artifacts/chronicle.md";
        bytes memory raw = LiveResultFixture.raw();
        _bind(p, raw);
        assertEq(root.latestJobId(), "0f80bcae-05b9-4218-882a-6329025a489a");
    }

    function _raw() private view returns (T.Proposal memory p, bytes memory raw) {
        p = proposal(root, T.Profile.MarkdownCreate, 1);
        raw = D.manifest(p, "metadata-job", "metadata-project", D.document());
    }

    function _bind(T.Proposal memory p, bytes memory raw) private {
        record(pay(root, root.propose(p, empty()), empty(), ALICE), raw);
        uint256 beforeGas = gasleft();
        root.bind(raw, empty());
        uint256 used = beforeGas - gasleft();
        assertEq(uint256(root.phase()), uint256(T.Phase.Ready));
        assertEq(root.revision(), 1);
        assertEq(root.checkpoint(1).resultHash, keccak256(raw));
        assertEq(intake.count(), 1);
        assertAccounting(FEE, 0);
        emit Metric("metadata manifest raw bytes", raw.length);
        emit Metric("metadata full bind gas", used);
        assertTrue(used < 14_000_000);
    }

    function test_bindMetadataBeyond8192BytesWithoutAnotherPurchase() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        raw = replace(
            raw, '"source":[]', bytes.concat('"metadata":"', D.repeat("a", 9000), "\",\"source\":[]")
        );
        assertTrue(raw.length > 8192);
        _bind(p, raw);
    }

    function test_bind33StructuredSourceEntriesWithoutAnotherPurchase() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        bytes memory source = '"source":[';
        for (uint256 i; i < 33; ++i) {
            source = bytes.concat(
                source,
                i == 0 ? bytes("") : bytes(","),
                '{"path":"docs/source.md","hash":"untrusted-input-metadata","url":"https://example.invalid/source"}'
            );
        }
        raw = replace(raw, '"source":[]', bytes.concat(source, "]"));
        _bind(p, raw);
    }

    function test_bind33ActualSourceDescriptorsWithoutAnotherPurchase() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        bytes memory source = '"source":[';
        bytes memory entry = LiveResultFixture.sourceEntry();
        for (uint256 i; i < 33; ++i) {
            source = bytes.concat(source, i == 0 ? bytes("") : bytes(","), entry);
        }
        raw = replace(raw, '"source":[]', bytes.concat(source, "]"));
        _bind(p, raw);
    }

    function test_bindLongMetadataOnTheAcceptedFileWithoutAnotherPurchase() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        raw = replace(
            raw, '"name":"notes"', bytes.concat('"name":"notes","description":"', D.repeat("a", 2048), '"')
        );
        _bind(p, raw);
    }

    function test_invalidIgnoredMetadataCannotHideBehindProjection() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        RelayVerifier verifier = root.verifier();
        bytes[8] memory bad = [
            bytes('{"x":0,"\\u0078":1}'),
            bytes('{"nested":{"x":0,"x":1}}'),
            bytes('["\\ud800"]'),
            bytes('["\\uffff"]'),
            bytes("[1,]"),
            bytes("[01]"),
            bytes("[truee]"),
            bytes.concat('["', hex"c080", '"]')
        ];
        for (uint256 i; i < bad.length; ++i) {
            bytes memory invalid = replace(raw, '"source":[]', bytes.concat('"source":', bad[i]));
            vm.expectRevert();
            verifier.verify(invalid, keccak256(invalid), p, empty(), address(root), 1);
        }
    }

    function test_wrongHashStillRejectsProjectedManifest() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        RelayVerifier verifier = root.verifier();
        bytes memory enriched = replace(
            raw, '"source":[]', bytes.concat('"metadata":"', D.repeat("a", 2048), "\",\"source\":[]")
        );
        vm.expectRevert(Policy.Invalid.selector);
        verifier.verify(enriched, keccak256(raw), p, empty(), address(root), 1);
    }

    function test_bindMaximumMetadataComplexityWithFullWitness() public {
        _maximumMetadata(0);
    }

    function test_bindMaximumMetadataValuesAndUnicodeWithFullWitness() public {
        _maximumMetadata(1);
    }

    function test_bindMaximumEscapedKeyBytesWithFullWitness() public {
        _maximumMetadata(2);
    }

    function test_bindMaximumIgnoredNumberWithFullWitness() public {
        _maximumMetadata(3);
    }

    function test_bindMaximumWhitespaceWithFullWitness() public {
        _maximumMetadata(4);
    }

    function _escapedKey(bytes1 lastDigit, uint256 length) private pure returns (bytes memory out) {
        out = new bytes(length * 6);
        for (uint256 i; i < out.length; ++i) {
            out[i] = i % 6 == 5 ? lastDigit : bytes("\\u0040")[i % 6];
        }
    }

    function test_manifestValueBudgetAccepts512Rejects513() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        bytes memory source = '"source":[';
        // The surrounding valid manifest has 13 values, including its root and source array.
        for (uint256 i; i < 499; ++i) {
            source = bytes.concat(source, i == 0 ? bytes("0") : bytes(",0"));
        }
        RelayVerifier verifier = root.verifier();
        bytes memory exact = replace(raw, '"source":[]', bytes.concat(source, "]"));
        verifier.verify(exact, keccak256(exact), p, empty(), address(root), 1);
        bytes memory above = replace(raw, '"source":[]', bytes.concat(source, ",0]"));
        vm.expectRevert(Policy.Limit.selector);
        verifier.verify(above, keccak256(above), p, empty(), address(root), 1);
    }

    function test_manifestAggregateKeyBudgetAccepts2048Rejects2049() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        // The result's ordinary keys total 70 decoded bytes; "extra" contributes another five.
        bytes memory extra = '"source":[],"extra":{';
        for (uint256 i; i < 7; ++i) {
            extra = bytes.concat(
                extra, i == 0 ? bytes("") : bytes(","), '"', D.repeat(bytes1(uint8(65 + i)), 256), '":0'
            );
        }
        RelayVerifier verifier = root.verifier();
        bytes memory exact =
            replace(raw, '"source":[]', bytes.concat(extra, ',"', D.repeat("z", 181), '":0}'));
        verifier.verify(exact, keccak256(exact), p, empty(), address(root), 1);
        bytes memory above =
            replace(raw, '"source":[]', bytes.concat(extra, ',"', D.repeat("z", 182), '":0}'));
        vm.expectRevert(Policy.Limit.selector);
        verifier.verify(above, keccak256(above), p, empty(), address(root), 1);
    }

    function test_longIgnoredStringStillRejectsLateInvalidUtf8AndDuplicateKeys() public {
        (T.Proposal memory p, bytes memory raw) = _raw();
        RelayVerifier verifier = root.verifier();
        bytes memory longText = D.repeat("a", 9000);
        bytes[4] memory invalid = [
            bytes.concat('"source":["', longText, hex"eda080", '"]'),
            bytes.concat('"source":["', longText, '\\ud800"]'),
            bytes.concat('"source":["', longText, '\\uDBFF\\uDFFF"]'),
            bytes.concat('"source":["', longText, '"],"unknown":{"x":0,"\\u0078":1}')
        ];
        for (uint256 i; i < invalid.length; ++i) {
            bytes memory bad = replace(raw, '"source":[]', invalid[i]);
            vm.expectRevert(Policy.Invalid.selector);
            verifier.verify(bad, keccak256(bad), p, empty(), address(root), 1);
        }
    }

    function _maximumMetadata(uint256 shape) private {
        T.Asset[] memory old = empty();
        for (uint256 i = 1; i <= 16; ++i) {
            T.Profile profile =
                i <= 14 ? T.Profile.MarkdownCreate : i == 15 ? T.Profile.HTMLCreate : T.Profile.ImageCreate;
            T.Proposal memory p = proposal(root, profile, i);
            p.outputName = string(D.repeat(bytes1(uint8(65 + i)), 64));
            if (i <= 14) p.outputPath = string(bytes.concat(D.repeat(bytes1(uint8(97 + i)), 125), ".md"));
            if (i == 16) p.outputPath = string(bytes.concat(D.repeat("a", 124), ".png"));
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
        T.Proposal memory update = proposal(root, T.Profile.MarkdownUpdate, 1);
        update.outputName = old[0].name;
        update.outputPath = old[0].path;
        bytes memory raw = D.manifest(update, "metadata-limits-job", "metadata-project", D.document());
        bytes memory extra = '"source":[';
        if (shape == 0) {
            for (uint256 i; i < 1; ++i) {
                extra = bytes.concat(extra, i == 0 ? bytes("{") : bytes(",{"));
                for (uint256 j; j < 110; ++j) {
                    extra = bytes.concat(
                        extra, j == 0 ? bytes("") : bytes(","), '"k', bytes(D.decimal(j)), '":0'
                    );
                }
                extra = bytes.concat(extra, "}");
            }
        } else if (shape == 1) {
            for (uint256 i; i < 498; ++i) {
                extra = bytes.concat(extra, i == 0 ? bytes("0") : bytes(",0"));
            }
        }
        uint256 targetBytes = shape == 0 ? 26180 : shape == 1 ? 15648 : Policy.MAX_MANIFEST;
        if (shape == 2) {
            extra = '"source":{';
            for (uint256 i; i < 8; ++i) {
                extra = bytes.concat(
                    extra,
                    i == 0 ? bytes("") : bytes(","),
                    '"',
                    _escapedKey(bytes1(uint8(49 + i)), i < 7 ? 256 : 179),
                    '":0'
                );
            }
            raw = replace(raw, '"source":[]', bytes.concat(extra, '},"padding":""'));
        } else if (shape < 2) {
            raw = replace(raw, '"source":[]', bytes.concat(extra, '],"padding":""'));
        }
        if (shape < 3) {
            uint256 available = targetBytes - raw.length;
            bytes memory padding = new bytes(available);
            for (uint256 i; i < available; ++i) {
                padding[i] =
                    shape == 1 && i < available - available % 6 ? bytes("\\u00e9")[i % 6] : bytes1("a");
            }
            raw = replace(raw, '"padding":""', bytes.concat('"padding":"', padding, '"'));
        } else if (shape == 3) {
            raw = replace(
                raw, '"source":[]', bytes.concat('"source":', D.repeat("1", targetBytes - raw.length + 2))
            );
        } else {
            raw = bytes.concat(raw, D.repeat(" ", targetBytes - raw.length));
        }
        assertEq(raw.length, targetBytes);
        if (shape < 2) {
            RelayVerifier verifier = root.verifier();
            bytes memory overWork = bytes.concat(raw, " ");
            vm.expectRevert(Policy.Limit.selector);
            verifier.verify(overWork, keccak256(overWork), update, old, address(root), 17);
        }
        record(pay(root, root.propose(update, old), old, ALICE), raw);
        uint256 beforeGas = gasleft();
        root.bind(raw, old);
        uint256 used = beforeGas - gasleft();
        emit Metric(
            shape == 0
                ? "maximum metadata key complexity bind gas"
                : shape == 1
                    ? "maximum metadata value complexity bind gas"
                    : shape == 2
                        ? "maximum escaped key bytes bind gas"
                        : shape == 3 ? "maximum ignored number bind gas" : "maximum whitespace bind gas",
            used
        );
        assertTrue(used < 14_000_000);
        assertEq(uint256(root.phase()), uint256(T.Phase.Ready));
        assertEq(root.revision(), 17);
    }
}
