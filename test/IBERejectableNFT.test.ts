import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle } from "hardhat";
import chai from "chai";
import { BigNumber, Contract } from "ethers";
import CryptID from "@cryptid/cryptid-js";

chai.use(waffle.solidity);
const { expect } = chai;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RSBT_NAME = "Rejectable IBE SBT";
const RSBT_SYMBOL = "RSBT1";

describe("IBERejectableSBT", () => {
  let ibeRejectableSBT: Contract;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let cryptID: CryptID;

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    cryptID = await CryptID.getInstance();
    const cryptIDSetup = cryptID.setup(CryptID.SecurityLevel.LOWEST);

    expect(cryptIDSetup.success).to.be.true;

    console.log(
      "=================================================================================="
    );
    console.log(
      "====================== publicParameters =========================================="
    );
    console.log(
      "=================================================================================="
    );
    console.log(cryptIDSetup.publicParameters);

    console.log(
      "=================================================================================="
    );
    console.log(
      "====================== masterSecret =============================================="
    );
    console.log(
      "=================================================================================="
    );
    console.log(cryptIDSetup.masterSecret);

    console.log(
      "=================================================================================="
    );
    console.log(
      "====================== privateKey ================================================"
    );
    console.log(
      "=================================================================================="
    );
    console.log(cryptIDSetup.privateKey);

    const message = "Ironic.";
    const identity = {
      id: 1
    };
    console.log(identity);

    const encryptResult = cryptID.encrypt(
      cryptIDSetup.publicParameters,
      identity,
      message
    );

    console.log(encryptResult);

    const IBERejectableSBT = await ethers.getContractFactory(
      "IBERejectableSBT"
    );
    ibeRejectableSBT = await IBERejectableSBT.deploy(
      RSBT_NAME,
      RSBT_SYMBOL,
      BigNumber.from(cryptIDSetup.publicParameters.fieldOrder).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.subgroupOrder).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.pointP.x).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.pointP.y).toHexString(),
      BigNumber.from(
        cryptIDSetup.publicParameters.pointPpublic.x
      ).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.pointPpublic.y).toHexString()
    );
  });

  /**
   * Deployment
   */
  describe("Deployment", () => {
    it("Contracts deployed successfully", async () => {
      expect(ibeRejectableSBT.address).to.not.be.undefined;
    });

    it("Check name and symbol", async () => {
      expect(await ibeRejectableSBT.name()).to.be.equal(RSBT_NAME);
      expect(await ibeRejectableSBT.symbol()).to.be.equal(RSBT_SYMBOL);
    });
  });

  /**
   * Mint a Rejectable SBT
   */
  describe("Mint a Rejectable SBT", () => {
    it("Non owner can't mint", async () => {
      await expect(ibeRejectableSBT.connect(user1).mint(user1.address)).to.be
        .reverted;
    });

    it("Owner can mint", async () => {
      // before minting, we have a balance of 0
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      // mint
      const tx = await ibeRejectableSBT.connect(owner).mint(user1.address);

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is the transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        user1.address
      );
    });

    it("Sender can cancel", async () => {
      // before minting, we have a balance of 0
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      // mint
      const tx = await ibeRejectableSBT.connect(owner).mint(user1.address);

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is the transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        user1.address
      );

      // the sender can cancel
      await ibeRejectableSBT.connect(owner).cancelTransfer(tokenId);
      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is removed as transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        ZERO_ADDRESS
      );
    });

    it("Receiver can reject", async () => {
      // before minting, we have a balance of 0
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      // mint
      const tx = await ibeRejectableSBT.connect(owner).mint(user1.address);

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is the transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        user1.address
      );

      // the sender can cancel
      await ibeRejectableSBT.connect(user1).rejectTransfer(0);
      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(0)).to.be.equal(ZERO_ADDRESS);
      // the receiver is removed as transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(0)).to.be.equal(
        ZERO_ADDRESS
      );
    });

    it("Receiver can accept transfer", async () => {
      // before minting, we have a balance of 0
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      // mint
      const tx = await ibeRejectableSBT.connect(owner).mint(user1.address);

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(ZERO_ADDRESS);
      // the receiver is the transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        user1.address
      );

      // the sender can cancel
      await ibeRejectableSBT.connect(user1).acceptTransfer(tokenId);
      // after minting, we have a balance of 1
      expect(await ibeRejectableSBT.balanceOf(user1.address)).to.be.equal(1);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(
        user1.address
      );
      // the receiver is removed as transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        ZERO_ADDRESS
      );
    });
  });
});
