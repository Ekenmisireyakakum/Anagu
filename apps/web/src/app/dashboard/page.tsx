'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import ApplicationsPanel from '../../components/dashboard/ApplicationsPanel';
import MonitoringAndAdminPanel from '../../components/dashboard/MonitoringAndAdminPanel';
import SubmitApplicationPanel from '../../components/dashboard/SubmitApplicationPanel';
import TitlesAndGovernancePanel from '../../components/dashboard/TitlesAndGovernancePanel';
import type {
  AuditLogEntry,
  DigitalLandTitle,
  LandApplicationRecord,
  MqttMessageLog,
  SafeUser,
} from '../../components/dashboard/types';

type DashboardTab = 'workflow' | 'submit' | 'titles' | 'mqtt' | 'audit' | 'users';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('workflow');
  const [applications, setApplications] = useState<LandApplicationRecord[]>([]);
  const [titles, setTitles] = useState<DigitalLandTitle[]>([]);
  const [mqttLogs, setMqttLogs] = useState<MqttMessageLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const loadWorkspaceData = useCallback(async (currentUser: SafeUser) => {
    setLoadingData(true);
    try {
      const [appsRes, titlesRes, mqttRes, auditRes] = await Promise.all([
        fetch('/api/applications'),
        fetch('/api/titles'),
        fetch('/api/notifications'),
        fetch('/api/audit'),
      ]);
      if (appsRes.ok) setApplications(await appsRes.json());
      if (titlesRes.ok) setTitles(await titlesRes.json());
      if (mqttRes.ok) setMqttLogs(await mqttRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());

      if (currentUser.role === 'LAND_ADMINISTRATOR' || currentUser.role === 'REGISTRAR') {
        const usersRes = await fetch('/api/users');
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
    fetch('/api/auth/me')
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
        if (me.role === 'GOVERNOR') {
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
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
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
        <main className="flex-1 max-w-xl mx-auto px-6 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Authentication Required</h1>
          <p className="text-sm text-slate-600">
            Sign in with a Citizen, Licensed Surveyor, Registrar, Land Administrator, or Executive Governor account to access the ANAGU registry console.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800"
            >
              Go to Sign In
            </Link>
            <Link
              href="/map"
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Open Public GIS Map
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const navTabs: Array<{ id: DashboardTab; label: string; count?: number }> = [
    { id: 'workflow', label: 'Applications & Workflow', count: applications.length },
    { id: 'submit', label: 'New Application & Offline Sync' },
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
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
              {user.role}
            </span>
            <div>
              <span className="text-sm font-semibold text-slate-900">{user.fullName}</span>
              <span className="ml-2 text-xs font-mono text-slate-500">{user.email}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-mono text-slate-500 hidden sm:inline">
              Wallet: {user.walletAddress.slice(0, 10)}...{user.walletAddress.slice(-6)}
            </span>
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
      </div>

      {/* Main Dashboard Layout: 260px Sidebar + Main Viewport */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6 items-start">
        <aside className="w-full lg:w-64 shrink-0 bg-white border border-slate-200 rounded-lg p-2">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
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
            <Link href="/map" className="block text-emerald-700 hover:underline">
              Inspect Parcels on GIS Map →
            </Link>
            <Link href="/evaluation" className="block text-emerald-700 hover:underline">
              Run Phase 7 Benchmark Suite →
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
