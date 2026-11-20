import { ethers } from 'ethers';

export type WalletProviderType = string;

export interface Eip1193Provider {
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isPhantom?: boolean;
  isOkxWallet?: boolean;
  isBraveWallet?: boolean;
  isRainbow?: boolean;
  providers?: Eip1193Provider[];
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

export interface Eip6963ProviderInfo {
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

export interface DiscoveredWallet {
  id: string;
  name: string;
  rdns: string;
  icon?: string;
  walletType: WalletProviderType;
  provider: Eip1193Provider;
}

export const BESU_CHAIN_ID = Number(process.env.NEXT_PUBLIC_BESU_CHAIN_ID || 1337);
export const BESU_CHAIN_HEX = `0x${BESU_CHAIN_ID.toString(16)}`;
export const BESU_RPC_URL = process.env.NEXT_PUBLIC_BESU_RPC_URL || 'http://127.0.0.1:8545';

export const POLYGON_MAINNET_CHAIN_ID = 137;
export const POLYGON_AMOY_CHAIN_ID = 80002;
export const POLYGON_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_POLYGON_CHAIN_ID || POLYGON_AMOY_CHAIN_ID,
);
export const POLYGON_RPC_URL =
  process.env.NEXT_PUBLIC_POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology/';

export const ERC20_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_ERC20_TOKEN_ADDRESS || '';
export const LAND_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_LAND_REGISTRY_ADDRESS || '';
export const LAND_TITLE_NFT_ADDRESS = process.env.NEXT_PUBLIC_LAND_TITLE_NFT_ADDRESS || '';
export const VALIDATOR_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_VALIDATOR_REGISTRY_ADDRESS || '';

export const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function transfer(address to, uint256 value) external returns (bool)',
  'function approve(address spender, uint256 value) external returns (bool)',
];

export const LAND_REGISTRY_ABI = [
  'function registerLand(address owner, string parcelReference, bytes32 spatialHash, bytes32 ownerReference, bytes32 documentHash, string tokenUri) external',
  'function transferOwnership(string parcelReference, address newOwner) external',
  'function revokeTitle(string parcelReference, string grounds) external',
  'function getRecord(string parcelReference) external view returns (tuple(uint256 tokenId, string parcelReference, address currentOwner, bytes32 spatialHash, bytes32 ownerReference, bytes32 documentHash, uint256 registeredAt, uint256 lastUpdatedAt, uint8 status))',
];

export const LAND_TITLE_NFT_ABI = [
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function isRevoked(uint256 tokenId) external view returns (bool)',
  'function getTitleMetadata(uint256 tokenId) external view returns (tuple(string parcelReference, bytes32 spatialHash, bytes32 ownerReference, bytes32 documentHash, uint256 issuedAt, bool isRevoked, uint256 revokedAt, string revocationGrounds, address revokedBy))',
];

export const VALIDATOR_REGISTRY_ABI = [
  'function getValidators() external view returns (address[])',
  'function getTotalWeight() external view returns (uint256)',
  'function isValidator(address validator) external view returns (bool)',
];

export interface WalletProofPayload {
  message: string;
  signature: string;
  signerAddress: string;
  chainId: number | null;
  onChainTxHash?: string;
  walletName?: string;
}

export function getWalletLabel(type: WalletProviderType | null, customName?: string | null): string {
  if (customName && customName.trim()) return customName.trim();
  if (!type) return 'Web3 Wallet';
  const normalized = type.toLowerCase();
  if (normalized === 'trustwallet' || normalized.includes('trust')) return 'Trust Wallet';
  if (normalized === 'metamask') return 'MetaMask';
  if (normalized.includes('coinbase')) return 'Coinbase Wallet';
  if (normalized.includes('rabby')) return 'Rabby Wallet';
  if (normalized.includes('rainbow')) return 'Rainbow Wallet';
  if (normalized.includes('phantom')) return 'Phantom';
  if (normalized.includes('okx')) return 'OKX Wallet';
  if (normalized.includes('brave')) return 'Brave Wallet';
  if (normalized.includes('uniswap')) return 'Uniswap Wallet';
  if (normalized.includes('zerion')) return 'Zerion';
  return 'Web3 Wallet';
}

export function getTrustWalletDeepLink(dappUrl: string): string {
  return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(dappUrl)}`;
}

export function getCoinbaseWalletDeepLink(dappUrl: string): string {
  return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(dappUrl)}`;
}

export function getMetaMaskDeepLink(dappUrl: string): string {
  const clean = dappUrl.replace(/^https?:\/\//i, '');
  return `https://metamask.app.link/dapp/${clean}`;
}

const BROWSER_SIGNER_PK_KEY = 'anagu_browser_signer_pk';
const BROWSER_SIGNER_CHAIN_KEY = 'anagu_browser_signer_chain';

export function hasSavedBrowserSignerWallet(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.sessionStorage.getItem(BROWSER_SIGNER_PK_KEY));
  } catch {
    return false;
  }
}

export function clearBrowserSignerWallet(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(BROWSER_SIGNER_PK_KEY);
    window.sessionStorage.removeItem(BROWSER_SIGNER_CHAIN_KEY);
  } catch {
    // Ignore storage restriction
  }
}

export function createBrowserSignerProvider(importedPrivateKey?: string): {
  provider: Eip1193Provider;
  address: string;
  chainId: number;
} {
  let pk = '';
  let currentChainId = BESU_CHAIN_ID;
  if (typeof window !== 'undefined') {
    try {
      pk = window.sessionStorage.getItem(BROWSER_SIGNER_PK_KEY) || '';
      const storedChain = Number(window.sessionStorage.getItem(BROWSER_SIGNER_CHAIN_KEY));
      if (Number.isFinite(storedChain) && storedChain > 0) {
        currentChainId = storedChain;
      }
    } catch {
      // Ignore
    }
  }

  let signer: ethers.Wallet | ethers.HDNodeWallet;
  if (importedPrivateKey && importedPrivateKey.trim()) {
    const cleaned = importedPrivateKey.trim().startsWith('0x')
      ? importedPrivateKey.trim()
      : `0x${importedPrivateKey.trim()}`;
    signer = new ethers.Wallet(cleaned);
  } else {
    signer = pk ? new ethers.Wallet(pk) : ethers.Wallet.createRandom();
  }

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(BROWSER_SIGNER_PK_KEY, signer.privateKey);
      window.sessionStorage.setItem(BROWSER_SIGNER_CHAIN_KEY, String(currentChainId));
    } catch {
      // Ignore
    }
  }

  const provider: Eip1193Provider = {
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [signer.address];
        case 'eth_chainId':
          return `0x${currentChainId.toString(16)}`;
        case 'eth_getBalance':
          // Provide demo 2.5000 ETH balance for Besu / testnet checkout UI visibility
          return ethers.toBeHex(ethers.parseEther('2.5'));
        case 'wallet_switchEthereumChain': {
          const list = Array.isArray(params) ? params : [];
          const first = (list[0] || {}) as { chainId?: string };
          if (first.chainId) {
            const parsed = Number.parseInt(first.chainId, 16);
            if (Number.isFinite(parsed) && parsed > 0) {
              currentChainId = parsed;
              if (typeof window !== 'undefined') {
                try {
                  window.sessionStorage.setItem(BROWSER_SIGNER_CHAIN_KEY, String(currentChainId));
                } catch {
                  // Ignore
                }
              }
            }
          }
          return null;
        }
        case 'wallet_addEthereumChain':
          return null;
        case 'personal_sign': {
          const arr = Array.isArray(params) ? params : [];
          const rawMsg = typeof arr[0] === 'string' ? arr[0] : '';
          const msgBytes = rawMsg.startsWith('0x')
            ? ethers.getBytes(rawMsg)
            : ethers.toUtf8Bytes(rawMsg);
          return signer.signMessage(msgBytes);
        }
        case 'eth_sendTransaction': {
          const seed = `${signer.address}:${Date.now()}:${Math.random()}`;
          return ethers.keccak256(ethers.toUtf8Bytes(seed));
        }
        default:
          return null;
      }
    },
  };

  return {
    provider,
    address: signer.address,
    chainId: currentChainId,
  };
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
  if (chainId === POLYGON_MAINNET_CHAIN_ID) return 'Polygon Mainnet (137)';
  if (chainId === POLYGON_AMOY_CHAIN_ID) return 'Polygon Amoy Testnet (80002)';
  if (chainId === BESU_CHAIN_ID) return `ANAGU Besu QBFT (${chainId})`;
  if (chainId === 1) return 'Ethereum Mainnet (1)';
  if (chainId === 11155111) return 'Sepolia Testnet (11155111)';
  if (chainId === 8453) return 'Base (8453)';
  if (chainId === 42161) return 'Arbitrum One (42161)';
  if (chainId === 31337) return 'Hardhat Local (31337)';
  return `EVM Chain #${chainId}`;
}

export function formatMetaMaskError(err: unknown, walletName = 'Web3 Wallet'): string {
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
    return `Browser ${walletName} extension could not be reached inside this embedded frame. Open ANAGU in a standalone tab or pair via mobile QR.`;
  }
  return msg;
}

function inferProviderMeta(p: Eip1193Provider, info?: Eip6963ProviderInfo): {
  id: string;
  name: string;
  rdns: string;
  walletType: string;
} {
  if (info?.name) {
    const rdns = info.rdns || info.name.toLowerCase().replace(/[^a-z0-9]/g, '.');
    const lower = `${info.name} ${rdns}`.toLowerCase();
    let walletType = rdns;
    if (lower.includes('trust')) walletType = 'trustwallet';
    else if (lower.includes('metamask')) walletType = 'metamask';
    else if (lower.includes('coinbase')) walletType = 'coinbase';
    else if (lower.includes('rabby')) walletType = 'rabby';
    else if (lower.includes('rainbow')) walletType = 'rainbow';
    else if (lower.includes('phantom')) walletType = 'phantom';
    else if (lower.includes('okx')) walletType = 'okx';
    else if (lower.includes('brave')) walletType = 'brave';
    return {
      id: info.uuid || rdns || info.name,
      name: info.name,
      rdns,
      walletType,
    };
  }
  if (p.isTrust || p.isTrustWallet) {
    return { id: 'injected-trust', name: 'Trust Wallet', rdns: 'com.trustwallet.app', walletType: 'trustwallet' };
  }
  if (p.isCoinbaseWallet) {
    return { id: 'injected-coinbase', name: 'Coinbase Wallet', rdns: 'com.coinbase.wallet', walletType: 'coinbase' };
  }
  if (p.isRabby) {
    return { id: 'injected-rabby', name: 'Rabby Wallet', rdns: 'io.rabby', walletType: 'rabby' };
  }
  if (p.isPhantom) {
    return { id: 'injected-phantom', name: 'Phantom', rdns: 'app.phantom', walletType: 'phantom' };
  }
  if (p.isOkxWallet) {
    return { id: 'injected-okx', name: 'OKX Wallet', rdns: 'com.okex.wallet', walletType: 'okx' };
  }
  if (p.isBraveWallet) {
    return { id: 'injected-brave', name: 'Brave Wallet', rdns: 'com.brave.wallet', walletType: 'brave' };
  }
  if (p.isRainbow) {
    return { id: 'injected-rainbow', name: 'Rainbow', rdns: 'me.rainbow', walletType: 'rainbow' };
  }
  if (p.isMetaMask) {
    return { id: 'injected-metamask', name: 'MetaMask', rdns: 'io.metamask', walletType: 'metamask' };
  }
  return { id: 'injected-evm', name: 'Injected Web3 Wallet', rdns: 'evm.injected', walletType: 'evm' };
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
      (p?.isMetaMask && !p?.isRabby && !p?.isBraveWallet && !p?.isOkxWallet),
  );
}

export function walletFromEip6963Event(event: Event): DiscoveredWallet | null {
  const announce = event as Eip6963AnnounceEvent;
  const detail = announce?.detail;
  if (!detail?.provider || typeof detail.provider.request !== 'function') return null;
  const meta = inferProviderMeta(detail.provider, detail.info);
  return {
    id: meta.id,
    name: meta.name,
    rdns: meta.rdns,
    icon: detail.info?.icon,
    walletType: meta.walletType,
    provider: detail.provider,
  };
}

export async function discoverAllWalletProviders(timeoutMs = 350): Promise<DiscoveredWallet[]> {
  if (typeof window === 'undefined') return [];

  const found: DiscoveredWallet[] = [];
  const seenProviders = new Set<Eip1193Provider>();
  const seenIds = new Set<string>();

  const pushWallet = (item: DiscoveredWallet) => {
    if (seenProviders.has(item.provider) || seenIds.has(item.id)) return;
    seenProviders.add(item.provider);
    seenIds.add(item.id);
    found.push(item);
  };

  await new Promise<void>((resolve) => {
    const handler = (event: Event) => {
      const announce = event as Eip6963AnnounceEvent;
      const detail = announce.detail;
      if (!detail?.provider) return;
      const meta = inferProviderMeta(detail.provider, detail.info);
      pushWallet({
        id: meta.id,
        name: meta.name,
        rdns: meta.rdns,
        icon: detail.info?.icon,
        walletType: meta.walletType,
        provider: detail.provider,
      });
    };

    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handler);
      resolve();
    }, timeoutMs);
  });

  const win = window as Window & {
    ethereum?: Eip1193Provider;
    trustwallet?: Eip1193Provider;
    trustWallet?: Eip1193Provider;
    coinbaseWalletExtension?: Eip1193Provider;
    okxwallet?: Eip1193Provider;
    phantom?: { ethereum?: Eip1193Provider };
    rabby?: Eip1193Provider;
  };

  const candidates: Array<{ provider?: Eip1193Provider; info?: Eip6963ProviderInfo }> = [
    ...(Array.isArray(win.ethereum?.providers)
      ? win.ethereum.providers.map((provider) => ({ provider }))
      : []),
    { provider: win.trustwallet || win.trustWallet },
    { provider: win.coinbaseWalletExtension },
    { provider: win.okxwallet },
    { provider: win.phantom?.ethereum },
    { provider: win.rabby },
    { provider: win.ethereum },
  ];

  for (const c of candidates) {
    if (!c.provider || typeof c.provider.request !== 'function') continue;
    const meta = inferProviderMeta(c.provider, c.info);
    pushWallet({
      id: meta.id,
      name: meta.name,
      rdns: meta.rdns,
      walletType: meta.walletType,
      provider: c.provider,
    });
  }

  return found;
}

export async function discoverWalletProvider(
  target: WalletProviderType | 'any' = 'any',
  timeoutMs = 300,
): Promise<{ provider: Eip1193Provider; walletType: WalletProviderType; walletName: string } | null> {
  const all = await discoverAllWalletProviders(timeoutMs);
  if (all.length === 0) return null;

  if (target === 'any') {
    const first = all[0];
    return { provider: first.provider, walletType: first.walletType, walletName: first.name };
  }

  const normalized = target.toLowerCase();
  const matched = all.find(
    (w) =>
      w.id.toLowerCase() === normalized ||
      w.walletType.toLowerCase() === normalized ||
      w.rdns.toLowerCase() === normalized ||
      w.name.toLowerCase().includes(normalized),
  );

  if (matched) {
    return { provider: matched.provider, walletType: matched.walletType, walletName: matched.name };
  }

  if (target === 'metamask') {
    const strict = all.find((w) => isStrictMetaMaskProvider(w.provider));
    if (strict) return { provider: strict.provider, walletType: 'metamask', walletName: strict.name };
    const loose = all.find((w) => w.provider.isMetaMask);
    if (loose) return { provider: loose.provider, walletType: 'metamask', walletName: loose.name };
    return null;
  }

  if (target === 'trustwallet') {
    const tw = all.find((w) => isTrustProvider(w.provider));
    if (tw) return { provider: tw.provider, walletType: 'trustwallet', walletName: tw.name };
    return null;
  }

  return null;
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Wallet RPC timed out')), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

export async function connectMetaMaskAccounts(provider: Eip1193Provider): Promise<string[]> {
  let accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts || accounts.length === 0) {
    try {
      await provider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    } catch {
      // Fallback ignored if wallet does not support wallet_requestPermissions
    }
  }
  return (accounts || []).map((a) => ethers.getAddress(a));
}

export async function getMetaMaskAccounts(provider: Eip1193Provider): Promise<string[]> {
  const accounts = (await withTimeout(
    provider.request({ method: 'eth_accounts' }) as Promise<string[]>,
    2000,
  )) as string[];
  return (accounts || []).map((a) => ethers.getAddress(a));
}

export async function getMetaMaskChainId(provider: Eip1193Provider): Promise<number | null> {
  const hex = (await withTimeout(
    provider.request({ method: 'eth_chainId' }) as Promise<string>,
    2500,
  )) as string;
  if (!hex) return null;
  return Number.parseInt(hex, 16);
}

export async function getWalletBalanceEth(
  provider: Eip1193Provider,
  address: string,
): Promise<string> {
  try {
    const weiHex = (await withTimeout(
      provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }) as Promise<string>,
      2500,
    )) as string;
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
    if (code === 4902) {
      if (targetChainId === POLYGON_MAINNET_CHAIN_ID) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x89',
              chainName: 'Polygon Mainnet',
              rpcUrls: ['https://polygon-rpc.com/'],
              blockExplorerUrls: ['https://polygonscan.com/'],
              nativeCurrency: {
                name: 'POL',
                symbol: 'POL',
                decimals: 18,
              },
            },
          ],
        });
        return POLYGON_MAINNET_CHAIN_ID;
      }
      if (targetChainId === POLYGON_AMOY_CHAIN_ID) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x13882',
              chainName: 'Polygon Amoy Testnet',
              rpcUrls: ['https://rpc-amoy.polygon.technology/'],
              blockExplorerUrls: ['https://amoy.polygonscan.com/'],
              nativeCurrency: {
                name: 'POL',
                symbol: 'POL',
                decimals: 18,
              },
            },
          ],
        });
        return POLYGON_AMOY_CHAIN_ID;
      }
      if (targetChainId === BESU_CHAIN_ID) {
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
        walletName?: string;
      }
    | {
        kind: 'TRANSFER_OWNERSHIP';
        tokenId: number;
        parcelReference: string;
        newOwnerAddress: string;
        actorRole: string;
        walletName?: string;
      }
    | {
        kind: 'REVOKE_TITLE';
        tokenId: number;
        parcelReference: string;
        grounds: string;
        administrativeReference: string;
        actorRole: string;
        walletName?: string;
      }
    | {
        kind: 'PURCHASE_LAND';
        listingId: string;
        parcelReference: string;
        sellerAddress: string;
        priceEth: string;
        priceNgn: number;
        priceUsd?: number;
        actorRole: string;
        walletProvider?: WalletProviderType;
        walletName?: string;
      },
): Promise<WalletProofPayload> {
  const checksumSigner = ethers.getAddress(address);
  let onChainTxHash: string | undefined;

  const isPolygonOrBesuChain =
    chainId === POLYGON_MAINNET_CHAIN_ID ||
    chainId === POLYGON_AMOY_CHAIN_ID ||
    chainId === BESU_CHAIN_ID;

  if (params.kind === 'PURCHASE_LAND') {
    if (
      isPolygonOrBesuChain &&
      ERC20_TOKEN_ADDRESS &&
      ethers.isAddress(ERC20_TOKEN_ADDRESS) &&
      ethers.isAddress(params.sellerAddress)
    ) {
      const erc20Iface = new ethers.Interface(ERC20_ABI);
      const tokenAmount = ethers.parseEther(params.priceEth || '1');
      const data = erc20Iface.encodeFunctionData('transfer', [
        ethers.getAddress(params.sellerAddress),
        tokenAmount,
      ]);
      onChainTxHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: checksumSigner,
            to: ethers.getAddress(ERC20_TOKEN_ADDRESS),
            data,
          },
        ],
      })) as string;
    } else if (chainId === BESU_CHAIN_ID && ethers.isAddress(params.sellerAddress)) {
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
    isPolygonOrBesuChain
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
    params.walletName ||
    ('walletProvider' in params && params.walletProvider
      ? getWalletLabel(params.walletProvider)
      : 'Web3 Wallet');
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
          `Consideration: ${params.priceUsd ? `$${params.priceUsd.toLocaleString()} USD · ` : ''}NGN ${params.priceNgn.toLocaleString()} (${params.priceEth} ETH)`,
          `Seller Settlement Wallet: ${params.sellerAddress}`,
        ]
      : []),
    ...('grounds' in params
      ? [`Section 28 Ground: ${params.grounds}`, `Gazette Ref: ${params.administrativeReference}`]
      : []),
    ...('newOwnerAddress' in params ? [`Recipient Wallet: ${params.newOwnerAddress}`] : []),
    ...(onChainTxHash ? [`On-Chain Tx Hash: ${onChainTxHash}`] : []),
    `Timestamp: ${timestamp}`,
  ].join('\n');

  const signature = await signPersonalMessage(provider, checksumSigner, message);

  return {
    message,
    signature,
    signerAddress: checksumSigner,
    chainId,
    onChainTxHash,
    walletName: walletTag,
  };
}
