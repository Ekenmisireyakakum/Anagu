import { NextRequest, NextResponse } from 'next/server';
import { getAnaguStore, submitLandApplication } from '../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const store = getAnaguStore();
  if (user.role === 'CITIZEN') {
    return NextResponse.json(store.applications.filter((a) => a.applicantId === user.id));
  }
  return NextResponse.json(store.applications);
}

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { application, deduplicated } = submitLandApplication(user, body);
    return NextResponse.json(
      { application, deduplicated },
      { status: deduplicated ? 200 : 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to submit application' },
      { status: 400 },
    );
  }
}
