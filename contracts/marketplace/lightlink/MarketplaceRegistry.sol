// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IMarketplaceRegistry } from "../common/IMarketplaceRegistry.sol";
import "../../prerequisite/Multisigable.sol";

contract MarketplaceRegistry is Initializable, UUPSUpgradeable, Multisigable, ReentrancyGuardUpgradeable, IMarketplaceRegistry {
  using ECDSA for bytes32;

  // variables
  address public systemVerifier;
  mapping(bytes32 => address[]) public services;
  mapping(address => bool) public supportedPayableTokens;

  function __MarketplaceRegistry_init() internal {}

  function initialize(address _multisig) public initializer {
    __Multisigable_init(_multisig);
    __MarketplaceRegistry_init();
  }

  function _authorizeUpgrade(address) internal override onlyMultisig {}

  /* Views */
  // verified
  function getMultisig() public view returns (address) {
    return multisig;
  }

  // verified
  function checkSupportedPayableToken(address _token) external view returns (bool) {
    return supportedPayableTokens[_token];
  }

  // verified
  function getSystemVerifier() public view returns (address) {
    return systemVerifier;
  }

  // verified
  function getService(bytes32 _serviceId) external view returns (address) {
    if (services[_serviceId].length == 0) {
      return address(0);
    }
    return services[_serviceId][services[_serviceId].length - 1];
  }


  /* Admin */
  // verified
  function modifySystemVerifier(address _systemVerifier) public onlyMultisig {
    systemVerifier = _systemVerifier;
    emit SystemVerifierModified(_systemVerifier);
  }

  // verified
  function createService(bytes32 _serviceId, address _serviceAddress) external onlyMultisig {
    require(_serviceAddress != address(0), "Service address is required");
    require(services[_serviceId].length == 0, "Service already exists");
    services[_serviceId].push(_serviceAddress);
    emit ServiceModified(_serviceId, _serviceAddress);
  }

  // verified
  function modifyService(bytes32 _serviceId, address _serviceAddress) external onlyMultisig {
    require(_serviceAddress != address(0), "Service address is required");
    require(services[_serviceId].length > 0, "Service not exists");
    services[_serviceId].push(_serviceAddress);
    emit ServiceModified(_serviceId, _serviceAddress);
  }

  // verified
  function modifySupportedPayableToken(address _token, bool _supported) external onlyMultisig {
    supportedPayableTokens[_token] = _supported;
    emit SupportedPayableTokenModified(_token, _supported);
  }
}
