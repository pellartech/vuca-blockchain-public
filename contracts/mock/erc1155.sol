// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";

contract TokenERC1155 is ERC1155Supply {
  constructor() ERC1155("") {}

  function mint(address account, uint256 id, uint256 amount) public {
    _mint(account, id, amount, "");
  }
}
