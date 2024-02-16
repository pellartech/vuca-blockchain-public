import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { Multisig, Multisig__factory } from '../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const iFace = new ethers.utils.Interface(Multisig__factory.abi)

describe('Multisig test', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let mainContract: Multisig

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const factory = (await ethers.getContractFactory('Multisig', owner)) as Multisig__factory
    mainContract = await factory.deploy()
    await mainContract.deployed()
  })

  context('Test case for addMember', () => {
    it('addMember should be revert without multisig', async () => {
      await expect(mainContract.addMember(bob.address)).to.be.revertedWith('Multisig required')
    })

    it('addMember should be correct', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)

      expect(await mainContract.getMemberByIndex(1)).eq(bob.address)

      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [alice.address]))
      await mainContract.connect(bob).confirmTransaction(1)
      await mainContract.executeTransaction(1)

      expect(await mainContract.getMemberByIndex(2)).eq(alice.address)
      const members = await mainContract.getMembers()
      expect(members.length).eq(3)
      expect(members[0]).eq(owner.address)
      expect(members[1]).eq(bob.address)
      expect(members[2]).eq(alice.address)

      expect(await mainContract.isOwner(owner.address)).eq(true)
      expect(await mainContract.isOwner(bob.address)).eq(true)
      expect(await mainContract.isOwner(alice.address)).eq(true)

      expect(await mainContract.getTransactionCount()).eq(2)

      const [transaction, selector] = await mainContract.getTransaction(1)
      expect(transaction.executed).eq(true)
      expect(transaction.data).eq(iFace.encodeFunctionData('addMember', [alice.address]))
      expect(Number(transaction.value)).eq(0)
      expect(Number(transaction.numConfirmations)).eq(2)
      expect(selector).eq(iFace.getSighash('addMember'))
    })
  })

  context('Test case for removeMember', () => {
    it('removeMember should be revert without multisig', async () => {
      await expect(mainContract.removeMember(bob.address)).to.be.revertedWith('Multisig required')
    })

    it('removeMember last member should be revert', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('removeMember', [owner.address]))
      await expect(mainContract.executeTransaction(0)).revertedWith('Tx failed')
    })

    it('removeMember should be correct', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)

      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [alice.address]))
      await mainContract.connect(bob).confirmTransaction(1)
      await mainContract.executeTransaction(1)

      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('removeMember', [bob.address]))
      await mainContract.connect(bob).confirmTransaction(2)
      await mainContract.executeTransaction(2)

      const members = await mainContract.getMembers()
      expect(members.length).eq(2)
      expect(members[0]).eq(owner.address)
      expect(members[1]).eq(alice.address)
    })
  })

  context('Test case for submitTransaction', () => {
    it('submitTransaction should be revert without owner', async () => {
      await expect(mainContract.connect(bob).submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))).revertedWith('Owner required')
    })

    it('submitTransaction should be correct', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)

      expect(await mainContract.isConfirmed(0, owner.address)).eq(true)
      const [transaction, selector] = await mainContract.getTransaction(0)
      expect(transaction.executed).eq(true)
      expect(transaction.data).eq(iFace.encodeFunctionData('addMember', [bob.address]))
      expect(Number(transaction.value)).eq(0)
      expect(Number(transaction.numConfirmations)).eq(1)
      expect(selector).eq(iFace.getSighash('addMember'))
    })
  })

  context('Test case for confirmTransaction', () => {
    it('confirmTransaction should be revert without owner', async () => {
      await expect(mainContract.connect(bob).confirmTransaction(0)).revertedWith('Owner required')
    })

    it('confirmTransaction should be revert without exists', async () => {
      await expect(mainContract.confirmTransaction(0)).revertedWith('Nonexistent tx')
    })

    it('confirmTransaction should be revert with executed', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)
      await expect(mainContract.confirmTransaction(0)).revertedWith('Tx already executed')
    })

    it('confirmTransaction should be revert with already confirmed', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await expect(mainContract.confirmTransaction(0)).revertedWith('Already confirmed')
    })

    it('confirmTransaction should be correct', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)

      expect(await mainContract.isConfirmed(0, owner.address)).eq(true)
      const [transaction, selector] = await mainContract.getTransaction(0)
      expect(transaction.executed).eq(true)
      expect(transaction.data).eq(iFace.encodeFunctionData('addMember', [bob.address]))
      expect(Number(transaction.value)).eq(0)
      expect(Number(transaction.numConfirmations)).eq(1)
      expect(selector).eq(iFace.getSighash('addMember'))
    })
  })

  context('Test case for executeTransaction', () => {
    it('executeTransaction should be revert without owner', async () => {
      await expect(mainContract.connect(bob).executeTransaction(0)).revertedWith('Owner required')
    })

    it('executeTransaction should be revert without exists', async () => {
      await expect(mainContract.executeTransaction(0)).revertedWith('Nonexistent tx')
    })

    it('executeTransaction should be revert with executed', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)
      await expect(mainContract.executeTransaction(0)).revertedWith('Tx already executed')
    })

    it('executeTransaction should be revert without enough confirmations', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)

      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('removeMember', [bob.address]))
      await expect(mainContract.executeTransaction(1)).revertedWith('Confirmations required')
    })

    it('executeTransaction should be correct', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)

      expect(await mainContract.getMemberByIndex(1)).eq(bob.address)
    })
  })

  context('Test case for revokeConfirmation', () => {
    it('revokeConfirmation should be revert without owner', async () => {
      await expect(mainContract.connect(bob).revokeConfirmation(0)).revertedWith('Owner required')
    })

    it('revokeConfirmation should be revert without exists', async () => {
      await expect(mainContract.revokeConfirmation(0)).revertedWith('Nonexistent tx')
    })

    it('revokeConfirmation should be revert with executed', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)
      await expect(mainContract.revokeConfirmation(0)).revertedWith('Tx already executed')
    })

    it('revokeConfirmation should be revert without confirmation', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.executeTransaction(0)

      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('removeMember', [bob.address]))
      await expect(mainContract.connect(bob).revokeConfirmation(1)).revertedWith('Confirmation required')
    })

    it('revokeConfirmation should be correct', async () => {
      await mainContract.submitTransaction(mainContract.address, 0, iFace.encodeFunctionData('addMember', [bob.address]))
      await mainContract.revokeConfirmation(0)

      expect(await mainContract.isConfirmed(0, owner.address)).eq(false)
    })
  })
})
