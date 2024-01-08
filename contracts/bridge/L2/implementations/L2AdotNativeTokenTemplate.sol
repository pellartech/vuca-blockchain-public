// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../../common/IBridgeRegistry.sol";

contract L2AdotNativeTokenTemplate is
  Initializable, //
  UUPSUpgradeable,
  ReentrancyGuardUpgradeable,
  EIP712Upgradeable,
  ERC20Upgradeable
{
  using ECDSA for bytes32;

  struct SwapTokenToETHForwardRequest {
    uint256 nonce;
    address from;
    uint256 amount;
  }

  struct ApprovalForwardRequest {
    uint256 nonce;
    address owner;
    address spender;
    uint256 amount;
  }

  uint8 private _decimals;
  address public predicate;
  address public bridgeRegistry;
  address public rootToken;

  mapping(address => uint256) public counter;

  event SwapTokenToETH(uint256 indexed id, address indexed user, uint256 amount);
  event SwapETHToToken(uint256 indexed id, address indexed user, uint256 amount);

  modifier requireMultisig() {
    require(msg.sender == IBridgeRegistry(bridgeRegistry).getMultisig(), "Multisig required");
    _;
  }

  modifier onlyPredicate() {
    require(msg.sender == predicate, "Invalid sender");
    _;
  }

  receive() external payable {}

  function delegacySwapTokenToNative(SwapTokenToETHForwardRequest calldata req, bytes calldata signature) external {
    require(counter[req.from] == req.nonce, "Invalid nonce");
    require(verify(req, signature), "Invalid signature");
    _initiateSwapTokenToNative(req.from, req.amount);
  }

  function verify(SwapTokenToETHForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
    bytes32 structHash = keccak256("SwapTokenToETHForwardRequest(uint256 nonce,address from,uint256 amount)");
    address signer = _hashTypedDataV4(keccak256(abi.encode(structHash, req.nonce, req.from, req.amount))).recover(signature);
    return signer == req.from;
  }

  function initialize(
    address _predicate, //
    address _registry,
    address _rootToken,
    string memory _name_,
    string memory _symbol_,
    uint8 _decimals_
  ) public initializer {
    __ERC20_init(_name_, _symbol_);
    __EIP712_init("Adot", "1.0.0");
    __L2ERC20_init(_predicate, _registry, _rootToken, _decimals_);
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  function mint(address user, uint256 amount) public onlyPredicate {
    _mint(user, amount);
  }

  function burn(address user, uint256 amount) public onlyPredicate {
    _burn(user, amount);
  }

  function swapTokenToNative(uint256 amount) public {
    _initiateSwapTokenToNative(msg.sender, amount);
  }

  function swapNativeToToken() public payable {
    _initiateSwapNativeToToken(msg.sender, msg.value);
  }

  function __L2ERC20_init(address _predicate, address _registry, address _rootToken, uint8 _decimals_) internal {
    predicate = _predicate;
    bridgeRegistry = _registry;
    rootToken = _rootToken;
    _decimals = _decimals_;
  }

  function _initiateSwapTokenToNative(address user, uint256 amount) internal nonReentrant {
    uint256 _counter = counter[user];
    _burn(user, amount);
    (bool success, ) = user.call{ value: amount }("");
    require(success, "Transfer failed.");
    emit SwapTokenToETH(_counter, user, amount);
    counter[user]++;
  }

  function _initiateSwapNativeToToken(address user, uint256 amount) internal nonReentrant {
    require(msg.value == amount, "Invalid amount");
    uint256 _counter = counter[user];
    _mint(user, amount);
    emit SwapETHToToken(_counter, user, amount);
    counter[user]++;
  }

  function _authorizeUpgrade(address) internal override requireMultisig {}

  function delegacyApprove(ApprovalForwardRequest calldata req, bytes calldata signature, bytes calldata systemSignature) external {
    require(counter[req.owner] == req.nonce, "Invalid nonce");
    require(verify(req, signature), "Invalid signature");
    bytes32 messageHash = keccak256(signature);
    address signer = messageHash.toEthSignedMessageHash().recover(systemSignature);
    require(signer == IBridgeRegistry(bridgeRegistry).getSystemVerifier(), "Invalid system signature");

    _approve(req.owner, req.spender, req.amount);
  }

  function verify(ApprovalForwardRequest calldata req, bytes calldata signature) public view returns (bool) {
    bytes32 structHash = keccak256("ApprovalForwardRequest(uint256 nonce,address owner,address spender,uint256 amount)");
    address signer = _hashTypedDataV4Custom(keccak256(abi.encode(structHash, req.nonce, req.owner, req.spender, req.amount))).recover(signature);
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
