'use client';

import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { useWallet } from '../../components/WalletContext';

export default function GetStartedPage() {
  const wallet = useWallet();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-slate-500 mb-2">
            ANAGU Land Registry &amp; Wallet Acquisition
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Register your land or buy verified parcels directly with your wallet
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
            No account creation required. Choose whether you want to buy a surveyed Lagos parcel with MetaMask or Trust Wallet, or register your own land coordinates and deed documents.
          </p>
        </div>

        {/* Two Core Actions */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg p-5 sm:p-6 border border-slate-200 flex flex-col justify-between gap-6">
            <div>
              <span className="text-xs font-mono font-semibold text-emerald-700">
                01 · ACCESS LAND
              </span>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                Browse Verified &amp; Unverified Land Parcels
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Explore both deed-verified and unverified land parcels. Trigger any Web3 wallet directly to authorize acquisition and receive an ERC-721 digital title record.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              <Link
                href="/marketplace"
                className="w-full sm:w-auto text-center px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                Access Land
              </Link>
              <button
                type="button"
                onClick={() => wallet.openModal('metamask')}
                className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded-md hover:bg-amber-200 transition-colors whitespace-nowrap"
              >
                Pair MetaMask
              </button>
              <button
                type="button"
                onClick={() => wallet.openModal('trustwallet')}
                className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-semibold text-slate-900 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                Pair Trust Wallet
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 sm:p-6 border border-slate-200 flex flex-col justify-between gap-6">
            <div>
              <span className="text-xs font-mono font-semibold text-emerald-700">
                02 · REGISTER LAND
              </span>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                Register Your Own Land
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Plot your parcel boundary on OpenStreetMap, attach hashed deed or survey PDFs (SHA-256), and submit directly for verification and ERC-721 title issuance.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register-land"
                className="w-full sm:w-auto text-center px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Register Land
              </Link>
            </div>
          </div>
        </section>

        {/* Wallet Status Strip */}
        <section className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">
              Web3 Wallet Settlement Status
            </h2>
            <p className="text-xs text-slate-600 mt-1 break-all">
              {wallet.isConnected && wallet.address
                ? `Connected via ${wallet.walletLabel}: ${wallet.address} on ${wallet.chainName}`
                : 'Connect MetaMask or Trust Wallet (browser extension, standalone tab, or mobile QR) to sign parcel purchases and register wallet ownership.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => wallet.openModal()}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            {wallet.isConnected ? 'Manage Wallet Connection' : 'Connect MetaMask / Trust Wallet'}
          </button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
