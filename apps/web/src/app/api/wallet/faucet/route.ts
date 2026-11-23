import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
  ensureStoreReady,
  persistStoreToSupabase,
  recordAudit,
} from '../../../../lib/anagu-store';
import { POLYGON_AMOY_PUBLIC_CONFIG, getPolygonExplorerTxUrl } from '../../../../lib/polygon-config';
import { getAuthenticatedUser } from '../../../../lib/server-auth';

const ERC20_TREASURY_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function transfer(address to, uint256 value) external returns (bool)',
  'function mint(address to, uint256 amount) external',
  'function MINTER_ROLE() external view returns (bytes32)',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
];

const DEFAULT_FAUCET_ALT = 100_000;
const MAX_CITIZEN_FAUCET_ALT = 100_000;
const MAX_ADMIN_FAUCET_ALT = 1_000_000;
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per user/address for self-claims

const g = globalThis as unknown as {
  __anaguFaucetClaims?: Map<string, number>;
};
if (!g.__anaguFaucetClaims) {
  g.__anaguFaucetClaims = new Map<string, number>();
}

function getRpcUrl(): string {
  return (
    process.env.POLYGON_RPC_URL ||
    process.env.POLYGON_AMOY_RPC_URL ||
    process.env.NEXT_PUBLIC_POLYGON_RPC_URL ||
    POLYGON_AMOY_PUBLIC_CONFIG.rpcUrl
  );
}

function getTokenAddress(): string {
  return (
    process.env.ERC20_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_ERC20_TOKEN_ADDRESS ||
    POLYGON_AMOY_PUBLIC_CONFIG.contracts.ERC20Token
  );
}

export async function GET() {
  const configured = Boolean(process.env.DEPLOYER_PRIVATE_KEY?.trim());
  return NextResponse.json({
    configured,
    tokenAddress: getTokenAddress(),
    symbol: POLYGON_AMOY_PUBLIC_CONFIG.tokenMetadata.symbol,
    chainId: POLYGON_AMOY_PUBLIC_CONFIG.chainId,
    faucetAmountAlt: DEFAULT_FAUCET_ALT,
    polygonFaucetUrl: 'https://faucet.polygon.technology/',
  });
}

export async function POST(request: NextRequest) {
  try {
    await ensureStoreReady();
    const user = getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { message: 'Sign in required to claim or distribute ALT tokens' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawRecipient =
      typeof body?.recipientAddress === 'string' && body.recipientAddress.trim()
        ? body.recipientAddress.trim()
        : user.walletAddress;

    if (!rawRecipient || !ethers.isAddress(rawRecipient)) {
      return NextResponse.json(
        { message: 'Connect or provide a valid Polygon EVM wallet address (0x...)' },
        { status: 400 },
      );
    }

    const recipient = ethers.getAddress(rawRecipient);
    const isAdmin = ['LAND_ADMINISTRATOR', 'GOVERNOR', 'REGISTRAR'].includes(user.role);
    const requestedAmount =
      typeof body?.amountAlt === 'number' || typeof body?.amountAlt === 'string'
        ? Number(body.amountAlt)
        : DEFAULT_FAUCET_ALT;

    const maxAllowed = isAdmin ? MAX_ADMIN_FAUCET_ALT : MAX_CITIZEN_FAUCET_ALT;
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || requestedAmount > maxAllowed) {
      return NextResponse.json(
        { message: `Requested ALT amount must be between 1 and ${maxAllowed.toLocaleString('en-US')} ALT.` },
        { status: 400 },
      );
    }

    if (!isAdmin) {
      const userKey = `user:${user.id}`;
      const addrKey = `addr:${recipient.toLowerCase()}`;
      const now = Date.now();
      const lastClaim = Math.max(
        g.__anaguFaucetClaims?.get(userKey) || 0,
        g.__anaguFaucetClaims?.get(addrKey) || 0,
      );
      if (now - lastClaim < COOLDOWN_MS) {
        const minsLeft = Math.ceil((COOLDOWN_MS - (now - lastClaim)) / 60_000);
        return NextResponse.json(
          { message: `Starter ALT already claimed recently. Try again in ${minsLeft} minute(s).` },
          { status: 429 },
        );
      }
    }

    const deployerKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
    if (!deployerKey) {
      return NextResponse.json(
        {
          ok: false,
          requiresTreasuryTransfer: true,
          message:
            'Automatic server faucet is not enabled here because the Treasury signer key is held externally. An Admin can mint or send ALT tokens to your wallet from the Admin Portal, or you can complete land purchases immediately using zero-gas MetaMask signature verification or Registry Escrow.',
        },
        { status: 400 },
      );
    }

    const provider = new ethers.JsonRpcProvider(getRpcUrl(), undefined, { staticNetwork: true });
    const signer = new ethers.Wallet(deployerKey, provider);
    const tokenAddress = ethers.getAddress(getTokenAddress());
    const token = new ethers.Contract(tokenAddress, ERC20_TREASURY_ABI, signer);
    const amountWei = ethers.parseEther(String(requestedAmount));

    const polBal = await provider.getBalance(signer.address);
    if (polBal === BigInt(0)) {
      return NextResponse.json(
        {
          ok: false,
          requiresTreasuryTransfer: true,
          message:
            'Server treasury wallet has 0 POL for Polygon Amoy gas fees. Ask the Admin to send ALT directly via MetaMask in the Admin Portal, or use Registry Escrow.',
        },
        { status: 400 },
      );
    }

    let hasMinterRole = false;
    try {
      const minterRole = (await token.MINTER_ROLE()) as string;
      hasMinterRole = Boolean(await token.hasRole(minterRole, signer.address));
    } catch {
      hasMinterRole = false;
    }

    let tx: ethers.TransactionResponse;
    if (hasMinterRole) {
      tx = await token.mint(recipient, amountWei);
    } else {
      const treasuryAlt = (await token.balanceOf(signer.address)) as bigint;
      if (treasuryAlt < amountWei) {
        return NextResponse.json(
          {
            ok: false,
            requiresTreasuryTransfer: true,
            message: 'Treasury wallet has insufficient ALT balance for automatic distribution.',
          },
          { status: 400 },
        );
      }
      tx = await token.transfer(recipient, amountWei);
    }

    await tx.wait(1);

    if (!isAdmin) {
      const now = Date.now();
      g.__anaguFaucetClaims?.set(`user:${user.id}`, now);
      g.__anaguFaucetClaims?.set(`addr:${recipient.toLowerCase()}`, now);
    }

    recordAudit(
      user.id,
      user.fullName,
      user.role,
      'ALT_FAUCET_DISTRIBUTED',
      'USER',
      recipient,
      'SUCCESS',
      `Distributed ${requestedAmount.toLocaleString('en-US')} ALT on Polygon Amoy to ${recipient} (tx: ${tx.hash})`,
    );
    await persistStoreToSupabase();

    return NextResponse.json({
      ok: true,
      txHash: tx.hash,
      amountAlt: requestedAmount,
      recipientAddress: recipient,
      explorerUrl: getPolygonExplorerTxUrl(tx.hash, POLYGON_AMOY_PUBLIC_CONFIG.chainId),
    });
  } catch (err) {
    return NextResponse.json(
      {
        message: err instanceof Error ? err.message : 'Unable to distribute ALT tokens',
      },
      { status: 500 },
    );
  }
}
