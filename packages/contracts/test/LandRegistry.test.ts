import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("LandRegistry", function () {
  async function deployLandRegistry() {
    const [admin, governor, registrar, user1, user2] = await hre.ethers.getSigners();

    const LandTitleNFT = await hre.ethers.getContractFactory("LandTitleNFT");
    const nft = await LandTitleNFT.deploy(admin.address);
    await nft.waitForDeployment();

    const LandRegistry = await hre.ethers.getContractFactory("LandRegistry");
    const registry = await LandRegistry.deploy(admin.address, await nft.getAddress());
    await registry.waitForDeployment();

    // Grant REGISTRY_ROLE on NFT to LandRegistry
    await nft.connect(admin).grantRole(await nft.REGISTRY_ROLE(), await registry.getAddress());

    // Grant GOVERNOR_ROLE on NFT to LandRegistry so it can call revoke
    await nft.connect(admin).grantRole(await nft.GOVERNOR_ROLE(), await registry.getAddress());

    // Grant REGISTRAR_ROLE on registry to registrar
    await registry.connect(admin).grantRole(await registry.REGISTRAR_ROLE(), registrar.address);

    // Grant GOVERNOR_ROLE on registry to governor
    await registry.connect(admin).grantRole(await registry.GOVERNOR_ROLE(), governor.address);

    return { nft, registry, admin, governor, registrar, user1, user2 };
  }

  it("register parcel and mint NFT", async function () {
    const { nft, registry, registrar, user1 } = await loadFixture(deployLandRegistry);
    await registry.connect(registrar).registerLand(
      user1.address, "LG-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://1"
    );
    const record = await registry.getRecord("LG-001");
    expect(record.tokenId).to.equal(1);
    expect(await nft.ownerOf(1)).to.equal(user1.address);
  });

  it("emit LandRegistered event", async function () {
    const { registry, registrar, user1 } = await loadFixture(deployLandRegistry);
    await expect(
      registry.connect(registrar).registerLand(
        user1.address, "LG-001",
        hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
        "ipfs://1"
      )
    ).to.emit(registry, "LandRegistered").withArgs("LG-001", 1, user1.address);
  });

  it("prevent duplicate registration", async function () {
    const { registry, registrar, user1 } = await loadFixture(deployLandRegistry);
    await registry.connect(registrar).registerLand(
      user1.address, "LG-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://1"
    );
    await expect(
      registry.connect(registrar).registerLand(
        user1.address, "LG-001",
        hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
        "ipfs://2"
      )
    ).to.be.revertedWith("LandRegistry: already registered");
  });

  it("REGISTRAR transfers ownership", async function () {
    const { nft, registry, registrar, user1, user2 } = await loadFixture(deployLandRegistry);
    await registry.connect(registrar).registerLand(
      user1.address, "LG-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://1"
    );
    await registry.connect(registrar).transferOwnership("LG-001", user2.address);
    const record = await registry.getRecord("LG-001");
    expect(record.currentOwner).to.equal(user2.address);
    expect(await nft.ownerOf(1)).to.equal(user2.address);
  });

  it("prevent direct NFT transfer bypassing registry", async function () {
    const { nft, registry, registrar, user1, user2 } = await loadFixture(deployLandRegistry);
    await registry.connect(registrar).registerLand(
      user1.address, "LG-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://1"
    );
    await expect(
      nft.connect(user1).transferFrom(user1.address, user2.address, 1)
    ).to.be.revertedWith("LandTitleNFT: direct transfer not allowed");
  });

  it("GOVERNOR revokes through registry", async function () {
    const { nft, registry, registrar, governor, user1 } = await loadFixture(deployLandRegistry);
    await registry.connect(registrar).registerLand(
      user1.address, "LG-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://1"
    );
    await registry.connect(governor).revokeTitle("LG-001", "fraud");
    const record = await registry.getRecord("LG-001");
    // RecordStatus.Revoked = 2
    expect(record.status).to.equal(2);
    expect(await nft.isRevoked(1)).to.be.true;
  });

  it("prevent non-GOVERNOR revocation", async function () {
    const { registry, registrar, user1 } = await loadFixture(deployLandRegistry);
    await registry.connect(registrar).registerLand(
      user1.address, "LG-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://1"
    );
    await expect(
      registry.connect(user1).revokeTitle("LG-001", "try")
    ).to.be.reverted;
  });

  it("prevent transfer of revoked parcel", async function () {
    const { registry, registrar, governor, user1, user2 } = await loadFixture(deployLandRegistry);
    await registry.connect(registrar).registerLand(
      user1.address, "LG-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://1"
    );
    await registry.connect(governor).revokeTitle("LG-001", "fraud");
    await expect(
      registry.connect(registrar).transferOwnership("LG-001", user2.address)
    ).to.be.revertedWith("LandRegistry: record not active");
  });

  it("maintain full ownership history (3 entries)", async function () {
    const { registry, registrar, user1, user2 } = await loadFixture(deployLandRegistry);
    await registry.connect(registrar).registerLand(
      user1.address, "LG-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://1"
    );
    await registry.connect(registrar).transferOwnership("LG-001", user2.address);
    await registry.connect(registrar).transferOwnership("LG-001", user1.address);
    const history = await registry.getOwnershipHistory("LG-001");
    expect(history.length).to.equal(3);
  });

  it("gas for registerLand < 500000", async function () {
    const { registry, registrar, user1 } = await loadFixture(deployLandRegistry);
    const tx = await registry.connect(registrar).registerLand(
      user1.address, "LG-GAS-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash,
      "ipfs://gas"
    );
    const receipt = await tx.wait();
    expect(receipt!.gasUsed).to.be.lessThan(500000n);
  });
});
