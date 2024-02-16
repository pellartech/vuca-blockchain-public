import { ethers, network } from 'hardhat'
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { solidity } from 'ethereum-waffle'

import {
  AdotKeeper,
  AdotKeeper__factory,
  AdotRouter,
  AdotRouter__factory, //
  MarketplaceRegistry,
  MarketplaceRegistry__factory,
  NormalOffer,
  NormalOffer__factory,
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
describe('Marketplace NormalOffer test', () => {
  const serviceId = ethers.utils.solidityKeccak256(['string'], ['NormalOffer'])
  const keeperId = ethers.utils.solidityKeccak256(['string'], ['AdotKeeper'])
  const routerId = ethers.utils.solidityKeccak256(['string'], ['AdotRouter'])

  // const listedTuple = 'tuple(uint256 id,tuple(uint8 state,address offerer,tuple(uint8 itemType,address token,uint256 id,uint256 amount)[] items,tuple(address recipient,uint256 percentage)[] distributions,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime) runtime,uint256 nonce) item)'
  // const cancelListedTuple = 'tuple(tuple(address caller,uint256 id) item,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime) runtime)'
  // const fillListedTuple = 'tuple(tuple(address seller,uint256 id) item,tuple(uint8 itemType,address paymentToken,uint256 price,uint256 startTime,uint256 endTime) runtime)'

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
      { name: 'data', type: 'bytes' },
    ],
    OfferItem: [
      { name: 'state', type: 'uint8' },
      { name: 'offerer', type: 'address' },
      { name: 'items', type: 'TokenItem[]' },
      { name: 'distributions', type: 'Distribution[]' },
      { name: 'runtime', type: 'Runtime' },
      { name: 'nonce', type: 'uint256' },
    ],
  }

  const cancelListingTypes = {
    CancelOffer: [
      { name: 'caller', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
  }

  const fillListingTypes = {
    Distribution: [
      { name: 'recipient', type: 'address' },
      { name: 'percentage', type: 'uint256' },
    ],
    FulfillOffer: [
      { name: 'seller', type: 'address' },
      { name: 'id', type: 'uint256' },
      { name: 'distributions', type: 'Distribution[]' },
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
  let service: NormalOffer

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
    const serviceFactory = (await ethers.getContractFactory('NormalOffer', owner)) as NormalOffer__factory
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
    await mock20.mint(john.address, 100)
    await mock20.connect(john).approve(keeper.address, 100)
  })

  context('Test case for initialize', () => {
    it('initialize should be correct', async () => {
      expect(await keeper.registry()).to.be.eq(registry.address)
      expect(await router.registry()).to.be.eq(registry.address)

      expect(await service.OFFERING_ID_COUNTER_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('OFFERING_ID_COUNTER')))
      expect(await service.LISTING_OFFER_ITEM_PREFIX()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LISTING_OFFER_ITEM_')))
      expect(await service.LISTED_OFFER_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('LISTED_OFFER_ITEM')))
      expect(await service.CANCELLED_OFFER_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('CANCELLED_OFFER_ITEM')))
      expect(await service.FULFILLED_OFFER_ITEM_KEY()).to.be.eq(ethers.utils.hexlify(ethers.utils.toUtf8Bytes('FULFILLED_OFFER_ITEM')))
      expect(await service.serviceId()).to.be.eq(serviceId)
    })
  })

  context('Test case for offerItem', () => {
    it('offerItem should be revert without router', async () => {
      await expect(
        service.connect(bob).offerItem(
          {
            state: 0,
            offerer: bob.address,
            items: [],
            distributions: [],
            runtime: {
              itemType: 1,
              paymentToken: mock20.address,
              price: 0,
              startTime: 0,
              endTime: 0,
              data: defaultAdditional,
            },
            nonce: 0,
          },
          []
        )
      ).to.be.revertedWith('Require Router')
    })

    it('offerItem should be correct', async () => {
      const endTime = moment().add(1, 'days').unix()

      const domain = {
        name: 'Adot',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: service.address,
      }

      let value = {
        state: 0,
        offerer: john.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 100,
          startTime: 0,
          endTime: endTime,
          data: defaultAdditional,
        },
        nonce: 0,
      }

      let signature = await john._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      await service.verifyOfferItem(value, [signature, systemSignature])

      let tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('offerItem', [value, [signature, systemSignature]]))).wait()
      let event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      let decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.LISTED_OFFER_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(listedTuple)
      let _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.id.toNumber()).equal(0)
      expect(_listing.item.state).equal(1)
      expect(_listing.item.offerer).equal(john.address)
      expect(_listing.item.items[0].itemType).equal(2)
      expect(_listing.item.items[0].token).equal(mock721.address)
      expect(_listing.item.items[0].id.toNumber()).equal(1)
      expect(_listing.item.items[0].amount.toNumber()).equal(1)
      expect(_listing.item.distributions.length).equal(0)
      expect(_listing.item.runtime.itemType).equal(1)
      expect(_listing.item.runtime.paymentToken).equal(mock20.address)
      expect(_listing.item.runtime.price.toNumber()).equal(100)
      expect(_listing.item.runtime.startTime.toNumber()).equal(0)
      expect(_listing.item.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.item.runtime.data).equal(defaultAdditional)
      expect(_listing.item.nonce.toNumber()).equal(0)

      let res = await router.forwardStaticcallRequest(
        keeperId,
        keeper.interface.encodeFunctionData('getUint256', [
          serviceId, //
          await service.OFFERING_ID_COUNTER_KEY(),
        ])
      )
      expect(res[0]).equal(true)
      expect(ethersAbi.decode(['uint256'], res[1])[0]).equal(1)

      res = await router.forwardStaticcallRequest(
        keeperId,
        keeper.interface.encodeFunctionData('getNonce', [
          serviceId, //
          john.address,
        ])
      )
      expect(res[0]).equal(true)
      expect(ethersAbi.decode(['uint256'], res[1])[0]).equal(1)

      value = {
        state: 0,
        offerer: john.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 10,
          startTime: 1,
          endTime: endTime + 100,
          data: defaultAdditional,
        },
        nonce: 1,
      }

      signature = await john._signTypedData(domain, listingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      await service.verifyOfferItem(value, [signature, systemSignature])
      tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('updateOffer', [0, value, [signature, systemSignature]]))).wait()
      event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.UPDATED_OFFER_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(listedTuple)
      _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.id.toNumber()).equal(0)
      expect(_listing.item.state).equal(1)
      expect(_listing.item.offerer).equal(john.address)
      expect(_listing.item.items[0].itemType).equal(2)
      expect(_listing.item.items[0].token).equal(mock721.address)
      expect(_listing.item.items[0].id.toNumber()).equal(1)
      expect(_listing.item.items[0].amount.toNumber()).equal(1)
      expect(_listing.item.distributions.length).equal(0)
      expect(_listing.item.runtime.itemType).equal(1)
      expect(_listing.item.runtime.paymentToken).equal(mock20.address)
      expect(_listing.item.runtime.price.toNumber()).equal(10)
      expect(_listing.item.runtime.startTime.toNumber()).equal(1)
      expect(_listing.item.runtime.endTime.toNumber()).equal(endTime + 100)
      expect(_listing.item.runtime.data).equal(defaultAdditional)
      expect(_listing.item.nonce.toNumber()).equal(1)

      res = await router.forwardStaticcallRequest(
        keeperId,
        keeper.interface.encodeFunctionData('getNonce', [
          serviceId, //
          john.address,
        ])
      )
      expect(res[0]).equal(true)
      expect(ethersAbi.decode(['uint256'], res[1])[0]).equal(2)
    })
  })

  context('Test case for cancelOffer', () => {
    it('cancelOffer should be revert without router', async () => {
      await expect(
        service.connect(bob).cancelOffer(
          {
            caller: bob.address,
            id: 0,
          },
          []
        )
      ).to.be.revertedWith('Require Router')
    })

    it('cancelOffer should be correct', async () => {
      const endTime = moment().add(1, 'days').unix()

      const domain = {
        name: 'Adot',
        version: '1.0.0',
        chainId: 1,
        verifyingContract: service.address,
      }

      let value: any = {
        state: 0,
        offerer: john.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 100,
          startTime: 0,
          endTime: endTime,
          data: defaultAdditional,
        },
        nonce: 0,
      }

      let signature = await john._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('offerItem', [value, [signature, systemSignature]]))

      value = {
        caller: john.address,
        id: 0,
      }
      signature = await john._signTypedData(domain, cancelListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('cancelOffer', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.CANCELLED_OFFER_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(cancelListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.caller).equal(john.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)

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
        offerer: john.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [],
        runtime: {
          itemType: 1,
          paymentToken: mock20.address,
          price: 100,
          startTime: 0,
          endTime: endTime,
          data: defaultAdditional,
        },
        nonce: 0,
      }

      let signature = await john._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('offerItem', [value, [signature, systemSignature]]))

      value = {
        caller: alice.address,
        id: 0,
      }
      signature = await alice._signTypedData(domain, cancelListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('cancelOffer', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.CANCELLED_OFFER_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(cancelListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.caller).equal(alice.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)

      // await router.forwardRequest(serviceId, service.interface.encodeFunctionData('cancelListing', [value, [signature, systemSignature]]))
    })
  })

  context('Test case for fullfillItem', () => {
    it('fullfillItem should be revert without router', async () => {
      await expect(
        service.connect(bob).fullfillItem(
          {
            seller: bob.address,
            id: 0,
            distributions: [
              {
                recipient: alice.address,
                percentage: 10000,
              },
            ],
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
        offerer: john.address,
        items: [
          {
            itemType: 2,
            token: mock721.address,
            id: 1,
            amount: 1,
          },
        ],
        distributions: [],
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

      let signature = await john._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('offerItem', [value, [signature, systemSignature]]))

      value = {
        seller: bob.address,
        id: 0,
        distributions: [
          {
            recipient: alice.address,
            percentage: 10000,
          },
        ],
      }
      signature = await bob._signTypedData(domain, fillListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      await service.verifyFulfillOfferItem(value, [signature, systemSignature])

      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('fullfillItem', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.FULFILLED_OFFER_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(fillListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.seller).equal(bob.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.item.distributions[0].recipient).equal(alice.address)
      expect(_listing.item.distributions[0].percentage.toNumber()).equal(10000)

      expect(await mock721.balanceOf(john.address)).equal(1)
      expect(await mock721.balanceOf(bob.address)).equal(9)
      expect(await mock20.balanceOf(alice.address)).equal(100)
      expect(await mock20.balanceOf(john.address)).equal(0)
      expect(await mock721.ownerOf(1)).equal(john.address)
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
        offerer: john.address,
        items: [
          {
            itemType: 3,
            token: mock1155.address,
            id: 0,
            amount: 10,
          },
        ],
        distributions: [],
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

      let signature = await john._signTypedData(domain, listingTypes, value)
      let systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))
      await service.verifyOfferItem(value, [signature, systemSignature])
      await router.forwardRequest(serviceId, service.interface.encodeFunctionData('offerItem', [value, [signature, systemSignature]]))

      value = {
        seller: bob.address,
        id: 0,
        distributions: [
          {
            recipient: alice.address,
            percentage: 10000,
          },
        ],
      }
      signature = await bob._signTypedData(domain, fillListingTypes, value)
      systemSignature = await alice.signMessage(ethers.utils.arrayify(ethers.utils.solidityKeccak256(['bytes'], [signature])))

      await service.verifyFulfillOfferItem(value, [signature, systemSignature])

      const tx = await (await router.forwardRequest(serviceId, service.interface.encodeFunctionData('fullfillItem', [value, [signature, systemSignature]]))).wait()
      const event = find(tx.logs, (log) => log.topics[0] === keeper.interface.getEventTopic('EventFired'))!
      const decodedEvent = keeper.interface.decodeEventLog('EventFired', event.data, event.topics)
      expect(decodedEvent.serviceId).equal(serviceId)
      expect(decodedEvent.action).equal(ethers.utils.solidityKeccak256(['bytes'], [await service.FULFILLED_OFFER_ITEM_KEY()]))
      // expect(decodedEvent.dataStructure).equal(fillListedTuple)
      const _listing = ethersAbi.decode(JSON.parse(decodedEvent.dataStructure), decodedEvent.encodedData)
      expect(_listing.item.seller).equal(bob.address)
      expect(_listing.item.id.toNumber()).equal(0)
      expect(_listing.runtime.itemType).equal(1)
      expect(_listing.runtime.paymentToken).equal(mock20.address)
      expect(_listing.runtime.price.toNumber()).equal(100)
      expect(_listing.runtime.startTime.toNumber()).equal(0)
      expect(_listing.runtime.endTime.toNumber()).equal(endTime)
      expect(_listing.item.distributions[0].recipient).equal(alice.address)
      expect(_listing.item.distributions[0].percentage.toNumber()).equal(10000)

      expect(await mock1155.balanceOf(john.address, 0)).equal(10)
      expect(await mock1155.balanceOf(bob.address, 0)).equal(0)
      expect(await mock20.balanceOf(alice.address)).equal(100)
      expect(await mock20.balanceOf(john.address)).equal(0)
    })
  })
})
