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
  BESU_CHAIN_ID,
  clearBrowserSignerWallet,
  connectMetaMaskAccounts,
  createBrowserSignerProvider,
  createMetaMaskSdkSession,
  discoverAllWalletProviders,
  discoverWalletProvider,
  formatMetaMaskError,
  getChainDisplayName,
  getCoinbaseWalletDeepLink,
  getMetaMaskAccounts,
  getMetaMaskChainId,
  getMetaMaskDeepLink,
  getTrustWalletDeepLink,
  getWalletBalanceEth,
  getWalletLabel,
  hasSavedBrowserSignerWallet,
  isRunningInIframe,
  signPersonalMessage,
  switchEvmChain,
  switchOrAddBesuChain,
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
  isBesuNetwork: boolean;
  balanceEth: string | null;
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
  switchToBesu: () => Promise<boolean>;
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
  const sdkTerminateRef = useRef<(() => Promise<void>) | null>(null);
  const listenerCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  const syncAccountState = useCallback(
    async (activeProvider: Eip1193Provider, acct: string | null) => {
      if (!acct) {
        setAddress(null);
        setBalanceEth(null);
        return;
      }
      setAddress(acct);
      const [cid, bal] = await Promise.all([
        getMetaMaskChainId(activeProvider).catch(() => null),
        getWalletBalanceEth(activeProvider, acct),
      ]);
      setChainId(cid);
      setBalanceEth(bal);
    },
    [],
  );

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
        setChainId(Number.isFinite(parsed) ? parsed : null);
        const currentAddr = addressRef.current;
        if (currentAddr) {
          void getWalletBalanceEth(targetProvider, currentAddr).then(setBalanceEth);
        }
      };

      targetProvider.on?.('accountsChanged', handleAccountsChanged);
      targetProvider.on?.('chainChanged', handleChainChanged);
      listenerCleanupRef.current = () => {
        targetProvider.removeListener?.('accountsChanged', handleAccountsChanged);
        targetProvider.removeListener?.('chainChanged', handleChainChanged);
      };
    },
    [syncAccountState],
  );

  const refreshWallets = useCallback(async (): Promise<DiscoveredWallet[]> => {
    const all = await discoverAllWalletProviders(350);
    setDiscoveredWallets(all);
    setIsMetaMaskAvailable(all.some((w) => w.walletType === 'metamask'));
    setIsTrustWalletAvailable(all.some((w) => w.walletType === 'trustwallet'));
    return all;
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

    const handleDelayedAnnounce = () => {
      if (!mounted) return;
      void refreshWallets();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('eip6963:announceProvider', handleDelayedAnnounce);
      window.addEventListener('focus', handleDelayedAnnounce);
    }

    discoverAllWalletProviders(400).then(async (all) => {
      if (!mounted) return;
      setDiscoveredWallets(all);
      setIsMetaMaskAvailable(all.some((w) => w.walletType === 'metamask'));
      setIsTrustWalletAvailable(all.some((w) => w.walletType === 'trustwallet'));

      for (const w of all) {
        try {
          const accounts = await getMetaMaskAccounts(w.provider);
          if (mounted && accounts.length > 0) {
            setProvider(w.provider);
            setWalletType(w.walletType);
            setWalletName(w.name);
            setConnectionMethod('extension');
            attachProviderListeners(w.provider);
            await syncAccountState(w.provider, accounts[0]);
            return;
          }
        } catch {
          // Passive check ignored when wallet locked
        }
      }

      if (mounted && hasSavedBrowserSignerWallet()) {
        const sessionWallet = createBrowserSignerProvider();
        setProvider(sessionWallet.provider);
        setWalletType('browser_signer');
        setWalletName('Browser Web3 Wallet');
        setConnectionMethod('extension');
        await syncAccountState(sessionWallet.provider, sessionWallet.address);
        return;
      }

      if (mounted && all[0]) {
        setProvider(all[0].provider);
        setWalletType(all[0].walletType);
        setWalletName(all[0].name);
        attachProviderListeners(all[0].provider);
        const cid = await getMetaMaskChainId(all[0].provider).catch(() => null);
        if (mounted) setChainId(cid);
      }
    });

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('eip6963:announceProvider', handleDelayedAnnounce);
        window.removeEventListener('focus', handleDelayedAnnounce);
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
        setProvider(sessionWallet.provider);
        setWalletType('browser_signer');
        setWalletName(
          importedPrivateKey?.trim() ? 'Imported Web3 Wallet' : 'Browser Web3 Wallet',
        );
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
    setProvider(null);
    setAddress(null);
    setBalanceEth(null);
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
      setChainId(nextChain);
      if (addressRef.current) {
        const bal = await getWalletBalanceEth(activeProvider, addressRef.current);
        setBalanceEth(bal);
      }
      return true;
    } catch (err) {
      setError(formatMetaMaskError(err));
      return false;
    }
  }, []);

  const switchToBesu = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const activeProvider =
        providerRef.current || (await discoverWalletProvider('any', 300))?.provider;
      if (!activeProvider) {
        throw new Error('Connect a Web3 wallet first.');
      }
      const nextChain = await switchOrAddBesuChain(activeProvider);
      setChainId(nextChain);
      if (addressRef.current) {
        const bal = await getWalletBalanceEth(activeProvider, addressRef.current);
        setBalanceEth(bal);
      }
      return true;
    } catch (err) {
      setError(formatMetaMaskError(err));
      return false;
    }
  }, []);

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
        const formatted = formatMetaMaskError(err, getWalletLabel(walletType, walletName));
        setError(formatted);
        throw new Error(formatted);
      }
    },
    [connect, openModal, walletName, walletType],
  );

  const authorizeRegistryAction = useCallback(
    async (
      params: Parameters<typeof authorizeLandRegistryAction>[3],
    ): Promise<WalletProofPayload> => {
      setError(null);
      const requestedType =
        'walletProvider' in params && params.walletProvider
          ? params.walletProvider
          : walletType || 'any';

      let activeProvider = providerRef.current;
      let activeAddr = addressRef.current;
      let resolvedWalletName = walletName;

      // If a wallet is already connected and caller didn't force a different specific wallet, use the active Web3 wallet!
      const forceSpecific =
        'walletProvider' in params &&
        params.walletProvider &&
        params.walletProvider !== 'any' &&
        walletType !== params.walletProvider;

      if (!activeProvider || !activeAddr || forceSpecific) {
        const ext = await discoverWalletProvider(requestedType, 300);
        if (ext) {
          const res = await connectWithExtension(requestedType);
          activeProvider = ext.provider;
          activeAddr = res.address;
          resolvedWalletName = ext.walletName;
        } else if (!activeProvider) {
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
      }

      try {
        return await authorizeLandRegistryAction(activeProvider, activeAddr, chainId, {
          ...params,
          walletName: resolvedWalletName,
        });
      } catch (err) {
        const formatted = formatMetaMaskError(err, getWalletLabel(requestedType, resolvedWalletName));
        setError(formatted);
        throw new Error(formatted);
      }
    },
    [chainId, connect, connectWithExtension, openModal, walletName, walletType],
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
      isBesuNetwork: chainId === BESU_CHAIN_ID,
      balanceEth,
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
      switchToBesu,
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
      switchToBesu,
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
