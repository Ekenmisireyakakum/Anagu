'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import MetaMaskConnectButton from './MetaMaskConnectButton';

interface HeaderUser {
  id: string;
  fullName: string;
  role: string;
}

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isAdminRoute = Boolean(pathname?.startsWith('/admin'));
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isAdminRoute) return;
    let active = true;
    fetch('/api/auth/me?optional=1')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (active) {
          setUser((data?.user as HeaderUser) || null);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAdminRoute, pathname]);

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setMobileMenuOpen(false);
    router.refresh();
  };

  const navItems = [
    { href: '/register-land', label: 'Map & Register Land' },
    { href: '/marketplace', label: 'Access Land' },
    { href: '/map', label: 'GIS Map' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <Link
          href={isAdminRoute ? '/admin' : '/'}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          ANAGU
        </Link>

        {!isAdminRoute ? (
          <>
            <nav
              aria-label="Primary"
              className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
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

            <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
              {user ? (
                <div className="hidden md:flex items-center gap-2 text-xs">
                  <Link
                    href="/dashboard"
                    className="px-2.5 py-1.5 rounded-md bg-slate-100 border border-slate-200 font-semibold text-slate-800 hover:bg-slate-200 max-w-[140px] truncate"
                    title={user.fullName}
                  >
                    {user.fullName}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
                  <Link
                    href="/login"
                    className="px-2.5 py-1.5 text-slate-700 hover:text-slate-900 whitespace-nowrap"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

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
        ) : (
          <span className="text-[11px] sm:text-xs font-mono font-semibold uppercase tracking-wider text-emerald-700 text-right truncate">
            Admin Governance Portal
          </span>
        )}
      </div>

      {!isAdminRoute && mobileMenuOpen && (
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
            {user ? (
              <div className="flex items-center justify-between gap-2">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[44px] flex-1 px-3 py-2.5 rounded-md bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-900 truncate flex items-center"
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
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[44px] px-3 py-2.5 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 flex items-center justify-center"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[44px] px-3 py-2.5 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 flex items-center justify-center"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
