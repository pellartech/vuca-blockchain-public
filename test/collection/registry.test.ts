import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { AdotRegistry, AdotRegistry__factory } from '../../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const iFace = new ethers.utils.Interface(AdotRegistry__factory.abi)

describe('AdotRegistry test', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let mainContract: AdotRegistry

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const implementFactory = (await ethers.getContractFactory('AdotRegistry', owner)) as AdotRegistry__factory
    const implContract = await implementFactory.deploy()
    await implContract.deployed()

    const factory = (await ethers.getContractFactory('NormalProxy', owner)) as any
    mainContract = await factory.deploy(implContract.address, iFace.encodeFunctionData('initialize', []))
    await mainContract.deployed()
    mainContract = implContract.attach(mainContract.address)

    expect(await mainContract.feeDenominator()).eq(10000)
  })

  context('Test case for setPlatformFeeReceiver', () => {
    it('setPlatformFeeReceiver should be revert without multisig', async () => {
      await expect(mainContract.connect(bob).setPlatformFeeReceiver(bob.address)).to.be.revertedWith('Multisig required')
    })

    it('setPlatformFeeReceiver should be correct', async () => {
      await mainContract.setPlatformFeeReceiver(bob.address)
      expect(await mainContract.platformFeeReceiver()).eq(bob.address)
      expect(await mainContract.getPlatformFeeReceiver()).eq(bob.address)
    })
  })

  context('Test case for setVerifier', () => {
    it('setVerifier should be revert without multisig', async () => {
      await expect(mainContract.connect(bob).setVerifier(bob.address)).to.be.revertedWith('Multisig required')
    })

    it('setVerifier should be correct', async () => {
      await mainContract.setVerifier(bob.address)
      expect(await mainContract.verifier()).eq(bob.address)
      expect(await mainContract.getVerifier()).eq(bob.address)
    })
  })

  context('Test case for setPlatformFee', () => {
    it('setPlatformFee should be revert without owner', async () => {
      await expect(mainContract.connect(bob).setPlatformFee(10)).revertedWith('Multisig required')
    })

    it('setPlatformFee should be correct', async () => {
      await mainContract.setPlatformFee(10)
      expect(await mainContract.platformFee()).eq(10)
      expect(await mainContract.getPlatformFee()).eq(10)
    })
  })

  context('Test case for setRootURI', () => {
    it('setRootURI should be revert without owner', async () => {
      await expect(mainContract.connect(bob).setRootURI('asdhsd')).revertedWith('Multisig required')
    })

    it('setRootURI should be correct', async () => {
      await mainContract.setRootURI('asdhsd')
      expect(await mainContract.rootURI()).eq('asdhsd')
      expect(await mainContract.getRootURI()).eq('asdhsd')
    })
  })

  context('Test case for getFeeAmount', () => {
    it('getFeeAmount should be correct', async () => {
      await mainContract.setPlatformFee(1000)
      const res = await mainContract.getFeeAmount(100)
      expect(res[0]).eq(10)
      expect(res[1]).eq(90)
    })
  })
})
