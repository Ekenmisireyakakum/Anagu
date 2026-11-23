'use client';

import { useEffect, useRef, useState } from 'react';
import { getAuthHeaders } from '../lib/client-auth';
import { formatCompactTokenBalance, watchLandTokenInWallet } from '../lib/metamask';
import { POLYGON_AMOY_PUBLIC_CONFIG } from '../lib/polygon-config';
import { useWallet } from './WalletContext';

export default function MetaMaskConnectButton({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const wallet = useWallet();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [tokenAddedMsg, setTokenAddedMsg] = useState<string | null>(null);
  const [showFundGuide, setShowFundGuide] = useState(false);
  const [faucetConfigured, setFaucetConfigured] = useState<boolean | null>(null);
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [faucetStatusMsg, setFaucetStatusMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverOpen]);

  useEffect(() => {
    if (!wallet.isConnected) {
      setPopoverOpen(false);
    }
  }, [wallet.isConnected]);

  const handleCopyAddress = async () => {
    if (!wallet.address || !navigator.clipboard) return;
    await navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  const handleWatchToken = async () => {
    if (!wallet.provider) return;
    const ok = await watchLandTokenInWallet(wallet.provider);
    setTokenAddedMsg(ok ? 'ALT added to wallet' : 'Prompt sent / open wallet modal');
    setTimeout(() => setTokenAddedMsg(null), 2600);
  };

  useEffect(() => {
    if (!popoverOpen || faucetConfigured !== null) return;
    fetch('/api/wallet/faucet', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFaucetConfigured(Boolean(data.configured));
      })
      .catch(() => {});
  }, [popoverOpen, faucetConfigured]);

  const handleClaimStarterAlt = async () => {
    if (!wallet.address) return;
    setFaucetBusy(true);
    setFaucetStatusMsg(null);
    try {
      const res = await fetch('/api/wallet/faucet', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ recipientAddress: wallet.address, amountAlt: 100000 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFaucetStatusMsg(data.message || 'Unable to claim starter ALT tokens.');
        setShowFundGuide(true);
        return;
      }
      setFaucetStatusMsg(`Sent ${Number(data.amountAlt || 100000).toLocaleString()} ALT to your wallet!`);
      await wallet.refreshBalance();
    } catch {
      setFaucetStatusMsg('Unable to reach ALT treasury endpoint.');
      setShowFundGuide(true);
    } finally {
      setFaucetBusy(false);
    }
  };

  if (!wallet.isConnected || !wallet.address) {
    return (
      <button
        type="button"
        onClick={() => wallet.openModal()}
        className={`${
          compact
            ? 'px-3 sm:px-4 py-2 text-xs min-h-[40px] sm:min-h-[36px]'
            : 'px-5 py-3 text-sm min-h-[44px]'
        } font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 max-w-full text-white bg-emerald-700 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${className}`}
      >
        {compact ? (
          <>
            <span className="sm:hidden">Connect Wallet</span>
            <span className="hidden sm:inline">Connect Web3 Wallet</span>
          </>
        ) : (
          'Connect Any Web3 Wallet'
        )}
      </button>
    );
  }

  const shortAddr = `${wallet.address.slice(0, 5)}...${wallet.address.slice(-4)}`;
  const fullShortAddr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  const compactAlt = formatCompactTokenBalance(wallet.balanceAlt);
  const fullAlt = wallet.balanceAlt ?? '0.00';

  return (
    <div ref={containerRef} className={`relative inline-flex max-w-full ${compact ? 'min-w-0' : ''}`}>
      <button
        type="button"
        aria-expanded={popoverOpen}
        aria-haspopup="dialog"
        title={`${wallet.walletLabel}: ${wallet.address} · ${fullAlt} ALT · ${wallet.balanceEth ?? '0.0000'} ${wallet.nativeSymbol}`}
        onClick={() => setPopoverOpen((prev) => !prev)}
        className={`${
          compact
            ? 'px-2.5 sm:px-3.5 py-2 text-xs min-h-[40px] sm:min-h-[36px] max-w-[165px] sm:max-w-[245px] lg:max-w-[330px]'
            : 'px-4 py-2.5 text-xs sm:text-sm min-h-[44px] max-w-full'
        } inline-flex items-center justify-between gap-1.5 font-semibold rounded-md transition-colors border text-emerald-950 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 min-w-0 ${className}`}
      >
        <span className="truncate font-mono tabular-nums">
          {compact ? (
            <>
              <span className="sm:hidden">{compactAlt} ALT</span>
              <span className="hidden sm:inline lg:hidden">
                {shortAddr} · {compactAlt} ALT
              </span>
              <span className="hidden lg:inline">
                {shortAddr} · {compactAlt} ALT · {wallet.balanceEth ?? '0.0000'} {wallet.nativeSymbol}
              </span>
            </>
          ) : (
            <>
              {wallet.walletLabel}: {fullShortAddr} · {compactAlt} ALT ·{' '}
              {wallet.balanceEth ?? '0.0000'} {wallet.nativeSymbol}
            </>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 text-emerald-800 transition-transform duration-150 ${
            popoverOpen ? 'rotate-180' : ''
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {popoverOpen && (
        <div
          role="dialog"
          aria-label="Connected Web3 wallet details"
          className={`absolute top-full mt-2 z-[1400] w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border border-slate-200 bg-white shadow-xl p-4 space-y-3.5 text-left ${
            compact ? 'right-0' : 'left-0 sm:right-0 sm:left-auto'
          }`}
        >
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">{wallet.walletLabel}</div>
              <div className="text-[11px] font-mono text-slate-500 truncate">{wallet.chainName}</div>
            </div>
            <button
              type="button"
              disabled={wallet.isRefreshingBalance}
              onClick={() => void wallet.refreshBalance()}
              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 disabled:opacity-50 shrink-0 transition-colors"
            >
              {wallet.isRefreshingBalance ? 'Syncing...' : 'Refresh'}
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-medium text-slate-500">Wallet Address</div>
            <div className="flex items-center justify-between gap-2 p-2 rounded border border-slate-200 bg-slate-50">
              <span className="font-mono text-[11px] text-slate-900 break-all leading-snug">
                {wallet.address}
              </span>
              <button
                type="button"
                onClick={() => void handleCopyAddress()}
                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 shrink-0"
              >
                {copiedAddr ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="p-2.5 rounded border border-emerald-200 bg-emerald-50/60 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600">ANAGU Token Balance (Polygon ERC-20)</span>
                <button
                  type="button"
                  onClick={() => setShowFundGuide((prev) => !prev)}
                  className="text-[11px] font-semibold text-emerald-800 hover:underline shrink-0"
                >
                  {showFundGuide ? 'Hide Guide' : 'How to Fund ALT?'}
                </button>
              </div>
              <div className="font-mono text-sm font-bold text-emerald-900 tabular-nums break-words">
                {fullAlt} ALT
              </div>
              {(showFundGuide || Number.parseFloat(fullAlt.replace(/,/g, '')) <= 0) && (
                <div className="pt-1.5 border-t border-emerald-200/70 text-[11px] text-slate-700 space-y-1.5 leading-snug">
                  <p>
                    <strong className="text-slate-900">How ALT funding works:</strong>{' '}
                    <code className="font-mono text-[10px]">ALT</code> is ANAGU&apos;s Polygon Amoy ERC-20 token (
                    <code className="font-mono text-[10px]">
                      {POLYGON_AMOY_PUBLIC_CONFIG.contracts.ERC20Token.slice(0, 8)}...
                      {POLYGON_AMOY_PUBLIC_CONFIG.contracts.ERC20Token.slice(-4)}
                    </code>
                    ). New wallets start at <strong>0.00 ALT</strong> until funded by the ANAGU Treasury/Admin.
                  </p>
                  <p className="text-slate-600">
                    Copy your address above for an Admin to mint/send ALT in the Admin Portal, or buy immediately on Access Land using zero-gas wallet signature or Registry Escrow.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {faucetConfigured && (
                      <button
                        type="button"
                        disabled={faucetBusy}
                        onClick={() => void handleClaimStarterAlt()}
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 rounded hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {faucetBusy ? 'Sending ALT...' : 'Claim 100,000 ALT'}
                      </button>
                    )}
                    <a
                      href="https://faucet.polygon.technology/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-emerald-800 underline"
                    >
                      Get Free Test POL (Gas) ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              <div className="text-[11px] text-slate-600">Native Gas Balance</div>
              <div className="mt-0.5 font-mono text-sm font-bold text-slate-900 tabular-nums">
                {wallet.balanceEth ?? '0.0000'} {wallet.nativeSymbol}
              </div>
              {wallet.polygonPolBalance &&
                wallet.chainId !== 80002 &&
                wallet.chainId !== 137 && (
                  <div className="mt-0.5 text-[11px] font-mono text-slate-500 tabular-nums">
                    Polygon Amoy: {wallet.polygonPolBalance} POL
                  </div>
                )}
            </div>
          </div>

          {faucetStatusMsg && (
            <div className="text-[11px] font-medium text-slate-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 leading-snug">
              {faucetStatusMsg}
            </div>
          )}

          {tokenAddedMsg && (
            <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5">
              {tokenAddedMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            {wallet.chainId !== 80002 && (
              <button
                type="button"
                onClick={() => void wallet.switchChain(80002)}
                className="flex-1 min-w-[130px] px-3 py-2 text-xs font-semibold text-white bg-emerald-700 rounded hover:bg-emerald-800 transition-colors"
              >
                Switch to Polygon Amoy
              </button>
            )}
            {wallet.provider && (
              <button
                type="button"
                onClick={() => void handleWatchToken()}
                className="flex-1 min-w-[120px] px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
              >
                + Add ALT Token
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPopoverOpen(false);
                wallet.openModal('all');
              }}
              className="flex-1 min-w-[120px] px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200 transition-colors"
            >
              Switch Wallet
            </button>
            <button
              type="button"
              onClick={() => {
                wallet.disconnect();
                setPopoverOpen(false);
              }}
              className="px-3 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
