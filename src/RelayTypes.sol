// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

library RelayTypes {
    enum Kind {
        Markdown,
        HTML,
        Image
    }

    enum Profile {
        MarkdownCreate,
        MarkdownUpdate,
        HTMLCreate,
        HTMLUpdate,
        ImageCreate
    }

    enum Phase {
        Ready,
        Purchasing,
        Pending,
        ResultRecorded,
        Refused,
        Frozen
    }

    struct Asset {
        bytes32 key;
        Kind kind;
        string name;
        string path;
        bytes32 fileHash; // SHA-256 of the file bytes, never the result keccak256.
        string mediaType;
        uint32 size;
        bytes32 submissionHash;
        address producer;
        string jobId;
        bytes32 resultHash;
        uint64 revision;
    }

    struct Proposal {
        bytes32 anchor;
        Profile profile;
        bytes32 target;
        bytes32[] inputs; // Strictly ascending asset keys; aliases are derived from this order.
        string outputName;
        string outputPath;
        string text;
        bool publish;
    }

    struct Source {
        address parent;
        uint64 revision;
        bytes32 checkpoint;
    }

    struct Checkpoint {
        bytes32 digest;
        bytes32 assetsHash;
        bytes32 resultHash;
        bytes32 jobHash;
        bytes32 projectHash;
    }

    struct Attempt {
        uint256 proposalId;
        address sponsor;
        uint256 fee;
        bytes32 requestId;
        bytes32 bodyHash;
        bytes32 outcome;
        uint8 status; // 0 pending/result; nonzero is an Intake failure status.
        bool delivered;
    }
}
