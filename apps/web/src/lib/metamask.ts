import { ethers } from 'ethers';

export type WalletProviderType = 'metamask' | 'trustwallet';

export interface Eip1193Provider {
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: Eip1193Provider[];
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface Eip6963AnnounceEvent extends Event {
  detail: {
    info: Eip6963ProviderInfo;
    provider: Eip1193Provider;
  };
}

export const BESU_CHAIN_ID = Number(process.env.NEXT_PUBLIC_BESU_CHAIN_ID || 1337);
export const BESU_CHAIN_HEX = `0x${BESU_CHAIN_ID.toString(16)}`;
export const BESU_RPC_URL = process.env.NEXT_PUBLIC_BESU_RPC_URL || 'http://127.0.0.1:8545';
export const LAND_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_LAND_REGISTRY_ADDRESS || '';

export const LAND_REGISTRY_ABI = [
  'function registerLand(address owner, string parcelReference, bytes32 spatialHash, bytes32 ownerReference, bytes32 documentHash, string tokenUri) external',
  'function transferOwnership(string parcelReference, address newOwner) external',
  'function revokeTitle(string parcelReference, string grounds) external',
];

export interface WalletProofPayload {
  message: string;
  signature: string;
  signerAddress: string;
  chainId: number | null;
  onChainTxHash?: string;
}

export function getWalletLabel(type: WalletProviderType | null): string {
  if (type === 'trustwallet') return 'Trust Wallet';
  if (type === 'metamask') return 'MetaMask';
  return 'Web3 Wallet';
}

export function getTrustWalletDeepLink(dappUrl: string): string {
  return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(dappUrl)}`;
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getChainDisplayName(chainId: number | null): string {
  if (chainId === null) return 'Not Connected';
  if (chainId === BESU_CHAIN_ID) return `ANAGU Besu QBFT (${chainId})`;
  if (chainId === 1) return 'Ethereum Mainnet (1)';
  if (chainId === 11155111) return 'Sepolia Testnet (11155111)';
  if (chainId === 31337) return 'Hardhat Local (31337)';
  return `EVM Chain #${chainId}`;
}

export function formatMetaMaskError(err: unknown, walletName = 'Wallet'): string {
  if (!err) return `${walletName} request failed`;
  const maybeObj = err as { code?: number; message?: string; shortMessage?: string };
  if (maybeObj.code === 4001) {
    return `Request rejected in ${walletName}.`;
  }
  if (maybeObj.code === -32002) {
    return `A ${walletName} confirmation prompt is already pending. Open your ${walletName} extension or app to respond.`;
  }
  const msg = maybeObj.shortMessage || maybeObj.message || (err instanceof Error ? err.message : String(err));
  if (msg.includes('Failed to connect to MetaMask') || msg.includes('Failed to connect')) {
    return `Browser ${walletName} extension could not be reached inside this embedded frame. Open ANAGU in a standalone tab or pair via ${walletName} Mobile.`;
  }
  return msg;
}

function isTrustProvider(p?: Eip1193Provider | null, info?: Eip6963ProviderInfo): boolean {
  if (!p && !info) return false;
  return Boolean(
    info?.rdns === 'com.trustwallet.app' ||
      info?.name?.toLowerCase().includes('trust') ||
      p?.isTrust ||
      p?.isTrustWallet,
  );
}

function isStrictMetaMaskProvider(p?: Eip1193Provider | null, info?: Eip6963ProviderInfo): boolean {
  if (!p && !info) return false;
  if (isTrustProvider(p, info)) return false;
  return Boolean(
    info?.rdns === 'io.metamask' ||
      info?.rdns === 'io.metamask.flask' ||
      info?.name?.toLowerCase().includes('metamask') ||
      p?.isMetaMask,
  );
}

export async function discoverWalletProvider(
  target: WalletProviderType | 'any' = 'any',
  timeoutMs = 300,
): Promise<{ provider: Eip1193Provider; walletType: WalletProviderType } | null> {
  if (typeof window === 'undefined') return null;

  const discovered = await new Promise<{
    provider: Eip1193Provider;
    walletType: WalletProviderType;
  } | null>((resolve) => {
    let settled = false;
    let fallback: { provider: Eip1193Provider; walletType: WalletProviderType } | null = null;

    const handler = (event: Event) => {
      const announce = event as Eip6963AnnounceEvent;
      const detail = announce.detail;
      if (!detail?.provider) return;

      const isTrust = isTrustProvider(detail.provider, detail.info);
      const isMm = isStrictMetaMaskProvider(detail.provider, detail.info);
      const detectedType: WalletProviderType = isTrust ? 'trustwallet' : 'metamask';

      if (
        (target === 'trustwallet' && isTrust) ||
        (target === 'metamask' && isMm) ||
        (target === 'any' && (isMm || isTrust))
      ) {
        if (!settled) {
          settled = true;
          window.removeEventListener('eip6963:announceProvider', handler);
          resolve({ provider: detail.provider, walletType: detectedType });
        }
      } else if (target === 'any' && !fallback) {
        fallback = { provider: detail.provider, walletType: detectedType };
      }
    };

    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('eip6963:announceProvider', handler);
      resolve(fallback);
    }, timeoutMs);
  });

  if (discovered) return discovered;

  const win = window as Window & {
    ethereum?: Eip1193Provider;
    trustwallet?: Eip1193Provider;
    trustWallet?: Eip1193Provider;
  };

  if (target === 'trustwallet' || target === 'any') {
    const directTrust = win.trustwallet || win.trustWallet;
    if (directTrust) {
      return { provider: directTrust, walletType: 'trustwallet' };
    }
    if (Array.isArray(win.ethereum?.providers)) {
      const found = win.ethereum.providers.find((p) => isTrustProvider(p));
      if (found) return { provider: found, walletType: 'trustwallet' };
    }
    if (win.ethereum && isTrustProvider(win.ethereum)) {
      return { provider: win.ethereum, walletType: 'trustwallet' };
    }
    if (target === 'trustwallet') return null;
  }

  if (!win.ethereum) return null;

  if (Array.isArray(win.ethereum.providers) && win.ethereum.providers.length > 0) {
    const mm = win.ethereum.providers.find((p) => isStrictMetaMaskProvider(p));
    if (mm) return { provider: mm, walletType: 'metamask' };
    if (target === 'any') {
      const first = win.ethereum.providers[0];
      return {
        provider: first,
        walletType: isTrustProvider(first) ? 'trustwallet' : 'metamask',
      };
    }
    return null;
  }

  if (target === 'metamask' && !isStrictMetaMaskProvider(win.ethereum)) {
    return null;
  }

  return {
    provider: win.ethereum,
    walletType: isTrustProvider(win.ethereum) ? 'trustwallet' : 'metamask',
  };
}

export async function discoverMetaMaskProvider(timeoutMs = 300): Promise<Eip1193Provider | null> {
  const res = await discoverWalletProvider('metamask', timeoutMs);
  return res?.provider ?? null;
}

export async function createMetaMaskSdkSession(onDisplayUri: (uri: string) => void): Promise<{
  provider: Eip1193Provider;
  accounts: string[];
  terminate: () => Promise<void>;
}> {
  if (typeof window === 'undefined') {
    throw new Error('MetaMask SDK must run in a browser session.');
  }

  const mod = await import('@metamask/sdk');
  const MetaMaskSDK = mod.MetaMaskSDK || mod.default;

  const sdk = new MetaMaskSDK({
    dappMetadata: {
      name: 'ANAGU Land Registry',
      url: window.location.origin,
    },
    headless: true,
    enableAnalytics: false,
    checkInstallationImmediately: false,
    preferDesktop: false,
    useDeeplink: true,
    openDeeplink: (link: string) => {
      if (link) onDisplayUri(link);
    },
    modals: {
      install: ({ link }) => {
        if (link) onDisplayUri(link);
        return {};
      },
      otp: () => ({}),
    },
  });

  sdk.on('display_uri', (uri: string) => {
    if (uri) onDisplayUri(uri);
  });

  await sdk.init();
  const sdkProvider = sdk.getProvider() as unknown as Eip1193Provider | undefined;
  const fallbackUri = sdk.getUniversalLink();
  if (fallbackUri) {
    onDisplayUri(fallbackUri);
  }

  const rawAccounts = await sdk.connect();
  const activeProvider = sdk.getProvider() as unknown as Eip1193Provider | undefined;
  const resolvedProvider = activeProvider || sdkProvider;
  if (!resolvedProvider) {
    throw new Error('Unable to initialize MetaMask SDK provider.');
  }

  const accounts = (rawAccounts || []).map((a) => ethers.getAddress(a));
  return {
    provider: resolvedProvider,
    accounts,
    terminate: () => sdk.terminate(),
  };
}

export async function connectMetaMaskAccounts(provider: Eip1193Provider): Promise<string[]> {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  return (accounts || []).map((a) => ethers.getAddress(a));
}

export async function getMetaMaskAccounts(provider: Eip1193Provider): Promise<string[]> {
  const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
  return (accounts || []).map((a) => ethers.getAddress(a));
}

export async function getMetaMaskChainId(provider: Eip1193Provider): Promise<number | null> {
  const hex = (await provider.request({ method: 'eth_chainId' })) as string;
  if (!hex) return null;
  return Number.parseInt(hex, 16);
}

export async function getWalletBalanceEth(
  provider: Eip1193Provider,
  address: string,
): Promise<string> {
  try {
    const weiHex = (await provider.request({
      method: 'eth_getBalance',
      params: [address, 'latest'],
    })) as string;
    const formatted = Number.parseFloat(ethers.formatEther(weiHex || '0x0'));
    return formatted.toFixed(4);
  } catch {
    return '0.0000';
  }
}

export async function switchEvmChain(
  provider: Eip1193Provider,
  targetChainId: number,
): Promise<number> {
  const hexChain = `0x${targetChainId.toString(16)}`;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChain }],
    });
    return targetChainId;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 4902 && targetChainId === BESU_CHAIN_ID) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BESU_CHAIN_HEX,
            chainName: 'ANAGU Besu QBFT',
            rpcUrls: [BESU_RPC_URL],
            nativeCurrency: {
              name: 'ANAGU Ether',
              symbol: 'ETH',
              decimals: 18,
            },
          },
        ],
      });
      return BESU_CHAIN_ID;
    }
    throw err;
  }
}

export async function switchOrAddBesuChain(provider: Eip1193Provider): Promise<number> {
  return switchEvmChain(provider, BESU_CHAIN_ID);
}

export async function signPersonalMessage(
  provider: Eip1193Provider,
  address: string,
  message: string,
): Promise<string> {
  const hexMessage = ethers.hexlify(ethers.toUtf8Bytes(message));
  const sig = (await provider.request({
    method: 'personal_sign',
    params: [hexMessage, address],
  })) as string;
  return sig;
}

export async function authorizeLandRegistryAction(
  provider: Eip1193Provider,
  address: string,
  chainId: number | null,
  params:
    | {
        kind: 'REGISTER_LAND';
        parcelReference: string;
        ownerAddress: string;
        spatialHash: string;
        ownerReferenceHash: string;
        documentHash: string;
        actorRole: string;
      }
    | {
        kind: 'TRANSFER_OWNERSHIP';
        tokenId: number;
        parcelReference: string;
        newOwnerAddress: string;
        actorRole: string;
      }
    | {
        kind: 'REVOKE_TITLE';
        tokenId: number;
        parcelReference: string;
        grounds: string;
        administrativeReference: string;
        actorRole: string;
      }
    | {
        kind: 'PURCHASE_LAND';
        listingId: string;
        parcelReference: string;
        sellerAddress: string;
        priceEth: string;
        priceNgn: number;
        actorRole: string;
        walletProvider?: WalletProviderType;
      },
): Promise<WalletProofPayload> {
  const checksumSigner = ethers.getAddress(address);
  let onChainTxHash: string | undefined;

  if (params.kind === 'PURCHASE_LAND') {
    if (chainId === BESU_CHAIN_ID && ethers.isAddress(params.sellerAddress)) {
      const weiHex = ethers.toBeHex(ethers.parseEther(params.priceEth || '0.01'));
      onChainTxHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: checksumSigner,
            to: ethers.getAddress(params.sellerAddress),
            value: weiHex,
          },
        ],
      })) as string;
    }
  } else if (
    LAND_REGISTRY_ADDRESS &&
    ethers.isAddress(LAND_REGISTRY_ADDRESS) &&
    chainId === BESU_CHAIN_ID
  ) {
    const iface = new ethers.Interface(LAND_REGISTRY_ABI);
    let data = '0x';
    if (params.kind === 'REGISTER_LAND') {
      data = iface.encodeFunctionData('registerLand', [
        params.ownerAddress,
        params.parcelReference,
        params.spatialHash,
        params.ownerReferenceHash,
        params.documentHash,
        `anagu://title/${params.parcelReference}`,
      ]);
    } else if (params.kind === 'TRANSFER_OWNERSHIP') {
      data = iface.encodeFunctionData('transferOwnership', [
        params.parcelReference,
        params.newOwnerAddress,
      ]);
    } else {
      data = iface.encodeFunctionData('revokeTitle', [
        params.parcelReference,
        `${params.grounds} (${params.administrativeReference})`,
      ]);
    }

    onChainTxHash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: checksumSigner,
          to: LAND_REGISTRY_ADDRESS,
          data,
        },
      ],
    })) as string;
  }

  const timestamp = new Date().toISOString();
  const walletTag =
    'walletProvider' in params && params.walletProvider
      ? getWalletLabel(params.walletProvider)
      : 'Web3 Wallet';
  const message = [
    'ANAGU Land Registry Cryptographic Authorization',
    `Wallet: ${walletTag}`,
    `Action: ${params.kind}`,
    `Actor Role: ${params.actorRole}`,
    `Signer Wallet: ${checksumSigner}`,
    `Parcel Reference: ${params.parcelReference}`,
    ...('tokenId' in params ? [`Token ID: ${params.tokenId}`] : []),
    ...('listingId' in params
      ? [
          `Listing ID: ${params.listingId}`,
          `Consideration: NGN ${params.priceNgn.toLocaleString()} (${params.priceEth} ETH)`,
          `Seller Settlement Wallet: ${params.sellerAddress}`,
        ]
      : []),
    ...('grounds' in params
      ? [`Section 28 Ground: ${params.grounds}`, `Gazette Ref: ${params.administrativeReference}`]
      : []),
    ...('newOwnerAddress' in params ? [`Recipient Wallet: ${params.newOwnerAddress}`] : []),
    ...(onChainTxHash ? [`Besu Tx Hash: ${onChainTxHash}`] : []),
    `Timestamp: ${timestamp}`,
  ].join('\n');

  const signature = await signPersonalMessage(provider, checksumSigner, message);

  return {
    message,
    signature,
    signerAddress: checksumSigner,
    chainId,
    onChainTxHash,
  };
}
