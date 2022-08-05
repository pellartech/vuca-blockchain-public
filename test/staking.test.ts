import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { CWTT, CWTT__factory, PellarStaking, PellarStaking__factory, USDT, USDT__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

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

    await usdtToken.mint(stakingContract.address, 10000 * 10e6)
    await cwtToken.connect(bob).mint(bob.address, ethers.BigNumber.from(100).mul(TEN_E_18).toString())
    await cwtToken.connect(bob).approve(stakingContract.address, ethers.BigNumber.from('10000000000000000000000000000000000000000000000000'))
    await network.provider.send('evm_mine')
  })

  context('Test case for stake', () => {
    it('Stake should be success', async () => {
      await stakingContract.connect(owner).createPool(usdtToken.address, cwtToken.address, ethers.BigNumber.from(10e6).mul(TEN_E_18).toString(), 10, 13, 10 * 10e6)
      await network.provider.send('evm_mine')

      let poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(10e6).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(13)
      expect(poolInfo.rewardTokensPerBlock).equal(
        ethers.BigNumber.from(10 * 10e6)
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

      await stakingContract.connect(bob).unStake(0)
      await network.provider.send('evm_mine')

      poolInfo = await stakingContract.pools(0)

      expect(poolInfo.lastRewardedBlock.toNumber()).equal(13)
      expect(poolInfo.accumulatedRewardsPerShare).equal(ethers.BigNumber.from(3 * 10 * 10e6).mul(TEN_E_18).mul(TEN_E_18).div(ethers.BigNumber.from(100).mul(TEN_E_18)))

      expect((await usdtToken.balanceOf(bob.address)).toNumber() / 10e6).equal(30)
    })
  })

  context('Test case for base action', () => {
    it('transfer should be success', async () => {})
  })
})
