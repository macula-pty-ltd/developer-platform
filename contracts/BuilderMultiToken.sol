// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts-v4/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts-v4/access/Ownable.sol";
contract BuilderMultiToken is ERC1155, Ownable {
    constructor() ERC1155("ipfs://example/{id}.json") {}
    function mint(address to, uint256 id, uint256 amount) external onlyOwner { _mint(to, id, amount, ""); }
}
