// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public transferCalls;
    uint8 public mode;
    bool public stickyAllowance;
    address public hook;
    bytes public hookData;
    bool public hookSucceeded;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function configure(uint8 mode_, bool sticky) external {
        mode = mode_;
        stickyAllowance = sticky;
    }

    function setHook(address to, bytes calldata data) external {
        hook = to;
        hookData = data;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        ++transferCalls;
        require(allowance[from][msg.sender] >= amount, "allowance");
        if (!stickyAllowance) allowance[from][msg.sender] -= amount;
        if (mode == 3) return false;
        _transfer(from, to, amount);
        if (hook != address(0)) {
            address target = hook;
            hook = address(0);
            (hookSucceeded,) = target.call(hookData);
        }
        if (mode == 4) {
            assembly ("memory-safe") {
                return(0, 0)
            }
        }
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        uint256 debit = amount + (mode == 2 ? 1 : 0);
        require(balanceOf[from] >= debit, "balance");
        balanceOf[from] -= debit;
        balanceOf[to] += amount - (mode == 1 ? 1 : 0);
    }
}
