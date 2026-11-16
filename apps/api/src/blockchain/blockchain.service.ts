import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import * as path from 'path';
import * as fs from 'fs';
import { RegisterLandDto } from './dto/register-land.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { RevokeTitleDto } from './dto/revoke-title.dto';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet | null = null;
  private landTitleNFT: ethers.Contract | null = null;
  private landRegistry: ethers.Contract | null = null;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('BESU_RPC_URL') || 'http://localhost:8545';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const privateKey = this.configService.get<string>('DEPLOYER_PRIVATE_KEY');
    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
    }

    const nftAddress = this.configService.get<string>('LAND_TITLE_NFT_CONTRACT_ADDRESS');
    const registryAddress = this.configService.get<string>('LAND_REGISTRY_CONTRACT_ADDRESS');

    try {
      const nftArtifactPath = path.resolve(
        __dirname,
        '../../../../packages/contracts/artifacts/contracts/LandTitleNFT.sol/LandTitleNFT.json'
      );
      const registryArtifactPath = path.resolve(
        __dirname,
        '../../../../packages/contracts/artifacts/contracts/LandRegistry.sol/LandRegistry.json'
      );

      if (fs.existsSync(nftArtifactPath) && nftAddress) {
        const nftArtifact = JSON.parse(fs.readFileSync(nftArtifactPath, 'utf8'));
        const signerOrProvider = this.signer || this.provider;
        this.landTitleNFT = new ethers.Contract(nftAddress, nftArtifact.abi, signerOrProvider);
      } else {
        this.logger.warn('LandTitleNFT artifact or address not found — contract will be unavailable until deployed');
      }

      if (fs.existsSync(registryArtifactPath) && registryAddress) {
        const registryArtifact = JSON.parse(fs.readFileSync(registryArtifactPath, 'utf8'));
        const signerOrProvider = this.signer || this.provider;
        this.landRegistry = new ethers.Contract(registryAddress, registryArtifact.abi, signerOrProvider);
      } else {
        this.logger.warn('LandRegistry artifact or address not found — contract will be unavailable until deployed');
      }
    } catch (err) {
      this.logger.warn(`Failed to load contract artifacts: ${err}`);
    }
  }

  async isConnected(): Promise<{ connected: boolean; blockNumber?: number; chainId?: number }> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const network = await this.provider.getNetwork();
      return { connected: true, blockNumber, chainId: Number(network.chainId) };
    } catch (_e) {
      return { connected: false };
    }
  }

  async registerLand(dto: RegisterLandDto): Promise<{ txHash: string; tokenId: number }> {
    if (!this.landRegistry) throw new Error('LandRegistry contract not initialized');
    const tx = await (this.landRegistry as any)['registerLand'](
      dto.ownerAddress,
      dto.parcelReference,
      ethers.keccak256(ethers.toUtf8Bytes(dto.spatialHash)),
      ethers.keccak256(ethers.toUtf8Bytes(dto.ownerReference)),
      ethers.keccak256(ethers.toUtf8Bytes(dto.documentHash)),
      dto.tokenUri
    );
    const receipt = await tx.wait();
    // Parse LandRegistered event for tokenId
    let tokenId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = this.landRegistry!.interface.parseLog(log);
        if (parsed && parsed.name === 'LandRegistered') {
          tokenId = Number(parsed.args.tokenId);
          break;
        }
      } catch (_e) { /* skip non-matching logs */ }
    }
    return { txHash: receipt.hash, tokenId };
  }

  async transferOwnership(dto: TransferOwnershipDto): Promise<{ txHash: string }> {
    if (!this.landRegistry) throw new Error('LandRegistry contract not initialized');
    const tx = await (this.landRegistry as any)['transferOwnership'](dto.parcelReference, dto.newOwnerAddress);
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }

  async revokeTitle(dto: RevokeTitleDto): Promise<{ txHash: string }> {
    if (!this.landRegistry) throw new Error('LandRegistry contract not initialized');
    const tx = await (this.landRegistry as any)['revokeTitle'](dto.parcelReference, dto.grounds);
    const receipt = await tx.wait();
    return { txHash: receipt.hash };
  }

  async getTitleMetadata(tokenId: number): Promise<object> {
    if (!this.landTitleNFT) throw new Error('LandTitleNFT contract not initialized');
    const meta = await (this.landTitleNFT as any)['getTitleMetadata'](tokenId);
    return {
      parcelReference: meta.parcelReference,
      spatialHash: meta.spatialHash,
      ownerReference: meta.ownerReference,
      documentHash: meta.documentHash,
      issuedAt: meta.issuedAt.toString(),
      isRevoked: meta.isRevoked,
      revokedAt: meta.revokedAt.toString(),
      revocationGrounds: meta.revocationGrounds,
      revokedBy: meta.revokedBy,
    };
  }

  async getRecord(parcelReference: string): Promise<object> {
    if (!this.landRegistry) throw new Error('LandRegistry contract not initialized');
    const record = await (this.landRegistry as any)['getRecord'](parcelReference);
    return {
      tokenId: record.tokenId.toString(),
      parcelReference: record.parcelReference,
      currentOwner: record.currentOwner,
      spatialHash: record.spatialHash,
      ownerReference: record.ownerReference,
      documentHash: record.documentHash,
      registeredAt: record.registeredAt.toString(),
      lastUpdatedAt: record.lastUpdatedAt.toString(),
      status: Number(record.status),
    };
  }

  async listenToEvents(eventName: string, callback: (event: any) => void): Promise<void> {
    if (!this.landRegistry) throw new Error('LandRegistry contract not initialized');
    this.landRegistry.on(eventName, callback);
  }
}
