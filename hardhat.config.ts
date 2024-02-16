import { config } from 'dotenv'

import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import 'solidity-coverage'

config()

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.19',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: '0.8.13',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0,
      blockGasLimit: 999999999999999,
      accounts: require('./accounts.json'),
      mining: {
        auto: false,
        interval: 0
      }
    },
    goerli: {
      url: process.env.GOERLI_PROVIDER_URL,
      accounts: [process.env.GOERLI_PRIVATE_KEY]
    }
    // rinkeby: {
    //   url: process.env.RINKEBY_PROVIDER_URL,
    //   accounts: [process.env.RINKEBY_PRIVATE_KEY],
    // },
    // mainnet: {
    //   url: process.env.MAINNET_PROVIDER_URL,
    //   accounts: [process.env.MAINNET_PRIVATE_KEY],
    // },
  },
  mocha: {
    timeout: 200000
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD'
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHEREUM_API_KEY,
      goerli: process.env.ETHEREUM_API_KEY,
      rinkeby: process.env.ETHEREUM_API_KEY
    }
  }
}
