import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  ensureStoreReady,
  persistStoreToSupabase,
  verifyMetaMaskChallenge,
} from '../../../../../lib/anagu-store';
import {
  getAuthenticatedUser,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '../../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    await ensureStoreReady();
    const body = await request.json();
    const mode = body.mode === 'link' ? 'link' : 'login';
    const currentUser = mode === 'link' ? getAuthenticatedUser(request) : null;

    if (mode === 'link' && !currentUser) {
      return NextResponse.json(
        { message: 'Authentication required to link MetaMask wallet' },
        { status: 401 },
      );
    }

    const challengeToken = request.cookies.get('anagu_mm_nonce')?.value;
    const result = verifyMetaMaskChallenge({
      address: String(body.address || ''),
      signature: String(body.signature || ''),
      mode,
      currentUser,
      challengeToken,
    });

    await persistStoreToSupabase();

    const token = createSessionToken(result.user);
    const response = NextResponse.json({
      user: result.user,
      linked: result.linked,
      isNewAccount: Boolean(result.isNewAccount),
      accessToken: token,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(request, 86400));
    response.cookies.set('anagu_mm_nonce', '', getSessionCookieOptions(request, 0));
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'MetaMask verification failed' },
      { status: 400 },
    );
  }
}
