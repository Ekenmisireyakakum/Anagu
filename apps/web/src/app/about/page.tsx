import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 space-y-10">
        <div className="bg-white border border-slate-200 rounded-lg p-8">
          <p className="text-xs font-medium text-slate-500 mb-2">
            Institutional Background · Nigeria Land Use Act 1978
          </p>
          <h1 className="text-3xl font-bold text-slate-900">About the ANAGU Framework</h1>
          <p className="mt-4 text-sm text-slate-600 leading-relaxed">
            ANAGU is a permissioned blockchain and GIS-backed land administration platform engineered for Nigerian state land registries, beginning with a Lagos State cadastral pilot covering Victoria Island, Lekki, Ikeja, Surulere, and Yaba. It targets the primary causes of land disputes: duplicate parcel allocations, forged title instruments, unauthorized deed alterations, and opaque title revocations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900">Privacy & On-Chain Minimization</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Personal identity details, survey plans, and legal deeds remain off-chain in PostgreSQL/PostGIS and MinIO object storage. Only cryptographic hashes (`spatialHash`, `ownerReference`, `documentHash`) and immutable registry transaction references are written to the Hyperledger Besu ledger.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900">QBFT Consensus & Validator Governance</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              The underlying Hyperledger Besu network operates QBFT consensus with a 1-second block period and 30,000-block epoch length across state ministry, surveyor general, and judiciary validator nodes. Institutional validator weights are managed separately in `ValidatorRegistry.sol` because QBFT does not natively implement DPoS.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900">Registry-Locked ERC-721 Titles</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              `LandTitleNFT.sol` overrides standard ERC-721 transferability so holders cannot sell or transfer land titles directly on external NFT marketplaces. Every ownership change must pass through `LandRegistry.sol` under authorised `REGISTRAR_ROLE` approval.
            </p>
          </section>

          <section className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900">Statutory Legal Boundary</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              This software prototype demonstrates technical workflows aligned with Section 28 of the Land Use Act 1978. A digital NFT emitted by this prototype does not automatically constitute a statutory Certificate of Occupancy unless executed and gazetted under applicable state land law.
            </p>
          </section>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/how-it-works"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors"
          >
            Inspect Registration Workflow
          </Link>
          <Link
            href="/contact"
            className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Contact Registry Desk
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
