import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async ({
  // @ts-ignore
  getNamedAccounts,
  // @ts-ignore
  deployments
}) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("NFT", {
    from: deployer,
    args: ["NFT test", "NFT1"],
    log: true
  });
};

func.tags = ["NFT"];
export default func;
