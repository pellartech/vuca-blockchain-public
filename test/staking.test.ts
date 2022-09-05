import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { CWTT, CWTT__factory, PellarStaking, PellarStaking__factory, USDT, USDT__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import moment from 'moment'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const TEN_E_18 = ethers.utils.parseEther('1')

describe('Staking', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let stakingContract: PellarStaking
  let cwtToken: CWTT
  let usdtToken: USDT

  beforeEach(async () => {
    await network.provider.send('hardhat_reset')

    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const factory = (await ethers.getContractFactory('PellarStaking', owner)) as PellarStaking__factory
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

    await usdtToken.mint(stakingContract.address, 10000 * 10 ** 6)
    await cwtToken.connect(bob).mint(bob.address, ethers.BigNumber.from(1000000).mul(TEN_E_18).toString())
    await cwtToken.connect(alice).mint(alice.address, ethers.BigNumber.from(1000000).mul(TEN_E_18).toString())
    await cwtToken.connect(bob).approve(stakingContract.address, ethers.BigNumber.from('10000000000000000000000000000000000000000000'))
    await cwtToken.connect(alice).approve(stakingContract.address, ethers.BigNumber.from('10000000000000000000000000000000000000000000'))
    await network.provider.send('evm_mine')
  })

  context('Test case for stake', () => {
    it('Stake single should be success', async () => {
      await stakingContract.connect(owner).createPool(
        usdtToken.address,
        cwtToken.address,
        ethers.BigNumber.from(10 ** 6)
          .mul(TEN_E_18)
          .toString(),
        10,
        14,
        10 * 10 ** 6
      )
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

      // unStake
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
        10 * 10 ** 6
      )
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

      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
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
        10 * 10 ** 6
      )
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
        10 * 10 ** 6
      )
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
        10 * 10 ** 6
      )
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
        14,
        10 * 10 ** 6
      )
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

      await stakingContract.connect(alice).stake(0, ethers.BigNumber.from(50).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')

      await stakingContract.connect(owner).updateRewardTokensPerBlock(0, 20 * 10 ** 6)
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')
      const currentTime = moment.utc().unix()
      await network.provider.send("evm_setNextBlockTimestamp", [currentTime + 8 * 60 * 60 + 1])
      await network.provider.send("evm_mine")

      // unStake
      await stakingContract.connect(owner).updateRewardTokensPerBlock(0, 5 * 10 ** 6)      
      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
      await network.provider.send('evm_mine')
      await network.provider.send("evm_setNextBlockTimestamp", [currentTime + 8 * 60 * 60 + 8 * 60 * 60 + 2])
      await network.provider.send('evm_mine')

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      await stakingContract.connect(alice).unStake(0)
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(14)
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

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10 ** 6).equal(32.666666)
      expect((await usdtToken.balanceOf(alice.address)).toNumber() / 10 ** 6).equal(8.047619)
    })
  })

  context('Test case for base action', () => {
    it('transfer should be success', async () => {})
  })
})
