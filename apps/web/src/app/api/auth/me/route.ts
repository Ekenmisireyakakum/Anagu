import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, SESSION_COOKIE_NAME } from '../../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
