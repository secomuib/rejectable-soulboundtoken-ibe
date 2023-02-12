# rejectable-soulboundtoken-ibe
> RejectableNFT. ERC-721 compatible NFT token that can be rejected by the receiver of the transfer function.

## 🔍 Overview
...

## 📚 Installation

To install this repository, run:
```
yarn install
```

### Configuration of .env file

Create the file `.env`:
```bash
cp .env.example .env
vi .env # add an account's mnemonic and an Infura API key
```

Add the following information:
```
MNEMONIC=
INFURA_API_KEY=
COINMARKETCAP_API_KEY=
```

To see the mnemonic or seed phrase in Metamask, [follow this instruction](https://metamask.zendesk.com/hc/en-us/articles/360015290032-How-to-Reveal-Your-Seed-Phrase).

The account associated with the mnemonic needs to have enough funds in the network where you want to interact with the smart contracts.

## 🖥️ Main commands

Compile the smart contracts:
```
yarn compile
```

Run the tests in the local hardhat network:
```
yarn test
```

Run the coverage test:
```
yarn coverage
```

Deploy the smart contracts to the local hardhat network:
```
yarn deploy
```

Deploy the smart contracts to the Rinkeby test network:
```
yarn deploy --network rinkeby
```
