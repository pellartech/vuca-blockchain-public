// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IBridgeRegistry, ValidatorSet } from "../common/IBridgeRegistry.sol";
import { Multisigable } from "../../prerequisite/Multisigable.sol";

contract L1BridgeRegistry is Initializable, UUPSUpgradeable, ReentrancyGuard, Multisigable, IBridgeRegistry {
  using ECDSA for bytes32;
  using ValidatorSet for ValidatorSet.Record;

  // variables
  address public systemVerifier;
  uint256 public consensusPowerThreshold;
  ValidatorSet.Record internal validators;

  function initialize(address _multisig) public initializer {
    __Multisigable_init(_multisig);
    __L1BridgeRegistry_init();
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

  function __L1BridgeRegistry_init() internal {
    address[] memory accounts = new address[](2);
    accounts[0] = 0x7c9E64883C8064BAe19f070Dc96C3D5F531B89A6;
    accounts[1] = 0x2681682d1197131D339a169dF10940470D602806;
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
