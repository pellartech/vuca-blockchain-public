// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

library Constants {
  enum TokenItemType {
    Native,
    ERC20,
    ERC721,
    ERC1155
  }

  enum ItemState {
    None,
    Listed,
    Fulfilled,
    Cancelled
  }

  uint256 public constant PERCENTAGE_BASE = 10000;

  bytes32 public constant ADOT_KEEPER_ID = keccak256("AdotKeeper");
  bytes32 public constant LISTING_ENGLISH_AUCTION_ID = keccak256("ListingEnglishAuction");
  bytes32 public constant LISTING_SPOT_ID = keccak256("ListingSpot");
  bytes32 public constant NORMAL_OFFER_ID = keccak256("NormalOffer");
  bytes32 public constant COLLECTION_OFFER_ID = keccak256("CollectionOffer");
  bytes32 public constant ADOT_ROUTER_ID = keccak256("AdotRouter");
}
