'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

const ROLE_ACCOUNTS = [
  {
    role: 'CITIZEN',
    label: 'Citizen / Land Applicant',
    email: 'citizen@anagu.gov.ng',
    password: 'Citizen123!',
    scope: 'Submit applications, upload hashed deeds, track progress, test offline queue',
  },
  {
    role: 'SURVEYOR',
    label: 'Licensed Surveyor',
    email: 'surveyor@anagu.gov.ng',
    password: 'Surveyor123!',
    scope: 'Verify WGS 84 parcel geometry, detect 0.5m overlaps, file survey reports',
  },
  {
    role: 'REGISTRAR',
    label: 'Land Registrar',
    email: 'registrar@anagu.gov.ng',
    password: 'Registrar123!',
    scope: 'Review oracle checks, legal sign-off, mint ERC-721 titles, execute transfers',
  },
  {
    role: 'LAND_ADMINISTRATOR',
    label: 'Land Administrator',
    email: 'admin@anagu.gov.ng',
    password: 'Admin1234!',
    scope: 'Manage users & RBAC roles, inspect audit trail, monitor Besu ledger & MQTT',
  },
  {
    role: 'GOVERNOR',
    label: 'Executive Governor',
    email: 'governor@anagu.gov.ng',
    password: 'Governor123!',
    scope: 'Execute statutory title revocation under Land Use Act 1978 Section 28',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('citizen@anagu.gov.ng');
  const [password, setPassword] = useState('Citizen123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const performLogin = async (targetEmail: string, targetPassword: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Authentication failed');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-slate-900">Sign In to ANAGU</h1>
          <p className="text-sm text-slate-600 mt-1">
            Access your role-governed land administration workspace.
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-5 text-xs text-slate-600">
            New citizen applicant?{' '}
            <Link href="/register" className="font-semibold text-emerald-700 hover:underline">
              Create a Citizen Account
            </Link>
          </p>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Statutory Role Evaluation Accounts
          </h2>
          <p className="text-xs text-slate-600 mt-1 mb-4">
            Select any authority tier below to sign in directly and verify backend role-based access control.
          </p>

          <div className="divide-y divide-slate-200 border-t border-slate-200">
            {ROLE_ACCOUNTS.map((acct) => (
              <div
                key={acct.role}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {acct.label}
                    <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                      {acct.email}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{acct.scope}</p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEmail(acct.email);
                    setPassword(acct.password);
                    performLogin(acct.email, acct.password);
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                >
                  Sign In as {acct.role.replace('_', ' ')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
