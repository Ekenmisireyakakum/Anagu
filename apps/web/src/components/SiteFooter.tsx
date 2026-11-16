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
          <Link href="/about" className="hover:text-slate-900 whitespace-nowrap">
            About
          </Link>
          <Link href="/how-it-works" className="hover:text-slate-900 whitespace-nowrap">
            How It Works
          </Link>
          <Link href="/map" className="hover:text-slate-900 whitespace-nowrap">
            GIS Map
          </Link>
          <Link href="/evaluation" className="hover:text-slate-900 whitespace-nowrap">
            Evaluation
          </Link>
          <Link href="/contact" className="hover:text-slate-900 whitespace-nowrap">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
