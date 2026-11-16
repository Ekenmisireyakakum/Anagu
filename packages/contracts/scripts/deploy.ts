import hre from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // 1. Deploy LandTitleNFT
  const LandTitleNFT = await hre.ethers.getContractFactory("LandTitleNFT");
  const landTitleNFT = await LandTitleNFT.deploy(deployer.address);
  await landTitleNFT.waitForDeployment();
  console.log("LandTitleNFT deployed to:", await landTitleNFT.getAddress());

  // 2. Deploy LandRegistry
  const LandRegistry = await hre.ethers.getContractFactory("LandRegistry");
  const landRegistry = await LandRegistry.deploy(deployer.address, await landTitleNFT.getAddress());
  await landRegistry.waitForDeployment();
  console.log("LandRegistry deployed to:", await landRegistry.getAddress());

  // 3. Grant REGISTRY_ROLE on LandTitleNFT to LandRegistry
  const registryRole = await landTitleNFT.REGISTRY_ROLE();
  await landTitleNFT.grantRole(registryRole, await landRegistry.getAddress());
  console.log("Granted REGISTRY_ROLE to LandRegistry");

  // 4. Deploy ValidatorRegistry
  const ValidatorRegistry = await hre.ethers.getContractFactory("ValidatorRegistry");
  const validatorRegistry = await ValidatorRegistry.deploy(deployer.address);
  await validatorRegistry.waitForDeployment();
  console.log("ValidatorRegistry deployed to:", await validatorRegistry.getAddress());

  // 5. Write deployments/addresses.json
  const deploymentsDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  const addresses = {
    network,
    chainId: Number(chainId),
    LandTitleNFT: await landTitleNFT.getAddress(),
    LandRegistry: await landRegistry.getAddress(),
    ValidatorRegistry: await validatorRegistry.getAddress(),
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(deploymentsDir, "addresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("Addresses written to deployments/addresses.json");
  console.log(JSON.stringify(addresses, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
