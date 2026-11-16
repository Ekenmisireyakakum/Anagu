import { NextRequest, NextResponse } from 'next/server';
import { performApplicationWorkflowAction } from '../../../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../../../lib/server-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const updated = performApplicationWorkflowAction(
      user,
      params.id,
      body.action,
      body.payload,
    );
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workflow action failed';
    const status = message.startsWith('FORBIDDEN:')
      ? 403
      : message === 'Application not found'
      ? 404
      : 400;
    return NextResponse.json({ message }, { status });
  }
}
