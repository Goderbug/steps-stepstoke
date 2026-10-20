// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @dev Deliberately limited cheatcode surface: no FFI, filesystem, environment, RPC or keys.
interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function etch(address, bytes calldata) external;
    function expectRevert() external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
    function warp(uint256) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event Metric(string name, uint256 value);

    function assertTrue(bool value) internal pure {
        require(value, "assertTrue");
    }

    function assertFalse(bool value) internal pure {
        require(!value, "assertFalse");
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "assert uint equality");
    }

    function assertEq(bytes32 a, bytes32 b) internal pure {
        require(a == b, "assert bytes32 equality");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "assert address equality");
    }

    function assertEq(string memory a, string memory b) internal pure {
        require(keccak256(bytes(a)) == keccak256(bytes(b)), "assert string equality");
    }

    function assertEq(bytes memory a, bytes memory b) internal pure {
        require(keccak256(a) == keccak256(b), "assert bytes equality");
    }

    function contains(bytes memory haystack, bytes memory needle) internal pure returns (bool) {
        if (needle.length > haystack.length) return false;
        for (uint256 i; i <= haystack.length - needle.length; ++i) {
            bool match_ = true;
            for (uint256 j; j < needle.length; ++j) {
                if (haystack[i + j] != needle[j]) {
                    match_ = false;
                    break;
                }
            }
            if (match_) return true;
        }
        return false;
    }

    function replace(bytes memory data, bytes memory needle, bytes memory value)
        internal
        pure
        returns (bytes memory)
    {
        require(needle.length <= data.length);
        for (uint256 i; i <= data.length - needle.length; ++i) {
            bool match_ = true;
            for (uint256 j; j < needle.length; ++j) {
                if (data[i + j] != needle[j]) match_ = false;
            }
            if (match_) {
                bytes memory out = new bytes(data.length - needle.length + value.length);
                uint256 n;
                for (uint256 j; j < i; ++j) {
                    out[n++] = data[j];
                }
                for (uint256 j; j < value.length; ++j) {
                    out[n++] = value[j];
                }
                for (uint256 j = i + needle.length; j < data.length; ++j) {
                    out[n++] = data[j];
                }
                return out;
            }
        }
        revert("fixture replacement missing");
    }
}
