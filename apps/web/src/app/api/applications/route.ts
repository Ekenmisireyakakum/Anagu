import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  getAnaguStore,
  resolveOrCreateWalletOwner,
  submitLandApplication,
} from '../../../lib/anagu-store';
import { getAuthenticatedUser, SESSION_COOKIE_NAME } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const store = getAnaguStore();
  if (user.role === 'CITIZEN') {
    return NextResponse.json(store.applications.filter((a) => a.applicantId === user.id));
  }
  return NextResponse.json(store.applications);
}

export async function POST(request: NextRequest) {
  try {
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
    const response = NextResponse.json(
      { application, deduplicated, owner: applicant },
      { status: deduplicated ? 200 : 201 },
    );

    if (!sessionUser) {
      const token = createSessionToken(applicant);
      response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 86400,
      });
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to submit application' },
      { status: 400 },
    );
  }
}
