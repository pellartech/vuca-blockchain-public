import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { AdotFactory, AdotFactory__factory, ContractProxy__factory } from '../../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const iFace = new ethers.utils.Interface(AdotFactory__factory.abi)
const proxyByteCodeHash = ethers.utils.keccak256(ContractProxy__factory.bytecode)
console.log('Contract Proxy bytecode hash', proxyByteCodeHash)

describe('AdotFactory test', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let implContract: AdotFactory
  let mainContract: AdotFactory

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const implementFactory = (await ethers.getContractFactory('AdotFactory', owner)) as AdotFactory__factory
    implContract = await implementFactory.deploy()
    await implContract.deployed()

    const factory = (await ethers.getContractFactory('NormalProxy', owner)) as any
    mainContract = await factory.deploy(implContract.address, iFace.encodeFunctionData('initialize', []))
    await mainContract.deployed()
    mainContract = implContract.attach(mainContract.address)
  })

  context('Test case for addImplementation', () => {
    it('addImplementation should be revert without multisig', async () => {
      await expect(mainContract.connect(bob).addImplementation(ethers.constants.HashZero, bob.address)).to.be.revertedWith('Multisig required')
    })

    it('addImplementation should be revert without contract', async () => {
      await expect(mainContract.connect(owner).addImplementation(ethers.constants.HashZero, bob.address)).to.be.revertedWith('Require contract')
    })

    it('addImplementation should be correct', async () => {
      await mainContract.addImplementation(ethers.constants.HashZero, mainContract.address)

      expect(await mainContract.getLatestImplementation(ethers.constants.HashZero)).eq(mainContract.address)
      expect(await mainContract.getImplementation(ethers.constants.HashZero, 0)).eq(mainContract.address)
    })
  })

  context('Test case for deployProxy', () => {
    it('deployProxy should be correct', async () => {
      const hash = ethers.utils.solidityKeccak256(['string'], ['AdotFactory'])

      await mainContract.addImplementation(hash, implContract.address)

      const expected = ethers.utils.getCreate2Address(mainContract.address, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [owner.address, 0])), proxyByteCodeHash)

      const initialize = iFace.encodeFunctionData('initialize', [])
      await mainContract.deployProxy(hash, initialize)

      expect(await mainContract.deployer(expected)).eq(owner.address)
      expect(await mainContract.nonce(owner.address)).eq(1)
    })
  })

  context('Test case for delegacyDeployProxy', () => {
    it('delegacyDeployProxy should be correct', async () => {
      const hash = ethers.utils.solidityKeccak256(['string'], ['AdotFactory'])

      await mainContract.addImplementation(hash, implContract.address)

      const expected = ethers.utils.getCreate2Address(mainContract.address, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [bob.address, 0])), proxyByteCodeHash)

      //
      const domain = {
        name: 'Adot',
        version: '1',
        chainId: 1337,
        verifyingContract: mainContract.address,
      }

      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' }, //
          { name: 'contractType', type: 'bytes32' },
          { name: 'dataHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
        ],
      }

      const initialize = iFace.encodeFunctionData('initialize', [])

      const value = {
        from: bob.address,
        contractType: hash,
        dataHash: ethers.utils.keccak256(ethers.utils.arrayify(initialize)),
        nonce: 0,
      }

      const signature = await bob._signTypedData(domain, types, {
        from: bob.address,
        contractType: hash,
        dataHash: ethers.utils.keccak256(ethers.utils.arrayify(initialize)),
        nonce: 0,
      })

      await mainContract.delegacyDeployProxy(value, initialize, signature)

      expect(await mainContract.deployer(expected)).eq(bob.address)
      expect(await mainContract.nonce(bob.address)).eq(1)
    })
  })
})
