// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// import proxy instance
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// ADOT + VUCA + LightLink + Pellar 2023

// proxy instance
contract NormalProxy is ERC1967Proxy {
  constructor(address _logic, bytes memory _data) ERC1967Proxy(_logic, _data) {}
}
