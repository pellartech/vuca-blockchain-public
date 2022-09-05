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

  //
  struct PoolChanges {
    bool applied;
    uint256 maxStakeTokens;
    uint256 endBlock;
    uint256 rewardTokensPerBlock;
    uint256 timestamp;
    uint256 blockNumber;
  }

  uint256 public constant REWARDS_PRECISION = 1e18;

  uint32 public constant UPDATE_DELAY = 8 hours;

  uint256 public currentPoolId;

  mapping(uint256 => Pool) public pools; // staking events

  // Mapping poolId =>
  mapping(uint256 => PoolChanges[]) public poolsChanges; // staking changes queue

  // Mapping poolId => user address => Staking
  mapping(uint256 => mapping(address => Staking)) public stakingUsersInfo;

  // Events
  event StakingChange(address indexed user, uint256 indexed poolId, Pool pool, Staking staking);
  event PoolUpdated(uint256 poolId, Pool pool, uint256 activeTime);

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
    Pool memory pool = getLatestPoolInfo(_poolId);

    return rawRewrads / (10**IERC20(pool.stakeToken).decimals()) / REWARDS_PRECISION;
  }

  /* User */
  function stake(uint256 _poolId, uint256 _amount) external {
    updatePoolInfo(_poolId);
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
    emit StakingChange(msg.sender, _poolId, pool, staking);
    IERC20(pool.stakeToken).transferFrom(address(msg.sender), address(this), _amount);
  }

  function emergencyWithdraw(uint256 _poolId) external {
    updatePoolInfo(_poolId);
    Pool storage pool = pools[_poolId];
    Staking storage staking = stakingUsersInfo[_poolId][msg.sender];
    uint256 amount = staking.amount;
    require(staking.amount > 0, "Insufficient funds");

    updatePoolRewards(_poolId);

    // Update pool
    if (pool.tokensStaked >= amount) {
      pool.tokensStaked -= amount;
    }

    staking.amount = 0;

    // Withdraw tokens
    IERC20(pool.stakeToken).transfer(address(msg.sender), amount);

    emit StakingChange(msg.sender, _poolId, pool, staking);

    // Update staker
    staking.accumulatedRewards = 0;
    staking.minusRewards = 0;
  }

  function unStake(uint256 _poolId) external {
    updatePoolInfo(_poolId);
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

    emit StakingChange(msg.sender, _poolId, pool, staking);

    // Update staker
    staking.accumulatedRewards = 0;
    staking.minusRewards = 0;
    staking.amount = 0;
  }

  function getLatestChange(uint256 _poolId)
    internal
    view
    returns (
      bool exists,
      uint256 index,
      PoolChanges memory
    )
  {
    uint256 size = poolsChanges[_poolId].length;
    if (size == 0) {
      return (
        false,
        0,
        PoolChanges({
          applied: false,
          rewardTokensPerBlock: 0, //
          endBlock: 0,
          maxStakeTokens: 0,
          timestamp: 0,
          blockNumber: 0
        })
      );
    }
    return (true, size - 1, poolsChanges[_poolId][size - 1]);
  }

  function updatePoolInfo(uint256 _poolId) internal {
    (bool exists, uint256 index, PoolChanges memory changes) = getLatestChange(_poolId);
    if (
      !exists || //
      changes.applied ||
      block.timestamp < (changes.timestamp + UPDATE_DELAY) ||
      changes.blockNumber > pools[_poolId].endBlock
    ) {
      return;
    }

    pools[_poolId].maxStakeTokens = changes.maxStakeTokens;
    pools[_poolId].endBlock = changes.endBlock;
    pools[_poolId].rewardTokensPerBlock = changes.rewardTokensPerBlock;

    poolsChanges[_poolId][index].applied = true;

    updatePoolRewards(_poolId);
  }

  function getLatestPoolInfo(uint256 _poolId) public view returns (Pool memory) {
    Pool memory pool = pools[_poolId];

    (bool exists, , PoolChanges memory changes) = getLatestChange(_poolId);
    if (
      !exists || //
      changes.applied ||
      block.timestamp < (changes.timestamp + UPDATE_DELAY) ||
      changes.blockNumber > pool.endBlock
    ) {
      return pool;
    }

    pool.maxStakeTokens = changes.maxStakeTokens;
    pool.endBlock = changes.endBlock;
    pool.rewardTokensPerBlock = changes.rewardTokensPerBlock;
    return pool;
  }

  function updatePoolRewards(uint256 _poolId) internal {
    Pool storage pool = pools[_poolId];

    (pool.accumulatedRewardsPerShare, pool.lastRewardedBlock) = getPoolRewardsCheckpoint(_poolId);
  }

  function getPoolRewardsCheckpoint(uint256 _poolId) internal view returns (uint256 accumulatedRewardsPerShare, uint256 lastRewardedBlock) {
    Pool memory pool = getLatestPoolInfo(_poolId);

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

    pools[currentPoolId].inited = true;
    pools[currentPoolId].rewardToken = _rewardToken;
    pools[currentPoolId].stakeToken = _stakeToken;

    pools[currentPoolId].maxStakeTokens = _maxStakeTokens;
    pools[currentPoolId].startBlock = _startBlock;
    pools[currentPoolId].endBlock = _endBlock;

    pools[currentPoolId].rewardTokensPerBlock = _rewardTokensPerBlock * (10**IERC20(_stakeToken).decimals()) * REWARDS_PRECISION;
    pools[currentPoolId].lastRewardedBlock = _startBlock;

    emit PoolUpdated(currentPoolId, pools[currentPoolId], block.number);
    currentPoolId += 1;
  }

  function updateMaxStakeTokens(uint256 _poolId, uint256 _maxStakeTokens) external onlyOwner {
    require(pools[_poolId].inited, "Invalid Pool");

    poolsChanges[_poolId].push(
      PoolChanges({
        applied: false,
        rewardTokensPerBlock: pools[_poolId].rewardTokensPerBlock, //
        endBlock: pools[_poolId].endBlock,
        maxStakeTokens: _maxStakeTokens,
        timestamp: block.timestamp,
        blockNumber: block.number
      })
    );

    emit PoolUpdated(_poolId, pools[_poolId], block.number + UPDATE_DELAY);
  }

  function updateRewardTokensPerBlock(uint256 _poolId, uint256 _rewardTokensPerBlock) external onlyOwner {
    require(pools[_poolId].inited, "Invalid Pool");

    updatePoolInfo(_poolId);

    uint256 rewardTokensPerBlock = _rewardTokensPerBlock * (10**IERC20(pools[_poolId].stakeToken).decimals()) * REWARDS_PRECISION;

    poolsChanges[_poolId].push(
      PoolChanges({
        applied: false,
        rewardTokensPerBlock: rewardTokensPerBlock, //
        endBlock: pools[_poolId].endBlock,
        maxStakeTokens: pools[_poolId].maxStakeTokens,
        timestamp: block.timestamp,
        blockNumber: block.number
      })
    );

    emit PoolUpdated(_poolId, pools[_poolId], block.number + UPDATE_DELAY);
  }

  function updateEndBlock(uint256 _poolId, uint256 _endBlock) external onlyOwner {
    require(pools[_poolId].inited, "Invalid Pool");
    require(block.timestamp <= _endBlock, "Invalid input");

    poolsChanges[_poolId].push(
      PoolChanges({
        applied: false,
        rewardTokensPerBlock: pools[_poolId].rewardTokensPerBlock, //
        endBlock: _endBlock,
        maxStakeTokens: pools[_poolId].maxStakeTokens,
        timestamp: block.timestamp,
        blockNumber: block.number
      })
    );

    emit PoolUpdated(_poolId, pools[_poolId], block.number + UPDATE_DELAY);
  }

  function failureWithdrawERC20(
    uint256 _poolId,
    address _to,
    address _contract,
    uint256 _amount
  ) external onlyOwner {
    Pool memory pool = getLatestPoolInfo(_poolId);
    require(pool.endBlock <= block.number, "Staking active");

    uint256 totalUserRewardsRemaning = pool.tokensStaked * pool.accumulatedRewardsPerShare;

    require(_amount + totalUserRewardsRemaning <= IERC20(_contract).balanceOf(address(this)));

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

  function balanceOf(address account) external view returns (uint256);
}
