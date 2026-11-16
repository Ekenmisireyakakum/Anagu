import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("LandTitleNFT", function () {
  async function deployLandTitleNFT() {
    const [admin, governor, registrar, user1, user2] = await hre.ethers.getSigners();
    const LandTitleNFT = await hre.ethers.getContractFactory("LandTitleNFT");
    const nft = await LandTitleNFT.deploy(admin.address);
    await nft.waitForDeployment();

    // Grant REGISTRY_ROLE to registrar and GOVERNOR_ROLE to governor
    await nft.connect(admin).grantRole(await nft.REGISTRY_ROLE(), registrar.address);
    await nft.connect(admin).grantRole(await nft.GOVERNOR_ROLE(), governor.address);

    return { nft, admin, governor, registrar, user1, user2 };
  }

  it("deploy with correct roles", async function () {
    const { nft, admin, governor, registrar, user1 } = await loadFixture(deployLandTitleNFT);
    expect(await nft.hasRole(await nft.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
    expect(await nft.hasRole(await nft.REGISTRY_ROLE(), admin.address)).to.be.true;
    expect(await nft.hasRole(await nft.GOVERNOR_ROLE(), admin.address)).to.be.true;
    expect(await nft.hasRole(await nft.REGISTRY_ROLE(), registrar.address)).to.be.true;
    expect(await nft.hasRole(await nft.GOVERNOR_ROLE(), governor.address)).to.be.true;
    expect(await nft.hasRole(await nft.REGISTRY_ROLE(), user1.address)).to.be.false;
  });

  it("mint with metadata", async function () {
    const { nft, registrar, user1 } = await loadFixture(deployLandTitleNFT);
    await nft.connect(registrar).mint(
      user1.address, 1, "ipfs://test",
      "LG-TEST-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash
    );
    const meta = await nft.titleMetadata(1);
    expect(meta.issuedAt).to.be.gt(0);
    expect(await nft.ownerOf(1)).to.equal(user1.address);
    expect(await nft.tokenURI(1)).to.equal("ipfs://test");
  });

  it("emit TitleIssued event", async function () {
    const { nft, registrar, user1 } = await loadFixture(deployLandTitleNFT);
    await expect(
      nft.connect(registrar).mint(
        user1.address, 1, "ipfs://test",
        "LG-TEST-001",
        hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash
      )
    ).to.emit(nft, "TitleIssued").withArgs(1, user1.address);
  });

  it("prevent direct user transfer", async function () {
    const { nft, registrar, user1, user2 } = await loadFixture(deployLandTitleNFT);
    await nft.connect(registrar).mint(
      user1.address, 1, "ipfs://test",
      "LG-TEST-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash
    );
    await expect(
      nft.connect(user1).transferFrom(user1.address, user2.address, 1)
    ).to.be.revertedWith("LandTitleNFT: direct transfer not allowed");
  });

  it("GOVERNOR revokes title", async function () {
    const { nft, registrar, governor, user1 } = await loadFixture(deployLandTitleNFT);
    await nft.connect(registrar).mint(
      user1.address, 1, "ipfs://test",
      "LG-TEST-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash
    );
    await nft.connect(governor).revoke(1, "fraud");
    expect(await nft.isRevoked(1)).to.be.true;
    const meta = await nft.titleMetadata(1);
    expect(meta.isRevoked).to.be.true;
  });

  it("prevent double revocation", async function () {
    const { nft, registrar, governor, user1 } = await loadFixture(deployLandTitleNFT);
    await nft.connect(registrar).mint(
      user1.address, 1, "ipfs://test",
      "LG-TEST-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash
    );
    await nft.connect(governor).revoke(1, "fraud");
    await expect(
      nft.connect(governor).revoke(1, "again")
    ).to.be.revertedWith("LandTitleNFT: already revoked");
  });

  it("prevent non-GOVERNOR revocation", async function () {
    const { nft, registrar, user1 } = await loadFixture(deployLandTitleNFT);
    await nft.connect(registrar).mint(
      user1.address, 1, "ipfs://test",
      "LG-TEST-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash
    );
    await expect(
      nft.connect(user1).revoke(1, "try")
    ).to.be.reverted;
  });

  it("prevent transfer of revoked title", async function () {
    const { nft, registrar, governor, user1, user2 } = await loadFixture(deployLandTitleNFT);
    await nft.connect(registrar).mint(
      user1.address, 1, "ipfs://test",
      "LG-TEST-001",
      hre.ethers.ZeroHash, hre.ethers.ZeroHash, hre.ethers.ZeroHash
    );
    await nft.connect(governor).revoke(1, "fraud");
    await expect(
      nft.connect(registrar).transferFrom(user1.address, user2.address, 1)
    ).to.be.revertedWith("LandTitleNFT: title is revoked");
  });

  it("store and retrieve full metadata", async function () {
    const { nft, registrar, user1 } = await loadFixture(deployLandTitleNFT);
    const spatialHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("spatial"));
    const ownerRef = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("owner"));
    const docHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("doc"));
    await nft.connect(registrar).mint(
      user1.address, 1, "ipfs://meta",
      "LG-FULL-001",
      spatialHash, ownerRef, docHash
    );
    const meta = await nft.getTitleMetadata(1);
    expect(meta.parcelReference).to.equal("LG-FULL-001");
    expect(meta.spatialHash).to.equal(spatialHash);
    expect(meta.ownerReference).to.equal(ownerRef);
    expect(meta.documentHash).to.equal(docHash);
    expect(meta.isRevoked).to.be.false;
    expect(meta.issuedAt).to.be.gt(0);
  });
});
