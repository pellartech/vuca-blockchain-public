// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./Constants.sol";

interface IAdotKeeper {
  event EventFired(bytes32 indexed serviceId, bytes32 indexed action, string dataStructure, bytes encodedData, uint256 timestamp);

  function emitEvent(bytes32 _serviceId, bytes32 _action, string calldata _structure, bytes calldata _encodedData) external;

  function getNonce(bytes32 _serviceId, address _user) external view returns (uint256);

  function increaseNonce(bytes32 _serviceId, address _user) external;

  function getBytes(bytes32 _serviceId, bytes calldata _key) external view returns (bytes memory);

  function setBytes(bytes32 _serviceId, bytes calldata _key, bytes calldata _value) external;

  function delBytes(bytes32 _serviceId, bytes calldata _key) external;

  // uint256
  function getUint256(bytes32 _serviceId, bytes calldata _key) external view returns (uint256);

  function setUint256(bytes32 _serviceId, bytes calldata _key, uint256 _value) external;

  function delUint256(bytes32 _serviceId, bytes calldata _key) external;

  // address
  function getAddress(bytes32 _serviceId, bytes calldata _key) external view returns (address);

  function setAddress(bytes32 _serviceId, bytes calldata _key, address _value) external;

  function delAddress(bytes32 _serviceId, bytes calldata _key) external;

  // bool
  function getBool(bytes32 _serviceId, bytes calldata _key) external view returns (bool);

  function setBool(bytes32 _serviceId, bytes calldata _key, bool _value) external;

  function delBool(bytes32 _serviceId, bytes calldata _key) external;

  // bytes32
  function getBytes32(bytes32 _serviceId, bytes calldata _key) external view returns (bytes32);

  function setBytes32(bytes32 _serviceId, bytes calldata _key, bytes32 _value) external;

  function delBytes32(bytes32 _serviceId, bytes calldata _key) external;

  function transferTokenBetween(
    bytes32 _serviceId,
    Constants.TokenItemType _itemType, //
    address _token,
    uint256 _id,
    uint256 _amount,
    address _from,
    address _to
  ) external;

  function tranferERC20Out(bytes32 _serviceId, address _token, address _to, uint256 _amount) external;

  function tranferERC721Out(bytes32 _serviceId, address _token, address _to, uint256 _tokenId) external;

  function tranferERC1155Out(bytes32 _serviceId, address _token, address _to, uint256 _tokenId, uint256 _amount) external;

  function transferERC20In(bytes32 _serviceId, address _token, address _from, uint256 _amount) external;

  function tranferERC721In(bytes32 _serviceId, address _token, address _from, uint256 _tokenId) external;

  function tranferERC1155In(bytes32 _serviceId, address _token, address _from, uint256 _tokenId, uint256 _amount) external;
}
