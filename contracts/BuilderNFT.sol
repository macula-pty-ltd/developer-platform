// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts-v4/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts-v4/access/Ownable.sol";
contract BuilderNFT is ERC721URIStorage, Ownable {
    uint256 public nextId;
    constructor() ERC721("Builder NFT", "BNFT") {}
    function mint(address to, string memory uri) external onlyOwner returns (uint256 id) { id = nextId++; _safeMint(to, id); _setTokenURI(id, uri); }
}
