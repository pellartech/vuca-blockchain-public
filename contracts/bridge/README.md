# Deploy Contracts

## Prerequisite

### L2

```
Multisig.sol
L2{Token}Template.sol
L2BridgeRegistry.sol
NormalProxy.sol (link with L2BridgeRegistry Impl)
L2{Token}Predicate.sol
NormalProxy.sol (link with Multisig, L2BridgeRegistry proxy, Template Impl) impl by Predicate
```

### L1

```
Multisig.sol
L1BridgeRegistry.sol
NormalProxy.sol (link with L1BridgeRegistry Impl)
L1{Token}Predicate.sol
NormalProxy.sol (link with Multisig, L1BridgeRegistry proxy, L2{Token}Predicate proxy address) impl by Predicate
```

# Contract Deployed

## Testnet

### Pegasus

```
Multisig.sol: https://pegasus.lightlink.io/address/0xE126d0619fcF51028cF51f4dD684Ce2D6ee2940b#code
L2BridgeRegistry.sol (impl): https://pegasus.lightlink.io/address/0xc2930A1214647EB90AC4D98A25bDC73fd6576A8d#code
L2BridgeRegistryProxy.sol: https://pegasus.lightlink.io/address/0x58c1f52451dCE2E442182984DE57093AD87a5D33#code

L2NativeTokenTemplate.sol: https://pegasus.lightlink.io/address/0x3cCFA0Ccb7EF3Cf84a814807aB06aD205Fc8d8B7#code
L2NativeTokenPredicate.sol (impl): https://pegasus.lightlink.io/address/0x7214726B26AbE4efE6f85ebB8970227e30B6c2E5#code
L2NativeTokenNormalProxy.sol: https://pegasus.lightlink.io/address/0xa10C60314c02c953cC18Db86e0FD09562fF63182#code

L2ERC20Template.sol: https://pegasus.lightlink.io/address/0x5ac24B900624aF28C7bF7EEdB06fCDD58A548Ad7#code
L2ERC20Predicate.sol (impl): https://pegasus.lightlink.io/address/0x3D951fAc7BdE8485F884f9F1fc0b5926cb35Ec4F#code
L2ERC20NormalProxy.sol: https://pegasus.lightlink.io/address/0xeCBb6206B0bA437EA01080662608b7d445fc7ec0#code

L2ERC721Template.sol: https://pegasus.lightlink.io/address/0x45d1e47D580d154a76476BEbbd8E1118686309C2#code
L2ERC721Predicate.sol (impl): https://pegasus.lightlink.io/address/0xf3943DB3e9b1a6E13d9602580A2871d4Ede74Efb#code
L2ERC721NormalProxy.sol: https://pegasus.lightlink.io/address/0xa17f2F4834eC7ba7266C5cCec4AD024f57BaBd2C#code

L2ERC1155Template.sol: https://pegasus.lightlink.io/address/0x19fc34051c05013C108602aAa8246414525D89d3#code
L2ERC1155Predicate.sol (impl): https://pegasus.lightlink.io/address/0x98f5ec3379e7BA9Dd0E6A82B5042115881AeBA42#code
L2ERC1155NormalProxy.sol: https://pegasus.lightlink.io/address/0x63739ec14762a6330d827c4c1bA2206681a9DFA3#code

L2AdotNativeTokenTemplate.sol: https://pegasus.lightlink.io/address/0x7b4CE8bfd93a15da2372077F00D140fdFdE352C6#code
L2AdotNativeTokenPredicate.sol (impl): https://pegasus.lightlink.io/address/0x4c8c53B560F827f75E846161f3cdA7fD426464E8#code
L2AdotNativeTokenNormalProxy.sol: https://pegasus.lightlink.io/address/0x47ED71d54e2d6D6041792bBb87290E20EfAC4671#code
```

### Goerli

```
Multisig.sol: https://goerli.etherscan.io/address/0xA86a022D17177fCE078b7d0da3eA92116A78DC23#code
L1BridgeRegistry.sol (impl): https://goerli.etherscan.io/address/0x56F467E6B7fF7033ee47Cf95444d388EDDb35e5f#code
L1BridgeRegistryProxy.sol: https://goerli.etherscan.io/address/0x5AB9B56EF0E7A4d4218DaE61AbEb8052Afb29b6d#code

L1NativeTokenPredicate.sol (impl): https://goerli.etherscan.io/address/0x8d26a29e18204914FA238F375016404165cD6B80#code
L1NativeTokenNormalProxy.sol: https://goerli.etherscan.io/address/0x2A35ca3B80E1a50cd3313486D3d03F3ebCD9bE63#code

L1ERC20Predicate.sol (impl): https://goerli.etherscan.io/address/0xE1b194F3edcA06ee5f573a9D29a7f96082Fd20C0#code
L1ERC20NormalProxy.sol: https://goerli.etherscan.io/address/0xa654171C7C436E42bd6c64FB7238968B7482fb78#code

L1ERC721Predicate.sol (impl): https://goerli.etherscan.io/address/0x1CA4f57EB12bfE74a414CDcfe6C8ee504939eD87#code
L1ERC721NormalProxy.sol: https://goerli.etherscan.io/address/0xaA20EB5738B5989551CA87Eec9F6B4A606ae06a8#code

L1ERC1155Predicate.sol (impl): https://goerli.etherscan.io/address/0x2fcDe9763edA81fD8e3E8E5AD2DDac0a04C28c38#code
L1ERC1155NormalProxy.sol: https://goerli.etherscan.io/address/0xBc77391e6D11ab948368a281733c12A2edCe93ae#code

L1AdotNativeTokenPredicate.sol (impl): https://goerli.etherscan.io/address/0xc3870644024aeC81C3e405C94c2EEf67C2C73b2C#code
L1AdotNativeTokenNormalProxy.sol: https://goerli.etherscan.io/address/0x2ca172Ed68CE4e6D2Dd35F7F42D55Fbf28F06Ffa#code
```

### Post Deployment

```
Add L2 Contracts to whitelist to turn on enterprise mode
```
