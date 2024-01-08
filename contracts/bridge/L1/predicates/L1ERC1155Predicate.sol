// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../../../libs/Create2.sol";
import "./IL1Predicate.sol";
import "../../common/IBridgeRegistry.sol";

contract L1ERC1155Predicate is
  Initializable, //
  UUPSUpgradeable,
  ReentrancyGuardUpgradeable,
  IL1Predicate,
  ERC1155Holder
{
  using ECDSA for bytes32;

  // variables
  bool public isPaused;
  address public bridgeRegistry;
  address public l2Predicate;
  bytes32 public l2TokenBytecodeHash;
  mapping(address => address) public l1ToL2Gateway;

  mapping(address => uint256) public counter;
  mapping(address => mapping(uint256 => bool)) public orderExecuted;
  mapping(address => mapping(uint256 => mapping(address => bool))) public isConfirmed;

  event TokenMapped(bytes message);
  event DepositToken(bytes message);
  event WithdrawToken(bytes32 messageHash);

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

  function recovery(address _token, uint256[] memory _tokenIds, uint256[] memory _amounts, address _to) external requireMultisig {
    require(_tokenIds.length == _amounts.length, "Input mismatch");
    for (uint256 i = 0; i < _tokenIds.length; i++) {
      IERC1155(_token).safeTransferFrom(address(this), _to, _tokenIds[i], _amounts[i], "");
    }
  }

  // verified
  function deposit(address _l1Token, uint256[] memory _ids, uint256[] memory _amount) external virtual {
    _initiateDeposit(_l1Token, msg.sender, msg.sender, _ids, _amount);
  }

  // verified
  function depositTo(address _l1Token, address _to, uint256[] memory _ids, uint256[] memory _amount) external virtual {
    _initiateDeposit(_l1Token, msg.sender, _to, _ids, _amount);
  }

  function syncWithdraw(
    address[] memory _currentValidators,
    bytes[] memory _signatures,
    // transaction data
    bytes memory _data
  ) external nonReentrant notPaused {
    (address from, uint256 orderId, address l1Token, address l2Token, address to, uint256[] memory ids, uint256[] memory amount) = abi.decode(_data, (address, uint256, address, address, address, uint256[], uint256[]));
    require(l2Predicate != address(0), "Not implemented");
    require(ids.length == amount.length, "Input mismatch");
    require(ids.length > 0, "No tokens");
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

    for (uint256 i = 0; i < ids.length; i++) {
      IERC1155(l1Token).safeTransferFrom(address(this), to, ids[i], amount[i], "");
    }

    emit WithdrawToken(messageHash);
  }

  function initialize(address _registry, address _l2Predicate) public initializer {
    __ReentrancyGuard_init();
    __L1ERC1155Predicate_init(_registry, _l2Predicate);
  }

  function modifyL2TokenBytecodeHash(bytes32 _l2TokenBytecodeHash) public requireMultisig {
    l2TokenBytecodeHash = _l2TokenBytecodeHash;
  }

  function toggleIsPaused(bool _status) public requireMultisig {
    isPaused = _status;
  }

  function modifyL2Predicate(address _l2Predicate) public requireMultisig {
    l2Predicate = _l2Predicate;
  }

  function mapToken(address _l1Token) public {
    // check if token is already mapped
    require(l2Predicate != address(0x0), "Invalid L2 pair");
    require(l1ToL2Gateway[_l1Token] == address(0x0), "Already mapped");

    // compute child token address before deployment using create2
    bytes32 salt = keccak256(abi.encodePacked(_l1Token));
    address l2Token = Create2.computeAddress(salt, l2TokenBytecodeHash, l2Predicate);
    require(l2Token != address(0x0), "Invalid L2 token");

    // add into mapped tokens
    l1ToL2Gateway[_l1Token] = l2Token;

    emit TokenMapped(abi.encode(msg.sender, counter[msg.sender], _l1Token));
    counter[msg.sender]++;
  }

  function __L1ERC1155Predicate_init(address _registry, address _l2Predicate) internal {
    bridgeRegistry = _registry;
    l2Predicate = _l2Predicate;
    l2TokenBytecodeHash = 0xb9ae7ba14d826de669be54f7c79008181b430f21bd3ff90dac8cce1e60ae88a9;
  }

  function _authorizeUpgrade(address) internal override requireMultisig {}

  function _initiateDeposit(address _l1Token, address _from, address _to, uint256[] memory _ids, uint256[] memory _amount) internal notPaused {
    require(l2Predicate != address(0), "Not implemented");
    require(_ids.length == _amount.length, "Input mismatch");
    require(_ids.length > 0, "No tokens");
    require(_to != address(0), "Invalid address");

    if (l1ToL2Gateway[_l1Token] == address(0)) {
      mapToken(_l1Token);
    }

    for (uint256 i = 0; i < _ids.length; i++) {
      IERC1155(_l1Token).safeTransferFrom(_from, address(this), _ids[i], _amount[i], "");
    }

    uint256 counter_ = counter[_from];

    emit DepositToken(abi.encode(_from, counter_, _l1Token, l1ToL2Gateway[_l1Token], _to, _ids, _amount));
    counter[_from]++;
  }

  function _checkValidatorSignatures(
    address _from, //
    uint256 _orderId,
    address[] memory _currentValidators,
    bytes[] memory _signatures,
    bytes32 _messageHash,
    uint256 _powerThreshold
  ) private {
    uint256 cumulativePower = 0;

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
