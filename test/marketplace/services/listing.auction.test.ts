import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import {
  AdotKeeper,
  AdotKeeper__factory, //
  AdotRouter,
  AdotRouter__factory,
  ListingEnglishAuction,
  ListingEnglishAuction__factory,
  MarketplaceRegistry,
  MarketplaceRegistry__factory,
  TokenERC1155,
  TokenERC1155__factory,
  TokenERC20,
  TokenERC20__factory,
  TokenERC721,
  TokenERC721__factory,
} from '../../../typechain-types'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import moment from 'moment'
import { find } from 'lodash'

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

describe('Marketplace EAuction test', () => {
  const serviceId = ethers.utils.solidityKeccak256(['string'], ['ListingEnglishAuction'])
  const keeperId = ethers.utils.solidityKeccak256(['string'], ['AdotKeeper'])
  const routerId = ethers.utils.solidityKeccak256(['string'], ['AdotRouter'])

  // const listedTuple = 'tuple(uint256 id,tuple(uint8 state, address lister,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof) runtime,uint256 nonce) item)'
  // const bidedTuple = 'tuple(uint256 id,tuple(address bidder,uint256 id,uint256 price) latestBid,tuple(address oldBidder,uint256 oldPrice) oldBid,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof) runtime)'
  // const timeExtendedTuple = 'tuple(uint256 id,uint256 endTime)'
  // const cancelListedTuple = 'tuple(tuple(address caller,uint256 id) item,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof) runtime)'
  // const fillListedTuple = 'tuple(tuple(address caller,uint256 id) item,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 minimumIncrement,uint256 startTime,uint256 endTime,uint256 windowTime,bytes32 whitelistProof) runtime)'

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
      { name: 'minimumIncrement', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'windowTime', type: 'uint256' },
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

  const biddingTypes = {
    BidItem: [
      { name: 'bidder', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'price', type: 'uint256' },
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
      { name: 'caller', type: 'address' },
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
  let service: ListingEnglishAuction

  beforeEach(async () => {
    await network.provider.send('hardhat_reset', [])
    accounts = await ethers.getSigners()
    owner = accounts[0]
    bob = accounts[1]
    alice = accounts[2]
    john = accounts[3]

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
    const serviceFactory = (await ethers.getContractFactory('ListingEnglishAuction', owner)) as ListingEnglishAuction__factory
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
    await mock20.mint(owner.address, 1000)
    await mock20.approve(keeper.address, 1000)
    await mock20.mint(john.address, 1000)
    await mock20.connect(john).approve(keeper.address, 1000)
  })

  context('Test case for initialize', () => {
    it('initialize should be correct', async () => {
      expect(await keeper.registry()).to.be.eq(registry.address)
      expect(await router.registry()).to.be.eq(registry.address)

      expect(await service.LISTING_ID_COUNTER_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LISTING_ID_COUNTER')))
      expect(await service.LISTING_ENGLISH_AUCTION_ITEM_PREFIX()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LISTING_ENGLISH_AUCTION_ITEM_')))
      expect(await service.LISTED_ENGLISH_AUCTION_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LISTED_ENGLISH_AUCTION_ITEM')))
      expect(await service.TIME_EXTENDED_ENGLISH_AUCTION_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('TIME_EXTENDED_ENGLISH_AUCTION_ITEM')))
      expect(await service.BIDED_ENGLISH_AUCTION_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('BIDED_ENGLISH_AUCTION_ITEM_KEY')))
      expect(await service.CANCELLED_ENGLISH_AUCTION_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('CANCELLED_ENGLISH_AUCTION_ITEM')))
      expect(await service.FULFILLED_ENGLISH_AUCTION_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('FULFILLED_ENGLISH_AUCTION_ITEM')))
      expect(await service.LATEST_BID_ITEM_PREFIX()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LATEST_BID_ITEM_')))
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
              minimumIncrement: 0,
              startTime: 0,
              endTime: 0,
              windowTime: 0,
              whitelistProof: ethers.constants.HashZero,
              data: defaultAdditional
            },
            nonce: 0,
          },
          []
        )
      ).to.be.revertedWith('Require Router')
    })

    it('listItem should be correct', async () => {
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
          minimumIncrement: 1,
          startTime: 0,
          endTime: endTime,
          windowTime: 10 * 60,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)

      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      let tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))).wait()

      let event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      let decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.LISTED_ENGLISH_AUCTION_ITEM_KEY()]))
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
      expect(_listing.item.runtime.minimumIncrement.toNumber()).equal(1)
      expect(_listing.item.runtime.startTime.toNumber()).equal(0)
      expect(_listing.item.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.item.runtime.windowTime.toNumber()).equal(10 * 60)
      expect(_listing.item.runtime.whitelistProof).equal(ethers.constants.HashZero)
      expect(_listing.item.runtime.data).equal(defaultAdditional)
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
            id: 2,
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
          minimumIncrement: 10,
          startTime: 1,
          endTime: endTime + 100,
          windowTime: 100 * 60,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional
        },
        nonce: 1,
      }

      signature = await bob._signTypedData(domain, listingTypes, value)

      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('updateListing', [0, value, [signature, systemSignature]]))).wait()

      event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.UPDATED_LISTING_ENGLISH_AUCTION_ITEM_KEY()]))
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
      expect(_listing.item.runtime.minimumIncrement.toNumber()).equal(10)
      expect(_listing.item.runtime.startTime.toNumber()).equal(1)
      expect(_listing.item.runtime.endTime.toNumber()).equal(endTime + 100)
      expect(_listing.item.runtime.windowTime.toNumber()).equal(100 * 60)
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

  context('Test case for bidItem', () => {
    it('bidItem should be revert without router', async () => {
      await expect(
        service.connect(bob).bidItem(
          {
            bidder: bob.address,
            id: 0,
            price: 0,
          },
          []
        )
      ).to.be.revertedWith('Require Router')
    })

    it('bidItem should be correct', async () => {
      const endTime = moment().add(1, 'minutes').unix()

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
          minimumIncrement: 1,
          startTime: 0,
          endTime: endTime,
          windowTime: 10 * 60,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)

      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))

      value = {
        bidder: owner.address,
        id: 0,
        price: 101,
      }
      signature = await owner._signTypedData(domain, biddingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      let tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('bidItem', [value, [signature, systemSignature]]))).wait()
      let log = tx.logs[2]
      let decodedEvent = keeper.interface.decodeEventLog('EventFired', log.data, log.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.BIDED_ENGLISH_AUCTION_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(bidedTuple)
      let _bid = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_bid.id.toNumber()).equal(0)
      let latestBid = _bid.latestBid
      expect(latestBid.bidder).equal(owner.address)
      expect(latestBid.id.toNumber()).equal(0)
      expect(latestBid.price.toNumber()).equal(101)
      let oldBid = _bid.oldBid
      expect(oldBid.oldBidder).equal(ethers.constants.AddressZero)
      expect(oldBid.oldPrice.toNumber()).equal(100)
      expect(_bid.runtime.itemType).equal(1)
      expect(_bid.runtime.paymentToken).equal(mock20.address)
      expect(_bid.runtime.price.toNumber()).equal(100)
      expect(_bid.runtime.minimumIncrement.toNumber()).equal(1)
      expect(_bid.runtime.startTime.toNumber()).equal(0)
      expect(_bid.runtime.windowTime.toNumber()).equal(10 * 60)
      expect(_bid.runtime.whitelistProof).equal(ethers.constants.HashZero)

      log = tx.logs[3]
      const decodedEvent2 = keeper.interface.decodeEventLog('EventFired', log.data, log.topics)
      expect(decodedEvent2.serviceId).equal(serviceId)
      expect(decodedEvent2.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.TIME_EXTENDED_ENGLISH_AUCTION_ITEM_KEY()]))
      // expect(decodedEvent2.dataStructure).equal(timeExtendedTuple)
      const _timeExtended = ethersAbi.decode(JSON.parse(decodedEvent2.dataStructure), decodedEvent2.encodedData)
      expect(_timeExtended.id.toNumber()).equal(0)
      expect(_timeExtended.endTime.toNumber()).equal(endTime + 10 * 60)

      expect(await mock20.balanceOf(owner.address)).equal(899)
      expect(await mock20.balanceOf(keeper.address)).equal(101)

      let res = await router.forwardStaticcallRequest(
        keeperId,
        keeper.interface.encodeFunctionData('getUint256', [
          serviceId, //
          ethersAbi.encode(['bytes', 'uint256'], [await service.BIDDING_ID_COUNTER_KEY(), latestBid.id]),
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
        bidder: john.address,
        id: 0,
        price: 102,
      }
      signature = await john._signTypedData(domain, biddingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('bidItem', [value, [signature, systemSignature]]))).wait()
      log = tx.logs[3]
      decodedEvent = keeper.interface.decodeEventLog('EventFired', log.data, log.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.BIDED_ENGLISH_AUCTION_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(bidedTuple)
      _bid = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_bid.id.toNumber()).equal(1)
      latestBid = _bid.latestBid
      expect(latestBid.bidder).equal(john.address)
      expect(latestBid.id.toNumber()).equal(0)
      expect(latestBid.price.toNumber()).equal(102)
      oldBid = _bid.oldBid
      expect(oldBid.oldBidder).equal(owner.address)
      expect(oldBid.oldPrice.toNumber()).equal(101)
      expect(_bid.runtime.itemType).equal(1)
      expect(_bid.runtime.paymentToken).equal(mock20.address)
      expect(_bid.runtime.price.toNumber()).equal(100)
      expect(_bid.runtime.minimumIncrement.toNumber()).equal(1)
      expect(_bid.runtime.startTime.toNumber()).equal(0)
      expect(_bid.runtime.windowTime.toNumber()).equal(10 * 60)
      expect(_bid.runtime.whitelistProof).equal(ethers.constants.HashZero)

      expect(await mock20.balanceOf(owner.address)).equal(1000)
      expect(await mock20.balanceOf(john.address)).equal(898)
      expect(await mock20.balanceOf(keeper.address)).equal(102)

      res = await router.forwardStaticcallRequest(
        keeperId,
        keeper.interface.encodeFunctionData('getUint256', [
          serviceId, //
          ethersAbi.encode(['bytes', 'uint256'], [await service.BIDDING_ID_COUNTER_KEY(), latestBid.id]),
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
          minimumIncrement: 1,
          startTime: 0,
          endTime: endTime,
          windowTime: 10 * 60,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional
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
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.CANCELLED_ENGLISH_AUCTION_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(cancelListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.caller).equal(bob.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.minimumIncrement.toNumber()).equal(1)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.windowTime.toNumber()).equal(10 * 60)
      expect(_listing.runtime.whitelistProof).equal(ethers.constants.HashZero)

      expect(await mock20.balanceOf(john.address)).equal(1000)

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
          minimumIncrement: 1,
          startTime: 0,
          endTime: endTime,
          windowTime: 10 * 60,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional
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
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.CANCELLED_ENGLISH_AUCTION_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(cancelListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.caller).equal(alice.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.minimumIncrement.toNumber()).equal(1)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.runtime.windowTime.toNumber()).equal(10 * 60)
      expect(_listing.runtime.whitelistProof).equal(ethers.constants.HashZero)

      // await router.forwardRequest(serviceId, service.interface.encodeFunctionData('cancelListing', [value, [signature, systemSignature]]))
    })
  })

  context('Test case for fullfillItem', () => {
    it('fullfillItem should be revert without router', async () => {
      await expect(
        service.connect(bob).fullfillItem(
          {
            caller: bob.address,
            id: 0,
          },
          []
        )
      ).to.be.revertedWith('Require Router')
    })

    it('fullfillItem should be success', async () => {
      const endTime = moment().add(1, 'minutes').unix()

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
          price: 90,
          minimumIncrement: 1,
          startTime: 0,
          endTime: endTime,
          windowTime: 0,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))

      value = {
        bidder: john.address,
        id: 0,
        price: 100,
      }
      signature = await john._signTypedData(domain, biddingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('bidItem', [value, [signature, systemSignature]]))

      await network.provider.send('evm_increaseTime', [3600])
      await network.provider.send('evm_mine')

      value = {
        caller: owner.address,
        id: 0,
      }
      signature = await owner._signTypedData(domain, fillListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('fullfillItem', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.FULFILLED_ENGLISH_AUCTION_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(fillListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.caller).equal(owner.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(90)
      expect(_listing.runtime.minimumIncrement.toNumber()).equal(1)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.runtime.windowTime.toNumber()).equal(0)
      expect(_listing.runtime.whitelistProof).equal(ethers.constants.HashZero)

      expect(await mock721.balanceOf(john.address)).equal(1)
      expect(await mock721.balanceOf(bob.address)).equal(9)
      expect(await mock20.balanceOf(alice.address)).equal(100)
      expect(await mock20.balanceOf(john.address)).equal(900)
      expect(await mock721.ownerOf(1)).equal(john.address)
    })

    it('fullfillItem should be success', async () => {
      const endTime = moment().add(1, 'minutes').unix()

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
          price: 90,
          minimumIncrement: 1,
          startTime: 0,
          endTime: endTime,
          windowTime: 0,
          whitelistProof: ethers.constants.HashZero,
          data: defaultAdditional
        },
        nonce: 0,
      }

      let signature = await bob._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await service.verifyListingItem(value, [signature, systemSignature])
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('listItem', [value, [signature, systemSignature]]))

      value = {
        bidder: john.address,
        id: 0,
        price: 100,
      }
      signature = await john._signTypedData(domain, biddingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('bidItem', [value, [signature, systemSignature]]))

      await network.provider.send('evm_increaseTime', [3600])
      await network.provider.send('evm_mine')

      value = {
        caller: owner.address,
        id: 0,
      }
      signature = await owner._signTypedData(domain, fillListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('fullfillItem', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.FULFILLED_ENGLISH_AUCTION_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(fillListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.caller).equal(owner.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(90)
      expect(_listing.runtime.minimumIncrement.toNumber()).equal(1)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.runtime.windowTime.toNumber()).equal(0)
      expect(_listing.runtime.whitelistProof).equal(ethers.constants.HashZero)

      expect(await mock1155.balanceOf(john.address, 0)).equal(10)
      expect(await mock1155.balanceOf(bob.address, 0)).equal(0)
      expect(await mock20.balanceOf(alice.address)).equal(100)
      expect(await mock20.balanceOf(john.address)).equal(900)
    })
  })
})
