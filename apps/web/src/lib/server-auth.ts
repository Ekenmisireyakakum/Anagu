import { NextRequest } from 'next/server';
import { verifySessionToken, type SafeUser } from './anagu-store';

export const SESSION_COOKIE_NAME = 'anagu_token';

export function getSessionCookieOptions(request: NextRequest, maxAge = 86400) {
  const proto = request.headers.get('x-forwarded-proto') || '';
  const ssl = request.headers.get('x-forwarded-ssl') || '';
  const origin = request.headers.get('origin') || '';
  const referer = request.headers.get('referer') || '';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const isHttps =
    proto.includes('https') ||
    ssl === 'on' ||
    request.url.startsWith('https://') ||
    origin.startsWith('https://') ||
    referer.startsWith('https://') ||
    host.endsWith('.run.app');
  return {
    httpOnly: true,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
    ...(isHttps ? { partitioned: true } : {}),
    path: '/',
    maxAge,
  };
}

export function getAuthenticatedUser(request: NextRequest): SafeUser | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }

  const cookieToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) {
    return verifySessionToken(cookieToken);
  }
  return null;
}
