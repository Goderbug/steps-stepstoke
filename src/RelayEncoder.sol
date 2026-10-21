// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelayTypes as T} from "./RelayTypes.sol";
import {Policy} from "./libraries/Policy.sol";
import {Assets} from "./libraries/Assets.sol";
import {Text} from "./libraries/Text.sol";

/// @notice Fixed release profiles and deterministic request bytes. No raw-body entry point or setters.
contract RelayEncoder {
    function policyId() external pure returns (bytes32) {
        return Policy.ID;
    }

    function assetsHash(T.Asset[] memory assets) external pure returns (bytes32) {
        return Assets.hash(assets);
    }

    function witnessHash(T.Asset[] memory assets) external pure returns (bytes32) {
        return Assets.witnessHash(assets);
    }

    function validateText(string memory goal, string memory direction) external pure {
        Text.bounded(goal, Policy.MAX_GOAL);
        if (bytes(direction).length != 0) Text.bounded(direction, Policy.MAX_DIRECTION);
    }

    function encode(
        string memory goal,
        string memory direction,
        string memory ownLatestJob,
        T.Proposal memory p,
        T.Asset[] memory current
    ) external pure returns (bytes32 action, bytes memory body) {
        Text.bounded(goal, Policy.MAX_GOAL);
        if (bytes(direction).length != 0) Text.bounded(direction, Policy.MAX_DIRECTION);
        _validate(p, current);
        bool continuing = bytes(ownLatestJob).length != 0;
        if (continuing) Text.identifier(ownLatestJob, 64);
        action = continuing ? Policy.CONTINUE : Policy.OPEN;
        bytes memory objective = Text.quote(
            string.concat(
                "Public project goal: ",
                goal,
                "\nBranch direction: ",
                direction,
                "\nRequested change: ",
                p.text,
                "\n",
                _instructions(p.profile),
                "\nProduce exactly the declared named output. Do not delete or claim to have read unselected assets. No paid child jobs, autonomous spending, contract deployment or token launches."
            )
        );
        body = bytes.concat(
            continuing ? bytes.concat('{"parentJobId":', Text.quote(ownLatestJob), ",") : bytes("{"),
            '"objective":',
            objective,
            ',"shape":"chain","github":true,"ipfs":false,"steps":[{"skill":',
            Text.quote(_skill(p.profile)),
            ',"inputs":['
        );
        for (uint256 i; i < p.inputs.length; ++i) {
            T.Asset memory a = current[Assets.find(current, p.inputs[i])];
            body = bytes.concat(body, i == 0 ? bytes("") : bytes(","), _input(a, i));
        }
        body = bytes.concat(
            body,
            '],"outputs":[{"name":',
            Text.quote(p.outputName),
            ',"path":',
            Text.quote(p.outputPath),
            ',"mediaType":',
            Text.quote(Policy.mime(Policy.kind(p.profile))),
            "}]}]}"
        );
        if (body.length > Policy.MAX_BODY) revert Policy.Limit();
    }

    function _validate(T.Proposal memory p, T.Asset[] memory current) private pure {
        Assets.validate(current);
        if (p.publish || p.target == 0 || p.inputs.length > Policy.MAX_INPUTS) revert Policy.Invalid();
        Text.bounded(p.text, Policy.MAX_TEXT);
        Text.identifier(p.outputName, 64);
        _initialLetter(p.outputName);
        T.Kind kind = Policy.kind(p.profile);
        Assets.namedOutputPath(kind, p.outputPath);
        uint256 targetIndex = Assets.find(current, p.target);
        bool updating = Policy.update(p.profile);
        if (updating) {
            if (targetIndex == type(uint256).max || current[targetIndex].kind != kind) {
                revert Policy.Invalid();
            }
            // Current mappings are fixed; legacy non-artifacts paths migrate only on an explicit update.
            if (
                !Text.equal(current[targetIndex].name, p.outputName)
                    || !Text.equal(
                        Assets.nextOutputPath(kind, current[targetIndex].name, current[targetIndex].path),
                        p.outputPath
                    )
            ) revert Policy.Invalid();
        } else {
            if (targetIndex != type(uint256).max) revert Policy.Invalid();
            bool[3] memory kinds;
            kinds[uint256(kind)] = true;
            for (uint256 i; i < current.length; ++i) {
                kinds[uint256(current[i].kind)] = true;
            }
            uint256 missing;
            for (uint256 i; i < 3; ++i) {
                if (!kinds[i]) ++missing;
            }
            if (current.length + 1 + missing > Policy.MAX_ASSETS) revert Policy.Limit();
        }
        // Inputs retain immutable per-submission provenance, but a new write must not
        // reuse another accepted slot's public name or collide with its file path,
        // including file/directory ancestor conflicts.
        // Do not impose this on historical witness reads: only the proposed write.
        for (uint256 i; i < current.length; ++i) {
            if (
                current[i].key != p.target
                    && (Text.equal(current[i].name, p.outputName)
                        || (kind == T.Kind.HTML && current[i].kind == T.Kind.HTML)
                        || Assets.pathsConflict(current[i].path, p.outputPath))
            ) revert Policy.Invalid();
        }
        if (kind == T.Kind.Image && p.inputs.length != 0) revert Policy.Invalid();
        bool selectedTarget;
        bytes32 last;
        uint256 imageBytes;
        uint256 htmlBytes;
        uint256 embeddedBytes;
        for (uint256 i; i < p.inputs.length; ++i) {
            bytes32 key = p.inputs[i];
            if (key <= last) revert Policy.Invalid();
            last = key;
            uint256 index = Assets.find(current, key);
            if (index == type(uint256).max) revert Policy.Invalid();
            T.Asset memory a = current[index];
            _initialLetter(a.name);
            if (key == p.target) selectedTarget = true;
            if (kind == T.Kind.Markdown && a.kind != T.Kind.Markdown) revert Policy.Invalid();
            if (a.kind == T.Kind.Image) {
                if (a.size > Policy.MAX_IMAGE) revert Policy.Limit();
                imageBytes += a.size;
                embeddedBytes += 4 * ((uint256(a.size) + 2) / 3) + 32;
            }
            if (a.kind == T.Kind.HTML) htmlBytes += a.size;
        }
        if (updating && !selectedTarget) revert Policy.Invalid();
        if (imageBytes > Policy.MAX_IMAGES_TOTAL || htmlBytes + embeddedBytes > Policy.MAX_HTML) {
            revert Policy.Limit();
        }
    }

    function _input(T.Asset memory a, uint256 index) private pure returns (bytes memory) {
        return bytes.concat(
            '{"name":',
            Text.quote(a.name),
            ',"path":',
            Text.quote(a.path),
            ',"hash":"',
            bytes(Text.hex32(a.fileHash)),
            '","mediaType":',
            Text.quote(a.mediaType),
            ',"bytes":',
            bytes(Text.decimal(a.size)),
            ',"submissionHash":"',
            bytes(Text.hex32(a.submissionHash)),
            '","as":"asset-',
            bytes(Text.decimal(index)),
            '"}'
        );
    }

    function _initialLetter(string memory name) private pure {
        uint8 first = uint8(bytes(name)[0]); // descriptor/identifier validation already rejects empty names
        if (!((first >= 65 && first <= 90) || (first >= 97 && first <= 122))) revert Policy.Invalid();
    }

    function _skill(T.Profile p) private pure returns (string memory) {
        if (Policy.kind(p) == T.Kind.Markdown) return "research-report";
        if (Policy.kind(p) == T.Kind.HTML) return "build-website";
        return "create-image";
    }

    function _instructions(T.Profile p) private pure returns (string memory) {
        string memory restore = Policy.update(p)
            ? "Restore the selected target from .imd/reads/artifacts/<as>; that authenticated file is the update baseline, even if the workspace is newer. Preserve existing content except the requested changes. "
            : "Create a new asset without replacing another slot. ";
        T.Kind kind = Policy.kind(p);
        if (kind == T.Kind.Markdown) {
            return string.concat(
                restore,
                "Write a UTF-8 Markdown document, at most 65536 bytes. Read only the explicit inputs at .imd/reads/artifacts/<as>. No website or IPFS publishing."
            );
        }
        if (kind == T.Kind.HTML) {
            return string.concat(
                restore,
                "Write self-contained UTF-8 HTML with inline CSS and JavaScript. Store identical finished HTML in dist/index.html and the declared artifacts output. Keep dist limited to index.html with no symlinks. Embed selected images as Base64 data URIs without changing their bytes; no transcoding or remote resources. Each image at most 262144 bytes, images total at most 524288 bytes, final HTML including Base64 overhead at most 2097152 bytes. Retain old markers on updates. No website or IPFS publishing."
            );
        }
        return "Generate one PNG image from text, at most 262144 bytes. No reference images, editing, variations or remote fetches. No website or IPFS publishing. Return the actual PNG as the declared output.";
    }
}
