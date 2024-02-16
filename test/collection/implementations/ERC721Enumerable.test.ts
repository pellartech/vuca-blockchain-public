import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { ContractProxy__factory, AdotERC721Enumerable, AdotERC721Enumerable__factory } from '../../../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import moment from 'moment'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const iFace = new ethers.utils.Interface(AdotERC721Enumerable__factory.abi)
const proxyByteCodeHash = ethers.utils.keccak256(ContractProxy__factory.bytecode)
console.log('Contract Proxy bytecode hash', proxyByteCodeHash)

describe('AdotFactory test ERC721Enumerable', () => {
  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress,
    bob: SignerWithAddress, //
    alice: SignerWithAddress,
    john: SignerWithAddress,
    royaltyRecipient: SignerWithAddress,
    saleRecipient: SignerWithAddress
  let mainContract: AdotERC721Enumerable

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]
    john = accounts[3]
    saleRecipient = accounts[4]
    royaltyRecipient = accounts[5]

    const factoryImplFactory = (await ethers.getContractFactory('AdotFactory', owner)) as any
    const factoryImplContract = await factoryImplFactory.deploy()
    await factoryImplContract.deployed()

    const factoryIns = (await ethers.getContractFactory('NormalProxy', owner)) as any
    let factoryContractIns = await factoryIns.deploy(factoryImplContract.address, factoryImplContract.interface.encodeFunctionData('initialize', []))
    await factoryContractIns.deployed()
    factoryContractIns = factoryImplContract.attach(factoryContractIns.address)

    const registryImplFactory = (await ethers.getContractFactory('AdotRegistry', owner)) as any
    const registryImplContract = await registryImplFactory.deploy()
    await registryImplContract.deployed()

    const registryIns = (await ethers.getContractFactory('NormalProxy', owner)) as any
    let registryContractIns = await registryIns.deploy(registryImplContract.address, registryImplContract.interface.encodeFunctionData('initialize', []))
    await registryContractIns.deployed()
    registryContractIns = registryImplContract.attach(registryContractIns.address)
    await registryContractIns.setPlatformFeeReceiver(alice.address)
    await registryContractIns.setPlatformFee(1000)
    await registryContractIns.setVerifier(john.address)

    const erc721ImplFactory = (await ethers.getContractFactory('AdotERC721Enumerable', owner)) as any
    const erc721ImplContract = await erc721ImplFactory.deploy()
    await erc721ImplContract.deployed()

    const hash = ethers.utils.solidityKeccak256(['string'], ['ERC721Enumerable'])
    await factoryContractIns.addImplementation(hash, erc721ImplContract.address)

    const expected = ethers.utils.getCreate2Address(factoryContractIns.address, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [owner.address, 0])), proxyByteCodeHash)

    const initialize = iFace.encodeFunctionData('initialize', [
      registryContractIns.address, //
      owner.address,
      'ERC721',
      'ERC721',
      saleRecipient.address,
      royaltyRecipient.address,
      1000,
    ])
    await factoryContractIns.deployProxy(hash, initialize)
    expect(await factoryContractIns.deployer(expected)).eq(owner.address)

    mainContract = erc721ImplContract.attach(expected)
  })

  context('Test case for initialize', () => {
    it('init data should be correct', async () => {
      expect(await mainContract.name()).eq('ERC721')
      expect(await mainContract.symbol()).eq('ERC721')
      expect(await mainContract.registry()).eq(await mainContract.registry())
      expect(await mainContract.owner()).eq(owner.address)
      expect(await mainContract.saleRecipient()).eq(saleRecipient.address)
    })
  })

  context('Test case for setPrimaryRoyalty', () => {
    it('setPrimaryRoyalty should be revert without owner', async () => {
      await expect(mainContract.connect(bob).setPrimaryRoyalty(bob.address, 10)).revertedWith('Ownable: caller is not the owner')
    })

    it('setPrimaryRoyalty should be correct', async () => {
      await mainContract.setPrimaryRoyalty(bob.address, 10)
    })
  })

  context('Test case for deleteDefaultRoyalty', () => {
    it('deleteDefaultRoyalty should be revert without owner', async () => {
      await expect(mainContract.connect(bob).deleteDefaultRoyalty()).revertedWith('Ownable: caller is not the owner')
    })

    it('deleteDefaultRoyalty should be correct', async () => {
      await mainContract.deleteDefaultRoyalty()
    })
  })

  context('Test case for setRoyaltyInfoForToken', () => {
    it('setRoyaltyInfoForToken should be revert without owner', async () => {
      await expect(mainContract.connect(bob).setRoyaltyInfoForToken(1, bob.address, 10)).revertedWith('Ownable: caller is not the owner')
    })

    it('setRoyaltyInfoForToken should be correct', async () => {
      await mainContract.setRoyaltyInfoForToken(1, bob.address, 1000) // 10%
      const res = await mainContract.royaltyInfo(1, 1000)
      expect(res[0]).eq(bob.address)
      expect(res[1]).eq(100)
    })
  })

  context('Test case for resetRoyaltyInforToken', () => {
    it('resetRoyaltyInforToken should be revert without owner', async () => {
      await expect(mainContract.connect(bob).resetRoyaltyInforToken(1)).revertedWith('Ownable: caller is not the owner')
    })

    it('resetRoyaltyInforToken should be correct', async () => {
      await mainContract.setRoyaltyInfoForToken(1, bob.address, 100) // 1%
      await mainContract.resetRoyaltyInforToken(1)
      const res = await mainContract.royaltyInfo(1, 1000)
      expect(res[0]).eq(royaltyRecipient.address) // default
      expect(res[1]).eq(100) // default
    })
  })

  context('Test case for lazyMint', () => {
    it('lazyMint should be revert without owner', async () => {
      await expect(mainContract.connect(bob).lazyMint('', '0x')).revertedWith('Ownable: caller is not the owner')
    })

    it('lazyMint should be correct', async () => {
      const uriPath = 'abcxyz'
      const message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'string'], [1337, mainContract.address, uriPath])
      const messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      const signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.lazyMint(uriPath, signature)

      expect(await mainContract.lazyMintIdx()).eq(1)
      expect(await mainContract.uris(0)).eq(uriPath)
    })
  })

  context('Test case for lazyMint', () => {
    it('lazyMint should be revert without owner', async () => {
      await expect(mainContract.connect(bob).lazyMint('', '0x')).revertedWith('Ownable: caller is not the owner')
    })

    it('lazyMint should be correct', async () => {
      const uriPath = 'abcxyz'
      const message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'string'], [1337, mainContract.address, uriPath])
      const messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      const signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.lazyMint(uriPath, signature)

      expect(await mainContract.lazyMintIdx()).eq(1)
      expect(await mainContract.uris(0)).eq(uriPath)
    })
  })

  context('Test case for updateLazyMint', () => {
    it('updateLazyMint should be revert without owner', async () => {
      await expect(mainContract.connect(bob).updateLazyMint(0, '', '0x')).revertedWith('Ownable: caller is not the owner')
    })

    it('updateLazyMint should be correct', async () => {
      let uriPath = 'abcxyz'
      let message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'string'], [1337, mainContract.address, uriPath])
      let messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      let signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.lazyMint(uriPath, signature)

      expect(await mainContract.lazyMintIdx()).eq(1)

      uriPath = 'abcxyz2'
      message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'string'], [1337, mainContract.address, uriPath])
      messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      signature = await john.signMessage(ethers.utils.arrayify(messageHashed))
      await mainContract.updateLazyMint(0, uriPath, signature)

      expect(await mainContract.lazyMintIdx()).eq(1)
      expect(await mainContract.uris(0)).eq(uriPath)
    })
  })

  context('Test case for setPhaseCondition', () => {
    it('setPhaseCondition should be revert without owner', async () => {
      await expect(mainContract.connect(bob).setPhaseCondition('0x', '0x')).revertedWith('Ownable: caller is not the owner')
      await expect(mainContract.connect(bob).updatePhaseCondition(0, '0x', '0x')).revertedWith('Ownable: caller is not the owner')
      await expect(mainContract.connect(bob).resetEligible(0)).revertedWith('Ownable: caller is not the owner')
    })

    it('setPhaseCondition should be correct', async () => {
      let currentUnix = moment.utc().unix()
      let endTime = currentUnix + 60 * 60 * 24 * 30
      let config = ethers.utils.defaultAbiCoder.encode(
        [
          'uint8', //
          'string',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'uint64',
          'uint64',
          'bytes32',
        ],
        [
          0, //
          'Phase 1',
          100,
          10,
          ethers.constants.AddressZero,
          ethers.utils.parseEther('0.1'),
          currentUnix,
          endTime,
          ethers.constants.HashZero,
        ]
      )
      let configHashed = ethers.utils.keccak256(ethers.utils.arrayify(config))
      let message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256', 'bytes32'], [1337, mainContract.address, 0, configHashed])
      let messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      let signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.setPhaseCondition(config, signature)

      let phaseCondition = await mainContract.getPhaseCondition(0)
      expect(phaseCondition[0]).eq(0)
      let claimCondition = phaseCondition[1]
      expect(claimCondition.claimType).eq(0)
      expect(claimCondition.name).eq('Phase 1')
      expect(claimCondition.amount).eq(100)
      expect(claimCondition.maxPerWallet).eq(10)
      expect(claimCondition.currency).eq(ethers.constants.AddressZero)
      expect(claimCondition.price).eq(ethers.utils.parseEther('0.1'))
      expect(claimCondition.startTime).eq(currentUnix)
      expect(claimCondition.endTime).eq(endTime)
      expect(claimCondition.allocationProof).eq(ethers.constants.HashZero)

      currentUnix = moment.utc().unix()
      endTime = currentUnix + 60 * 60 * 24 * 30
      config = ethers.utils.defaultAbiCoder.encode(
        [
          'uint8', //
          'string',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'uint64',
          'uint64',
          'bytes32',
        ],
        [
          1, //
          'Phase 1.1',
          101,
          11,
          ethers.constants.AddressZero,
          ethers.utils.parseEther('0.11'),
          currentUnix,
          endTime,
          ethers.constants.HashZero,
        ]
      )
      configHashed = ethers.utils.keccak256(ethers.utils.arrayify(config))
      message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256', 'bytes32'], [1337, mainContract.address, 0, configHashed])
      messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.updatePhaseCondition(0, config, signature)
      phaseCondition = await mainContract.getPhaseCondition(0)
      expect(phaseCondition[0]).eq(0)
      claimCondition = phaseCondition[1]
      expect(claimCondition.claimType).eq(1)
      expect(claimCondition.name).eq('Phase 1.1')
      expect(claimCondition.amount).eq(101)
      expect(claimCondition.maxPerWallet).eq(11)
      expect(claimCondition.currency).eq(ethers.constants.AddressZero)
      expect(claimCondition.price).eq(ethers.utils.parseEther('0.11'))
      expect(claimCondition.startTime).eq(currentUnix)
      expect(claimCondition.endTime).eq(endTime)
      expect(claimCondition.allocationProof).eq(ethers.constants.HashZero)

      await mainContract.resetEligible(0)
      phaseCondition = await mainContract.getPhaseCondition(0)
      expect(phaseCondition[0]).eq(1)

      await mainContract.deletePhaseCondition(0)
      phaseCondition = await mainContract.getPhaseCondition(0)
      expect(phaseCondition.claimCondition.removed).eq(true)
    })
  })

  context('Test case for claim', () => {
    it('claim should be revert without phase', async () => {
      await expect(mainContract.claim(0, 10, '0x')).revertedWith('Invalid phase')
    })

    it('claim with public phase should be correct', async () => {
      let currentUnix = moment.utc().unix() - 10000
      let endTime = currentUnix + 60 * 60 * 24 * 30
      let config = ethers.utils.defaultAbiCoder.encode(
        [
          'uint8', //
          'string',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'uint64',
          'uint64',
          'bytes32',
        ],
        [
          1, //
          'Phase 1',
          11,
          10,
          ethers.constants.AddressZero,
          ethers.utils.parseEther('0.1'),
          currentUnix,
          endTime,
          ethers.constants.HashZero,
        ]
      )
      let configHashed = ethers.utils.keccak256(ethers.utils.arrayify(config))
      let message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256', 'bytes32'], [1337, mainContract.address, 0, configHashed])
      let messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      let signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.setPhaseCondition(config, signature)

      const balanceBefore = await alice.getBalance()

      await mainContract.connect(bob).claim(0, 10, '0x', {
        value: ethers.utils.parseEther('0.1').mul(10),
      })

      const balanceAfter = await alice.getBalance()
      expect(balanceAfter.sub(balanceBefore)).eq(ethers.utils.parseEther('0.1').mul(1)) // 10%

      const saleRecipientBalance = await saleRecipient.getBalance()

      await mainContract.withdraw(ethers.constants.AddressZero, ethers.utils.parseEther('0.1').mul(9))

      const saleRecipientBalanceAfter = await saleRecipient.getBalance()
      expect(saleRecipientBalanceAfter.sub(saleRecipientBalance)).eq(ethers.utils.parseEther('0.1').mul(9)) // 90%

      expect(await mainContract.totalSupply()).eq(10)
      expect(await mainContract.balanceOf(bob.address)).eq(10)
      expect(await mainContract.tokenByIndex(0)).eq(0)
      expect(await mainContract.tokenByIndex(9)).eq(9)
      expect(await mainContract.tokenOfOwnerByIndex(bob.address, 0)).eq(0)
      expect(await mainContract.tokenOfOwnerByIndex(bob.address, 9)).eq(9)

      expect(await mainContract.getPhaseConditionClaimed(0, bob.address)).eq(10)
      expect(await mainContract.getPhaseConditionClaimedWithVersion(0, 0, bob.address)).eq(10)
      expect(await mainContract.getPhaseTotalClaimed(0)).eq(10)
      expect(await mainContract.getPhaseTotalClaimedWithVersion(0, 0)).eq(10)

      await expect(
        mainContract.connect(bob).claim(0, 1, '0x', {
          value: ethers.utils.parseEther('0.1').mul(1),
        })
      ).revertedWith('Exceeds max per wallet')

      await mainContract.resetEligible(0)

      await mainContract.connect(bob).claim(0, 10, '0x', {
        value: ethers.utils.parseEther('0.1').mul(10),
      })

      expect(await mainContract.totalSupply()).eq(20)
      expect(await mainContract.getPhaseConditionClaimed(0, bob.address)).eq(10)
      expect(await mainContract.getPhaseConditionClaimedWithVersion(0, 1, bob.address)).eq(10)
      expect(await mainContract.getPhaseTotalClaimed(0)).eq(10)
      expect(await mainContract.getPhaseTotalClaimedWithVersion(0, 1)).eq(10)

      await expect(
        mainContract.connect(alice).claim(0, 10, '0x', {
          value: ethers.utils.parseEther('0.1').mul(10),
        })
      ).revertedWith('Exceeds max')

      await mainContract.resetEligible(0)
      await mainContract.deletePhaseCondition(0)

      await expect(
        mainContract.connect(bob).claim(0, 10, '0x', {
          value: ethers.utils.parseEther('0.1').mul(10),
        })
      ).revertedWith('Phase removed')

      const tokenURI = await mainContract.tokenURI(0)
      expect(tokenURI).eq(`https://assets-vuca-prod.s3.ap-southeast-1.amazonaws.com/metadata/${String(mainContract.address).toLowerCase()}/0`)
    })

    it('claim with private phase should be correct', async () => {
      let currentUnix = moment.utc().unix() - 10000
      let endTime = currentUnix + 60 * 60 * 24 * 30
      let config = ethers.utils.defaultAbiCoder.encode(
        [
          'uint8', //
          'string',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'uint64',
          'uint64',
          'bytes32',
        ],
        [
          0, //
          'Phase 1',
          11,
          10,
          ethers.constants.AddressZero,
          ethers.utils.parseEther('0.1'),
          currentUnix,
          endTime,
          ethers.constants.HashZero,
        ]
      )
      let configHashed = ethers.utils.keccak256(ethers.utils.arrayify(config))
      let message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256', 'bytes32'], [1337, mainContract.address, 0, configHashed])
      let messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      let signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.setPhaseCondition(config, signature)

      const balanceBefore = await alice.getBalance()

      message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes32'], [1337, mainContract.address, bob.address, 0, 0, ethers.constants.HashZero])
      messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.connect(bob).claim(0, 10, signature, {
        value: ethers.utils.parseEther('0.1').mul(10),
      })

      const balanceAfter = await alice.getBalance()
      expect(balanceAfter.sub(balanceBefore)).eq(ethers.utils.parseEther('0.1').mul(1)) // 10%

      const saleRecipientBalance = await saleRecipient.getBalance()

      await mainContract.withdraw(ethers.constants.AddressZero, ethers.utils.parseEther('0.1').mul(9))

      const saleRecipientBalanceAfter = await saleRecipient.getBalance()
      expect(saleRecipientBalanceAfter.sub(saleRecipientBalance)).eq(ethers.utils.parseEther('0.1').mul(9)) // 90%

      expect(await mainContract.totalSupply()).eq(10)
      expect(await mainContract.balanceOf(bob.address)).eq(10)
      expect(await mainContract.tokenByIndex(0)).eq(0)
      expect(await mainContract.tokenByIndex(9)).eq(9)
      expect(await mainContract.tokenOfOwnerByIndex(bob.address, 0)).eq(0)
      expect(await mainContract.tokenOfOwnerByIndex(bob.address, 9)).eq(9)

      expect(await mainContract.getPhaseConditionClaimed(0, bob.address)).eq(10)
      expect(await mainContract.getPhaseConditionClaimedWithVersion(0, 0, bob.address)).eq(10)
      expect(await mainContract.getPhaseTotalClaimed(0)).eq(10)
      expect(await mainContract.getPhaseTotalClaimedWithVersion(0, 0)).eq(10)
    })

    it('claimTo with public phase should be correct', async () => {
      let currentUnix = moment.utc().unix() - 10000
      let endTime = currentUnix + 60 * 60 * 24 * 30
      let config = ethers.utils.defaultAbiCoder.encode(
        [
          'uint8', //
          'string',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'uint64',
          'uint64',
          'bytes32',
        ],
        [
          1, //
          'Phase 1',
          11,
          10,
          ethers.constants.AddressZero,
          ethers.utils.parseEther('0.1'),
          currentUnix,
          endTime,
          ethers.constants.HashZero,
        ]
      )
      let configHashed = ethers.utils.keccak256(ethers.utils.arrayify(config))
      let message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256', 'bytes32'], [1337, mainContract.address, 0, configHashed])
      let messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      let signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.setPhaseCondition(config, signature)

      const balanceBefore = await alice.getBalance()

      await mainContract.connect(bob).claimTo(john.address, 0, 10, '0x', {
        value: ethers.utils.parseEther('0.1').mul(10),
      })

      const balanceAfter = await alice.getBalance()
      expect(balanceAfter.sub(balanceBefore)).eq(ethers.utils.parseEther('0.1').mul(1)) // 10%

      const saleRecipientBalance = await saleRecipient.getBalance()

      await mainContract.withdraw(ethers.constants.AddressZero, ethers.utils.parseEther('0.1').mul(9))

      const saleRecipientBalanceAfter = await saleRecipient.getBalance()
      expect(saleRecipientBalanceAfter.sub(saleRecipientBalance)).eq(ethers.utils.parseEther('0.1').mul(9)) // 90%

      expect(await mainContract.totalSupply()).eq(10)
      expect(await mainContract.balanceOf(john.address)).eq(10)
      expect(await mainContract.tokenByIndex(0)).eq(0)
      expect(await mainContract.tokenByIndex(9)).eq(9)
      expect(await mainContract.tokenOfOwnerByIndex(john.address, 0)).eq(0)
      expect(await mainContract.tokenOfOwnerByIndex(john.address, 9)).eq(9)

      expect(await mainContract.getPhaseConditionClaimed(0, bob.address)).eq(10)
      expect(await mainContract.getPhaseConditionClaimedWithVersion(0, 0, bob.address)).eq(10)
      expect(await mainContract.getPhaseTotalClaimed(0)).eq(10)
      expect(await mainContract.getPhaseTotalClaimedWithVersion(0, 0)).eq(10)

      await expect(
        mainContract.connect(bob).claim(0, 1, '0x', {
          value: ethers.utils.parseEther('0.1').mul(1),
        })
      ).revertedWith('Exceeds max per wallet')

      await mainContract.resetEligible(0)

      await mainContract.connect(bob).claim(0, 10, '0x', {
        value: ethers.utils.parseEther('0.1').mul(10),
      })

      expect(await mainContract.totalSupply()).eq(20)
      expect(await mainContract.getPhaseConditionClaimed(0, bob.address)).eq(10)
      expect(await mainContract.getPhaseConditionClaimedWithVersion(0, 1, bob.address)).eq(10)
      expect(await mainContract.getPhaseTotalClaimed(0)).eq(10)
      expect(await mainContract.getPhaseTotalClaimedWithVersion(0, 1)).eq(10)

      await expect(
        mainContract.connect(alice).claim(0, 10, '0x', {
          value: ethers.utils.parseEther('0.1').mul(10),
        })
      ).revertedWith('Exceeds max')

      await mainContract.resetEligible(0)
      await mainContract.deletePhaseCondition(0)

      await expect(
        mainContract.connect(bob).claim(0, 10, '0x', {
          value: ethers.utils.parseEther('0.1').mul(10),
        })
      ).revertedWith('Phase removed')
    })

    it('claimTo with private phase should be correct', async () => {
      let currentUnix = moment.utc().unix() - 10000
      let endTime = currentUnix + 60 * 60 * 24 * 30
      let config = ethers.utils.defaultAbiCoder.encode(
        [
          'uint8', //
          'string',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'uint64',
          'uint64',
          'bytes32',
        ],
        [
          0, //
          'Phase 1',
          11,
          10,
          ethers.constants.AddressZero,
          ethers.utils.parseEther('0.1'),
          currentUnix,
          endTime,
          ethers.constants.HashZero,
        ]
      )
      let configHashed = ethers.utils.keccak256(ethers.utils.arrayify(config))
      let message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256', 'bytes32'], [1337, mainContract.address, 0, configHashed])
      let messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      let signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.setPhaseCondition(config, signature)

      const balanceBefore = await alice.getBalance()

      message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes32'], [1337, mainContract.address, bob.address, 0, 0, ethers.constants.HashZero])
      messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.connect(bob).claimTo(john.address, 0, 10, signature, {
        value: ethers.utils.parseEther('0.1').mul(10),
      })

      const balanceAfter = await alice.getBalance()
      expect(balanceAfter.sub(balanceBefore)).eq(ethers.utils.parseEther('0.1').mul(1)) // 10%

      const saleRecipientBalance = await saleRecipient.getBalance()

      await mainContract.withdraw(ethers.constants.AddressZero, ethers.utils.parseEther('0.1').mul(9))

      const saleRecipientBalanceAfter = await saleRecipient.getBalance()
      expect(saleRecipientBalanceAfter.sub(saleRecipientBalance)).eq(ethers.utils.parseEther('0.1').mul(9)) // 90%

      expect(await mainContract.totalSupply()).eq(10)
      expect(await mainContract.balanceOf(john.address)).eq(10)
      expect(await mainContract.tokenByIndex(0)).eq(0)
      expect(await mainContract.tokenByIndex(9)).eq(9)
      expect(await mainContract.tokenOfOwnerByIndex(john.address, 0)).eq(0)
      expect(await mainContract.tokenOfOwnerByIndex(john.address, 9)).eq(9)

      expect(await mainContract.getPhaseConditionClaimed(0, bob.address)).eq(10)
      expect(await mainContract.getPhaseConditionClaimedWithVersion(0, 0, bob.address)).eq(10)
      expect(await mainContract.getPhaseTotalClaimed(0)).eq(10)
      expect(await mainContract.getPhaseTotalClaimedWithVersion(0, 0)).eq(10)
    })
  })

  context('Test case for delegacyClaim', () => {
    it('delegacyClaim with public phase should be correct', async () => {
      let currentUnix = moment.utc().unix() - 10000
      let endTime = currentUnix + 60 * 60 * 24 * 30
      let config = ethers.utils.defaultAbiCoder.encode(
        [
          'uint8', //
          'string',
          'uint256',
          'uint256',
          'address',
          'uint256',
          'uint64',
          'uint64',
          'bytes32',
        ],
        [
          0, //
          'Phase 1',
          11,
          10,
          ethers.constants.AddressZero,
          ethers.utils.parseEther('0'),
          currentUnix,
          endTime,
          ethers.constants.HashZero,
        ]
      )
      let configHashed = ethers.utils.keccak256(ethers.utils.arrayify(config))
      let message = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'uint256', 'bytes32'], [1337, mainContract.address, 0, configHashed])
      let messageHashed = ethers.utils.keccak256(ethers.utils.arrayify(message))
      let signature = await john.signMessage(ethers.utils.arrayify(messageHashed))

      await mainContract.setPhaseCondition(config, signature)

      const domain = {
        name: 'Adot',
        version: '1',
        chainId: 1337,
        verifyingContract: mainContract.address,
      }

      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' }, //
          { name: 'dataHash', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
        ],
      }

      const wlMessage = ethers.utils.defaultAbiCoder.encode(['uint256', 'address', 'address', 'uint256', 'uint256', 'bytes32'], [1337, mainContract.address, bob.address, 0, 0, ethers.constants.HashZero])

      const wlMessageHashed = ethers.utils.keccak256(ethers.utils.arrayify(wlMessage))
      const wlSignature = await john.signMessage(ethers.utils.arrayify(wlMessageHashed))

      const calldata = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256', 'bytes'], [0, 1, wlSignature])

      const value = {
        from: bob.address,
        dataHash: ethers.utils.keccak256(ethers.utils.arrayify(calldata)),
        nonce: 0,
      }

      const signature2 = await bob._signTypedData(domain, types, value)

      const txn = await (await mainContract.connect(owner).delegacyClaim(value, calldata, signature2)).wait()
      console.log(txn.gasUsed.toString())

      expect(await mainContract.nonce(bob.address)).eq(1)
    })
  })
})
