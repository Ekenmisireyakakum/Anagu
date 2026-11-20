'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SiteHeader from '../../../components/SiteHeader';
import SiteFooter from '../../../components/SiteFooter';

const ADMIN_ROLES = new Set(['LAND_ADMINISTRATOR', 'REGISTRAR', 'GOVERNOR']);
const ADMIN_TOKEN_KEY = 'anagu_admin_token';

function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.sessionStorage.getItem(ADMIN_TOKEN_KEY) ||
    window.localStorage.getItem(ADMIN_TOKEN_KEY)
  );
}

function storeAdminToken(token: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    const token = getStoredAdminToken();
    fetch('/api/auth/me?optional=1', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    })
      .then(async (res) => {
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.user?.role && ADMIN_ROLES.has(data.user.role)) {
            router.replace('/admin');
            return;
          }
          clearAdminToken();
        } else {
          clearAdminToken();
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to sign in to Admin Portal');
      }
      if (data?.accessToken) {
        storeAdminToken(String(data.accessToken));
      }
      router.push('/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-14">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-5 sm:p-8 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-700">
              ANAGU Registry Governance
            </p>
            <h1 className="mt-1.5 text-xl sm:text-2xl font-bold text-slate-900">Admin Portal Sign In</h1>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Sign in with your administrator credentials to approve pending land submissions before they appear on Access Land, or revoke active land records.
            </p>
          </div>

          {checkingSession ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Checking existing administrator session...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-900">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Admin Email Address
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@anagu.gov.ng"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In to Admin Dashboard'}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-900 underline">
              ← Return to Home
            </Link>
            <span>Authorized Administrators Only</span>
          </div>
        </div>
      </main>

      <SiteFooter adminMode />
    </div>
  );
}
