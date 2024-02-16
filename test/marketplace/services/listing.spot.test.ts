import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import { AdotKeeper, AdotKeeper__factory, AdotRouter, AdotRouter__factory, ListingSpot, ListingSpot__factory, MarketplaceRegistry, MarketplaceRegistry__factory, TokenERC1155, TokenERC1155__factory, TokenERC20, TokenERC20__factory, TokenERC721, TokenERC721__factory } from '../../../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import moment from 'moment'
import { find, map } from 'lodash'

chai.use(solidity)
chai.use(chaiAsPromised)
const { expect } = chai

const ethersAbi = ethers.utils.defaultAbiCoder

const defaultAdditional = ethersAbi.encode(
  [
    'tuple(bytes4 id,bytes data)[]', //
  ],
  [[]]
)

describe('Marketplace ListingSpot test', () => {
  const serviceId = ethers.utils.solidityKeccak256(['string'], ['ListingSpot'])
  const keeperId = ethers.utils.solidityKeccak256(['string'], ['AdotKeeper'])
  const routerId = ethers.utils.solidityKeccak256(['string'], ['AdotRouter'])

  // const listedTuple = '["uint256 id","tuple(uint8 state,address lister,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof) runtime,uint256 nonce) item"]'
  // const cancelListedTuple = 'tuple(tuple(address caller,uint256 id) item,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof) runtime)'
  // const fillListedTuple = 'tuple(tuple(address buyer,uint256 id) item,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,bytes32 whitelistProof) runtime)'

  const listingTypes = {
    TokenItem: [
      { name: 'itemType', type: 'uint8' },
      { name: 'token', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    Distribution: [
      { name: 'recipient', type: 'address' },
      { name: 'percentage', type: 'uint256' },
    ],
    Runtime: [
      { name: 'itemType', type: 'uint8' },
      { name: 'paymentToken', type: 'address' },
      { name: 'price', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'whitelistProof', type: 'bytes32' },
      { name: 'data', type: 'bytes' },
    ],
    ListingItem: [
      { name: 'state', type: 'uint8' },
      { name: 'lister', type: 'address' },
      { name: 'items', type: 'TokenItem[]' },
      { name: 'distributions', type: 'Distribution[]' },
      { name: 'runtime', type: 'Runtime' },
      { name: 'nonce', type: 'uint256' },
    ],
  }

  const cancelListingTypes = {
    CancelListing: [
      { name: 'caller', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
  }

  const fillListingTypes = {
    FulfillItem: [
      { name: 'buyer', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
  }

  let accounts: SignerWithAddress[]
  let owner: SignerWithAddress, bob: SignerWithAddress, alice: SignerWithAddress, john: SignerWithAddress
  let mock721: TokenERC721
  let mock1155: TokenERC1155
  let mock20: TokenERC20
  let registry: MarketplaceRegistry
  let keeper: AdotKeeper
  let router: AdotRouter
  let service: ListingSpot

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]

    const mock20Factory = (await ethers.getContractFactory('TokenERC20', owner)) as TokenERC20__factory
    mock20 = await mock20Factory.deploy()
    await mock20.deployed()

    const mock721Factory = (await ethers.getContractFactory('TokenERC721', owner)) as TokenERC721__factory
    mock721 = await mock721Factory.deploy()
    await mock721.deployed()

    const mock1155Factory = (await ethers.getContractFactory('TokenERC1155', owner)) as TokenERC1155__factory
    mock1155 = await mock1155Factory.deploy()
    await mock1155.deployed()

    const registryFactory = (await ethers.getContractFactory('MarketplaceRegistry', owner)) as MarketplaceRegistry__factory
    const registryImpl = await registryFactory.deploy()
    await registryImpl.deployed()
    const bridgeProxyFactory = (await ethers.getContractFactory('NormalProxy', owner)) as any
    registry = await bridgeProxyFactory.deploy(
      registryImpl.address,
      registryImpl.interface.encodeFunctionData(
        'initialize', //
        [owner.address]
      )
    )
    await registry.deployed()
    registry = registryFactory.attach(registry.address)

    // deploy keeper
    const keeperFactory = (await ethers.getContractFactory('AdotKeeper', owner)) as AdotKeeper__factory
    const keeperImpl = await keeperFactory.deploy()
    await keeperImpl.deployed()
    const keeperProxyFactory = (await ethers.getContractFactory('NormalProxy', owner)) as any
    keeper = await keeperProxyFactory.deploy(
      keeperImpl.address,
      keeperImpl.interface.encodeFunctionData(
        'initialize', //
        [registry.address]
      )
    )
    await keeper.deployed()
    keeper = keeperFactory.attach(keeper.address)

    // deploy router
    const routerFactory = (await ethers.getContractFactory('AdotRouter', owner)) as AdotRouter__factory
    const routerImpl = await routerFactory.deploy()
    await routerImpl.deployed()
    const routerProxyFactory = (await ethers.getContractFactory('NormalProxy', owner)) as any
    router = await routerProxyFactory.deploy(
      routerImpl.address,
      routerImpl.interface.encodeFunctionData(
        'initialize', //
        [registry.address]
      )
    )
    await router.deployed()
    router = routerFactory.attach(router.address)

    // deploy service
    const serviceFactory = (await ethers.getContractFactory('ListingSpot', owner)) as ListingSpot__factory
    service = await serviceFactory.deploy(registry.address)
    await service.deployed()

    await registry.modifySystemVerifier(alice.address)
    await registry.createService(keeperId, keeper.address)
    await registry.createService(routerId, router.address)
    await registry.createService(serviceId, service.address)
    await registry.modifySupportedPayableToken(mock20.address, true)
    await registry.modifySupportedPayableToken(bob.address, true)

    await mock721.mint(bob.address, 10)
    await mock721.connect(bob).setApprovalForAll(keeper.address, true)
    await mock1155.mint(bob.address, 0, 10)
    await mock1155.connect(bob).setApprovalForAll(keeper.address, true)
    await mock20.mint(owner.address, 100)
    await mock20.approve(keeper.address, 100)
  })

  context('Test case for initialize', () => {
    it('initialize should be correct', async () => {
      expect(await keeper.registry()).to.be.eq(registry.address)
      expect(await router.registry()).to.be.eq(registry.address)

      expect(await service.LISTING_ID_COUNTER_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LISTING_ID_COUNTER')))
      expect(await service.LISTING_SPOT_ITEM_PREFIX()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LISTING_SPOT_ITEM_')))
      expect(await service.LISTED_SPOT_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LISTED_SPOT_ITEM')))
      expect(await service.UPDATED_LISTING_SPOT_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('UPDATED_LISTING_SPOT_ITEM')))
      expect(await service.CANCELLED_SPOT_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('CANCELLED_SPOT_ITEM')))
      expect(await service.FULFILLED_SPOT_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('FULFILLED_SPOT_ITEM')))
      expect(await service.serviceId()).to.be.eq(serviceId)
    })
  })

  context('Test case for listItem', () => {
    it('listItem should be revert without router', async () => {
      await expect(
        service.connect(bob).listItem(
          {
            state: 0,
            lister: bob.address,
            items: [],
            distributions: [],
            runtime: {
              itemType: 1,
              paymentToken: mock20.address,
              price: 0,
              startTime: 0,
              endTime: 0,
              whitelistProof: ethers.constants.HashZero,
              data: defaultAdditional,
            },
            nonce: 0,
          },
          []
        )
      ).to.be.revertedWith('Require Router')
    })

    it('listItem should be correct', async () => {
      const additional = ethersAbi.encode(
        [
          'tuple(bytes4 id,bytes data)[]', //
        ],
        [
          [
            {
              id: ethers.utils.hexDataSlice(ethers.utils.id('WHITELIST'), 0, 4),
              data: ethers.utils.defaultAbiCoder.encode(['address[]'], [[bob.address]]),
            },
          ],
        ]
      )
      const endTime = moment().add(1, 'days').unix()

      const domain = {
        name: 'Adot',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: service.address,
      }

      let value = {
        state: 0,
        lister: bob.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [
          {
            recipient: alice.address,
            percentage: 10000,
          },
        ],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 100,
          startTime: 0,
          endTime: endTime,
          whitelistProof: ethers.constants.HashZero,
          data: additional,
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)

      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      let tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))).wait()

      let event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      let decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.LISTED_SPOT_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(listedTuple)
      let _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.id.toNumber()).equal(0)
      expect(_listing.item.state).equal(1)
      expect(_listing.item.lister).equal(bob.address)
      expect(_listing.item.items[0].itemType).equal(2)
      expect(_listing.item.items[0].token).equal(mock721.address)
      expect(_listing.item.items[0].id.toNumber()).equal(1)
      expect(_listing.item.items[0].amount.toNumber()).equal(1)
      expect(_listing.item.distributions[0].recipient).equal(alice.address)
      expect(_listing.item.distributions[0].percentage.toNumber()).equal(10000)
      expect(_listing.item.runtime.itemType).equal(1)
      expect(_listing.item.runtime.paymentToken).equal(mock20.address)
      expect(_listing.item.runtime.price.toNumber()).equal(100)
      expect(_listing.item.runtime.startTime.toNumber()).equal(0)
      expect(_listing.item.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.item.runtime.whitelistProof).equal(ethers.constants.HashZero)
      expect(_listing.item.runtime.data).equal(additional)
      expect(_listing.item.nonce.toNumber()).equal(0)

      let res = await router.forwardStaticcallRequest(
        keeperId,
        keeper.interface.encodeFunctionData('getUint256', [
          serviceId, //
          await service.LISTING_ID_COUNTER_KEY(),
        ])
      )
      expect(res[0]).equal(true)
      expect(ethersAbi.decode(['uint256'], res[1])[0]).equal(1)

      res = await router.forwardStaticcallRequest(
        keeperId,
        keeper.interface.encodeFunctionData('getNonce', [
          serviceId, //
          bob.address,
        ])
      )
      expect(res[0]).equal(true)
      expect(ethersAbi.decode(['uint256'], res[1])[0]).equal(1)

      value = {
        state: 0,
        lister: bob.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [
          {
            recipient: alice.address,
            percentage: 10000,
          },
        ],
        runtime: {
          itemType: 1,
          paymentToken: bob.address,
          price: 1000,
          startTime: 1,
          endTime: endTime + 100,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional,
        },
        nonce: 1,
      }

      signature = await bob._signTypedData(domain, listingTypes, value)

      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('updateListing', [0, value, [signature, systemSignature]]))).wait()

      event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.UPDATED_LISTING_SPOT_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(listedTuple)
      _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.id.toNumber()).equal(0)
      expect(_listing.item.state).equal(1)
      expect(_listing.item.lister).equal(bob.address)
      expect(_listing.item.items[0].itemType).equal(2)
      expect(_listing.item.items[0].token).equal(mock721.address)
      expect(_listing.item.items[0].id.toNumber()).equal(1)
      expect(_listing.item.items[0].amount.toNumber()).equal(1)
      expect(_listing.item.distributions[0].recipient).equal(alice.address)
      expect(_listing.item.distributions[0].percentage.toNumber()).equal(10000)
      expect(_listing.item.runtime.itemType).equal(1)
      expect(_listing.item.runtime.paymentToken).equal(bob.address)
      expect(_listing.item.runtime.price.toNumber()).equal(1000)
      expect(_listing.item.runtime.startTime.toNumber()).equal(1)
      expect(_listing.item.runtime.endTime.toNumber()).equal(endTime + 100)
      expect(_listing.item.runtime.whitelistProof).equal(ethers.constants.HashZero)
      expect(_listing.item.runtime.data).equal(defaultAdditional)
      expect(_listing.item.nonce.toNumber()).equal(1)

      res = await router.forwardStaticcallRequest(
        keeperId,
        keeper.interface.encodeFunctionData('getNonce', [
          serviceId, //
          bob.address,
        ])
      )
      expect(res[0]).equal(true)
      expect(ethersAbi.decode(['uint256'], res[1])[0]).equal(2)
    })
  })

  context('Test case for cancelListing', () => {
    it('cancelListing should be revert without router', async () => {
      await expect(
        service.connect(bob).cancelListing(
          {
            caller: bob.address,
            id: 0,
          },
          []
        )
      ).to.be.revertedWith('Require Router')
    })

    it('cancelListing should be correct', async () => {
      const endTime = moment().add(1, 'days').unix()

      const domain = {
        name: 'Adot',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: service.address,
      }

      let value: any = {
        state: 0,
        lister: bob.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [
          {
            recipient: alice.address,
            percentage: 10000,
          },
        ],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 100,
          startTime: 0,
          endTime: endTime,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional,
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))

      value = {
        caller: bob.address,
        id: 0,
      }
      signature = await bob._signTypedData(domain, cancelListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('cancelListing', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.CANCELLED_SPOT_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(cancelListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.caller).equal(bob.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.runtime.whitelistProof).equal(ethers.constants.HashZero)

      // await router.forwardRequest(serviceId, service.interface.encodeFunctionData('cancelListing', [value, [signature, systemSignature]]))
    })

    it('cancelListing should be correct when using system checker', async () => {
      const endTime = moment().add(1, 'days').unix()

      const domain = {
        name: 'Adot',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: service.address,
      }

      let value: any = {
        state: 0,
        lister: bob.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [
          {
            recipient: alice.address,
            percentage: 10000,
          },
        ],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 100,
          startTime: 0,
          endTime: endTime,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional,
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))

      value = {
        caller: alice.address,
        id: 0,
      }
      signature = await alice._signTypedData(domain, cancelListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('cancelListing', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.CANCELLED_SPOT_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(cancelListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.caller).equal(alice.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.runtime.whitelistProof).equal(ethers.constants.HashZero)

      // await router.forwardRequest(serviceId, service.interface.encodeFunctionData('cancelListing', [value, [signature, systemSignature]]))
    })
  })

  context('Test case for fullfillItem', () => {
    it('fullfillItem should be revert without router', async () => {
      await expect(
        service.connect(bob).fullfillItem(
          {
            buyer: bob.address,
            id: 0,
          },
          []
        )
      ).to.be.revertedWith('Require Router')
    })

    it('fullfillItem should be correct', async () => {
      const endTime = moment().add(1, 'days').unix()

      const domain = {
        name: 'Adot',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: service.address,
      }

      let value: any = {
        state: 0,
        lister: bob.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [
          {
            recipient: alice.address,
            percentage: 10000,
          },
        ],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 100,
          startTime: 0,
          endTime: endTime,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional,
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))

      value = {
        buyer: owner.address,
        id: 0,
      }
      signature = await owner._signTypedData(domain, fillListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('fullfillItem', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.FULFILLED_SPOT_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(fillListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.buyer).equal(owner.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.runtime.whitelistProof).equal(ethers.constants.HashZero)

      expect(await mock721.balanceOf(owner.address)).equal(1)
      expect(await mock721.balanceOf(bob.address)).equal(9)
      expect(await mock20.balanceOf(alice.address)).equal(100)
      expect(await mock20.balanceOf(owner.address)).equal(0)
      expect(await mock721.ownerOf(1)).equal(owner.address)
    })

    it('fullfillItem should be correct', async () => {
      const endTime = moment().add(1, 'days').unix()

      const domain = {
        name: 'Adot',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: service.address,
      }

      let value: any = {
        state: 0,
        lister: bob.address,
        items: [
          {
            itemType: 3,
            token: mock1155.address,
            id: 0,
            amount: 10,
          },
        ],
        distributions: [
          {
            recipient: alice.address,
            percentage: 10000,
          },
        ],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 100,
          startTime: 0,
          endTime: endTime,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional,
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await service.verifyListingItem(value, [signature, systemSignature])
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))

      value = {
        buyer: owner.address,
        id: 0,
      }
      signature = await owner._signTypedData(domain, fillListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('fullfillItem', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.FULFILLED_SPOT_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(fillListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.buyer).equal(owner.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.runtime.whitelistProof).equal(ethers.constants.HashZero)

      expect(await mock1155.balanceOf(owner.address, 0)).equal(10)
      expect(await mock1155.balanceOf(bob.address, 0)).equal(0)
      expect(await mock20.balanceOf(alice.address)).equal(100)
      expect(await mock20.balanceOf(owner.address)).equal(0)
    })
  })
})
