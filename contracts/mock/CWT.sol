// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CWTT is ERC20 {
  constructor () ERC20("CWTT", "CWTT") {}

  function mint(address _to, uint256 _amount) external {
    _mint(_to, _amount);
  }
}