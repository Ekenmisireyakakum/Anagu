'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import SubmitApplicationPanel from '../../components/dashboard/SubmitApplicationPanel';

export default function RegisterLandPage() {
  const [submittedNotice, setSubmittedNotice] = useState(false);

  const handleSubmitted = useCallback(async () => {
    setSubmittedNotice(true);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-slate-500 mb-1">
              Direct Cadastral Filing · No Account Creation Required
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Register Your Land Parcel
            </h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Plot your parcel boundary on OpenStreetMap, attach SHA-256 hashed deed PDFs, connect MetaMask or Trust Wallet, and submit straight into spatial overlap and title verification.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/marketplace"
              className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-md hover:bg-emerald-800 whitespace-nowrap"
            >
              Buy Verified Land →
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
            >
              View Registry Status
            </Link>
          </div>
        </div>

        {submittedNotice && (
          <div className="p-4 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-wrap items-center justify-between gap-3">
            <span>
              Your land registration filing has been recorded and spatially checked. You can track verification progress or view issued ERC-721 titles in the Registry Console.
            </span>
            <Link
              href="/dashboard"
              className="font-semibold text-emerald-800 underline whitespace-nowrap"
            >
              Track in Registry Console →
            </Link>
          </div>
        )}

        <SubmitApplicationPanel onSubmitted={handleSubmitted} />
      </main>

      <SiteFooter />
    </div>
  );
}
