'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { BESU_CHAIN_ID } from '../lib/metamask';
import { useWallet } from './WalletContext';

export default function MetaMaskConnectModal() {
  const wallet = useWallet();
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [showKeyImport, setShowKeyImport] = useState(false);
  const [privateKeyInput, setPrivateKeyInput] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, [wallet.isModalOpen]);

  const { isModalOpen, closeModal } = wallet;

  useEffect(() => {
    if (!isModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen, closeModal]);

  if (!wallet.isModalOpen) return null;

  const copyAddress = async () => {
    if (!wallet.address || !navigator.clipboard) return;
    await navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const copyPairingUri = async () => {
    if (!wallet.sdkUri || !navigator.clipboard) return;
    await navigator.clipboard.writeText(wallet.sdkUri).catch(() => {});
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  const activeTab =
    wallet.selectedTab === 'metamask' ||
    wallet.selectedTab === 'trustwallet' ||
    wallet.selectedTab === 'mobile'
      ? wallet.selectedTab
      : 'all';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="wallet-modal-title" className="text-sm sm:text-base font-bold text-slate-900">
              Connect Any Web3 Wallet
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Use MetaMask, Trust Wallet, Coinbase Wallet, Rabby, Rainbow, Phantom, OKX, or any EIP-6963 Web3 wallet.
            </p>
          </div>
          <button
            type="button"
            onClick={wallet.closeModal}
            aria-label="Close wallet dialog"
            className="text-slate-400 hover:text-slate-700 text-xl leading-none px-2 py-1 shrink-0"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[85dvh] overflow-y-auto">
          {wallet.error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-900 leading-relaxed">
              {wallet.error}
            </div>
          )}

          {wallet.isConnected && wallet.address ? (
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-emerald-800">
                  <span className="font-semibold">Connected · {wallet.walletLabel}</span>
                  <span className="font-mono">
                    {wallet.connectionMethod === 'sdk' ? 'Mobile SDK' : 'Web3 Provider'}
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-900 break-all">
                  {wallet.address}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <span className="font-mono text-slate-700 tabular-nums">
                    Balance: {wallet.balanceEth ?? '0.0000'} ETH · {wallet.chainName}
                  </span>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="px-2.5 py-1 font-medium text-emerald-800 bg-white border border-emerald-300 rounded hover:bg-emerald-100"
                  >
                    {copiedAddr ? 'Copied' : 'Copy Address'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800">Switch EVM / Polygon Network</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => wallet.switchChain(137)}
                    className={`py-2 px-3 text-xs font-medium rounded border transition-colors ${
                      wallet.chainId === 137
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Polygon (137)
                  </button>
                  <button
                    type="button"
                    onClick={() => wallet.switchChain(80002)}
                    className={`py-2 px-3 text-xs font-medium rounded border transition-colors ${
                      wallet.chainId === 80002
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Polygon Amoy (80002)
                  </button>
                  <button
                    type="button"
                    onClick={() => wallet.switchChain(1)}
                    className={`py-2 px-3 text-xs font-medium rounded border transition-colors ${
                      wallet.chainId === 1
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Ethereum (1)
                  </button>
                  <button
                    type="button"
                    onClick={() => wallet.switchChain(11155111)}
                    className={`py-2 px-3 text-xs font-medium rounded border transition-colors ${
                      wallet.chainId === 11155111
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Sepolia (11155111)
                  </button>
                  <button
                    type="button"
                    onClick={() => wallet.switchChain(8453)}
                    className={`py-2 px-3 text-xs font-medium rounded border transition-colors ${
                      wallet.chainId === 8453
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Base (8453)
                  </button>
                  <button
                    type="button"
                    onClick={() => wallet.switchChain(BESU_CHAIN_ID)}
                    className={`py-2 px-3 text-xs font-medium rounded border transition-colors ${
                      wallet.isBesuNetwork
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Besu QBFT ({BESU_CHAIN_ID})
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={wallet.disconnect}
                  className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-md hover:bg-red-50"
                >
                  Disconnect Wallet
                </button>
                <button
                  type="button"
                  onClick={wallet.closeModal}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Wallet Selector Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  type="button"
                  onClick={() => {
                    wallet.clearError();
                    wallet.setSelectedTab('all');
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded transition-colors ${
                    activeTab === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Wallets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    wallet.clearError();
                    wallet.setSelectedTab('metamask');
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded transition-colors ${
                    activeTab === 'metamask'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  MetaMask
                </button>
                <button
                  type="button"
                  onClick={() => {
                    wallet.clearError();
                    wallet.setSelectedTab('trustwallet');
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded transition-colors ${
                    activeTab === 'trustwallet'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Trust Wallet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    wallet.clearError();
                    wallet.setSelectedTab('mobile');
                  }}
                  className={`py-2 px-2 text-xs font-semibold rounded transition-colors ${
                    activeTab === 'mobile'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mobile / QR
                </button>
              </div>

              {activeTab === 'all' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-md border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Detected Web3 Browser Wallets (EIP-6963)
                      </h3>
                      <button
                        type="button"
                        onClick={() => void wallet.refreshWallets()}
                        className="text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        Rescan
                      </button>
                    </div>

                    {wallet.discoveredWallets.length > 0 ? (
                      <div className="space-y-2">
                        {wallet.discoveredWallets.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-md"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {w.icon ? (
                                <Image
                                  src={w.icon}
                                  alt={w.name}
                                  width={24}
                                  height={24}
                                  unoptimized
                                  className="rounded shrink-0"
                                />
                              ) : (
                                <span className="w-6 h-6 rounded bg-slate-900 text-white text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                                  {w.name.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 truncate">
                                  {w.name}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 truncate">
                                  {w.rdns}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={wallet.isConnecting}
                              onClick={async () => {
                                const res = await wallet.connectWalletById(w.id);
                                if (res.address) wallet.closeModal();
                              }}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded hover:bg-emerald-800 disabled:opacity-50 shrink-0"
                            >
                              {wallet.isConnecting ? 'Connecting...' : 'Connect'}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                        <p>
                          {wallet.inIframe
                            ? 'Embedded preview frames block browser extension injection. Open ANAGU in a standalone tab to connect MetaMask, Coinbase Wallet, Rabby, Rainbow, Phantom, or Trust Wallet extensions—or use Mobile QR below.'
                            : 'No injected browser Web3 extension detected yet. Install any EIP-1193 wallet (MetaMask, Trust Wallet, Coinbase Wallet, Rabby, Rainbow, Phantom, OKX) or pair a mobile wallet.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={wallet.isConnecting}
                            onClick={async () => {
                              const res = await wallet.connectWithBrowserSigner();
                              if (res.address) wallet.closeModal();
                            }}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
                          >
                            {wallet.isConnecting
                              ? 'Starting Web3 Wallet...'
                              : 'Use Instant Browser Web3 Wallet'}
                          </button>
                          {wallet.inIframe && currentUrl && (
                            <a
                              href={currentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded-md hover:bg-emerald-50"
                            >
                              Open in New Tab →
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => wallet.setSelectedTab('mobile')}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
                          >
                            Mobile Wallet / QR
                          </button>
                        </div>

                        <div className="pt-2 border-t border-slate-200/80">
                          <button
                            type="button"
                            onClick={() => setShowKeyImport((prev) => !prev)}
                            className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 underline"
                          >
                            {showKeyImport
                              ? 'Hide EVM Private Key Import'
                              : 'Or Connect Using a Custom / Besu Private Key'}
                          </button>
                          {showKeyImport && (
                            <div className="mt-2 flex flex-col sm:flex-row gap-2">
                              <input
                                type="password"
                                value={privateKeyInput}
                                onChange={(e) => setPrivateKeyInput(e.target.value)}
                                placeholder="Paste 0x... EVM private key (stored in session only)"
                                className="flex-1 px-2.5 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-md"
                              />
                              <button
                                type="button"
                                disabled={wallet.isConnecting || !privateKeyInput.trim()}
                                onClick={async () => {
                                  const res = await wallet.connectWithBrowserSigner(privateKeyInput);
                                  if (res.address) {
                                    setPrivateKeyInput('');
                                    wallet.closeModal();
                                  }
                                }}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                              >
                                Import &amp; Connect
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-md border border-slate-200 bg-white space-y-2.5">
                    <div className="text-xs font-semibold text-slate-900">
                      Quick Launch Supported Web3 Mobile Apps
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {wallet.metamaskDeepLink && (
                        <a
                          href={wallet.metamaskDeepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 text-center text-xs font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded hover:bg-amber-200"
                        >
                          MetaMask App
                        </a>
                      )}
                      {wallet.trustDeepLink && (
                        <a
                          href={wallet.trustDeepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 text-center text-xs font-semibold text-white bg-blue-700 rounded hover:bg-blue-800"
                        >
                          Trust Wallet
                        </a>
                      )}
                      {wallet.coinbaseDeepLink && (
                        <a
                          href={wallet.coinbaseDeepLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 text-center text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800"
                        >
                          Coinbase Wallet
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'metamask' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-md border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        MetaMask Browser Extension
                      </h3>
                      <span className="text-[11px] font-mono text-slate-600">
                        {wallet.isMetaMaskAvailable
                          ? 'Detected'
                          : wallet.inIframe
                          ? 'Embedded Frame'
                          : 'Not Detected'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {wallet.isMetaMaskAvailable
                        ? 'Your MetaMask browser extension is ready to connect.'
                        : wallet.inIframe
                        ? 'Chrome blocks extension injection inside embedded preview frames. Open ANAGU in a standalone browser tab to connect your MetaMask extension directly.'
                        : 'Install MetaMask browser extension or connect via MetaMask Mobile below.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={wallet.isConnecting}
                        onClick={async () => {
                          const res = await wallet.connectWithExtension('metamask');
                          if (res.address) wallet.closeModal();
                        }}
                        className="px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded-md hover:bg-amber-200 disabled:opacity-50"
                      >
                        {wallet.isConnecting ? 'Requesting MetaMask...' : 'Connect MetaMask Extension'}
                      </button>

                      {!wallet.isMetaMaskAvailable && (
                        <button
                          type="button"
                          disabled={wallet.isConnecting}
                          onClick={async () => {
                            const res = await wallet.connectWithBrowserSigner();
                            if (res.address) wallet.closeModal();
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {wallet.isConnecting
                            ? 'Starting Web3 Wallet...'
                            : 'Use Instant Browser Web3 Wallet'}
                        </button>
                      )}

                      {wallet.inIframe && currentUrl && (
                        <a
                          href={currentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded-md hover:bg-emerald-50"
                        >
                          Open in New Tab →
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-md border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        MetaMask Mobile (QR Code)
                      </h3>
                      <span className="text-[11px] font-mono text-slate-500">MetaMask SDK</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Pair your phone&apos;s MetaMask Mobile app by scanning a live pairing QR code—works inside any frame.
                    </p>

                    {!wallet.sdkQrDataUrl && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={wallet.sdkConnecting}
                          onClick={() => void wallet.connectWithSdk()}
                          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
                        >
                          {wallet.sdkConnecting
                            ? 'Generating MetaMask QR...'
                            : 'Generate MetaMask Mobile QR'}
                        </button>
                        {wallet.sdkConnecting && (
                          <button
                            type="button"
                            onClick={wallet.cancelSdkConnect}
                            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    )}

                    {wallet.sdkQrDataUrl && (
                      <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 border-t border-slate-100">
                        <div className="p-2 bg-white border border-slate-200 rounded-md shrink-0">
                          <Image
                            src={wallet.sdkQrDataUrl}
                            alt="MetaMask Mobile pairing QR code"
                            width={150}
                            height={150}
                            unoptimized
                          />
                        </div>
                        <div className="space-y-2.5 text-xs">
                          <p className="font-medium text-slate-900">
                            Scan with the MetaMask Mobile camera to connect your account.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {wallet.sdkUri && (
                              <a
                                href={wallet.sdkUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 font-semibold text-white bg-emerald-700 rounded hover:bg-emerald-800"
                              >
                                Open MetaMask App →
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={copyPairingUri}
                              className="px-3 py-1.5 font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200"
                            >
                              {copiedUri ? 'Copied Link' : 'Copy Link'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'trustwallet' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-md border border-slate-200 bg-slate-50 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Trust Wallet Browser Extension
                      </h3>
                      <span className="text-[11px] font-mono text-slate-600">
                        {wallet.isTrustWalletAvailable
                          ? 'Detected'
                          : wallet.inIframe
                          ? 'Embedded Frame'
                          : 'Not Detected'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {wallet.isTrustWalletAvailable
                        ? 'Your Trust Wallet browser extension is detected and ready to connect.'
                        : wallet.inIframe
                        ? 'Browser extensions do not inject into embedded preview frames. Open ANAGU in a standalone tab for Trust Wallet extension access, or open in Trust Wallet Mobile below.'
                        : 'Install the Trust Wallet extension on Chrome/Brave/Edge or launch ANAGU inside Trust Wallet Mobile below.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={wallet.isConnecting}
                        onClick={async () => {
                          const res = await wallet.connectWithExtension('trustwallet');
                          if (res.address) wallet.closeModal();
                        }}
                        className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:opacity-50"
                      >
                        {wallet.isConnecting ? 'Requesting Trust Wallet...' : 'Connect Trust Wallet Extension'}
                      </button>

                      {!wallet.isTrustWalletAvailable && (
                        <button
                          type="button"
                          disabled={wallet.isConnecting}
                          onClick={async () => {
                            const res = await wallet.connectWithBrowserSigner();
                            if (res.address) wallet.closeModal();
                          }}
                          className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {wallet.isConnecting
                            ? 'Starting Web3 Wallet...'
                            : 'Use Instant Browser Web3 Wallet'}
                        </button>
                      )}

                      {wallet.inIframe && currentUrl && (
                        <a
                          href={currentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-300 rounded-md hover:bg-emerald-50"
                        >
                          Open in New Tab →
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-md border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Trust Wallet Mobile App
                      </h3>
                      <span className="text-[11px] font-mono text-slate-500">Deep Link &amp; QR</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Scan this QR code or tap the button on mobile to open and buy parcels directly inside Trust Wallet&apos;s dApp browser.
                    </p>

                    {wallet.trustQrDataUrl && (
                      <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 border-t border-slate-100">
                        <div className="p-2 bg-white border border-slate-200 rounded-md shrink-0">
                          <Image
                            src={wallet.trustQrDataUrl}
                            alt="Open in Trust Wallet Mobile QR code"
                            width={150}
                            height={150}
                            unoptimized
                          />
                        </div>
                        <div className="space-y-2.5 text-xs">
                          <p className="font-medium text-slate-900">
                            Launch ANAGU in Trust Wallet to sign parcel purchases and registrations directly.
                          </p>
                          {wallet.trustDeepLink && (
                            <a
                              href={wallet.trustDeepLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block px-3.5 py-2 font-semibold text-white bg-blue-700 rounded hover:bg-blue-800"
                            >
                              Open in Trust Wallet App →
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'mobile' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-md border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Any Mobile Web3 dApp Browser (QR)
                      </h3>
                      <span className="text-[11px] font-mono text-slate-500">Coinbase · Rainbow · OKX · Phantom</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Scan with any mobile Web3 wallet browser (Coinbase Wallet, Rainbow, OKX, Zerion, Phantom, Trust Wallet, or MetaMask) to open ANAGU with injected Web3 signing.
                    </p>
                    {wallet.universalQrDataUrl && (
                      <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 border-t border-slate-100">
                        <div className="p-2 bg-white border border-slate-200 rounded-md shrink-0">
                          <Image
                            src={wallet.universalQrDataUrl}
                            alt="Universal Web3 dApp QR code"
                            width={150}
                            height={150}
                            unoptimized
                          />
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="flex flex-wrap gap-2">
                            {wallet.coinbaseDeepLink && (
                              <a
                                href={wallet.coinbaseDeepLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 font-semibold text-white bg-slate-900 rounded hover:bg-slate-800"
                              >
                                Open in Coinbase Wallet →
                              </a>
                            )}
                            {wallet.trustDeepLink && (
                              <a
                                href={wallet.trustDeepLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 font-semibold text-white bg-blue-700 rounded hover:bg-blue-800"
                              >
                                Open in Trust Wallet →
                              </a>
                            )}
                            {wallet.metamaskDeepLink && (
                              <a
                                href={wallet.metamaskDeepLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded hover:bg-amber-200"
                              >
                                Open in MetaMask →
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
