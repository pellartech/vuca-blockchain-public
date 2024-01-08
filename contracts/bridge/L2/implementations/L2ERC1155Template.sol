// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../../common/IBridgeRegistry.sol";

contract L2ERC1155Template is
  Initializable, //
  UUPSUpgradeable,
  ERC1155Upgradeable,
  EIP712Upgradeable
{
  using ECDSA for bytes32;

  struct ApprovalForAllForwardRequest {
    uint256 nonce;
    address owner;
    address spender;
    bool approved;
  }

  address public predicate;
  address public bridgeRegistry;
  address public rootToken;

  mapping(address => uint256) public counter;

  modifier requireMultisig() {
    require(msg.sender == IBridgeRegistry(bridgeRegistry).getMultisig(), "Multisig required");
    _;
  }

  modifier onlyPredicate() {
    require(msg.sender == predicate, "Invalid sender");
    _;
  }

  function initialize(
    address _predicate,
    address _registry,
    address _rootToken
  ) public initializer {
    __ERC1155_init("");
    __EIP712_init("Adot", "1.0.0");
    __L2ERC20_init(_predicate, _registry, _rootToken);
  }

  function mint(address _account, uint256 _id, uint256 _amount, bytes memory _data) public onlyPredicate {
    _mint(_account, _id, _amount, _data);
  }

  function mintBatch(address _account, uint256[] memory _ids, uint256[] memory _amounts, bytes memory data) public onlyPredicate {
    _mintBatch(_account, _ids, _amounts, data);
  }

  function burn(address _account, uint256 _id, uint256 _amount) public onlyPredicate {
    _burn(_account, _id, _amount);
  }

  function burnBatch(address _account, uint256[] memory _ids, uint256[] memory _amounts) public onlyPredicate {
    _burnBatch(_account, _ids, _amounts);
  }

  function _authorizeUpgrade(address) internal override requireMultisig {}

  function __L2ERC20_init(address _predicate, address _registry, address _rootToken) internal {
    predicate = _predicate;
    bridgeRegistry = _registry;
    rootToken = _rootToken;
  }

  function delegacyApproveForAll(ApprovalForAllForwardRequest calldata req, bytes calldata signature, bytes calldata systemSignature) external {
    require(counter[req.owner] == req.nonce, "Invalid nonce");
    require(verify(req, signature), "Invalid signature");
    bytes32 messageHash = keccak256(signature);
    address signer = messageHash.toEthSignedMessageHash().recover(systemSignature);
    require(signer == IBridgeRegistry(bridgeRegistry).getSystemVerifier(), "Invalid system signature");

    _setApprovalForAll(req.owner, req.spender, req.approved);
  }

  function verify(ApprovalForAllForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
    bytes32 structHash = keccak256("ApprovalForAllForwardRequest(uint256 nonce,address owner,address spender,bool approved)");
    address signer = _hashTypedDataV4Custom(keccak256(abi.encode(structHash, req.nonce, req.owner, req.spender, req.approved))).recover(signature);
    return signer == req.owner;
  }

  function buildDomainSeparatorV4(bytes32 typeHash, bytes32 nameHash, bytes32 versionHash) internal view returns (bytes32) {
    // sig from ethereum chain
    uint256 chainid = 1;
    return keccak256(abi.encode(typeHash, nameHash, versionHash, chainid, address(this)));
  }

  function domainSeparatorV4() internal view returns (bytes32) {
    bytes32 typeHash = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    return buildDomainSeparatorV4(typeHash, _EIP712NameHash(), _EIP712VersionHash());
  }

  function _hashTypedDataV4Custom(bytes32 structHash) internal view returns (bytes32) {
    return ECDSAUpgradeable.toTypedDataHash(domainSeparatorV4(), structHash);
  }
}
