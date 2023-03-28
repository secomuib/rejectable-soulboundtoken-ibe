import { DeployFunction } from "hardhat-deploy/types";
import { BigNumber } from "ethers";
import CryptID from "@cryptid/cryptid-js";
import crypto from "crypto";

const func: DeployFunction = async ({
  // @ts-ignore
  getNamedAccounts,
  // @ts-ignore
  deployments
}) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const cryptID = await CryptID.getInstance();
  const cryptIDSetup = cryptID.setup(CryptID.SecurityLevel.LOWEST);

  // generate 16 bytes of random data
  const initializationVector = crypto.randomBytes(16);

  await deploy("IBERejectableSBT", {
    from: deployer,
    args: [
      "Rejectable IBE SBT",
      "RSBT1",
      deployer,
      BigNumber.from(initializationVector).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.fieldOrder).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.subgroupOrder).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.pointP.x).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.pointP.y).toHexString(),
      BigNumber.from(
        cryptIDSetup.publicParameters.pointPpublic.x
      ).toHexString(),
      BigNumber.from(cryptIDSetup.publicParameters.pointPpublic.y).toHexString()
    ],
    log: true
  });
};

func.tags = ["IBERejectableSBT"];
export default func;
