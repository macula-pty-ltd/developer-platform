// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
contract UpgradeableCounter is OwnableUpgradeable, UUPSUpgradeable {
    uint256 public number;
    constructor() { _disableInitializers(); }
    function initialize(address initialOwner) external initializer { __Ownable_init(initialOwner); }
    function increment() external { number++; }
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
contract BuilderProxy is ERC1967Proxy { constructor(address implementation, bytes memory initialization) ERC1967Proxy(implementation, initialization) {} }
