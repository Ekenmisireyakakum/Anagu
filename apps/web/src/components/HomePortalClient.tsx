'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  fetchAuthUser,
  getCachedAuthUser,
  setCachedAuthUser,
  type ClientSessionUser,
} from '../lib/client-auth';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import ParcelImage from './marketplace/ParcelImage';

interface HomePortalClientProps {
  initialUser: ClientSessionUser | null;
  availableCount: number;
  verifiedAvailableCount: number;
  unverifiedAvailableCount: number;
}

export default function HomePortalClient({
  initialUser,
  availableCount,
  verifiedAvailableCount,
  unverifiedAvailableCount,
}: HomePortalClientProps) {
  const [currentUser, setCurrentUser] = useState<ClientSessionUser | null>(
    () => initialUser ?? (typeof window !== 'undefined' ? getCachedAuthUser() : null),
  );

  useEffect(() => {
    if (initialUser) {
      setCachedAuthUser(initialUser);
      setCurrentUser(initialUser);
    }
  }, [initialUser]);

  useEffect(() => {
    let active = true;
    const sync = () => {
      fetchAuthUser()
        .then((u) => {
          if (active) setCurrentUser(u);
        })
        .catch(() => {});
    };
    sync();
    window.addEventListener('anagu-auth-changed', sync);
    return () => {
      active = false;
      window.removeEventListener('anagu-auth-changed', sync);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader initialUser={currentUser ?? undefined} />

      <main className="flex-1">
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-6 min-w-0">
              <p className="text-xs font-mono font-semibold text-emerald-700 mb-3">
                {currentUser
                  ? `Welcome, ${currentUser.fullName} · GIS Land Registry Workspace`
                  : 'GIS Land Mapping · Polygon ERC-721 & ERC-20 Registry'}
              </p>
              <h1 className="text-[clamp(1.85rem,4vw,3.35rem)] font-bold tracking-tight text-slate-900 leading-[1.12] max-w-2xl [text-wrap:balance]">
                Mark your land on the map and register ownership in minutes
              </h1>
              <p className="mt-4 sm:mt-5 text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                {currentUser
                  ? 'Search any address or mark out your plot corners right on the map, explore verified parcels on Access Land, inspect live GIS boundaries, and connect your Web3 wallet in the top bar for Polygon ERC-721 & ERC-20 settlement.'
                  : 'ANAGU makes GIS land mapping effortless for everyone. Log in or sign up to map and register land locations, browse verified parcels on Access Land, explore the live GIS Map, and connect your Web3 wallet.'}
              </p>

              {currentUser ? (
                <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3">
                  <Link
                    href="/register-land"
                    className="px-6 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap text-center"
                  >
                    Register Land
                  </Link>
                  <Link
                    href="/marketplace"
                    className="px-6 py-3 text-sm font-semibold text-slate-900 bg-amber-300 border border-amber-400 rounded-md hover:bg-amber-400 transition-colors whitespace-nowrap text-center"
                  >
                    Access Land
                  </Link>
                  <Link
                    href="/map"
                    className="px-6 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap text-center"
                  >
                    GIS Map
                  </Link>
                </div>
              ) : (
                <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                  <Link
                    href="/login"
                    className="px-7 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap text-center"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="px-7 py-3 text-sm font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors whitespace-nowrap text-center"
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
                <span>
                  <strong className="font-mono text-emerald-700 tabular-nums">
                    {verifiedAvailableCount}
                  </strong>{' '}
                  verified parcels
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="font-mono text-amber-700 tabular-nums">
                    {unverifiedAvailableCount}
                  </strong>{' '}
                  pending parcels
                </span>
                <span aria-hidden="true">·</span>
                <span>Polygon ERC-721 + ERC-20 Dual Token</span>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4 min-w-0">
              <div className="relative aspect-[16/9] w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <ParcelImage
                  src="/images/hero_lagos_land.jpg"
                  alt="Aerial GIS view of mapped land parcels"
                  parcelReference="ANAGU-GIS"
                  lga="Interactive GIS Cadastre"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3.5 sm:p-5">
                  <p className="text-[11px] sm:text-xs font-mono text-emerald-200">
                    Interactive GIS Mapping · Simple Registration · Polygon Settlement
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-white mt-0.5">
                    Enter your location or draw parcel boundaries directly on the live map
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="p-3.5">
                  <dt className="text-slate-500">GIS Mapping</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-emerald-700">
                    Address &amp; Draw
                  </dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-slate-500">Smart Contracts</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-purple-800">
                    Polygon ERC-721/20
                  </dd>
                </div>
                <div className="p-3.5">
                  <dt className="text-slate-500">{currentUser ? 'Account' : 'Access'}</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-slate-900">
                    {currentUser ? 'Active Member' : 'Sign Up / Log In'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <article className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="text-xs font-mono font-semibold text-emerald-700 mb-2">
                  01. GIS Location Mapping
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Enter your location or draw corners on the map
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Type any street, city, or GPS coordinates—or click corners directly on OpenStreetMap—to mark out your land effortlessly. No technical survey jargon needed.
                </p>
              </div>
              {currentUser && (
                <div className="pt-4 border-t border-slate-100">
                  <Link
                    href="/register-land"
                    className="inline-flex px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors"
                  >
                    Register Land →
                  </Link>
                </div>
              )}
            </article>

            <article className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="text-xs font-mono font-semibold text-amber-700 mb-2">
                  {currentUser ? '02. Live GIS Map' : '02. Simple Account Sign-Up'}
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {currentUser
                    ? 'Explore mapped boundaries across the cadastre'
                    : 'Create an account in one click with email or wallet'}
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {currentUser
                    ? 'Inspect registered parcel polygons, check overlap verification status, and jump to any street address or GPS coordinate on the interactive GIS map.'
                    : 'Sign up with a simple email and password or connect your Web3 wallet during registration to unlock land mapping, parcel acquisition, and GIS tools.'}
                </p>
              </div>
              {currentUser && (
                <div className="pt-4 border-t border-slate-100">
                  <Link
                    href="/map"
                    className="inline-flex px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors"
                  >
                    GIS Map →
                  </Link>
                </div>
              )}
            </article>

            <article className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="text-xs font-mono font-semibold text-purple-700 mb-2">
                  03. Access Land (Polygon)
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Browse verified parcels with ERC-721 &amp; ERC-20 support
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Inspect GIS-mapped land parcels approved by Admin governance and acquire digital ERC-721 land titles on Polygon using Web3 wallets or ERC-20 settlement.
                </p>
              </div>
              {currentUser && (
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <Link
                    href="/marketplace"
                    className="inline-flex px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-300 border border-amber-400 rounded-md hover:bg-amber-400 transition-colors"
                  >
                    Access Land →
                  </Link>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {availableCount} available
                  </span>
                </div>
              )}
            </article>
          </div>
        </section>
      </main>

      <SiteFooter initialAuthenticated={currentUser ? true : undefined} />
    </div>
  );
}
