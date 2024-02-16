import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import {
  Multisig, //
  Multisig__factory,
  L2BridgeRegistry,
  L2BridgeRegistry__factory,
} from '../../../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const validator1 = '0x96FEec33fd9C1C08eD3630BA50a6C88b5f4D86b0'
const validator2 = '0x60cC5003c7813D1966aa8A3466acc75257F814BD'

describe('Bridge registry test L2', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let multisigContract: Multisig
  let mainContract: L2BridgeRegistry

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]

    const factory = (await ethers.getContractFactory('Multisig', owner)) as Multisig__factory
    multisigContract = await factory.deploy()
    await multisigContract.deployed()

    const registryFactory = (await ethers.getContractFactory('L2BridgeRegistry', owner)) as L2BridgeRegistry__factory
    const registryImpl = await registryFactory.deploy()
    await registryImpl.deployed()

    const bridgeProxyFactory = (await ethers.getContractFactory('NormalProxy', owner)) as any
    mainContract = await bridgeProxyFactory.deploy(
      registryImpl.address,
      registryImpl.interface.encodeFunctionData(
        'initialize', //
        [multisigContract.address]
      )
    )
    await mainContract.deployed()

    mainContract = registryFactory.attach(mainContract.address)
  })

  context('Test case for initialize', () => {
    it('initialize should be correct', async () => {
      expect(await mainContract.multisig()).to.be.eq(multisigContract.address)
      expect(await mainContract.consensusPowerThreshold()).to.be.eq(70)

      const validators = await mainContract.getValidators()
      expect(validators[0].addr).to.be.eq(validator1)
      expect(validators[0].power).to.be.eq(35)

      expect(validators[1].addr).to.be.eq(validator2)
      expect(validators[1].power).to.be.eq(35)

      expect(await mainContract.validValidator(validator1)).to.be.eq(true)
      expect(await mainContract.validValidator(validator2)).to.be.eq(true)
    })
  })

  context('Test case for modifyConsensusPowerThreshold', () => {
    it('modifyConsensusPowerThreshold should be revert without multisig', async () => {
      await expect(mainContract.modifyConsensusPowerThreshold(1)).to.be.revertedWith('Multisig required')
    })

    it('modifyConsensusPowerThreshold should be correct', async () => {
      await multisigContract.submitTransaction(mainContract.address, 0, mainContract.interface.encodeFunctionData('modifyConsensusPowerThreshold', [1]))
      await multisigContract.executeTransaction(0)

      expect(await mainContract.consensusPowerThreshold()).to.be.eq(1)
    })
  })

  context('Test case for modifyValidators', () => {
    it('modifyValidators should be revert without multisig', async () => {
      await expect(mainContract.modifyValidators([bob.address], [1])).to.be.revertedWith('Multisig required')
    })

    it('modifyValidators should be correct', async () => {
      await multisigContract.submitTransaction(
        mainContract.address,
        0, //
        mainContract.interface.encodeFunctionData('modifyValidators', [[bob.address], [1]])
      )
      await multisigContract.executeTransaction(0)

      expect(await mainContract.getPower(bob.address)).to.be.eq(1)
    })
  })

  context('Test case for removeValidators', () => {
    it('removeValidators should be revert without multisig', async () => {
      await expect(mainContract.removeValidators([bob.address])).to.be.revertedWith('Multisig required')
    })

    it('removeValidators should be correct', async () => {
      await multisigContract.submitTransaction(
        mainContract.address,
        0, //
        mainContract.interface.encodeFunctionData('removeValidators', [[validator1]])
      )
      await multisigContract.executeTransaction(0)

      expect(await mainContract.getPower(validator1)).to.be.eq(0)
    })
  })

  context('Test case for modifySystemVerifier', () => {
    it('modifySystemVerifier should be revert without multisig', async () => {
      await expect(mainContract.modifySystemVerifier(bob.address)).to.be.revertedWith('Multisig required')
    })

    it('modifySystemVerifier should be correct', async () => {
      await multisigContract.submitTransaction(
        mainContract.address,
        0, //
        mainContract.interface.encodeFunctionData('modifySystemVerifier', [bob.address])
      )
      await multisigContract.executeTransaction(0)

      expect(await mainContract.getSystemVerifier()).to.be.eq(bob.address)
    })
  })
})
