// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelayTypes as T} from "../RelayTypes.sol";
import {Policy} from "./Policy.sol";
import {Text} from "./Text.sol";

library Assets {
    function validate(T.Asset[] memory assets) internal pure {
        if (assets.length > Policy.MAX_ASSETS) revert Policy.Limit();
        bytes32 last;
        bool[3] memory kinds;
        for (uint256 i; i < assets.length; ++i) {
            T.Asset memory a = assets[i];
            if (a.key <= last) revert Policy.Invalid();
            last = a.key;
            kinds[uint256(a.kind)] = true;
            descriptor(a);
            if (a.producer == address(0) || a.resultHash == 0 || a.revision == 0) revert Policy.Invalid();
            Text.identifier(a.jobId, 64);
        }
        uint256 missing;
        for (uint256 i; i < 3; ++i) {
            if (!kinds[i]) ++missing;
        }
        // Preserve space for one asset of each enabled type.
        if (assets.length + missing > Policy.MAX_ASSETS) revert Policy.Limit();
    }

    function descriptor(T.Asset memory a) internal pure {
        Text.identifier(a.name, 64);
        Text.path(a.path);
        if (!Text.equal(a.mediaType, Policy.mime(a.kind))) revert Policy.Invalid();
        if (a.fileHash == 0 || a.submissionHash == 0 || a.size == 0 || a.size > Policy.maxSize(a.kind)) {
            revert Policy.Invalid();
        }
        outputPath(a.kind, a.path);
    }

    function outputPath(T.Kind kind, string memory path) internal pure {
        Text.path(path);
        // The website profile requires the top-level dist directory to contain
        // exactly index.html. Other asset types must never occupy that directory.
        bytes memory b = bytes(path);
        if (
            kind != T.Kind.HTML && b.length >= 5 && b[0] == "d" && b[1] == "i" && b[2] == "s" && b[3] == "t"
                && b[4] == "/"
        ) revert Policy.Invalid();
        if (kind == T.Kind.Markdown && !Text.suffix(path, ".md")) revert Policy.Invalid();
        if (kind == T.Kind.HTML && !Text.equal(path, "dist/index.html")) revert Policy.Invalid();
        if (kind == T.Kind.Image && !Text.suffix(path, ".png")) revert Policy.Invalid();
    }

    /// @dev Two files conflict if identical, or either would have to be a
    /// directory for the other. Shared directories and mere text prefixes are safe.
    function pathsConflict(string memory first, string memory second) internal pure returns (bool) {
        bytes memory a = bytes(first);
        bytes memory b = bytes(second);
        uint256 common = a.length < b.length ? a.length : b.length;
        for (uint256 i; i < common; ++i) {
            if (a[i] != b[i]) return false;
        }
        if (a.length == b.length) return true;
        return a.length < b.length ? b[common] == "/" : a[common] == "/";
    }

    function hash(T.Asset[] memory assets) internal pure returns (bytes32) {
        validate(assets);
        return keccak256(abi.encode(assets));
    }

    /// @dev For comparison with an already authenticated checkpoint, not admission of new assets.
    /// A matching hash proves all fields equal the previously validated table. Bound the shape first.
    function witnessHash(T.Asset[] memory assets) internal pure returns (bytes32) {
        if (assets.length > Policy.MAX_ASSETS) revert Policy.Limit();
        for (uint256 i; i < assets.length; ++i) {
            T.Asset memory a = assets[i];
            if (
                bytes(a.name).length > 64 || bytes(a.path).length > 128 || bytes(a.mediaType).length > 32
                    || bytes(a.jobId).length > 64
            ) revert Policy.Limit();
        }
        return keccak256(abi.encode(assets));
    }

    function find(T.Asset[] memory assets, bytes32 key) internal pure returns (uint256) {
        for (uint256 i; i < assets.length; ++i) {
            if (assets[i].key == key) return i;
        }
        return type(uint256).max;
    }

    /// @dev Exactly one target is replaced or inserted. Every other struct is copied byte-for-byte.
    function replace(T.Asset[] memory old, T.Asset memory next) internal pure returns (T.Asset[] memory out) {
        uint256 existing = find(old, next.key);
        uint256 length = old.length + (existing == type(uint256).max ? 1 : 0);
        if (length > Policy.MAX_ASSETS) revert Policy.Limit();
        out = new T.Asset[](length);
        uint256 j;
        bool inserted;
        for (uint256 i; i < old.length; ++i) {
            if (!inserted && next.key <= old[i].key) {
                out[j++] = next;
                inserted = true;
            }
            if (old[i].key != next.key) out[j++] = old[i];
        }
        if (!inserted) out[j] = next;
        validate(out);
    }
}
