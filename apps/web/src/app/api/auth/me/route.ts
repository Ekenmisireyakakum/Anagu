import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreReady } from '../../../../lib/anagu-store';
import { getAuthenticatedUser, getSessionCookieOptions, SESSION_COOKIE_NAME } from '../../../../lib/server-auth';

export async function GET(request: NextRequest) {
  await ensureStoreReady();
  const user = getAuthenticatedUser(request);
  if (!user) {
    if (request.nextUrl.searchParams.get('optional') === '1') {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', getSessionCookieOptions(request, 0));
  return response;
}
