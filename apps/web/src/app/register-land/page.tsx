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

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
        {submittedNotice && (
          <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-950 flex flex-wrap items-center justify-between gap-3">
            <span>
              Your land registration and deed submission has been recorded and listed as Unverified on Access Land while awaiting Administrator deed verification.
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/marketplace"
                className="font-semibold text-emerald-900 underline whitespace-nowrap"
              >
                Access Land →
              </Link>
              <Link
                href="/dashboard"
                className="font-semibold text-slate-800 underline whitespace-nowrap"
              >
                Open Registry Console →
              </Link>
            </div>
          </div>
        )}

        <SubmitApplicationPanel onSubmitted={handleSubmitted} />
      </main>

      <SiteFooter />
    </div>
  );
}
