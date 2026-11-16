'use client';

import { useEffect, useState } from 'react';
import { useFirebase } from '../FirebaseContext';
import { useWallet } from '../WalletContext';
import OsmParcelMap from '../map/OsmParcelMap';
import type { OfflineQueuedApplication, SafeUser } from './types';

interface SubmitApplicationPanelProps {
  user?: SafeUser | null;
  onSubmitted: () => Promise<void>;
}

interface AttachedFileMeta {
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  sha256Hash: string;
}

const OFFLINE_STORAGE_KEY = 'anagu_offline_queue';

const PRESETS = [
  {
    id: 'valid',
    label: 'Valid Non-Overlapping Plot (Lekki Phase 1)',
    parcelReference: `LG-LK-${Math.floor(200 + Math.random() * 700)}`,
    lga: 'Eti-Osa',
    address: 'Plot 19, Admiralty Road, Lekki Phase 1',
    wkt: 'POLYGON((3.4710 6.4460, 3.4724 6.4460, 3.4724 6.4450, 3.4710 6.4450, 3.4710 6.4460))',
  },
  {
    id: 'overlap',
    label: 'Duplicate Overlap Plot (Overlaps LG-VI-001)',
    parcelReference: 'LG-VI-OVERLAP-99',
    lga: 'Eti-Osa',
    address: '15A Akin Adesola Street (Encroachment Test)',
    wkt: 'POLYGON((3.4203 6.4288, 3.4214 6.4288, 3.4214 6.4281, 3.4203 6.4281, 3.4203 6.4288))',
  },
  {
    id: 'disputed',
    label: 'Institutional Conflict (-DISPUTED)',
    parcelReference: 'LG-IK-310-DISPUTED',
    lga: 'Ikeja',
    address: '310 Oba Akran Avenue, Ikeja',
    wkt: 'POLYGON((3.3380 6.6060, 3.3392 6.6060, 3.3392 6.6050, 3.3380 6.6050, 3.3380 6.6060))',
  },
  {
    id: 'noattest',
    label: 'Missing Community Attestation (-NOATTEST)',
    parcelReference: 'LG-AL-412-NOATTEST',
    lga: 'Alimosho',
    address: '412 Ipaja Road, Alimosho',
    wkt: 'POLYGON((3.2780 6.6180, 3.2794 6.6180, 3.2794 6.6170, 3.2780 6.6170, 3.2780 6.6180))',
  },
];

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function SubmitApplicationPanel({
  user = null,
  onSubmitted,
}: SubmitApplicationPanelProps) {
  const firebase = useFirebase();
  const wallet = useWallet();
  const [parcelReference, setParcelReference] = useState('LG-LK-209');
  const [stateName, setStateName] = useState('Lagos');
  const [lga, setLga] = useState('Eti-Osa');
  const [address, setAddress] = useState('Plot 19, Admiralty Road, Lekki Phase 1');
  const [claimantName, setClaimantName] = useState(user?.fullName || 'Lagos Landowner');
  const [nationalId, setNationalId] = useState('NIN-29384710293');
  const [wkt, setWkt] = useState(PRESETS[0].wkt);
  const [documents, setDocuments] = useState<AttachedFileMeta[]>([]);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedApplication[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user?.fullName) {
      setClaimantName(user.fullName);
    }
  }, [user?.fullName]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_STORAGE_KEY);
      if (saved) setOfflineQueue(JSON.parse(saved));
    } catch {
      // Ignore storage read issues
    }
    if (typeof window !== 'undefined') {
      const wktParam = new URLSearchParams(window.location.search).get('wkt');
      if (wktParam && wktParam.trim().toUpperCase().startsWith('POLYGON')) {
        setWkt(wktParam.trim());
      }
    }
  }, []);

  const persistQueue = (items: OfflineQueuedApplication[]) => {
    setOfflineQueue(items);
    try {
      localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore quota errors
    }
  };

  const applyPreset = (presetId: string) => {
    const found = PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setParcelReference(found.parcelReference);
    setLga(found.lga);
    setAddress(found.address);
    setWkt(found.wkt);
    setFeedback(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setFeedback(null);
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const parsed: AttachedFileMeta[] = [];

    for (const file of Array.from(files)) {
      if (!allowed.includes(file.type)) {
        setFeedback({
          type: 'err',
          text: `Rejected "${file.name}": only PDF, PNG, and JPEG files are permitted.`,
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024 || file.size <= 0) {
        setFeedback({
          type: 'err',
          text: `Rejected "${file.name}": file size must be between 1 B and 10 MB.`,
        });
        return;
      }
      const buf = await file.arrayBuffer();
      const sha256Hash = await sha256Hex(buf);
      parsed.push({
        fileName: file.name,
        fileType: file.type,
        fileSizeBytes: file.size,
        sha256Hash,
      });
    }
    setDocuments((prev) => [...prev, ...parsed]);
  };

  const attachSampleDeed = async () => {
    const content = `ANAGU Sample Survey & Deed Instrument for ${parcelReference} submitted by ${claimantName} at ${new Date().toISOString()}`;
    const bytes = new TextEncoder().encode(content);
    const sha256Hash = await sha256Hex(bytes.buffer);
    setDocuments((prev) => [
      ...prev,
      {
        fileName: `Survey_Deed_${parcelReference.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`,
        fileType: 'application/pdf',
        fileSizeBytes: bytes.byteLength + 24500,
        sha256Hash,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (documents.length === 0) {
      setFeedback({
        type: 'err',
        text: 'Attach at least one supporting deed or survey plan (PDF, PNG, or JPEG) before submitting.',
      });
      return;
    }

    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `idemp-${Date.now()}`;

    const payload = {
      parcelReference,
      state: stateName,
      lga,
      address,
      wkt,
      claimantName,
      nationalId,
      walletAddress: wallet.address || undefined,
      documents,
      idempotencyKey,
    };

    if (offlineMode) {
      const queuedItem: OfflineQueuedApplication = {
        idempotencyKey,
        queuedAt: new Date().toISOString(),
        payload,
      };
      persistQueue([queuedItem, ...offlineQueue]);
      setFeedback({
        type: 'ok',
        text: `Offline mode active: saved ${parcelReference} locally with idempotency key ${idempotencyKey.slice(
          0,
          12,
        )}... Reconnect to sync.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');
      if (firebase.firebaseUser && data.application) {
        await firebase.syncApplication(data.application).catch(() => {});
      }
      const spatialPassed = data.application?.spatialVerification?.passed;
      setFeedback({
        type: 'ok',
        text: `Application submitted for ${parcelReference} (Status: ${
          data.application?.status
        }). Automated GIS spatial check ${spatialPassed ? 'PASSED' : 'FLAGGED OVERLAP/INVALIDITY'}.`,
      });
      setDocuments([]);
      await onSubmitted();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to submit application',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const syncOfflineQueue = async (keepCopyToTestDedup = false) => {
    if (offlineQueue.length === 0) return;
    setSyncing(true);
    setFeedback(null);
    let syncedCount = 0;
    let dedupCount = 0;
    const remaining: OfflineQueuedApplication[] = [];

    for (const item of offlineQueue) {
      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });
        const data = await res.json();
        if (!res.ok) {
          remaining.push(item);
        } else {
          if (firebase.firebaseUser && data.application && !data.deduplicated) {
            await firebase.syncApplication(data.application).catch(() => {});
          }
          if (data.deduplicated) dedupCount++;
          else syncedCount++;
          if (keepCopyToTestDedup) remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    persistQueue(remaining);
    setFeedback({
      type: 'ok',
      text: `Offline sync complete: ${syncedCount} new application(s) synced, ${dedupCount} duplicate replay(s) safely deduplicated via idempotency key.`,
    });
    setSyncing(false);
    await onSubmitted();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              New Land Title Registration Application
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Client hashes supporting deeds (SHA-256) and validates coordinates against EPSG:4326 upon receipt.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={offlineMode}
              onChange={(e) => setOfflineMode(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
            />
            Simulate Offline Mode
          </label>
        </div>

        {/* Owner Wallet Pairing */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-md">
          <div className="text-xs text-slate-700">
            <span className="font-semibold text-slate-900">Title Recipient Wallet: </span>
            {wallet.isConnected && wallet.address ? (
              <span className="font-mono text-emerald-700">
                {wallet.walletLabel} ({wallet.address.slice(0, 6)}...{wallet.address.slice(-4)})
              </span>
            ) : (
              <span className="text-slate-500">Optional — connect MetaMask or Trust Wallet</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => wallet.openModal()}
            className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            {wallet.isConnected ? 'Change Wallet' : 'Connect MetaMask / Trust Wallet'}
          </button>
        </div>

        {/* Scenario Presets */}
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-600 mb-2">
            Verification Scenario Presets (Lagos Coordinates)
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 p-3 rounded-md border text-xs ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Parcel Reference</label>
              <input
                type="text"
                required
                value={parcelReference}
                onChange={(e) => setParcelReference(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
              <input
                type="text"
                required
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">LGA</label>
              <select
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="Eti-Osa">Eti-Osa</option>
                <option value="Ikeja">Ikeja</option>
                <option value="Alimosho">Alimosho</option>
                <option value="Kosofe">Kosofe</option>
                <option value="Ibeju-Lekki">Ibeju-Lekki</option>
                <option value="Lagos Island">Lagos Island</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Parcel Address</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Claimant Legal Name</label>
              <input
                type="text"
                required
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                National ID / NIN (Hashed Server-Side)
              </label>
              <input
                type="text"
                required
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Locate &amp; Plot Parcel Boundary on OpenStreetMap
              </label>
              <OsmParcelMap
                interactive
                showExistingParcels
                wkt={wkt}
                label={parcelReference || 'Application Plot'}
                address={address}
                heightClassName="h-64"
                onSelectWkt={(newWkt, discoveredAddress) => {
                  setWkt(newWkt);
                  if (discoveredAddress) {
                    const shortLabel = discoveredAddress.split(',').slice(0, 3).join(', ').trim();
                    if (shortLabel) setAddress(shortLabel);
                  }
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Parcel Boundary WKT (WGS 84 EPSG:4326)
              </label>
              <textarea
                rows={2}
                required
                value={wkt}
                onChange={(e) => setWkt(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Document Attachment */}
          <div className="border border-slate-200 rounded-md p-4 bg-slate-50 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-800">
                Supporting Documents (PDF, PNG, JPEG · Max 10 MB)
              </label>
              <button
                type="button"
                onClick={attachSampleDeed}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100"
              >
                Attach Hashed Sample Deed PDF
              </button>
            </div>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              multiple
              onChange={handleFileChange}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-100"
            />
            {documents.length > 0 && (
              <div className="divide-y divide-slate-200 border-t border-slate-200 pt-2">
                {documents.map((doc, idx) => (
                  <div key={`${doc.fileName}-${idx}`} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-800 truncate">{doc.fileName}</span>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                      {doc.sha256Hash.slice(0, 18)}...
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors"
          >
            {offlineMode
              ? 'Save Application to Offline Queue'
              : submitting
              ? 'Submitting...'
              : 'Submit Land Application'}
          </button>
        </form>
      </div>

      {/* Offline Queue Inspector */}
      <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Offline Queue & Idempotent Sync
            </h3>
            <p className="text-xs text-slate-500">
              Queued drafts persist locally in browser storage until reconnected.
            </p>
          </div>
          <span className="px-2 py-0.5 text-xs font-mono border border-slate-300 rounded text-slate-800 tabular-nums">
            {offlineQueue.length} Pending
          </span>
        </div>

        {offlineQueue.length === 0 ? (
          <p className="text-xs text-slate-500 leading-relaxed">
            No offline drafts queued. Enable &ldquo;Simulate Offline Mode&rdquo; and submit an application to stage it locally, then click Sync to test idempotent replay protection.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="divide-y divide-slate-200 border border-slate-200 rounded">
              {offlineQueue.map((item) => (
                <div key={item.idempotencyKey} className="p-3 text-xs">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-semibold text-slate-900">
                      {item.payload.parcelReference}
                    </span>
                    <span className="text-slate-500">
                      {new Date(item.queuedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-0.5">{item.payload.address}</p>
                  <p className="font-mono text-[11px] text-slate-500 mt-1">
                    Key: {item.idempotencyKey}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={syncing}
                onClick={() => syncOfflineQueue(false)}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Reconnect & Sync Queue'}
              </button>
              <button
                type="button"
                disabled={syncing}
                onClick={() => syncOfflineQueue(true)}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 disabled:opacity-50"
              >
                Test Duplicate Replay
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
