'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { fetchAuthUser, getCachedAuthUser, hasResolvedAuth } from '../lib/client-auth';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

interface AuthRequiredGateProps {
  children: ReactNode;
  nextPath: string;
  title?: string;
  description?: string;
  initialAuthenticated?: boolean;
  includeFooter?: boolean;
}

export default function AuthRequiredGate({
  children,
  nextPath,
  title = 'Sign Up or Log In to Continue',
  description = 'Create an account or log in to access Register Land, Access Land, GIS Map, and Web3 wallet tools.',
  initialAuthenticated,
  includeFooter = false,
}: AuthRequiredGateProps) {
  const cachedUser = typeof window !== 'undefined' ? getCachedAuthUser() : null;
  const cachedResolved = typeof window !== 'undefined' && hasResolvedAuth();
  const [authChecked, setAuthChecked] = useState(
    () => initialAuthenticated === true || cachedResolved,
  );
  const [authenticated, setAuthenticated] = useState(
    () => initialAuthenticated === true || Boolean(cachedUser),
  );

  useEffect(() => {
    let active = true;

    const checkSession = () => {
      fetchAuthUser()
        .then((u) => {
          if (!active) return;
          setAuthenticated(Boolean(u));
          setAuthChecked(true);
        })
        .catch(() => {
          if (!active) return;
          setAuthenticated(false);
          setAuthChecked(true);
        });
    };

    checkSession();
    window.addEventListener('anagu-auth-changed', checkSession);
    return () => {
      active = false;
      window.removeEventListener('anagu-auth-changed', checkSession);
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-8 text-sm text-slate-600">
          Checking account session...
        </main>
      </div>
    );
  }

  if (!authenticated) {
    const encodedNext = encodeURIComponent(nextPath);
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-14">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-center shadow-sm space-y-4">
            <p className="text-xs font-mono font-semibold text-emerald-700">
              ANAGU GIS Land Registry
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <Link
                href={`/login?next=${encodedNext}`}
                className="px-5 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
              >
                Log In
              </Link>
              <Link
                href={`/register?next=${encodedNext}`}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </main>
        {includeFooter && <SiteFooter initialAuthenticated={false} />}
      </div>
    );
  }

  return <>{children}</>;
}
