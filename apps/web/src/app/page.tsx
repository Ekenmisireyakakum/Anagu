import Link from 'next/link';
import MetaMaskConnectButton from '../components/MetaMaskConnectButton';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import ParcelImage from '../components/marketplace/ParcelImage';
import { listLandListings } from '../lib/anagu-store';

export const dynamic = 'force-dynamic';

const VERIFICATION_PILLARS = [
  {
    index: '01',
    title: 'GIS Spatial Verification',
    summary:
      'Validates submitted WGS 84 (EPSG:4326) parcel polygons against self-intersection and checks 0.5m tolerance boundaries against registered plots before progression.',
    detail: 'ST_IsValid · ST_Intersects · ST_Buffer',
  },
  {
    index: '02',
    title: 'Institutional & Community Oracle',
    summary:
      'Cross-references LASRECCA registry records with community council attestations. Community attestation alone never bypasses institutional ownership proof.',
    detail: 'VERIFIED · DISPUTED · INCONCLUSIVE',
  },
  {
    index: '03',
    title: 'Registry-Controlled NFT Titles',
    summary:
      'Issues ERC-721 digital land titles on Hyperledger Besu QBFT storing only cryptographic hashes on-chain while keeping sensitive PII and full deeds off-chain.',
    detail: 'LandTitleNFT.sol · LandRegistry.sol',
  },
  {
    index: '04',
    title: 'Statutory Section 28 Revocation',
    summary:
      'Enforces GOVERNOR_ROLE smart-contract and API authorization for revocations under the Nigeria Land Use Act 1978, permanently blocking future transfers.',
    detail: 'Overriding Public Interest · Breach of Condition',
  },
];

export default function HomePage() {
  const listings = listLandListings();
  const featuredListings = listings.slice(0, 3);
  const availableCount = listings.filter((l) => l.status === 'AVAILABLE').length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6">
              <p className="text-xs font-medium text-slate-500 mb-3">
                Lagos State Pilot Registry · Nigeria Land Use Act 1978
              </p>
              <h1 className="text-[clamp(2.25rem,4vw,3.5rem)] font-bold tracking-tight text-slate-900 leading-[1.1] max-w-2xl [text-wrap:balance]">
                Buy verified land or register your plot with MetaMask or Trust Wallet
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-xl">
                No account creation required. Browse verified Lagos State land parcels on OpenStreetMap, trigger MetaMask or Trust Wallet to acquire instant ERC-721 titles, or register your existing parcel coordinates and deeds directly.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/marketplace"
                  className="px-6 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  Buy Verified Land
                </Link>
                <Link
                  href="/register-land"
                  className="px-5 py-3 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  Register Land
                </Link>
                <MetaMaskConnectButton />
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
                <span>
                  <strong className="font-mono text-slate-900 tabular-nums">{availableCount}</strong> verified parcels ready to buy
                </span>
                <span aria-hidden="true">·</span>
                <span>MetaMask &amp; Trust Wallet supported</span>
                <span aria-hidden="true">·</span>
                <Link href="/map" className="font-medium text-emerald-700 hover:underline">
                  Explore OpenStreetMap cadastre →
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <ParcelImage
                  src="/images/hero_lagos_land.jpg"
                  alt="Aerial view of Lagos Victoria Island and Lekki coastal land parcels"
                  parcelReference="LAGOS-CADASTRE"
                  lga="Victoria Island & Lekki"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5">
                  <p className="text-xs font-mono text-emerald-200">
                    Victoria Island · Lekki · Ikoyi · Ikeja · Yaba · Surulere
                  </p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    Cadastral parcel verification backed by Hyperledger Besu &amp; Cloud Firestore
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="p-3.5">
                  <dt className="text-slate-500">Wallet Checkout</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                    MetaMask · Trust
                  </dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-slate-500">Spatial Ref</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                    OSM · EPSG:4326
                  </dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-slate-500">Settlement</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900 tabular-nums">
                    ERC-721 Title
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Two Core User Paths */}
        <section className="max-w-7xl mx-auto px-6 py-14">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-bold text-slate-900">
              Register land or buy verified parcels directly
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Skip account sign-up forms. Choose whether to acquire a cleared parcel with your Web3 wallet or register your own land plot on OpenStreetMap.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-lg p-7 flex flex-col justify-between gap-6">
              <div>
                <div className="text-xs font-mono font-semibold text-emerald-700 mb-2">
                  01. Buy Land
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Purchase verified Lagos plots via MetaMask or Trust Wallet
                </h3>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                  Inspect surveyed plots on OpenStreetMap across Eti-Osa, Ikeja, Ikoyi, Yaba, and Surulere. Trigger MetaMask or Trust Wallet at checkout to sign settlement and receive your ERC-721 digital title immediately.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/marketplace"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  Open Buy Land Marketplace
                </Link>
                <Link
                  href="/map"
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap"
                >
                  Inspect plots on OpenStreetMap →
                </Link>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-7 flex flex-col justify-between gap-6">
              <div>
                <div className="text-xs font-mono font-semibold text-emerald-700 mb-2">
                  02. Register Land
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Plot your boundary on OpenStreetMap &amp; register ownership
                </h3>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                  Click your plot location directly on OpenStreetMap, attach SHA-256 hashed deed PDFs, connect MetaMask or Trust Wallet, and submit your parcel straight into spatial overlap and title verification.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/register-land"
                  className="px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
                >
                  Register Your Land
                </Link>
                <Link
                  href="/dashboard?tab=titles"
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap"
                >
                  Inspect issued titles →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Verified Land Listings */}
        <section className="bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Available verified land parcels
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pre-surveyed Lagos State allocations ready for MetaMask or Trust Wallet purchase.
                </p>
              </div>
              <Link
                href="/marketplace"
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
              >
                View all {listings.length} parcels →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredListings.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                    <ParcelImage
                      src={item.imageUrl}
                      alt={item.title}
                      parcelReference={item.parcelReference}
                      lga={item.lga}
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {item.lga} · {item.zoning} · {item.areaSqm.toLocaleString()} m²
                        </span>
                        <span
                          className={`font-medium ${
                            item.status === 'AVAILABLE' ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {item.status === 'AVAILABLE' ? 'Available' : 'Acquired'}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-base font-semibold text-slate-900 leading-snug">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600 truncate">{item.address}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900 tabular-nums">
                          NGN {item.priceNgn.toLocaleString('en-NG')}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {item.priceEth} ETH · {item.parcelReference}
                        </div>
                      </div>
                      <Link
                        href={`/marketplace?parcel=${encodeURIComponent(item.parcelReference)}`}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
                      >
                        Buy with Wallet
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Core Verification Layers */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold text-slate-900">
                Four verification layers before title issuance
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                No land application can receive a digital title NFT until spatial geometry, ownership attestation, legal review, and registrar authorization all succeed.
              </p>
            </div>
            <Link
              href="/how-it-works"
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
            >
              Read workflow specification
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VERIFICATION_PILLARS.map((pillar) => (
              <article
                key={pillar.index}
                className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-mono text-emerald-700 font-semibold tabular-nums mb-2">
                    {pillar.index}. {pillar.title}
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{pillar.summary}</p>
                </div>
                <p className="mt-4 pt-3 border-t border-slate-100 text-xs font-mono text-slate-500">
                  {pillar.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Action Callout */}
        <section className="max-w-7xl mx-auto px-6">
          <div className="bg-white border border-slate-200 rounded-lg p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold text-slate-900">
                Start buying or registering land immediately
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Connect MetaMask or Trust Wallet to acquire listed parcels, register a new plot on OpenStreetMap, or inspect parcel boundaries on the GIS map.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href="/marketplace"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                Buy Land
              </Link>
              <Link
                href="/register-land"
                className="px-5 py-2.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Register Land
              </Link>
              <Link
                href="/map"
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                GIS Map
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
