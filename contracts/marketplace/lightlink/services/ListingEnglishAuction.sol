// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BaseService.sol";

contract ListingEnglishAuction is BaseAdotService {
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
    uint256 price; // reverse auction
    uint256 minimumIncrement;
    uint256 startTime;
    uint256 endTime;
    uint256 windowTime;
    bytes32 whitelistProof;
    bytes data;
  }

  struct ListingItem {
    Constants.ItemState state;
    address lister;
    TokenItem[] items;
    Distribution[] distributions;
    Runtime runtime;
    uint256 nonce;
  }

  struct CancelListing {
    address caller;
    uint256 id;
  }

  struct LatestBid {
    address bidder;
    uint256 price;
  }

  struct BidItem {
    address bidder;
    uint256 id;
    uint256 price;
  }

  struct FulfillItem {
    address caller;
    uint256 id;
  }

  bytes public constant LISTING_ID_COUNTER_KEY = "LISTING_ID_COUNTER";
  bytes public constant BIDDING_ID_COUNTER_KEY = "BIDDING_ID_COUNTER";
  bytes public constant LISTING_ENGLISH_AUCTION_ITEM_PREFIX = "LISTING_ENGLISH_AUCTION_ITEM_";
  bytes public constant LISTED_ENGLISH_AUCTION_ITEM_KEY = "LISTED_ENGLISH_AUCTION_ITEM";
  bytes public constant UPDATED_LISTING_ENGLISH_AUCTION_ITEM_KEY = "UPDATED_LISTING_ENGLISH_AUCTION_ITEM";
  bytes public constant TIME_EXTENDED_ENGLISH_AUCTION_ITEM_KEY = "TIME_EXTENDED_ENGLISH_AUCTION_ITEM";
  bytes public constant BIDED_ENGLISH_AUCTION_ITEM_KEY = "BIDED_ENGLISH_AUCTION_ITEM_KEY";
  bytes public constant CANCELLED_ENGLISH_AUCTION_ITEM_KEY = "CANCELLED_ENGLISH_AUCTION_ITEM";
  bytes public constant FULFILLED_ENGLISH_AUCTION_ITEM_KEY = "FULFILLED_ENGLISH_AUCTION_ITEM";

  bytes public constant LATEST_BID_ITEM_PREFIX = "LATEST_BID_ITEM_";

  constructor(address _registry) BaseAdotService(_registry) {}

  function serviceId() public pure override returns (bytes32) {
    return Constants.LISTING_ENGLISH_AUCTION_ID;
  }

  // verified
  function listItem(ListingItem memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    verifyListingItem(_req, _signatures);

    _req.state = Constants.ItemState.Listed;

    for (uint256 i = 0; i < _req.items.length; i++) {
      IAdotKeeper(keeper()).transferTokenBetween(
        serviceId(), //
        _req.items[i].itemType,
        _req.items[i].token,
        _req.items[i].id,
        _req.items[i].amount,
        _req.lister, // from
        keeper()
      );
    }

    uint256 _listingId = IAdotKeeper(keeper()).getUint256(serviceId(), LISTING_ID_COUNTER_KEY);
    bytes memory listingId = abi.encode(LISTING_ENGLISH_AUCTION_ITEM_PREFIX, _listingId);

    IAdotKeeper(keeper()).setBytes(serviceId(), abi.encode(LATEST_BID_ITEM_PREFIX, _listingId), abi.encode(LatestBid({ bidder: address(0), price: _req.runtime.price })));

    IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_req));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(LISTED_ENGLISH_AUCTION_ITEM_KEY),
      '["uint256 id","tuple(uint8 state,address lister,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof,bytes data) runtime,uint256 nonce) item"]',
      abi.encode(_listingId, _req)
    );

    IAdotKeeper(keeper()).setUint256(serviceId(), LISTING_ID_COUNTER_KEY, _listingId + 1);
    IAdotKeeper(keeper()).increaseNonce(serviceId(), _req.lister);
  }

  function updateListing(uint256 _id, ListingItem memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    verifyListingItem(_req, _signatures);

    bytes memory listingId = abi.encode(LISTING_ENGLISH_AUCTION_ITEM_PREFIX, _id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));
    require(_listingItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_listingItem.lister == _req.lister, "Invalid lister");
    bytes memory latestBidId = abi.encode(LATEST_BID_ITEM_PREFIX, _id);
    LatestBid memory _latestBid = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), latestBidId), (LatestBid));
    require(_latestBid.bidder == address(0), "Invalid bid");

    _listingItem.runtime = _req.runtime;
    _listingItem.nonce = _req.nonce;

    IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_listingItem));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(UPDATED_LISTING_ENGLISH_AUCTION_ITEM_KEY),
      '["uint256 id","tuple(uint8 state,address lister,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof,bytes data) runtime,uint256 nonce) item"]',
      abi.encode(_id, _listingItem)
    );
    IAdotKeeper(keeper()).increaseNonce(serviceId(), _req.lister);
  }

  function bidItem(BidItem memory _req, bytes[] calldata _signatures) external nonReentrant {
    _beforeExecute();
    verifyBiddingItem(_req, _signatures);

    bytes memory listingId = abi.encode(LISTING_ENGLISH_AUCTION_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));

    bytes memory latestBidId = abi.encode(LATEST_BID_ITEM_PREFIX, _req.id);
    LatestBid memory _latestBid = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), latestBidId), (LatestBid));

    if (_latestBid.bidder != address(0)) {
      IAdotKeeper(keeper()).tranferERC20Out(
        serviceId(), //
        _listingItem.runtime.paymentToken,
        _latestBid.bidder,
        _latestBid.price
      );
    }

    IAdotKeeper(keeper()).transferTokenBetween(
      serviceId(), //
      _listingItem.runtime.itemType,
      _listingItem.runtime.paymentToken,
      0,
      _req.price,
      _req.bidder, // from
      keeper()
    );

    {
      uint256 _biddingId = IAdotKeeper(keeper()).getUint256(serviceId(), abi.encode(BIDDING_ID_COUNTER_KEY, _req.id));
      IAdotKeeper(keeper()).setBytes(serviceId(), latestBidId, abi.encode(LatestBid({ bidder: _req.bidder, price: _req.price })));
      IAdotKeeper(keeper()).emitEvent(
        serviceId(), //
        keccak256(BIDED_ENGLISH_AUCTION_ITEM_KEY),
        '["uint256 id","tuple(address bidder,uint256 id,uint256 price) latestBid","tuple(address oldBidder,uint256 oldPrice) oldBid","tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof,bytes data) runtime"]',
        abi.encode(_biddingId, _req, _latestBid, _listingItem.runtime)
      );
      IAdotKeeper(keeper()).setUint256(serviceId(), abi.encode(BIDDING_ID_COUNTER_KEY, _req.id), _biddingId + 1);
    }

    if (_listingItem.runtime.windowTime > 0 && _listingItem.runtime.windowTime + block.timestamp > _listingItem.runtime.endTime) {
      _listingItem.runtime.endTime = _listingItem.runtime.windowTime + _listingItem.runtime.endTime;
      IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_listingItem));

      IAdotKeeper(keeper()).emitEvent(
        serviceId(), //
        keccak256(TIME_EXTENDED_ENGLISH_AUCTION_ITEM_KEY),
        '["uint256 id","uint256 endTime"]',
        abi.encode(_req.id, _listingItem.runtime.endTime)
      );
    }
  }

  // verified
  function cancelListing(CancelListing memory _req, bytes[] calldata _signatures) external nonReentrant {
    _beforeExecute();
    verifyCancelListingItem(_req, _signatures);

    bytes memory listingId = abi.encode(LISTING_ENGLISH_AUCTION_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));

    _listingItem.state = Constants.ItemState.Cancelled;

    bytes memory latestBidId = abi.encode(LATEST_BID_ITEM_PREFIX, _req.id);
    LatestBid memory _latestBid = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), latestBidId), (LatestBid));
    require(_latestBid.bidder == address(0), "Already bidded");
    for (uint256 i = 0; i < _listingItem.items.length; i++) {
      IAdotKeeper(keeper()).transferTokenBetween(
        serviceId(), //
        _listingItem.items[i].itemType,
        _listingItem.items[i].token,
        _listingItem.items[i].id,
        _listingItem.items[i].amount,
        keeper(), // from
        _listingItem.lister
      );
    }

    IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_listingItem));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(CANCELLED_ENGLISH_AUCTION_ITEM_KEY),
      '["tuple(address caller,uint256 id) item","tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof,bytes data) runtime"]',
      abi.encode(_req, _listingItem.runtime)
    );
  }

  function fullfillItem(FulfillItem memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    verifyFulfilListingItem(_req, _signatures);

    bytes memory listingId = abi.encode(LISTING_ENGLISH_AUCTION_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));

    bytes memory latestBidId = abi.encode(LATEST_BID_ITEM_PREFIX, _req.id);
    LatestBid memory _latestBid = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), latestBidId), (LatestBid));
    for (uint256 i = 0; i < _listingItem.distributions.length; i++) {
      IAdotKeeper(keeper()).tranferERC20Out(
        serviceId(), //
        _listingItem.runtime.paymentToken,
        _listingItem.distributions[i].recipient,
        (_latestBid.price * _listingItem.distributions[i].percentage) / Constants.PERCENTAGE_BASE
      );
    }

    for (uint256 i = 0; i < _listingItem.items.length; i++) {
      IAdotKeeper(keeper()).transferTokenBetween(
        serviceId(), //
        _listingItem.items[i].itemType,
        _listingItem.items[i].token,
        _listingItem.items[i].id,
        _listingItem.items[i].amount,
        keeper(), // from
        _latestBid.bidder
      );
    }

    _listingItem.state = Constants.ItemState.Fulfilled;
    IAdotKeeper(keeper()).setBytes(serviceId(), listingId, abi.encode(_listingItem));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(FULFILLED_ENGLISH_AUCTION_ITEM_KEY),
      '["tuple(address caller,uint256 id) item","tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof,bytes data) runtime"]',
      abi.encode(_req, _listingItem.runtime)
    );
  }

  function verifyListingItem(ListingItem memory _req, bytes[] calldata _signatures) public view {
    require(_req.state == Constants.ItemState.None, "Invalid state");
    require(_req.items.length > 0, "Invalid items");
    require(_req.distributions.length > 0, "Invalid distributions");
    (, bool isLister) = verifyListingRequest(_req, _signatures);
    require(isLister, "Invalid user signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");
    checkSupportPayableTokenItem(_req.runtime.itemType, _req.runtime.paymentToken);
    // check token type
    // check owner of token item
    for (uint256 i = 0; i < _req.items.length; i++) {
      checkSupportTradeableTokenItem(_req.items[i].itemType);
    }

    // check allowance
    uint256 totalPercentage = 0;
    for (uint256 i = 0; i < _req.distributions.length; i++) {
      require(_req.distributions[i].recipient != address(0), "Invalid recipient");
      totalPercentage += _req.distributions[i].percentage;
    }
    {
      require(totalPercentage == Constants.PERCENTAGE_BASE, "Invalid percentage");
      require(_req.runtime.price > 0, "Invalid price");
      require(_req.runtime.startTime < _req.runtime.endTime, "Invalid time range");
      require(_req.runtime.endTime > block.timestamp, "Invalid end time");
    }
  }

  function verifyBiddingItem(BidItem memory _req, bytes[] calldata _signatures) public view {
    (, bool isBidder) = verifyBiddingRequest(_req, _signatures);
    require(isBidder, "Invalid bidder signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    bytes memory listingId = abi.encode(LISTING_ENGLISH_AUCTION_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));
    require(_listingItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_listingItem.runtime.startTime < block.timestamp, "Not started");
    require(_listingItem.runtime.endTime > block.timestamp, "Already ended");

    bytes memory latestBidId = abi.encode(LATEST_BID_ITEM_PREFIX, _req.id);
    LatestBid memory _latestBid = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), latestBidId), (LatestBid));
    require(_latestBid.price + _listingItem.runtime.minimumIncrement <= _req.price, "Invalid price");
  }

  function verifyCancelListingItem(CancelListing memory _req, bytes[] calldata _signatures) public view {
    (address user, bool isCaller) = verifyCancelingRequest(_req, _signatures);
    require(isCaller, "Invalid user signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    bytes memory listingId = abi.encode(LISTING_ENGLISH_AUCTION_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));
    require(_listingItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_listingItem.lister == user || isSystemVerifier(user), "Invalid lister");
  }

  function verifyFulfilListingItem(FulfillItem memory _req, bytes[] calldata _signatures) public view {
    (, bool isCaller) = verifyFullfillRequest(_req, _signatures);
    require(isCaller, "Invalid caller signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    bytes memory listingId = abi.encode(LISTING_ENGLISH_AUCTION_ITEM_PREFIX, _req.id);
    ListingItem memory _listingItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), listingId), (ListingItem));
    require(_listingItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_listingItem.runtime.endTime < block.timestamp, "Not ended");

    bytes memory latestBidId = abi.encode(LATEST_BID_ITEM_PREFIX, _req.id);
    LatestBid memory _latestBid = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), latestBidId), (LatestBid));
    require(_latestBid.bidder != address(0), "Invalid bid");
  }

  function verifyListingRequest(ListingItem memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    require(IAdotKeeper(keeper()).getNonce(serviceId(), _req.lister) == _req.nonce, "Invalid nonce");
    address user = _hashTypedDataV4Custom(hash(_req)).recover(_signatures[0]);
    return (user, user == _req.lister);
  }

  function verifyBiddingRequest(BidItem memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    bytes32 structHash = keccak256("BidItem(address bidder,uint256 id,uint256 price)");
    address user = _hashTypedDataV4Custom(keccak256(abi.encode(structHash, _req.bidder, _req.id, _req.price))).recover(_signatures[0]);
    return (user, user == _req.bidder);
  }

  function verifyCancelingRequest(CancelListing memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    bytes32 structHash = keccak256("CancelListing(address caller,uint256 id)");
    address user = _hashTypedDataV4Custom(keccak256(abi.encode(structHash, _req.caller, _req.id))).recover(_signatures[0]);
    return (user, user == _req.caller || isSystemVerifier(user));
  }

  function verifyFullfillRequest(FulfillItem memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    bytes32 structHash = keccak256("FulfillItem(address caller,uint256 id)");
    address user = _hashTypedDataV4Custom(keccak256(abi.encode(structHash, _req.caller, _req.id))).recover(_signatures[0]);
    return (user, user == _req.caller);
  }

  // verified
  function hash(ListingItem memory _req) internal pure returns (bytes32) {
    // array
    bytes32 structHash = keccak256("ListingItem(uint8 state,address lister,TokenItem[] items,Distribution[] distributions,Runtime runtime,uint256 nonce)Distribution(address recipient,uint256 percentage)Runtime(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof,bytes data)TokenItem(uint8 itemType,address token,uint256 id,uint256 amount)");
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

  // verified
  function hash(TokenItem memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("TokenItem(uint8 itemType,address token,uint256 id,uint256 amount)");
    return keccak256(abi.encode(structHash, _req.itemType, _req.token, _req.id, _req.amount));
  }

  // verified
  function hash(Distribution memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("Distribution(address recipient,uint256 percentage)");
    return keccak256(abi.encode(structHash, _req.recipient, _req.percentage));
  }

  // verified
  function hash(Runtime memory _req) internal pure returns (bytes32) {
    bytes32 structHash = keccak256("Runtime(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof,bytes data)");
    return
      keccak256(
        abi.encode(
          structHash,
          _req.itemType, //
          _req.paymentToken,
          _req.price,
          _req.minimumIncrement,
          _req.startTime,
          _req.endTime,
          _req.windowTime,
          _req.whitelistProof,
          keccak256(_req.data)
        )
      );
  }
}
