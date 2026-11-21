export const POLYGON_AMOY_PUBLIC_CONFIG = {
  network: 'polygon_amoy',
  chainId: 80002,
  rpcUrl: 'https://polygon-amoy-bor-rpc.publicnode.com',
  explorerUrl: 'https://amoy.polygonscan.com',
  contracts: {
    ERC20Token: '0xd063b0913829581fD0E0a292d8C6FB567261164E',
    LandTitleNFT: '0x2E5a69C9C8c1dfeB67e7c89ED8b57eEd267107c4',
    LandRegistry: '0x0C3173Ef2c510F4Cb8BCD5717aADa71Ff371B03f',
    ValidatorRegistry: '0x763462c69ebef5537363ba7d7BD7e5A195b07135',
  },
  tokenMetadata: {
    name: 'ANAGU Land Token',
    symbol: 'ALT',
    decimals: 18,
  },
} as const;

export function getPolygonExplorerTxUrl(txHash: string, chainId?: number | null): string {
  const base = chainId === 137 ? 'https://polygonscan.com' : 'https://amoy.polygonscan.com';
  return `${base}/tx/${txHash}`;
}

export function getPolygonExplorerAddressUrl(address: string, chainId?: number | null): string {
  const base = chainId === 137 ? 'https://polygonscan.com' : 'https://amoy.polygonscan.com';
  return `${base}/address/${address}`;
}
