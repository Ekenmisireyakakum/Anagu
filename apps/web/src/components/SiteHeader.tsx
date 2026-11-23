'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  clearClientSessionToken,
  fetchAuthUser,
  getCachedAuthUser,
  hasResolvedAuth,
  setCachedAuthUser,
} from '../lib/client-auth';
import MetaMaskConnectButton from './MetaMaskConnectButton';

export interface HeaderUser {
  id: string;
  fullName: string;
  role: string;
}

export default function SiteHeader({ initialUser }: { initialUser?: HeaderUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdminRoute = Boolean(pathname?.startsWith('/admin'));
  const [user, setUser] = useState<HeaderUser | null>(
    () => initialUser ?? (typeof window !== 'undefined' ? getCachedAuthUser() : null),
  );
  const [authResolved, setAuthResolved] = useState<boolean>(
    () => Boolean(initialUser) || (typeof window !== 'undefined' && hasResolvedAuth()),
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (initialUser) {
      setCachedAuthUser(initialUser);
      setUser(initialUser);
      setAuthResolved(true);
    }
  }, [initialUser]);

  useEffect(() => {
    if (isAdminRoute) return;
    let active = true;
    const syncAuth = () => {
      fetchAuthUser()
        .then((u) => {
          if (active) {
            setUser(u);
            setAuthResolved(true);
          }
        })
        .catch(() => {
          if (active) setAuthResolved(true);
        });
    };

    syncAuth();
    window.addEventListener('anagu-auth-changed', syncAuth);
    return () => {
      active = false;
      window.removeEventListener('anagu-auth-changed', syncAuth);
    };
  }, [isAdminRoute, pathname]);

  const handleSignOut = async () => {
    clearClientSessionToken();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setUser(null);
    setAuthResolved(true);
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('anagu-auth-changed'));
    }
    const protectedPaths = ['/register-land', '/marketplace', '/map', '/dashboard'];
    if (pathname && protectedPaths.some((p) => pathname.startsWith(p))) {
      router.push('/');
    }
    router.refresh();
  };

  const navItems = [
    { href: '/register-land', label: 'Register Land' },
    { href: '/marketplace', label: 'Access Land' },
    { href: '/map', label: 'GIS Map' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-[1200]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
        <Link
          href={isAdminRoute ? '/admin' : '/'}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          ANAGU
        </Link>

        {!isAdminRoute ? (
          user ? (
            <>
              <nav
                aria-label="Primary"
                className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium text-slate-600"
              >
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                        isActive
                          ? 'text-slate-900 underline underline-offset-4 decoration-emerald-700 decoration-2'
                          : ''
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
                <div ref={accountMenuRef} className="relative hidden md:block min-w-0">
                  <button
                    type="button"
                    aria-expanded={accountMenuOpen}
                    aria-haspopup="menu"
                    title={user.fullName}
                    onClick={() => setAccountMenuOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors max-w-[140px] lg:max-w-[175px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                  >
                    <span className="truncate">{user.fullName}</span>
                    <svg
                      className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform duration-150 ${
                        accountMenuOpen ? 'rotate-180' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  {accountMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 z-[1400] w-56 rounded-lg border border-slate-200 bg-white shadow-xl py-1.5 text-xs"
                    >
                      <div className="px-3.5 py-2 border-b border-slate-100">
                        <div className="font-semibold text-slate-900 truncate">{user.fullName}</div>
                        <div className="font-mono text-[11px] text-emerald-700 mt-0.5">
                          {user.role.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <Link
                        href="/dashboard"
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center justify-between px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      >
                        <span>Dashboard &amp; Titles</span>
                        <span className="text-slate-400">→</span>
                      </Link>
                      <Link
                        href="/register-land"
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center justify-between px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      >
                        <span>Register Land</span>
                        <span className="text-slate-400">→</span>
                      </Link>
                      <Link
                        href="/marketplace"
                        role="menuitem"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center justify-between px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"
                      >
                        <span>Access Land</span>
                        <span className="text-slate-400">→</span>
                      </Link>
                      <div className="mt-1 pt-1 border-t border-slate-100 px-2">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void handleSignOut()}
                          className="w-full text-left px-2 py-1.5 rounded text-red-700 font-semibold hover:bg-red-50 transition-colors"
                        >
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <MetaMaskConnectButton compact />

                <button
                  type="button"
                  aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={mobileMenuOpen}
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shrink-0"
                >
                  {mobileMenuOpen ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            </>
          ) : authResolved ? (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs sm:text-sm font-semibold">
              <Link
                href={
                  pathname &&
                  pathname !== '/' &&
                  pathname !== '/login' &&
                  pathname !== '/register'
                    ? `/login?next=${encodeURIComponent(pathname)}`
                    : '/login'
                }
                className="px-3 sm:px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap"
              >
                Log In
              </Link>
              <Link
                href={
                  pathname &&
                  pathname !== '/' &&
                  pathname !== '/login' &&
                  pathname !== '/register'
                    ? `/register?next=${encodeURIComponent(pathname)}`
                    : '/register'
                }
                className="px-3.5 sm:px-4 py-2 rounded-md bg-emerald-700 text-white hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                Sign Up
              </Link>
            </div>
          ) : (
            <div className="w-32 h-8" aria-hidden="true" />
          )
        ) : (
          <span className="text-[11px] sm:text-xs font-mono font-semibold text-emerald-700 text-right truncate">
            Admin Governance Portal
          </span>
        )}
      </div>

      {!isAdminRoute && user && mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 shadow-lg">
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`min-h-[44px] px-3 py-2.5 rounded-md text-sm font-semibold flex items-center justify-between ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-400">→</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] flex-1 min-w-0 px-3 py-2.5 rounded-md bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-900 truncate flex items-center"
              >
                {user.fullName}
              </Link>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="min-h-[44px] px-4 py-2.5 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
