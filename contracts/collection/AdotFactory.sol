// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "../prerequisite/Multisigable.sol";
import "../libs/Create2.sol";
import "../proxy/ContractProxy.sol";

// ADOT + VUCA + LightLink + Pellar 2023

contract AdotFactory is
  Initializable, //
  UUPSUpgradeable,
  Multisigable,
  EIP712Upgradeable
{
  using ECDSAUpgradeable for bytes32;

  // struct
  struct ForwardRequest {
    address from;
    bytes32 contractType;
    bytes32 dataHash;
    uint256 nonce;
  }

  bytes32 private _STRUCT_HASH;

  event ProxyDeployed(bytes32 indexed contractType, address indexed implementation, address proxy, address indexed deployer);
  event ImplementationAdded(bytes32 indexed contractType, address implementation, uint256 version);

  /// mapping(contractType => implementations)
  mapping(bytes32 => address[]) public implementations;

  /// mapping(address => nonce)
  mapping(address => uint256) public nonce;

  /// mapping(contract => deployer)
  mapping(address => address) public deployer;

  function __AdotFactory_init() internal {
    _STRUCT_HASH = keccak256("ForwardRequest(address from,bytes32 contractType,bytes32 dataHash,uint256 nonce)");
  }

  function initialize() public initializer {
    // init by deployer
    // after setup, multisig will be changed to governance
    __Multisigable_init(msg.sender);
    __EIP712_init("Adot", "1");
    __AdotFactory_init();
  }

  function _authorizeUpgrade(address) internal override onlyMultisig {}

  /* View */
  // verified
  function verify(ForwardRequest calldata _req, bytes calldata _signature) public view returns (bool) {
    address signer = _hashTypedDataV4(keccak256(abi.encode(_STRUCT_HASH, _req.from, _req.contractType, _req.dataHash, _req.nonce))).recover(_signature);
    return signer == _req.from;
  }

  /* USer */
  // verified
  function deployProxy(bytes32 _type, bytes memory _data) external {
    _deployProxyDeterministic(msg.sender, _type, _data);
  }

  // verified
  function delegacyDeployProxy(ForwardRequest calldata _req, bytes calldata _data, bytes calldata _signature) external {
    require(keccak256(_data) == _req.dataHash, "Invalid data");
    require(nonce[_req.from] == _req.nonce, "Invalid nonce");
    require(verify(_req, _signature), "Invalid signature");
    _deployProxyDeterministic(_req.from, _req.contractType, _data);
  }

  // verified
  function _deployProxyDeterministic(address _account, bytes32 _type, bytes memory _data) internal {
    address implementation = getLatestImplementation(_type);
    uint256 salt = nonce[_account];
    _deployProxyByImplementation(_type, _account, salt, implementation, _data);
    nonce[_account] += 1;
  }

  // verified
  function _deployProxyByImplementation(bytes32 _type, address _account, uint256 _salt, address _implementation, bytes memory _data) internal {
    bytes32 saltHash = keccak256(abi.encode(_account, _salt));
    address deployedProxy = Create2.createClone2(saltHash, type(ContractProxy).creationCode);
    deployer[deployedProxy] = _account;

    bytes memory data = abi.encodeWithSignature(
      "initialize(address,bytes)", //
      _implementation,
      _data
    );
    Address.functionCall(deployedProxy, data);
    emit ProxyDeployed(_type, _implementation, deployedProxy, _account);
  }

  // verified
  function addImplementation(bytes32 _type, address _implementation) external onlyMultisig {
    require(Address.isContract(_implementation), "Require contract");

    implementations[_type].push(_implementation);
    emit ImplementationAdded(_type, _implementation, implementations[_type].length - 1);
  }

  // verified
  function getImplementation(bytes32 _type, uint256 _version) public view returns (address) {
    if (implementations[_type].length == 0) {
      return address(0);
    }
    return implementations[_type][_version];
  }

  // verified
  function getLatestImplementation(bytes32 _type) public view returns (address) {
    if (implementations[_type].length == 0) {
      return address(0);
    }
    return implementations[_type][implementations[_type].length - 1];
  }
}
