// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./BaseService.sol";

contract CollectionOffer is BaseAdotService {
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
    bytes data;
  }

  struct OfferItem {
    Constants.ItemState state;
    address offerer;
    TokenItem[] items;
    Distribution[] distributions;
    Runtime runtime;
    uint256 nonce;
  }

  struct CancelOffer {
    address caller;
    uint256 id;
  }

  struct FulfillOffer {
    address seller;
    uint256 id;
    TokenItem[] items;
    Distribution[] distributions;
    uint256 nonce;
  }

  bytes public constant COLLECTION_OFFERING_ID_COUNTER_KEY = "COLLECTION_OFFERING_ID_COUNTER";
  bytes public constant COLLECTION_OFFERING_ID_FULFILLED_COUNTER_KEY = "COLLECTION_OFFERING_ID_FULFILLED_COUNTER_KEY";
  bytes public constant COLLECTION_OFFERING_ID_FULFILLED_BY_TOKEN_KEY = "COLLECTION_OFFERING_ID_FULFILLED_BY_TOKEN_KEY";
  bytes public constant LISTING_COLLECTION_OFFER_ITEM_PREFIX = "LISTING_COLLECTION_OFFER_ITEM_";
  bytes public constant LISTED_COLLECTION_OFFER_ITEM_KEY = "LISTED_COLLECTION_OFFER_ITEM";
  bytes public constant UPDATED_COLLECTION_OFFER_ITEM_KEY = "UPDATED_COLLECTION_OFFER_ITEM";
  bytes public constant CANCELLED_COLLECTION_OFFER_ITEM_KEY = "CANCELLED_COLLECTION_OFFER_ITEM";
  bytes public constant FULFILLED_COLLECTION_OFFER_ITEM_KEY = "FULFILLED_COLLECTION_OFFER_ITEM";

  constructor(address _registry) BaseAdotService(_registry) {}

  function serviceId() public pure override returns (bytes32) {
    return Constants.COLLECTION_OFFER_ID;
  }

  // verified
  function offerItem(OfferItem memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    verifyOfferItem(_req, _signatures);

    _req.state = Constants.ItemState.Listed;

    uint256 _offerId = IAdotKeeper(keeper()).getUint256(serviceId(), COLLECTION_OFFERING_ID_COUNTER_KEY);
    bytes memory offerId = abi.encode(LISTING_COLLECTION_OFFER_ITEM_PREFIX, _offerId);

    IAdotKeeper(keeper()).setBytes(serviceId(), offerId, abi.encode(_req));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(LISTED_COLLECTION_OFFER_ITEM_KEY),
      '["uint256 id","tuple(uint8 state,address offerer,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes data) runtime,uint256 nonce) item"]',
      abi.encode(_offerId, _req)
    );

    IAdotKeeper(keeper()).setUint256(serviceId(), COLLECTION_OFFERING_ID_COUNTER_KEY, _offerId + 1);
    IAdotKeeper(keeper()).increaseNonce(serviceId(), _req.offerer);
  }

  function updateOffer(uint256 _id, OfferItem memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    verifyOfferItem(_req, _signatures);

    bytes memory offerId = abi.encode(LISTING_COLLECTION_OFFER_ITEM_PREFIX, _id);
    OfferItem memory _offerItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), offerId), (OfferItem));
    require(_offerItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_offerItem.offerer == _req.offerer, "Invalid offerer");

    _offerItem.runtime = _req.runtime;
    _offerItem.nonce = _req.nonce;

    IAdotKeeper(keeper()).setBytes(serviceId(), offerId, abi.encode(_offerItem));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(UPDATED_COLLECTION_OFFER_ITEM_KEY),
      '["uint256 id","tuple(uint8 state,address offerer,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes data) runtime,uint256 nonce) item"]',
      abi.encode(_id, _offerItem)
    );
    IAdotKeeper(keeper()).increaseNonce(serviceId(), _req.offerer);
  }

  // verified
  function cancelOffer(CancelOffer memory _req, bytes[] calldata _signatures) external {
    _beforeExecute();
    verifyCancelOfferItem(_req, _signatures);
    bytes memory offerId = abi.encode(LISTING_COLLECTION_OFFER_ITEM_PREFIX, _req.id);
    OfferItem memory _offerItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), offerId), (OfferItem));

    _offerItem.state = Constants.ItemState.Cancelled;
    IAdotKeeper(keeper()).setBytes(serviceId(), offerId, abi.encode(_offerItem));
    IAdotKeeper(keeper()).emitEvent(
      serviceId(), //
      keccak256(CANCELLED_COLLECTION_OFFER_ITEM_KEY),
      '["tuple(address caller,uint256 id) item","tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes data) runtime"]',
      abi.encode(_req, _offerItem.runtime)
    );
  }

  // verified
  function fullfillItem(FulfillOffer memory _req, bytes[] calldata _signatures) external nonReentrant {
    _beforeExecute();
    {
      verifyFulfillOfferItem(_req, _signatures);
    }

    bytes memory offerId = abi.encode(LISTING_COLLECTION_OFFER_ITEM_PREFIX, _req.id);
    OfferItem memory _offerItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), offerId), (OfferItem));

    uint256 totalPrice;
    uint256[] memory fulfilledAmounts = new uint256[](_req.items.length);
    {
      for (uint256 i = 0; i < _req.items.length; i++) {
        require(
          getOwnerByTokenAndType(
            _req.items[i].itemType, //
            _req.items[i].token,
            _req.items[i].id,
            _req.items[i].amount,
            _req.seller
          ) == _req.seller,
          "Invalid owner or not enough balance"
        );

        IAdotKeeper(keeper()).transferTokenBetween(
          serviceId(), //
          _req.items[i].itemType,
          _req.items[i].token,
          _req.items[i].id,
          _req.items[i].amount,
          _req.seller, // from
          _offerItem.offerer
        );

        bytes memory fulfilledId = abi.encode(COLLECTION_OFFERING_ID_FULFILLED_BY_TOKEN_KEY, _req.id, _req.items[i].token);
        uint256 fulfilledAmount = IAdotKeeper(keeper()).getUint256(serviceId(), fulfilledId);
        fulfilledAmount += _req.items[i].amount;
        IAdotKeeper(keeper()).setUint256(serviceId(), fulfilledId, fulfilledAmount);

        fulfilledAmounts[i] = fulfilledAmount;
        totalPrice += _req.items[i].amount * _offerItem.runtime.price;

        if (fulfilledAmount == _offerItem.items[i].amount) {
          _offerItem.state = Constants.ItemState.Fulfilled;
        }
      }
    }

    {
      for (uint256 i = 0; i < _req.distributions.length; i++) {
        IAdotKeeper(keeper()).transferTokenBetween(
          serviceId(), //
          _offerItem.runtime.itemType,
          _offerItem.runtime.paymentToken,
          0,
          (totalPrice * _req.distributions[i].percentage) / Constants.PERCENTAGE_BASE,
          _offerItem.offerer, // from
          _req.distributions[i].recipient
        );
      }
    }

    {
      IAdotKeeper(keeper()).setBytes(serviceId(), offerId, abi.encode(_offerItem));
      uint256 fulfilledCount = IAdotKeeper(keeper()).getUint256(serviceId(), abi.encode(COLLECTION_OFFERING_ID_FULFILLED_COUNTER_KEY, _req.id));
      IAdotKeeper(keeper()).emitEvent(
        serviceId(), //
        keccak256(FULFILLED_COLLECTION_OFFER_ITEM_KEY),
        '["tuple(address seller,uint256 id,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions) item","tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes data) runtime","uint256[] fulfilled","uint256 fulfilledId"]',
        abi.encode(_req, _offerItem.runtime, fulfilledAmounts, fulfilledCount)
      );
      IAdotKeeper(keeper()).setUint256(serviceId(), abi.encode(COLLECTION_OFFERING_ID_FULFILLED_COUNTER_KEY, _req.id), fulfilledCount + 1);
      IAdotKeeper(keeper()).increaseNonce(serviceId(), _req.seller);
    }
  }

  function verifyOfferItem(OfferItem memory _req, bytes[] calldata _signatures) public view {
    require(_req.state == Constants.ItemState.None, "Invalid state");
    require(_req.items.length > 0, "Invalid items");
    require(_req.distributions.length == 0, "Invalid distributions");
    (address offerer, bool isOfferer) = verifyOfferingRequest(_req, _signatures);
    require(isOfferer, "Invalid offerer signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    // check allowance
    require(
      getBalanceByTokenAndType(
        _req.runtime.itemType, //
        _req.runtime.paymentToken,
        0,
        offerer
      ) >= _req.runtime.price,
      "Not enough balance"
    );

    require(
      getAllowanceByTokenAndType(
        _req.runtime.itemType, //
        _req.runtime.paymentToken,
        offerer,
        keeper()
      ) >= _req.runtime.price,
      "Not enough allowance"
    );

    // check token type
    for (uint256 i = 0; i < _req.items.length; i++) {
      checkSupportTradeableTokenItem(_req.items[i].itemType);
    }
    checkSupportPayableTokenItem(_req.runtime.itemType, _req.runtime.paymentToken);

    require(_req.runtime.price > 0, "Invalid price");
    require(_req.runtime.startTime < _req.runtime.endTime, "Invalid time range");
    require(_req.runtime.endTime > block.timestamp, "Invalid end time");
    for (uint256 i = 0; i < _req.items.length; i++) {
      require(_req.items[i].amount > 0, "Invalid amount");
    }
  }

  function verifyCancelOfferItem(CancelOffer memory _req, bytes[] calldata _signatures) public view {
    (address offerer, bool isOfferer) = verifyCancelingRequest(_req, _signatures);
    require(isOfferer, "Invalid offerer signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    bytes memory offerId = abi.encode(LISTING_COLLECTION_OFFER_ITEM_PREFIX, _req.id);
    OfferItem memory _offerItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), offerId), (OfferItem));
    require(_offerItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_offerItem.offerer == offerer || isSystemVerifier(offerer), "Invalid offerer");
  }

  function verifyFulfillOfferItem(FulfillOffer memory _req, bytes[] calldata _signatures) public view {
    (, bool isSeller) = verifyFullfillRequest(_req, _signatures);
    require(isSeller, "Invalid seller signature");
    require(verifySystemSignature(_signatures), "Invalid system signature");

    bytes memory offerId = abi.encode(LISTING_COLLECTION_OFFER_ITEM_PREFIX, _req.id);
    OfferItem memory _offerItem = abi.decode(IAdotKeeper(keeper()).getBytes(serviceId(), offerId), (OfferItem));
    require(_offerItem.state == Constants.ItemState.Listed, "Invalid state");
    require(_offerItem.runtime.startTime < block.timestamp, "Not started");
    require(_offerItem.runtime.endTime > block.timestamp, "Already ended");
    require(_offerItem.items.length == _req.items.length, "Mismatch items");

    uint256 totalPercentage = 0;
    for (uint256 i = 0; i < _req.distributions.length; i++) {
      require(_req.distributions[i].recipient != address(0), "Invalid recipient");

      totalPercentage += _req.distributions[i].percentage;
    }
    require(totalPercentage == Constants.PERCENTAGE_BASE, "Invalid percentage");

    for (uint256 i = 0; i < _offerItem.items.length; i++) {
      require(_req.items[i].amount > 0, "Invalid amount");
      require(_offerItem.items[i].itemType == _req.items[i].itemType, "Mismatch item type");
      require(_offerItem.items[i].token == _req.items[i].token, "Mismatch token");

      bytes memory fulfilledId = abi.encode(COLLECTION_OFFERING_ID_FULFILLED_BY_TOKEN_KEY, _req.id, _req.items[i].token);
      uint256 fulfilledAmount = IAdotKeeper(keeper()).getUint256(serviceId(), fulfilledId);
      require(fulfilledAmount + _req.items[i].amount <= _offerItem.items[i].amount, "Exceed amount");
    }
  }

  function verifyOfferingRequest(OfferItem memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    require(IAdotKeeper(keeper()).getNonce(serviceId(), _req.offerer) == _req.nonce, "Invalid nonce");
    address user = _hashTypedDataV4Custom(hash(_req)).recover(_signatures[0]);
    return (user, user == _req.offerer);
  }

  function verifyCancelingRequest(CancelOffer memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    bytes32 structHash = keccak256("CancelOffer(address caller,uint256 id)");
    address user = _hashTypedDataV4Custom(keccak256(abi.encode(structHash, _req.caller, _req.id))).recover(_signatures[0]);
    return (user, user == _req.caller || isSystemVerifier(user));
  }

  function verifyFullfillRequest(FulfillOffer memory _req, bytes[] calldata _signatures) public view returns (address, bool) {
    require(IAdotKeeper(keeper()).getNonce(serviceId(), _req.seller) == _req.nonce, "Invalid nonce");
    address user = _hashTypedDataV4Custom(hash(_req)).recover(_signatures[0]);
    return (user, user == _req.seller);
  }

  function hash(FulfillOffer memory _req) internal pure returns (bytes32) {
    // array
    bytes32 structHash = keccak256("FulfillOffer(address seller,uint256 id,TokenItem[] items,Distribution[] distributions,uint256 nonce)Distribution(address recipient,uint256 percentage)TokenItem(uint8 itemType,address token,uint256 id,uint256 amount)");
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
          _req.seller,
          _req.id,
          keccak256(abi.encodePacked(encodedItems)), //
          keccak256(abi.encodePacked(encodedDistributions)),
          _req.nonce
        )
      );
  }

  // verified
  function hash(OfferItem memory _req) internal pure returns (bytes32) {
    // array
    bytes32 structHash = keccak256("OfferItem(uint8 state,address offerer,TokenItem[] items,Distribution[] distributions,Runtime runtime,uint256 nonce)Distribution(address recipient,uint256 percentage)Runtime(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes data)TokenItem(uint8 itemType,address token,uint256 id,uint256 amount)");
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
          _req.offerer,
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
    bytes32 structHash = keccak256("Runtime(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes data)");
    return
      keccak256(
        abi.encode(
          structHash, //
          _req.itemType,
          _req.paymentToken,
          _req.price,
          _req.startTime,
          _req.endTime,
          keccak256(_req.data)
        )
      );
  }
}
