'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { useWallet } from '../../components/WalletContext';
import { POLYGON_CHAIN_ID } from '../../lib/metamask';

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/register-land';
  return raw;
}

export default function RegisterPage() {
  const router = useRouter();
  const wallet = useWallet();

  const [nextPath, setNextPath] = useState('/register-land');
  const [signupTab, setSignupTab] = useState<'wallet' | 'email'>('wallet');

  // Optional profile details auto-populated / editable for wallet sign-up
  const [walletDisplayName, setWalletDisplayName] = useState('');
  const [walletEmail, setWalletEmail] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);
  const [pendingWalletSignup, setPendingWalletSignup] = useState(false);

  // Simple Email Sign-Up state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(sanitizeNextPath(params.get('next')));
  }, []);

  useEffect(() => {
    if (wallet.address && !walletDisplayName.trim()) {
      setWalletDisplayName(
        `Land Owner (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)})`,
      );
    }
  }, [wallet.address, walletDisplayName]);

  const completeWalletSignup = async (connectedAddress: string) => {
    setError(null);
    setNotice(null);
    setWalletBusy(true);
    try {
      const nonceRes = await fetch('/api/auth/metamask/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: connectedAddress }),
      });
      const challenge = await nonceRes.json();
      if (!nonceRes.ok) {
        throw new Error(challenge.message || 'Unable to prepare wallet sign-up challenge');
      }

      const signature = await wallet.signMessage(challenge.message, connectedAddress);

      const verifyRes = await fetch('/api/auth/metamask/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: connectedAddress,
          signature,
          mode: 'login',
          fullName: walletDisplayName.trim() || undefined,
          email: walletEmail.trim() || undefined,
        }),
      });
      const verified = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verified.message || 'Wallet sign-up verification failed');
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete wallet sign-up');
    } finally {
      setWalletBusy(false);
    }
  };

  useEffect(() => {
    if (pendingWalletSignup && wallet.isConnected && wallet.address) {
      setPendingWalletSignup(false);
      void completeWalletSignup(wallet.address);
    } else if (
      pendingWalletSignup &&
      !wallet.isModalOpen &&
      !wallet.isConnecting &&
      !wallet.isConnected
    ) {
      setPendingWalletSignup(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pendingWalletSignup,
    wallet.isConnected,
    wallet.address,
    wallet.isModalOpen,
    wallet.isConnecting,
  ]);

  const handleConnectWallet = async () => {
    setError(null);
    wallet.clearError();
    const addr = wallet.address || (await wallet.connect());
    if (!addr) {
      setNotice('Select your wallet in the connection popup to load your wallet details.');
    }
  };

  const handleWalletSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    wallet.clearError();
    if (!wallet.address) {
      const addr = await wallet.connect();
      if (!addr) {
        setPendingWalletSignup(true);
        return;
      }
      await completeWalletSignup(addr);
      return;
    }
    await completeWalletSignup(wallet.address);
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setEmailBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          walletAddress: wallet.address || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to create account');
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setEmailBusy(false);
    }
  };

  const isPolygon = wallet.chainId === 137 || wallet.chainId === 80002;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 shadow-sm space-y-6">
          <div>
            <p className="text-xs font-mono font-semibold text-emerald-700">
              ANAGU GIS Land Registry · Polygon Dual-Token Ready
            </p>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Create Your Account
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Sign up in seconds with your Web3 wallet (auto-fills your wallet details) or use a simple email &amp; password.
            </p>
          </div>

          {(error || wallet.error) && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800">
              {error || wallet.error}
            </div>
          )}

          {notice && (
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900">
              {notice}
            </div>
          )}

          {/* Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSignupTab('wallet');
              }}
              className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
                signupTab === 'wallet'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign Up with Wallet
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSignupTab('email');
              }}
              className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
                signupTab === 'email'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simple Email Sign Up
            </button>
          </div>

          {signupTab === 'wallet' ? (
            <form onSubmit={handleWalletSignUpSubmit} className="space-y-5">
              {!wallet.isConnected || !wallet.address ? (
                <div className="p-4 sm:p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-center">
                  <p className="text-sm font-semibold text-slate-900">
                    Connect MetaMask, Trust Wallet, or Any Web3 Wallet
                  </p>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    Your wallet address, Polygon network status, and native balance will load automatically to set up your account—no forms or passwords needed.
                  </p>
                  <div className="pt-1 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-2.5">
                    <button
                      type="button"
                      disabled={wallet.isConnecting}
                      onClick={() => void handleConnectWallet()}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                    >
                      {wallet.isConnecting ? 'Connecting Wallet...' : 'Connect Web3 Wallet'}
                    </button>
                    <button
                      type="button"
                      onClick={() => wallet.openModal('all')}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Wallet Options / Mobile QR
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-900">
                      Wallet Details Fetched ({wallet.walletLabel})
                    </span>
                    <button
                      type="button"
                      onClick={() => wallet.openModal('all')}
                      className="text-xs font-semibold text-emerald-800 underline"
                    >
                      Switch Wallet
                    </button>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white border border-emerald-200/80 rounded-md p-2.5 sm:col-span-2">
                      <dt className="text-[11px] text-slate-500">Wallet Address</dt>
                      <dd className="font-mono font-semibold text-slate-900 break-all mt-0.5">
                        {wallet.address}
                      </dd>
                    </div>
                    <div className="bg-white border border-emerald-200/80 rounded-md p-2.5">
                      <dt className="text-[11px] text-slate-500">Balance &amp; Network</dt>
                      <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                        {wallet.balanceEth !== null ? `${wallet.balanceEth} ` : ''}
                        {isPolygon ? 'POL' : 'ETH'}
                      </dd>
                      <dd className="text-[11px] text-slate-600 truncate">{wallet.chainName}</dd>
                    </div>
                  </dl>

                  {!isPolygon && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                      <span className="text-slate-600">
                        Switch your wallet to Polygon for ERC-721 &amp; ERC-20 land transactions:
                      </span>
                      <button
                        type="button"
                        onClick={() => void wallet.switchChain(POLYGON_CHAIN_ID)}
                        className="px-2.5 py-1 font-semibold text-purple-900 bg-purple-100 border border-purple-200 rounded hover:bg-purple-200"
                      >
                        Switch to Polygon
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="wallet-display-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Display Name <span className="font-normal text-slate-500">(Auto-filled)</span>
                  </label>
                  <input
                    id="wallet-display-name"
                    type="text"
                    value={walletDisplayName}
                    onChange={(e) => setWalletDisplayName(e.target.value)}
                    placeholder="Your Name (optional)"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="wallet-email-input"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Email <span className="font-normal text-slate-500">(Optional)</span>
                  </label>
                  <input
                    id="wallet-email-input"
                    type="email"
                    value={walletEmail}
                    onChange={(e) => setWalletEmail(e.target.value)}
                    placeholder="you@example.com (optional)"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={walletBusy || wallet.isConnecting}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {walletBusy
                  ? 'Verifying Signature & Creating Account...'
                  : wallet.isConnected
                  ? 'Sign & Create Account with Wallet'
                  : 'Connect Wallet & Sign Up'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div>
                <label
                  htmlFor="signup-fullname"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Full Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="signup-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label
                  htmlFor="signup-password"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Password <span className="text-red-600">*</span>
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {wallet.isConnected && wallet.address && (
                <div className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 break-all">
                  Connected wallet will be auto-linked: {wallet.address}
                </div>
              )}

              <button
                type="submit"
                disabled={emailBusy}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                {emailBusy ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-emerald-700 hover:underline">
                Sign In →
              </Link>
            </span>
            <Link href="/register-land" className="font-semibold text-slate-800 hover:underline">
              Skip straight to Map &amp; Register Land →
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
