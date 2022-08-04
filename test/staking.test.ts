import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { TRVGovernance, TRVGovernance__factory } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

describe('Governance Token', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let governanceContract: TRVGovernance

  before(async () => {
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const factory = (await ethers.getContractFactory('TRVGovernance', owner)) as TRVGovernance__factory
    governanceContract = await factory.deploy()
    await governanceContract.deployed()
  })

  context('Test case for initial information', () => {
    it('Initial information should be success', async () => {
      expect(Number(await governanceContract.balanceOf(owner.address))).equal(100000000)
      expect(Number(await governanceContract.decimals())).equal(6)
      // await expect(governanceContract.mint()).revertedWith('abc') // can not mint more
    })
  })

  context('Test case for base action', () => {
    it('transfer should be success', async () => {
      await (await governanceContract.connect(owner).transfer(bob.address, 1000000)).wait()
      expect(Number(await governanceContract.connect(bob).balanceOf(bob.address))).equal(1000000)

      await (await governanceContract.connect(bob).approve(owner.address, 500)).wait()
      await (await governanceContract.connect(owner).transferFrom(bob.address, alice.address, 500)).wait()
      expect(Number(await governanceContract.connect(bob).balanceOf(bob.address))).equal(1000000 - 500)
      expect(Number(await governanceContract.connect(bob).balanceOf(alice.address))).equal(500)
    })
  })
})
