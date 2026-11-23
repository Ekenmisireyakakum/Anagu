'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import OsmParcelMap from '../../components/map/OsmParcelMap';
import ParcelImage from '../../components/marketplace/ParcelImage';
import MonitoringAndAdminPanel from '../../components/dashboard/MonitoringAndAdminPanel';
import { useWallet } from '../../components/WalletContext';
import {
  distributeLandTokensOnPolygon,
  grantLandRegistryRolesOnPolygon,
} from '../../lib/metamask';
import { getPolygonExplorerAddressUrl, getPolygonExplorerTxUrl } from '../../lib/polygon-config';
import type {
  AuditLogEntry,
  DigitalLandTitle,
  LandApplicationRecord,
  LandListingRecord,
  RevocationGround,
  SafeUser,
} from '../../components/dashboard/types';

interface AdminChainStatus {
  mode: string;
  rpcConnected: boolean;
  blockNumber: number | null;
  chainId: number | null;
  roleStatus?: {
    registryRoleGranted: boolean | null;
    governorRoleGranted: boolean | null;
    ready: boolean;
  };
  contracts: Array<{
    name: string;
    standard: string;
    address: string | null;
    deployedOnChain: boolean;
  }>;
}

type AdminTab = 'pending' | 'active' | 'revoked' | 'audit' | 'users';

const ADMIN_ROLES = new Set(['LAND_ADMINISTRATOR', 'REGISTRAR', 'GOVERNOR']);
const ADMIN_TOKEN_KEY = 'anagu_admin_token';

function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ||
    window.localStorage.getItem(ADMIN_TOKEN_KEY)
  );
}

function clearAdminToken() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function getAdminHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredAdminToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface AdminOverviewResponse {
  user: SafeUser;
  pendingApplications: LandApplicationRecord[];
  rejectedApplications: LandApplicationRecord[];
  revokedApplications: LandApplicationRecord[];
  activeListings: LandListingRecord[];
  revokedListings: LandListingRecord[];
  titles: DigitalLandTitle[];
  auditLogs: AuditLogEntry[];
  stats: {
    pendingCount: number;
    activeCount: number;
    soldCount: number;
    revokedCount: number;
    titlesCount: number;
  };
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('pending');

  const [pendingApps, setPendingApps] = useState<LandApplicationRecord[]>([]);
  const [rejectedApps, setRejectedApps] = useState<LandApplicationRecord[]>([]);
  const [revokedApps, setRevokedApps] = useState<LandApplicationRecord[]>([]);
  const [activeListings, setActiveListings] = useState<LandListingRecord[]>([]);
  const [revokedListings, setRevokedListings] = useState<LandListingRecord[]>([]);
  const [titles, setTitles] = useState<DigitalLandTitle[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [chainStatus, setChainStatus] = useState<AdminChainStatus | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [altRecipient, setAltRecipient] = useState('');
  const [altAmount, setAltAmount] = useState('100000');
  const [altDistributeBusy, setAltDistributeBusy] = useState(false);
  const [stats, setStats] = useState({
    pendingCount: 0,
    activeCount: 0,
    soldCount: 0,
    revokedCount: 0,
    titlesCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [allowOverride, setAllowOverride] = useState(false);

  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [listingSearch, setListingSearch] = useState('');
  const [listingFilter, setListingFilter] = useState<'ALL' | 'AVAILABLE' | 'SOLD'>('ALL');
  const [revokeGrounds, setRevokeGrounds] = useState<RevocationGround>('Overriding Public Interest');
  const [revokeRef, setRevokeRef] = useState('LASG-ADM-REV-2026');
  const [revokeReason, setRevokeReason] = useState(
    'Administrative revocation executed under Section 28 of the Land Use Act 1978.',
  );

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, usersRes, chainRes] = await Promise.all([
        fetch('/api/admin/listings', {
          cache: 'no-store',
          credentials: 'include',
          headers: getAdminHeaders(),
        }),
        fetch('/api/users', {
          cache: 'no-store',
          credentials: 'include',
          headers: getAdminHeaders(),
        }),
        fetch('/api/blockchain/status', { cache: 'no-store' }),
      ]);

      if (chainRes.ok) {
        setChainStatus((await chainRes.json()) as AdminChainStatus);
      }

      if (overviewRes.status === 401 || overviewRes.status === 403) {
        clearAdminToken();
        router.replace('/admin/login');
        return;
      }

      if (overviewRes.ok) {
        const data = (await overviewRes.json()) as AdminOverviewResponse;
        setUser(data.user);
        setPendingApps(data.pendingApplications || []);
        setRejectedApps(data.rejectedApplications || []);
        setRevokedApps(data.revokedApplications || []);
        setActiveListings(data.activeListings || []);
        setRevokedListings(data.revokedListings || []);
        setTitles(data.titles || []);
        setAuditLogs(data.auditLogs || []);
        setStats(
          data.stats || {
            pendingCount: (data.pendingApplications || []).length,
            activeCount: (data.activeListings || []).filter((l) => l.status === 'AVAILABLE').length,
            soldCount: (data.activeListings || []).filter((l) => l.status === 'SOLD').length,
            revokedCount: (data.revokedListings || []).length,
            titlesCount: (data.titles || []).length,
          },
        );
        setSelectedAppId((prev) => {
          if (prev && (data.pendingApplications || []).some((a) => a.id === prev)) return prev;
          return data.pendingApplications?.[0]?.id || '';
        });
        setSelectedListingId((prev) => {
          if (prev && (data.activeListings || []).some((l) => l.id === prev)) return prev;
          return data.activeListings?.[0]?.id || '';
        });
      }

      if (usersRes.ok) {
        setUsersList(await usersRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', {
      credentials: 'include',
      headers: getAdminHeaders(),
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          clearAdminToken();
          router.replace('/admin/login');
          return;
        }
        const data = await res.json();
        const me = data.user as SafeUser;
        if (!me || !ADMIN_ROLES.has(me.role)) {
          clearAdminToken();
          router.replace('/admin/login');
          return;
        }
        setUser(me);
        setAuthChecked(true);
        await loadAdminData();
      })
      .catch(() => {
        if (active) router.replace('/admin/login');
      });
    return () => {
      active = false;
    };
  }, [loadAdminData, router]);

  const selectedApp = useMemo(
    () => pendingApps.find((a) => a.id === selectedAppId) || pendingApps[0] || null,
    [pendingApps, selectedAppId],
  );

  const filteredActiveListings = useMemo(() => {
    const q = listingSearch.trim().toLowerCase();
    return activeListings.filter((item) => {
      if (listingFilter !== 'ALL' && item.status !== listingFilter) return false;
      if (!q) return true;
      return (
        item.parcelReference.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.lga.toLowerCase().includes(q)
      );
    });
  }, [activeListings, listingFilter, listingSearch]);

  const selectedListing = useMemo(
    () =>
      filteredActiveListings.find((l) => l.id === selectedListingId) ||
      filteredActiveListings[0] ||
      null,
    [filteredActiveListings, selectedListingId],
  );

  const handleSignOut = async () => {
    clearAdminToken();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/admin/login');
    router.refresh();
  };

  const handleApproveApplication = async (app: LandApplicationRecord) => {
    setBusyId(app.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'APPROVE_APPLICATION',
          applicationId: app.id,
          notes: adminNotes.trim() || 'Approved by Administrator for Access Land listing.',
          adminOverride: allowOverride,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to approve land');
      }
      setAdminNotes('');
      setAllowOverride(false);
      setFeedback({
        type: 'ok',
        text: `Approved ${app.parcelReference} (${app.parcelTitle || app.address})! It is now verified and published on Access Land.`,
      });
      await loadAdminData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Approval failed',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectApplication = async (app: LandApplicationRecord) => {
    setBusyId(app.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'REJECT_APPLICATION',
          applicationId: app.id,
          reason: adminNotes.trim() || 'Rejected by Administrator during pre-listing review.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to reject land submission');
      setAdminNotes('');
      setFeedback({
        type: 'ok',
        text: `Rejected ${app.parcelReference}. It remains blocked from Access Land.`,
      });
      await loadAdminData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Rejection failed',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeApplication = async (app: LandApplicationRecord) => {
    setBusyId(app.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'REVOKE_APPLICATION',
          applicationId: app.id,
          reason: adminNotes.trim() || 'Revoked by Administrator prior to Access Land publication.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to revoke submission');
      setAdminNotes('');
      setFeedback({
        type: 'ok',
        text: `Revoked land submission ${app.parcelReference}.`,
      });
      await loadAdminData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Revocation failed',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeListing = async (listing: LandListingRecord) => {
    setBusyId(listing.id);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/listings', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'REVOKE_LISTING',
          listingId: listing.id,
          grounds: revokeGrounds,
          administrativeReference: revokeRef.trim() || `LASG-REV-${listing.parcelReference}`,
          reason: revokeReason.trim() || 'Revoked by Administrator.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to revoke listing');
      setFeedback({
        type: 'ok',
        text: `Revoked ${listing.parcelReference} (${listing.title}). It has been removed from Access Land and marked REVOKED.`,
      });
      await loadAdminData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Revocation failed',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleGrantPolygonRoles = async () => {
    setRoleBusy(true);
    setFeedback(null);
    try {
      if (!wallet.provider || !wallet.address) {
        await wallet.connect('any');
        return;
      }
      const res = await grantLandRegistryRolesOnPolygon(wallet.provider, wallet.address);
      setFeedback({
        type: 'ok',
        text: `LandRegistry roles authorized on Polygon Amoy (${[res.registryTxHash, res.governorTxHash].filter(Boolean).join(', ') || 'already active'}).`,
      });
      await new Promise((r) => setTimeout(r, 3500));
      await loadAdminData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to grant LandRegistry roles',
      });
    } finally {
      setRoleBusy(false);
    }
  };

  const handleDistributeAltTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    setAltDistributeBusy(true);
    setFeedback(null);
    try {
      if (!wallet.provider || !wallet.address) {
        await wallet.connect('any');
        return;
      }
      const res = await distributeLandTokensOnPolygon(
        wallet.provider,
        wallet.address,
        altRecipient.trim(),
        altAmount.trim(),
      );
      setFeedback({
        type: 'ok',
        text: `Successfully ${res.method === 'mint' ? 'minted' : 'transferred'} ${Number(
          altAmount,
        ).toLocaleString('en-US')} ALT on Polygon Amoy to ${altRecipient.trim()} (Tx: ${res.txHash} · ${getPolygonExplorerTxUrl(res.txHash, 80002)}).`,
      });
      await wallet.refreshBalance();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to send ALT tokens',
      });
    } finally {
      setAltDistributeBusy(false);
    }
  };

  if (!authChecked || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-8 text-sm text-slate-600">
          Verifying administrator session...
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Top Admin Header */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-700">
              ANAGU Land Registry Governance · Admin Panel
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
              Land Approval &amp; Statutory Revocation Dashboard
            </h1>
            <p className="mt-1 text-xs text-slate-600 break-words">
              Signed in as <strong className="text-slate-900">{user.fullName}</strong> ({user.email}) · Role:{' '}
              <span className="font-mono font-semibold text-emerald-800">{user.role}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <Link
              href="/marketplace"
              className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-300 border border-amber-400 rounded-md hover:bg-amber-400 transition-colors whitespace-nowrap"
            >
              View Access Land
            </Link>
            <button
              type="button"
              onClick={() => loadAdminData()}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </section>

        {/* KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4">
            <div className="text-xs text-slate-500">Pending Approval (Pre-Access Land)</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold font-mono text-amber-700 tabular-nums">
              {stats.pendingCount}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4">
            <div className="text-xs text-slate-500">Approved &amp; Live on Access Land</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold font-mono text-emerald-700 tabular-nums">
              {stats.activeCount}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4">
            <div className="text-xs text-slate-500">Acquired / Sold Parcels</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {stats.soldCount}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4">
            <div className="text-xs text-slate-500">Revoked Lands</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold font-mono text-red-700 tabular-nums">
              {stats.revokedCount}
            </div>
          </div>
        </section>

        {chainStatus && (
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Polygon Smart Contracts ({chainStatus.chainId === 137 ? 'Mainnet 137' : 'Amoy Testnet 80002'})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {chainStatus.rpcConnected
                    ? `Live RPC connected · Block #${chainStatus.blockNumber?.toLocaleString()}`
                    : 'Configured Polygon contract addresses'}
                </p>
              </div>
              <span
                className={`px-2.5 py-1 text-[11px] font-mono font-semibold border rounded ${
                  chainStatus.mode === 'LIVE_POLYGON_ONCHAIN'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                {chainStatus.mode}
              </span>
            </div>

            {chainStatus.roleStatus &&
              chainStatus.roleStatus.registryRoleGranted === false && (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                  <div>
                    <span className="font-semibold">One-time contract setup needed:</span> Grant{' '}
                    <code className="font-mono">REGISTRY_ROLE</code> &amp;{' '}
                    <code className="font-mono">GOVERNOR_ROLE</code> on{' '}
                    <code className="font-mono">LandTitleNFT</code> to{' '}
                    <code className="font-mono">LandRegistry</code> using the deployer wallet.
                  </div>
                  <button
                    type="button"
                    disabled={roleBusy}
                    onClick={() => void handleGrantPolygonRoles()}
                    className="px-3 py-1.5 rounded bg-amber-900 text-white font-semibold hover:bg-amber-950 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {roleBusy ? 'Sending...' : wallet.isConnected ? 'Grant Roles Now' : 'Connect Deployer Wallet'}
                  </button>
                </div>
              )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              {chainStatus.contracts.map((c) => (
                <div
                  key={c.name}
                  className="p-2.5 rounded-md bg-slate-50 border border-slate-200 min-w-0 space-y-1"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono font-semibold text-slate-900">{c.name}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                        c.deployedOnChain
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {c.deployedOnChain ? 'LIVE' : 'PENDING'}
                    </span>
                  </div>
                  {c.address && (
                    <a
                      href={getPolygonExplorerAddressUrl(c.address, chainStatus.chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-mono text-[10px] text-emerald-700 hover:underline truncate"
                    >
                      {c.address}
                    </a>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={handleDistributeAltTokens}
              className="pt-3 border-t border-slate-200 flex flex-col lg:flex-row lg:items-end gap-3 text-xs"
            >
              <div className="flex-1 min-w-0">
                <label className="block font-semibold text-slate-800 mb-1">
                  Treasury ALT Distributor — Fund Buyer Wallet (Polygon ERC-20)
                </label>
                <input
                  type="text"
                  required
                  value={altRecipient}
                  onChange={(e) => setAltRecipient(e.target.value)}
                  placeholder="Buyer 0x... wallet address (or click Fund ALT in Users & Roles)"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="w-full lg:w-40 shrink-0">
                <label className="block font-medium text-slate-700 mb-1">Amount (ALT)</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  required
                  value={altAmount}
                  onChange={(e) => setAltAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <button
                type="submit"
                disabled={altDistributeBusy}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {altDistributeBusy
                  ? 'Sending ALT...'
                  : wallet.isConnected
                  ? 'Mint / Send ALT on Polygon'
                  : 'Connect Treasury Wallet'}
              </button>
            </form>
          </section>
        )}

        {feedback && (
          <div
            className={`p-4 rounded-lg border text-sm ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-white border border-slate-200 rounded-lg p-1.5 flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto">
          {(
            [
              { id: 'pending', label: `Pending Approval (${pendingApps.length})` },
              { id: 'active', label: `Access Land & Revoke (${activeListings.length})` },
              { id: 'revoked', label: `Revoked Lands (${revokedListings.length + revokedApps.length})` },
              { id: 'audit', label: `Audit Trail (${auditLogs.length})` },
              { id: 'users', label: `Users & Roles (${usersList.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: PENDING APPROVALS BEFORE GOING TO ACCESS LAND */}
        {activeTab === 'pending' && (
          <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Land Submissions Awaiting Approval
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Submissions stay hidden from Access Land until approved here.
                  </p>
                </div>
                <span className="text-xs font-mono text-amber-700 font-semibold tabular-nums">
                  {pendingApps.length} Pending
                </span>
              </div>

              {pendingApps.length === 0 ? (
                <div className="p-8 text-sm text-slate-500 text-center">
                  No pending land submissions waiting for approval.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
                  {pendingApps.map((app) => {
                    const isSelected = selectedApp?.id === app.id;
                    const spatialOk = app.spatialVerification?.passed ?? true;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => {
                          setSelectedAppId(app.id);
                          setAllowOverride(false);
                        }}
                        className={`w-full text-left p-4 transition-colors hover:bg-slate-50 ${
                          isSelected ? 'bg-emerald-50/70' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">
                            {app.parcelReference}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                              spatialOk
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                            }`}
                          >
                            {spatialOk ? 'PENDING APPROVAL' : 'OVERLAP FLAGGED'}
                          </span>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 truncate">
                          {app.parcelTitle || app.address}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600 truncate">
                          {app.address} · {app.lga}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                          <span>Claimant: {app.claimantName}</span>
                          <span className="font-semibold text-emerald-700">
                            {app.priceUsd ? `$${app.priceUsd.toLocaleString()} USD` : 'Price TBD'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {rejectedApps.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold text-slate-600">
                    Rejected Submissions ({rejectedApps.length})
                  </div>
                  <div className="mt-1 space-y-1 text-[11px] text-slate-500 font-mono">
                    {rejectedApps.slice(0, 4).map((r) => (
                      <div key={r.id} className="truncate">
                        {r.parcelReference} · {r.address} ({r.registrarNotes || 'Rejected'})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Pending Application Dossier */}
            <div className="xl:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
              {!selectedApp ? (
                <div className="p-8 text-sm text-slate-500">
                  Select a pending land submission on the left to verify deeds and approve it for Access Land.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-bold text-slate-900">
                            {selectedApp.parcelReference}
                          </span>
                          <span className="px-2 py-0.5 text-[11px] font-mono rounded border bg-amber-50 text-amber-800 border-amber-200">
                            {selectedApp.status}
                          </span>
                        </div>
                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                          {selectedApp.parcelTitle || selectedApp.address}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {selectedApp.address} · {selectedApp.lga}, {selectedApp.state}
                        </p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <div className="text-xs text-slate-500">Asking Price</div>
                        <div className="text-lg font-bold text-slate-900 tabular-nums">
                          {selectedApp.priceUsd
                            ? `$${selectedApp.priceUsd.toLocaleString()} USD`
                            : 'Not Specified'}
                        </div>
                        {selectedApp.priceEth && (
                          <div className="text-xs font-mono text-emerald-700">
                            {selectedApp.priceEth} POL
                          </div>
                        )}
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 border border-slate-200 rounded-md p-3">
                      <div>
                        <dt className="text-slate-500">Claimant / Owner</dt>
                        <dd className="font-medium text-slate-900 mt-0.5">{selectedApp.claimantName}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Ownership Type</dt>
                        <dd className="font-medium text-slate-900 mt-0.5">
                          {selectedApp.ownershipType || 'Freehold'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Survey Plan</dt>
                        <dd className="font-mono text-slate-900 mt-0.5">
                          {selectedApp.surveyPlanNumber || 'N/A'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Deed / C of O</dt>
                        <dd className="font-mono text-slate-900 mt-0.5">
                          {selectedApp.deedReference || 'N/A'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* GIS & Map */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-wide text-slate-700">
                        GIS Boundary &amp; Spatial Check
                      </span>
                      <span
                        className={`font-mono font-semibold ${
                          selectedApp.spatialVerification?.passed ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {selectedApp.spatialVerification
                          ? selectedApp.spatialVerification.passed
                            ? `PASSED · ${selectedApp.spatialVerification.areaSqm.toLocaleString()} m²`
                            : `WARNING: ${
                                selectedApp.spatialVerification.errorDetails ||
                                `Overlaps ${selectedApp.spatialVerification.overlappingParcels
                                  .map((p) => p.parcelNumber)
                                  .join(', ')}`
                              }`
                          : 'PENDING CHECK'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                      <div className="md:col-span-5 space-y-1">
                        <div className="text-[11px] font-medium text-slate-600">
                          Access Land Display Image
                        </div>
                        <div className="h-48 w-full rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                          <ParcelImage
                            src={selectedApp.siteImageUrl}
                            alt={selectedApp.parcelTitle || selectedApp.address}
                            parcelReference={selectedApp.parcelReference}
                            lga={selectedApp.lga}
                            wkt={selectedApp.wkt}
                            verificationStatus="UNVERIFIED"
                            status={selectedApp.status}
                          />
                        </div>
                      </div>
                      <div className="md:col-span-7 space-y-1">
                        <div className="text-[11px] font-medium text-slate-600">
                          Interactive GIS Verification Map
                        </div>
                        <OsmParcelMap
                          wkt={selectedApp.wkt}
                          label={selectedApp.parcelReference}
                          address={selectedApp.address}
                          heightClassName="h-48"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 break-all">
                      WKT: {selectedApp.wkt}
                    </p>
                  </div>

                  {/* Deed Documents */}
                  <div className="p-5 space-y-2.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      Uploaded Deed &amp; Survey Documents ({selectedApp.documents.length})
                    </h4>
                    {selectedApp.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2"
                      >
                        <span className="font-medium text-slate-900">
                          {doc.category ? `[${doc.category}] ` : ''}
                          {doc.fileName} ({Math.round(doc.fileSizeBytes / 1024)} KB)
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 truncate max-w-xs">
                          SHA-256: {doc.sha256Hash}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Admin Decision Controls */}
                  <div className="p-5 bg-slate-50 space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Administrator Decision Notes
                    </label>
                    <input
                      type="text"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Enter deed verification note, approval remark, or rejection/revocation reason..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />

                    {selectedApp.spatialVerification && !selectedApp.spatialVerification.passed && (
                      <label className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowOverride}
                          onChange={(e) => setAllowOverride(e.target.checked)}
                          className="rounded border-amber-400 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>
                          Spatial overlap detected — check to confirm Administrator override if approving anyway
                        </span>
                      </label>
                    )}

                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={busyId === selectedApp.id}
                        onClick={() => handleApproveApplication(selectedApp)}
                        className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                      >
                        {busyId === selectedApp.id
                          ? 'Approving...'
                          : 'Approve Land & Publish to Access Land'}
                      </button>

                      <button
                        type="button"
                        disabled={busyId === selectedApp.id}
                        onClick={() => handleRejectApplication(selectedApp)}
                        className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50"
                      >
                        Reject Submission
                      </button>

                      <button
                        type="button"
                        disabled={busyId === selectedApp.id}
                        onClick={() => handleRevokeApplication(selectedApp)}
                        className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800 disabled:opacity-50"
                      >
                        Revoke Land
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 2: ACTIVE ACCESS LAND LISTINGS & REVOKE CONTROL */}
        {activeTab === 'active' && (
          <section className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <input
                type="search"
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                placeholder="Search Access Land parcels by code, title, address, or LGA..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                {(['ALL', 'AVAILABLE', 'SOLD'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setListingFilter(st)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                      listingFilter === st
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? 'All Live' : st === 'AVAILABLE' ? 'Available' : 'Acquired'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <div className="xl:col-span-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Approved Lands on Access Land ({filteredActiveListings.length})
                  </h2>
                  <span className="text-xs font-mono text-slate-500">Select to inspect or revoke</span>
                </div>

                {filteredActiveListings.length === 0 ? (
                  <div className="p-8 text-sm text-slate-500 text-center">
                    No active Access Land parcels match your filter.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 max-h-[680px] overflow-y-auto">
                    {filteredActiveListings.map((item) => {
                      const isSelected = selectedListing?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedListingId(item.id)}
                          className={`w-full text-left p-4 transition-colors hover:bg-slate-50 ${
                            isSelected ? 'bg-emerald-50/70' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {item.parcelReference}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-mono rounded border ${
                                item.status === 'AVAILABLE'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {item.status === 'AVAILABLE' ? 'APPROVED · AVAILABLE' : 'ACQUIRED / SOLD'}
                            </span>
                          </div>
                          <div className="mt-1 text-sm font-semibold text-slate-900 truncate">
                            {item.title}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600 truncate">
                            {item.address} · {item.lga}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                            <span>
                              {item.tokenId ? `Token #${item.tokenId}` : 'Pre-minted Allocation'} ·{' '}
                              {item.buyerName ? `Buyer: ${item.buyerName}` : `Seller: ${item.sellerName}`}
                            </span>
                            <span className="font-semibold text-slate-900">
                              ${(item.priceUsd || 0).toLocaleString()} USD
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Active Listing + Revoke Form */}
              <div className="xl:col-span-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
                {!selectedListing ? (
                  <div className="p-8 text-sm text-slate-500">
                    Select an Access Land parcel to inspect its coordinates or execute a statutory revocation.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    <div className="p-5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {selectedListing.parcelReference}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] font-mono rounded border bg-emerald-50 text-emerald-800 border-emerald-200">
                          {selectedListing.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{selectedListing.title}</h3>
                      <p className="text-xs text-slate-600">
                        {selectedListing.address} · {selectedListing.lga}, {selectedListing.state} ·{' '}
                        {selectedListing.areaSqm.toLocaleString()} m²
                      </p>
                      <div className="pt-2 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                        <div className="md:col-span-5 space-y-1">
                          <div className="text-[11px] font-medium text-slate-600">
                            Access Land Display Image
                          </div>
                          <div className="h-44 w-full rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                            <ParcelImage
                              src={selectedListing.imageUrl}
                              alt={selectedListing.title}
                              parcelReference={selectedListing.parcelReference}
                              lga={selectedListing.lga}
                              wkt={selectedListing.wkt}
                              verificationStatus={selectedListing.verificationStatus}
                              status={selectedListing.status}
                            />
                          </div>
                        </div>
                        <div className="md:col-span-7 space-y-1">
                          <div className="text-[11px] font-medium text-slate-600">
                            Interactive GIS Boundary Map
                          </div>
                          <OsmParcelMap
                            wkt={selectedListing.wkt}
                            label={selectedListing.parcelReference}
                            address={selectedListing.address}
                            heightClassName="h-44"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-red-50/40 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-red-900">
                          Revoke Land Parcel (Remove from Access Land)
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Revoking removes this parcel from Access Land immediately, marks the GIS boundary revoked, and revokes any linked ERC-721 title under Section 28.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Statutory Ground
                          </label>
                          <select
                            value={revokeGrounds}
                            onChange={(e) => setRevokeGrounds(e.target.value as RevocationGround)}
                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                          >
                            <option value="Overriding Public Interest">Overriding Public Interest</option>
                            <option value="Breach of Statutory Condition">
                              Breach of Statutory Condition
                            </option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Gazette / Order Reference
                          </label>
                          <input
                            type="text"
                            value={revokeRef}
                            onChange={(e) => setRevokeRef(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-md bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Revocation Reason / Justification
                        </label>
                        <textarea
                          rows={2}
                          value={revokeReason}
                          onChange={(e) => setRevokeReason(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={busyId === selectedListing.id}
                        onClick={() => handleRevokeListing(selectedListing)}
                        className="px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-md hover:bg-red-800 disabled:opacity-50 transition-colors"
                      >
                        {busyId === selectedListing.id
                          ? 'Revoking Land...'
                          : `Revoke ${selectedListing.parcelReference} & Remove from Access Land`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* TAB 3: REVOKED LANDS */}
        {activeTab === 'revoked' && (
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-900">
                  Revoked Land Parcels &amp; Section 28 Titles
                </h2>
                <p className="text-xs text-slate-500">
                  Revoked lands are permanently hidden from Access Land and blocked from transfers or purchases.
                </p>
              </div>
              <span className="text-xs font-mono text-red-700 font-semibold shrink-0">
                {revokedListings.length + revokedApps.length} Records
              </span>
            </div>

            {revokedListings.length === 0 && revokedApps.length === 0 ? (
              <div className="p-8 text-sm text-slate-500 text-center">
                No lands have been revoked yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {revokedListings.map((item) => {
                  const linkedTitle = titles.find(
                    (t) =>
                      t.tokenId === item.tokenId ||
                      t.parcelReference.toLowerCase() === item.parcelReference.toLowerCase(),
                  );
                  return (
                    <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900">
                            {item.parcelReference}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded border bg-red-50 text-red-800 border-red-200">
                            REVOKED
                          </span>
                          {item.tokenId && (
                            <span className="text-xs font-mono text-slate-500">
                              Token #{item.tokenId}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">{item.title}</div>
                        <div className="text-xs text-slate-600">{item.address} · {item.lga}</div>
                        {linkedTitle?.revocationJustification && (
                          <div className="mt-1.5 text-xs text-red-900 bg-red-50 border border-red-200 rounded px-2.5 py-1.5">
                            <strong>{linkedTitle.revocationGrounds}</strong> · Ref:{' '}
                            {linkedTitle.revocationReference} — {linkedTitle.revocationJustification}
                          </div>
                        )}
                      </div>
                      <div className="sm:text-right text-xs font-mono text-slate-500 shrink-0">
                        {linkedTitle?.revokedAt
                          ? `Revoked ${new Date(linkedTitle.revokedAt).toLocaleString()}`
                          : 'Removed from Access Land'}
                      </div>
                    </div>
                  );
                })}

                {revokedApps
                  .filter(
                    (app) =>
                      !revokedListings.some(
                        (l) => l.parcelReference.toLowerCase() === app.parcelReference.toLowerCase(),
                      ),
                  )
                  .map((app) => (
                    <div key={app.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900">
                            {app.parcelReference}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-mono rounded border bg-red-50 text-red-800 border-red-200">
                            REVOKED SUBMISSION
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">
                          {app.parcelTitle || app.address}
                        </div>
                        <div className="text-xs text-slate-600">
                          {app.address} · {app.lga} · Claimant: {app.claimantName}
                        </div>
                        {app.registrarNotes && (
                          <p className="mt-1 text-xs text-red-800">{app.registrarNotes}</p>
                        )}
                      </div>
                      <div className="sm:text-right text-xs font-mono text-slate-500 shrink-0">
                        Updated {new Date(app.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 4: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <MonitoringAndAdminPanel
            mode="audit"
            user={user}
            mqttLogs={[]}
            auditLogs={auditLogs}
            usersList={usersList}
            onRefresh={loadAdminData}
          />
        )}

        {/* TAB 5: USERS & ROLES */}
        {activeTab === 'users' && (
          <MonitoringAndAdminPanel
            mode="users"
            user={user}
            mqttLogs={[]}
            auditLogs={auditLogs}
            usersList={usersList}
            onRefresh={loadAdminData}
            onFundWallet={(walletAddr, userName) => {
              setAltRecipient(walletAddr);
              setFeedback({
                type: 'ok',
                text: `Loaded ${userName}'s wallet (${walletAddr}) into the Treasury ALT Distributor above.`,
              });
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          />
        )}
      </main>

      <SiteFooter adminMode />
    </div>
  );
}
