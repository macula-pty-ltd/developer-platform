// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
contract MerkleClaim {
    using SafeERC20 for IERC20;
    IERC20 public token;
    bytes32 public root;
    mapping(address => bool) public claimed;
    event Claimed(address indexed account, uint256 amount);
    constructor(address tokenAddress, bytes32 merkleRoot) { require(tokenAddress != address(0), "Zero token"); token = IERC20(tokenAddress); root = merkleRoot; }
    function claim(uint256 amount, bytes32[] calldata proof) external { require(!claimed[msg.sender], "Already claimed"); bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount)))); require(MerkleProof.verifyCalldata(proof, root, leaf), "Invalid proof"); claimed[msg.sender] = true; token.safeTransfer(msg.sender, amount); emit Claimed(msg.sender, amount); }
}
