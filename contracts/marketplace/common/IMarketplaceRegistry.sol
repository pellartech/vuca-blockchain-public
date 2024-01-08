// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IMarketplaceRegistry {
  event MutisigModified(address _multisig);
  event SupportedPayableTokenModified(address _token, bool _supported);
  event SystemVerifierModified(address _systemVerifier);
  event ServiceModified(bytes32 _serviceId, address _serviceAddress);

  /* Views */
  function getMultisig() external view returns (address);

  function checkSupportedPayableToken(address _token) external view returns (bool);

  function getSystemVerifier() external view returns (address);

  function getService(bytes32 _serviceId) external view returns (address);

  /* Actions */
  function modifySystemVerifier(address _systemVerifier) external;

  function createService(bytes32 _serviceId, address _serviceAddress) external;

  function modifyService(bytes32 _serviceId, address _serviceAddress) external;

  function modifySupportedPayableToken(address _token, bool _supported) external;
}
