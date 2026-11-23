'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchAuthUser, getCachedAuthUser } from '../lib/client-auth';

export default function SiteFooter({
  adminMode = false,
  initialAuthenticated,
}: {
  adminMode?: boolean;
  initialAuthenticated?: boolean;
}) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(
    () =>
      initialAuthenticated === true ||
      Boolean(typeof window !== 'undefined' && getCachedAuthUser()),
  );

  useEffect(() => {
    if (initialAuthenticated === true) {
      setAuthenticated(true);
    }
  }, [initialAuthenticated]);

  useEffect(() => {
    if (adminMode) return;
    let active = true;
    const syncAuth = () => {
      fetchAuthUser()
        .then((u) => {
          if (active) {
            setAuthenticated(Boolean(u));
          }
        })
        .catch(() => {});
    };

    syncAuth();
    window.addEventListener('anagu-auth-changed', syncAuth);
    return () => {
      active = false;
      window.removeEventListener('anagu-auth-changed', syncAuth);
    };
  }, [adminMode]);

  const nextQuery =
    pathname && pathname !== '/' && pathname !== '/login' && pathname !== '/register'
      ? `?next=${encodeURIComponent(pathname)}`
      : '';

  return (
    <footer className="bg-white border-t border-slate-200 mt-12 sm:mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-slate-900">
            ANAGU GIS Land Mapping &amp; Polygon Title Registry
          </p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Interactive GIS land boundary mapping, simple parcel registration, and Polygon ERC-721 title &amp; ERC-20 token settlement. Digital NFT titles are administered under governance review.
          </p>
        </div>
        {!adminMode && (
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-medium text-slate-600">
            {authenticated ? (
              <>
                <Link href="/register-land" className="hover:text-slate-900 whitespace-nowrap py-1">
                  Register Land
                </Link>
                <Link href="/marketplace" className="hover:text-slate-900 whitespace-nowrap py-1">
                  Access Land
                </Link>
                <Link href="/map" className="hover:text-slate-900 whitespace-nowrap py-1">
                  GIS Map
                </Link>
                <Link href="/dashboard" className="hover:text-slate-900 whitespace-nowrap py-1">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href={`/login${nextQuery}`} className="hover:text-slate-900 whitespace-nowrap py-1">
                  Log In
                </Link>
                <Link href={`/register${nextQuery}`} className="hover:text-slate-900 whitespace-nowrap py-1">
                  Sign Up
                </Link>
              </>
            )}
            <Link href="/admin/login" className="hover:text-slate-900 whitespace-nowrap py-1">
              Admin Portal
            </Link>
            <Link href="/about" className="hover:text-slate-900 whitespace-nowrap py-1">
              About
            </Link>
          </nav>
        )}
      </div>
    </footer>
  );
}

