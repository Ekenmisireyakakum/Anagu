import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import fs from 'node:fs';
import path from 'node:path';

interface DeployedAddressesFile {
  network?: string;
  chainId?: number;
  LandTitleNFT?: string;
  LandRegistry?: string;
  ValidatorRegistry?: string;
  deployedAt?: string;
}

function resolveContractsRoot(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'packages/contracts'),
    path.resolve(process.cwd(), '../../packages/contracts'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('RPC timeout')), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function GET() {
  const contractsRoot = resolveContractsRoot();

  const checkArtifact = (contractName: string): boolean => {
    if (!contractsRoot) return false;
    const p = path.join(
      contractsRoot,
      'artifacts/contracts',
      `${contractName}.sol`,
      `${contractName}.json`,
    );
    return fs.existsSync(p);
  };

  let deployedFile: DeployedAddressesFile = {};
  if (contractsRoot) {
    const deployPath = path.join(contractsRoot, 'deployments/addresses.json');
    if (fs.existsSync(deployPath)) {
      try {
        deployedFile = JSON.parse(fs.readFileSync(deployPath, 'utf8')) as DeployedAddressesFile;
      } catch {
        // Ignore malformed deployments json
      }
    }
  }

  const addresses = {
    LandTitleNFT:
      process.env.LAND_TITLE_NFT_CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_LAND_TITLE_NFT_ADDRESS ||
      deployedFile.LandTitleNFT ||
      null,
    LandRegistry:
      process.env.LAND_REGISTRY_CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_LAND_REGISTRY_ADDRESS ||
      deployedFile.LandRegistry ||
      null,
    ValidatorRegistry:
      process.env.VALIDATOR_REGISTRY_CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_VALIDATOR_REGISTRY_ADDRESS ||
      deployedFile.ValidatorRegistry ||
      null,
  };

  const rpcUrl = process.env.BESU_RPC_URL || process.env.NEXT_PUBLIC_BESU_RPC_URL || '';
  let rpcConnected = false;
  let blockNumber: number | null = null;
  let chainId: number | null = null;
  const deployedOnChain = {
    LandTitleNFT: false,
    LandRegistry: false,
    ValidatorRegistry: false,
  };

  if (rpcUrl) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const [bn, net] = await withTimeout(
        Promise.all([provider.getBlockNumber(), provider.getNetwork()]),
        2000,
      );
      rpcConnected = true;
      blockNumber = bn;
      chainId = Number(net.chainId);

      const checkCode = async (addr: string | null) => {
        if (!addr || !ethers.isAddress(addr)) return false;
        const code = await withTimeout(provider.getCode(addr), 1500);
        return Boolean(code && code !== '0x');
      };

      const [c1, c2, c3] = await Promise.all([
        checkCode(addresses.LandTitleNFT),
        checkCode(addresses.LandRegistry),
        checkCode(addresses.ValidatorRegistry),
      ]);
      deployedOnChain.LandTitleNFT = c1;
      deployedOnChain.LandRegistry = c2;
      deployedOnChain.ValidatorRegistry = c3;
    } catch {
      rpcConnected = false;
    }
  }

  return NextResponse.json({
    mode:
      rpcConnected && deployedOnChain.LandTitleNFT && deployedOnChain.LandRegistry
        ? 'LIVE_BESU_ONCHAIN'
        : 'WEB3_CRYPTO_LEDGER',
    rpcConfigured: Boolean(rpcUrl),
    rpcConnected,
    blockNumber,
    chainId,
    contracts: [
      {
        name: 'LandTitleNFT',
        standard: 'ERC-721 + AccessControl',
        compiled: checkArtifact('LandTitleNFT'),
        address: addresses.LandTitleNFT,
        deployedOnChain: deployedOnChain.LandTitleNFT,
      },
      {
        name: 'LandRegistry',
        standard: 'Registry + ReentrancyGuard',
        compiled: checkArtifact('LandRegistry'),
        address: addresses.LandRegistry,
        deployedOnChain: deployedOnChain.LandRegistry,
      },
      {
        name: 'ValidatorRegistry',
        standard: 'Advisory QBFT Validators',
        compiled: checkArtifact('ValidatorRegistry'),
        address: addresses.ValidatorRegistry,
        deployedOnChain: deployedOnChain.ValidatorRegistry,
      },
    ],
  });
}
