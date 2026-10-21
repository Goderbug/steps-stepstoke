// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RelayTypes as T} from "./RelayTypes.sol";
import {Policy} from "./libraries/Policy.sol";
import {Text} from "./libraries/Text.sol";
import {Assets} from "./libraries/Assets.sol";
import {StrictJSON as J} from "./libraries/StrictJSON.sol";
import {ManifestJSON} from "./libraries/ManifestJSON.sol";

/// @notice Verifies the exact result bytes, never a JSON reserialization or later Git state.
contract RelayVerifier {
    function policyId() external pure returns (bytes32) {
        return Policy.ID;
    }

    function verify(
        bytes memory raw,
        bytes32 recordedHash,
        T.Proposal memory proposal,
        T.Asset[] memory oldAssets,
        address branch,
        uint64 revision
    ) external pure returns (string memory job, string memory project, T.Asset[] memory next) {
        if (raw.length > Policy.MAX_MANIFEST || keccak256(raw) != recordedHash) revert Policy.Invalid();
        Assets.validate(oldAssets);
        J.Token[] memory t = ManifestJSON.parse(raw);
        if (!Text.equal(_string(t, 0, "state"), "completed")) revert Policy.Invalid();
        job = _string(t, 0, "jobId");
        project = _string(t, 0, "projectId");
        Text.identifier(job, 64);
        Text.identifier(project, 64);
        uint256 files = J.field(t, 0, "files");
        if (t[files].kind != J.Type.Array) revert Policy.Invalid();
        uint256 file = _declaredFile(t, files, proposal.outputName, proposal.outputPath);
        T.Asset memory a;
        a.key = proposal.target;
        a.kind = Policy.kind(proposal.profile);
        a.name = _string(t, file, "name");
        a.path = _string(t, file, "path");
        a.mediaType = _string(t, file, "mediaType");
        if (!Text.equal(a.name, proposal.outputName) || !Text.equal(a.path, proposal.outputPath)) {
            revert Policy.Invalid();
        }
        a.fileHash = Text.unhex32(_string(t, file, "hash"));
        a.submissionHash = Text.unhex32(_string(t, file, "submissionHash"));
        uint256 size = J.uintAt(t, J.field(t, file, "bytes"));
        if (size > Policy.maxSize(a.kind)) revert Policy.Limit();
        a.size = uint32(size);
        a.producer = branch;
        a.jobId = job;
        a.resultHash = recordedHash;
        a.revision = revision;
        Assets.descriptor(a);
        next = Assets.replace(oldAssets, a);
    }

    function _declaredFile(J.Token[] memory t, uint256 files, string memory name, string memory path)
        private
        pure
        returns (uint256 file)
    {
        // The plane lists every produced file. Admit only the proposal's unique output;
        // the complete original envelope (including ignored entries) remains hash-bound.
        for (uint256 i = files + 1; i < t[files].end; i = t[i].end) {
            if (t[i].kind != J.Type.Object) revert Policy.Invalid();
            bool named = Text.equal(_string(t, i, "name"), name);
            bool located = Text.equal(_string(t, i, "path"), path);
            if (named || located) {
                if (!named || !located || file != 0) revert Policy.Invalid();
                file = i;
            }
        }
        if (file == 0) revert Policy.Invalid();
    }

    function _string(J.Token[] memory t, uint256 object, string memory key)
        private
        pure
        returns (string memory)
    {
        return J.stringAt(t, J.field(t, object, key));
    }
}
