import Link from 'next/link';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

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

const WORKFLOW_STEPS = [
  { step: '01', actor: 'Citizen', label: 'Account Registration & Application Submission', detail: 'Applicant submits parcel coordinates, claimant identity reference, and SHA-256 hashed supporting documents.' },
  { step: '02', actor: 'GIS Engine', label: 'Automated Spatial Boundary Verification', detail: 'System converts coordinates into WGS 84 polygons, detects self-intersections, and checks overlaps within 0.5m.' },
  { step: '03', actor: 'Surveyor', label: 'Licensed Boundary Review & Survey Report', detail: 'Surveyor inspects GIS geometry results on the interactive map and files a signed confirmation report.' },
  { step: '04', actor: 'Oracle', label: 'Institutional & Community Ownership Check', detail: 'Oracle queries institutional registry records and community witness attestations before advancing.' },
  { step: '05', actor: 'Registrar', label: 'Legal Verification & Statutory Approval', detail: 'Registrar verifies legal standing, approves registration, and triggers Besu smart-contract execution.' },
  { step: '06', actor: 'Besu + MQTT', label: 'ERC-721 Title Minting & Real-Time Sync', detail: 'NFT title is minted, persisted to the land registry, and broadcast via MQTT QoS 1 notifications.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <p className="text-xs font-medium text-slate-500 mb-3">
                Lagos State Pilot Framework · Nigeria Land Use Act 1978
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight max-w-2xl [text-wrap:balance]">
                Tamper-evident land title administration and spatial verification
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-2xl">
                ANAGU integrates PostGIS boundary verification, dual institutional and community ownership oracles, permissioned Hyperledger Besu ERC-721 titles, and statutory Governor revocation into one auditable registry workflow.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="px-6 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
                >
                  Open Registry Console
                </Link>
                <Link
                  href="/map"
                  className="px-6 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  Open Interactive GIS Map
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-200">
                Framework Architecture Summary
              </h2>
              <dl className="divide-y divide-slate-200 text-sm mt-1">
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Consensus Network</dt>
                  <dd className="font-mono text-xs text-slate-900 tabular-nums">Hyperledger Besu QBFT · 1s</dd>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Coordinate Reference</dt>
                  <dd className="font-mono text-xs text-slate-900 tabular-nums">WGS 84 (EPSG:4326) · 0.5m</dd>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Title Standard</dt>
                  <dd className="font-mono text-xs text-slate-900">ERC-721 (Registry-Locked)</dd>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Messaging & Offline Sync</dt>
                  <dd className="font-mono text-xs text-slate-900">MQTT QoS 1 · Idempotent</dd>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Statutory Roles</dt>
                  <dd className="font-mono text-xs text-slate-900 tabular-nums">5 RBAC Authority Tiers</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Core Pillars */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl font-bold text-slate-900">
              Four verification layers before title issuance
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              No land application can receive a digital title NFT until spatial geometry, ownership attestation, legal review, and registrar authorization all succeed.
            </p>
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

        {/* Lifecycle Sequence */}
        <section className="bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  End-to-end registration workflow
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Every transition is role-gated on the backend and recorded in an immutable audit log.
                </p>
              </div>
              <Link
                href="/how-it-works"
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
              >
                Read full workflow specification
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {WORKFLOW_STEPS.map((item) => (
                <div key={item.step} className="border border-slate-200 rounded-lg p-5 bg-slate-50">
                  <div className="text-xs text-slate-500 font-mono tabular-nums mb-1.5">
                    Step {item.step} · {item.actor}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{item.label}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Evaluation Callout */}
        <section className="max-w-7xl mx-auto px-6 pt-16">
          <div className="bg-white border border-slate-200 rounded-lg p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold text-slate-900">
                Benchmark ANAGU against conventional manual land registration
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Run live fraud detection trials across four attack vectors, inspect measured processing latency distributions, and compare hash-only on-chain storage against full-geometry baselines.
              </p>
            </div>
            <Link
              href="/evaluation"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Run Evaluation Suite
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
