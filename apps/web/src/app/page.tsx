import { cookies } from 'next/headers';
import HomePortalClient from '../components/HomePortalClient';
import { ensureStoreReady, listLandListings, verifySessionToken } from '../lib/anagu-store';
import { SESSION_COOKIE_NAME } from '../lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await ensureStoreReady();
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const currentUser = token ? verifySessionToken(token) : null;

  const listings = listLandListings();
  const availableListings = listings.filter((l) => l.status === 'AVAILABLE');
  const verifiedAvailableCount = availableListings.filter(
    (l) => (l.verificationStatus || 'VERIFIED') === 'VERIFIED',
  ).length;
  const unverifiedAvailableCount = availableListings.filter(
    (l) => l.verificationStatus === 'UNVERIFIED',
  ).length;

  return (
    <HomePortalClient
      initialUser={
        currentUser
          ? {
              id: currentUser.id,
              fullName: currentUser.fullName,
              role: currentUser.role,
              walletAddress: currentUser.walletAddress,
              walletVerified: currentUser.walletVerified,
            }
          : null
      }
      availableCount={availableListings.length}
      verifiedAvailableCount={verifiedAvailableCount}
      unverifiedAvailableCount={unverifiedAvailableCount}
    />
  );
}


