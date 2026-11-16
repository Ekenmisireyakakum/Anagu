import Link from 'next/link';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

const STAGES = [
  {
    num: '01',
    role: 'Citizen / Land Applicant',
    title: 'Account Registration & Application Submission',
    description:
      'Applicant creates an account, uploads supporting documents (PDF, PNG, JPEG up to 10 MB hashed via SHA-256), and submits WGS 84 parcel boundary coordinates. When offline, submissions queue locally with an idempotency key and sync automatically on reconnection.',
    gate: 'File type/size validation · Idempotency control',
  },
  {
    num: '02',
    role: 'GIS Engine & Licensed Surveyor',
    title: 'PostGIS Spatial Verification & Survey Report',
    description:
      'Coordinates are converted to EPSG:4326 polygons and validated with ST_IsValid() and ST_Intersects() against ST_Buffer(..., 0.5m). Self-intersecting or overlapping parcels are blocked from advancing until corrected and confirmed by a Surveyor.',
    gate: 'Blocks progression if geometry invalid or overlap detected',
  },
  {
    num: '03',
    role: 'Ownership Verification Oracle',
    title: 'Institutional Registry & Community Attestation',
    description:
      'The NestJS Oracle cross-checks institutional land records (LASRECCA) alongside community council witness attestations. Outcomes classify into VERIFIED, DISPUTED, INCONCLUSIVE, or PENDING. Community attestation alone never constitutes legal ownership.',
    gate: 'Requires both institutional and community confirmation',
  },
  {
    num: '04',
    role: 'Registrar',
    title: 'Legal Verification, Approval & Besu NFT Minting',
    description:
      'The Registrar reviews spatial, oracle, and legal documentation, approves the application (blocking self-approval), and triggers LandRegistry.registerLand() to mint an ERC-721 LandTitleNFT on Hyperledger Besu and broadcast an MQTT QoS 1 notification.',
    gate: 'REGISTRAR_ROLE · Prevents minting prior to all gates',
  },
  {
    num: '05',
    role: 'Governor (Land Use Act 1978, Sec. 28)',
    title: 'Statutory Title Revocation',
    description:
      'Exclusively authorised GOVERNOR_ROLE accounts can revoke an issued title under Overriding Public Interest or Breach of Statutory Condition with administrative gazette references. Revocation updates PostgreSQL/GIS status, emits TitleRevoked, and permanently blocks transfers while preserving audit history.',
    gate: 'GOVERNOR_ROLE strictly enforced on API & smart contract',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs font-medium text-slate-500 mb-2">
            Workflow Specification · End-to-End Lifecycle
          </p>
          <h1 className="text-3xl font-bold text-slate-900">How ANAGU Processes Land Titles</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl">
            Every application passes through sequential spatial, community, institutional, legal, and blockchain gates enforced by backend role-based access control.
          </p>
        </div>

        <div className="space-y-4">
          {STAGES.map((stage) => (
            <div
              key={stage.num}
              className="bg-white border border-slate-200 rounded-lg p-6"
            >
              <div className="text-xs font-mono text-emerald-700 font-semibold tabular-nums">
                Stage {stage.num} · {stage.role}
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mt-1">{stage.title}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{stage.description}</p>
              <p className="mt-3 pt-3 border-t border-slate-100 text-xs font-mono text-slate-500">
                Enforcement Gate: {stage.gate}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/login"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors"
          >
            Sign In to Test Workflow
          </Link>
          <Link
            href="/map"
            className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
          >
            Open GIS Map
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
