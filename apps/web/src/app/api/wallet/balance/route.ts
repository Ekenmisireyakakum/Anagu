import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { POLYGON_AMOY_PUBLIC_CONFIG } from '../../../../lib/polygon-config';

const ERC20_BALANCE_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

function getRpcUrl(): string {
  return (
    process.env.POLYGON_RPC_URL ||
    process.env.NEXT_PUBLIC_POLYGON_RPC_URL ||
    POLYGON_AMOY_PUBLIC_CONFIG.rpcUrl
  );
}

function getLandTokenAddress(): string {
  return (
    process.env.ERC20_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_ERC20_TOKEN_ADDRESS ||
    POLYGON_AMOY_PUBLIC_CONFIG.contracts.ERC20Token
  );
}

export async function GET(request: NextRequest) {
  const rawAddress = request.nextUrl.searchParams.get('address')?.trim() || '';
  if (!rawAddress || !ethers.isAddress(rawAddress)) {
    return NextResponse.json({ message: 'Valid EVM wallet address is required' }, { status: 400 });
  }

  const checksumAddress = ethers.getAddress(rawAddress);
  const rpcUrl = getRpcUrl();
  const tokenAddress = getLandTokenAddress();

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const tokenContract = new ethers.Contract(
      ethers.getAddress(tokenAddress),
      ERC20_BALANCE_ABI,
      provider,
    );

    const [nativeWei, rawTokenBal, decimals, symbol] = await Promise.all([
      provider.getBalance(checksumAddress).catch(() => BigInt(0)),
      tokenContract.balanceOf(checksumAddress).catch(() => BigInt(0)),
      tokenContract.decimals().catch(() => 18),
      tokenContract.symbol().catch(() => POLYGON_AMOY_PUBLIC_CONFIG.tokenMetadata.symbol),
    ]);

    const nativeNum = Number.parseFloat(ethers.formatEther(nativeWei));
    const tokenNum = Number.parseFloat(ethers.formatUnits(rawTokenBal, Number(decimals)));

    return NextResponse.json({
      address: checksumAddress,
      nativePol: Number.isFinite(nativeNum) ? nativeNum.toFixed(4) : '0.0000',
      anaguAlt: Number.isFinite(tokenNum)
        ? tokenNum.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
            useGrouping: true,
          })
        : '0.00',
      symbol: String(symbol || 'ALT'),
      chainId: POLYGON_AMOY_PUBLIC_CONFIG.chainId,
      contractAddress: ethers.getAddress(tokenAddress),
    });
  } catch (err) {
    return NextResponse.json(
      {
        address: checksumAddress,
        nativePol: '0.0000',
        anaguAlt: '0.00',
        symbol: 'ALT',
        chainId: POLYGON_AMOY_PUBLIC_CONFIG.chainId,
        contractAddress: tokenAddress,
        warning: err instanceof Error ? err.message : 'Unable to query Polygon RPC',
      },
      { status: 200 },
    );
  }
}
