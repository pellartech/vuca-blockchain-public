// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CWTToken is Ownable, ERC20 {
  // 18 decimals
  uint256 public constant MAX_SUPPLY = 140000000000000000000000000;

  constructor() ERC20("CWT", "CWT") {
    _mint(msg.sender, MAX_SUPPLY);
  }
}