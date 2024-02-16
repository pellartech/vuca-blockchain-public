import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { MarketplaceRegistry, MarketplaceRegistry__factory } from '../../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

describe('Marketplace registry test', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let mainContract: MarketplaceRegistry

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const registryFactory = (await ethers.getContractFactory('MarketplaceRegistry', owner)) as MarketplaceRegistry__factory
    const registryImpl = await registryFactory.deploy()
    await registryImpl.deployed()

    const bridgeProxyFactory = (await ethers.getContractFactory('NormalProxy', owner)) as any
    mainContract = await bridgeProxyFactory.deploy(
      registryImpl.address,
      registryImpl.interface.encodeFunctionData(
        'initialize', //
        [owner.address]
      )
    )
    await mainContract.deployed()

    mainContract = registryFactory.attach(mainContract.address)
  })

  context('Test case for initialize', () => {
    it('initialize should be correct', async () => {
      expect(await mainContract.getMultisig()).to.be.eq(owner.address)
    })
  })

  context('Test case for modifySystemVerifier', () => {
    it('modifySystemVerifier should be revert without multisig', async () => {
      await expect(mainContract.connect(bob).modifySystemVerifier(bob.address)).to.be.revertedWith('Multisig required')
    })

    it('modifySystemVerifier should be correct', async () => {
      await mainContract.modifySystemVerifier(bob.address)

      expect(await mainContract.getSystemVerifier()).to.be.eq(bob.address)
    })
  })

  context('Test case for createService', () => {
    const serviceId = ethers.utils.solidityKeccak256(['string'], ['abc'])
    it('createService should be revert without multisig', async () => {
      await expect(mainContract.connect(bob).createService(serviceId, bob.address)).to.be.revertedWith('Multisig required')
    })

    it('createService should be correct', async () => {
      await mainContract.createService(serviceId, bob.address)

      expect(await mainContract.getService(serviceId)).to.be.eq(bob.address)

      await expect(mainContract.createService(serviceId, bob.address)).to.be.revertedWith('Service already exists')

      expect(await mainContract.getService(ethers.utils.solidityKeccak256(['string'], ['abcz']))).to.be.eq(ethers.constants.AddressZero)
    })
  })

  context('Test case for modifyService', () => {
    const serviceId = ethers.utils.solidityKeccak256(['string'], ['abc'])
    it('modifyService should be revert without multisig', async () => {
      await expect(mainContract.connect(bob).modifyService(serviceId, bob.address)).to.be.revertedWith('Multisig required')
    })

    it('modifyService should be correct', async () => {
      await expect(mainContract.modifyService(serviceId, bob.address)).to.be.revertedWith('Service not exists')

      await mainContract.createService(serviceId, bob.address)

      await mainContract.modifyService(serviceId, alice.address)

      expect(await mainContract.getService(serviceId)).to.be.eq(alice.address)
    })
  })

  context('Test case for modifySupportedPayableToken', () => {
    it('modifySupportedPayableToken should be revert without multisig', async () => {
      await expect(mainContract.connect(bob).modifySupportedPayableToken(bob.address, true)).to.be.revertedWith('Multisig required')
    })

    it('modifySupportedPayableToken should be correct', async () => {
      await mainContract.modifySupportedPayableToken(bob.address, true)

      expect(await mainContract.checkSupportedPayableToken(bob.address)).to.be.eq(true)

      await mainContract.modifySupportedPayableToken(bob.address, false)

      expect(await mainContract.checkSupportedPayableToken(bob.address)).to.be.eq(false)
    })
  })
})
