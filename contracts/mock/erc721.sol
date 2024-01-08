// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract TokenERC721 is ERC721Enumerable {
  constructor() ERC721("TestToken", "TT") {}

  function mint(address _account, uint256 _amount) public {
    for (uint256 i = 0; i < _amount; i++) {
      _safeMint(_account, totalSupply());
    }
  }
}
