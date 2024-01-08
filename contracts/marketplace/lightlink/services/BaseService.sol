// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../common/IMarketplaceRegistry.sol";
import "../../common/IMarketplaceKeeper.sol";
import "../../common/Constants.sol";

abstract contract BaseAdotService is ReentrancyGuard {
  using ECDSA for bytes32;

  address public registry;

  // verified
  modifier requireMultisig() {
    require(msg.sender == IMarketplaceRegistry(registry).getMultisig(), "Multisig required");
    _;
  }

  // verified
  modifier requireRouter() {
    require(msg.sender == IMarketplaceRegistry(registry).getService(Constants.ADOT_ROUTER_ID), "Require Router");
    _;
  }

  receive() external payable {
    revert("Not supported");
  }

  constructor(address _registry) {
    registry = _registry;
  }

  function serviceId() public pure virtual returns (bytes32);

  function keeper() public view returns (address) {
    return IMarketplaceRegistry(registry).getService(Constants.ADOT_KEEPER_ID);
  }

  // verified
  function _beforeExecute() internal virtual requireRouter {}

  function isSystemVerifier(address _account) internal view virtual returns (bool) {
    return _account == IMarketplaceRegistry(registry).getSystemVerifier();
  }

  function _EIP712NameHash() internal pure virtual returns (bytes32) {
    return keccak256("Adot");
  }

  function _EIP712VersionHash() internal pure virtual returns (bytes32) {
    return keccak256("1.0.0");
  }

  function checkSupportTradeableTokenItem(Constants.TokenItemType _itemType) internal pure virtual {
    require(
      _itemType == Constants.TokenItemType.ERC721 || //
        _itemType == Constants.TokenItemType.ERC1155,
      "Only support NFTs"
    );
  }

  function checkSupportPayableTokenItem(Constants.TokenItemType _itemType, address _token) internal view virtual {
    require(IMarketplaceRegistry(registry).checkSupportedPayableToken(_token), "Not supported payment token");
    require(_itemType == Constants.TokenItemType.ERC20, "Only support ERC20");
  }

  function getAllowanceByTokenAndType(
    Constants.TokenItemType _itemType, //
    address _token,
    address _from,
    address _spender
  ) public view returns (uint256) {
    if (_itemType == Constants.TokenItemType.ERC20) {
      return IERC20(_token).allowance(_from, _spender);
    }

    if (_itemType == Constants.TokenItemType.ERC721) {
      bool isApproved = IERC721(_token).isApprovedForAll(_from, _spender);
      if (isApproved) {
        return type(uint256).max;
      }
      return 0;
    }

    if (_itemType == Constants.TokenItemType.ERC1155) {
      bool isApproved = IERC1155(_token).isApprovedForAll(_from, _spender);
      if (isApproved) {
        return type(uint256).max;
      }
      return 0;
    }
    return 0; // default: native
  }

  function getOwnerByTokenAndType(
    Constants.TokenItemType _itemType, //
    address _token,
    uint256 _id,
    uint256 _amount,
    address _from
  ) public view returns (address) {
    if (_itemType == Constants.TokenItemType.ERC721) {
      return IERC721(_token).ownerOf(_id);
    }

    if (_itemType == Constants.TokenItemType.ERC1155) {
      uint256 balance = IERC1155(_token).balanceOf(_from, _id);
      if (balance >= _amount) {
        return _from;
      }
      return address(0);
    }

    return address(0); // default: native
  }

  function getBalanceByTokenAndType(
    Constants.TokenItemType _itemType, //
    address _token,
    uint256 _id,
    address _from
  ) public view returns (uint256) {
    if (_itemType == Constants.TokenItemType.ERC20) {
      return IERC20(_token).balanceOf(_from);
    }

    if (_itemType == Constants.TokenItemType.ERC721) {
      return IERC721(_token).balanceOf(_from);
    }

    if (_itemType == Constants.TokenItemType.ERC1155) {
      return IERC1155(_token).balanceOf(_from, _id);
    }

    return address(_from).balance; // default: native
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

  function verifySystemSignature(bytes[] calldata _signatures) public view returns (bool) {
    bytes32 messageHash = keccak256(_signatures[0]);
    address signer = messageHash.toEthSignedMessageHash().recover(_signatures[1]);
    return signer == IMarketplaceRegistry(registry).getSystemVerifier();
  }
}
