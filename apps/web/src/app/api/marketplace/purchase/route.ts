import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  ensureStoreReady,
  persistStoreToSupabase,
  purchaseLandListing,
  resolveOrCreateWalletOwner,
} from '../../../../lib/anagu-store';
import { refreshMarketRates } from '../../../../lib/pricing';
import {
  getAuthenticatedUser,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    await ensureStoreReady({ force: true });
    await refreshMarketRates();
    const body = await request.json();
    if (!body?.listingId) {
      return NextResponse.json({ message: 'listingId is required' }, { status: 400 });
    }

    const sessionUser = getAuthenticatedUser(request);
    const owner =
      sessionUser ||
      resolveOrCreateWalletOwner({
        walletAddress: typeof body.buyerWallet === 'string' ? body.buyerWallet : undefined,
        fullName: typeof body.buyerName === 'string' ? body.buyerName : undefined,
        walletProof: body.walletProof ?? null,
      });

    const paymentMethod =
      body.paymentMethod === 'TRUST_WALLET_ETH'
        ? 'TRUST_WALLET_ETH'
        : body.paymentMethod === 'METAMASK_ETH'
        ? 'METAMASK_ETH'
        : body.paymentMethod === 'WEB3_WALLET_ETH'
        ? 'WEB3_WALLET_ETH'
        : 'REGISTRY_ESCROW';

    const result = purchaseLandListing(owner, String(body.listingId), {
      paymentMethod,
      walletLabel: typeof body.walletLabel === 'string' ? body.walletLabel : undefined,
      walletProof: body.walletProof ?? null,
    });
    await persistStoreToSupabase();

    const response = NextResponse.json({ ...result, owner }, { status: 200 });
    if (!sessionUser) {
      const token = createSessionToken(owner);
      response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(request, 86400));
    }
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Land purchase failed';
    const status = message.startsWith('FORBIDDEN:') ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
