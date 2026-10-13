// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract Counter {
    uint256 public number;
    event NumberChanged(address indexed caller, uint256 number);
    function setNumber(uint256 value) external { number = value; emit NumberChanged(msg.sender, value); }
    function increment() external { number += 1; emit NumberChanged(msg.sender, number); }
}
