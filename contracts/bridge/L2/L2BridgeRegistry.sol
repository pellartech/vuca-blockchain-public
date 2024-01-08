// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IBridgeRegistry, ValidatorSet } from "../common/IBridgeRegistry.sol";
import "../../prerequisite/Multisigable.sol";

contract L2BridgeRegistry is Initializable, UUPSUpgradeable, Multisigable, ReentrancyGuardUpgradeable, IBridgeRegistry {
  using ECDSA for bytes32;
  using ValidatorSet for ValidatorSet.Record;

  // variables
  address public systemVerifier;
  uint256 public consensusPowerThreshold;
  ValidatorSet.Record internal validators;

  function initialize(address _multisig) public initializer {
    __Multisigable_init(_multisig);
    __L2BridgeRegistry_init();
  }

  /* Views */
  // verified
  function getValidators() public view returns (ValidatorSet.Validator[] memory) {
    return validators.values;
  }

  // verified
  function validValidator(address _validator) public view returns (bool) {
    return validators.contains(_validator);
  }

  // verified
  function getPower(address _validator) public view returns (uint256) {
    return validators.getPower(_validator);
  }

  function getMultisig() public view returns (address) {
    return multisig;
  }

  function getSystemVerifier() public view returns (address) {
    return systemVerifier;
  }

  /* Admin */
  // verified
  function modifyConsensusPowerThreshold(uint256 _amount) public onlyMultisig {
    consensusPowerThreshold = _amount;
  }

  // verified
  function modifyValidators(address[] memory _validators, uint256[] memory _powers) public onlyMultisig {
    for (uint256 i = 0; i < _validators.length; i++) {
      validators.modify(_validators[i], _powers[i]);
    }

    emit ValidatorsModifed(_validators, _powers);
  }

  // verified
  function removeValidators(address[] memory _accounts) public onlyMultisig {
    for (uint256 i = 0; i < _accounts.length; i++) {
      validators.remove(_accounts[i]);
    }

    emit ValidatorsRemoved(_accounts);
  }

  function modifySystemVerifier(address _systemVerifier) public onlyMultisig {
    systemVerifier = _systemVerifier;
    emit SystemVerifierModified(_systemVerifier);
  }

  function __L2BridgeRegistry_init() internal {
    address[] memory accounts = new address[](2);
    accounts[0] = 0x96FEec33fd9C1C08eD3630BA50a6C88b5f4D86b0;
    accounts[1] = 0x60cC5003c7813D1966aa8A3466acc75257F814BD;
    uint256[] memory powers = new uint256[](2);
    powers[0] = 35;
    powers[1] = 35;
    consensusPowerThreshold = 70;

    for (uint256 i = 0; i < accounts.length; i++) {
      validators.add(accounts[i], powers[i]);
    }

    emit ValidatorsModifed(accounts, powers);
    emit ConsensusPowerThresholdModified(consensusPowerThreshold);
  }

  function _authorizeUpgrade(address) internal override onlyMultisig {}
}
