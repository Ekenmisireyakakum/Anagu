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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 min-w-0">
              <p className="text-xs font-mono font-semibold text-emerald-700 mb-3">
                GIS Land Mapping · Polygon ERC-721 &amp; ERC-20 Registry
              </p>
              <h1 className="text-[clamp(1.85rem,4vw,3.35rem)] font-bold tracking-tight text-slate-900 leading-[1.12] max-w-2xl [text-wrap:balance]">
                Mark your land on the map and register ownership in minutes
              </h1>
              <p className="mt-4 sm:mt-5 text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                ANAGU makes GIS land mapping effortless for everyone. Search any address or mark out your plot corners right on the map, sign up simply with email or your Web3 wallet, and settle verified parcels on Polygon using ERC-721 titles and ERC-20 tokens.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
                <Link
                  href="/register-land"
                  className="px-6 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap text-center"
                >
                  Map &amp; Register Land
                </Link>
                <Link
                  href="/marketplace"
                  className="px-6 py-3 text-sm font-semibold text-slate-900 bg-amber-300 border border-amber-400 rounded-md hover:bg-amber-400 transition-colors whitespace-nowrap text-center"
                >
                  Access Land
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap text-center"
                >
                  Wallet / Account Sign Up
                </Link>
              </div>

              <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-3">
                <MetaMaskConnectButton className="w-full sm:w-auto" />
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
                  pending parcels
                </span>
                <span aria-hidden="true">·</span>
                <span>Polygon ERC-721 + ERC-20 Dual Token</span>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4 min-w-0">
              <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <ParcelImage
                  src="/images/hero_lagos_land.jpg"
                  alt="Aerial GIS view of mapped land parcels"
                  parcelReference="ANAGU-GIS"
                  lga="Interactive GIS Cadastre"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3.5 sm:p-5">
                  <p className="text-[11px] sm:text-xs font-mono text-emerald-200">
                    Interactive GIS Mapping · Simple Registration · Polygon Settlement
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                    Enter your location or draw parcel boundaries directly on the live map
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="p-3.5">
                  <dt className="text-slate-500">GIS Mapping</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-emerald-700">
                    Address &amp; Draw
                  </dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-slate-500">Smart Contracts</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-purple-800">
                    Polygon ERC-721/20
                  </dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-slate-500">Sign Up</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                    Email or Wallet
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Core Platform Functions */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <article className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="text-xs font-mono font-semibold text-emerald-700 mb-2">
                  01. GIS Location Mapping
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Enter your location or draw corners on the map
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Type any street, city, or GPS coordinates—or click corners directly on OpenStreetMap—to mark out your land effortlessly. No technical survey jargon needed.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <Link
                  href="/register-land"
                  className="inline-flex px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors"
                >
                  Map &amp; Register Land →
                </Link>
              </div>
            </article>

            <article className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="text-xs font-mono font-semibold text-amber-700 mb-2">
                  02. Simple Wallet Sign-Up
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Create an account in one click with your wallet
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Sign up with a simple email and password or connect MetaMask, Trust Wallet, or any Web3 wallet to auto-fill your address, network, and balance details.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <Link
                  href="/register"
                  className="inline-flex px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors"
                >
                  Create Account / Wallet Sign Up →
                </Link>
              </div>
            </article>

            <article className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="text-xs font-mono font-semibold text-purple-700 mb-2">
                  03. Access Land (Polygon)
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Browse verified parcels with ERC-721 &amp; ERC-20 support
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Inspect GIS-mapped land parcels approved by Admin governance and acquire digital ERC-721 land titles on Polygon using Web3 wallets or ERC-20 settlement.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <Link
                  href="/marketplace"
                  className="inline-flex px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-300 border border-amber-400 rounded-md hover:bg-amber-400 transition-colors"
                >
                  Access Land →
                </Link>
                <span className="text-xs text-slate-500 tabular-nums">
                  {availableListings.length} available
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
