'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import { useWallet } from '../../components/WalletContext';
import { clearClientSessionToken, getAuthHeaders } from '../../lib/client-auth';
import { formatCompactTokenBalance } from '../../lib/metamask';
import ApplicationsPanel from '../../components/dashboard/ApplicationsPanel';
import MonitoringAndAdminPanel from '../../components/dashboard/MonitoringAndAdminPanel';
import SubmitApplicationPanel from '../../components/dashboard/SubmitApplicationPanel';
import TitlesAndGovernancePanel from '../../components/dashboard/TitlesAndGovernancePanel';
import MarketplaceClient from '../../components/marketplace/MarketplaceClient';
import type {
  AuditLogEntry,
  DigitalLandTitle,
  LandApplicationRecord,
  MqttMessageLog,
  SafeUser,
} from '../../components/dashboard/types';

type DashboardTab = 'workflow' | 'submit' | 'marketplace' | 'titles' | 'mqtt' | 'audit' | 'users';

export default function DashboardPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('workflow');
  const [applications, setApplications] = useState<LandApplicationRecord[]>([]);
  const [titles, setTitles] = useState<DigitalLandTitle[]>([]);
  const [mqttLogs, setMqttLogs] = useState<MqttMessageLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [pendingWalletLink, setPendingWalletLink] = useState(false);
  const [walletNotice, setWalletNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const loadWorkspaceData = useCallback(async (currentUser: SafeUser) => {
    setLoadingData(true);
    try {
      const authHeaders = getAuthHeaders();
      const [appsRes, titlesRes, mqttRes, auditRes] = await Promise.all([
        fetch('/api/applications', { credentials: 'include', headers: authHeaders }),
        fetch('/api/titles', { credentials: 'include', headers: authHeaders }),
        fetch('/api/notifications', { credentials: 'include', headers: authHeaders }),
        fetch('/api/audit', { credentials: 'include', headers: authHeaders }),
      ]);
      if (appsRes.ok) setApplications(await appsRes.json());
      if (titlesRes.ok) setTitles(await titlesRes.json());
      if (mqttRes.ok) setMqttLogs(await mqttRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());

      if (currentUser.role === 'LAND_ADMINISTRATOR' || currentUser.role === 'REGISTRAR') {
        const usersRes = await fetch('/api/users', {
          credentials: 'include',
          headers: authHeaders,
        });
        if (usersRes.ok) setUsersList(await usersRes.json());
      } else {
        setUsersList([]);
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', {
      cache: 'no-store',
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setUser(null);
          setAuthChecked(true);
          return;
        }
        const data = await res.json();
        const me = data.user as SafeUser;
        setUser(me);
        setAuthChecked(true);
        const tabParam =
          typeof window !== 'undefined'
            ? (new URLSearchParams(window.location.search).get('tab') as DashboardTab | null)
            : null;
        if (
          tabParam &&
          ['workflow', 'submit', 'marketplace', 'titles', 'mqtt', 'audit', 'users'].includes(
            tabParam,
          )
        ) {
          setActiveTab(tabParam);
        } else if (me.role === 'GOVERNOR') {
          setActiveTab('titles');
        } else if (me.role === 'LAND_ADMINISTRATOR') {
          setActiveTab('audit');
        }
        await loadWorkspaceData(me);
      })
      .catch(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, [loadWorkspaceData]);

  const handleSignOut = async () => {
    clearClientSessionToken();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('anagu-auth-changed'));
    }
    router.push('/login');
    router.refresh();
  };

  const completeWalletLink = useCallback(
    async (connectedAddress: string) => {
      if (!user) return;
      setWalletNotice(null);
      setLinkingWallet(true);
      try {
        const nonceRes = await fetch('/api/auth/metamask/nonce', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ address: connectedAddress }),
        });
        const challenge = await nonceRes.json();
        if (!nonceRes.ok) {
          throw new Error(challenge.message || 'Failed to issue wallet challenge');
        }

        const signature = await wallet.signMessage(challenge.message, connectedAddress);

        const verifyRes = await fetch('/api/auth/metamask/verify', {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            address: connectedAddress,
            signature,
            mode: 'link',
            challengeToken: challenge.challengeToken,
          }),
        });
        const verified = await verifyRes.json();
        if (!verifyRes.ok) {
          throw new Error(verified.message || 'Failed to verify Web3 signature');
        }

        setUser(verified.user as SafeUser);
        setWalletNotice({
          ok: true,
          text: `Web3 wallet ${connectedAddress} cryptographically linked to ${verified.user.email} (${verified.user.role}).`,
        });
        await loadWorkspaceData(verified.user as SafeUser);
      } catch (err) {
        setWalletNotice({
          ok: false,
          text: err instanceof Error ? err.message : 'Web3 wallet linking failed',
        });
      } finally {
        setLinkingWallet(false);
      }
    },
    [loadWorkspaceData, user, wallet],
  );

  useEffect(() => {
    if (pendingWalletLink && wallet.isConnected && wallet.address) {
      setPendingWalletLink(false);
      void completeWalletLink(wallet.address);
    } else if (pendingWalletLink && !wallet.isModalOpen && !wallet.isConnecting && !wallet.isConnected) {
      setPendingWalletLink(false);
    }
  }, [completeWalletLink, pendingWalletLink, wallet.address, wallet.isConnected, wallet.isConnecting, wallet.isModalOpen]);

  const handleLinkMetaMask = async () => {
    if (!user) return;
    setWalletNotice(null);
    wallet.clearError();
    const connectedAddress = wallet.address || (await wallet.connect());
    if (!connectedAddress) {
      setPendingWalletLink(true);
      return;
    }
    await completeWalletLink(connectedAddress);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-8 text-sm text-slate-600">
          Verifying statutory session...
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader />
        <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Authentication Required</h1>
          <p className="text-sm text-slate-600">
            Sign in with a Citizen, Licensed Surveyor, Registrar, Land Administrator, or Executive Governor account to access the ANAGU registry console.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Sign Up
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const navTabs: Array<{ id: DashboardTab; label: string; count?: number }> = [
    { id: 'workflow', label: 'Applications & Workflow', count: applications.length },
    { id: 'submit', label: 'Register Land & Offline Sync' },
    { id: 'marketplace', label: 'Access Land' },
    { id: 'titles', label: 'Land Titles & Section 28', count: titles.length },
    { id: 'mqtt', label: 'MQTT Notifications', count: mqttLogs.length },
    { id: 'audit', label: 'Audit Trail', count: auditLogs.length },
    ...(user.role === 'LAND_ADMINISTRATOR' || user.role === 'REGISTRAR'
      ? [{ id: 'users' as const, label: 'Users & RBAC', count: usersList.length }]
      : []),
  ];

  const activeTitlesCount = titles.filter((t) => !t.isRevoked).length;
  const revokedTitlesCount = titles.filter((t) => t.isRevoked).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      {/* Contextual Role Sub-header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
            <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded shrink-0">
              {user.role}
            </span>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-slate-900">{user.fullName}</span>
              <span className="block sm:inline sm:ml-2 text-xs font-mono text-slate-500 break-all">
                {user.email}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
            <span
              title={user.walletAddress}
              className={`px-2.5 py-1 font-mono rounded border ${
                user.walletVerified &&
                wallet.isConnected &&
                wallet.address?.toLowerCase() === user.walletAddress.toLowerCase()
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              Registry Wallet: {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
              {user.walletVerified ? ' · Verified' : ''}
            </span>

            {wallet.isConnected ? (
              <>
                <button
                  type="button"
                  title={`${wallet.walletLabel}: ${wallet.address} · ${wallet.balanceAlt ?? '0.00'} ALT · ${wallet.balanceEth ?? '0.0000'} ${wallet.nativeSymbol}`}
                  onClick={() => wallet.openModal()}
                  className="px-2.5 py-1.5 font-mono bg-amber-50 text-amber-900 border border-amber-200 rounded hover:bg-amber-100 transition-colors max-w-full truncate"
                >
                  {wallet.walletLabel}: {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                  {wallet.balanceAlt !== null
                    ? ` · ${formatCompactTokenBalance(wallet.balanceAlt)} ALT`
                    : ''}
                  {wallet.balanceEth !== null ? ` · ${wallet.balanceEth} ${wallet.nativeSymbol}` : ''}
                </button>
                {!wallet.isBesuNetwork && (
                  <button
                    type="button"
                    onClick={() => wallet.switchToBesu()}
                    className="px-2.5 py-1.5 font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200"
                  >
                    Switch to Besu (1337)
                  </button>
                )}
                {wallet.isBesuNetwork && (
                  <span className="px-2 py-1 font-mono text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                    Besu QBFT (1337)
                  </span>
                )}
                {wallet.address?.toLowerCase() !== user.walletAddress.toLowerCase() || !user.walletVerified ? (
                  <button
                    type="button"
                    disabled={linkingWallet}
                    onClick={handleLinkMetaMask}
                    className="px-3 py-1.5 font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded hover:bg-amber-200 disabled:opacity-50"
                  >
                    {linkingWallet ? 'Signing...' : 'Link Active MetaMask'}
                  </button>
                ) : null}
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={linkingWallet || wallet.isConnecting}
                  onClick={handleLinkMetaMask}
                  className="px-3 py-1.5 font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded hover:bg-amber-200 disabled:opacity-50"
                >
                  {linkingWallet || wallet.isConnecting ? 'Connecting...' : 'Connect & Link MetaMask'}
                </button>
                <button
                  type="button"
                  onClick={() => wallet.openModal()}
                  className="px-2.5 py-1.5 font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
                >
                  QR / Options
                </button>
              </div>
            )}

            <Link
              href="/login"
              className="px-3 py-1.5 font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200"
            >
              Switch Role
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
            >
              Sign Out
            </button>
          </div>
        </div>
        {(walletNotice || wallet.error) && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3">
            <div
              className={`px-3.5 py-2 rounded-md border text-xs ${
                walletNotice?.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {walletNotice?.text || wallet.error}
            </div>
          </div>
        )}
      </div>

      {/* Main Dashboard Layout: 260px Sidebar + Main Viewport */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col lg:flex-row gap-5 sm:gap-6 items-start">
        <aside className="w-full lg:w-64 shrink-0 bg-white border border-slate-200 rounded-lg p-2">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap text-left ${
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isActive ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="hidden lg:block mt-4 pt-3 border-t border-slate-200 px-2 pb-1 space-y-2 text-xs text-slate-600">
            <div className="font-semibold text-slate-800">Quick Tools</div>
            <Link href="/marketplace" className="block text-emerald-700 hover:underline">
              Access Land (Verified &amp; Unverified) →
            </Link>
            <Link href="/register-land" className="block text-emerald-700 hover:underline">
              Register New Land Parcel →
            </Link>
          </div>
        </aside>

        <section className="flex-1 min-w-0 w-full space-y-6">
          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Applications in Scope</div>
              <div className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {applications.length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Active ERC-721 Titles</div>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                {activeTitlesCount}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Section 28 Revoked</div>
              <div className="mt-1 text-2xl font-bold font-mono text-red-700 tabular-nums">
                {revokedTitlesCount}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Audit Events Recorded</div>
              <div className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                {auditLogs.length}
              </div>
            </div>
          </div>

          {loadingData && applications.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-sm text-slate-500">
              Loading registry records...
            </div>
          ) : (
            <>
              {activeTab === 'workflow' && (
                <ApplicationsPanel
                  user={user}
                  applications={applications}
                  onRefresh={() => loadWorkspaceData(user)}
                />
              )}
              {activeTab === 'submit' && (
                <SubmitApplicationPanel
                  user={user}
                  onSubmitted={async () => {
                    await loadWorkspaceData(user);
                    setActiveTab('workflow');
                  }}
                />
              )}
              {activeTab === 'marketplace' && (
                <MarketplaceClient
                  embedded
                  onPurchased={async () => {
                    await loadWorkspaceData(user);
                  }}
                />
              )}
              {activeTab === 'titles' && (
                <TitlesAndGovernancePanel
                  user={user}
                  titles={titles}
                  onRefresh={() => loadWorkspaceData(user)}
                />
              )}
              {(activeTab === 'mqtt' || activeTab === 'audit' || activeTab === 'users') && (
                <MonitoringAndAdminPanel
                  mode={activeTab}
                  user={user}
                  mqttLogs={mqttLogs}
                  auditLogs={auditLogs}
                  usersList={usersList}
                  onRefresh={() => loadWorkspaceData(user)}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
