'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import MetaMaskConnectButton from './MetaMaskConnectButton';

export default function SiteHeader() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Overview' },
    { href: '/marketplace', label: 'Buy Land' },
    { href: '/register-land', label: 'Register Land' },
    { href: '/map', label: 'GIS Map' },
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

        <div className="flex items-center shrink-0">
          <MetaMaskConnectButton compact />
        </div>
      </div>
    </header>
  );
}
