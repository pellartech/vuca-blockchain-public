import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { CrownToken, CrownToken__factory } from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const TEN_E_18 = ethers.utils.parseEther('1')

describe('CrownToken', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, eve: SignerWithAddress
  let cwtToken: CrownToken

  beforeEach(async () => {
    await network.provider.send('hardhat_reset')

    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]
    eve = accounts[3]

    const factory = (await ethers.getContractFactory('CrownToken', owner)) as CrownToken__factory
    cwtToken = await factory.deploy()
    cwtToken.deployed()
    await network.provider.send('evm_mine')
  })

  // context('Requirements', () => {
  //   it('Should have symbol CWT and name CWT', async () => {
  //     const name = await cwtToken.name()
  //     const symbol = await cwtToken.symbol()

  //     expect(name).to.equal('CWT')
  //     expect(symbol).to.equal('CWT')
  //   })

  //   it('Should have 18 decimals', async () => {
  //     const decimals = await cwtToken.decimals()
  //     expect(decimals).to.equal(18)
  //   })

  //   it('Should mint 140 million CWT to owner on deploy', async () => {
  //     const ownerBalance = await cwtToken.balanceOf(owner.address)
  //     const MAX_SUPPLY = await cwtToken.MAX_SUPPLY()

  //     expect(ownerBalance).to.equal(MAX_SUPPLY)
  //   })
  // })

  context('ERC20 Properties', () => {
    const TEST_AMOUNT = TEN_E_18

    it('Should allow user to set an allowance', async () => {
      await cwtToken.connect(owner).approve(bob.address, TEST_AMOUNT)
      await network.provider.send('evm_mine')

      const approval = await cwtToken.allowance(owner.address, bob.address)
      expect(approval).to.equal(TEST_AMOUNT)
    })
    it('Should allow user to transfer CWT', async () => {
      await cwtToken.connect(owner).transfer(alice.address, TEST_AMOUNT)
      await network.provider.send('evm_mine')

      const aliceBalance = await cwtToken.balanceOf(alice.address)
      expect(aliceBalance).to.equal(TEST_AMOUNT)
    })
    it('Should allow user with approval to get CWT', async () => {
      await cwtToken.connect(owner).approve(bob.address, TEST_AMOUNT)
      await network.provider.send('evm_mine')

      await cwtToken.connect(bob).transferFrom(owner.address, bob.address, TEST_AMOUNT)
      await network.provider.send('evm_mine')

      const bobBalance = await cwtToken.balanceOf(bob.address)
      expect(bobBalance).to.equal(TEST_AMOUNT)
    })

    it('Should prevent CWT transfer with no approval', async () => {
      const eveApproval = await cwtToken.allowance(owner.address, eve.address)
      await cwtToken.connect(eve).transferFrom(owner.address, eve.address, TEST_AMOUNT)
      await network.provider.send('evm_mine')

      const eveBalance = await cwtToken.balanceOf(eve.address)
      expect(eveApproval).to.equal(eveBalance)
    })

    it('Should prevent spending above allowance', async () => {
      await cwtToken.connect(owner).approve(bob.address, TEST_AMOUNT)
      await network.provider.send('evm_mine')

      await cwtToken.connect(bob).transferFrom(owner.address, bob.address, TEST_AMOUNT.mul(10))
      await network.provider.send('evm_mine')

      const bobBalance = await cwtToken.balanceOf(bob.address)
      expect(bobBalance).to.equal(0)
    })
  })
})
