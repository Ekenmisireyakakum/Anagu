import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: 'Signed out' });
  response.cookies.set(SESSION_COOKIE_NAME, '', getSessionCookieOptions(request, 0));
  return response;
}
