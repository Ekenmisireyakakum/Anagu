'use client';

import { useWallet } from './WalletContext';

export default function MetaMaskConnectButton({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const wallet = useWallet();

  return (
    <button
      type="button"
      onClick={() => wallet.openModal()}
      className={`${
        compact ? 'px-3 sm:px-4 py-2 text-xs min-h-[40px] sm:min-h-0' : 'px-5 py-3 text-sm'
      } font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 max-w-full ${
        wallet.isConnected
          ? 'text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100'
          : 'text-white bg-emerald-700 hover:bg-emerald-800'
      } ${className}`}
    >
      {wallet.isConnected && wallet.address ? (
        <>
          <span className="sm:hidden font-mono">
            {wallet.address.slice(0, 5)}...{wallet.address.slice(-4)}
          </span>
          <span className="hidden sm:inline">
            {wallet.walletLabel}: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </span>
        </>
      ) : compact ? (
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
