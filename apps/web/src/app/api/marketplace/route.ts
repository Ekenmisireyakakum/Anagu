import { NextRequest, NextResponse } from 'next/server';
import {
  createLandListing,
  ensureStoreReady,
  listLandListings,
  listUserPurchases,
  persistStoreToSupabase,
} from '../../../lib/anagu-store';
import { refreshMarketRates } from '../../../lib/pricing';
import { getAuthenticatedUser } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  await ensureStoreReady();
  const { searchParams } = new URL(request.url);
  const lga = searchParams.get('lga');
  const status = searchParams.get('status');
  const listingType = searchParams.get('listingType');
  const verificationStatus = searchParams.get('verificationStatus');
  const q = searchParams.get('q');

  const rates = await refreshMarketRates(searchParams.get('refreshRates') === '1');
  const user = getAuthenticatedUser(request);
  const includeRevoked =
    searchParams.get('includeRevoked') === '1' &&
    Boolean(
      user &&
        (user.role === 'LAND_ADMINISTRATOR' ||
          user.role === 'GOVERNOR' ||
          user.role === 'REGISTRAR'),
    );
  const listings = listLandListings({
    lga,
    status,
    listingType,
    verificationStatus,
    q,
    includeRevoked,
  });
  const purchases = user ? listUserPurchases(user) : [];

  return NextResponse.json({ listings, purchases, rates });
}

export async function POST(request: NextRequest) {
  await ensureStoreReady();
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  try {
    await refreshMarketRates();
    const body = await request.json();
    const listing = createLandListing(user, {
      tokenId: Number(body.tokenId),
      title: String(body.title || ''),
      priceNgn: body.priceNgn !== undefined ? Number(body.priceNgn) : undefined,
      priceUsd: body.priceUsd !== undefined ? Number(body.priceUsd) : undefined,
      priceEth: body.priceEth ? String(body.priceEth) : undefined,
      zoning: body.zoning,
      description: body.description ? String(body.description) : undefined,
    });
    await persistStoreToSupabase();
    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to create land listing';
    const status = message.startsWith('FORBIDDEN:') ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
