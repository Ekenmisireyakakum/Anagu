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
  connectMetaMaskAccounts,
  createMetaMaskSdkSession,
  discoverWalletProvider,
  formatMetaMaskError,
  getChainDisplayName,
  getMetaMaskAccounts,
  getMetaMaskChainId,
  getTrustWalletDeepLink,
  getWalletBalanceEth,
  getWalletLabel,
  isRunningInIframe,
  signPersonalMessage,
  switchEvmChain,
  switchOrAddBesuChain,
  type Eip1193Provider,
  type WalletProofPayload,
  type WalletProviderType,
} from '../lib/metamask';
import MetaMaskConnectModal from './MetaMaskConnectModal';

interface WalletContextValue {
  provider: Eip1193Provider | null;
  walletType: WalletProviderType | null;
  walletLabel: string;
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
  isModalOpen: boolean;
  error: string | null;
  clearError: () => void;
  openModal: (tab?: WalletProviderType) => void;
  closeModal: () => void;
  connect: (preferredType?: WalletProviderType) => Promise<string | null>;
  connectWithExtension: (
    targetType?: WalletProviderType,
  ) => Promise<{ address: string | null; error?: string }>;
  connectWithSdk: () => Promise<{ address: string | null; error?: string }>;
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
  const [selectedTab, setSelectedTab] = useState<WalletProviderType>('metamask');
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
  const [trustDeepLink, setTrustDeepLink] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressRef = useRef<string | null>(null);
  const providerRef = useRef<Eip1193Provider | null>(null);
  const sdkTerminateRef = useRef<(() => Promise<void>) | null>(null);

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

  useEffect(() => {
    setInIframe(isRunningInIframe());
    if (typeof window !== 'undefined') {
      const link = getTrustWalletDeepLink(window.location.href);
      setTrustDeepLink(link);
      QRCode.toDataURL(link, {
        width: 220,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(setTrustQrDataUrl)
        .catch(() => {});
    }

    let mounted = true;
    let activeProvider: Eip1193Provider | null = null;

    const handleAccountsChanged = (accountsArg: unknown) => {
      const list = Array.isArray(accountsArg) ? (accountsArg as string[]) : [];
      if (!activeProvider) return;
      syncAccountState(activeProvider, list[0] || null);
    };

    const handleChainChanged = (chainHexArg: unknown) => {
      const hex = typeof chainHexArg === 'string' ? chainHexArg : '';
      const parsed = hex ? Number.parseInt(hex, 16) : null;
      setChainId(parsed);
      const currentAddr = addressRef.current;
      if (activeProvider && currentAddr) {
        getWalletBalanceEth(activeProvider, currentAddr).then(setBalanceEth);
      }
    };

    Promise.all([
      discoverWalletProvider('metamask', 250),
      discoverWalletProvider('trustwallet', 250),
    ]).then(async ([mmFound, twFound]) => {
      if (!mounted) return;
      setIsMetaMaskAvailable(Boolean(mmFound));
      setIsTrustWalletAvailable(Boolean(twFound));

      const chosen = mmFound || twFound;
      if (!chosen) return;

      activeProvider = chosen.provider;
      setProvider(chosen.provider);
      setWalletType(chosen.walletType);

      try {
        const accounts = await getMetaMaskAccounts(chosen.provider);
        if (mounted && accounts.length > 0) {
          setConnectionMethod('extension');
          await syncAccountState(chosen.provider, accounts[0]);
        } else if (mounted) {
          const cid = await getMetaMaskChainId(chosen.provider).catch(() => null);
          if (mounted) setChainId(cid);
        }
      } catch {
        // Ignore passive check errors when wallet is locked
      }

      chosen.provider.on?.('accountsChanged', handleAccountsChanged);
      chosen.provider.on?.('chainChanged', handleChainChanged);
    });

    return () => {
      mounted = false;
      activeProvider?.removeListener?.('accountsChanged', handleAccountsChanged);
      activeProvider?.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [syncAccountState]);

  const clearError = useCallback(() => setError(null), []);
  const openModal = useCallback((tab?: WalletProviderType) => {
    setError(null);
    if (tab) setSelectedTab(tab);
    if (typeof window !== 'undefined') {
      const link = getTrustWalletDeepLink(window.location.href);
      setTrustDeepLink(link);
    }
    setIsModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const connectWithExtension = useCallback(
    async (
      targetType: WalletProviderType = 'metamask',
    ): Promise<{ address: string | null; error?: string }> => {
      setError(null);
      setIsConnecting(true);
      const label = getWalletLabel(targetType);
      try {
        const found = await discoverWalletProvider(targetType, 350);
        if (!found) {
          const msg = isRunningInIframe()
            ? `${label} extension is blocked inside embedded frames. Open ANAGU in a standalone tab or use ${label} Mobile.`
            : `${label} browser extension not detected. Install ${label} or use ${label} Mobile.`;
          setError(msg);
          return { address: null, error: msg };
        }
        setProvider(found.provider);
        setWalletType(found.walletType);
        if (found.walletType === 'trustwallet') setIsTrustWalletAvailable(true);
        else setIsMetaMaskAvailable(true);

        const accounts = await connectMetaMaskAccounts(found.provider);
        const primary = accounts[0] || null;
        if (!primary) {
          const msg = `No ${label} account selected.`;
          setError(msg);
          return { address: null, error: msg };
        }
        setConnectionMethod('extension');
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
    [syncAccountState],
  );

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
          // Non-fatal QR generation issue; URI link remains usable
        }
      };

      const session = await createMetaMaskSdkSession((uri) => {
        void handleUri(uri);
      });
      sdkTerminateRef.current = session.terminate;
      setProvider(session.provider);
      setWalletType('metamask');
      setIsMetaMaskAvailable(true);
      setConnectionMethod('sdk');

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
  }, [syncAccountState]);

  const connect = useCallback(
    async (preferredType?: WalletProviderType): Promise<string | null> => {
      const target = preferredType || selectedTab || 'metamask';
      setSelectedTab(target);

      const extFound = await discoverWalletProvider(target, 250);
      if (extFound) {
        const res = await connectWithExtension(target);
        if (res.address) return res.address;
        openModal(target);
        return null;
      }

      setError(null);
      openModal(target);
      return null;
    },
    [connectWithExtension, openModal, selectedTab],
  );

  const disconnect = useCallback(() => {
    if (sdkTerminateRef.current) {
      sdkTerminateRef.current().catch(() => {});
      sdkTerminateRef.current = null;
    }
    setAddress(null);
    setBalanceEth(null);
    setWalletType(null);
    setConnectionMethod(null);
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
        throw new Error('Connect MetaMask or Trust Wallet first before switching networks.');
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
        throw new Error('Connect MetaMask or Trust Wallet first.');
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
        openModal(selectedTab);
        throw new Error('Wallet connection required. Choose MetaMask or Trust Wallet.');
      }
      const signer = targetAddress || addressRef.current || (await connect(selectedTab));
      if (!signer) {
        throw new Error('Wallet account connection is required to sign.');
      }
      try {
        return await signPersonalMessage(activeProvider, signer, message);
      } catch (err) {
        const formatted = formatMetaMaskError(err, getWalletLabel(walletType));
        setError(formatted);
        throw new Error(formatted);
      }
    },
    [connect, openModal, selectedTab, walletType],
  );

  const authorizeRegistryAction = useCallback(
    async (
      params: Parameters<typeof authorizeLandRegistryAction>[3],
    ): Promise<WalletProofPayload> => {
      setError(null);
      const requestedType =
        'walletProvider' in params && params.walletProvider
          ? params.walletProvider
          : walletType || selectedTab;

      let activeProvider = providerRef.current;
      let activeAddr = addressRef.current;

      if (!activeProvider || (requestedType && walletType !== requestedType)) {
        const ext = await discoverWalletProvider(requestedType, 300);
        if (ext) {
          const res = await connectWithExtension(requestedType);
          activeProvider = ext.provider;
          activeAddr = res.address;
        } else if (!activeProvider) {
          openModal(requestedType);
          throw new Error(
            `Connect ${getWalletLabel(requestedType)} in the dialog to authorize this land transaction.`,
          );
        }
      }

      if (!activeProvider || !activeAddr) {
        const addr = await connect(requestedType);
        if (!addr || !providerRef.current) {
          throw new Error(`Connect ${getWalletLabel(requestedType)} to complete authorization.`);
        }
        activeProvider = providerRef.current;
        activeAddr = addr;
      }

      try {
        return await authorizeLandRegistryAction(activeProvider, activeAddr, chainId, params);
      } catch (err) {
        const formatted = formatMetaMaskError(err, getWalletLabel(requestedType));
        setError(formatted);
        throw new Error(formatted);
      }
    },
    [chainId, connect, connectWithExtension, openModal, selectedTab, walletType],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      provider,
      walletType,
      walletLabel: getWalletLabel(walletType),
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
      isModalOpen,
      error,
      clearError,
      openModal,
      closeModal,
      connect,
      connectWithExtension,
      connectWithSdk,
      disconnect,
      switchToBesu,
      switchChain,
      signMessage,
      authorizeRegistryAction,
    }),
    [
      provider,
      walletType,
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
      isModalOpen,
      error,
      clearError,
      openModal,
      closeModal,
      connect,
      connectWithExtension,
      connectWithSdk,
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
