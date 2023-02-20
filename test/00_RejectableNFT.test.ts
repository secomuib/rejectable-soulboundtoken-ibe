import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers, waffle } from "hardhat";
import chai from "chai";
import { Contract } from "ethers";

chai.use(waffle.solidity);
const { expect } = chai;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RSBT_NAME = "Rejectable SBT test";
const RSBT_SYMBOL = "RSBT1";

describe("RejectableSBT", () => {
  let rejectableSBT: Contract;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    await deployments.fixture("RejectableSBT", { fallbackToGlobal: false });

    const RejectableSBT = await ethers.getContractFactory("RejectableSBT");
    rejectableSBT = await RejectableSBT.deploy(RSBT_NAME, RSBT_SYMBOL);
  });

  /**
   * Deployment
   */
  describe("Deployment", () => {
    it("Contracts deployed successfully", async () => {
      expect(rejectableSBT.address).to.not.be.undefined;
    });

    it("Check name and symbol", async () => {
      expect(await rejectableSBT.name()).to.be.equal(RSBT_NAME);
      expect(await rejectableSBT.symbol()).to.be.equal(RSBT_SYMBOL);
    });
  });

  /**
   * Mint a Rejectable SBT
   */
  describe("Mint a Rejectable SBT", () => {
    it("Non owner can't mint", async () => {
      await expect(rejectableSBT.connect(user1).mint(user1.address)).to.be
        .reverted;
    });

    it("Owner can mint", async () => {
      // before minting, we have a balance of 0
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      // mint
      const tx = await rejectableSBT.connect(owner).mint(user1.address);

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await rejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is the transferable owner
      expect(await rejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        user1.address
      );
    });

    it("Sender can cancel", async () => {
      // before minting, we have a balance of 0
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      // mint
      const tx = await rejectableSBT.connect(owner).mint(user1.address);

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await rejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is the transferable owner
      expect(await rejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        user1.address
      );

      // the sender can cancel
      await rejectableSBT.connect(owner).cancelTransfer(tokenId);
      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await rejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is removed as transferable owner
      expect(await rejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        ZERO_ADDRESS
      );
    });

    it("Receiver can reject", async () => {
      // before minting, we have a balance of 0
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      // mint
      const tx = await rejectableSBT.connect(owner).mint(user1.address);

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await rejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is the transferable owner
      expect(await rejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        user1.address
      );

      // the sender can cancel
      await rejectableSBT.connect(user1).rejectTransfer(0);
      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await rejectableSBT.ownerOf(0)).to.be.equal(ZERO_ADDRESS);
      // the receiver is removed as transferable owner
      expect(await rejectableSBT.transferableOwnerOf(0)).to.be.equal(
        ZERO_ADDRESS
      );
    });

    it("Receiver can accept transfer", async () => {
      // before minting, we have a balance of 0
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      // mint
      const tx = await rejectableSBT.connect(owner).mint(user1.address);

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await rejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is the transferable owner
      expect(await rejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        user1.address
      );

      // the sender can cancel
      await rejectableSBT.connect(user1).acceptTransfer(tokenId);
      // after minting, we have a balance of 1
      expect(await rejectableSBT.balanceOf(user1.address)).to.be.equal(1);
      expect(await rejectableSBT.ownerOf(tokenId)).to.be.equal(user1.address);
      // the receiver is removed as transferable owner
      expect(await rejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        ZERO_ADDRESS
      );
    });
  });
});
