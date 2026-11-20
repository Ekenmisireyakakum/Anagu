import hre from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const adminAddress =
    process.env.ADMIN_TREASURY_WALLET_ADDRESS && hre.ethers.isAddress(process.env.ADMIN_TREASURY_WALLET_ADDRESS)
      ? hre.ethers.getAddress(process.env.ADMIN_TREASURY_WALLET_ADDRESS)
      : deployer.address;

  console.log("Deploying with account:", deployer.address);
  console.log("Admin / Treasury wallet:", adminAddress);

  // 1. Deploy or link ERC-20 Token (LandToken)
  let erc20Address = (process.env.ERC20_TOKEN_CONTRACT_ADDRESS || "").trim();
  if (!erc20Address || !hre.ethers.isAddress(erc20Address)) {
    const LandToken = await hre.ethers.getContractFactory("LandToken");
    const initialSupply = hre.ethers.parseEther("10000000");
    const landToken = await LandToken.deploy(adminAddress, initialSupply);
    await landToken.waitForDeployment();
    erc20Address = await landToken.getAddress();
    console.log("LandToken (ERC-20) deployed to:", erc20Address);
  } else {
    console.log("Using configured ERC-20 Token address:", erc20Address);
  }

  // 2. Deploy ERC-721 LandTitleNFT
  const LandTitleNFT = await hre.ethers.getContractFactory("LandTitleNFT");
  const landTitleNFT = await LandTitleNFT.deploy(adminAddress);
  await landTitleNFT.waitForDeployment();
  console.log("LandTitleNFT (ERC-721) deployed to:", await landTitleNFT.getAddress());

  // 3. Deploy LandRegistry
  const LandRegistry = await hre.ethers.getContractFactory("LandRegistry");
  const landRegistry = await LandRegistry.deploy(adminAddress, await landTitleNFT.getAddress());
  await landRegistry.waitForDeployment();
  console.log("LandRegistry deployed to:", await landRegistry.getAddress());

  // 4. Grant REGISTRY_ROLE and GOVERNOR_ROLE on LandTitleNFT to LandRegistry (when deployer is admin)
  if (adminAddress.toLowerCase() === deployer.address.toLowerCase()) {
    const registryRole = await landTitleNFT.REGISTRY_ROLE();
    await landTitleNFT.grantRole(registryRole, await landRegistry.getAddress());
    const governorRole = await landTitleNFT.GOVERNOR_ROLE();
    await landTitleNFT.grantRole(governorRole, await landRegistry.getAddress());
    console.log("Granted REGISTRY_ROLE and GOVERNOR_ROLE to LandRegistry");
  }

  // 5. Deploy ValidatorRegistry
  const ValidatorRegistry = await hre.ethers.getContractFactory("ValidatorRegistry");
  const validatorRegistry = await ValidatorRegistry.deploy(adminAddress);
  await validatorRegistry.waitForDeployment();
  console.log("ValidatorRegistry deployed to:", await validatorRegistry.getAddress());

  // 6. Write deployments/addresses.json
  const deploymentsDir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  const addresses = {
    network,
    chainId: Number(chainId),
    adminWallet: adminAddress,
    ERC20Token: erc20Address,
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
