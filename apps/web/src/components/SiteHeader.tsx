'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function SiteHeader() {
  const pathname = usePathname();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then((res) => {
        if (active) setHasSession(res.ok);
      })
      .catch(() => {
        if (active) setHasSession(false);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  const navItems = [
    { href: '/', label: 'Overview' },
    { href: '/map', label: 'GIS Map' },
    { href: '/how-it-works', label: 'Workflow' },
    { href: '/evaluation', label: 'Evaluation' },
    { href: '/about', label: 'About' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          ANAGU
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                  isActive ? 'text-slate-900 underline underline-offset-4 decoration-emerald-700 decoration-2' : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <Link
            href={hasSession ? '/dashboard' : '/login'}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
          >
            {hasSession ? 'Open Console' : 'Sign In'}
          </Link>
        </div>
      </div>
    </header>
  );
}
