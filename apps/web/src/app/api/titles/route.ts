import { NextRequest, NextResponse } from 'next/server';
import { getAnaguStore } from '../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const store = getAnaguStore();
  if (user.role === 'CITIZEN') {
    return NextResponse.json(store.titles.filter((t) => t.ownerId === user.id));
  }
  return NextResponse.json(store.titles);
}
