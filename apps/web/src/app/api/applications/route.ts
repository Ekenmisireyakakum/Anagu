import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  ensureStoreReady,
  persistStoreToSupabase,
  resolveOrCreateWalletOwner,
  submitLandApplication,
  syncApplicationWithRates,
} from '../../../lib/anagu-store';
import { refreshMarketRates } from '../../../lib/pricing';
import {
  getAuthenticatedUser,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const store = await ensureStoreReady();
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const rates = await refreshMarketRates();
  const list =
    user.role === 'CITIZEN'
      ? store.applications.filter((a) => a.applicantId === user.id)
      : store.applications;
  return NextResponse.json(list.map((app) => syncApplicationWithRates(app, rates)));
}

export async function POST(request: NextRequest) {
  try {
    await ensureStoreReady();
    await refreshMarketRates();
    const body = await request.json();
    const sessionUser = getAuthenticatedUser(request);
    const applicant =
      sessionUser ||
      resolveOrCreateWalletOwner({
        walletAddress: typeof body.walletAddress === 'string' ? body.walletAddress : undefined,
        fullName: typeof body.claimantName === 'string' ? body.claimantName : undefined,
        walletProof: body.walletProof ?? null,
      });

    const { application, deduplicated } = submitLandApplication(applicant, body);
    await persistStoreToSupabase();
    const response = NextResponse.json(
      { application, deduplicated, owner: applicant },
      { status: deduplicated ? 200 : 201 },
    );

    if (!sessionUser) {
      const token = createSessionToken(applicant);
      response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(request, 86400));
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to submit application' },
      { status: 400 },
    );
  }
}
