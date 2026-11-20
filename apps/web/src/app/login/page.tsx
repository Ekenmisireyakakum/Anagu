'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { useWallet } from '../../components/WalletContext';

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/register-land';
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [nextPath, setNextPath] = useState('/register-land');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mmLoading, setMmLoading] = useState(false);
  const [sbLoading, setSbLoading] = useState(false);
  const [sbEmail, setSbEmail] = useState('');
  const [sbPassword, setSbPassword] = useState('');
  const [showSupabaseForm, setShowSupabaseForm] = useState(false);
  const [pendingWalletSignIn, setPendingWalletSignIn] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get('next')));
  }, []);

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
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  const completeWalletChallengeLogin = async (connectedAddress: string) => {
    setError(null);
    setMmLoading(true);
    try {
      const nonceRes = await fetch('/api/auth/metamask/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: connectedAddress }),
      });
      const challenge = await nonceRes.json();
      if (!nonceRes.ok) {
        throw new Error(challenge.message || 'Unable to generate wallet challenge');
      }

      const signature = await wallet.signMessage(challenge.message, connectedAddress);

      const verifyRes = await fetch('/api/auth/metamask/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: connectedAddress,
          signature,
          mode: 'login',
        }),
      });
      const verified = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verified.message || 'Web3 wallet signature verification failed');
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with Web3 wallet');
    } finally {
      setMmLoading(false);
    }
  };

  useEffect(() => {
    if (pendingWalletSignIn && wallet.isConnected && wallet.address) {
      setPendingWalletSignIn(false);
      void completeWalletChallengeLogin(wallet.address);
    } else if (
      pendingWalletSignIn &&
      !wallet.isModalOpen &&
      !wallet.isConnecting &&
      !wallet.isConnected
    ) {
      setPendingWalletSignIn(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingWalletSignIn,
    wallet.isConnected,
    wallet.address,
    wallet.isModalOpen,
    wallet.isConnecting,
  ]);

  const handleWalletSignIn = async () => {
    setError(null);
    wallet.clearError();
    const connectedAddress = wallet.address || (await wallet.connect());
    if (!connectedAddress) {
      setPendingWalletSignIn(true);
      return;
    }
    await completeWalletChallengeLogin(connectedAddress);
  };

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSbLoading(true);
    try {
      const res = await fetch('/api/auth/supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'signin',
          email: sbEmail,
          password: sbPassword,
          walletAddress: wallet.address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to authenticate with Supabase');
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with Supabase');
    } finally {
      setSbLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performLogin(email, password);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm space-y-5">
          <div>
            <p className="text-xs font-mono font-semibold text-emerald-700">
              ANAGU GIS Land Registry
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Sign In</h1>
            <p className="text-sm text-slate-600 mt-1">
              Sign in with your Web3 wallet or account credentials to manage mapped lands and Polygon ERC-721 titles.
            </p>
          </div>

          {(error || wallet.error) && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800">
              {error || wallet.error}
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900">
              {notice}
            </div>
          )}

          {/* Wallet Quick Sign In */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Quick Web3 Wallet Sign In
              </span>
              <button
                type="button"
                onClick={() => wallet.openModal('all')}
                className="text-[11px] font-mono text-emerald-700 hover:underline"
              >
                {wallet.isConnected
                  ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)} · ${wallet.chainName}`
                  : 'Wallet Options / QR'}
              </button>
            </div>
            <button
              type="button"
              disabled={mmLoading || wallet.isConnecting}
              onClick={handleWalletSignIn}
              className="w-full py-2.5 px-4 text-sm font-semibold text-slate-900 bg-amber-200 border border-amber-300 rounded-lg hover:bg-amber-300 disabled:opacity-50 transition-colors"
            >
              {mmLoading || wallet.isConnecting
                ? 'Awaiting Wallet Signature...'
                : wallet.isConnected
                ? `Sign In with ${wallet.walletLabel} (${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)})`
                : 'Connect & Sign In with Wallet'}
            </button>
            <button
              type="button"
              onClick={() => setShowSupabaseForm((v) => !v)}
              className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {showSupabaseForm ? 'Hide Supabase Auth' : 'Sign In with Supabase Auth'}
            </button>

            {showSupabaseForm && (
              <form onSubmit={handleSupabaseAuth} className="pt-2 border-t border-slate-200 space-y-2.5">
                <input
                  type="email"
                  required
                  value={sbEmail}
                  onChange={(e) => setSbEmail(e.target.value)}
                  placeholder="Supabase Email"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={sbPassword}
                  onChange={(e) => setSbPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
                <button
                  type="submit"
                  disabled={sbLoading}
                  className="w-full py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
                >
                  {sbLoading ? 'Signing in...' : 'Sign In with Supabase'}
                </button>
              </form>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            <span>or sign in with email</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              New here?{' '}
              <Link href="/register" className="font-semibold text-emerald-700 hover:underline">
                Create Account / Wallet Sign Up →
              </Link>
            </span>
            <Link href="/admin/login" className="font-medium text-slate-500 hover:text-slate-800">
              Admin Login
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
