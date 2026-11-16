import { NextRequest, NextResponse } from 'next/server';
import {
  createLandListing,
  listLandListings,
  listUserPurchases,
} from '../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lga = searchParams.get('lga');
  const status = searchParams.get('status');
  const listingType = searchParams.get('listingType');
  const q = searchParams.get('q');

  const listings = listLandListings({ lga, status, listingType, q });
  const user = getAuthenticatedUser(request);
  const purchases = user ? listUserPurchases(user) : [];

  return NextResponse.json({ listings, purchases });
}

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const listing = createLandListing(user, {
      tokenId: Number(body.tokenId),
      title: String(body.title || ''),
      priceNgn: Number(body.priceNgn),
      priceEth: body.priceEth ? String(body.priceEth) : undefined,
      zoning: body.zoning,
      description: body.description ? String(body.description) : undefined,
    });
    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to create land listing';
    const status = message.startsWith('FORBIDDEN:') ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
