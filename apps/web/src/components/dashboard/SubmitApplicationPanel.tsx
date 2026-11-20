'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { ethers } from 'ethers';
import {
  computeGeodesicAreaSqm,
  formatArea,
  parseJsonRing,
  ringToWkt,
  wktToJsonRing,
} from '../../lib/gis-utils';
import {
  FALLBACK_MARKET_RATES,
  usdToEth,
  usdToNgn,
  type MarketRates,
} from '../../lib/pricing';
import { useWallet } from '../WalletContext';
import OsmParcelMap from '../map/OsmParcelMap';
import type {
  DocumentCategory,
  LandApplicationRecord,
  LandZoning,
  OfflineQueuedApplication,
  SafeUser,
  SpatialVerificationResult,
} from './types';

interface SubmitApplicationPanelProps {
  user?: SafeUser | null;
  onSubmitted?: () => Promise<void> | void;
}

interface PendingDocItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  category: DocumentCategory;
}

const DEFAULT_RING_TEXT =
  '[[3.391,6.531],[3.3925,6.531],[3.3925,6.5325],[3.391,6.5325],[3.391,6.531]]';

const OFFLINE_QUEUE_KEY = 'anagu_offline_applications';

const LAND_USES: LandZoning[] = [
  'Residential',
  'Commercial',
  'Mixed-Use',
  'Agricultural',
  'Industrial',
];

async function computeFileSha256(file: File): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const buffer = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return ethers
    .keccak256(ethers.toUtf8Bytes(`${file.name}:${file.size}:${file.lastModified}`))
    .slice(2);
}

async function createSitePhotoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read site image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const maxWidth = 960;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof reader.result === 'string' ? reader.result : '');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export default function SubmitApplicationPanel({
  user,
  onSubmitted,
}: SubmitApplicationPanelProps) {
  const wallet = useWallet();

  // Simple user-friendly fields
  const [landName, setLandName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [areaName, setAreaName] = useState('');
  const [ownerName, setOwnerName] = useState(user?.fullName || '');
  const [zoning, setZoning] = useState<LandZoning>('Residential');
  const [priceUsd, setPriceUsd] = useState('');
  const [notes, setNotes] = useState('');

  // Map & boundary ring state
  const [ringText, setRingText] = useState(DEFAULT_RING_TEXT);
  const [spatialCheck, setSpatialCheck] = useState<SpatialVerificationResult | null>(null);
  const [checkingSpatial, setCheckingSpatial] = useState(false);

  // Optional media, supporting doc, and advanced fields
  const [documents, setDocuments] = useState<PendingDocItem[]>([]);
  const [siteImageUrl, setSiteImageUrl] = useState('');
  const [siteImageName, setSiteImageName] = useState('');
  const [customWalletAddr, setCustomWalletAddr] = useState(user?.walletAddress || '');
  const [signWithWallet, setSignWithWallet] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [parcelReference, setParcelReference] = useState('');
  const [ownershipType, setOwnershipType] = useState('Freehold');
  const [surveyPlanNumber, setSurveyPlanNumber] = useState('');

  // Market pricing for optional price preview
  const [marketRates, setMarketRates] = useState<MarketRates>(FALLBACK_MARKET_RATES);

  // Submission & offline queue state
  const [submitting, setSubmitting] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedApplication[]>([]);
  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
    parcelRef?: string;
  } | null>(null);

  const seededUserRef = useRef(false);

  useEffect(() => {
    if (!user || seededUserRef.current) return;
    seededUserRef.current = true;
    if (user.fullName) setOwnerName((prev) => prev || user.fullName);
    if (user.walletAddress) setCustomWalletAddr((prev) => prev || user.walletAddress);
  }, [user]);

  useEffect(() => {
    if (wallet.address) {
      setCustomWalletAddr(wallet.address);
      if (!ownerName.trim() && !user?.fullName) {
        setOwnerName(`Wallet Owner (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})`);
      }
    }
  }, [ownerName, user?.fullName, wallet.address]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setOfflineQueue(parsed);
      }
    } catch {
      // Ignore malformed offline cache
    }
  }, []);

  useEffect(() => {
    fetch('/api/pricing')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMarketRates(data as MarketRates);
      })
      .catch(() => {});
  }, []);

  const persistQueue = useCallback((items: OfflineQueuedApplication[]) => {
    setOfflineQueue(items);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
    }
  }, []);

  const ringStats = useMemo(() => {
    const parsed = parseJsonRing(ringText);
    if (!parsed) {
      return { valid: false as const, wkt: '', areaSqm: 0, vertices: 0 };
    }
    const wkt = ringToWkt(parsed);
    const areaSqm = computeGeodesicAreaSqm(parsed);
    const isClosed =
      parsed.length > 1 &&
      parsed[0][0] === parsed[parsed.length - 1][0] &&
      parsed[0][1] === parsed[parsed.length - 1][1];
    const vertices = isClosed ? parsed.length - 1 : parsed.length;
    return { valid: true as const, wkt, areaSqm, vertices };
  }, [ringText]);

  const parsedPriceUsd = useMemo(() => {
    const num = Number(priceUsd);
    return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : 0;
  }, [priceUsd]);

  const estimatedEth = useMemo(
    () => (parsedPriceUsd > 0 ? usdToEth(parsedPriceUsd, marketRates) : '0.0000'),
    [marketRates, parsedPriceUsd],
  );
  const estimatedNgn = useMemo(
    () => (parsedPriceUsd > 0 ? usdToNgn(parsedPriceUsd, marketRates) : 0),
    [marketRates, parsedPriceUsd],
  );

  // Live GIS overlap check whenever mapped boundary updates
  useEffect(() => {
    if (!ringStats.valid || !ringStats.wkt) {
      setSpatialCheck(null);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setCheckingSpatial(true);
      try {
        const res = await fetch('/api/gis/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wkt: ringStats.wkt }),
        });
        if (res.ok && active) {
          setSpatialCheck(await res.json());
        }
      } catch {
        // Non-blocking preview check
      } finally {
        if (active) setCheckingSpatial(false);
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ringStats.valid, ringStats.wkt]);

  const handleMapSelectWkt = useCallback(
    (newWkt: string, discoveredAddress?: string) => {
      const jsonRing = wktToJsonRing(newWkt);
      if (jsonRing && jsonRing !== '[]') {
        setRingText(jsonRing);
      }
      if (discoveredAddress) {
        const cleanAddr = discoveredAddress.slice(0, 200);
        setLocationAddress(cleanAddr);
        const parts = cleanAddr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length >= 2 && !areaName.trim()) {
          setAreaName(parts[1] || parts[0]);
        }
      }
    },
    [areaName],
  );

  const handleDocumentUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setFeedback(null);

    const allowed = [
      'application/pdf',
      'application/x-pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ];
    const allowedExt = /\.(pdf|png|jpe?g|webp)$/i;
    const maxBytes = 10 * 1024 * 1024;
    const added: PendingDocItem[] = [];

    for (const file of Array.from(files)) {
      const mimeOk = allowed.includes((file.type || '').toLowerCase());
      const extOk = allowedExt.test(file.name || '');
      if (!mimeOk && !extOk) {
        setFeedback({
          type: 'err',
          text: `Unsupported file "${file.name}". Please upload PDF, PNG, JPEG, or WEBP.`,
        });
        continue;
      }
      if (file.size <= 0 || file.size > maxBytes) {
        setFeedback({
          type: 'err',
          text: `File "${file.name}" exceeds the 10 MB limit.`,
        });
        continue;
      }
      const sha256Hash = await computeFileSha256(file);
      added.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        fileType:
          file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileSizeBytes: file.size,
        sha256Hash,
        category: 'Supporting Document',
      });
    }

    if (added.length > 0) {
      setDocuments((prev) => [...prev, ...added].slice(0, 5));
    }
    e.target.value = '';
  };

  const handleSitePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mimeOk = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(
      (file.type || '').toLowerCase(),
    );
    const extOk = /\.(png|jpe?g|webp)$/i.test(file.name || '');
    if (!mimeOk && !extOk) {
      setFeedback({ type: 'err', text: 'Photo must be a PNG, JPEG, or WEBP image.' });
      return;
    }
    try {
      const dataUrl = await createSitePhotoDataUrl(file);
      setSiteImageUrl(dataUrl);
      setSiteImageName(file.name);
    } catch {
      setFeedback({ type: 'err', text: 'Unable to process the selected photo.' });
    }
    e.target.value = '';
  };

  const buildPayload = () => {
    const inferredArea =
      areaName.trim() ||
      locationAddress
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)[0] ||
      'Mapped Area';

    const cleanRef =
      parcelReference.trim() ||
      `GIS-${(inferredArea.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'MAP')}-${Math.floor(100 + Math.random() * 899)}`;

    const effectiveAddress = locationAddress.trim() || landName.trim() || inferredArea;

    return {
      parcelReference: cleanRef,
      parcelTitle: landName.trim() || effectiveAddress.slice(0, 64),
      ownershipType,
      zoning,
      surveyPlanNumber: surveyPlanNumber.trim() || undefined,
      priceUsd: parsedPriceUsd > 0 ? parsedPriceUsd : undefined,
      saleTerms: notes.trim() || undefined,
      siteImageUrl: siteImageUrl || undefined,
      state: 'GIS Cadastre',
      lga: inferredArea,
      address: effectiveAddress,
      wkt: ringStats.wkt,
      claimantName: ownerName.trim() || user?.fullName || 'Land Owner',
      nationalId: 'GIS-STANDARD',
      walletAddress:
        wallet.address ||
        (customWalletAddr.trim() && ethers.isAddress(customWalletAddr.trim())
          ? customWalletAddr.trim()
          : undefined),
      documents: documents.map((d) => ({
        fileName: d.fileName,
        fileType: d.fileType,
        fileSizeBytes: d.fileSizeBytes,
        sha256Hash: d.sha256Hash,
        category: d.category,
      })),
      idempotencyKey: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  };

  const validateBeforeSubmit = (): string | null => {
    if (!locationAddress.trim() && !landName.trim()) {
      return 'Enter your land location or give your plot a simple name.';
    }
    if (!ringStats.valid || !ringStats.wkt) {
      return 'Please mark your land location on the GIS map first.';
    }
    return null;
  };

  const submitRegistration = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const validationError = validateBeforeSubmit();
    if (validationError) {
      setFeedback({ type: 'err', text: validationError });
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload();
      let walletProof: unknown = null;

      if (wallet.isConnected && signWithWallet) {
        const docConcat =
          payload.documents.length > 0
            ? payload.documents.map((d) => d.sha256Hash).join(':')
            : `gis-parcel:${payload.parcelReference}`;
        walletProof = await wallet.authorizeRegistryAction({
          kind: 'REGISTER_LAND',
          parcelReference: payload.parcelReference,
          ownerAddress: wallet.address || payload.walletAddress || ethers.ZeroAddress,
          spatialHash: ethers.keccak256(ethers.toUtf8Bytes(payload.wkt)),
          ownerReferenceHash: ethers.keccak256(ethers.toUtf8Bytes(payload.claimantName)),
          documentHash: ethers.keccak256(ethers.toUtf8Bytes(docConcat)),
          actorRole: user?.role || 'CITIZEN',
          walletName: wallet.walletLabel,
        });
      }

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, walletProof }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to register mapped land');
      }

      const createdApp = data.application as LandApplicationRecord;

      setFeedback({
        type: 'ok',
        parcelRef: createdApp.parcelReference,
        text: `Land "${createdApp.parcelTitle || createdApp.parcelReference}" mapped and registered cleanly. It is queued for Admin approval before going live on Access Land (Polygon ERC-721 + ERC-20 ready).`,
      });

      if (onSubmitted) {
        await onSubmitted();
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to register land',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleQueueOffline = () => {
    setFeedback(null);
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setFeedback({ type: 'err', text: validationError });
      return;
    }
    const payload = buildPayload();
    const item: OfflineQueuedApplication = {
      idempotencyKey: payload.idempotencyKey,
      queuedAt: new Date().toISOString(),
      payload,
    };
    persistQueue([item, ...offlineQueue]);
    setFeedback({
      type: 'ok',
      text: `Saved "${payload.parcelTitle || payload.parcelReference}" offline. Sync whenever you are ready.`,
    });
  };

  const handleSyncOfflineQueue = async () => {
    if (offlineQueue.length === 0) return;
    setSyncingQueue(true);
    setFeedback(null);
    const remaining: OfflineQueuedApplication[] = [];
    let syncedCount = 0;

    for (const item of offlineQueue) {
      try {
        const res = await fetch('/api/applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          syncedCount += 1;
          await res.json();
        } else {
          remaining.push(item);
        }
      } catch {
        remaining.push(item);
      }
    }

    persistQueue(remaining);
    setSyncingQueue(false);
    setFeedback({
      type: syncedCount > 0 ? 'ok' : 'err',
      text:
        syncedCount > 0
          ? `Synced ${syncedCount} queued land submission(s) cleanly.`
          : 'Unable to sync queued submissions right now.',
    });
    if (syncedCount > 0 && onSubmitted) {
      await onSubmitted();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-7 shadow-sm">
      {/* Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="max-w-2xl min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Map &amp; Register Your Land
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
            Search any address or click on the GIS map to mark out your land boundary—no complicated survey paperwork required. Verified parcels receive an ERC-721 Title on Polygon with ERC-20 settlement support.
          </p>
        </div>

        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 border border-amber-400/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          Access Land
        </Link>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-lg border text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.type === 'ok' && (
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/marketplace" className="font-semibold text-emerald-800 underline">
                Browse Access Land →
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={submitRegistration} className="space-y-8">
        {/* STEP 1: INTERACTIVE GIS MAPPING */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                1. Locate &amp; Mark Out Land on GIS Map
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your street/city below, use your device GPS, or click directly on the map to outline your plot.
              </p>
            </div>

            {ringStats.valid && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 font-mono text-slate-800 tabular-nums">
                  {formatArea(ringStats.areaSqm)}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-md font-medium border ${
                    checkingSpatial
                      ? 'bg-slate-50 border-slate-200 text-slate-500'
                      : spatialCheck?.passed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : spatialCheck
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {checkingSpatial
                    ? 'Checking GIS boundary...'
                    : spatialCheck
                    ? spatialCheck.passed
                      ? 'GIS Clear · Ready'
                      : spatialCheck.errorDetails || 'Boundary Notice'
                    : 'Mapped on WGS 84'}
                </span>
              </div>
            )}
          </div>

          <OsmParcelMap
            wkt={ringStats.valid ? ringStats.wkt : ringToWkt(parseJsonRing(DEFAULT_RING_TEXT)!)}
            label={landName || 'My Mapped Land'}
            address={locationAddress || areaName || 'Selected Land Location'}
            heightClassName="h-64 sm:h-80 lg:h-96"
            interactive
            showExistingParcels
            externalQuery={locationAddress}
            onSelectWkt={handleMapSelectWkt}
          />
        </section>

        {/* STEP 2: SIMPLE LAND & OWNERSHIP DETAILS */}
        <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              2. Simple Land Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill in the basics for your mapped parcel. No technical deed or beacon codes needed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="land-location-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Land Location / Address <span className="text-red-600">*</span>
              </label>
              <input
                id="land-location-input"
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Auto-filled from map or enter street, city, area"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="land-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Land Name / Label <span className="text-red-600">*</span>
              </label>
              <input
                id="land-name-input"
                type="text"
                value={landName}
                onChange={(e) => setLandName(e.target.value)}
                placeholder="e.g. Family Corner Plot or Lekki Garden Lot"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="owner-name-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Owner Name
              </label>
              <input
                id="owner-name-input"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="city-area-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                City / District
              </label>
              <input
                id="city-area-input"
                type="text"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="e.g. Victoria Island, Maitama"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="land-use-select"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Land Use
              </label>
              <select
                id="land-use-select"
                value={zoning}
                onChange={(e) => setZoning(e.target.value as LandZoning)}
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {LAND_USES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="asking-price-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Asking Price (USD $) <span className="font-normal text-slate-500">(Optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                  $
                </span>
                <input
                  id="asking-price-input"
                  type="number"
                  min={1}
                  step="any"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  placeholder="e.g. 4250"
                  className="w-full pl-7 pr-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              {parsedPriceUsd > 0 && (
                <p className="mt-1 text-[11px] font-mono text-slate-500 tabular-nums">
                  ≈ {parsedPriceUsd.toLocaleString('en-US')} ALT (ERC-20) · {estimatedEth} ETH · NGN{' '}
                  {estimatedNgn.toLocaleString('en-NG')}
                </p>
              )}
            </div>
          </div>

          {/* Short Description + Optional Photo/Document + Wallet */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-200/80">
            <div className="lg:col-span-5 space-y-2">
              <label
                htmlFor="land-notes-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Short Notes About the Land <span className="font-normal text-slate-500">(Optional)</span>
              </label>
              <textarea
                id="land-notes-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nearby road access, landmarks, fencing, or any details buyers should know."
                className="w-full px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-800">
                    Site Photo <span className="font-normal text-slate-500">(Optional)</span>
                  </span>
                  {siteImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSiteImageUrl('');
                        setSiteImageName('');
                      }}
                      className="text-[11px] font-medium text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={handleSitePhotoUpload}
                  className="block w-full text-[11px] text-slate-600 file:mr-2.5 file:py-1 file:px-2.5 file:rounded file:border file:border-slate-300 file:text-[11px] file:font-semibold file:bg-slate-50 file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                />
                {siteImageUrl && (
                  <p className="mt-1 text-[11px] text-emerald-700 truncate">
                    Attached: {siteImageName}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-800">
                    Document Upload <span className="font-normal text-slate-500">(Optional)</span>
                  </span>
                  {documents.length > 0 && (
                    <span className="text-[11px] font-mono text-emerald-700">
                      {documents.length} file(s)
                    </span>
                  )}
                </div>
                <input
                  id="deed-file-input"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleDocumentUpload}
                  className="block w-full text-[11px] text-slate-600 file:mr-2.5 file:py-1 file:px-2.5 file:rounded file:border file:border-slate-300 file:text-[11px] file:font-semibold file:bg-slate-50 file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                />
              </div>
            </div>

            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Owner Wallet <span className="font-normal text-slate-500">(Polygon)</span>
                </span>
                <button
                  type="button"
                  onClick={() => wallet.openModal('all')}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline whitespace-nowrap"
                >
                  {wallet.isConnected ? 'Change' : 'Connect'}
                </button>
              </div>
              {wallet.isConnected && wallet.address ? (
                <>
                  <div className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 break-all">
                    {wallet.address}
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={signWithWallet}
                      onChange={(e) => setSignWithWallet(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    Sign submission with wallet
                  </label>
                </>
              ) : (
                <input
                  type="text"
                  value={customWalletAddr}
                  onChange={(e) => setCustomWalletAddr(e.target.value)}
                  placeholder="Optional 0x... wallet address"
                  className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-md"
                />
              )}
            </div>
          </div>

          {/* Collapsible Advanced Cadastral / Polygon Details */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              {showAdvanced
                ? 'Hide advanced details'
                : 'Advanced details (optional — parcel code, survey number, raw coordinates)'}
            </button>

            {showAdvanced && (
              <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Custom Parcel Code
                  </label>
                  <input
                    type="text"
                    value={parcelReference}
                    onChange={(e) => setParcelReference(e.target.value)}
                    placeholder="Auto-generated if left blank"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ownership Tenure
                  </label>
                  <select
                    value={ownershipType}
                    onChange={(e) => setOwnershipType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                  >
                    <option value="Freehold">Freehold</option>
                    <option value="Leasehold">Leasehold</option>
                    <option value="Customary / Family Title">Customary / Family Title</option>
                    <option value="Certificate of Occupancy">Certificate of Occupancy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Survey Plan Reference
                  </label>
                  <input
                    type="text"
                    value={surveyPlanNumber}
                    onChange={(e) => setSurveyPlanNumber(e.target.value)}
                    placeholder="Optional survey ref"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md bg-white"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mapped Boundary Ring (JSON [lng, lat])
                  </label>
                  <textarea
                    rows={2}
                    value={ringText}
                    onChange={(e) => setRingText(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting ? 'Registering Land...' : 'Register Mapped Land'}
            </button>

            <button
              type="button"
              onClick={handleQueueOffline}
              disabled={submitting}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              Save Offline Draft
            </button>

            {offlineQueue.length > 0 && (
              <button
                type="button"
                onClick={handleSyncOfflineQueue}
                disabled={syncingQueue}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-amber-950 bg-amber-200 border border-amber-300 rounded-lg hover:bg-amber-300 disabled:opacity-50 transition-colors"
              >
                {syncingQueue ? 'Syncing...' : `Sync Offline Drafts (${offlineQueue.length})`}
              </button>
            )}
          </div>

          <span className="text-[11px] text-slate-500">
            Admin approval issues the Polygon ERC-721 Title and publishes to Access Land
          </span>
        </div>
      </form>
    </div>
  );
}
