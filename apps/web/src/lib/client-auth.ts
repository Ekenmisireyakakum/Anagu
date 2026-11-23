export interface ClientSessionUser {
  id: string;
  fullName: string;
  role: string;
  email?: string;
  walletAddress?: string;
  walletVerified?: boolean;
}

// Keep fallback Bearer token & cached user strictly in JS memory rather than web storage.
let inMemorySessionToken: string | null = null;
let cachedSessionUser: ClientSessionUser | null = null;
let authResolved = false;
let inflightAuthFetch: Promise<ClientSessionUser | null> | null = null;

export function getClientSessionToken(): string | null {
  return inMemorySessionToken;
}

export function getCachedAuthUser(): ClientSessionUser | null {
  return cachedSessionUser;
}

export function setCachedAuthUser(user: ClientSessionUser | null): void {
  cachedSessionUser = user;
  authResolved = true;
}

export function hasResolvedAuth(): boolean {
  return authResolved;
}

export function setClientSessionToken(
  token?: string | null,
  user?: ClientSessionUser | null,
): void {
  if (token) {
    inMemorySessionToken = token;
  }
  if (user !== undefined) {
    cachedSessionUser = user;
    authResolved = true;
  }
}

export function clearClientSessionToken(): void {
  inMemorySessionToken = null;
  cachedSessionUser = null;
  authResolved = true;
  inflightAuthFetch = null;
}

export function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...(extra || {}),
    ...(inMemorySessionToken ? { Authorization: `Bearer ${inMemorySessionToken}` } : {}),
  };
}

export async function fetchAuthUser(): Promise<ClientSessionUser | null> {
  if (inflightAuthFetch) {
    return inflightAuthFetch;
  }

  inflightAuthFetch = (async () => {
    try {
      const res = await fetch('/api/auth/me?optional=1', {
        cache: 'no-store',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        return cachedSessionUser;
      }
      const data = await res.json();
      const user = (data?.user as ClientSessionUser) || null;
      cachedSessionUser = user;
      authResolved = true;
      if (!user) {
        inMemorySessionToken = null;
      }
      return user;
    } catch {
      return cachedSessionUser;
    } finally {
      inflightAuthFetch = null;
    }
  })();

  return inflightAuthFetch;
}
