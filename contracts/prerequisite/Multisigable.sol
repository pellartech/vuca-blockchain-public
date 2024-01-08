// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// ADOT + VUCA + LightLink + Pellar 2023

// verified
abstract contract Multisigable {
  address public multisig;

  function __Multisigable_init(address _multisig) internal {
    multisig = _multisig;
  }

  /** Modifier */
  // verified
  modifier onlyMultisig() {
    require(msg.sender == multisig, "Multisig required");
    _;
  }

  function modifyMultisig(address _multisig) public onlyMultisig {
    multisig = _multisig;
  }
}
