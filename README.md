Contracts associated with the ADOT Crown Token Project.

We use Hardhat to deploy and test our contracts to the Goerli Test Network.

Last Updated: 21/03/2023

Includes

- Contract for the ERC20 Crown Token (CROWN)
- Contract for the use of Staking CROWN in exchange for a ERC20 reward token set by admin

---

**Staking**

Admins can create a staking pool which specifies

- Staking and Reward Token used
- Duration (in blocks)
- Reward Tokens earned per block
- Update Delay

End Block is updatable, all staked tokens are held by the contract

Users have the option to do a force withdraw during staking but will forfeit all rewards

Otherwise at end of staking cycle, users can retreive their staked tokens and claim their rewards earned from staking

Users can view information about

- Pool data
- Rewards earned from latest stake they have

---

**Crown Token**

Simple ERC20 token

- There is a final/absolute hard cap on supply
- All tokens are minted to the contract deployer, to which distribution will occur from later on

---
