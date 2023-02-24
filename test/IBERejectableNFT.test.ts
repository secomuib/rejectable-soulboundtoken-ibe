import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle } from "hardhat";
import chai from "chai";
import { BigNumber, Contract, utils } from "ethers";
import CryptID from "@cryptid/cryptid-js";

chai.use(waffle.solidity);
const { expect } = chai;

const RSBT_NAME = "Rejectable IBE SBT";
const RSBT_SYMBOL = "RSBT1";

describe("IBERejectableSBT", () => {
  let ibeRejectableSBT: Contract;
  let middleware: SignerWithAddress;
  let sender: SignerWithAddress;
  let receiver: SignerWithAddress;
  let cryptID: CryptID;
  let cryptIDSetup: CryptID.SetupResult;

  before(async () => {
    [middleware, sender, receiver] = await ethers.getSigners();

    cryptID = await CryptID.getInstance();
    cryptIDSetup = cryptID.setup(CryptID.SecurityLevel.LOWEST);

    expect(cryptIDSetup.success).to.be.true;

    const IBERejectableSBT = await ethers.getContractFactory(
      "IBERejectableSBT"
    );
    ibeRejectableSBT = await IBERejectableSBT.deploy(
      RSBT_NAME,
      RSBT_SYMBOL,
      middleware.address,
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

    it("Check IBE public parameters", async () => {
      expect(await ibeRejectableSBT.fieldOrder()).to.be.equal(
        BigNumber.from(cryptIDSetup.publicParameters.fieldOrder).toHexString()
      );
      expect(await ibeRejectableSBT.subgroupOrder()).to.be.equal(
        BigNumber.from(
          cryptIDSetup.publicParameters.subgroupOrder
        ).toHexString()
      );
      expect(await ibeRejectableSBT.pointP_x()).to.be.equal(
        BigNumber.from(cryptIDSetup.publicParameters.pointP.x).toHexString()
      );
      expect(await ibeRejectableSBT.pointP_y()).to.be.equal(
        BigNumber.from(cryptIDSetup.publicParameters.pointP.y).toHexString()
      );
      expect(await ibeRejectableSBT.pointPpublic_x()).to.be.equal(
        BigNumber.from(
          cryptIDSetup.publicParameters.pointPpublic.x
        ).toHexString()
      );
      expect(await ibeRejectableSBT.pointPpublic_y()).to.be.equal(
        BigNumber.from(
          cryptIDSetup.publicParameters.pointPpublic.y
        ).toHexString()
      );
    });
  });

  /**
   * Mint, Accept, Cancel, Reject a Rejectable SBT
   */
  describe("Mint, Accept, Cancel, Reject a Rejectable SBT", () => {
    const message = "Test message";
    let identity;
    let encryptResult;

    before(async () => {
      identity = {
        idReceiver: receiver.address,
        idTimestamp: Math.floor(new Date().getTime() / 1000)
      };

      encryptResult = cryptID.encrypt(
        cryptIDSetup.publicParameters,
        identity,
        message
      );
    });

    it("Sender can mint", async () => {
      // before minting, we have a balance of 0
      expect(await ibeRejectableSBT.balanceOf(sender.address)).to.be.equal(0);
      // mint
      const tx = await ibeRejectableSBT
        .connect(sender)
        .mint(
          identity.idReceiver,
          identity.idTimestamp,
          utils.keccak256(utils.toUtf8Bytes(message)),
          BigNumber.from(encryptResult.ciphertext.cipherU.x).toHexString(),
          BigNumber.from(encryptResult.ciphertext.cipherU.y).toHexString(),
          encryptResult.ciphertext.cipherV,
          encryptResult.ciphertext.cipherW
        );

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(receiver.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
      // the receiver is the transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        receiver.address
      );
    });

    it("Sender can cancel", async () => {
      // before minting, we have a balance of 0
      expect(await ibeRejectableSBT.balanceOf(sender.address)).to.be.equal(0);
      // mint
      const tx = await ibeRejectableSBT
        .connect(sender)
        .mint(
          identity.idReceiver,
          identity.idTimestamp,
          utils.keccak256(utils.toUtf8Bytes(message)),
          BigNumber.from(encryptResult.ciphertext.cipherU.x).toHexString(),
          BigNumber.from(encryptResult.ciphertext.cipherU.y).toHexString(),
          encryptResult.ciphertext.cipherV,
          encryptResult.ciphertext.cipherW
        );

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(receiver.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
      // the receiver is the transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        receiver.address
      );

      // the sender can cancel
      await ibeRejectableSBT.connect(sender).cancelTransfer(tokenId);
      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(receiver.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
      // the receiver is removed as transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
    });

    it("Receiver can reject", async () => {
      // before minting, we have a balance of 0
      expect(await ibeRejectableSBT.balanceOf(sender.address)).to.be.equal(0);
      // mint
      const tx = await ibeRejectableSBT
        .connect(sender)
        .mint(
          identity.idReceiver,
          identity.idTimestamp,
          utils.keccak256(utils.toUtf8Bytes(message)),
          BigNumber.from(encryptResult.ciphertext.cipherU.x).toHexString(),
          BigNumber.from(encryptResult.ciphertext.cipherU.y).toHexString(),
          encryptResult.ciphertext.cipherV,
          encryptResult.ciphertext.cipherW
        );

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(receiver.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
      // the receiver is the transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        receiver.address
      );

      // the receiver can reject
      await ibeRejectableSBT.connect(receiver).rejectTransfer(0);
      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(receiver.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(0)).to.be.equal(
        ethers.constants.AddressZero
      );
      // the receiver is removed as transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(0)).to.be.equal(
        ethers.constants.AddressZero
      );
    });

    it("Receiver can accept transfer", async () => {
      // before minting, we have a balance of 0
      expect(await ibeRejectableSBT.balanceOf(sender.address)).to.be.equal(0);
      // mint
      const tx = await ibeRejectableSBT
        .connect(sender)
        .mint(
          identity.idReceiver,
          identity.idTimestamp,
          utils.keccak256(utils.toUtf8Bytes(message)),
          BigNumber.from(encryptResult.ciphertext.cipherU.x).toHexString(),
          BigNumber.from(encryptResult.ciphertext.cipherU.y).toHexString(),
          encryptResult.ciphertext.cipherV,
          encryptResult.ciphertext.cipherW
        );

      const receipt = await tx.wait();
      const tokenId = receipt.events[0].args.tokenId;

      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(receiver.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
      // the receiver is the transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        receiver.address
      );

      // the receiver can accept
      await ibeRejectableSBT.connect(receiver).acceptTransfer(tokenId);
      // after minting, we have a balance of 1
      expect(await ibeRejectableSBT.balanceOf(receiver.address)).to.be.equal(1);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(
        receiver.address
      );
      // the receiver is removed as transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
    });
  });

  /**
   * Middleware sends private key to receiver
   */
  describe("Middleware sends private key to receiver", () => {
    const message = "Test message";
    let identity;
    let encryptResult;

    before(async () => {
      identity = {
        idReceiver: receiver.address,
        idTimestamp: Math.floor(new Date().getTime() / 1000)
      };

      encryptResult = cryptID.encrypt(
        cryptIDSetup.publicParameters,
        identity,
        message
      );
    });

    it("When receiver accepts transfer, middleware stores private key to decrypt the message", async () => {
      // mint
      const txMint = await ibeRejectableSBT
        .connect(sender)
        .mint(
          identity.idReceiver,
          identity.idTimestamp,
          utils.keccak256(utils.toUtf8Bytes(message)),
          BigNumber.from(encryptResult.ciphertext.cipherU.x).toHexString(),
          BigNumber.from(encryptResult.ciphertext.cipherU.y).toHexString(),
          encryptResult.ciphertext.cipherV,
          encryptResult.ciphertext.cipherW
        );
      const receiptMint = await txMint.wait();
      const tokenId = receiptMint.events[0].args.tokenId;

      // the receiver accepts
      const txAccept = await ibeRejectableSBT
        .connect(receiver)
        .acceptTransfer(tokenId);
      const receiptAccept = await txAccept.wait();

      // check event
      expect(receiptAccept.events[0].event).to.be.equal("AcceptTransfer");
      expect(receiptAccept.events[0].args.from).to.be.equal(
        ethers.constants.AddressZero
      );
      expect(receiptAccept.events[0].args.to).to.be.equal(receiver.address);
      expect(receiptAccept.events[0].args.tokenId).to.be.equal(tokenId);

      // the middleware reads the event and stores the private key
      /*
        This must be done in the middleware with this code:

        ibeRejectableSBT.on("AcceptTransfer", (sender, receiver, tokenId) => {
          console.log("AcceptTransfer", sender, receiver, tokenId);
        });
      */

      const eventTokenId = receiptAccept.events[0].args.tokenId;

      const messageDataOnAccept = await ibeRejectableSBT.messageData(
        eventTokenId
      );

      const eventIdentity = {
        idReceiver: messageDataOnAccept.idReceiver,
        idTimestamp: messageDataOnAccept.idTimestamp
      };

      // extract private key from master secret and public parameters
      const extractResult = cryptID.extract(
        cryptIDSetup.publicParameters,
        cryptIDSetup.masterSecret,
        eventIdentity
      );

      // the middleware sends the private key to the receiver
      await ibeRejectableSBT
        .connect(middleware)
        .sendPrivateKey(
          eventTokenId,
          BigNumber.from(extractResult.privateKey.x).toHexString(),
          BigNumber.from(extractResult.privateKey.y).toHexString()
        );

      // now the receiver can decrypt the message
      const messageDataPrivateKey = await ibeRejectableSBT.messageData(
        eventTokenId
      );
      
      const privateKey = {
        privateKey: {
          x: BigNumber.from(messageDataPrivateKey.privateKey_x),
          y: BigNumber.from(messageDataPrivateKey.privateKey_y)
        },
        success: true
      };

      console.log(cryptIDSetup.publicParameters);
      console.log(privateKey);
      console.log(encryptResult.ciphertext);

      const decryptResult = cryptID.decrypt(
        cryptIDSetup.publicParameters,
        privateKey,
        encryptResult.ciphertext
      );

      console.log(1);
  
      console.log(decryptResult);
    });
  });
});
