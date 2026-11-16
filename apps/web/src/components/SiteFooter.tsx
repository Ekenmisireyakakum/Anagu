import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-slate-900">
            ANAGU Land Administration Framework
          </p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Prototype framework aligned with the Nigeria Land Use Act 1978 (Section 28).
            Digital NFT titles in this prototype do not automatically constitute legally
            recognized Nigerian statutory Certificates of Occupancy without state registry execution.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-600">
          <Link href="/marketplace" className="hover:text-slate-900 whitespace-nowrap">
            Buy Land
          </Link>
          <Link href="/register-land" className="hover:text-slate-900 whitespace-nowrap">
            Register Land
          </Link>
          <Link href="/map" className="hover:text-slate-900 whitespace-nowrap">
            GIS Map
          </Link>
          <Link href="/how-it-works" className="hover:text-slate-900 whitespace-nowrap">
            Workflow
          </Link>
          <Link href="/dashboard" className="hover:text-slate-900 whitespace-nowrap">
            Registry Console
          </Link>
          <Link href="/about" className="hover:text-slate-900 whitespace-nowrap">
            About
          </Link>
        </nav>
      </div>
    </footer>
  );
}
