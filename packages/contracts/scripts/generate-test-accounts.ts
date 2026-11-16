import hre from "hardhat";

async function main() {
  const signers = await hre.ethers.getSigners();
  const roles = ["deployer", "governor", "registrar", "surveyor", "citizen"];
  for (let i = 0; i < roles.length; i++) {
    console.log(
      `${roles[i]}: ${signers[i].address}  (private key derivable from Hardhat default mnemonic, index ${i})`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
