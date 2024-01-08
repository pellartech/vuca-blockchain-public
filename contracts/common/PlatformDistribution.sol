// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

// reentrancy
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PlatformDistribution is ReentrancyGuard {
  using SafeERC20 for IERC20;

  struct Distribution {
    address to;
    uint256 amount;
  }

  // variables
  mapping(bytes32 => bool) public executed;

  // events
  event Executed(bytes32 indexed _id);

  function chargeTokens(
    bytes32 _id, //
    address _token, //
    Distribution[] memory _distributions,
    uint256 _milestone
  ) public payable nonReentrant {
    bytes32 hashed = keccak256(abi.encode(_token, keccak256(abi.encode(_distributions)), _milestone));
    require(hashed == _id, "PlatformDistribution: invalid id");
    require(!executed[_id], "PlatformDistribution: already executed");

    executed[_id] = true;

    if (_token == address(0)) {
      _chargeNativeToken(msg.sender, _distributions);
    } else {
      _chargeERC20Token(msg.sender, _token, _distributions);
    }

    emit Executed(_id);
  }

  function _chargeNativeToken(address _from, Distribution[] memory _distributions) internal {
    uint256 totalAmount = 0;
    for (uint256 i = 0; i < _distributions.length; i++) {
      Distribution memory distribution = _distributions[i];

      (bool success, ) = distribution.to.call{ value: distribution.amount }("");
      if (!success) {
        (bool cashback, ) = _from.call{ value: distribution.amount }("");
        require(cashback, "PlatformDistribution: chargeNativeToken cashback failed");
      }

      totalAmount += distribution.amount;
    }

    require(totalAmount == msg.value, "PlatformDistribution: chargeNativeToken totalAmount != msg.value");
  }

  function _chargeERC20Token(
    address _from, //
    address _token,
    Distribution[] memory _distributions
  ) internal {
    require(msg.value == 0, "PlatformDistribution: chargeERC20Token msg.value should be 0");
    for (uint256 i = 0; i < _distributions.length; i++) {
      Distribution memory distribution = _distributions[i];

      IERC20(_token).safeTransferFrom(_from, distribution.to, distribution.amount);
    }
  }
}
