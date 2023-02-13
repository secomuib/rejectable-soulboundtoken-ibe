import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async ({
  // @ts-ignore
  getNamedAccounts,
  // @ts-ignore
  deployments
}) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("RejectableSBT", {
    from: deployer,
    args: ["Rejectable SBT test", "RSBT1"],
    log: true
  });
};

func.tags = ["RejectableSBT"];
export default func;
