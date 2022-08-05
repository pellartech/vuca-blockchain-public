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
    await stakingContract.deployed()

    const factory1 = (await ethers.getContractFactory('CWTT', owner)) as CWTT__factory
    cwtToken = await factory1.deploy()
    await cwtToken.deployed()

    const factory2 = (await ethers.getContractFactory('USDT', owner)) as USDT__factory
    usdtToken = await factory2.deploy()
    await usdtToken.deployed()

    await usdtToken.mint(stakingContract.address, 10000 * 10**6)

    await cwtToken.connect(bob).mint(bob.address, ethers.BigNumber.from(100).mul(TEN_E_18).toString())

    await cwtToken.connect(bob).approve(stakingContract.address, ethers.BigNumber.from('10000000000000000000000000000000000000000000000000'))
  })

  context('Test case for stake', () => {
    it('Stake should be success', async () => {
      await stakingContract.connect(owner).createPool(usdtToken.address, cwtToken.address, ethers.BigNumber.from(1000000).mul(TEN_E_18).toString(), 10, 13, 10 * 10**6)

      const poolInfo = await stakingContract.pools(0)
      expect(poolInfo.inited).equal(true)
      expect(poolInfo.rewardToken).equal(usdtToken.address)
      expect(poolInfo.stakeToken).equal(cwtToken.address)
      expect(poolInfo.maxStakeTokens).equal(ethers.BigNumber.from(1000000).mul(TEN_E_18))
      expect(poolInfo.startBlock.toNumber()).equal(10)
      expect(poolInfo.endBlock.toNumber()).equal(13)
      expect(poolInfo.rewardTokensPerBlock).equal(ethers.BigNumber.from(10 * 10**6).mul(TEN_E_18).mul(TEN_E_18))
      expect(poolInfo.tokensStaked).equal(0)
      expect(poolInfo.lastRewardedBlock.toNumber()).equal(10)
      expect(poolInfo.accumulatedRewardsPerShare.toNumber()).equal(0)

      await network.provider.send('hardhat_mine', ['0xa'])

      await stakingContract.connect(bob).stake(0, ethers.BigNumber.from(100).mul(TEN_E_18).toString())

      await network.provider.send('hardhat_mine', [ethers.BigNumber.from(13).toHexString().replace('0x0', '0x')])

      await stakingContract.connect(bob).unStake(0)

      console.log((await usdtToken.balanceOf(bob.address)).toNumber())
    })
  })

  context('Test case for base action', () => {
    it('transfer should be success', async () => {})
  })
})
