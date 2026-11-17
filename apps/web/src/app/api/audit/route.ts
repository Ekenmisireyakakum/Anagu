import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreReady } from '../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const store = await ensureStoreReady();
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  if (user.role === 'CITIZEN') {
    return NextResponse.json(
      store.auditLogs.filter((l) => l.actorId === user.id || l.entityType === 'TITLE'),
    );
  }
  return NextResponse.json(store.auditLogs);
}
