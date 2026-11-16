import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("ValidatorRegistry", function () {
  async function deployValidatorRegistry() {
    const [admin, validator1, validator2, nonAdmin] = await hre.ethers.getSigners();
    const ValidatorRegistry = await hre.ethers.getContractFactory("ValidatorRegistry");
    const reg = await ValidatorRegistry.deploy(admin.address);
    await reg.waitForDeployment();
    return { reg, admin, validator1, validator2, nonAdmin };
  }

  it("addValidator sets correct state", async function () {
    const { reg, admin, validator1 } = await loadFixture(deployValidatorRegistry);
    await reg.connect(admin).addValidator(validator1.address, 100);
    expect(await reg.isValidator(validator1.address)).to.be.true;
    expect(await reg.validatorWeight(validator1.address)).to.equal(100);
    const validators = await reg.getValidators();
    expect(validators).to.include(validator1.address);
  });

  it("getTotalWeight sums all weights", async function () {
    const { reg, admin, validator1, validator2 } = await loadFixture(deployValidatorRegistry);
    await reg.connect(admin).addValidator(validator1.address, 100);
    await reg.connect(admin).addValidator(validator2.address, 50);
    expect(await reg.getTotalWeight()).to.equal(150);
  });

  it("removeValidator removes from list", async function () {
    const { reg, admin, validator1 } = await loadFixture(deployValidatorRegistry);
    await reg.connect(admin).addValidator(validator1.address, 100);
    await reg.connect(admin).removeValidator(validator1.address);
    expect(await reg.isValidator(validator1.address)).to.be.false;
    const validators = await reg.getValidators();
    expect(validators.length).to.equal(0);
  });

  it("updateWeight changes weight", async function () {
    const { reg, admin, validator1 } = await loadFixture(deployValidatorRegistry);
    await reg.connect(admin).addValidator(validator1.address, 100);
    await reg.connect(admin).updateWeight(validator1.address, 200);
    expect(await reg.validatorWeight(validator1.address)).to.equal(200);
    expect(await reg.getTotalWeight()).to.equal(200);
  });

  it("prevent non-ADMIN from adding validator", async function () {
    const { reg, nonAdmin, validator1 } = await loadFixture(deployValidatorRegistry);
    await expect(
      reg.connect(nonAdmin).addValidator(validator1.address, 100)
    ).to.be.reverted;
  });
});
