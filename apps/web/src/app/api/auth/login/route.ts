import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  createSessionToken,
  ensureStoreReady,
  persistStoreToSupabase,
  recordAudit,
} from '../../../../lib/anagu-store';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    await ensureStoreReady({ force: true });
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }
    const user = authenticateUser(email, password);
    if (!user) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }
    const token = createSessionToken(user);
    recordAudit(
      user.id,
      user.fullName,
      user.role,
      'USER_LOGIN',
      'USER',
      user.id,
      'SUCCESS',
      `Authenticated session started for ${user.email}`,
    );
    await persistStoreToSupabase();

    const response = NextResponse.json({ user, accessToken: token });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(request, 86400));
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Login failed' },
      { status: 500 },
    );
  }
}
