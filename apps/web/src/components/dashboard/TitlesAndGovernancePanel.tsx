'use client';

import { useState } from 'react';
import type { DigitalLandTitle, RevocationGround, SafeUser } from './types';

interface TitlesAndGovernancePanelProps {
  user: SafeUser;
  titles: DigitalLandTitle[];
  onRefresh: () => Promise<void>;
}

export default function TitlesAndGovernancePanel({
  user,
  titles,
  onRefresh,
}: TitlesAndGovernancePanelProps) {
  const [transferTokenId, setTransferTokenId] = useState<number>(titles[0]?.tokenId || 1001);
  const [recipientEmail, setRecipientEmail] = useState('surveyor@anagu.gov.ng');
  const [revokeTokenId, setRevokeTokenId] = useState<number>(titles[0]?.tokenId || 1001);
  const [grounds, setGrounds] = useState<RevocationGround>('Overriding Public Interest');
  const [adminRef, setAdminRef] = useState('LASG-GAZ-2026-S28-014');
  const [justification, setJustification] = useState(
    'Public transit right-of-way expansion under Section 28(1) of the Land Use Act 1978.',
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleTransfer = async (bypassAttempt = false) => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/titles/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: Number(transferTokenId),
          newOwnerEmailOrId: recipientEmail,
          bypassAttempt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Transfer failed');
      setFeedback({
        type: 'ok',
        text: `Registry transfer executed: Token #${data.tokenId} transferred to ${data.ownerName} (tx ${data.txHash.slice(
          0,
          16,
        )}...).`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Transfer rejected',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/titles/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: Number(revokeTokenId),
          grounds,
          administrativeReference: adminRef,
          justification,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Revocation failed');
      setFeedback({
        type: 'ok',
        text: `Statutory revocation executed on Token #${data.tokenId} (${data.parcelReference}) under "${data.revocationGrounds}". Future transfers are permanently blocked.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Revocation blocked',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Registry-Controlled Ownership Transfer + Section 28 Revocation Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ownership Transfer */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Registry-Controlled Ownership Transfer
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              LandRegistry.sol restricts transfers exclusively to REGISTRAR_ROLE on active (non-revoked) NFTs.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Title Token ID</label>
              <select
                value={transferTokenId}
                onChange={(e) => setTransferTokenId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md bg-white"
              >
                {titles.map((t) => (
                  <option key={t.tokenId} value={t.tokenId}>
                    Token #{t.tokenId} · {t.parcelReference} ({t.isRevoked ? 'REVOKED' : t.ownerName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Recipient Account Email
              </label>
              <input
                type="text"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="e.g. surveyor@anagu.gov.ng or citizen@anagu.gov.ng"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy || titles.length === 0}
                onClick={() => handleTransfer(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
              >
                Execute Registrar Transfer
              </button>
              <button
                type="button"
                disabled={busy || titles.length === 0}
                onClick={() => handleTransfer(true)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 disabled:opacity-50"
              >
                Test Direct Owner Transfer Block
              </button>
            </div>
          </div>
        </div>

        {/* Section 28 Statutory Revocation */}
        <form onSubmit={handleRevoke} className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Section 28 Statutory Revocation (Land Use Act 1978)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Authorized exclusively for GOVERNOR_ROLE ({user.role === 'GOVERNOR' ? 'Current session authorized' : `Current role ${user.role} will be rejected with 403`}).
            </p>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Title Token ID</label>
                <select
                  value={revokeTokenId}
                  onChange={(e) => setRevokeTokenId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md bg-white"
                >
                  {titles.map((t) => (
                    <option key={t.tokenId} value={t.tokenId}>
                      Token #{t.tokenId} · {t.parcelReference} ({t.isRevoked ? 'REVOKED' : 'ACTIVE'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Statutory Ground</label>
                <select
                  value={grounds}
                  onChange={(e) => setGrounds(e.target.value as RevocationGround)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
                >
                  <option value="Overriding Public Interest">Overriding Public Interest</option>
                  <option value="Breach of Statutory Condition">Breach of Statutory Condition</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Administrative Gazette Reference
              </label>
              <input
                type="text"
                required
                value={adminRef}
                onChange={(e) => setAdminRef(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Statutory Notice & Legal Justification
              </label>
              <textarea
                rows={2}
                required
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <button
              type="submit"
              disabled={busy || titles.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800 disabled:opacity-50"
            >
              Execute Section 28 Revocation
            </button>
          </div>
        </form>
      </div>

      {/* Digital Land Titles Ledger */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Minted ERC-721 Land Title Certificates ({titles.length})
          </h3>
          <span className="text-xs font-mono text-slate-500">
            On-chain hashes only · Off-chain deeds & PII
          </span>
        </div>

        {titles.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No minted land titles visible for this account.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {titles.map((title) => (
              <div key={title.tokenId} className="p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                        Token #{title.tokenId} · {title.parcelReference}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-mono border rounded ${
                          title.isRevoked
                            ? 'bg-red-50 text-red-800 border-red-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}
                      >
                        {title.isRevoked ? 'REVOKED (SECTION 28)' : 'ACTIVE TITLE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      {title.address} · {title.lga}, {title.state} · {title.areaSqm.toLocaleString()} m²
                    </p>
                  </div>
                  <div className="text-right text-xs font-mono text-slate-600 tabular-nums">
                    <div>Block #{title.blockNumber}</div>
                    <div>Owner: {title.ownerName}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded p-3 text-slate-600">
                  <div className="truncate">Spatial Hash: {title.spatialHash}</div>
                  <div className="truncate">Owner Ref Hash: {title.ownerReferenceHash}</div>
                  <div className="truncate">Document Hash: {title.documentHash}</div>
                </div>

                {title.isRevoked && (
                  <div className="text-xs bg-red-50 border border-red-200 text-red-900 rounded p-3">
                    <span className="font-semibold">
                      Revoked on {title.revokedAt ? new Date(title.revokedAt).toLocaleString() : ''} by{' '}
                      {title.revokedByName}
                    </span>{' '}
                    · Ground: {title.revocationGrounds} · Gazette: {title.revocationReference}
                    <p className="mt-1">{title.revocationJustification}</p>
                  </div>
                )}

                <div className="text-xs">
                  <div className="font-semibold text-slate-700 mb-1">Chain of Title History</div>
                  <div className="space-y-1 font-mono text-[11px] text-slate-600">
                    {title.ownershipHistory.map((h, i) => (
                      <div key={`${h.txHash}-${i}`} className="flex flex-wrap justify-between gap-2">
                        <span>
                          [{h.action}] {h.toName} ({h.toAddress.slice(0, 12)}...)
                        </span>
                        <span className="tabular-nums text-slate-500">
                          {new Date(h.timestamp).toLocaleString()} · {h.txHash.slice(0, 14)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
