import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import MarketplaceClient from '../../components/marketplace/MarketplaceClient';

export default function MarketplacePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <MarketplaceClient />
      </main>
      <SiteFooter />
    </div>
  );
}
