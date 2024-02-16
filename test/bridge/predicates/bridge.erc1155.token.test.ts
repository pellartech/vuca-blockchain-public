import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import {
  Multisig, //
  Multisig__factory,
  L2BridgeRegistry__factory,
  L2ERC1155Predicate,
  L2ERC1155Predicate__factory,
  L1ERC1155Predicate,
  L1ERC1155Predicate__factory,
  L1BridgeRegistry__factory,
  L2BridgeRegistry,
  L1BridgeRegistry,
  ContractProxy__factory,
  ContractProxy,
  L2ERC1155Template,
  L2ERC1155Template__factory,
  TokenERC1155__factory,
  TokenERC1155,
  Forwarder,
  Forwarder__factory,
} from '../../../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const proxyByteCodeHash = '0xb9ae7ba14d826de669be54f7c79008181b430f21bd3ff90dac8cce1e60ae88a9'

describe('Bridge Predicate ERC1155 test', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress

  let l1ERC1155Mock: TokenERC1155

  let tokenTemplate: L2ERC1155Template

  let l2multisigContract: Multisig
  let l2Registry: L2BridgeRegistry
  let l2TokenPredicate: L2ERC1155Predicate

  let l1multisigContract: Multisig
  let l1Registry: L1BridgeRegistry
  let l1TokenPredicate: L1ERC1155Predicate

  let forwarder: Forwarder

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]
    john = accounts[3]

    const forwarderFactory = (await ethers.getContractFactory('Forwarder', owner)) as Forwarder__factory
    forwarder = await forwarderFactory.deploy()
    await forwarder.deployed()

    const mockL1ERC1155Factory = (await ethers.getContractFactory('TokenERC1155', owner)) as TokenERC1155__factory
    l1ERC1155Mock = await mockL1ERC1155Factory.deploy()
    await l1ERC1155Mock.deployed()

    const factory2 = (await ethers.getContractFactory('L2ERC1155Template', owner)) as L2ERC1155Template__factory
    tokenTemplate = await factory2.deploy()
    await tokenTemplate.deployed()

    const initL2Predicate = async () => {
      const factory = (await ethers.getContractFactory('Multisig', owner)) as Multisig__factory
      l2multisigContract = await factory.deploy()
      await l2multisigContract.deployed()

      const registryFactory = (await ethers.getContractFactory('L2BridgeRegistry', owner)) as L2BridgeRegistry__factory
      const registryImpl = await registryFactory.deploy()
      await registryImpl.deployed()

      const bridgeProxyFactory = (await ethers.getContractFactory('NormalProxy', owner)) as any
      l2Registry = await bridgeProxyFactory.deploy(
        registryImpl.address,
        registryImpl.interface.encodeFunctionData(
          'initialize', //
          [l2multisigContract.address]
        )
      )
      await l2Registry.deployed()
      l2Registry = registryFactory.attach(l2Registry.address)

      const predicateImplFactory = (await ethers.getContractFactory('L2ERC1155Predicate', owner)) as L2ERC1155Predicate__factory
      const predicateImpl = await predicateImplFactory.deploy()
      await predicateImpl.deployed()

      const bridgeProxyFactory2 = (await ethers.getContractFactory('NormalProxy', owner)) as any
      l2TokenPredicate = await bridgeProxyFactory2.deploy(
        predicateImpl.address,
        predicateImpl.interface.encodeFunctionData(
          'initialize', //
          [l2Registry.address, tokenTemplate.address]
        )
      )
      await l2TokenPredicate.deployed()
      l2TokenPredicate = predicateImplFactory.attach(l2TokenPredicate.address)

      await l2multisigContract.submitTransaction(
        l2Registry.address,
        0, //
        l2Registry.interface.encodeFunctionData('modifyValidators', [
          [alice.address, john.address],
          [50, 20],
        ])
      )
      const txnId = Number(await l2multisigContract.getTransactionCount()) - 1
      await l2multisigContract.executeTransaction(txnId)

      await l2multisigContract.submitTransaction(
        l2Registry.address,
        0, //
        l2Registry.interface.encodeFunctionData('modifySystemVerifier', [bob.address])
      )
      await l2multisigContract.executeTransaction(Number(await l2multisigContract.getTransactionCount()) - 1)

      expect(await l2TokenPredicate.bridgeRegistry()).to.be.eq(l2Registry.address)
      expect(await l2TokenPredicate.implTemplate()).to.be.eq(tokenTemplate.address)
    }

    await initL2Predicate()

    const initL1Predicate = async () => {
      const factory = (await ethers.getContractFactory('Multisig', owner)) as Multisig__factory
      l1multisigContract = await factory.deploy()
      await l1multisigContract.deployed()

      const registryFactory = (await ethers.getContractFactory('L1BridgeRegistry', owner)) as L1BridgeRegistry__factory
      const registryImpl = await registryFactory.deploy()
      await registryImpl.deployed()

      const bridgeProxyFactory = (await ethers.getContractFactory('NormalProxy', owner)) as any
      l1Registry = await bridgeProxyFactory.deploy(
        registryImpl.address,
        registryImpl.interface.encodeFunctionData(
          'initialize', //
          [l1multisigContract.address]
        )
      )
      await l1Registry.deployed()
      l1Registry = registryFactory.attach(l1Registry.address)

      const l1PredicateFactory = (await ethers.getContractFactory('L1ERC1155Predicate', owner)) as L1ERC1155Predicate__factory
      const l1PredicateImpl = await l1PredicateFactory.deploy()
      await l1PredicateImpl.deployed()

      const predicateProxyFactory = (await ethers.getContractFactory('NormalProxy', owner)) as any
      l1TokenPredicate = await predicateProxyFactory.deploy(
        l1PredicateImpl.address,
        l1PredicateImpl.interface.encodeFunctionData(
          'initialize', //
          [l1Registry.address, l2TokenPredicate.address]
        )
      )
      await l1TokenPredicate.deployed()
      l1TokenPredicate = l1PredicateFactory.attach(l1TokenPredicate.address)

      await l1multisigContract.submitTransaction(
        l1Registry.address,
        0, //
        l1Registry.interface.encodeFunctionData('modifyValidators', [
          [alice.address, john.address],
          [50, 20],
        ])
      )
      const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
      await l1multisigContract.executeTransaction(txnId)

      expect(await l1TokenPredicate.bridgeRegistry()).to.be.eq(l1Registry.address)
      expect(await l1TokenPredicate.l2Predicate()).to.be.eq(l2TokenPredicate.address)
    }

    await initL1Predicate()

    await l1ERC1155Mock.mint(owner.address, 0, 10)
    await l1ERC1155Mock.mint(owner.address, 1, 10)
    await l1ERC1155Mock.mint(bob.address, 0, 10)
    await l1ERC1155Mock.mint(bob.address, 1, 10)

    await l1ERC1155Mock.setApprovalForAll(l1TokenPredicate.address, true)
    await l1ERC1155Mock.setApprovalForAll(l2TokenPredicate.address, true)
    await l1ERC1155Mock.connect(bob).setApprovalForAll(l1TokenPredicate.address, true)
    await l1ERC1155Mock.connect(bob).setApprovalForAll(l2TokenPredicate.address, true)
  })

  const pauseContract = async (multisig: any, predicate: any) => {
    await multisig.submitTransaction(predicate.address, 0, predicate.interface.encodeFunctionData('toggleIsPaused', [true]))
    const txnId = Number(await multisig.getTransactionCount()) - 1
    await multisig.executeTransaction(txnId)
  }

  const unpauseContract = async (multisig: any, predicate: any) => {
    await multisig.submitTransaction(predicate.address, 0, predicate.interface.encodeFunctionData('toggleIsPaused', [false]))
    const txnId = Number(await multisig.getTransactionCount()) - 1
    await multisig.executeTransaction(txnId)
  }

  describe('L1 registry', () => {
    context('Test case for modifyL2Predicate', () => {
      it('modifyL2Predicate should be revert without multisig', async () => {
        await expect(l1TokenPredicate.modifyL2Predicate(bob.address)).to.be.revertedWith('Multisig required')
      })

      it('modifyL2Predicate should be correct', async () => {
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('modifyL2Predicate', [bob.address]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        expect(await l1TokenPredicate.l2Predicate()).to.be.eq(bob.address)
      })
    })

    context('Test case for modifyL2TokenBytecodeHash', () => {
      it('modifyL2TokenBytecodeHash should be revert without multisig', async () => {
        await expect(l1TokenPredicate.modifyL2TokenBytecodeHash(ethers.constants.HashZero)).to.be.revertedWith('Multisig required')
      })

      it('modifyL2TokenBytecodeHash should be correct', async () => {
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('modifyL2TokenBytecodeHash', [ethers.constants.HashZero]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        expect(await l1TokenPredicate.l2TokenBytecodeHash()).to.be.eq(ethers.constants.HashZero)
      })
    })

    context('Test case for toggleIsPaused', () => {
      it('toggleIsPaused should be revert without multisig', async () => {
        await expect(l1TokenPredicate.toggleIsPaused(true)).to.be.revertedWith('Multisig required')
      })

      it('toggleIsPaused should be correct', async () => {
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('toggleIsPaused', [true]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        expect(await l1TokenPredicate.isPaused()).to.be.eq(true)
      })
    })
  })

  describe('L2 registry', () => {
    context('Test case for modifyImplTemplate', () => {
      it('modifyImplTemplate should be revert without multisig', async () => {
        await expect(l2TokenPredicate.modifyImplTemplate(bob.address)).to.be.revertedWith('Multisig required')
      })

      it('modifyImplTemplate should be correct', async () => {
        await l2multisigContract.submitTransaction(l2TokenPredicate.address, 0, l2TokenPredicate.interface.encodeFunctionData('modifyImplTemplate', [bob.address]))
        const txnId = Number(await l2multisigContract.getTransactionCount()) - 1
        await l2multisigContract.executeTransaction(txnId)
        expect(await l2TokenPredicate.implTemplate()).to.be.eq(bob.address)
      })
    })

    context('Test case for toggleIsPaused', () => {
      it('toggleIsPaused should be revert without multisig', async () => {
        await expect(l2TokenPredicate.toggleIsPaused(true)).to.be.revertedWith('Multisig required')
      })

      it('toggleIsPaused should be correct', async () => {
        await l2multisigContract.submitTransaction(l2TokenPredicate.address, 0, l2TokenPredicate.interface.encodeFunctionData('toggleIsPaused', [true]))
        const txnId = Number(await l2multisigContract.getTransactionCount()) - 1
        await l2multisigContract.executeTransaction(txnId)
        expect(await l2TokenPredicate.isPaused()).to.be.eq(true)
      })
    })
  })

  describe('Flow', () => {
    context('Test case for mapToken', () => {
      it('mapToken should be correct', async () => {
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('mapToken', [l1ERC1155Mock.address]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        const expected = ethers.utils.getCreate2Address(await l1TokenPredicate.l2Predicate(), ethers.utils.solidityKeccak256(['address'], [l1ERC1155Mock.address]), proxyByteCodeHash)
        expect(await l1TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        const message = ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'address', 'string', 'string', 'uint8'], [l1multisigContract.address, 0, l1ERC1155Mock.address, '', '', 18])
        const messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        const signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        const signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await l2TokenPredicate.mapToken([alice.address, john.address], [signature1, signature2], message)
        expect(await l2TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        let l2Token: any = L2ERC1155Template__factory.connect(expected, bob)
        expect(await l2Token.rootToken()).equal(l1ERC1155Mock.address)
        expect(await l2Token.predicate()).equal(l2TokenPredicate.address)

        l2Token = ContractProxy__factory.connect(expected, alice)
        await expect(l2Token.initialize(l1ERC1155Mock.address, '0x')).reverted
      })
    })

    context('Test case for deposit', () => {
      it('deposit should be revert with paused', async () => {
        await pauseContract(l1multisigContract, l1TokenPredicate)
        const tokenIds = [0, 1]
        const amounts = [10, 10]
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('mapToken', [l1ERC1155Mock.address]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        const expected = ethers.utils.getCreate2Address(await l1TokenPredicate.l2Predicate(), ethers.utils.solidityKeccak256(['address'], [l1ERC1155Mock.address]), proxyByteCodeHash)
        expect(await l1TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        let message = ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'address', 'string', 'string', 'uint8'], [l1multisigContract.address, 0, l1ERC1155Mock.address, '', '', 18])
        let messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        let signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        let signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await l2TokenPredicate.mapToken([alice.address, john.address], [signature1, signature2], message)
        expect(await l2TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        const l2Token = L2ERC1155Template__factory.connect(expected, bob)
        expect(await l2Token.rootToken()).equal(l1ERC1155Mock.address)
        expect(await l2Token.predicate()).equal(l2TokenPredicate.address)

        await expect(l1TokenPredicate.depositTo(l1ERC1155Mock.address, bob.address, tokenIds, amounts)).revertedWith('Paused')

        await expect(l1TokenPredicate.deposit(l1ERC1155Mock.address, tokenIds, amounts)).revertedWith('Paused')

        await expect(
          owner.sendTransaction({
            to: l1TokenPredicate.address,
            value: ethers.utils.parseEther('1'),
          })
        ).revertedWith('Not supported')
      })

      it('deposit should be correct', async () => {
        const tokenIds = [0, 1]
        const amounts = [10, 10]
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('mapToken', [l1ERC1155Mock.address]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        const expected = ethers.utils.getCreate2Address(await l1TokenPredicate.l2Predicate(), ethers.utils.solidityKeccak256(['address'], [l1ERC1155Mock.address]), proxyByteCodeHash)
        expect(await l1TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        let message = ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'address', 'string', 'string', 'uint8'], [l1multisigContract.address, 0, l1ERC1155Mock.address, '', '', 18])
        let messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        let signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        let signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await l2TokenPredicate.mapToken([alice.address, john.address], [signature1, signature2], message)
        expect(await l2TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        const l2Token = L2ERC1155Template__factory.connect(expected, bob)
        expect(await l2Token.rootToken()).equal(l1ERC1155Mock.address)
        expect(await l2Token.predicate()).equal(l2TokenPredicate.address)

        message = ethers.utils.defaultAbiCoder.encode(
          [
            'address', //
            'uint256',
            'address',
            'address',
            'address',
            'uint256[]',
            'uint256[]',
          ],
          [owner.address, 0, l1ERC1155Mock.address, expected, bob.address, tokenIds, amounts]
        )

        const txn = await l1TokenPredicate.depositTo(l1ERC1155Mock.address, bob.address, tokenIds, amounts)
        expect(txn).emit(l1TokenPredicate, 'DepositToken').withArgs(message)
        console.log('gasUsed To Deposit ETH', (await txn.wait()).gasUsed.toString())

        expect(await l1TokenPredicate.counter(owner.address)).to.be.eq(1)

        messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await l2TokenPredicate.syncDeposit([alice.address, john.address], [signature1, signature2], message)

        expect(await l2TokenPredicate.orderExecuted(owner.address, 0)).to.be.eq(true)
        expect(await l1ERC1155Mock.balanceOf(owner.address, 0)).equal(0)
        expect(await l1ERC1155Mock.balanceOf(owner.address, 1)).equal(0)
        expect(await l2Token.balanceOf(bob.address, 0)).equal(10)
        expect(await l2Token.balanceOf(bob.address, 1)).equal(10)
      })
    })

    context('Test case for withdraw', () => {
      it('withdraw should be correct', async () => {
        const tokenIds = [0, 1]
        const amounts = [10, 10]
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('mapToken', [l1ERC1155Mock.address]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        const expected = ethers.utils.getCreate2Address(await l1TokenPredicate.l2Predicate(), ethers.utils.solidityKeccak256(['address'], [l1ERC1155Mock.address]), proxyByteCodeHash)
        expect(await l1TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        let message = ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'address', 'string', 'string', 'uint8'], [l1multisigContract.address, 0, l1ERC1155Mock.address, '', '', 18])
        let messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        let signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        let signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await l2TokenPredicate.mapToken([alice.address, john.address], [signature1, signature2], message)
        expect(await l2TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        const l2Token = L2ERC1155Template__factory.connect(expected, bob)
        expect(await l2Token.rootToken()).equal(l1ERC1155Mock.address)
        expect(await l2Token.predicate()).equal(l2TokenPredicate.address)

        message = ethers.utils.defaultAbiCoder.encode(
          [
            'address', //
            'uint256',
            'address',
            'address',
            'address',
            'uint256[]',
            'uint256[]',
          ],
          [owner.address, 0, l1ERC1155Mock.address, expected, bob.address, tokenIds, amounts]
        )

        await l1TokenPredicate.depositTo(l1ERC1155Mock.address, bob.address, tokenIds, amounts)

        expect(await l1TokenPredicate.counter(owner.address)).to.be.eq(1)

        messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await pauseContract(l2multisigContract, l2TokenPredicate)
        await expect(l2TokenPredicate.syncDeposit([alice.address, john.address], [signature1, signature2], message)).revertedWith('Paused')
        await unpauseContract(l2multisigContract, l2TokenPredicate)

        await l2TokenPredicate.syncDeposit([alice.address, john.address], [signature1, signature2], message)

        message = ethers.utils.defaultAbiCoder.encode(
          [
            'address', //
            'uint256',
            'address',
            'address',
            'address',
            'uint256[]',
            'uint256[]',
          ],
          [bob.address, 0, l1ERC1155Mock.address, expected, bob.address, tokenIds, amounts]
        )

        await pauseContract(l2multisigContract, l2TokenPredicate)
        await expect(l2TokenPredicate.connect(bob).withdrawTo(expected, bob.address, tokenIds, amounts)).revertedWith('Paused')
        await expect(l2TokenPredicate.connect(bob).withdraw(expected, tokenIds, amounts)).revertedWith('Paused')
        await unpauseContract(l2multisigContract, l2TokenPredicate)

        const txn = await l2TokenPredicate.connect(bob).withdrawTo(expected, bob.address, tokenIds, amounts)
        expect(txn).emit(l2TokenPredicate, 'WithdrawToken').withArgs(message)

        expect(await l2TokenPredicate.counter(bob.address)).to.be.eq(1)

        messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await pauseContract(l1multisigContract, l1TokenPredicate)
        await expect(l1TokenPredicate.syncWithdraw([alice.address, john.address], [signature1, signature2], message)).revertedWith('Paused')
        await unpauseContract(l1multisigContract, l1TokenPredicate)

        const txn1 = await l1TokenPredicate.syncWithdraw([alice.address, john.address], [signature1, signature2], message)
        console.log('gasUsed To Withdraw ETH', (await txn1.wait()).gasUsed.toString())

        expect(await l1TokenPredicate.orderExecuted(bob.address, 0)).to.be.eq(true)
        expect(await l1ERC1155Mock.balanceOf(bob.address, 0)).equal(20)
        expect(await l1ERC1155Mock.balanceOf(bob.address, 1)).equal(20)
      })
    })

    context('Test case for delegacy', () => {
      it('delegacyWithdraw should be correct', async () => {
        const tokenIds = [0, 1]
        const amounts = [10, 10]
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('mapToken', [l1ERC1155Mock.address]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        const expected = ethers.utils.getCreate2Address(await l1TokenPredicate.l2Predicate(), ethers.utils.solidityKeccak256(['address'], [l1ERC1155Mock.address]), proxyByteCodeHash)
        expect(await l1TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        let message = ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'address', 'string', 'string', 'uint8'], [l1multisigContract.address, 0, l1ERC1155Mock.address, '', '', 18])
        let messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        let signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        let signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await l2TokenPredicate.mapToken([alice.address, john.address], [signature1, signature2], message)
        expect(await l2TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        const l2Token = L2ERC1155Template__factory.connect(expected, bob)
        expect(await l2Token.rootToken()).equal(l1ERC1155Mock.address)
        expect(await l2Token.predicate()).equal(l2TokenPredicate.address)

        message = ethers.utils.defaultAbiCoder.encode(
          [
            'address', //
            'uint256',
            'address',
            'address',
            'address',
            'uint256[]',
            'uint256[]',
          ],
          [owner.address, 0, l1ERC1155Mock.address, expected, bob.address, tokenIds, amounts]
        )

        await l1TokenPredicate.depositTo(l1ERC1155Mock.address, bob.address, tokenIds, amounts)

        expect(await l1TokenPredicate.counter(owner.address)).to.be.eq(1)

        messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await l2TokenPredicate.syncDeposit([alice.address, john.address], [signature1, signature2], message)

        message = ethers.utils.defaultAbiCoder.encode(
          [
            'address', //
            'uint256',
            'address',
            'address',
            'address',
            'uint256[]',
            'uint256[]',
          ],
          [bob.address, 0, l1ERC1155Mock.address, expected, bob.address, tokenIds, amounts]
        )

        //
        const domain = {
          name: 'Lightlink',
          version: '1.0.0',
          chainId: 1,
          verifyingContract: l2TokenPredicate.address,
        }

        const types = {
          WithdrawalForwardRequest: [
            { name: 'nonce', type: 'uint256' }, //
            { name: 'l1Token', type: 'address' },
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'ids', type: 'uint256[]' },
            { name: 'amounts', type: 'uint256[]' },
          ],
        }

        const value = {
          nonce: 0,
          l1Token: l1ERC1155Mock.address,
          from: bob.address,
          to: bob.address,
          ids: tokenIds,
          amounts: amounts,
        }

        const signature = await bob._signTypedData(domain, types, value)

        await pauseContract(l2multisigContract, l2TokenPredicate)
        await expect(l2TokenPredicate.connect(bob).delegacyWithdraw(value, signature)).revertedWith('Paused')
        await unpauseContract(l2multisigContract, l2TokenPredicate)

        const txn = await l2TokenPredicate.connect(bob).delegacyWithdraw(value, signature)
        expect(txn).emit(l2TokenPredicate, 'WithdrawToken').withArgs(message)

        expect(await l2TokenPredicate.counter(bob.address)).to.be.eq(1)

        messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        const txn1 = await l1TokenPredicate.syncWithdraw([alice.address, john.address], [signature1, signature2], message)
        console.log('gasUsed To Withdraw ETH', (await txn1.wait()).gasUsed.toString())

        expect(await l1TokenPredicate.orderExecuted(bob.address, 0)).to.be.eq(true)
        expect(await l1ERC1155Mock.balanceOf(bob.address, 0)).equal(20)
        expect(await l1ERC1155Mock.balanceOf(bob.address, 1)).equal(20)
      })

      it('delegacyApproveForAll should be correct', async () => {
        await l1multisigContract.submitTransaction(l1TokenPredicate.address, 0, l1TokenPredicate.interface.encodeFunctionData('mapToken', [l1ERC1155Mock.address]))
        const txnId = Number(await l1multisigContract.getTransactionCount()) - 1
        await l1multisigContract.executeTransaction(txnId)
        const expected = ethers.utils.getCreate2Address(await l1TokenPredicate.l2Predicate(), ethers.utils.solidityKeccak256(['address'], [l1ERC1155Mock.address]), proxyByteCodeHash)
        expect(await l1TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        let message = ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'address', 'string', 'string', 'uint8'], [l1multisigContract.address, 0, l1ERC1155Mock.address, '', '', 18])
        let messageHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [1337, message])

        let signature1 = await alice.signMessage(ethers.utils.arrayify(messageHash))
        let signature2 = await john.signMessage(ethers.utils.arrayify(messageHash))

        await l2TokenPredicate.mapToken([alice.address, john.address], [signature1, signature2], message)
        expect(await l2TokenPredicate.l1ToL2Gateway(l1ERC1155Mock.address)).to.be.eq(expected)

        const l2Token = L2ERC1155Template__factory.connect(expected, bob)

        //
        const domain = {
          name: 'Adot',
          version: '1.0.0',
          chainId: 1,
          verifyingContract: l2Token.address,
        }

        const types = {
          ApprovalForAllForwardRequest: [
            { name: 'nonce', type: 'uint256' }, //
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'approved', type: 'bool' },
          ],
        }

        let value = {
          nonce: 0,
          owner: john.address,
          spender: bob.address,
          approved: true,
        }

        const signature = await john._signTypedData(domain, types, value)

        const systemSignature = await bob.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

        await forwarder.connect(alice).forward(l2Token.address, l2Token.interface.encodeFunctionData('delegacyApproveForAll', [value, signature, systemSignature]))
        expect(await l2Token.isApprovedForAll(john.address, bob.address)).equal(true)
      })
    })
  })
})
