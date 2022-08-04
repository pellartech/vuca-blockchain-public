const { ethers } = require('ethers')

const PROVIDER_URL = 'https://proud-empty-sound.matic.quiknode.pro/d48abe2274581c8219d8ebe731c959f0ac58b1a1/'

const main = async () => {
  const provider = ethers.getDefaultProvider(PROVIDER_URL)
  let nonce = Number(await provider.getTransactionCount('0x909680a5E46a3401D4dD75148B61E129451fa266'))
  console.log(nonce)
  for (let i = 0; i < 10; i++) {
    const contractAddress = ethers.utils.getContractAddress({
      from: '0x909680a5E46a3401D4dD75148B61E129451fa266',
      nonce: nonce,
    })
    console.log(contractAddress)
    nonce += 1
  }
}

main().catch((err) => {
  console.log(err)
})
