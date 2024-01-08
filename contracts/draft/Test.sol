// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "hardhat/console.sol";

contract TestContract {
  using ECDSA for bytes32;

  struct TokenItem {
    uint8 itemType;
    address token;
    uint256 id;
    uint256 amount;
  }

  struct Distribution {
    uint8 itemType;
    address token;
    address recipient;
    uint256 percentage;
  }

  struct Runtime {
    uint256 price;
    uint256 startTime;
    uint256 endTime;
    bytes32 whitelistProof;
  }

  struct ListingItem {
    uint8 state;
    address lister;
    TokenItem[] items;
    Distribution[] distributions;
    Runtime runtime;
    uint256 nonce;
  }

  struct Test {
    uint8 state;
    TokenItem[] items;
    Distribution[] distributions;
    Runtime runtime;
    uint256 nonce;
  }

  struct CancelListing {
    address caller;
    uint256 id;
  }

  struct FulfillItem {
    address buyer;
    uint256 id;
  }

  function _EIP712NameHash() internal pure virtual returns (bytes32) {
    return keccak256("Adot");
  }

  function _EIP712VersionHash() internal pure virtual returns (bytes32) {
    return keccak256("1.0.0");
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
    return ECDSA.toTypedDataHash(domainSeparatorV4(), structHash);
  }

  function verifyBig(ListingItem memory _req, bytes calldata _signatures) public view returns (address) {
    address user = _hashTypedDataV4Custom(hash(_req)).recover(_signatures);
    console.log(user == msg.sender);
    return user;
  }

  function verify(TokenItem memory _req, bytes calldata _signatures) public view returns (address) {
    address user = _hashTypedDataV4Custom(hash(_req)).recover(_signatures);
    console.log(user == msg.sender);
    return user;
  }

  function hash(ListingItem memory _req) public pure returns (bytes32) {
    // array
    bytes32 structHash = keccak256("ListingItem(uint8 state,address lister,TokenItem[] items,Distribution[] distributions,Runtime runtime,uint256 nonce)Distribution(uint8 itemType,address token,address recipient,uint256 percentage)Runtime(uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof)TokenItem(uint8 itemType,address token,uint256 id,uint256 amount)");
    bytes32[] memory encodedItems = new bytes32[](_req.items.length);
    for (uint256 i = 0; i < _req.items.length; i++) {
      encodedItems[i] = hash(_req.items[i]);
    }

    bytes32[] memory encodedDistributions = new bytes32[](_req.distributions.length);
    for (uint256 i = 0; i < _req.distributions.length; i++) {
      encodedDistributions[i] = hash(_req.distributions[i]);
    }

    return
      keccak256(
        abi.encode(
          structHash,
          _req.state, //
          _req.lister,
          keccak256(abi.encodePacked(encodedItems)),
          keccak256(abi.encodePacked(encodedDistributions)),
          hash(_req.runtime),
          _req.nonce
        )
      );
  }

  function hash(TokenItem memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("TokenItem(uint8 itemType,address token,uint256 id,uint256 amount)");
    return keccak256(abi.encode(structHash, _req.itemType, _req.token, _req.id, _req.amount));
  }

  function hash(Distribution memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("Distribution(uint8 itemType,address token,address recipient,uint256 percentage)");
    return keccak256(abi.encode(structHash, _req.itemType, _req.token, _req.recipient, _req.percentage));
  }

  function hash(Runtime memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("Runtime(uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof)");
    return keccak256(abi.encode(structHash, _req.price, _req.startTime, _req.endTime, _req.whitelistProof));
  }
}
