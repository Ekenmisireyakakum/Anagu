import { cookies } from 'next/headers';
import AuthRequiredGate from '../../components/AuthRequiredGate';
import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import MarketplaceClient from '../../components/marketplace/MarketplaceClient';
import { ensureStoreReady, verifySessionToken } from '../../lib/anagu-store';
import { SESSION_COOKIE_NAME } from '../../lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function MarketplacePage() {
  await ensureStoreReady();
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const currentUser = token ? verifySessionToken(token) : null;

  return (
    <AuthRequiredGate
      nextPath="/marketplace"
      title="Log In or Sign Up to Access Land"
      description="Create an account or log in to browse verified parcels, inspect cadastral deeds, and acquire ERC-721 titles."
      initialAuthenticated={Boolean(currentUser)}
      includeFooter
    >
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader
          initialUser={
            currentUser
              ? { id: currentUser.id, fullName: currentUser.fullName, role: currentUser.role }
              : null
          }
        />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <MarketplaceClient />
        </main>
        <SiteFooter initialAuthenticated={Boolean(currentUser)} />
      </div>
    </AuthRequiredGate>
  );
}

