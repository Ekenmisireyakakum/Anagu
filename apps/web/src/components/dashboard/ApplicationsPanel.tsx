'use client';

import { useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { getPolygonExplorerTxUrl } from '../../lib/polygon-config';
import { getAuthHeaders } from '../../lib/client-auth';
import { useWallet } from '../WalletContext';
import type { LandApplicationRecord, SafeUser } from './types';

interface ApplicationsPanelProps {
  user: SafeUser;
  applications: LandApplicationRecord[];
  onRefresh: () => Promise<void>;
}

const STATUS_STYLE: Record<string, string> = {
  REGISTERED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PENDING_REGISTRAR_APPROVAL: 'bg-blue-50 text-blue-800 border-blue-200',
  PENDING_LEGAL_VERIFICATION: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  UNDER_SPATIAL_REVIEW: 'bg-amber-50 text-amber-800 border-amber-200',
  UNDER_OWNERSHIP_VERIFICATION: 'bg-orange-50 text-orange-800 border-orange-200',
  SUBMITTED: 'bg-slate-100 text-slate-700 border-slate-300',
  REJECTED: 'bg-red-50 text-red-800 border-red-200',
  REVOKED: 'bg-red-50 text-red-900 border-red-300',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function ApplicationsPanel({
  user,
  applications,
  onRefresh,
}: ApplicationsPanelProps) {
  const wallet = useWallet();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string>(applications[0]?.id || '');
  const [actionNotes, setActionNotes] = useState('');
  const [signWithMetaMask, setSignWithMetaMask] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.parcelReference.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q) ||
        a.lga.toLowerCase().includes(q) ||
        a.applicantName.toLowerCase().includes(q)
      );
    });
  }, [applications, search, statusFilter]);

  const selected = useMemo(
    () => filtered.find((a) => a.id === selectedId) || filtered[0] || null,
    [filtered, selectedId],
  );

  const runAction = async (
    action:
      | 'RUN_SPATIAL'
      | 'SUBMIT_SURVEY_REPORT'
      | 'RUN_ORACLE'
      | 'COMPLETE_LEGAL_REVIEW'
      | 'APPROVE_AND_MINT'
      | 'VERIFY_AND_PUBLISH'
      | 'REJECT'
      | 'CANCEL',
  ) => {
    if (!selected) return;
    setBusyAction(action);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = {};
      if (action === 'SUBMIT_SURVEY_REPORT') {
        payload.findings =
          actionNotes.trim() || 'WGS 84 boundary beacons verified with zero parcel overlap.';
        payload.boundaryConfirmed = true;
      } else if (action === 'COMPLETE_LEGAL_REVIEW') {
        payload.legalNotes =
          actionNotes.trim() || 'Statutory root of title and survey instrument confirmed.';
      } else if (action === 'VERIFY_AND_PUBLISH') {
        payload.registrarNotes =
          actionNotes.trim() || 'Deed verified by Administrator and published as Verified on Access Land.';
      } else if (action === 'APPROVE_AND_MINT' || action === 'REJECT') {
        payload.registrarNotes =
          actionNotes.trim() ||
          (action === 'APPROVE_AND_MINT'
            ? 'Approved by Registrar for Polygon ERC-721 title minting.'
            : 'Rejected during statutory review.');

        if (action === 'APPROVE_AND_MINT' && wallet.isConnected && signWithMetaMask) {
          const docConcat = selected.documents.map((d) => d.sha256Hash).join(':');
          payload.walletProof = await wallet.authorizeRegistryAction({
            kind: 'REGISTER_LAND',
            parcelReference: selected.parcelReference,
            ownerAddress: user.walletAddress,
            spatialHash: ethers.keccak256(ethers.toUtf8Bytes(selected.wkt)),
            ownerReferenceHash: ethers.keccak256(ethers.toUtf8Bytes(selected.applicantId)),
            documentHash: ethers.keccak256(ethers.toUtf8Bytes(docConcat)),
            actorRole: user.role,
          });
        }
      }

      const res = await fetch(`/api/applications/${selected.id}/action`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Action ${action} failed`);
      }
      setActionNotes('');
      setFeedback({
        type: 'ok',
        text: `Action ${action} completed. Application ${data.parcelReference} is now ${data.status}${
          data.tokenId ? ` (Token #${data.tokenId})` : ''
        }.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Workflow action failed',
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-3 flex-col sm:flex-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parcel reference, LGA, address, or applicant..."
            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            <option value="ALL">All Statuses ({applications.length})</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="UNDER_SPATIAL_REVIEW">UNDER_SPATIAL_REVIEW</option>
            <option value="UNDER_OWNERSHIP_VERIFICATION">UNDER_OWNERSHIP_VERIFICATION</option>
            <option value="PENDING_LEGAL_VERIFICATION">PENDING_LEGAL_VERIFICATION</option>
            <option value="PENDING_REGISTRAR_APPROVAL">PENDING_REGISTRAR_APPROVAL</option>
            <option value="REGISTERED">REGISTERED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="REVOKED">REVOKED</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => onRefresh()}
          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
        >
          Refresh Queue
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-md border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Applications Queue List */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Registration Queue ({filtered.length})
            </h2>
            <span className="text-xs font-mono text-slate-500">
              Scope: {user.role === 'CITIZEN' ? 'Own Submissions' : 'Registry-Wide'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              No land applications match your current filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
              {filtered.map((app) => {
                const isSelected = selected?.id === app.id;
                const style = STATUS_STYLE[app.status] || STATUS_STYLE.SUBMITTED;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedId(app.id)}
                    className={`w-full text-left px-4 py-3.5 transition-colors hover:bg-slate-50 ${
                      isSelected ? 'bg-emerald-50/60' : 'bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                        {app.parcelReference}
                      </span>
                      <span className={`px-2 py-0.5 text-[11px] font-mono border rounded ${style}`}>
                        {app.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 truncate">{app.address}</p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500 font-mono tabular-nums">
                      <span>{app.lga}, {app.state}</span>
                      <span>
                        {app.spatialVerification ? `${app.spatialVerification.areaSqm.toLocaleString()} m²` : 'Spatial pending'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Application Dossier */}
        <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg min-w-0">
          {!selected ? (
            <div className="p-6 sm:p-8 text-sm text-slate-500">
              Select an application from the queue to inspect verification gates and execute actions.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {/* Header */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                      {selected.parcelReference}
                    </h3>
                    {selected.parcelTitle && (
                      <span className="text-sm font-semibold text-slate-800">
                        · {selected.parcelTitle}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 text-xs font-mono border rounded ${
                        STATUS_STYLE[selected.status] || STATUS_STYLE.SUBMITTED
                      }`}
                    >
                      {selected.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {selected.address} · {selected.lga}, {selected.state}
                  </p>
                  <p className="text-xs font-mono text-slate-500 mt-1 tabular-nums">
                    ID: {selected.id} · Claimant: {selected.claimantName} · Applicant: {selected.applicantName} ({selected.applicantEmail})
                  </p>
                  {(selected.priceUsd ||
                    selected.ownershipType ||
                    selected.surveyPlanNumber ||
                    selected.deedReference) && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-amber-50/70 border border-amber-200 rounded-md p-2.5">
                      {selected.priceUsd ? (
                        <div>
                          <span className="text-slate-500 block">Asking Price</span>
                          <span className="font-mono font-bold text-slate-900">
                            ${selected.priceUsd.toLocaleString()} USD
                            {selected.priceEth ? ` (${selected.priceEth} ETH)` : ''}
                          </span>
                        </div>
                      ) : null}
                      {selected.ownershipType && (
                        <div>
                          <span className="text-slate-500 block">Ownership</span>
                          <span className="font-medium text-slate-900">{selected.ownershipType}</span>
                        </div>
                      )}
                      {selected.surveyPlanNumber && (
                        <div>
                          <span className="text-slate-500 block">Survey Plan</span>
                          <span className="font-mono text-slate-900">{selected.surveyPlanNumber}</span>
                        </div>
                      )}
                      {selected.deedReference && (
                        <div>
                          <span className="text-slate-500 block">Deed / C of O</span>
                          <span className="font-mono text-slate-900">{selected.deedReference}</span>
                        </div>
                      )}
                      {selected.beaconNumbers && (
                        <div>
                          <span className="text-slate-500 block">Beacons</span>
                          <span className="font-mono text-slate-900">{selected.beaconNumbers}</span>
                        </div>
                      )}
                      {selected.encumbranceStatus && (
                        <div>
                          <span className="text-slate-500 block">Encumbrances</span>
                          <span className="text-slate-900">{selected.encumbranceStatus}</span>
                        </div>
                      )}
                      {selected.zoning && (
                        <div>
                          <span className="text-slate-500 block">Zoning</span>
                          <span className="text-slate-900">{selected.zoning}</span>
                        </div>
                      )}
                      {selected.saleTerms && (
                        <div className="col-span-2 sm:col-span-4">
                          <span className="text-slate-500 block">Listing Headline / Sale Terms</span>
                          <span className="text-slate-800">
                            {selected.listingHeadline ? `${selected.listingHeadline} — ` : ''}
                            {selected.saleTerms}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selected.tokenId !== null && (
                  <div className="sm:text-right shrink-0">
                    <div className="text-xs text-slate-500">ERC-721 Title Issued</div>
                    <div className="text-base font-bold font-mono text-emerald-700 tabular-nums">
                      Token #{selected.tokenId}
                    </div>
                  </div>
                )}
              </div>

              {/* Gate 1: Spatial Geometry */}
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    1. GIS Spatial Verification (WGS 84 / 0.5m Overlap Tolerance)
                  </h4>
                  <span
                    className={`text-xs font-mono font-semibold ${
                      selected.spatialVerification?.passed ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {selected.spatialVerification
                      ? selected.spatialVerification.passed
                        ? 'PASSED'
                        : 'FAILED'
                      : 'NOT RUN'}
                  </span>
                </div>
                {selected.spatialVerification ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 border border-slate-200 rounded p-3">
                    <div>
                      <span className="text-slate-500 block">Area</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {selected.spatialVerification.areaSqm.toLocaleString()} m²
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Valid / Self-Int.</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {selected.spatialVerification.isValidGeometry ? 'Valid' : 'Invalid'} /{' '}
                        {selected.spatialVerification.isSelfIntersecting ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Overlap Detected</span>
                      <span
                        className={`font-mono font-semibold ${
                          selected.spatialVerification.overlapDetected ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {selected.spatialVerification.overlapDetected
                          ? `YES (${selected.spatialVerification.overlappingParcels
                              .map((p) => p.parcelNumber)
                              .join(', ')})`
                          : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Centroid</span>
                      <span className="font-mono text-slate-900 tabular-nums">
                        {selected.spatialVerification.centroid.lat.toFixed(4)},{' '}
                        {selected.spatialVerification.centroid.lon.toFixed(4)}
                      </span>
                    </div>
                    {selected.spatialVerification.errorDetails && (
                      <div className="col-span-2 sm:col-span-4 text-red-700 font-medium">
                        {selected.spatialVerification.errorDetails}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Spatial verification has not been executed yet.</p>
                )}
                <p className="mt-2 text-[11px] font-mono text-slate-500 break-all">
                  WKT: {selected.wkt}
                </p>
              </div>

              {/* Gate 2: Surveyor Report & Oracle */}
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">
                    2. Licensed Surveyor Report
                  </h4>
                  {selected.surveyReport ? (
                    <div className="text-xs text-slate-700 space-y-1">
                      <p className="font-semibold text-slate-900">{selected.surveyReport.surveyorName}</p>
                      <p>{selected.surveyReport.findings}</p>
                      <p className="font-mono text-slate-500 tabular-nums">
                        Boundary Confirmed: {selected.surveyReport.boundaryConfirmed ? 'YES' : 'NO'} ·{' '}
                        {new Date(selected.surveyReport.submittedAt).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Pending licensed surveyor boundary report.</p>
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2">
                    3. Ownership Verification Oracle
                  </h4>
                  {selected.oracleVerification ? (
                    <div className="text-xs text-slate-700 space-y-1">
                      <p className="font-mono font-semibold text-slate-900">
                        Outcome: {selected.oracleVerification.overallOutcome}
                      </p>
                      <p>
                        Institutional (LASRECCA):{' '}
                        <span className="font-mono">
                          {selected.oracleVerification.institutionalVerified ? 'VERIFIED' : 'CONFLICT'}
                        </span>
                      </p>
                      <p>
                        Community Attestation:{' '}
                        <span className="font-mono">
                          {selected.oracleVerification.communityVerified ? 'VERIFIED' : 'MISSING'}
                        </span>
                      </p>
                      <p className="text-slate-600">{selected.oracleVerification.notes}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Oracle runs automatically upon Survey Report clearance or Registrar trigger.
                    </p>
                  )}
                </div>
              </div>

              {/* Gate 3: Supporting Documents & Legal Verification */}
              <div className="p-5 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  4. Cryptographic Documents & Legal Sign-Off
                </h4>
                <div className="space-y-1.5">
                  {selected.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2"
                    >
                      <span className="font-medium text-slate-900 flex flex-wrap items-center gap-1.5">
                        {doc.category && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200 rounded">
                            {doc.category}
                          </span>
                        )}
                        <span>
                          {doc.fileName} ({Math.round(doc.fileSizeBytes / 1024)} KB)
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs">
                        SHA-256: {doc.sha256Hash}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-600">
                  Legal Review:{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {selected.legalVerified
                      ? `CLEARED by ${selected.legalOfficerName}`
                      : 'PENDING REGISTRAR LEGAL REVIEW'}
                  </span>
                  {selected.legalNotes && <span className="block mt-0.5">{selected.legalNotes}</span>}
                </div>
                {selected.txHash && (
                  <div className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-3 py-2 break-all flex flex-wrap items-center justify-between gap-2">
                    <span>Polygon Tx: {selected.txHash}</span>
                    {/^0x[0-9a-fA-F]{64}$/.test(selected.txHash) && (
                      <a
                        href={getPolygonExplorerTxUrl(selected.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans font-semibold underline shrink-0"
                      >
                        View on Polygonscan →
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Role Action Controls */}
              <div className="p-5 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Workflow Actions (Enforced Server-Side for {user.role})
                  </h4>
                  {user.role === 'REGISTRAR' && wallet.isConnected && (
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={signWithMetaMask}
                        onChange={(e) => setSignWithMetaMask(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                      />
                      Sign Mint with MetaMask ({wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)})
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder="Optional survey findings, legal notes, or registrar decision remarks..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <div className="flex flex-wrap gap-2">
                  {(user.role === 'SURVEYOR' || user.role === 'LAND_ADMINISTRATOR') && (
                    <button
                      type="button"
                      disabled={!!busyAction}
                      onClick={() => runAction('RUN_SPATIAL')}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50"
                    >
                      Re-run Spatial Check
                    </button>
                  )}
                  {user.role === 'SURVEYOR' && selected.status !== 'REGISTERED' && (
                    <button
                      type="button"
                      disabled={!!busyAction}
                      onClick={() => runAction('SUBMIT_SURVEY_REPORT')}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
                    >
                      Submit Survey Report & Run Oracle
                    </button>
                  )}
                  {(user.role === 'REGISTRAR' || user.role === 'LAND_ADMINISTRATOR') &&
                    selected.status !== 'REGISTERED' && (
                      <>
                        <button
                          type="button"
                          disabled={!!busyAction}
                          onClick={() => runAction('RUN_ORACLE')}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50"
                        >
                          Re-run Ownership Oracle
                        </button>
                        <button
                          type="button"
                          disabled={!!busyAction}
                          onClick={() => runAction('VERIFY_AND_PUBLISH')}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-amber-300 border border-amber-400 rounded-md hover:bg-amber-400 disabled:opacity-50"
                        >
                          Verify Deed &amp; Publish to Access Land
                        </button>
                      </>
                    )}
                  {user.role === 'REGISTRAR' && selected.status !== 'REGISTERED' && (
                    <>
                      <button
                        type="button"
                        disabled={!!busyAction}
                        onClick={() => runAction('COMPLETE_LEGAL_REVIEW')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded-md hover:bg-slate-900 disabled:opacity-50"
                      >
                        Complete Legal Verification
                      </button>
                      <button
                        type="button"
                        disabled={!!busyAction}
                        onClick={() => runAction('APPROVE_AND_MINT')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
                      >
                        Approve & Mint ERC-721 Title
                      </button>
                    </>
                  )}
                  {(user.role === 'SURVEYOR' ||
                    user.role === 'REGISTRAR' ||
                    user.role === 'LAND_ADMINISTRATOR') &&
                    selected.status !== 'REGISTERED' &&
                    selected.status !== 'REJECTED' && (
                      <button
                        type="button"
                        disabled={!!busyAction}
                        onClick={() => runAction('REJECT')}
                        className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject Application
                      </button>
                    )}
                  {(user.id === selected.applicantId || user.role === 'LAND_ADMINISTRATOR') &&
                    selected.status !== 'REGISTERED' &&
                    selected.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        disabled={!!busyAction}
                        onClick={() => runAction('CANCEL')}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50"
                      >
                        Cancel Draft/Application
                      </button>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
