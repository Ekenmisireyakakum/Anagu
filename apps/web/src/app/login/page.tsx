'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import { useFirebase } from '../../components/FirebaseContext';
import { useWallet } from '../../components/WalletContext';

const ROLE_ACCOUNTS = [
  {
    role: 'CITIZEN',
    label: 'Citizen / Land Applicant',
    email: 'citizen@anagu.gov.ng',
    password: 'Citizen123!',
    wallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    scope: 'Buy verified land parcels, submit registration applications, and manage digital titles',
  },
  {
    role: 'SURVEYOR',
    label: 'Licensed Surveyor',
    email: 'surveyor@anagu.gov.ng',
    password: 'Surveyor123!',
    wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    scope: 'Verify WGS 84 parcel geometry, detect 0.5m overlaps, file survey reports',
  },
  {
    role: 'REGISTRAR',
    label: 'Land Registrar',
    email: 'registrar@anagu.gov.ng',
    password: 'Registrar123!',
    wallet: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    scope: 'Review oracle checks, legal sign-off, mint ERC-721 titles, execute transfers',
  },
  {
    role: 'LAND_ADMINISTRATOR',
    label: 'Land Administrator',
    email: 'admin@anagu.gov.ng',
    password: 'Admin1234!',
    wallet: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    scope: 'Manage users & RBAC roles, inspect audit trail, monitor Besu ledger & MQTT',
  },
  {
    role: 'GOVERNOR',
    label: 'Executive Governor',
    email: 'governor@anagu.gov.ng',
    password: 'Governor123!',
    wallet: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    scope: 'Execute statutory title revocation under Land Use Act 1978 Section 28',
  },
];

function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
  return raw;
}

export default function LoginPage() {
  const router = useRouter();
  const wallet = useWallet();
  const firebase = useFirebase();
  const [nextPath, setNextPath] = useState('/dashboard');
  const [email, setEmail] = useState('citizen@anagu.gov.ng');
  const [password, setPassword] = useState('Citizen123!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mmLoading, setMmLoading] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);

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

  const handleMetaMaskSignIn = async () => {
    setError(null);
    wallet.clearError();
    setMmLoading(true);
    try {
      const connectedAddress = wallet.address || (await wallet.connect());
      if (!connectedAddress) {
        return;
      }

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
        throw new Error(verified.message || 'MetaMask signature verification failed');
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with MetaMask');
    } finally {
      setMmLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    firebase.clearAuthError();
    setFbLoading(true);
    try {
      const fbUser = await firebase.signInWithGoogle(wallet.address);
      if (!fbUser) {
        throw new Error(firebase.authError || 'Google sign-in was cancelled');
      }
      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName,
          emailVerified: fbUser.emailVerified,
          walletAddress: wallet.address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to start ANAGU Firebase session');
      }
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with Google');
    } finally {
      setFbLoading(false);
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
            Access the land marketplace, register new parcels, or open your registry workspace.
          </p>

          {(error || wallet.error) && (
            <div className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800">
              {error || wallet.error}
            </div>
          )}

          {/* MetaMask & Firebase Authentication */}
          <div className="mt-5 p-4 rounded-md bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Web3 & Cloud Auth
              </span>
              <button
                type="button"
                onClick={() => wallet.openModal()}
                className="text-[11px] font-mono text-emerald-700 hover:underline"
              >
                {wallet.isConnected
                  ? `${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)} · Options`
                  : wallet.isMetaMaskAvailable
                  ? 'MetaMask Detected · Options'
                  : 'QR / Standalone Tab Options'}
              </button>
            </div>
            <button
              type="button"
              disabled={mmLoading || wallet.isConnecting}
              onClick={handleMetaMaskSignIn}
              className="w-full py-2.5 px-4 text-sm font-semibold text-slate-900 bg-amber-100 border border-amber-300 rounded-md hover:bg-amber-200 disabled:opacity-50 transition-colors"
            >
              {mmLoading || wallet.isConnecting
                ? 'Awaiting MetaMask Signature...'
                : wallet.isConnected
                ? `Sign In with MetaMask (${wallet.address?.slice(0, 6)}...${wallet.address?.slice(-4)})`
                : 'Connect & Sign In with MetaMask'}
            </button>
            <button
              type="button"
              disabled={fbLoading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              {fbLoading ? 'Connecting Firebase...' : 'Continue with Google (Firebase Firestore)'}
            </button>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              MetaMask signs an EIP-191 <span className="font-mono">personal_sign</span> challenge; Google Sign-In enables persistent Cloud Firestore sync.
            </p>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <div className="flex-1 h-px bg-slate-200" />
            <span>or sign in with registry credentials</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
            No account required for landowners or buyers:{' '}
            <Link href="/marketplace" className="font-semibold text-emerald-700 hover:underline">
              Buy Land
            </Link>{' '}
            or{' '}
            <Link href="/register-land" className="font-semibold text-emerald-700 hover:underline">
              Register Land
            </Link>
            .
          </p>
        </div>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-base font-semibold text-slate-900">
            Statutory Role Evaluation Accounts
          </h2>
          <p className="text-xs text-slate-600 mt-1 mb-4">
            Select any authority tier below to sign in directly, or link your own MetaMask wallet from the dashboard after signing in.
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
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Genesis Wallet: {acct.wallet}
                  </p>
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
