import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { CrownVesting, CrownVesting__factory, CWTT, CWTT__factory } from '../typechain-types'
import moment from 'moment'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

describe('Vesting Crown', () => {
  let accounts: SignerWithAddress[]
  let _contract: CrownVesting
  let _token: CWTT
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress

  before(async () => {
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]
  })

  beforeEach(async () => {
    await network.provider.send('evm_setAutomine', [true])
    await network.provider.send('hardhat_reset')

    const _factory = (await ethers.getContractFactory('CWTT', owner)) as CWTT__factory
    _token = await _factory.deploy()
    await _token.deployed()

    const factory = (await ethers.getContractFactory('CrownVesting', owner)) as CrownVesting__factory
    _contract = await factory.deploy()
    await _contract.deployed()

    expect(_contract.address).to.properAddress

    await _token.mint(owner.address, ethers.utils.parseEther('1000000'))
    await _token.approve(_contract.address, ethers.utils.parseEther('10000000000'))
  })

  context('Test case for createVesting', () => {
    it('createVesting should be revert without minimum', async () => {
      const currentTime = moment.utc().unix()
      await expect(_contract.connect(owner).createVesting(bob.address, 0, currentTime)).revertedWith('Invalid amount')
    })

    it('createVesting should be correct', async () => {
      const currentTime = moment.utc().add(1, 'days').unix()
      await _contract.connect(owner).createVesting(bob.address, ethers.utils.parseEther('10000'), currentTime)

      expect(await _token.balanceOf(_contract.address)).to.eq(ethers.utils.parseEther('10000'))
      expect(await _token.balanceOf(owner.address)).to.eq(ethers.utils.parseEther(`${1_000_000 - 10_000}`))

      const items = await _contract.items(bob.address, 0)
      expect(items.amount).to.eq(ethers.utils.parseEther('10000'))
      expect(items.claimed).to.eq(false)
      expect(items.claimable_at).to.eq(currentTime)
    })
  })

  context('Test case for claimToken', () => {
    it('claimToken should be correct 1', async () => {
      const currentTime = moment.utc().add(1, 'days').unix()

      await _contract.connect(owner).createVesting(bob.address, ethers.utils.parseEther('10000'), currentTime)

      await expect(_contract.connect(alice).claimToken(bob.address, 0)).revertedWith('Not authorized')
      await expect(_contract.connect(bob).claimToken(bob.address, 1)).revertedWith('Invalid lockup id')

      await expect(_contract.connect(bob).claimToken(bob.address, 0)).revertedWith('Not claimable yet')

      await network.provider.send('evm_increaseTime', [24 * 60 * 60 + 100]) // 1 day
      await network.provider.send('evm_mine')

      await _contract.connect(bob).claimToken(bob.address, 0)

      expect(await _token.balanceOf(bob.address)).to.eq(ethers.utils.parseEther('10000'))
      expect(await _token.balanceOf(_contract.address)).to.eq(ethers.utils.parseEther('0'))

      await expect(_contract.connect(bob).claimToken(bob.address, 0)).revertedWith('Already claimed')
    })

    it('claimToken should be correct 2', async () => {
      const currentTime = moment.utc().add(1, 'days').unix()

      await _contract.connect(owner).createVesting(bob.address, ethers.utils.parseEther('10000'), currentTime)

      await network.provider.send('evm_increaseTime', [24 * 60 * 60 + 100]) // 1 day
      await network.provider.send('evm_mine')

      await _contract.connect(owner).claimToken(bob.address, 0)

      expect(await _token.balanceOf(bob.address)).to.eq(ethers.utils.parseEther('10000'))
      expect(await _token.balanceOf(_contract.address)).to.eq(ethers.utils.parseEther('0'))
    })
  })

  context('Test case for updateClaimableAt', () => {
    it('updateClaimableAt should be revert without owner', async () => {
      await expect(_contract.connect(bob).updateClaimableAt(bob.address, 0, 10)).revertedWith('Ownable: caller is not the owner')
    })

    it('updateClaimableAt should be correct', async () => {
      const currentTime = moment.utc().add(1, 'days').unix()

      await _contract.connect(owner).createVesting(bob.address, ethers.utils.parseEther('10000'), currentTime)

      await _contract.connect(owner).updateClaimableAt(bob.address, 0, currentTime + 24 * 60 * 60)

      const items = await _contract.items(bob.address, 0)
      expect(items.amount).to.eq(ethers.utils.parseEther('10000'))
      expect(items.claimed).to.eq(false)
      expect(items.claimable_at).to.eq(currentTime + 24 * 60 * 60)
    })
  })
})
