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
  parseJsonRing,
  ringToWkt,
  wktToJsonRing,
} from '../../lib/gis-utils';
import {
  FALLBACK_MARKET_RATES,
  ethToUsd,
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

const OWNERSHIP_TYPES = [
  'Freehold',
  'Leasehold',
  'Certificate of Occupancy (C of O)',
  "Governor's Consent",
  'Customary / Family Title',
  'State Allocation',
];

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Land Certificate (C of O)',
  'Deed of Assignment',
  'Registered Survey Plan',
  "Governor's Consent",
  'Tax / Ground Rent Receipt',
  'Identity / CAC Document',
  'Supporting Document',
];

const REGION_SUGGESTIONS = [
  'Zone 1 District',
  'Eti-Osa',
  'Victoria Island',
  'Ikoyi',
  'Lekki Phase 1',
  'Ikeja',
  'Yaba',
  'Surulere',
  'Mainland',
  'Alimosho',
];

async function computeFileSha256(file: File): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const buffer = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest('SHA-256', buffer);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return ethers.keccak256(ethers.toUtf8Bytes(`${file.name}:${file.size}:${file.lastModified}`)).slice(2);
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

  // Section 1: Parcel Details & Ownership (matching screenshot + extended cadastral info)
  const [parcelTitle, setParcelTitle] = useState('');
  const [region, setRegion] = useState('');
  const [locationDesc, setLocationDesc] = useState('');
  const [ownershipType, setOwnershipType] = useState('Freehold');
  const [claimantName, setClaimantName] = useState(user?.fullName || '');
  const [nationalId, setNationalId] = useState('');

  // Extended land registration metadata
  const [parcelReference, setParcelReference] = useState('');
  const [zoning, setZoning] = useState<LandZoning>('Residential');
  const [surveyPlanNumber, setSurveyPlanNumber] = useState('');
  const [deedReference, setDeedReference] = useState('');
  const [beaconNumbers, setBeaconNumbers] = useState('');
  const [encumbranceStatus, setEncumbranceStatus] = useState('Free of Encumbrances');
  const [ownerContact, setOwnerContact] = useState(user?.phone || '');
  const [plotDimensions, setPlotDimensions] = useState('');

  // Coordinates & Map Sync
  const [ringText, setRingText] = useState(DEFAULT_RING_TEXT);
  const [spatialCheck, setSpatialCheck] = useState<SpatialVerificationResult | null>(null);
  const [checkingSpatial, setCheckingSpatial] = useState(false);

  // Section 2: Price & Deed Upload
  const [priceUsd, setPriceUsd] = useState('');
  const [priceEthInput, setPriceEthInput] = useState('');
  const [priceInputMode, setPriceInputMode] = useState<'USD' | 'ETH'>('USD');
  const [marketRates, setMarketRates] = useState<MarketRates>(FALLBACK_MARKET_RATES);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [listingHeadline, setListingHeadline] = useState('');
  const [saleTerms, setSaleTerms] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('Land Certificate (C of O)');
  const [documents, setDocuments] = useState<PendingDocItem[]>([]);
  const [siteImageUrl, setSiteImageUrl] = useState('');
  const [siteImageName, setSiteImageName] = useState('');
  const [customWalletAddr, setCustomWalletAddr] = useState(user?.walletAddress || '');
  const [signWithWallet, setSignWithWallet] = useState(true);

  // State & Feedback
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
    if (user.fullName) setClaimantName((prev) => prev || user.fullName);
    if (user.phone) setOwnerContact((prev) => prev || user.phone);
    if (user.walletAddress) setCustomWalletAddr((prev) => prev || user.walletAddress);
  }, [user]);

  useEffect(() => {
    if (wallet.address) {
      setCustomWalletAddr(wallet.address);
    }
  }, [wallet.address]);

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

  const loadLiveRates = useCallback(async (force = false) => {
    setRefreshingRates(true);
    try {
      const res = await fetch(force ? '/api/pricing?refresh=1' : '/api/pricing');
      if (res.ok) {
        const data = (await res.json()) as MarketRates;
        setMarketRates(data);
        if (priceInputMode === 'ETH' && priceEthInput) {
          const usdVal = ethToUsd(priceEthInput, data);
          if (usdVal > 0) setPriceUsd(String(usdVal));
        }
      }
    } catch {
      // Keep cached/baseline rates
    } finally {
      setRefreshingRates(false);
    }
  }, [priceEthInput, priceInputMode]);

  useEffect(() => {
    void loadLiveRates(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedPriceUsd = useMemo(() => {
    if (priceInputMode === 'ETH') {
      return ethToUsd(priceEthInput, marketRates);
    }
    const num = Number(priceUsd);
    return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : 0;
  }, [marketRates, priceEthInput, priceInputMode, priceUsd]);

  const estimatedNgn = useMemo(
    () => usdToNgn(parsedPriceUsd, marketRates),
    [marketRates, parsedPriceUsd],
  );
  const estimatedEth = useMemo(
    () => (parsedPriceUsd > 0 ? usdToEth(parsedPriceUsd, marketRates) : '0.0000'),
    [marketRates, parsedPriceUsd],
  );

  // Live spatial GIS check whenever valid polygon changes
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
        // Non-blocking live GIS preview
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
      if (discoveredAddress && !locationDesc.trim()) {
        setLocationDesc(discoveredAddress.slice(0, 220));
      }
    },
    [locationDesc],
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
          text: `Unsupported file "${file.name}". Please upload PDF, PNG, JPEG, or WEBP land certificates or deeds.`,
        });
        continue;
      }
      if (file.size <= 0 || file.size > maxBytes) {
        setFeedback({
          type: 'err',
          text: `File "${file.name}" exceeds the 10 MB document limit.`,
        });
        continue;
      }
      const sha256Hash = await computeFileSha256(file);
      added.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        fileType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileSizeBytes: file.size,
        sha256Hash,
        category: docCategory,
      });
    }

    if (added.length > 0) {
      setDocuments((prev) => [...prev, ...added].slice(0, 10));
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
      setFeedback({ type: 'err', text: 'Site photo must be a PNG, JPEG, or WEBP image.' });
      return;
    }
    try {
      const dataUrl = await createSitePhotoDataUrl(file);
      setSiteImageUrl(dataUrl);
      setSiteImageName(file.name);
    } catch {
      setFeedback({ type: 'err', text: 'Unable to process the selected site image.' });
    }
    e.target.value = '';
  };

  const buildPayload = () => {
    const cleanRef =
      parcelReference.trim() ||
      `LG-${(region.trim() || 'ZN1')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'ZN1'}-${Math.floor(100 + Math.random() * 899)}`;

    const effectiveAddress =
      locationDesc.trim() || parcelTitle.trim() || `${cleanRef}, ${region.trim() || 'Zone 1 District'}`;

    return {
      parcelReference: cleanRef,
      parcelTitle: parcelTitle.trim() || undefined,
      ownershipType,
      zoning,
      surveyPlanNumber: surveyPlanNumber.trim() || undefined,
      deedReference: deedReference.trim() || undefined,
      beaconNumbers: beaconNumbers.trim() || undefined,
      encumbranceStatus,
      ownerContact: ownerContact.trim() || undefined,
      plotDimensions: plotDimensions.trim() || undefined,
      priceUsd: parsedPriceUsd > 0 ? parsedPriceUsd : undefined,
      listingHeadline: listingHeadline.trim() || undefined,
      saleTerms: saleTerms.trim() || undefined,
      siteImageUrl: siteImageUrl || undefined,
      state: 'Lagos',
      lga: region.trim() || 'Zone 1 District',
      address: effectiveAddress,
      wkt: ringStats.wkt,
      claimantName: claimantName.trim() || user?.fullName || 'Land Owner',
      nationalId: nationalId.trim() || 'NID-UNSPECIFIED',
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
    if (!parcelTitle.trim() && !locationDesc.trim()) {
      return 'Enter a Parcel Title / Plot Name or Location Description.';
    }
    if (!region.trim()) {
      return 'Enter a Region / Municipality (e.g. Zone 1 District or Eti-Osa).';
    }
    if (!claimantName.trim()) {
      return 'Enter the Owner / Claimant Name.';
    }
    if (!ringStats.valid || !ringStats.wkt) {
      return 'Boundary Coordinates must be a valid closed JSON [lng, lat] ring with at least 4 coordinate pairs.';
    }
    if (parsedPriceUsd <= 0) {
      return 'Enter a valid Land Price (USD $) greater than 0.';
    }
    if (documents.length === 0) {
      return 'Upload at least one Land Certificate, Deed of Assignment, or Registered Survey Plan (PDF/PNG/JPEG).';
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
        const docConcat = payload.documents.map((d) => d.sha256Hash).join(':');
        walletProof = await wallet.authorizeRegistryAction({
          kind: 'REGISTER_LAND',
          parcelReference: payload.parcelReference,
          ownerAddress: wallet.address || payload.walletAddress || ethers.ZeroAddress,
          spatialHash: ethers.keccak256(ethers.toUtf8Bytes(payload.wkt)),
          ownerReferenceHash: ethers.keccak256(ethers.toUtf8Bytes(payload.nationalId)),
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
        throw new Error(data.message || 'Failed to submit land registration');
      }

      const createdApp = data.application as LandApplicationRecord;

      setFeedback({
        type: 'ok',
        parcelRef: createdApp.parcelReference,
        text: `Land parcel "${createdApp.parcelTitle || createdApp.parcelReference}" and ${createdApp.documents.length} SHA-256 hashed deed document(s) submitted ($${(createdApp.priceUsd || parsedPriceUsd).toLocaleString()} USD). Your plot is now visible as Unverified on Access Land while awaiting Administrator deed verification.`,
      });

      if (onSubmitted) {
        await onSubmitted();
      }
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to submit land application',
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
      text: `Queued "${payload.parcelTitle || payload.parcelReference}" offline with idempotency key ${payload.idempotencyKey}.`,
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
          ? `Synced ${syncedCount} offline land registration filing(s) cleanly.`
          : 'Unable to sync queued applications right now.',
    });
    if (syncedCount > 0 && onSubmitted) {
      await onSubmitted();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8 shadow-sm">
      {/* Header matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Register Land &amp; Submit Deed for Verification
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
            Enter your parcel details, set your price in US Dollars ($), and upload your land deed. Your parcel appears as Unverified on Access Land immediately and upgrades to Verified once the Administrator checks your deed.
          </p>
        </div>

        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-400 border border-amber-400/80 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
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
              <Link href="/dashboard" className="font-semibold text-emerald-800 underline">
                Open Admin / Registry Console →
              </Link>
              <Link href="/marketplace" className="font-semibold text-slate-900 underline">
                Access Land →
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={submitRegistration} className="space-y-8">
        {/* SECTION 1: PARCEL DETAILS & OWNERSHIP */}
        <section className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            1. PARCEL DETAILS &amp; OWNERSHIP
          </h2>

          {/* Row 1: Parcel Title / Plot Name | Region / Municipality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="parcel-title-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Parcel Title / Plot Name
              </label>
              <input
                id="parcel-title-input"
                type="text"
                value={parcelTitle}
                onChange={(e) => setParcelTitle(e.target.value)}
                placeholder="e.g. Plot A Residential Zone 1"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="region-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Region / Municipality
              </label>
              <input
                id="region-input"
                type="text"
                list="anagu-region-suggestions"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Zone 1 District"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
              <datalist id="anagu-region-suggestions">
                {REGION_SUGGESTIONS.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 2: Location Description & Landmarks */}
          <div>
            <label
              htmlFor="location-desc-input"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Location Description &amp; Landmarks
            </label>
            <input
              id="location-desc-input"
              type="text"
              value={locationDesc}
              onChange={(e) => setLocationDesc(e.target.value)}
              placeholder="Street, survey beacon, and adjacent landmarks"
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          {/* Row 3: Ownership Type | Owner / Claimant Name | Owner National ID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="ownership-type-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Ownership Type
              </label>
              <select
                id="ownership-type-select"
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              >
                {OWNERSHIP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="claimant-name-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Owner / Claimant Name
              </label>
              <input
                id="claimant-name-input"
                type="text"
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                placeholder="e.g. Chidinma Okafor"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="national-id-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Owner National ID
              </label>
              <input
                id="national-id-input"
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="NID-2026-001"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Row 4: Expanded Cadastral, Survey & Title Information */}
          <div className="pt-2 space-y-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Additional Survey, Title Certificate &amp; Encumbrance Details
              </span>
              <span className="text-[11px] text-slate-500">
                Strengthens Administrator &amp; Registrar deed verification
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label
                  htmlFor="parcel-ref-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Parcel Reference Code
                </label>
                <input
                  id="parcel-ref-input"
                  type="text"
                  value={parcelReference}
                  onChange={(e) => setParcelReference(e.target.value)}
                  placeholder="Auto or e.g. LG-ZN1-104"
                  className="w-full px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="zoning-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Zoning / Land Use
                </label>
                <select
                  id="zoning-select"
                  value={zoning}
                  onChange={(e) => setZoning(e.target.value as LandZoning)}
                  className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Mixed-Use">Mixed-Use</option>
                  <option value="Agricultural">Agricultural</option>
                  <option value="Industrial">Industrial</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="survey-plan-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Survey Plan Number
                </label>
                <input
                  id="survey-plan-input"
                  type="text"
                  value={surveyPlanNumber}
                  onChange={(e) => setSurveyPlanNumber(e.target.value)}
                  placeholder="e.g. LS/D/LA/2026/014"
                  className="w-full px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="deed-ref-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Land Certificate / Deed No.
                </label>
                <input
                  id="deed-ref-input"
                  type="text"
                  value={deedReference}
                  onChange={(e) => setDeedReference(e.target.value)}
                  placeholder="e.g. C of O No. 48/48/2026"
                  className="w-full px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="beacon-numbers-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Beacon / Pillar Numbers
                </label>
                <input
                  id="beacon-numbers-input"
                  type="text"
                  value={beaconNumbers}
                  onChange={(e) => setBeaconNumbers(e.target.value)}
                  placeholder="e.g. SC/LA 4410 - 4413"
                  className="w-full px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="encumbrance-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Encumbrance &amp; Dispute Status
                </label>
                <select
                  id="encumbrance-select"
                  value={encumbranceStatus}
                  onChange={(e) => setEncumbranceStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="Free of Encumbrances">Free of Encumbrances</option>
                  <option value="Family / Community Consent Attached">
                    Family / Community Consent Attached
                  </option>
                  <option value="Subject to Bank Charge / Mortgage">
                    Subject to Bank Charge / Mortgage
                  </option>
                  <option value="Pending Boundary Clearance">Pending Boundary Clearance</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="owner-contact-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Owner Contact (Phone / Email)
                </label>
                <input
                  id="owner-contact-input"
                  type="text"
                  value={ownerContact}
                  onChange={(e) => setOwnerContact(e.target.value)}
                  placeholder="e.g. +234 803 000 0000"
                  className="w-full px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="plot-dimensions-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Plot Dimensions &amp; Frontage
                </label>
                <input
                  id="plot-dimensions-input"
                  type="text"
                  value={plotDimensions}
                  onChange={(e) => setPlotDimensions(e.target.value)}
                  placeholder="e.g. 60m x 45m · Paved corner access"
                  className="w-full px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Boundary Coordinates (JSON [lng, lat] Ring) */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="boundary-ring-textarea"
                className="block text-xs font-medium text-slate-700"
              >
                Boundary Coordinates (JSON [lng, lat] Ring)
              </label>
              <button
                type="button"
                onClick={() => setRingText(DEFAULT_RING_TEXT)}
                className="text-[11px] font-medium text-emerald-700 hover:underline"
              >
                Reset to Zone 1 Sample Ring
              </button>
            </div>
            <textarea
              id="boundary-ring-textarea"
              rows={2}
              value={ringText}
              onChange={(e) => setRingText(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono text-slate-900 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <p
                className={`text-xs font-mono tabular-nums ${
                  ringStats.valid ? 'text-slate-600' : 'text-red-700'
                }`}
              >
                {ringStats.valid
                  ? `Geodesic area: ${ringStats.areaSqm.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} m² (${ringStats.vertices} vertices) — synced with map below`
                  : 'Invalid JSON coordinate ring. Expected [[lng,lat], ...] with at least 4 coordinate pairs.'}
              </p>

              {ringStats.valid && (
                <span
                  className={`text-[11px] font-mono font-medium ${
                    checkingSpatial
                      ? 'text-slate-500'
                      : spatialCheck?.passed
                      ? 'text-emerald-700'
                      : spatialCheck
                      ? 'text-red-700'
                      : 'text-slate-500'
                  }`}
                >
                  {checkingSpatial
                    ? 'Checking GIS boundary overlaps...'
                    : spatialCheck
                    ? spatialCheck.passed
                      ? 'GIS Check: 0.0m Overlap · Valid WGS 84'
                      : `GIS Alert: ${spatialCheck.errorDetails || 'Boundary overlap detected'}`
                    : ''}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 2: Warm Amber Verification & Deed Upload Card */}
        <section className="bg-amber-50/75 border border-amber-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-4 h-4 text-slate-900 shrink-0"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                />
              </svg>
              <h2 className="text-sm font-bold text-slate-900">
                2. Set Land Price &amp; Upload Deed for Admin Verification
              </h2>
            </div>
            <span className="text-xs font-medium text-amber-900/80">
              Verified by Admin on Access Land
            </span>
          </div>

          {/* Row 1: Price (USD $) | Check Lands Headline | Notes / Sale Terms */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="land-price-usd-input"
                  className="block text-xs font-semibold text-slate-800"
                >
                  {priceInputMode === 'USD' ? 'Land Price (USD $)' : 'Land Price (ETH)'}{' '}
                  <span className="text-red-600">*</span>
                </label>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      if (priceInputMode === 'ETH') {
                        const usdVal = ethToUsd(priceEthInput, marketRates);
                        if (usdVal > 0) setPriceUsd(String(usdVal));
                        setPriceInputMode('USD');
                      } else {
                        const nextEth = parsedPriceUsd > 0 ? usdToEth(parsedPriceUsd, marketRates) : '';
                        setPriceEthInput(nextEth);
                        setPriceInputMode('ETH');
                      }
                    }}
                    className="font-semibold text-emerald-800 hover:underline"
                  >
                    Switch to {priceInputMode === 'USD' ? 'ETH' : 'USD'}
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    disabled={refreshingRates}
                    onClick={() => void loadLiveRates(true)}
                    className="text-slate-600 hover:text-slate-900 underline disabled:opacity-50"
                  >
                    {refreshingRates ? 'Syncing...' : 'Refresh Rate'}
                  </button>
                </div>
              </div>
              {priceInputMode === 'USD' ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                    $
                  </span>
                  <input
                    id="land-price-usd-input"
                    type="number"
                    min={1}
                    step="any"
                    required
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    placeholder="e.g. 4250"
                    className="w-full pl-7 pr-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              ) : (
                <div className="relative">
                  <input
                    id="land-price-usd-input"
                    type="number"
                    min={0.0001}
                    step="any"
                    required
                    value={priceEthInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPriceEthInput(val);
                      const usdVal = ethToUsd(val, marketRates);
                      setPriceUsd(usdVal > 0 ? String(usdVal) : '');
                    }}
                    placeholder="e.g. 2.3240"
                    className="w-full pl-3.5 pr-14 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-500">
                    ETH
                  </span>
                </div>
              )}
              {parsedPriceUsd > 0 ? (
                <p className="mt-1 text-[11px] font-mono text-slate-700 tabular-nums">
                  {priceInputMode === 'USD'
                    ? `≈ ${estimatedEth} ETH · NGN ${estimatedNgn.toLocaleString('en-NG')}`
                    : `≈ $${parsedPriceUsd.toLocaleString('en-US')} USD · NGN ${estimatedNgn.toLocaleString('en-NG')}`}
                </p>
              ) : null}
              <p className="mt-0.5 text-[10px] font-mono text-slate-500 tabular-nums">
                Live Rate: 1 ETH = $
                {marketRates.ethUsd.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                USD ({marketRates.source})
              </p>
            </div>

            <div>
              <label
                htmlFor="listing-headline-input"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Access Land Headline (Optional)
              </label>
              <input
                id="listing-headline-input"
                type="text"
                value={listingHeadline}
                onChange={(e) => setListingHeadline(e.target.value)}
                placeholder="e.g. Prime Residential Corner Plot"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label
                htmlFor="sale-terms-input"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Notes / Sale Terms (Optional)
              </label>
              <input
                id="sale-terms-input"
                type="text"
                value={saleTerms}
                onChange={(e) => setSaleTerms(e.target.value)}
                placeholder="Surveyed plot ready for verification"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Row 2: Land Certificate & Deed Upload + Site Photo + Web3 Wallet Owner Binding */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Multi-file Land Certificate / Deed Uploader */}
            <div className="lg:col-span-7 bg-white border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Upload Land Certificate, Deed &amp; Survey Plan (SHA-256 Verified)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Attach one or more PDF, PNG, or JPEG files (max 10 MB each). Client-side SHA-256 digests are sealed on submission.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="doc-category-select"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    Document Type
                  </label>
                  <select
                    id="doc-category-select"
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                    className="w-full px-2.5 py-2 text-xs text-slate-900 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="deed-file-input"
                    className="block text-[11px] font-medium text-slate-700 mb-1"
                  >
                    Select Certificate / Deed File(s)
                  </label>
                  <input
                    id="deed-file-input"
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                    onChange={handleDocumentUpload}
                    className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                  />
                </div>
              </div>

              {documents.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-md p-3 text-xs text-slate-500 text-center">
                  No land certificate or deed uploaded yet. Select a Document Type above and choose PDF/PNG/JPEG files.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200 rounded">
                            {doc.category}
                          </span>
                          <span className="font-medium text-slate-900 truncate">{doc.fileName}</span>
                          <span className="text-slate-500 font-mono">
                            ({Math.max(1, Math.round(doc.fileSizeBytes / 1024))} KB)
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                          SHA-256: {doc.sha256Hash}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDocuments((prev) => prev.filter((item) => item.id !== doc.id))
                        }
                        className="text-[11px] font-semibold text-red-700 hover:underline shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Site Photo + Web3 Wallet Owner Binding */}
            <div className="lg:col-span-5 space-y-3">
              {/* Optional Site Photo */}
              <div className="bg-white border border-amber-200 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Parcel Site Photo (Optional)
                  </h3>
                  {siteImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSiteImageUrl('');
                        setSiteImageName('');
                      }}
                      className="text-[11px] font-medium text-red-700 hover:underline"
                    >
                      Clear Photo
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={handleSitePhotoUpload}
                  className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-800 hover:file:bg-slate-100 cursor-pointer"
                />
                {siteImageUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={siteImageUrl}
                      alt="Uploaded land parcel preview"
                      className="w-16 h-12 object-cover rounded border border-slate-200 shrink-0"
                    />
                    <span className="text-[11px] text-slate-600 truncate">
                      {siteImageName || 'Site photo attached for Access Land listing'}
                    </span>
                  </div>
                )}
              </div>

              {/* Web3 Wallet Owner Binding (Any Web3 Project) */}
              <div className="bg-white border border-amber-200 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-900">
                    Owner Web3 Wallet (Any EVM Wallet)
                  </h3>
                  <button
                    type="button"
                    onClick={() => wallet.openModal('all')}
                    className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap"
                  >
                    {wallet.isConnected ? 'Switch Wallet' : 'Connect Web3 Wallet'}
                  </button>
                </div>

                {wallet.isConnected && wallet.address ? (
                  <div className="text-[11px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 break-all">
                    Connected ({wallet.walletLabel}): {wallet.address}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={customWalletAddr}
                    onChange={(e) => setCustomWalletAddr(e.target.value)}
                    placeholder="0x... (connect any Web3 wallet or paste address)"
                    className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-md"
                  />
                )}

                {wallet.isConnected && (
                  <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={signWithWallet}
                      onChange={(e) => setSignWithWallet(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    Sign deed submission with {wallet.walletLabel}
                  </label>
                )}
              </div>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-lg border text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3 ${
                feedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <span>{feedback.text}</span>
              {feedback.type === 'ok' && (
                <div className="flex items-center gap-3 shrink-0">
                  <Link href="/marketplace" className="font-semibold text-emerald-900 underline">
                    View on Access Land →
                  </Link>
                  <Link href="/dashboard" className="font-semibold text-slate-900 underline">
                    Open Admin Console →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Submission Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/80">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
              >
                {submitting
                  ? 'Submitting Land & Sealing Deed...'
                  : 'Submit Land & Deed for Admin Verification'}
              </button>

              <button
                type="button"
                onClick={handleQueueOffline}
                disabled={submitting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-amber-300 rounded-lg hover:bg-amber-100/60 disabled:opacity-50 transition-colors"
              >
                Queue Offline
              </button>

              {offlineQueue.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncOfflineQueue}
                  disabled={syncingQueue}
                  className="px-4 py-2.5 text-xs font-semibold text-amber-950 bg-amber-200 border border-amber-300 rounded-lg hover:bg-amber-300 disabled:opacity-50 transition-colors"
                >
                  {syncingQueue ? 'Syncing...' : `Sync Offline Queue (${offlineQueue.length})`}
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-600">
              Admin verification upgrades your parcel to Verified on Access Land &amp; issues ERC-721 Title
            </span>
          </div>
        </section>

        {/* SECTION 3: Synced OpenStreetMap Interactive Boundary Map */}
        <section className="space-y-2.5 pt-2 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              3. INTERACTIVE BOUNDARY MAP (SYNCED WITH COORDINATES ABOVE)
            </h2>
            <span className="text-xs text-slate-500">
              Click anywhere on OpenStreetMap or search a street to update the coordinate ring
            </span>
          </div>
          <OsmParcelMap
            wkt={ringStats.valid ? ringStats.wkt : ringToWkt(parseJsonRing(DEFAULT_RING_TEXT)!)}
            label={parcelTitle || parcelReference || 'Proposed Land Parcel'}
            address={locationDesc || region || 'Zone 1 District'}
            heightClassName="h-80"
            interactive
            showExistingParcels
            onSelectWkt={handleMapSelectWkt}
          />
        </section>
      </form>
    </div>
  );
}
