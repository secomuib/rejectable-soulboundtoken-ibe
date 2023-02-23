import { DeployFunction } from "hardhat-deploy/types";
import { BigNumber } from "ethers";
import CryptID from "@cryptid/cryptid-js";

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

  await deploy("IBERejectableSBT", {
    from: deployer,
    args: [
      "Rejectable IBE SBT",
      "RSBT1",
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
