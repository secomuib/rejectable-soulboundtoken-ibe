import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, waffle } from "hardhat";
import chai from "chai";
import { BigNumber, Contract, utils } from "ethers";
import CryptID from "@cryptid/cryptid-js";
import crypto from "crypto";

chai.use(waffle.solidity);
const { expect } = chai;

const RSBT_NAME = "Rejectable IBE SBT";
const RSBT_SYMBOL = "RSBT1";

const algorithm = "aes-256-cbc";
const message = "This is a secret message";
const deadlineAccept = Math.floor(Date.now() / 1000) + 60 * 15; // 15 minutes from now
const deadlinePrivateKey = Math.floor(Date.now() / 1000) + 60 * 30; // 30 minutes from now

const convertToHex = (str: string) => {
  if (str.length % 2 !== 0) {
    return "0x0" + str;
  } else {
    return "0x" + str;
  }
};

describe("IBERejectableSBT", () => {
  let ibeRejectableSBT: Contract;
  let middleware: SignerWithAddress;
  let sender: SignerWithAddress;
  let receiver: SignerWithAddress;
  let cryptID: CryptID;
  let cryptIDSetup: CryptID.SetupResult;
  let initializationVector: Uint8Array;

  before(async () => {
    [middleware, sender, receiver] = await ethers.getSigners();

    cryptID = await CryptID.getInstance();
    cryptIDSetup = cryptID.setup(CryptID.SecurityLevel.LOWEST);

    expect(cryptIDSetup.success).to.be.true;

    // generate 16 bytes of random data
    initializationVector = crypto.randomBytes(16);

    const IBERejectableSBT = await ethers.getContractFactory(
      "IBERejectableSBT"
    );
    ibeRejectableSBT = await IBERejectableSBT.deploy(
      RSBT_NAME,
      RSBT_SYMBOL,
      middleware.address,
      BigNumber.from(initializationVector).toHexString(),
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
      expect(await ibeRejectableSBT.aesInitializationVector()).to.be.equal(
        BigNumber.from(initializationVector).toHexString()
      );
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
    let identity;
    let encryptResult;
    let aesSecurityKey;
    let encryptedMessage;
    let encryptedKey;

    before(async () => {
      identity = {
        idReceiver: receiver.address,
        idTimestamp: Math.floor(new Date().getTime() / 1000)
      };

      // secret key generate 32 bytes of random data
      aesSecurityKey = crypto.randomBytes(32);
      // the cipher function
      const cipher = crypto.createCipheriv(
        algorithm,
        aesSecurityKey,
        Buffer.from(
          (await ibeRejectableSBT.aesInitializationVector()).replace("0x", ""),
          "hex"
        )
      );

      // encrypt the message
      encryptedMessage =
        cipher.update(message, "utf-8", "hex") + cipher.final("hex");

      encryptResult = cryptID.encrypt(
        cryptIDSetup.publicParameters,
        identity,
        BigNumber.from(aesSecurityKey).toHexString()
      );
      expect(encryptResult.success).to.be.true;
      encryptedKey = encryptResult.ciphertext;
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
          deadlineAccept,
          deadlinePrivateKey,
          utils.keccak256(utils.toUtf8Bytes(message)),
          utils.keccak256(utils.toUtf8Bytes(encryptedMessage)),
          convertToHex(encryptedKey.cipherU.x),
          convertToHex(encryptedKey.cipherU.y),
          encryptedKey.cipherV,
          encryptedKey.cipherW
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
      // check the state of the token. 0 = minted, 1 = accepted, 2 = rejected, 3 = cancelled, 4 = privatekeysent, 5 = expired
      expect(await ibeRejectableSBT.getState(tokenId)).to.be.equal(0);
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
          deadlineAccept,
          deadlinePrivateKey,
          utils.keccak256(utils.toUtf8Bytes(message)),
          utils.keccak256(utils.toUtf8Bytes(encryptedMessage)),
          convertToHex(encryptedKey.cipherU.x),
          convertToHex(encryptedKey.cipherU.y),
          encryptedKey.cipherV,
          encryptedKey.cipherW
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
      // check the state of the token. 0 = minted, 1 = accepted, 2 = rejected, 3 = cancelled, 4 = privatekeysent, 5 = expired
      expect(await ibeRejectableSBT.getState(tokenId)).to.be.equal(3);
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
          deadlineAccept,
          deadlinePrivateKey,
          utils.keccak256(utils.toUtf8Bytes(message)),
          utils.keccak256(utils.toUtf8Bytes(encryptedMessage)),
          convertToHex(encryptedKey.cipherU.x),
          convertToHex(encryptedKey.cipherU.y),
          encryptedKey.cipherV,
          encryptedKey.cipherW
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
      await ibeRejectableSBT.connect(receiver).rejectTransfer(tokenId);
      // after minting, we have a balance of 0, because the receiver needs to accept
      expect(await ibeRejectableSBT.balanceOf(receiver.address)).to.be.equal(0);
      expect(await ibeRejectableSBT.ownerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
      // the receiver is removed as transferable owner
      expect(await ibeRejectableSBT.transferableOwnerOf(tokenId)).to.be.equal(
        ethers.constants.AddressZero
      );
      // check the state of the token. 0 = minted, 1 = accepted, 2 = rejected, 3 = cancelled, 4 = privatekeysent, 5 = expired
      expect(await ibeRejectableSBT.getState(tokenId)).to.be.equal(2);
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
          deadlineAccept,
          deadlinePrivateKey,
          utils.keccak256(utils.toUtf8Bytes(message)),
          utils.keccak256(utils.toUtf8Bytes(encryptedMessage)),
          convertToHex(encryptedKey.cipherU.x),
          convertToHex(encryptedKey.cipherU.y),
          encryptedKey.cipherV,
          encryptedKey.cipherW
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
      // check the state of the token. 0 = minted, 1 = accepted, 2 = rejected, 3 = cancelled, 4 = privatekeysent, 5 = expired
      expect(await ibeRejectableSBT.getState(tokenId)).to.be.equal(1);
    });
  });

  /**
   * Middleware sends private key to receiver
   */
  describe("Middleware sends private key to receiver", () => {
    let identity;
    let encryptResult;
    let aesSecurityKey;
    let encryptedMessage;
    let encryptedKey;

    before(async () => {
      identity = {
        idReceiver: receiver.address,
        idTimestamp: Math.floor(new Date().getTime() / 1000)
      };

      // secret key generate 32 bytes of random data
      aesSecurityKey = crypto.randomBytes(32);
      // the cipher function
      const cipher = crypto.createCipheriv(
        algorithm,
        aesSecurityKey,
        Buffer.from(
          (await ibeRejectableSBT.aesInitializationVector()).replace("0x", ""),
          "hex"
        )
      );

      // encrypt the message
      encryptedMessage =
        cipher.update(message, "utf-8", "hex") + cipher.final("hex");

      encryptResult = cryptID.encrypt(
        cryptIDSetup.publicParameters,
        identity,
        BigNumber.from(aesSecurityKey).toHexString()
      );
      expect(encryptResult.success).to.be.true;
      encryptedKey = encryptResult.ciphertext;
    });

    it("When receiver accepts transfer, middleware stores private key to decrypt the message", async () => {
      // mint
      const txMint = await ibeRejectableSBT
        .connect(sender)
        .mint(
          identity.idReceiver,
          identity.idTimestamp,
          deadlineAccept,
          deadlinePrivateKey,
          utils.keccak256(utils.toUtf8Bytes(message)),
          utils.keccak256(utils.toUtf8Bytes(encryptedMessage)),
          convertToHex(encryptedKey.cipherU.x),
          convertToHex(encryptedKey.cipherU.y),
          encryptedKey.cipherV,
          encryptedKey.cipherW
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
      expect(receiptAccept.events[0].args.from).to.be.equal(sender.address);
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
        idTimestamp: messageDataOnAccept.idTimestamp.toNumber()
      };

      // extract private key from master secret and public parameters
      const extractResult = cryptID.extract(
        cryptIDSetup.publicParameters,
        cryptIDSetup.masterSecret,
        eventIdentity
      );
      expect(extractResult.success).to.be.true;

      // the middleware sends the private key to the receiver
      await ibeRejectableSBT
        .connect(middleware)
        .sendPrivateKey(
          eventTokenId,
          BigNumber.from(extractResult.privateKey.x).toHexString(),
          BigNumber.from(extractResult.privateKey.y).toHexString()
        );

      // check the state of the token. 0 = minted, 1 = accepted, 2 = rejected, 3 = cancelled, 4 = privatekeysent, 5 = expired
      expect(await ibeRejectableSBT.getState(tokenId)).to.be.equal(4);

      // now the receiver can decrypt the message
      const messageDataOnGetPrivateKey = await ibeRejectableSBT.messageData(
        eventTokenId
      );

      // receiver gets the private key from the smart contract
      const privateKey = {
        x: BigNumber.from(messageDataOnGetPrivateKey.privateKey_x).toString(),
        y: BigNumber.from(messageDataOnGetPrivateKey.privateKey_y).toString()
      };

      // receiver gets the AES encrypted key from the smart contract
      const encryptedKeyFromSC = {
        cipherU: {
          x: messageDataOnGetPrivateKey.encryptedKey_cipherU_x.replace(
            "0x",
            ""
          ),
          y: messageDataOnGetPrivateKey.encryptedKey_cipherU_y.replace("0x", "")
        },
        cipherV: messageDataOnGetPrivateKey.encryptedKey_cipherV,
        cipherW: messageDataOnGetPrivateKey.encryptedKey_cipherW
      };

      // receiver decrypts the AES private key to decrypt the message
      const decryptResult = cryptID.decrypt(
        cryptIDSetup.publicParameters,
        privateKey,
        encryptedKeyFromSC
      );
      expect(decryptResult.success).to.be.true;

      // receiver checks that the cipher hash of the message that he has received off-chain
      // is correct, comparing with the stored hash in the smart contract
      expect(messageDataOnGetPrivateKey.encryptedMessageHash).to.be.equal(
        utils.keccak256(utils.toUtf8Bytes(encryptedMessage))
      );

      // receiver gets the AES security key
      const securityKey = decryptResult.plaintext;

      // the cipher function
      const decipher = crypto.createDecipheriv(
        algorithm,
        Buffer.from(securityKey.replace("0x", ""), "hex"),
        Buffer.from(
          (await ibeRejectableSBT.aesInitializationVector()).replace("0x", ""),
          "hex"
        )
      );
      let decryptedMessage =
        decipher.update(encryptedMessage, "hex", "utf-8") +
        decipher.final("utf8");

      // check if the hash of the message is correct
      expect(messageDataOnGetPrivateKey.messageHash).to.be.equal(
        utils.keccak256(utils.toUtf8Bytes(decryptedMessage))
      );
    });
  });
});
