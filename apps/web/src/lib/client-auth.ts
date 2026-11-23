export interface ClientSessionUser {
  id: string;
  fullName: string;
  role: string;
  email?: string;
  walletAddress?: string;
  walletVerified?: boolean;
}

// Keep fallback Bearer token strictly in JS memory rather than web storage.
let inMemorySessionToken: string | null = null;

export function getClientSessionToken(): string | null {
  return inMemorySessionToken;
}

export function setClientSessionToken(token?: string | null): void {
  if (!token) return;
  inMemorySessionToken = token;
}

export function clearClientSessionToken(): void {
  inMemorySessionToken = null;
}

export function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...(extra || {}),
    ...(inMemorySessionToken ? { Authorization: `Bearer ${inMemorySessionToken}` } : {}),
  };
}

export async function fetchAuthUser(): Promise<ClientSessionUser | null> {
  const res = await fetch('/api/auth/me?optional=1', {
    cache: 'no-store',
    credentials: 'include',
    headers: getAuthHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.user as ClientSessionUser) || null;
}
