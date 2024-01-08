// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IL2Predicate {
  /* Events */
  function implTemplate() external view returns (address);

  function mapToken(address[] calldata _currentValidators, bytes[] calldata _signatures, bytes calldata _message) external;
}
