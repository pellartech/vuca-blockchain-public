// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "../../../libs/Create2.sol";
import "./IL2Predicate.sol";
import "../../common/IBridgeRegistry.sol";

contract L2ERC721Predicate is
  Initializable, //
  UUPSUpgradeable,
  EIP712Upgradeable,
  IL2Predicate
{
  using ECDSA for bytes32;

  struct WithdrawalForwardRequest {
    uint256 nonce;
    address l1Token;
    address from;
    address to;
    uint256[] tokenIds;
  }

  // variables
  bytes32 private _STRUCT_HASH;
  bool public isPaused;
  address public bridgeRegistry;
  address public implTemplate;
  mapping(address => address) public l1ToL2Gateway;

  mapping(address => uint256) public counter;
  mapping(address => mapping(uint256 => bool)) public orderExecuted;
  mapping(address => mapping(uint256 => mapping(address => bool))) public isConfirmed;

  event TokenMapped(bytes32 messageHash);
  event WithdrawToken(bytes message);
  event DepositToken(bytes32 messageHash);

  modifier requireMultisig() {
    require(msg.sender == IBridgeRegistry(bridgeRegistry).getMultisig(), "Multisig required");
    _;
  }

  modifier notPaused() {
    require(!isPaused, "Paused");
    _;
  }

  receive() external payable {
    revert("Not supported");
  }

  // verified
  function withdraw(address _l2Token, uint256[] memory _tokenIds) external payable {
    _initiateWithdraw(_l2Token, msg.sender, msg.sender, _tokenIds);
  }

  // verified
  function withdrawTo(address _l2Token, address _to, uint256[] memory _tokenIds) external payable {
    _initiateWithdraw(_l2Token, msg.sender, _to, _tokenIds);
  }

  function delegacyWithdraw(WithdrawalForwardRequest calldata req, bytes calldata signature) external {
    require(counter[req.from] == req.nonce, "Invalid nonce");
    require(req.from == req.to, "Invalid address");
    require(verify(req, signature), "Invalid signature");
    address l2Token = l1ToL2Gateway[req.l1Token];
    _initiateWithdraw(l2Token, req.from, req.to, req.tokenIds);
  }

  function syncDeposit(
    address[] memory _currentValidators,
    bytes[] memory _signatures,
    // transaction data
    bytes memory _data
  ) external notPaused {
    (address from, uint256 orderId, address l1Token, address l2Token, address to, uint256[] memory tokenIds) = abi.decode(_data, (address, uint256, address, address, address, uint256[]));
    require(tokenIds.length > 0, "No token");
    require(to != address(0), "Invalid address");
    require(!orderExecuted[from][orderId], "Order already executed");
    require(_currentValidators.length == _signatures.length, "Input mismatch");
    require(l1ToL2Gateway[l1Token] == l2Token, "Invalid token gateway");

    bytes32 messageHash = keccak256(abi.encodePacked(block.chainid, _data));
    _checkValidatorSignatures(
      from,
      orderId,
      _currentValidators,
      _signatures,
      // Get hash of the transaction batch and checkpoint
      messageHash,
      IBridgeRegistry(bridgeRegistry).consensusPowerThreshold()
    );

    orderExecuted[from][orderId] = true;

    // call mint using call
    for (uint256 i = 0; i < tokenIds.length; i++) {
      (bool success, ) = l2Token.call(abi.encodeWithSignature("mint(address,uint256)", to, tokenIds[i]));
      require(success, "ERC721 mint failed");
    }

    emit DepositToken(messageHash);
  }

  function initialize(address _registry, address _impl) public initializer {
    __EIP712_init("Lightlink", "1.0.0");
    __L2ERC721Predicate_init(_registry, _impl);
  }

  function verify(WithdrawalForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
    address signer = _hashTypedDataV4(keccak256(abi.encode(_STRUCT_HASH, req.nonce, req.l1Token, req.from, req.to, keccak256(abi.encodePacked(req.tokenIds))))).recover(signature);
    return signer == req.from;
  }

  function toggleIsPaused(bool _status) public requireMultisig {
    isPaused = _status;
  }

  function modifyImplTemplate(address _template) public requireMultisig {
    implTemplate = _template;
  }

  function mapToken(address[] calldata _currentValidators, bytes[] calldata _signatures, bytes calldata _message) public {
    (address from, uint256 orderId, address l1Token, string memory name, string memory symbol) = abi.decode(_message, (address, uint256, address, string, string));

    // get root to child token
    address childToken = l1ToL2Gateway[l1Token];

    require(!orderExecuted[from][orderId], "Already executed");

    // check if it's already mapped
    require(childToken == address(0x0), "Already mapped");
    bytes32 messageHash = keccak256(abi.encodePacked(block.chainid, _message));
    _checkValidatorSignatures(
      from,
      orderId,
      _currentValidators,
      _signatures,
      // Get hash of the transaction batch and checkpoint
      messageHash,
      IBridgeRegistry(bridgeRegistry).consensusPowerThreshold()
    );

    // deploy new child token
    bytes32 salt = keccak256(abi.encodePacked(l1Token));
    childToken = Create2.createClone2(
      salt,
      hex"608060405234801561001057600080fd5b50610642806100206000396000f3fe6080604052600436106100225760003560e01c8063d1f578941461003957610031565b366100315761002f61004c565b005b61002f61004c565b61002f610047366004610459565b61005e565b61005c610057610098565b6100dd565b565b6000610068610098565b73ffffffffffffffffffffffffffffffffffffffff161461008857600080fd5b61009482826000610106565b5050565b60006100d87f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5473ffffffffffffffffffffffffffffffffffffffff1690565b905090565b3660008037600080366000845af43d6000803e8080156100fc573d6000f35b3d6000fd5b505050565b61010f83610131565b60008251118061011c5750805b156101015761012b838361017e565b50505050565b61013a816101aa565b60405173ffffffffffffffffffffffffffffffffffffffff8216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b60606101a383836040518060600160405280602781526020016105e6602791396102b9565b9392505050565b73ffffffffffffffffffffffffffffffffffffffff81163b610253576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152602d60248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e60448201527f6f74206120636f6e74726163740000000000000000000000000000000000000060648201526084015b60405180910390fd5b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc80547fffffffffffffffffffffffff00000000000000000000000000000000000000001673ffffffffffffffffffffffffffffffffffffffff92909216919091179055565b60606000808573ffffffffffffffffffffffffffffffffffffffff16856040516102e39190610578565b600060405180830381855af49150503d806000811461031e576040519150601f19603f3d011682016040523d82523d6000602084013e610323565b606091505b50915091506103348683838761033e565b9695505050505050565b606083156103d45782516000036103cd5773ffffffffffffffffffffffffffffffffffffffff85163b6103cd576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e7472616374000000604482015260640161024a565b50816103de565b6103de83836103e6565b949350505050565b8151156103f65781518083602001fd5b806040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161024a9190610594565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000806040838503121561046c57600080fd5b823573ffffffffffffffffffffffffffffffffffffffff8116811461049057600080fd5b9150602083013567ffffffffffffffff808211156104ad57600080fd5b818501915085601f8301126104c157600080fd5b8135818111156104d3576104d361042a565b604051601f82017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0908116603f011681019083821181831017156105195761051961042a565b8160405282815288602084870101111561053257600080fd5b8260208601602083013760006020848301015280955050505050509250929050565b60005b8381101561056f578181015183820152602001610557565b50506000910152565b6000825161058a818460208701610554565b9190910192915050565b60208152600082518060208401526105b3816040850160208701610554565b601f017fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe016919091016040019291505056fe416464726573733a206c6f772d6c6576656c2064656c65676174652063616c6c206661696c6564a264697066735822122079f61452255c981c15f5d9dbb55ff35fdb6de158648f693ed97573a523c6b9c064736f6c63430008130033"
    );
    // map the token
    l1ToL2Gateway[l1Token] = childToken;

    // call initialize using call
    (bool success, bytes memory data) = childToken.call(
      abi.encodeWithSignature(
        "initialize(address,bytes)", //
        implTemplate,
        // encode function data for initialize
        abi.encodeWithSignature(
          "initialize(address,address,address,string,string)",
          address(this), //
          bridgeRegistry,
          l1Token,
          name,
          symbol
        )
      )
    );

    require(success, string(data));

    emit TokenMapped(messageHash);
  }

  function __L2ERC721Predicate_init(address _registry, address _impl) internal {
    _STRUCT_HASH = keccak256("WithdrawalForwardRequest(uint256 nonce,address l1Token,address from,address to,uint256[] tokenIds)");
    bridgeRegistry = _registry;
    implTemplate = _impl;
  }

  function _authorizeUpgrade(address) internal override requireMultisig {}

  function buildDomainSeparatorV4(bytes32 typeHash, bytes32 nameHash, bytes32 versionHash) internal view returns (bytes32) {
    // sig from ethereum chain
    uint256 chainid = 1;
    return keccak256(abi.encode(typeHash, nameHash, versionHash, chainid, address(this)));
  }

  function domainSeparatorV4() internal view returns (bytes32) {
    bytes32 typeHash = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    return buildDomainSeparatorV4(typeHash, _EIP712NameHash(), _EIP712VersionHash());
  }

  function _hashTypedDataV4(bytes32 structHash) internal view virtual override returns (bytes32) {
    return ECDSAUpgradeable.toTypedDataHash(domainSeparatorV4(), structHash);
  }

  function _initiateWithdraw(address _l2Token, address _from, address _to, uint256[] memory _tokenIds) internal notPaused {
    require(_tokenIds.length > 0, "No token");
    require(_to != address(0), "Invalid address");
    require(_l2Token != address(0), "Invalid token");

    // check ownerOf
    bool success;
    bytes memory data;
    (success, data) = _l2Token.call(abi.encodeWithSignature("rootToken()"));
    require(success, "ERC721 rootToken failed");
    address l1Token = abi.decode(data, (address));
    require(l1ToL2Gateway[l1Token] == _l2Token, "Token not mapped");

    // burn using call
    for (uint256 i = 0; i < _tokenIds.length; i++) {
      (success, data) = _l2Token.call(abi.encodeWithSignature("ownerOf(uint256)", _tokenIds[i]));
      require(success, "ERC721 ownerOf failed");
      address owner = abi.decode(data, (address));
      require(owner == _from, "Not owner");
      (success, ) = _l2Token.call(abi.encodeWithSignature("burn(uint256)", _tokenIds[i]));
      require(success, "ERC721 burn failed");
    }

    uint256 counter_ = counter[_from];

    emit WithdrawToken(abi.encode(_from, counter_, l1Token, _l2Token, _to, _tokenIds));
    counter[_from]++;
  }

  function _checkValidatorSignatures(address _from, uint256 _orderId, address[] memory _currentValidators, bytes[] memory _signatures, bytes32 _messageHash, uint256 _powerThreshold) private {
    uint256 cumulativePower = 0;
    // check no dupicate validator

    for (uint256 i = 0; i < _currentValidators.length; i++) {
      address signer = _messageHash.toEthSignedMessageHash().recover(_signatures[i]);
      require(signer == _currentValidators[i], "Validator signature does not match.");
      require(IBridgeRegistry(bridgeRegistry).validValidator(signer), "Invalid validator");
      require(!isConfirmed[_from][_orderId][signer], "No duplicate validator");

      // prevent double-signing attacks
      isConfirmed[_from][_orderId][signer] = true;

      // Sum up cumulative power
      cumulativePower += IBridgeRegistry(bridgeRegistry).getPower(signer);

      // Break early to avoid wasting gas
      if (cumulativePower > _powerThreshold) {
        break;
      }
    }

    // Check that there was enough power
    require(cumulativePower >= _powerThreshold, "Submitted validator set signatures do not have enough power.");
    // Success
  }
}
