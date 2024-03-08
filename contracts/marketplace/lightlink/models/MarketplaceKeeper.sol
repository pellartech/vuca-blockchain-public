// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155HolderUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../common/IMarketplaceKeeper.sol";
import "../../common/IMarketplaceRegistry.sol";

contract AdotKeeper is
  IAdotKeeper, //
  Initializable,
  UUPSUpgradeable,
  ERC721HolderUpgradeable,
  ERC1155HolderUpgradeable
{
  using SafeERC20 for IERC20;

  // variables
  address public registry;
  mapping(bytes32 => mapping(address => uint256)) public nonces;

  mapping(bytes32 => mapping(bytes => bytes)) public key2Value;
  mapping(bytes32 => mapping(bytes => uint256)) public key2ValueUint256;
  mapping(bytes32 => mapping(bytes => address)) public key2ValueAddress;
  mapping(bytes32 => mapping(bytes => bool)) public key2ValueBool;
  mapping(bytes32 => mapping(bytes => bytes32)) public key2ValueBytes32;

  // verified
  modifier requireMultisig() {
    require(msg.sender == IMarketplaceRegistry(registry).getMultisig(), "Multisig required");
    _;
  }

  modifier requireSevice(bytes32 _serviceId) {
    bool isEnglishAuction = _serviceId == Constants.LISTING_ENGLISH_AUCTION_ID;
    bool isSpot = _serviceId == Constants.LISTING_SPOT_ID;
    bool isNormalOffer = _serviceId == Constants.NORMAL_OFFER_ID;
    bool isCollectionOffer = _serviceId == Constants.COLLECTION_OFFER_ID;
    bool validServices = isEnglishAuction || isSpot || isNormalOffer || isCollectionOffer;
    require(validServices, "Sender is not a valid service");
    require(msg.sender == IMarketplaceRegistry(registry).getService(_serviceId), "Require Service");
    _;
  }

  receive() external payable {
    revert("Not supported");
  }

  function initialize(address _registry) public initializer {
    __AdotModel_init(_registry);
  }

  /* Execute */
  function __AdotModel_init(address _registry) internal {
    registry = _registry;
  }

  function _authorizeUpgrade(address) internal override requireMultisig {}

  function emitEvent(bytes32 _serviceId, bytes32 _action, string calldata _structure, bytes calldata _encodedData) external requireSevice(_serviceId) {
    emit EventFired(_serviceId, _action, _structure, _encodedData, block.timestamp);
  }

  // bytes
  function getBytes(bytes32 _serviceId, bytes calldata _key) external view returns (bytes memory) {
    return key2Value[_serviceId][_key];
  }

  function setBytes(bytes32 _serviceId, bytes calldata _key, bytes calldata _value) external requireSevice(_serviceId) {
    key2Value[_serviceId][_key] = _value;
  }

  function delBytes(bytes32 _serviceId, bytes calldata _key) external requireSevice(_serviceId) {
    delete key2Value[_serviceId][_key];
  }

  // uint256
  function getUint256(bytes32 _serviceId, bytes calldata _key) external view returns (uint256) {
    return key2ValueUint256[_serviceId][_key];
  }

  function setUint256(bytes32 _serviceId, bytes calldata _key, uint256 _value) external requireSevice(_serviceId) {
    key2ValueUint256[_serviceId][_key] = _value;
  }

  function delUint256(bytes32 _serviceId, bytes calldata _key) external requireSevice(_serviceId) {
    delete key2ValueUint256[_serviceId][_key];
  }

  // address
  function getAddress(bytes32 _serviceId, bytes calldata _key) external view returns (address) {
    return key2ValueAddress[_serviceId][_key];
  }

  function setAddress(bytes32 _serviceId, bytes calldata _key, address _value) external requireSevice(_serviceId) {
    key2ValueAddress[_serviceId][_key] = _value;
  }

  function delAddress(bytes32 _serviceId, bytes calldata _key) external requireSevice(_serviceId) {
    delete key2ValueAddress[_serviceId][_key];
  }

  // bool
  function getBool(bytes32 _serviceId, bytes calldata _key) external view returns (bool) {
    return key2ValueBool[_serviceId][_key];
  }

  function setBool(bytes32 _serviceId, bytes calldata _key, bool _value) external requireSevice(_serviceId) {
    key2ValueBool[_serviceId][_key] = _value;
  }

  function delBool(bytes32 _serviceId, bytes calldata _key) external requireSevice(_serviceId) {
    delete key2ValueBool[_serviceId][_key];
  }

  // bytes32
  function getBytes32(bytes32 _serviceId, bytes calldata _key) external view returns (bytes32) {
    return key2ValueBytes32[_serviceId][_key];
  }

  function setBytes32(bytes32 _serviceId, bytes calldata _key, bytes32 _value) external requireSevice(_serviceId) {
    key2ValueBytes32[_serviceId][_key] = _value;
  }

  function delBytes32(bytes32 _serviceId, bytes calldata _key) external requireSevice(_serviceId) {
    delete key2ValueBytes32[_serviceId][_key];
  }

  /* Nonce */
  function getNonce(bytes32 _serviceId, address _user) external view returns (uint256) {
    return nonces[_serviceId][_user];
  }

  function increaseNonce(bytes32 _serviceId, address _user) external requireSevice(_serviceId) {
    nonces[_serviceId][_user]++;
  }

  function transferTokenBetween(
    bytes32 _serviceId,
    Constants.TokenItemType _itemType, //
    address _token,
    uint256 _id,
    uint256 _amount,
    address _from,
    address _to
  ) external requireSevice(_serviceId) {
    if (_itemType == Constants.TokenItemType.ERC20) {
      IERC20(_token).safeTransferFrom(_from, _to, _amount);
    } else if (_itemType == Constants.TokenItemType.ERC721) {
      IERC721(_token).safeTransferFrom(_from, _to, _id);
    } else if (_itemType == Constants.TokenItemType.ERC1155) {
      IERC1155(_token).safeTransferFrom(_from, _to, _id, _amount, "");
    } else {
      revert("Invalid token type");
    }
  }

  function tranferERC20Out(bytes32 _serviceId, address _token, address _to, uint256 _amount) external requireSevice(_serviceId) {
    require(_token != address(0), "Invalid token");
    require(_to != address(0), "Invalid to");
    require(_amount > 0, "Invalid amount");
    IERC20(_token).safeTransfer(_to, _amount);
  }

  function tranferERC721Out(bytes32 _serviceId, address _token, address _to, uint256 _tokenId) external requireSevice(_serviceId) {
    require(_token != address(0), "Invalid token");
    require(_to != address(0), "Invalid to");
    require(_tokenId >= 0, "Invalid tokenId");
    IERC721(_token).transferFrom(address(this), _to, _tokenId);
  }

  function tranferERC1155Out(bytes32 _serviceId, address _token, address _to, uint256 _tokenId, uint256 _amount) external requireSevice(_serviceId) {
    require(_token != address(0), "Invalid token");
    require(_to != address(0), "Invalid to");
    require(_tokenId >= 0, "Invalid tokenId");
    require(_amount > 0, "Invalid amount");
    IERC1155(_token).safeTransferFrom(address(this), _to, _tokenId, _amount, "");
  }

  function transferERC20In(bytes32 _serviceId, address _token, address _from, uint256 _amount) external requireSevice(_serviceId) {
    require(_token != address(0), "Invalid token");
    require(_from != address(0), "Invalid from");
    require(_amount > 0, "Invalid amount");
    IERC20(_token).transferFrom(_from, address(this), _amount);
  }

  function tranferERC721In(bytes32 _serviceId, address _token, address _from, uint256 _tokenId) external requireSevice(_serviceId) {
    require(_token != address(0), "Invalid token");
    require(_from != address(0), "Invalid from");
    require(_tokenId >= 0, "Invalid tokenId");
    IERC721(_token).transferFrom(_from, address(this), _tokenId);
  }

  function tranferERC1155In(bytes32 _serviceId, address _token, address _from, uint256 _tokenId, uint256 _amount) external requireSevice(_serviceId) {
    require(_token != address(0), "Invalid token");
    require(_from != address(0), "Invalid from");
    require(_tokenId >= 0, "Invalid tokenId");
    require(_amount > 0, "Invalid amount");
    IERC1155(_token).safeTransferFrom(_from, address(this), _tokenId, _amount, "");
  }
}
