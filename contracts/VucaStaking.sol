// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract PellarStaking is Ownable {
  // Staking of user
  struct Staking {
    uint256 amount;
    uint256 accumulatedRewards;
    uint256 minusRewards; // rewards that user can not get computed by passed block
  }

  // Staking pool
  struct Pool {
    bool inited;
    address rewardToken; // require init
    address stakeToken; // require init
    uint256 maxStakeTokens; // require init
    uint256 startBlock; // require init
    uint256 endBlock; // require init
    uint256 rewardTokensPerBlock; // require init
    uint256 tokensStaked;
    uint256 lastRewardedBlock; // require init
    uint256 accumulatedRewardsPerShare;
  }

  uint256 public constant REWARDS_PRECISION = 1e18;

  uint256 public currentPoolId;

  mapping(uint256 => Pool) public pools; // staking events

  // Mapping poolId => user address => Staking
  mapping(uint256 => mapping(address => Staking)) public stakingUsersInfo;

  // Events
  event Deposit(address indexed user, uint256 indexed poolId, Pool pool, Staking staking);
  event Withdraw(address indexed user, uint256 indexed poolId, Pool pool, Staking staking);
  event PoolUpdated(uint256 poolId, Pool pool);

  // Constructor
  constructor() {}

  /* View */
  function getRawRewards(uint256 _poolId, address _account) public view returns (uint256) {
    Staking memory staking = stakingUsersInfo[_poolId][_account];

    (uint256 accumulatedRewardsPerShare, ) = getPoolRewardsCheckpoint(_poolId);

    return staking.accumulatedRewards + (staking.amount * accumulatedRewardsPerShare) - staking.minusRewards;
  }

  function getRewards(uint256 _poolId, address _account) public view returns (uint256) {
    uint256 rawRewrads = getRawRewards(_poolId, _account);
    Pool memory pool = pools[_poolId];

    return rawRewrads / (10**IERC20(pool.stakeToken).decimals()) / REWARDS_PRECISION;
  }

  /* User */
  function stake(uint256 _poolId, uint256 _amount) external {
    Pool storage pool = pools[_poolId];
    require(pool.startBlock <= block.number, "Staking inactive");
    require(pool.endBlock >= block.number, "Staking ended");
    require(_amount > 0, "Invalid amount");
    require(_amount + pool.tokensStaked <= pool.maxStakeTokens, "Exceed max stake tokens");

    Staking storage staking = stakingUsersInfo[_poolId][msg.sender];

    updatePoolRewards(_poolId);

    // update user
    staking.accumulatedRewards = getRawRewards(_poolId, msg.sender);
    staking.amount += _amount;
    staking.minusRewards = staking.amount * pool.accumulatedRewardsPerShare;

    // Update pool
    pool.tokensStaked += _amount;

    // Deposit tokens
    emit Deposit(msg.sender, _poolId, pool, staking);
    IERC20(pool.stakeToken).transferFrom(address(msg.sender), address(this), _amount);
  }

  function emergencyWithdraw(uint256 _poolId) external {
    Pool storage pool = pools[_poolId];
    Staking storage staking = stakingUsersInfo[_poolId][msg.sender];
    uint256 amount = staking.amount;
    require(staking.amount > 0, "Insufficient funds");

    updatePoolRewards(_poolId);

    // Update pool
    if (pool.tokensStaked >= amount) {
      pool.tokensStaked -= amount;
    }

    // Withdraw tokens
    IERC20(pool.stakeToken).transfer(address(msg.sender), amount);

    emit Withdraw(msg.sender, _poolId, pool, staking);
    
    // Update staker
    staking.accumulatedRewards = 0;
    staking.minusRewards = 0;
    staking.amount = 0;
  }

  function unStake(uint256 _poolId) external {
    Pool storage pool = pools[_poolId];
    require(pool.endBlock <= block.number, "Staking active");

    Staking storage staking = stakingUsersInfo[_poolId][msg.sender];
    uint256 amount = staking.amount;
    require(staking.amount > 0, "Insufficient funds");

    updatePoolRewards(_poolId);

    // Pay rewards
    uint256 rewards = getRewards(_poolId, msg.sender);
    IERC20(pool.rewardToken).transfer(msg.sender, rewards);

    // Update pool
    if (pool.tokensStaked >= amount) {
      pool.tokensStaked -= amount;
    }

    // Withdraw tokens
    IERC20(pool.stakeToken).transfer(address(msg.sender), amount);

    emit Withdraw(msg.sender, _poolId, pool, staking);

    // Update staker
    staking.accumulatedRewards = 0;
    staking.minusRewards = 0;
    staking.amount = 0;
  }

  function updatePoolRewards(uint256 _poolId) internal {
    Pool storage pool = pools[_poolId];

    (pool.accumulatedRewardsPerShare, pool.lastRewardedBlock) = getPoolRewardsCheckpoint(_poolId);
  }

  function getPoolRewardsCheckpoint(uint256 _poolId) internal view returns (uint256 accumulatedRewardsPerShare, uint256 lastRewardedBlock) {
    Pool memory pool = pools[_poolId];

    uint256 floorBlock = block.number <= pool.endBlock ? block.number : pool.endBlock;

    uint256 blocksSinceLastReward = floorBlock - pool.lastRewardedBlock;
    uint256 rewards = blocksSinceLastReward * pool.rewardTokensPerBlock;
    if (pool.tokensStaked > 0) {
      accumulatedRewardsPerShare = pool.accumulatedRewardsPerShare + (rewards / pool.tokensStaked);
    }
    lastRewardedBlock = floorBlock;
  }

  /* Admin */
  function createPool(
    address _rewardToken,
    address _stakeToken,
    uint256 _maxStakeTokens,
    uint256 _startBlock,
    uint256 _endBlock,
    uint256 _rewardTokensPerBlock
  ) external onlyOwner {
    require(_startBlock > 0 && _startBlock < _endBlock, "Invalid start/end block");
    require(_rewardToken != address(0), "Invalid reward token");
    require(_stakeToken != address(0), "Invalid reward token");

    Pool storage pool = pools[currentPoolId];
    pool.inited = true;
    pool.rewardToken = _rewardToken;
    pool.stakeToken = _stakeToken;

    pool.maxStakeTokens = _maxStakeTokens;
    pool.startBlock = _startBlock;
    pool.endBlock = _endBlock;

    pool.rewardTokensPerBlock = _rewardTokensPerBlock * (10**IERC20(_stakeToken).decimals()) * REWARDS_PRECISION;
    pool.lastRewardedBlock = _startBlock;

    emit PoolUpdated(currentPoolId, pool);
    currentPoolId += 1;
  }

  function updateRewardTokensPerBlock(uint256 _poolId, uint256 _rewardTokensPerBlock) external onlyOwner {
    require(pools[_poolId].inited, "Invalid Pool");

    updatePoolRewards(_poolId);
    pools[_poolId].rewardTokensPerBlock = _rewardTokensPerBlock * (10**IERC20(pools[_poolId].stakeToken).decimals()) * REWARDS_PRECISION;
    emit PoolUpdated(_poolId, pools[_poolId]);
  }

  function updateEndBlock(uint256 _poolId, uint256 _endBlock) external onlyOwner {
    require(pools[_poolId].inited, "Invalid Pool");
    require(block.timestamp <= _endBlock, "Invalid input");

    // change after 8 hours - TODO
    pools[_poolId].endBlock = _endBlock;
    emit PoolUpdated(_poolId, pools[_poolId]);
  }

  function failureWithdrawERC20(
    address _to,
    address _contract,
    uint256 _amount
  ) external onlyOwner {
    IERC20(_contract).transfer(_to, _amount);
  }
}

interface IERC20 {
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) external returns (bool);

  function transfer(address to, uint256 amount) external returns (bool);

  function decimals() external view returns (uint8);
}
