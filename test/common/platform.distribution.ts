import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PlatformDistribution, PlatformDistribution__factory, TokenERC20, TokenERC20__factory } from '../../typechain-types'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const iFace = new ethers.utils.Interface(PlatformDistribution__factory.abi)

describe('PlatformDistribution test', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let mock20: TokenERC20
  let mainContract: PlatformDistribution

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const mock20Factory = (await ethers.getContractFactory('TokenERC20', owner)) as TokenERC20__factory
    mock20 = await mock20Factory.deploy()
    await mock20.deployed()

    const factory = (await ethers.getContractFactory('PlatformDistribution', owner)) as PlatformDistribution__factory
    mainContract = await factory.deploy()
    await mainContract.deployed()
  })

  context('Test case for chargeTokens', () => {
    it('chargeTokens should be correct', async () => {
      const distributions = [
        {
          to: bob.address,
          amount: ethers.utils.parseEther('1').toString(),
        },
        {
          to: alice.address,
          amount: ethers.utils.parseEther('2').toString(),
        },
      ]

      const hashed = ethers.utils.keccak256(
        ethers.utils.arrayify(
          ethers.utils.defaultAbiCoder.encode(
            ['tuple(address to,uint256 amount)[]'], //
            [distributions]
          )
        )
      )

      let id = ethers.utils.keccak256(
        ethers.utils.arrayify(
          ethers.utils.defaultAbiCoder.encode(
            ['address', 'bytes32', 'uint256'], //
            [ethers.constants.AddressZero, hashed, 0]
          )
        )
      )

      const oldBobBalance = await bob.getBalance()
      const oldAliceBalance = await alice.getBalance()
      await mainContract.chargeTokens(id, ethers.constants.AddressZero, distributions, 0, {
        value: ethers.utils.parseEther('3'),
      })

      const newBobBalance = await bob.getBalance()
      const newAliceBalance = await alice.getBalance()

      expect(newBobBalance.sub(oldBobBalance)).eq(ethers.utils.parseEther('1'))
      expect(newAliceBalance.sub(oldAliceBalance)).eq(ethers.utils.parseEther('2'))

      expect(await mainContract.executed(id)).eq(true)

      await expect(mainContract.chargeTokens(id, ethers.constants.AddressZero, distributions, 0)).revertedWith('PlatformDistribution: already executed')

      await mock20.connect(owner).mint(owner.address, ethers.utils.parseEther('100'))

      await mock20.connect(owner).approve(mainContract.address, ethers.utils.parseEther('100'))

      id = ethers.utils.keccak256(
        ethers.utils.arrayify(
          ethers.utils.defaultAbiCoder.encode(
            ['address', 'bytes32', 'uint256'], //
            [mock20.address, hashed, 0]
          )
        )
      )

      await mainContract.chargeTokens(id, mock20.address, distributions, 0)

      expect(await mock20.balanceOf(bob.address)).eq(ethers.utils.parseEther('1'))
      expect(await mock20.balanceOf(alice.address)).eq(ethers.utils.parseEther('2'))
    })
  })
})
