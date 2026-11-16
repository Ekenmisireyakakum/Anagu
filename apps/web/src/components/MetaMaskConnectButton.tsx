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
        compact ? 'px-4 py-2 text-xs' : 'px-5 py-3 text-sm'
      } font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
        wallet.isConnected
          ? 'text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100'
          : 'text-white bg-emerald-700 hover:bg-emerald-800'
      } ${className}`}
    >
      {wallet.isConnected && wallet.address
        ? `${wallet.walletLabel}: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
        : compact
        ? 'Connect Web3 Wallet'
        : 'Connect Any Web3 Wallet'}
    </button>
  );
}
