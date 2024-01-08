// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../prerequisite/Multisigable.sol";
import "../interfaces/IAdotRegistry.sol";

// ADOT + VUCA + LightLink + Pellar 2023

contract AdotRegistry is
  Initializable, //
  UUPSUpgradeable,
  Multisigable,
  IAdotRegistry
{
  uint96 public platformFee;
  address public platformFeeReceiver;
  address public verifier;
  string public rootURI;

  function __AdotRegistry_init() internal {
    platformFee = 1000; // 10%
    platformFeeReceiver = 0x863Cd0a821544E4346F7747E78D6151f36a31CDF;
    verifier = 0xcA0960220B6D433a56d6Bd0FEf9447f6A92321aA;
    rootURI = "https://assets-vuca-prod.s3.ap-southeast-1.amazonaws.com/";
  }

  function initialize() public initializer {
    // init by deployer
    // after setup, multisig will be changed to governance
    __Multisigable_init(msg.sender);
    __AdotRegistry_init();
  }

  function _authorizeUpgrade(address) internal override onlyMultisig {}

  /* View */
  // verified
  function getPlatformFeeReceiver() public view override returns (address) {
    return platformFeeReceiver;
  }

  // verified
  function getVerifier() public view override returns (address) {
    return verifier;
  }

  function getMultisig() public view override returns (address) {
    return multisig;
  }

  // verified
  function getPlatformFee() public view override returns (uint96) {
    return platformFee;
  }

  // verified
  function feeDenominator() public pure override returns (uint96) {
    return 10000;
  }

  function getFeeAmount(uint256 amount) public view returns (uint256 fee, uint256 received) {
    fee = (amount * platformFee) / feeDenominator();
    received = amount - fee;
  }

  // verified
  function getRootURI() public view override returns (string memory) {
    return rootURI;
  }

  /* Config */
  // verified
  function setPlatformFeeReceiver(address _platformFeeReceiver) public onlyMultisig {
    platformFeeReceiver = _platformFeeReceiver;
  }

  // verified
  function setVerifier(address _verifier) public onlyMultisig {
    verifier = _verifier;
  }

  // verified
  function setPlatformFee(uint96 _platformFee) public onlyMultisig {
    require(_platformFee <= feeDenominator(), "Exceed max");
    platformFee = _platformFee;
  }

  // verified
  function setRootURI(string memory _rootURI) public onlyMultisig {
    rootURI = _rootURI;
  }
}
