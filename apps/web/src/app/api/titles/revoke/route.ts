import { NextRequest, NextResponse } from 'next/server';
import { revokeLandTitle } from '../../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const title = revokeLandTitle(user, {
      tokenId: Number(body.tokenId),
      grounds: body.grounds,
      administrativeReference: String(body.administrativeReference || ''),
      justification: String(body.justification || ''),
      walletProof: body.walletProof || null,
    });
    return NextResponse.json(title);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Revocation failed';
    const status = message.startsWith('FORBIDDEN:') ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
