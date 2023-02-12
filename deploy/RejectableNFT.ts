import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async ({
  // @ts-ignore
  getNamedAccounts,
  // @ts-ignore
  deployments
}) => {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("RejectableNFT", {
    from: deployer,
    args: ["Rejectable NFT test", "RNFT1"],
    log: true
  });
};

func.tags = ["RejectableNFT"];
export default func;
