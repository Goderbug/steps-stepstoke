// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelayTypes as T} from "../RelayTypes.sol";

/// @notice All release policy is compiled in. No configuration authority exists.
library Policy {
    address internal constant INTAKE = 0xa43e6F75ee006411F79Ac1C84120606C2330DE82;
    address internal constant IMD = 0xD34a99Bc0f67aE1bbd63C660e6d0b0dd03E263B7;
    bytes32 internal constant OPEN = bytes32("job.open@job-1");
    bytes32 internal constant CONTINUE = bytes32("job.continue@job-1");
    bytes32 internal constant ID = keccak256("CTO-Relay-A1/2/fixed-profiles/unpublished");
    uint256 internal constant MAX_ASSETS = 16;
    uint256 internal constant MAX_INPUTS = 8;
    uint256 internal constant MAX_BODY = 16_384;
    // Metadata is validated without retaining it; bind measurements include the full asset witness.
    uint256 internal constant MAX_MANIFEST = 32_768;
    uint256 internal constant MAX_DOCUMENT = 65_536;
    uint256 internal constant MAX_HTML = 2_097_152;
    uint256 internal constant MAX_IMAGE = 262_144;
    uint256 internal constant MAX_IMAGES_TOTAL = 524_288;
    uint256 internal constant MAX_GOAL = 512;
    uint256 internal constant MAX_DIRECTION = 512;
    uint256 internal constant MAX_TEXT = 1024;

    error Invalid();
    error Limit();

    function kind(T.Profile p) internal pure returns (T.Kind) {
        if (p == T.Profile.MarkdownCreate || p == T.Profile.MarkdownUpdate) return T.Kind.Markdown;
        if (p == T.Profile.HTMLCreate || p == T.Profile.HTMLUpdate) return T.Kind.HTML;
        return T.Kind.Image;
    }

    function update(T.Profile p) internal pure returns (bool) {
        return p == T.Profile.MarkdownUpdate || p == T.Profile.HTMLUpdate;
    }

    function mime(T.Kind k) internal pure returns (string memory) {
        if (k == T.Kind.Markdown) return "text/markdown";
        if (k == T.Kind.HTML) return "text/html";
        return "image/png";
    }

    function maxSize(T.Kind k) internal pure returns (uint256) {
        if (k == T.Kind.Markdown) return MAX_DOCUMENT;
        if (k == T.Kind.HTML) return MAX_HTML;
        return MAX_IMAGE;
    }
}
