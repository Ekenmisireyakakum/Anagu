import Link from 'next/link';
import MetaMaskConnectButton from '../components/MetaMaskConnectButton';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import ParcelImage from '../components/marketplace/ParcelImage';
import { ensureStoreReady, listLandListings } from '../lib/anagu-store';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await ensureStoreReady();
  const listings = listLandListings();
  const availableListings = listings.filter((l) => l.status === 'AVAILABLE');
  const verifiedAvailableCount = availableListings.filter(
    (l) => (l.verificationStatus || 'VERIFIED') === 'VERIFIED',
  ).length;
  const unverifiedAvailableCount = availableListings.filter(
    (l) => l.verificationStatus === 'UNVERIFIED',
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1">
        {/* Focused Platform Overview + Primary Actions */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <p className="text-xs font-medium text-slate-500 mb-3">
                ANAGU Land Registry &amp; Web3 Acquisition
              </p>
              <h1 className="text-[clamp(2.25rem,4vw,3.35rem)] font-bold tracking-tight text-slate-900 leading-[1.1] max-w-2xl [text-wrap:balance]">
                Register land deeds or access verified and unverified parcels
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                ANAGU connects landowners, registry verification, and Web3 buyers on one platform. Landowners can register plots with boundary coordinates, asking prices, and SHA-256 hashed deeds, while buyers can inspect and acquire both verified and unverified land parcels directly using any Web3 wallet.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register-land"
                  className="px-6 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  Register Land
                </Link>
                <Link
                  href="/marketplace"
                  className="px-6 py-3 text-sm font-semibold text-slate-900 bg-amber-300 border border-amber-400 rounded-md hover:bg-amber-400 transition-colors whitespace-nowrap"
                >
                  Access Land
                </Link>
                <MetaMaskConnectButton />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                <span>
                  <strong className="font-mono text-emerald-700 tabular-nums">
                    {verifiedAvailableCount}
                  </strong>{' '}
                  verified parcels
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="font-mono text-amber-700 tabular-nums">
                    {unverifiedAvailableCount}
                  </strong>{' '}
                  unverified parcels
                </span>
                <span aria-hidden="true">·</span>
                <span>Any Web3 wallet supported at checkout</span>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <ParcelImage
                  src="/images/hero_lagos_land.jpg"
                  alt="Aerial view of surveyed land parcels in Lagos"
                  parcelReference="ANAGU-CADASTRE"
                  lga="Lagos State Pilot"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5">
                  <p className="text-xs font-mono text-emerald-200">
                    Deed Verification · OpenStreetMap Coordinates · Web3 Settlement
                  </p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    Transparent parcel status separating verified deeds from pending submissions
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="p-3.5">
                  <dt className="text-slate-500">Verified Land</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-emerald-700 tabular-nums">
                    {verifiedAvailableCount} Available
                  </dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-slate-500">Unverified Land</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-amber-700 tabular-nums">
                    {unverifiedAvailableCount} Available
                  </dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-slate-500">Checkout</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                    Any Web3 Wallet
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Core Platform Functions: Register Land & Access Land */}
        <section className="max-w-7xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <article className="bg-white border border-slate-200 rounded-lg p-7 flex flex-col justify-between gap-6">
              <div>
                <div className="text-xs font-mono font-semibold text-emerald-700 mb-2">
                  01. Register Land
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  Submit parcel information, land certificates &amp; map boundaries
                </h2>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                  Enter plot title, ownership type, survey plan details, USD asking price, and upload your land certificate or deed (SHA-256 sealed). Sync boundary coordinates directly on OpenStreetMap and bind your Web3 owner wallet.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <Link
                  href="/register-land"
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  Register Land
                </Link>
                <span className="text-xs text-slate-500">
                  Lists as unverified until deed check completes
                </span>
              </div>
            </article>

            <article className="bg-white border border-slate-200 rounded-lg p-7 flex flex-col justify-between gap-6">
              <div>
                <div className="text-xs font-mono font-semibold text-amber-700 mb-2">
                  02. Access Land
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  View verified &amp; unverified land parcels available to buy
                </h2>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                  Filter between <strong className="text-slate-900">Verified Land</strong> (administrator deed-cleared and spatially checked) and <strong className="text-slate-900">Unverified Land</strong> (newly submitted parcels under review). Inspect each plot and buy using MetaMask, Trust Wallet, Coinbase, Rabby, Rainbow, Phantom, OKX, or Registry Escrow.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <Link
                  href="/marketplace"
                  className="px-5 py-2.5 text-xs font-semibold text-slate-900 bg-amber-300 border border-amber-400 rounded-md hover:bg-amber-400 transition-colors whitespace-nowrap"
                >
                  Access Land
                </Link>
                <span className="text-xs text-slate-500 tabular-nums">
                  {availableListings.length} parcels total
                </span>
              </div>
            </article>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
