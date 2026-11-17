import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreReady } from '../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const store = await ensureStoreReady();
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  if (user.role === 'LAND_ADMINISTRATOR') {
    return NextResponse.json(store.mqttLogs);
  }
  return NextResponse.json(
    store.mqttLogs.filter(
      (m) => m.recipientRole === 'ALL' || m.recipientRole === user.role,
    ),
  );
}
