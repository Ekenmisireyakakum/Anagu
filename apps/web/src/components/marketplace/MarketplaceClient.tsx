'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../../lib/firebase';
import { useFirebase } from '../FirebaseContext';
import { useWallet } from '../WalletContext';
import type {
  DigitalLandTitle,
  LandListingRecord,
  LandPurchaseRecord,
  LandZoning,
  SafeUser,
} from '../dashboard/types';
import OsmParcelMap from '../map/OsmParcelMap';
import ParcelImage from './ParcelImage';

interface MarketplaceClientProps {
  embedded?: boolean;
  onPurchased?: () => Promise<void>;
}

function formatNgn(amount: number): string {
  return `NGN ${amount.toLocaleString('en-NG')}`;
}

export default function MarketplaceClient({
  embedded = false,
  onPurchased,
}: MarketplaceClientProps) {
  const wallet = useWallet();
  const firebase = useFirebase();

  const [user, setUser] = useState<SafeUser | null>(null);
  const [listings, setListings] = useState<LandListingRecord[]>([]);
  const [purchases, setPurchases] = useState<LandPurchaseRecord[]>([]);
  const [ownedTitles, setOwnedTitles] = useState<DigitalLandTitle[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [lgaFilter, setLgaFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'SOLD'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [buying, setBuying] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<{
    purchase: LandPurchaseRecord;
    title: DigitalLandTitle;
  } | null>(null);

  // List owned land form
  const [showListForm, setShowListForm] = useState(false);
  const [listTokenId, setListTokenId] = useState<number>(0);
  const [listTitle, setListTitle] = useState('');
  const [listPriceNgn, setListPriceNgn] = useState('145000000');
  const [listZoning, setListZoning] = useState<LandZoning>('Residential');
  const [listDesc, setListDesc] = useState('');
  const [listingBusy, setListingBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mktRes, meRes] = await Promise.all([fetch('/api/marketplace'), fetch('/api/auth/me')]);
      if (mktRes.ok) {
        const data = await mktRes.json();
        const items: LandListingRecord[] = data.listings || [];
        setListings(items);
        setPurchases(data.purchases || []);

        const params =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const requestedParcel = params?.get('parcel');
        setSelectedId((prev) => {
          if (requestedParcel) {
            const matched = items.find(
              (l) => l.parcelReference.toLowerCase() === requestedParcel.toLowerCase(),
            );
            if (matched) return matched.id;
          }
          if (prev && items.some((l) => l.id === prev)) return prev;
          return items[0]?.id || null;
        });
      }

      if (meRes.ok) {
        const meData = await meRes.json();
        const currentUser = meData.user as SafeUser;
        setUser(currentUser);
        setBuyerName((prev) => prev || currentUser.fullName);
        const titlesRes = await fetch('/api/titles');
        if (titlesRes.ok) {
          const allTitles: DigitalLandTitle[] = await titlesRes.json();
          const eligible = allTitles.filter(
            (t) =>
              !t.isRevoked &&
              (t.ownerId === currentUser.id ||
                currentUser.role === 'REGISTRAR' ||
                currentUser.role === 'LAND_ADMINISTRATOR'),
          );
          setOwnedTitles(eligible);
          if (eligible.length > 0) {
            setListTokenId((prev) => prev || eligible[0].tokenId);
          }
        }
      } else {
        setUser(null);
        setOwnedTitles([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const lgaOptions = useMemo(() => {
    const unique = Array.from(new Set(listings.map((l) => l.lga))).sort();
    return ['ALL', ...unique];
  }, [listings]);

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      if (lgaFilter !== 'ALL' && item.lga !== lgaFilter) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const needle = searchQuery.trim().toLowerCase();
        const hay =
          `${item.title} ${item.parcelReference} ${item.address} ${item.lga} ${item.zoning}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [lgaFilter, listings, searchQuery, statusFilter]);

  const selectedListing = useMemo(
    () => listings.find((l) => l.id === selectedId) || filteredListings[0] || null,
    [filteredListings, listings, selectedId],
  );

  const availableCount = listings.filter((l) => l.status === 'AVAILABLE').length;
  const soldCount = listings.filter((l) => l.status === 'SOLD').length;

  const finalizePurchaseRequest = async (payload: {
    listingId: string;
    paymentMethod: 'METAMASK_ETH' | 'TRUST_WALLET_ETH' | 'REGISTRY_ESCROW';
    buyerName?: string;
    buyerWallet?: string;
    walletProof?: unknown;
  }) => {
    const res = await fetch('/api/marketplace/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Land purchase failed');
    }

    const result = data as {
      listing: LandListingRecord;
      purchase: LandPurchaseRecord;
      title: DigitalLandTitle;
    };

    setLatestReceipt({ purchase: result.purchase, title: result.title });
    setFeedback({
      type: 'ok',
      text: `Purchase confirmed! Digital Land Title #${result.title.tokenId} (${result.listing.parcelReference}) is now registered to ${result.purchase.buyerName}.`,
    });

    if (firebase.firebaseUser) {
      await Promise.allSettled([
        firebase.syncListing(result.listing),
        firebase.syncPurchase(result.purchase),
        ...(firebase.firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL
          ? [firebase.syncTitle(result.title)]
          : []),
      ]);
    }

    await loadData();
    if (onPurchased) {
      await onPurchased();
    }
  };

  const handleWalletPurchase = async (preferredWallet: 'metamask' | 'trustwallet') => {
    if (!selectedListing) return;
    setBuying(true);
    setFeedback(null);
    setLatestReceipt(null);

    try {
      const walletProof = await wallet.authorizeRegistryAction({
        kind: 'PURCHASE_LAND',
        listingId: selectedListing.id,
        parcelReference: selectedListing.parcelReference,
        sellerAddress: selectedListing.sellerAddress,
        priceEth: selectedListing.priceEth,
        priceNgn: selectedListing.priceNgn,
        actorRole: user?.role || 'CITIZEN',
        walletProvider: preferredWallet,
      });

      await finalizePurchaseRequest({
        listingId: selectedListing.id,
        paymentMethod: preferredWallet === 'trustwallet' ? 'TRUST_WALLET_ETH' : 'METAMASK_ETH',
        buyerName: buyerName.trim() || user?.fullName || undefined,
        buyerWallet: walletProof.signerAddress,
        walletProof,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to complete wallet acquisition',
      });
    } finally {
      setBuying(false);
    }
  };

  const handleEscrowPurchase = async () => {
    if (!selectedListing) return;
    setBuying(true);
    setFeedback(null);
    setLatestReceipt(null);
    try {
      await finalizePurchaseRequest({
        listingId: selectedListing.id,
        paymentMethod: 'REGISTRY_ESCROW',
        buyerName: buyerName.trim() || user?.fullName || undefined,
        buyerWallet: wallet.address || user?.walletAddress || undefined,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to complete acquisition',
      });
    } finally {
      setBuying(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !listTokenId) return;
    setListingBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: Number(listTokenId),
          title: listTitle,
          priceNgn: Number(listPriceNgn),
          zoning: listZoning,
          description: listDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to list land');

      if (firebase.firebaseUser) {
        await firebase.syncListing(data as LandListingRecord).catch(() => {});
      }

      setFeedback({
        type: 'ok',
        text: `Listed ${data.parcelReference} on the ANAGU Land Marketplace.`,
      });
      setShowListForm(false);
      setListTitle('');
      setListDesc('');
      await loadData();
      setSelectedId(data.id);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to publish listing',
      });
    } finally {
      setListingBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-2xl">
          {!embedded && (
            <p className="text-xs font-medium text-slate-500 mb-1.5">
              ANAGU Land Registry Marketplace · Lagos State
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Buy verified land parcels with instant title issuance
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Every listed parcel is pre-cleared against PostGIS boundary overlaps and Section 28 encumbrances. Buy directly using MetaMask, Trust Wallet, or Registry Escrow to receive your ERC-721 digital title.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0">
          <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-[11px] text-slate-500">Available Parcels</div>
            <div className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
              {availableCount}
            </div>
          </div>
          <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-[11px] text-slate-500">Acquired</div>
            <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {soldCount}
            </div>
          </div>
          {user && ownedTitles.length > 0 && (
            <button
              type="button"
              onClick={() => setShowListForm((prev) => !prev)}
              className="px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              {showListForm ? 'Close Listing Form' : 'List Your Title for Sale'}
            </button>
          )}
          {!embedded && (
            <Link
              href="/register-land"
              className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap"
            >
              Register Your Own Land
            </Link>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-md border text-sm ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Owner List-Land Form */}
      {showListForm && user && ownedTitles.length > 0 && (
        <form
          onSubmit={handleCreateListing}
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        >
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              List a Verified Digital Land Title for Sale
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Only active, non-revoked ERC-721 titles owned or administered by your account can be offered on the marketplace.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Active Title Token
              </label>
              <select
                value={listTokenId}
                onChange={(e) => setListTokenId(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md bg-white"
              >
                {ownedTitles.map((t) => (
                  <option key={t.tokenId} value={t.tokenId}>
                    Token #{t.tokenId} · {t.parcelReference}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Listing Headline
              </label>
              <input
                type="text"
                required
                value={listTitle}
                onChange={(e) => setListTitle(e.target.value)}
                placeholder="Victoria Island Commercial Plot"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Asking Price (NGN)
              </label>
              <input
                type="number"
                min={100000}
                required
                value={listPriceNgn}
                onChange={(e) => setListPriceNgn(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Zoning</label>
              <select
                value={listZoning}
                onChange={(e) => setListZoning(e.target.value as LandZoning)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Mixed-Use">Mixed-Use</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Parcel Description
            </label>
            <textarea
              rows={2}
              value={listDesc}
              onChange={(e) => setListDesc(e.target.value)}
              placeholder="Road access, perimeter beacons, and statutory covenants."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowListForm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={listingBusy}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50"
            >
              {listingBusy ? 'Publishing...' : 'Publish Verified Listing'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {lgaOptions.map((lga) => (
              <button
                key={lga}
                type="button"
                onClick={() => setLgaFilter(lga)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  lgaFilter === lga
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lga === 'ALL' ? 'All LGAs' : lga}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            {(['ALL', 'AVAILABLE', 'SOLD'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st === 'AVAILABLE' ? 'Available' : 'Acquired'}
              </button>
            ))}
          </div>
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search street, parcel code, LGA, or zoning..."
          className="w-full lg:w-72 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
      </div>

      {/* Main Split Grid: Catalog Cards + Contiguous Purchase Module */}
      {loading && listings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-sm text-slate-500">
          Loading verified Lagos land listings...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Catalog Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {filteredListings.length === 0 ? (
              <div className="sm:col-span-2 bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-600">
                No land parcels match your current filter. Reset filters to view all verified listings.
              </div>
            ) : (
              filteredListings.map((item) => {
                const isSelected = selectedListing?.id === item.id;
                return (
                  <article
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`cursor-pointer bg-white rounded-lg border overflow-hidden transition-transform duration-150 hover:-translate-y-0.5 flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-700 ring-1 ring-emerald-700'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                      <ParcelImage
                        src={item.imageUrl}
                        alt={item.title}
                        parcelReference={item.parcelReference}
                        lga={item.lga}
                      />
                    </div>
                    <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="truncate">
                            {item.lga} · {item.zoning} · {item.areaSqm.toLocaleString()} m²
                          </span>
                          <span
                            className={`font-medium shrink-0 ${
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

                      <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold text-slate-900 tabular-nums">
                            {formatNgn(item.priceNgn)}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                            {item.priceEth} ETH · {item.parcelReference}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-emerald-700 whitespace-nowrap">
                          {isSelected ? 'Selected' : 'Inspect'}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* Contiguous Purchase & Title Verification Module */}
          <div className="lg:col-span-5 lg:sticky lg:top-20 bg-white border border-slate-200 rounded-lg overflow-hidden">
            {!selectedListing ? (
              <div className="p-6 text-sm text-slate-500">
                Select any land parcel on the left to inspect spatial coordinates and purchase terms.
              </div>
            ) : (
              <div>
                <div className="aspect-[16/9] w-full bg-slate-100 overflow-hidden">
                  <ParcelImage
                    src={selectedListing.imageUrl}
                    alt={selectedListing.title}
                    parcelReference={selectedListing.parcelReference}
                    lga={selectedListing.lga}
                  />
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {selectedListing.parcelReference} · {selectedListing.lga}, {selectedListing.state}
                      </span>
                      <span
                        className={`font-semibold ${
                          selectedListing.status === 'AVAILABLE'
                            ? 'text-emerald-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {selectedListing.status === 'AVAILABLE' ? 'Available for Acquisition' : 'Acquired'}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-xl font-bold text-slate-900">
                      {selectedListing.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{selectedListing.address}</p>
                    <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                      {selectedListing.description}
                    </p>
                  </div>

                  {/* Price & Specs */}
                  <div className="py-3 border-y border-slate-200 flex items-baseline justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-500">Statutory Acquisition Price</div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">
                        {formatNgn(selectedListing.priceNgn)}
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs text-slate-600 tabular-nums">
                      <div>{selectedListing.priceEth} ETH</div>
                      <div>{selectedListing.areaSqm.toLocaleString()} m² · {selectedListing.zoning}</div>
                    </div>
                  </div>

                  {/* Verification Metadata */}
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Offering Source</dt>
                      <dd className="font-medium text-slate-900 text-right">
                        {selectedListing.sellerName}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Spatial Verification</dt>
                      <dd className="font-mono text-emerald-700">WGS 84 Clear · 0.0m Overlap</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Encumbrance Check</dt>
                      <dd className="font-mono text-slate-800">Section 28 Clear</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Coordinates (WKT)</dt>
                      <dd className="font-mono text-[11px] text-slate-600 truncate max-w-[210px]">
                        {selectedListing.wkt}
                      </dd>
                    </div>
                  </dl>

                  {/* OpenStreetMap Parcel Boundary View */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">
                        OpenStreetMap Parcel Location
                      </span>
                      <Link href="/map" className="text-emerald-700 font-medium hover:underline">
                        Open Full GIS Map →
                      </Link>
                    </div>
                    <OsmParcelMap
                      wkt={selectedListing.wkt}
                      label={selectedListing.parcelReference}
                      address={selectedListing.address}
                      heightClassName="h-48"
                    />
                  </div>

                  {selectedListing.status === 'SOLD' ? (
                    <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                      <div className="font-semibold text-slate-900">
                        Parcel Acquired by {selectedListing.buyerName}
                      </div>
                      <div className="font-mono text-slate-600">
                        Issued Title: Token #{selectedListing.tokenId}
                      </div>
                      {selectedListing.purchaseTxHash && (
                        <div className="font-mono text-[11px] text-slate-500 truncate">
                          Tx: {selectedListing.purchaseTxHash}
                        </div>
                      )}
                      <div className="pt-2">
                        <Link
                          href="/dashboard?tab=titles"
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Inspect Title Certificate in Console →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="buyer-legal-name"
                          className="block text-xs font-medium text-slate-700"
                        >
                          Buyer Legal Name (for Title Certificate)
                        </label>
                        <input
                          id="buyer-legal-name"
                          type="text"
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                          placeholder="e.g. Adebayo Ogunlesi (optional if using wallet)"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                        <span className="text-slate-600 truncate">
                          {wallet.isConnected && wallet.address
                            ? `${wallet.walletLabel}: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`
                            : 'No wallet paired yet'}
                        </span>
                        <button
                          type="button"
                          onClick={() => wallet.openModal()}
                          className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0"
                        >
                          {wallet.isConnected ? 'Switch / Manage' : 'Connect Wallet / QR'}
                        </button>
                      </div>

                      {user && selectedListing.sellerId === user.id ? (
                        <div className="p-3 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 text-center">
                          You Are the Listed Owner
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              disabled={buying}
                              onClick={() => handleWalletPurchase('metamask')}
                              className="py-3 px-3 text-xs font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded-md hover:bg-amber-200 disabled:opacity-50 transition-colors"
                            >
                              {buying ? 'Authorizing...' : `Buy with MetaMask · ${selectedListing.priceEth} ETH`}
                            </button>
                            <button
                              type="button"
                              disabled={buying}
                              onClick={() => handleWalletPurchase('trustwallet')}
                              className="py-3 px-3 text-xs font-semibold text-slate-900 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
                            >
                              {buying ? 'Authorizing...' : `Buy with Trust Wallet · ${selectedListing.priceEth} ETH`}
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={buying}
                            onClick={handleEscrowPurchase}
                            className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                          >
                            {buying
                              ? 'Settling & Issuing ERC-721 Title...'
                              : `Settle via Registry Escrow · ${formatNgn(selectedListing.priceNgn)}`}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <Link href="/map" className="text-emerald-700 hover:underline">
                          Inspect Polygon on GIS Map →
                        </Link>
                        <Link href="/dashboard?tab=titles" className="hover:underline">
                          View My Titles
                        </Link>
                      </div>
                    </div>
                  )}

                  {latestReceipt && (
                    <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 space-y-1.5 text-xs text-emerald-950">
                      <div className="font-semibold">
                        Acquisition Confirmed — Title #{latestReceipt.title.tokenId}
                      </div>
                      <div className="font-mono text-[11px]">
                        Parcel: {latestReceipt.purchase.parcelReference} · Method:{' '}
                        {latestReceipt.purchase.paymentMethod}
                      </div>
                      <div className="font-mono text-[11px] truncate">
                        Tx Hash: {latestReceipt.purchase.txHash}
                      </div>
                      <div className="pt-1">
                        <Link
                          href="/dashboard?tab=titles"
                          className="font-semibold text-emerald-800 underline"
                        >
                          Open Digital Title Certificate →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Acquisition Receipts Table */}
      {purchases.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Recorded Land Acquisitions ({purchases.length})
            </h2>
            <Link href="/dashboard?tab=titles" className="text-xs font-semibold text-emerald-700 hover:underline">
              Manage Titles in Console →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Parcel</th>
                  <th className="px-4 py-2.5 font-medium">Property</th>
                  <th className="px-4 py-2.5 font-medium">Token</th>
                  <th className="px-4 py-2.5 font-medium">Consideration</th>
                  <th className="px-4 py-2.5 font-medium">Settlement</th>
                  <th className="px-4 py-2.5 font-medium">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {p.parcelReference}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{p.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.address}, {p.lga}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-700 tabular-nums">
                      #{p.tokenId}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-900">
                      {formatNgn(p.priceNgn)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{p.paymentMethod}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {p.txHash.slice(0, 14)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
