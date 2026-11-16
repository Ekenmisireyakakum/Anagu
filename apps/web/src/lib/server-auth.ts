import { NextRequest } from 'next/server';
import { verifySessionToken, type SafeUser } from './anagu-store';

export const SESSION_COOKIE_NAME = 'anagu_token';

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
