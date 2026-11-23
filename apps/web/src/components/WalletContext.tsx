'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import QRCode from 'qrcode';
import {
  authorizeLandRegistryAction,
  clearBrowserSignerWallet,
  connectMetaMaskAccounts,
  createBrowserSignerProvider,
  createMetaMaskSdkSession,
  discoverAllWalletProviders,
  discoverWalletProvider,
  fetchAnaguWalletBalance,
  formatMetaMaskError,
  getChainDisplayName,
  getCoinbaseWalletDeepLink,
  getMetaMaskAccounts,
  getMetaMaskChainId,
  getMetaMaskDeepLink,
  getNativeCurrencySymbol,
  getTrustWalletDeepLink,
  getWalletBalanceEth,
  getWalletLabel,
  hasSavedBrowserSignerWallet,
  isRunningInIframe,
  POLYGON_AMOY_CHAIN_ID,
  POLYGON_CHAIN_ID,
  POLYGON_MAINNET_CHAIN_ID,
  signPersonalMessage,
  switchEvmChain,
  walletFromEip6963Event,
  type DiscoveredWallet,
  type Eip1193Provider,
  type WalletProofPayload,
  type WalletProviderType,
} from '../lib/metamask';
import MetaMaskConnectModal from './MetaMaskConnectModal';

interface WalletContextValue {
  provider: Eip1193Provider | null;
  walletType: WalletProviderType | null;
  walletName: string;
  walletLabel: string;
  discoveredWallets: DiscoveredWallet[];
  selectedTab: WalletProviderType;
  setSelectedTab: (tab: WalletProviderType) => void;
  isMetaMaskAvailable: boolean;
  isTrustWalletAvailable: boolean;
  isConnected: boolean;
  connectionMethod: 'extension' | 'sdk' | null;
  inIframe: boolean;
  address: string | null;
  chainId: number | null;
  chainName: string;
  isPolygonNetwork: boolean;
  balanceEth: string | null;
  balanceAlt: string | null;
  polygonPolBalance: string | null;
  nativeSymbol: 'POL' | 'ETH';
  isRefreshingBalance: boolean;
  refreshBalance: () => Promise<void>;
  isConnecting: boolean;
  sdkConnecting: boolean;
  sdkUri: string | null;
  sdkQrDataUrl: string | null;
  trustQrDataUrl: string | null;
  trustDeepLink: string;
  coinbaseDeepLink: string;
  metamaskDeepLink: string;
  universalQrDataUrl: string | null;
  isModalOpen: boolean;
  error: string | null;
  clearError: () => void;
  openModal: (tab?: WalletProviderType) => void;
  closeModal: () => void;
  refreshWallets: () => Promise<DiscoveredWallet[]>;
  connect: (preferredType?: WalletProviderType) => Promise<string | null>;
  connectWalletById: (walletId: string) => Promise<{ address: string | null; error?: string }>;
  connectWithExtension: (
    targetType?: WalletProviderType,
  ) => Promise<{ address: string | null; error?: string }>;
  connectWithBrowserSigner: (
    privateKey?: string,
  ) => Promise<{ address: string | null; error?: string }>;
  connectWithSdk: () => Promise<{ address: string | null; error?: string }>;
  cancelSdkConnect: () => void;
  disconnect: () => void;
  switchToPolygon: () => Promise<boolean>;
  switchChain: (targetChainId: number) => Promise<boolean>;
  signMessage: (message: string, targetAddress?: string) => Promise<string>;
  authorizeRegistryAction: (
    params: Parameters<typeof authorizeLandRegistryAction>[3],
  ) => Promise<WalletProofPayload>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [walletType, setWalletType] = useState<WalletProviderType | null>(null);
  const [walletName, setWalletName] = useState<string>('Web3 Wallet');
  const [discoveredWallets, setDiscoveredWallets] = useState<DiscoveredWallet[]>([]);
  const [selectedTab, setSelectedTab] = useState<WalletProviderType>('all');
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState(false);
  const [isTrustWalletAvailable, setIsTrustWalletAvailable] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<'extension' | 'sdk' | null>(null);
  const [inIframe, setInIframe] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balanceEth, setBalanceEth] = useState<string | null>(null);
  const [balanceAlt, setBalanceAlt] = useState<string | null>(null);
  const [polygonPolBalance, setPolygonPolBalance] = useState<string | null>(null);
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sdkConnecting, setSdkConnecting] = useState(false);
  const [sdkUri, setSdkUri] = useState<string | null>(null);
  const [sdkQrDataUrl, setSdkQrDataUrl] = useState<string | null>(null);
  const [trustQrDataUrl, setTrustQrDataUrl] = useState<string | null>(null);
  const [universalQrDataUrl, setUniversalQrDataUrl] = useState<string | null>(null);
  const [trustDeepLink, setTrustDeepLink] = useState<string>('');
  const [coinbaseDeepLink, setCoinbaseDeepLink] = useState<string>('');
  const [metamaskDeepLink, setMetamaskDeepLink] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressRef = useRef<string | null>(null);
  const providerRef = useRef<Eip1193Provider | null>(null);
  const chainIdRef = useRef<number | null>(null);
  const walletTypeRef = useRef<WalletProviderType | null>(null);
  const walletNameRef = useRef<string>('Web3 Wallet');
  const sdkTerminateRef = useRef<(() => Promise<void>) | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    chainIdRef.current = chainId;
  }, [chainId]);

  useEffect(() => {
    walletTypeRef.current = walletType;
  }, [walletType]);

  useEffect(() => {
    walletNameRef.current = walletName;
  }, [walletName]);

  const syncAccountState = useCallback(
    async (activeProvider: Eip1193Provider, acct: string | null) => {
      if (!acct) {
        addressRef.current = null;
        setAddress(null);
        setBalanceEth(null);
        setBalanceAlt(null);
        setPolygonPolBalance(null);
        return;
      }
      addressRef.current = acct;
      providerRef.current = activeProvider;
      setAddress(acct);
      const [cid, bal, anaguBal] = await Promise.all([
        getMetaMaskChainId(activeProvider).catch(() => null),
        getWalletBalanceEth(activeProvider, acct),
        fetchAnaguWalletBalance(acct),
      ]);
      chainIdRef.current = cid;
      setChainId(cid);
      setBalanceAlt(anaguBal.anaguAlt);
      setPolygonPolBalance(anaguBal.nativePol);
      if (
        (cid === 80002 || cid === 137 || cid === null) &&
        (!bal || bal === '0.0000') &&
        anaguBal.nativePol &&
        anaguBal.nativePol !== '0.0000'
      ) {
        setBalanceEth(anaguBal.nativePol);
      } else {
        setBalanceEth(bal);
      }
    },
    [],
  );

  const refreshBalance = useCallback(async () => {
    const activeProvider = providerRef.current;
    const activeAddress = addressRef.current;
    if (!activeAddress) return;
    setIsRefreshingBalance(true);
    try {
      const [cid, bal, anaguBal] = await Promise.all([
        activeProvider
          ? getMetaMaskChainId(activeProvider).catch(() => chainIdRef.current)
          : Promise.resolve(chainIdRef.current),
        activeProvider ? getWalletBalanceEth(activeProvider, activeAddress) : Promise.resolve('0.0000'),
        fetchAnaguWalletBalance(activeAddress),
      ]);
      chainIdRef.current = cid;
      setChainId(cid);
      setBalanceAlt(anaguBal.anaguAlt);
      setPolygonPolBalance(anaguBal.nativePol);
      if (
        (cid === 80002 || cid === 137 || cid === null) &&
        (!bal || bal === '0.0000') &&
        anaguBal.nativePol &&
        anaguBal.nativePol !== '0.0000'
      ) {
        setBalanceEth(anaguBal.nativePol);
      } else {
        setBalanceEth(bal);
      }
    } finally {
      setIsRefreshingBalance(false);
    }
  }, []);

  const attachProviderListeners = useCallback(
    (targetProvider: Eip1193Provider) => {
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = null;
      }

      const handleAccountsChanged = (accountsArg: unknown) => {
        const list = Array.isArray(accountsArg) ? (accountsArg as string[]) : [];
        void syncAccountState(targetProvider, list[0] || null);
      };

      const handleChainChanged = (chainHexArg: unknown) => {
        const hex = typeof chainHexArg === 'string' ? chainHexArg : '';
        const parsed = hex ? Number.parseInt(hex, 16) : null;
        const nextCid = Number.isFinite(parsed) ? parsed : null;
        chainIdRef.current = nextCid;
        setChainId(nextCid);
        const currentAddr = addressRef.current;
        if (currentAddr) {
          void Promise.all([
            getWalletBalanceEth(targetProvider, currentAddr),
            fetchAnaguWalletBalance(currentAddr),
          ]).then(([bal, anaguBal]) => {
            setBalanceAlt(anaguBal.anaguAlt);
            setPolygonPolBalance(anaguBal.nativePol);
            if (
              (nextCid === 80002 || nextCid === 137 || nextCid === null) &&
              (!bal || bal === '0.0000') &&
              anaguBal.nativePol &&
              anaguBal.nativePol !== '0.0000'
            ) {
              setBalanceEth(anaguBal.nativePol);
            } else {
              setBalanceEth(bal);
            }
          });
        }
      };

      const handleProviderError = () => {
        // Guard against uncaught EventEmitter 'error' events from injected wallet extensions
      };

      const handleDisconnect = () => {
        // Ignore transient extension stream disconnects
      };

      targetProvider.on?.('accountsChanged', handleAccountsChanged);
      targetProvider.on?.('chainChanged', handleChainChanged);
      targetProvider.on?.('error', handleProviderError);
      targetProvider.on?.('disconnect', handleDisconnect);
      listenerCleanupRef.current = () => {
        targetProvider.removeListener?.('accountsChanged', handleAccountsChanged);
        targetProvider.removeListener?.('chainChanged', handleChainChanged);
        targetProvider.removeListener?.('error', handleProviderError);
        targetProvider.removeListener?.('disconnect', handleDisconnect);
      };
    },
    [syncAccountState],
  );

  const refreshWallets = useCallback(async (): Promise<DiscoveredWallet[]> => {
    try {
      const all = await discoverAllWalletProviders(350);
      setDiscoveredWallets(all);
      setIsMetaMaskAvailable(all.some((w) => w.walletType === 'metamask'));
      setIsTrustWalletAvailable(all.some((w) => w.walletType === 'trustwallet'));
      return all;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    setInIframe(isRunningInIframe());
    if (typeof window !== 'undefined') {
      const currentHref = window.location.href;
      const tLink = getTrustWalletDeepLink(currentHref);
      setTrustDeepLink(tLink);
      setCoinbaseDeepLink(getCoinbaseWalletDeepLink(currentHref));
      setMetamaskDeepLink(getMetaMaskDeepLink(currentHref));
      QRCode.toDataURL(tLink, {
        width: 220,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(setTrustQrDataUrl)
        .catch(() => {});
      QRCode.toDataURL(currentHref, {
        width: 220,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(setUniversalQrDataUrl)
        .catch(() => {});
    }

    let mounted = true;
    let lastFocusRefresh = 0;

    const handleProviderAnnounced = (event: Event) => {
      if (!mounted) return;
      const incoming = walletFromEip6963Event(event);
      if (!incoming) return;
      setDiscoveredWallets((prev) => {
        if (prev.some((w) => w.id === incoming.id || w.provider === incoming.provider)) {
          return prev;
        }
        const next = [...prev, incoming];
        setIsMetaMaskAvailable(next.some((w) => w.walletType === 'metamask'));
        setIsTrustWalletAvailable(next.some((w) => w.walletType === 'trustwallet'));
        return next;
      });
    };

    const handleWindowFocus = () => {
      if (!mounted) return;
      const now = Date.now();
      if (now - lastFocusRefresh < 5000) return;
      lastFocusRefresh = now;
      void refreshWallets();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('eip6963:announceProvider', handleProviderAnnounced);
      window.addEventListener('focus', handleWindowFocus);
    }

    const inEmbeddedFrame = isRunningInIframe();

    discoverAllWalletProviders(400)
      .then(async (all) => {
        if (!mounted) return;
        setDiscoveredWallets(all);
        setIsMetaMaskAvailable(all.some((w) => w.walletType === 'metamask'));
        setIsTrustWalletAvailable(all.some((w) => w.walletType === 'trustwallet'));

        if (hasSavedBrowserSignerWallet()) {
          const sessionWallet = createBrowserSignerProvider();
          providerRef.current = sessionWallet.provider;
          walletTypeRef.current = 'browser_signer';
          walletNameRef.current = 'Browser Web3 Wallet';
          setProvider(sessionWallet.provider);
          setWalletType('browser_signer');
          setWalletName('Browser Web3 Wallet');
          setConnectionMethod('extension');
          await syncAccountState(sessionWallet.provider, sessionWallet.address);
          return;
        }

        // Inside embedded frames, Chrome extensions (notably MetaMask inpage.js) often fail
        // port messaging on background RPC calls. Avoid passive eth_accounts/eth_chainId probes
        // on mount inside iframes so page load never triggers extension connection errors.
        if (!inEmbeddedFrame) {
          for (const w of all) {
            try {
              const accounts = await getMetaMaskAccounts(w.provider);
              if (mounted && accounts.length > 0) {
                providerRef.current = w.provider;
                walletTypeRef.current = w.walletType;
                walletNameRef.current = w.name;
                setProvider(w.provider);
                setWalletType(w.walletType);
                setWalletName(w.name);
                setConnectionMethod('extension');
                attachProviderListeners(w.provider);
                await syncAccountState(w.provider, accounts[0]);
                return;
              }
            } catch {
              // Passive check ignored when wallet locked or disconnected
            }
          }
        }

        if (mounted && all[0]) {
          providerRef.current = all[0].provider;
          walletTypeRef.current = all[0].walletType;
          walletNameRef.current = all[0].name;
          setProvider(all[0].provider);
          setWalletType(all[0].walletType);
          setWalletName(all[0].name);
          attachProviderListeners(all[0].provider);
          if (!inEmbeddedFrame) {
            const cid = await getMetaMaskChainId(all[0].provider).catch(() => null);
            if (mounted) {
              chainIdRef.current = cid;
              setChainId(cid);
            }
          }
        }
      })
      .catch(() => {
        // Ignore passive discovery errors
      });

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('eip6963:announceProvider', handleProviderAnnounced);
        window.removeEventListener('focus', handleWindowFocus);
      }
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = null;
      }
    };
  }, [attachProviderListeners, refreshWallets, syncAccountState]);

  const clearError = useCallback(() => setError(null), []);

  const openModal = useCallback(
    (tab?: WalletProviderType) => {
      setError(null);
      if (tab) setSelectedTab(tab);
      if (typeof window !== 'undefined') {
        const currentHref = window.location.href;
        setTrustDeepLink(getTrustWalletDeepLink(currentHref));
        setCoinbaseDeepLink(getCoinbaseWalletDeepLink(currentHref));
        setMetamaskDeepLink(getMetaMaskDeepLink(currentHref));
      }
      void refreshWallets();
      setIsModalOpen(true);
    },
    [refreshWallets],
  );

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const connectWalletById = useCallback(
    async (walletId: string): Promise<{ address: string | null; error?: string }> => {
      setError(null);
      setIsConnecting(true);
      try {
        const all = await refreshWallets();
        const match =
          all.find(
            (w) =>
              w.id === walletId ||
              w.walletType === walletId ||
              w.rdns === walletId ||
              w.name.toLowerCase() === walletId.toLowerCase(),
          ) || all[0];

        if (!match) {
          const msg = isRunningInIframe()
            ? 'Browser Web3 extensions are blocked inside embedded frames. Open ANAGU in a standalone tab or connect via Mobile QR.'
            : 'No browser Web3 wallet detected. Install MetaMask, Trust Wallet, Coinbase Wallet, Rabby, or connect via Mobile QR.';
          setError(msg);
          return { address: null, error: msg };
        }

        providerRef.current = match.provider;
        walletTypeRef.current = match.walletType;
        walletNameRef.current = match.name;
        setProvider(match.provider);
        setWalletType(match.walletType);
        setWalletName(match.name);

        const accounts = await connectMetaMaskAccounts(match.provider);
        const primary = accounts[0] || null;
        if (!primary) {
          const msg = `No account selected in ${match.name}.`;
          setError(msg);
          return { address: null, error: msg };
        }
        setConnectionMethod('extension');
        attachProviderListeners(match.provider);
        await syncAccountState(match.provider, primary);
        return { address: primary };
      } catch (err) {
        const formatted = formatMetaMaskError(err, 'Web3 Wallet');
        setError(formatted);
        return { address: null, error: formatted };
      } finally {
        setIsConnecting(false);
      }
    },
    [attachProviderListeners, refreshWallets, syncAccountState],
  );

  const connectWithExtension = useCallback(
    async (
      targetType: WalletProviderType = 'any',
    ): Promise<{ address: string | null; error?: string }> => {
      setError(null);
      setIsConnecting(true);
      const label = getWalletLabel(targetType);
      try {
        const found = await discoverWalletProvider(targetType, 350);
        if (!found) {
          const msg = isRunningInIframe()
            ? `${label} extension is blocked inside embedded frames. Open ANAGU in a standalone tab, use Mobile QR, or connect Instant Browser Web3 Wallet.`
            : `${label} browser extension not detected. Select another installed Web3 wallet, connect Instant Browser Web3 Wallet, or scan Mobile QR.`;
          setError(msg);
          return { address: null, error: msg };
        }
        providerRef.current = found.provider;
        walletTypeRef.current = found.walletType;
        walletNameRef.current = found.walletName;
        setProvider(found.provider);
        setWalletType(found.walletType);
        setWalletName(found.walletName);
        if (found.walletType === 'trustwallet') setIsTrustWalletAvailable(true);
        if (found.walletType === 'metamask') setIsMetaMaskAvailable(true);

        const accounts = await connectMetaMaskAccounts(found.provider);
        const primary = accounts[0] || null;
        if (!primary) {
          const msg = `No ${found.walletName} account selected.`;
          setError(msg);
          return { address: null, error: msg };
        }
        setConnectionMethod('extension');
        attachProviderListeners(found.provider);
        await syncAccountState(found.provider, primary);
        return { address: primary };
      } catch (err) {
        const formatted = formatMetaMaskError(err, label);
        setError(formatted);
        return { address: null, error: formatted };
      } finally {
        setIsConnecting(false);
      }
    },
    [attachProviderListeners, syncAccountState],
  );

  const connectWithBrowserSigner = useCallback(
    async (
      importedPrivateKey?: string,
    ): Promise<{
      address: string | null;
      error?: string;
    }> => {
      setError(null);
      setIsConnecting(true);
      try {
        const sessionWallet = createBrowserSignerProvider(importedPrivateKey);
        if (listenerCleanupRef.current) {
          listenerCleanupRef.current();
          listenerCleanupRef.current = null;
        }
        const label = importedPrivateKey?.trim() ? 'Imported Web3 Wallet' : 'Browser Web3 Wallet';
        providerRef.current = sessionWallet.provider;
        walletTypeRef.current = 'browser_signer';
        walletNameRef.current = label;
        setProvider(sessionWallet.provider);
        setWalletType('browser_signer');
        setWalletName(label);
        setConnectionMethod('extension');
        await syncAccountState(sessionWallet.provider, sessionWallet.address);
        return { address: sessionWallet.address };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Invalid EVM private key or unable to initialize browser Web3 signer';
        setError(msg);
        return { address: null, error: msg };
      } finally {
        setIsConnecting(false);
      }
    },
    [syncAccountState],
  );

  const cancelSdkConnect = useCallback(() => {
    if (sdkTerminateRef.current) {
      sdkTerminateRef.current().catch(() => {});
      sdkTerminateRef.current = null;
    }
    setSdkConnecting(false);
    setSdkUri(null);
    setSdkQrDataUrl(null);
  }, []);

  const connectWithSdk = useCallback(async (): Promise<{
    address: string | null;
    error?: string;
  }> => {
    setError(null);
    setSdkConnecting(true);
    setSdkUri(null);
    setSdkQrDataUrl(null);
    try {
      if (sdkTerminateRef.current) {
        await sdkTerminateRef.current().catch(() => {});
        sdkTerminateRef.current = null;
      }

      const handleUri = async (uri: string) => {
        setSdkUri(uri);
        try {
          const dataUrl = await QRCode.toDataURL(uri, {
            width: 220,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          setSdkQrDataUrl(dataUrl);
        } catch {
          // Non-fatal QR generation issue
        }
      };

      const sdkPromise = createMetaMaskSdkSession((uri) => {
        void handleUri(uri);
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              'MetaMask Mobile relay timed out. Open ANAGU in a standalone tab, scan the Mobile / QR tab link, or use Instant Browser Web3 Wallet.',
            ),
          );
        }, 25000);
      });

      const session = await Promise.race([sdkPromise, timeoutPromise]);
      sdkTerminateRef.current = session.terminate;
      providerRef.current = session.provider;
      walletTypeRef.current = 'metamask';
      walletNameRef.current = 'MetaMask Mobile';
      setProvider(session.provider);
      setWalletType('metamask');
      setWalletName('MetaMask Mobile');
      setIsMetaMaskAvailable(true);
      setConnectionMethod('sdk');
      attachProviderListeners(session.provider);

      const primary = session.accounts[0] || null;
      if (!primary) {
        const msg = 'No MetaMask account returned from SDK pairing.';
        setError(msg);
        return { address: null, error: msg };
      }

      await syncAccountState(session.provider, primary);
      setIsModalOpen(false);
      return { address: primary };
    } catch (err) {
      const formatted = formatMetaMaskError(err, 'MetaMask');
      setError(formatted);
      return { address: null, error: formatted };
    } finally {
      setSdkConnecting(false);
    }
  }, [attachProviderListeners, syncAccountState]);

  const connect = useCallback(
    async (preferredType?: WalletProviderType): Promise<string | null> => {
      const target = preferredType || 'any';
      if (preferredType) setSelectedTab(preferredType);

      if (isRunningInIframe()) {
        setError(null);
        openModal(preferredType || 'all');
        return null;
      }

      const extFound = await discoverWalletProvider(target, 250);
      if (extFound) {
        const res = await connectWithExtension(target);
        if (res.address) return res.address;
        openModal(preferredType || 'all');
        return null;
      }

      setError(null);
      openModal(preferredType || 'all');
      return null;
    },
    [connectWithExtension, openModal],
  );

  const disconnect = useCallback(() => {
    if (sdkTerminateRef.current) {
      sdkTerminateRef.current().catch(() => {});
      sdkTerminateRef.current = null;
    }
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current();
      listenerCleanupRef.current = null;
    }
    clearBrowserSignerWallet();
    providerRef.current = null;
    addressRef.current = null;
    chainIdRef.current = null;
    walletTypeRef.current = null;
    walletNameRef.current = 'Web3 Wallet';
    setProvider(null);
    setAddress(null);
    setChainId(null);
    setBalanceEth(null);
    setBalanceAlt(null);
    setPolygonPolBalance(null);
    setWalletType(null);
    setWalletName('Web3 Wallet');
    setConnectionMethod(null);
    setSdkConnecting(false);
    setSdkUri(null);
    setSdkQrDataUrl(null);
    setError(null);
  }, []);

  const switchChain = useCallback(async (targetChainId: number): Promise<boolean> => {
    setError(null);
    try {
      const activeProvider =
        providerRef.current || (await discoverWalletProvider('any', 300))?.provider;
      if (!activeProvider) {
        throw new Error('Connect a Web3 wallet first before switching networks.');
      }
      const nextChain = await switchEvmChain(activeProvider, targetChainId);
      chainIdRef.current = nextChain;
      setChainId(nextChain);
      if (addressRef.current) {
        const [bal, anaguBal] = await Promise.all([
          getWalletBalanceEth(activeProvider, addressRef.current),
          fetchAnaguWalletBalance(addressRef.current),
        ]);
        setBalanceAlt(anaguBal.anaguAlt);
        setPolygonPolBalance(anaguBal.nativePol);
        setBalanceEth(
          (nextChain === 80002 || nextChain === 137) && (!bal || bal === '0.0000')
            ? anaguBal.nativePol
            : bal,
        );
      }
      return true;
    } catch (err) {
      setError(formatMetaMaskError(err));
      return false;
    }
  }, []);

  const switchToPolygon = useCallback(async (): Promise<boolean> => {
    return switchChain(POLYGON_CHAIN_ID);
  }, [switchChain]);

  const signMessage = useCallback(
    async (message: string, targetAddress?: string): Promise<string> => {
      setError(null);
      const activeProvider =
        providerRef.current || (await discoverWalletProvider('any', 300))?.provider;
      if (!activeProvider) {
        openModal('all');
        throw new Error('Web3 wallet connection required. Choose any Web3 wallet to sign.');
      }
      const signer = targetAddress || addressRef.current || (await connect('any'));
      if (!signer) {
        throw new Error('Wallet account connection is required to sign.');
      }
      try {
        return await signPersonalMessage(activeProvider, signer, message);
      } catch (err) {
        const formatted = formatMetaMaskError(
          err,
          getWalletLabel(walletTypeRef.current, walletNameRef.current),
        );
        setError(formatted);
        throw new Error(formatted);
      }
    },
    [connect, openModal],
  );

  const authorizeRegistryAction = useCallback(
    async (
      params: Parameters<typeof authorizeLandRegistryAction>[3],
    ): Promise<WalletProofPayload> => {
      setError(null);
      let activeProvider = providerRef.current;
      let activeAddr = addressRef.current;
      let activeChainId = chainIdRef.current;
      const currentWalletType = walletTypeRef.current;
      let resolvedWalletName = walletNameRef.current;

      const requestedType =
        'walletProvider' in params && params.walletProvider
          ? params.walletProvider
          : currentWalletType || 'any';

      const inEmbeddedFrame = isRunningInIframe();
      const canUseConnectedAsIs =
        Boolean(activeProvider && activeAddr) &&
        (currentWalletType === 'browser_signer' ||
          connectionMethod === 'sdk' ||
          inEmbeddedFrame);

      const forceSpecific =
        !canUseConnectedAsIs &&
        'walletProvider' in params &&
        Boolean(params.walletProvider) &&
        params.walletProvider !== 'any' &&
        currentWalletType !== params.walletProvider;

      if (!activeProvider || !activeAddr || forceSpecific) {
        if (inEmbeddedFrame) {
          openModal(requestedType === 'any' ? 'all' : requestedType);
          throw new Error(
            'Connect your Web3 wallet (Instant Browser Wallet, Mobile QR, or Standalone Tab) in the dialog to authorize this land transaction.',
          );
        }
        const ext = await discoverWalletProvider(requestedType, 300);
        if (ext) {
          const res = await connectWithExtension(requestedType);
          if (!res.address) {
            openModal(requestedType === 'any' ? 'all' : requestedType);
            throw new Error(
              res.error || 'Connect your Web3 wallet to complete authorization.',
            );
          }
          activeProvider = providerRef.current || ext.provider;
          activeAddr = addressRef.current || res.address;
          activeChainId = chainIdRef.current;
          resolvedWalletName = walletNameRef.current || ext.walletName;
        } else if (!activeProvider || !activeAddr) {
          openModal(requestedType === 'any' ? 'all' : requestedType);
          throw new Error(
            `Connect ${getWalletLabel(requestedType)} or any Web3 wallet in the dialog to authorize this land transaction.`,
          );
        }
      }

      if (!activeProvider || !activeAddr) {
        const addr = await connect(requestedType);
        if (!addr || !providerRef.current) {
          throw new Error('Connect your Web3 wallet to complete authorization.');
        }
        activeProvider = providerRef.current;
        activeAddr = addr;
        activeChainId = chainIdRef.current;
      }

      try {
        return await authorizeLandRegistryAction(activeProvider, activeAddr, activeChainId, {
          ...params,
          walletName: resolvedWalletName,
        });
      } catch (err) {
        const formatted = formatMetaMaskError(err, getWalletLabel(requestedType, resolvedWalletName));
        setError(formatted);
        throw new Error(formatted);
      }
    },
    [connect, connectWithExtension, connectionMethod, openModal],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      provider,
      walletType,
      walletName,
      walletLabel: getWalletLabel(walletType, walletName),
      discoveredWallets,
      selectedTab,
      setSelectedTab,
      isMetaMaskAvailable,
      isTrustWalletAvailable,
      isConnected: Boolean(address),
      connectionMethod,
      inIframe,
      address,
      chainId,
      chainName: getChainDisplayName(chainId),
      isPolygonNetwork:
        chainId === POLYGON_AMOY_CHAIN_ID || chainId === POLYGON_MAINNET_CHAIN_ID,
      balanceEth,
      balanceAlt,
      polygonPolBalance,
      nativeSymbol: getNativeCurrencySymbol(chainId),
      isRefreshingBalance,
      refreshBalance,
      isConnecting,
      sdkConnecting,
      sdkUri,
      sdkQrDataUrl,
      trustQrDataUrl,
      trustDeepLink,
      coinbaseDeepLink,
      metamaskDeepLink,
      universalQrDataUrl,
      isModalOpen,
      error,
      clearError,
      openModal,
      closeModal,
      refreshWallets,
      connect,
      connectWalletById,
      connectWithExtension,
      connectWithBrowserSigner,
      connectWithSdk,
      cancelSdkConnect,
      disconnect,
      switchToPolygon,
      switchChain,
      signMessage,
      authorizeRegistryAction,
    }),
    [
      provider,
      walletType,
      walletName,
      discoveredWallets,
      selectedTab,
      isMetaMaskAvailable,
      isTrustWalletAvailable,
      connectionMethod,
      inIframe,
      address,
      chainId,
      balanceEth,
      balanceAlt,
      polygonPolBalance,
      isRefreshingBalance,
      refreshBalance,
      isConnecting,
      sdkConnecting,
      sdkUri,
      sdkQrDataUrl,
      trustQrDataUrl,
      trustDeepLink,
      coinbaseDeepLink,
      metamaskDeepLink,
      universalQrDataUrl,
      isModalOpen,
      error,
      clearError,
      openModal,
      closeModal,
      refreshWallets,
      connect,
      connectWalletById,
      connectWithExtension,
      connectWithBrowserSigner,
      connectWithSdk,
      cancelSdkConnect,
      disconnect,
      switchToPolygon,
      switchChain,
      signMessage,
      authorizeRegistryAction,
    ],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      <MetaMaskConnectModal />
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used inside WalletProvider');
  }
  return ctx;
}
