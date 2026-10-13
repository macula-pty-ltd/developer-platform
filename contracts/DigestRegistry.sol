// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract DigestRegistry {
    mapping(bytes32 => address) public registeredBy;
    event Registered(bytes32 indexed digest, address indexed account);
    function register(bytes32 digest) external { require(digest != bytes32(0), "Empty digest"); require(registeredBy[digest] == address(0), "Already registered"); registeredBy[digest] = msg.sender; emit Registered(digest, msg.sender); }
}
