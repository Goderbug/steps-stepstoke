// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IIntake} from "../../src/interfaces/IIntake.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockIntake is IIntake {
    using SafeERC20 for IERC20;

    struct Request {
        address payer;
        Callback callback;
        bytes4 failure;
        bytes32 action;
        bytes body;
        bool completed;
    }

    address public writer;
    address public treasury;
    address public asset;
    mapping(bytes32 => uint256) public prices;
    mapping(bytes32 => Request) private requests;
    uint256 public count;
    bool public partialPull;
    bool public synchronous;
    bool public synchronousDelivered;

    event Requested(
        bytes32 indexed id, address indexed payer, bytes32 indexed action, bytes body, uint256 amount
    );
    event Completed(bytes32 indexed id, bool delivered);

    function initialize(address writer_, address treasury_, address asset_) external {
        require(writer == address(0));
        writer = writer_;
        treasury = treasury_;
        asset = asset_;
    }

    function setPrice(bytes32 action, uint256 amount) external {
        prices[action] = amount;
    }

    function configure(bool partial_, bool sync) external {
        partialPull = partial_;
        synchronous = sync;
    }

    function priceOf(bytes32 action, address asset_) external view returns (uint256) {
        return asset == asset_ ? prices[action] : 0;
    }

    function requestWithFailure(
        bytes32 action,
        bytes calldata body,
        Callback calldata callback,
        bytes4 onFailure,
        address asset_,
        uint256 amount
    ) external payable returns (bytes32 id) {
        require(msg.value == 0 && asset == asset_ && prices[action] != 0, "not sold");
        require(body.length != 0 && body.length <= 16_384 && amount >= prices[action], "invalid");
        IERC20(asset).safeTransferFrom(msg.sender, treasury, partialPull ? amount / 2 : amount);
        id = keccak256(abi.encode(address(this), ++count, msg.sender));
        requests[id] = Request(msg.sender, callback, onFailure, action, body, false);
        if (synchronous) {
            (synchronousDelivered,) = callback.target.call{gas: 200_000}(
                abi.encodeWithSelector(callback.selector, id, bytes32(0), "")
            );
        }
        emit Requested(id, msg.sender, action, body, amount);
    }

    function request(bytes32 id) external view returns (Request memory) {
        return requests[id];
    }

    function complete(bytes32 id, bytes calldata raw) external returns (bool delivered) {
        require(msg.sender == writer, "writer");
        Request storage r = requests[id];
        require(r.payer != address(0) && !r.completed, "not pending");
        r.completed = true;
        (delivered,) = r.callback.target.call{gas: 200_000}(
            abi.encodeWithSelector(r.callback.selector, id, keccak256(raw), "ipfs://fixture/result.json")
        );
        emit Completed(id, delivered);
    }

    function fail(bytes32 id, uint8 status, bytes32 reason) external returns (bool delivered) {
        require(msg.sender == writer, "writer");
        Request storage r = requests[id];
        require(r.payer != address(0) && !r.completed, "not pending");
        r.completed = true;
        (delivered,) = r.callback.target.call{gas: 200_000}(
            abi.encodeWithSelector(r.failure, id, status, reason, uint16(0), uint16(0), bytes(""))
        );
        emit Completed(id, delivered);
    }
}
