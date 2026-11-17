import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreReady, persistStoreToSupabase, revokeMarketplaceListing } from '../../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  await ensureStoreReady();
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = await request.json();
    if (body?.action === 'REVOKE_LISTING' && body?.listingId) {
      const result = revokeMarketplaceListing(user, String(body.listingId), {
        grounds: body.grounds,
        administrativeReference: body.administrativeReference,
        reason: body.reason,
        walletProof: body.walletProof || null,
      });
      await persistStoreToSupabase();
      return NextResponse.json(result);
    }
    return NextResponse.json({ message: 'Unsupported admin listing action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin listing action failed';
    const status = message.startsWith('FORBIDDEN:') ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
