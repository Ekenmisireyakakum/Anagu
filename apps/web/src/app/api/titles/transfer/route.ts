import { NextRequest, NextResponse } from 'next/server';
import { transferTitleOwnership } from '../../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const title = transferTitleOwnership(
      user,
      Number(body.tokenId),
      String(body.newOwnerEmailOrId || ''),
      Boolean(body.bypassAttempt),
      body.walletProof || null,
    );
    return NextResponse.json(title);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    const status = message.startsWith('FORBIDDEN:')
      ? 403
      : message.startsWith('CONFLICT:')
      ? 409
      : 400;
    return NextResponse.json({ message }, { status });
  }
}
