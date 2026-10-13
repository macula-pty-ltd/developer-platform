// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
contract ManagedToken is ERC20, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    constructor() ERC20("Managed Builder Token", "MBUILD") { _grantRole(DEFAULT_ADMIN_ROLE, msg.sender); _grantRole(MINTER_ROLE, msg.sender); _grantRole(PAUSER_ROLE, msg.sender); _mint(msg.sender, 1000 ether); }
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) { _mint(to, amount); }
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) { super._update(from, to, value); }
}
