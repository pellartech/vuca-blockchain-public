// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BaseService.sol";

contract ListingSpot is BaseAdotService {
  using ECDSA for bytes32;

  struct TokenItem {
    Constants.TokenItemType itemType;
    address token;
    uint256 id;
    uint256 amount;
  }

  struct Distribution {
    address recipient;
    uint256 percentage;
  }

  struct Runtime {
    Constants.TokenItemType itemType;
    address paymentToken;
    uint256 price;
    uint256 startTime;
    uint256 endTime;
    bytes32 whitelistProof;
    bytes data;
  }

  struct ListingItem {
    Constants.ItemState state;
    address lister;
    TokenItem[] items;
    Distribution[] distributions;
    Runtime runtime;
    uint256 version;
    uint256 nonce;
  }

  struct CancelListing {
    address caller;
    uint256 id;
  }

  struct FulfillItem {
    address buyer;
    uint256 id;
    uint256 version;
  }

  bytes public constant LISTING_ID_COUNTER_KEY = "LISTING_ID_COUNTER";
  bytes public constant LISTING_SPOT_ITEM_PREFIX = "LISTING_SPOT_ITEM_";
  bytes public constant LISTED_SPOT_ITEM_KEY = "LISTED_SPOT_ITEM";
  bytes public constant UPDATED_LISTING_SPOT_ITEM_KEY = "UPDATED_LISTING_SPOT_ITEM";
  bytes public constant CANCELLED_SPOT_ITEM_KEY = "CANCELLED_SPOT_ITEM";
  bytes public constant FULFILLED_SPOT_ITEM_KEY = "FULFILLED_SPOT_ITEM";

  constructor(address _registry) BaseAdotService(_registry) {}

  function serviceId() public pure override returns (bytes32) {
    return Constants.LISTING_SPOT_ID;
  }

  // verified
  function listItem(ListingItem memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    verifyListingItem(_req, _signatures);
    require(_req.version == 0, "Invalid version");

    _req.state = Constants.ItemState.Listed;

    uint256 _listingId = IAdotKeeper(keeper()).getUint256(serviceId(), LISTING_ID_COUNTER_KEY);
    bytes memory listingId = abi.encode(LISTING_SPOT_ITEM_PREFIX, _listingId);

    IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_req));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(LISTED_SPOT_ITEM_KEY),
      '["uint256 id","tuple(uint8 state,address lister,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof,bytes data) runtime,uint256 version,uint256 nonce) item"]',
      abi.encode(_listingId, _req)
    );

    IAdotKeeper(keeper()).setUint256(serviceId(), LISTING_ID_COUNTER_KEY, _listingId + 1);
    IAdotKeeper(keeper()).increaseNonce(serviceId(), _req.lister);
  }

  function updateListing(uint256 _id, ListingItem memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    verifyListingItem(_req, _signatures);

    bytes memory listingId = abi.encode(LISTING_SPOT_ITEM_PREFIX, _id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));
    require(_listingItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_listingItem.lister == _req.lister, "Invalid lister");
    require(_listingItem.version + 1 == _req.version, "Invalid version");

    _listingItem.runtime = _req.runtime;
    _listingItem.nonce = _req.nonce;
    _listingItem.version = _req.version;

    IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_listingItem));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(UPDATED_LISTING_SPOT_ITEM_KEY),
      '["uint256 id","tuple(uint8 state,address lister,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof,bytes data) runtime,uint256 version,uint256 nonce) item"]',
      abi.encode(_id, _listingItem)
    );
    IAdotKeeper(keeper()).increaseNonce(serviceId(), _req.lister);
  }

  // verified
  function cancelListing(CancelListing memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    bytes memory listingId = abi.encode(LISTING_SPOT_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = verifyCancelListingItem(_req, _signatures);

    _listingItem.state = Constants.ItemState.Cancelled;
    IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_listingItem));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(CANCELLED_SPOT_ITEM_KEY),
      '["tuple(address caller,uint256 id) item","tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof,bytes data) runtime"]',
      abi.encode(_req, _listingItem.runtime)
    );
  }

  // verified
  function fullfillItem(FulfillItem memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    bytes memory listingId = abi.encode(LISTING_SPOT_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = verifyFulfillListingItem(_req, _signatures);

    for (uint256 i; i < _listingItem.distributions.length; i++) {
      IAdotKeeper(keeper()).transferTokenBetween(
        serviceId(), //
        _listingItem.runtime.itemType,
        _listingItem.runtime.paymentToken,
        0,
        (_listingItem.runtime.price * _listingItem.distributions[i].percentage) / Constants.PERCENTAGE_BASE,
        _req.buyer, // from
        _listingItem.distributions[i].recipient
      );
    }

    for (uint256 i; i < _listingItem.items.length; i++) {
      IAdotKeeper(keeper()).transferTokenBetween(
        serviceId(), //
        _listingItem.items[i].itemType,
        _listingItem.items[i].token,
        _listingItem.items[i].id,
        _listingItem.items[i].amount,
        _listingItem.lister, // from
        _req.buyer
      );
    }

    _listingItem.state = Constants.ItemState.Fulfilled;
    IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_listingItem));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(FULFILLED_SPOT_ITEM_KEY),
      '["tuple(address buyer,uint256 id,uint256 version) item","tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof,bytes data) runtime"]',
      abi.encode(_req, _listingItem.runtime)
    );
  }

  function verifyListingItem(ListingItem memory _req, bytes[] calldata _signatures) public view {
    require(_req.state == Constants.ItemState.None, "Invalid state");
    require(_req.items.length > 0, "Invalid items");
    require(_req.distributions.length > 0, "Invalid distributions");
    (address lister, bool isLister) = verifyListingRequest(_req, _signatures);
    require(isLister, "Invalid lister signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    // check token type
    // check owner of token item
    for (uint256 i; i < _req.items.length; i++) {
      checkSupportTradeableTokenItem(_req.items[i].itemType);

      require(
        getOwnerByTokenAndType(
          _req.items[i].itemType, //
          _req.items[i].token,
          _req.items[i].id,
          _req.items[i].amount,
          _req.lister
        ) == lister,
        "Invalid owner or not enough balance"
      );

      require(
        getAllowanceByTokenAndType(
          _req.items[i].itemType, //
          _req.items[i].token,
          _req.lister,
          keeper()
        ) >= _req.items[i].amount,
        "Not enough allowance"
      );
    }

    // check allowance
    uint256 totalPercentage = 0;
    for (uint256 i; i < _req.distributions.length; i++) {
      require(_req.distributions[i].recipient != address(0), "Invalid recipient");
      totalPercentage += _req.distributions[i].percentage;
    }
    {
      checkSupportPayableTokenItem(_req.runtime.itemType, _req.runtime.paymentToken);
      require(totalPercentage == Constants.PERCENTAGE_BASE, "Invalid percentage");
      require(_req.runtime.price > 0, "Invalid price");
      require(_req.runtime.startTime < _req.runtime.endTime, "Invalid time range");
      require(_req.runtime.endTime > block.timestamp, "Invalid end time");
    }
  }

  function verifyCancelListingItem(CancelListing memory _req, bytes[] calldata _signatures) public view returns (ListingItem memory) {
    (address caller, bool isLister) = verifyCancelingRequest(_req, _signatures);
    require(isLister, "Invalid caller signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    bytes memory listingId = abi.encode(LISTING_SPOT_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));
    require(_listingItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_listingItem.lister == caller || isSystemVerifier(caller), "Invalid lister");

    return _listingItem;
  }

  function verifyFulfillListingItem(FulfillItem memory _req, bytes[] calldata _signatures) public view returns (ListingItem memory) {
    (, bool isBuyer) = verifyFullfillRequest(_req, _signatures);
    require(isBuyer, "Invalid buyer signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    bytes memory listingId = abi.encode(LISTING_SPOT_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));
    require(_listingItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_listingItem.runtime.startTime < block.timestamp, "Not started");
    require(_listingItem.runtime.endTime > block.timestamp, "Already ended");
    require(_listingItem.version == _req.version, "Version mismatch");

    return _listingItem;
  }

  // verified
  function verifyListingRequest(ListingItem memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    require(IAdotKeeper(keeper()).getNonce(serviceId(), _req.lister) == _req.nonce, "Invalid nonce");
    address user = _hashTypedDataV4Custom(hash(_req)).recover(_signatures[0]);
    return (user, user == _req.lister);
  }

  // verified
  function verifyCancelingRequest(CancelListing memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    bytes32 structHash = keccak256("CancelListing(address caller,uint256 id)");
    address user = _hashTypedDataV4Custom(keccak256(abi.encode(structHash, _req.caller, _req.id))).recover(_signatures[0]);
    return (user, user == _req.caller || isSystemVerifier(user));
  }

  // verified
  function verifyFullfillRequest(FulfillItem memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    bytes32 structHash = keccak256("FulfillItem(address buyer,uint256 id,uint256 version)");
    address user = _hashTypedDataV4Custom(keccak256(abi.encode(structHash, _req.buyer, _req.id, _req.version))).recover(_signatures[0]);
    return (user, user == _req.buyer);
  }

  // verified
  function hash(ListingItem memory _req) internal pure returns (bytes32) {
    // array
    bytes32 structHash = keccak256("ListingItem(uint8 state,address lister,TokenItem[] items,Distribution[] distributions,Runtime runtime,uint256 version,uint256 nonce)Distribution(address recipient,uint256 percentage)Runtime(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof,bytes data)TokenItem(uint8 itemType,address token,uint256 id,uint256 amount)");
    bytes32[] memory encodedItems = new bytes32[](_req.items.length);
    for (uint256 i; i < _req.items.length; i++) {
      encodedItems[i] = hash(_req.items[i]);
    }

    bytes32[] memory encodedDistributions = new bytes32[](_req.distributions.length);
    for (uint256 i; i < _req.distributions.length; i++) {
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
          _req.version,
          _req.nonce
        )
      );
  }

  // verified
  function hash(TokenItem memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("TokenItem(uint8 itemType,address token,uint256 id,uint256 amount)");
    return keccak256(abi.encode(structHash, _req.itemType, _req.token, _req.id, _req.amount));
  }

  // verified
  function hash(Distribution memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("Distribution(address recipient,uint256 percentage)");
    return
      keccak256(
        abi.encode(
          structHash, //
          _req.recipient,
          _req.percentage
        )
      );
  }

  // verified
  function hash(Runtime memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("Runtime(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof,bytes data)");
    return
      keccak256(
        abi.encode(
          structHash, //
          _req.itemType,
          _req.paymentToken,
          _req.price,
          _req.startTime,
          _req.endTime,
          _req.whitelistProof,
          keccak256(_req.data)
        )
      );
  }
}
