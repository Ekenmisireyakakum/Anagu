import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  verifyMetaMaskChallenge,
} from '../../../../../lib/anagu-store';
import { getAuthenticatedUser, SESSION_COOKIE_NAME } from '../../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = body.mode === 'link' ? 'link' : 'login';
    const currentUser = mode === 'link' ? getAuthenticatedUser(request) : null;

    if (mode === 'link' && !currentUser) {
      return NextResponse.json(
        { message: 'Authentication required to link MetaMask wallet' },
        { status: 401 },
      );
    }

    const result = verifyMetaMaskChallenge({
      address: String(body.address || ''),
      signature: String(body.signature || ''),
      mode,
      currentUser,
    });

    const token = createSessionToken(result.user);
    const response = NextResponse.json({
      user: result.user,
      linked: result.linked,
      isNewAccount: Boolean(result.isNewAccount),
      accessToken: token,
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'MetaMask verification failed' },
      { status: 400 },
    );
  }
}
