import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { CWTT, CWTT__factory, VucaStaking, VucaStaking__factory, USDT, USDT__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const TEN_E_18 = ethers.utils.parseEther('1')

const totalRewards = 10 * 10 ** 6

describe('Staking', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let stakingContract: VucaStaking
  let cwtToken: CWTT
  let usdtToken: USDT

  beforeEach(async () => {
    await network.provider.send('hardhat_reset')

    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const factory = (await ethers.getContractFactory('VucaStaking', owner)) as VucaStaking__factory
    stakingContract = await factory.deploy()
    stakingContract.deployed()
    await network.provider.send('evm_mine')

    const factory1 = (await ethers.getContractFactory('CWTT', owner)) as CWTT__factory
    cwtToken = await factory1.deploy()
    cwtToken.deployed()
    await network.provider.send('evm_mine')

    const factory2 = (await ethers.getContractFactory('USDT', owner)) as USDT__factory
    usdtToken = await factory2.deploy()
    usdtToken.deployed()
    await network.provider.send('evm_mine')

    await usdtToken.connect(owner).approve(stakingContract.address, 100000 * 10 ** 6)
    await usdtToken.mint(owner.address, 100000 * 10 ** 6)
    await cwtToken.connect(bob).mint(bob.address, ethers.BigNumber.from(1000000).mul(TEN_E_18).toString())
    await cwtToken.connect(alice).mint(alice.address, ethers.BigNumber.from(1000000).mul(TEN_E_18).toString())
    await cwtToken.connect(bob).approve(stakingContract.address, ethers.BigNumber.from('10000000000000000000000000000000000000000000'))
    await cwtToken.connect(alice).approve(stakingContract.address, ethers.BigNumber.from('10000000000000000000000000000000000000000000'))
    await network.provider.send('evm_mine')
  })

  context('Test case for stake', () => {
    it('Stake single should be success', async () => {
      await stakingContract.connect(owner).createPool(
        ethers.constants.AddressZero,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        ethers.constants.AddressZero,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        0,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        15,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(14)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(totalRewards)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)
      expect(poolInfo.extension.totalPoolRewards).equal(50 * 10 ** 6)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // unStake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(14)
      expect(poolInfo.accumulatedRewardsPerShare).equal(
        ethers.BigNumber.from(4 * 10 * 10 ** 6)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
          .div(ethers.BigNumber.from(100).mul(TEN_E_18))
      )

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(40)
    })

    it('Stake single with bonus should be success', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(14)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(totalRewards)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await stakingContract.connect(bob).stake(0, 0)
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(12)
      expect(poolInfo.accumulatedRewardsPerShare).equal(
        ethers.BigNumber.from(2 * 10 * 10 ** 6)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
          .div(ethers.BigNumber.from(100).mul(TEN_E_18))
      )

      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(200).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      // unStake
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(14)
      expect(poolInfo.accumulatedRewardsPerShare).equal(
        ethers.BigNumber.from(2 * 10 * 10 ** 6)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
          .div(ethers.BigNumber.from(100).mul(TEN_E_18))
          .add(
            ethers.BigNumber.from(1 * 10 * 10 ** 6)
              .mul(TEN_E_18)
              .mul(TEN_E_18)
              .div(ethers.BigNumber.from(200).mul(TEN_E_18))
          )
          .add(
            ethers.BigNumber.from(1 * 10 * 10 ** 6)
              .mul(TEN_E_18)
              .mul(TEN_E_18)
              .div(ethers.BigNumber.from(400).mul(TEN_E_18))
          )
      )

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(40)
    })

    it('Stake middle should be success', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(14)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(totalRewards)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(50).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(12)
      expect(poolInfo.accumulatedRewardsPerShare).equal(
        ethers.BigNumber.from(2 * 10 * 10 ** 6)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
          .div(ethers.BigNumber.from(100).mul(TEN_E_18))
      )

      // unStake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).unStake(0)
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(14)
      expect(poolInfo.accumulatedRewardsPerShare).equal(
        ethers.BigNumber.from(2 * 10 * 10 ** 6)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
          .div(ethers.BigNumber.from(100).mul(TEN_E_18))
          .add(
            ethers.BigNumber.from(2 * 10 * 10 ** 6)
              .mul(TEN_E_18)
              .mul(TEN_E_18)
              .div(ethers.BigNumber.from(150).mul(TEN_E_18))
          )
      )

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(33.333333)
      expect((await usdtToken.balanceOf(alice.address)).toNumber() / 10 ** 6).equal(6.666666)
    })

    it('Stake middle with bonus should be success', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(14)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(totalRewards)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(300).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      // unStake
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).unStake(0)
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(14)
      // expect(poolInfo.accumulatedRewardsPerShare).equal(
      //   ethers.BigNumber.from(2 * 10 * (10**6))
      //     .mul(TEN_E_18)
      //     .mul(TEN_E_18)
      //     .div(ethers.BigNumber.from(100).mul(TEN_E_18))
      //     .add(
      //       ethers.BigNumber.from(2 * 10 * (10**6))
      //         .mul(TEN_E_18)
      //         .mul(TEN_E_18)
      //         .div(ethers.BigNumber.from(150).mul(TEN_E_18))
      //     )
      // )

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(29.999999)
      expect((await usdtToken.balanceOf(alice.address)).toNumber() / 10 ** 6).equal(9.999999)
    })

    it('Stake middle with bonus and withdraw emergency should be success', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(14)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(totalRewards)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(50).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).emergencyWithdraw(0)
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      // unStake
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(50).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).unStake(0)
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(14)
      // expect(poolInfo.accumulatedRewardsPerShare).equal(
      //   ethers.BigNumber.from(2 * 10 * (10**6))
      //     .mul(TEN_E_18)
      //     .mul(TEN_E_18)
      //     .div(ethers.BigNumber.from(100).mul(TEN_E_18))
      //     .add(
      //       ethers.BigNumber.from(2 * 10 * (10**6))
      //         .mul(TEN_E_18)
      //         .mul(TEN_E_18)
      //         .div(ethers.BigNumber.from(150).mul(TEN_E_18))
      //     )
      // )

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(35.238095)
      expect((await usdtToken.balanceOf(alice.address)).toNumber() / 10 ** 6).equal(1.428571)
    })

    it('Stake middle with bonus and change rewards per block should be success', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        20,
        totalRewards,
        3
      )
      await stakingContract.connect(owner).depositPoolReward(0, 20 * totalRewards)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(20)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(totalRewards)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(50).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      // fail case
      await stakingContract.connect(owner).updateRewardTokensPerBlock(1, 20 * 10 ** 6)
      await stakingContract.connect(owner).updateRewardTokensPerBlock(0, 20 * 10 ** 6)
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      // unStake
      await stakingContract.connect(owner).updateRewardTokensPerBlock(0, 5 * 10 ** 6)
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(owner).updateRewardTokensPerBlock(0, 20 * 10 ** 6)
      await network.provider.send('evm_mine')

      // const tmp = await stakingContract.getLatestPoolInfo(0)
      // console.log(tmp)

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(20)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(5 * 10 ** 6)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      // expect(poolInfo.accumulatedRewardsPerShare).equal(
      //   ethers.BigNumber.from(2 * 10 * (10**6))
      //     .mul(TEN_E_18)
      //     .mul(TEN_E_18)
      //     .div(ethers.BigNumber.from(100).mul(TEN_E_18))
      //     .add(
      //       ethers.BigNumber.from(2 * 10 * (10**6))
      //         .mul(TEN_E_18)
      //         .mul(TEN_E_18)
      //         .div(ethers.BigNumber.from(150).mul(TEN_E_18))
      //     )
      // )

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(88.380952)
      expect((await usdtToken.balanceOf(alice.address)).toNumber() / 10 ** 6).equal(16.619047)
    })

    it('retrieveReward should be success', async () => {
      await stakingContract.connect(owner).createPool(usdtToken.address, cwtToken.address, ethers.BigNumber.from(1).mul(TEN_E_18).toString(), 10, 14, 10 * 10 ** 6, 2)
      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)
      await network.provider.send('evm_mine')

      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')
    })

    // it('retrieveReward should be success', async () => {
    //   await stakingContract.connect(owner).createPool(
    //     usdtToken.address,
    //     cwtToken.address,
    //     ethers.BigNumber.from(10 ** 6)
    //       .mul(TEN_E_18)
    //       .toString(),
    //     10,
    //     14,
    //     10 * 10 ** 6,
    //     2
    //   )
    //   await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)

    //   await stakingContract.connect(owner).updateChangesDelayBlocks(1, 1)
    //   await stakingContract.connect(owner).updateChangesDelayBlocks(0, 1)

    //   await stakingContract.connect(owner).updateEndBlock(1, 1)
    //   await stakingContract.connect(owner).updateEndBlock(0, 1)
    //   await stakingContract.connect(owner).updateEndBlock(0, 14)

    //   await stakingContract.connect(owner).updateMaxStakeTokens(1, 1)
    //   await network.provider.send('evm_mine')

    //   let poolInfo = await stakingContract.pools(0)
    //   expect(poolInfo.inited).equal(true)
    //   expect(poolInfo.rewardToken).equal(usdtToken.address)
    //   expect(poolInfo.stakeToken).equal(cwtToken.address)
    //   expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
    //   expect(poolInfo.startBlock.toNumber()).equal(10)
    //   expect(poolInfo.endBlock.toNumber()).equal(14)
    //   expect(poolInfo.rewardTokensPerBlock).equal(
    //     ethers.BigNumber.from(10 * 10 ** 6)
    //       .mul(TEN_E_18)
    //       .mul(TEN_E_18)
    //   )
    //   expect(poolInfo.tokensStaked).equal(0)
    //   expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
    //   expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

    //   // for stake
    //   await network.provider.send('evm_mine')
    //   await stakingContract.connect(owner).updateMaxStakeTokens(0, 1)
    //   await network.provider.send('evm_mine')
    //   await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
    //   await network.provider.send('evm_mine')
    //   await stakingContract.connect(owner).updateMaxStakeTokens(
    //     0,
    //     ethers.BigNumber.from(10 ** 6)
    //       .mul(TEN_E_18)
    //       .toString()
    //   )
    //   await network.provider.send('evm_mine')
    //   await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
    //   await network.provider.send('evm_mine')

    //   poolInfo = await stakingContract.pools(0)
    //   expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
    //   expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

    //   await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
    //   await network.provider.send('evm_mine')

    //   await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
    //   await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(300).mul(TEN_E_18).toString())
    //   await network.provider.send('evm_mine')

    //   // unStake
    //   await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
    //   await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
    //   await network.provider.send('evm_mine')
    //   await network.provider.send('evm_mine')

    //   // console.log(Number(await stakingContract.getRewardsWithdrawable(0)))

    //   // let res = await usdtToken.balanceOf(stakingContract.address)
    //   // console.log('1', res)

    //   await stakingContract.connect(owner).retrieveReward(
    //     0, //
    //     accounts[4].address
    //   )
    //   await network.provider.send('evm_mine')

    //   // res = await usdtToken.balanceOf(stakingContract.address)
    //   // console.log('2', res)

    //   poolInfo = await stakingContract.pools(0)

    //   // console.log(poolInfo)

    //   await stakingContract.connect(bob).unStake(0)
    //   await network.provider.send('evm_mine')

    //   await stakingContract.connect(alice).unStake(0)
    //   await network.provider.send('evm_mine')

    //   await stakingContract.connect(owner).updateEndBlock(0, 20)
    //   await stakingContract.connect(owner).updateMaxStakeTokens(0, 1)
    //   await network.provider.send('evm_mine')

    //   // console.log(Number(await stakingContract.getRewardsWithdrawable(0)))

    //   poolInfo = await stakingContract.pools(0)

    //   // console.log(poolInfo)

    //   expect(poolInfo.lastRewardedBlock.toNumber()).equal(14)

    //   expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(29.999999)
    //   expect((await usdtToken.balanceOf(alice.address)).toNumber() / 10 ** 6).equal(9.999999)
    // })

    it('retrieveReward should be success', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        10 * 10 ** 6,
        1
      )
      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(14)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(10 * 10 ** 6)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      await stakingContract.connect(owner).retrieveReward(
        0, //
        accounts[4].address
      )

      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(300).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      // unStake
      await stakingContract.connect(bob).emergencyWithdraw(0)
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).emergencyWithdraw(0)
      await network.provider.send('evm_mine')

      // let res = await usdtToken.balanceOf(stakingContract.address)
      // console.log('1', res)

      // console.log(withdrawable)

      // console.log(await stakingContract.getLatestPoolInfo(0))
      await stakingContract.connect(owner).retrieveReward(
        0, //
        accounts[4].address
      )

      await stakingContract.connect(owner).retrieveReward(
        0, //
        accounts[4].address
      )
      await network.provider.send('evm_mine')

      // res = await usdtToken.balanceOf(accounts[4].address)
      // expect(res).equal(withdrawable)

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      // console.log(Number(await stakingContract.getRewardsWithdrawable(0)))

      await stakingContract.connect(alice).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(300).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(14)

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(0)
      expect((await usdtToken.balanceOf(alice.address)).toNumber() / 10 ** 6).equal(14.999999)
    })

    it('retrieveReward should be success without staking', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        10 * 10 ** 6,
        1
      )
      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)
      await network.provider.send('evm_mine')

      const withdrawable1 = Number(await usdtToken.balanceOf(stakingContract.address))

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(14)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(10 * 10 ** 6)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).emergencyWithdraw(0)

      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      // let res = await usdtToken.balanceOf(stakingContract.address)
      // console.log('1', res)

      // console.log(await stakingContract.getLatestPoolInfo(0))
      await stakingContract.connect(owner).retrieveReward(
        0, //
        accounts[4].address
      )

      await stakingContract.connect(owner).retrieveReward(
        0, //
        accounts[4].address
      )
      await network.provider.send('evm_mine')

      const res = await usdtToken.balanceOf(accounts[4].address)
      expect(res).equal(withdrawable1)
    })

    it('retrieveReward middle with bonus and withdraw emergency should be success', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        15,
        totalRewards,
        1
      )
      await stakingContract.connect(owner).depositPoolReward(0, 6 * totalRewards)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(15)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(totalRewards)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(11)

      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(50).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).emergencyWithdraw(0)
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      // unStake
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(50).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).unStake(0)
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(15)
      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(35.238095)
      expect((await usdtToken.balanceOf(alice.address)).toNumber() / 10 ** 6).equal(1.428571)

      await stakingContract.connect(owner).retrieveReward(0, accounts[4].address)
      await network.provider.send('evm_mine')
      expect(Number(await usdtToken.balanceOf(accounts[4].address))).equal(23333333)
    })

    it('parallel pool not support', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        totalRewards,
        2
      )
      await stakingContract.connect(owner).depositPoolReward(0, 5 * totalRewards)

      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10 ** 6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(14)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(totalRewards)
          .mul(TEN_E_18)
          .mul(TEN_E_18)
      )
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      // for stake
      await network.provider.send('evm_mine')

      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        10 * 10 ** 6,
        2
      )
      poolInfo = await stakingContract.pools(1)
      expect(poolInfo.inited).equal(false)

      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')
      await network.provider.send('evm_mine')

      // console.log(Number(await stakingContract.getRewardsWithdrawable(0)))

      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        100,
        125,
        10 * 10 ** 6,
        2
      )
      await stakingContract.connect(owner).depositPoolReward(1, totalRewards)

      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(1)
      expect(poolInfo.inited).equal(false)
    })
  })
})
