import { NextRequest, NextResponse } from 'next/server';
import {
  ensureStoreReady,
  listLandListings,
  performApplicationWorkflowAction,
  persistStoreToSupabase,
  revokeLandTitle,
  revokeMarketplaceListing,
  syncApplicationWithRates,
} from '../../../../lib/anagu-store';
import { refreshMarketRates } from '../../../../lib/pricing';
import { getAuthenticatedUser } from '../../../../lib/server-auth';

const ADMIN_PANEL_ROLES = new Set(['LAND_ADMINISTRATOR', 'REGISTRAR', 'GOVERNOR']);

export async function GET(request: NextRequest) {
  const store = await ensureStoreReady();
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  if (!ADMIN_PANEL_ROLES.has(user.role)) {
    return NextResponse.json(
      { message: 'FORBIDDEN: Admin privileges required' },
      { status: 403 },
    );
  }

  const rates = await refreshMarketRates();
  const allListings = listLandListings({ includeRevoked: true, includeUnapproved: false });
  const activeListings = allListings.filter((l) => l.status !== 'REVOKED');
  const revokedListings = allListings.filter((l) => l.status === 'REVOKED');

  const pendingApplications = store.applications
    .filter(
      (a) =>
        a.status !== 'REGISTERED' &&
        a.status !== 'REJECTED' &&
        a.status !== 'REVOKED' &&
        a.status !== 'CANCELLED',
    )
    .map((a) => syncApplicationWithRates(a, rates));

  const rejectedApplications = store.applications
    .filter((a) => a.status === 'REJECTED')
    .map((a) => syncApplicationWithRates(a, rates));

  const revokedApplications = store.applications
    .filter((a) => a.status === 'REVOKED')
    .map((a) => syncApplicationWithRates(a, rates));

  return NextResponse.json({
    user,
    rates,
    pendingApplications,
    rejectedApplications,
    revokedApplications,
    activeListings,
    revokedListings,
    titles: store.titles,
    auditLogs: store.auditLogs.slice(0, 120),
    stats: {
      pendingCount: pendingApplications.length,
      activeCount: activeListings.filter((l) => l.status === 'AVAILABLE').length,
      soldCount: activeListings.filter((l) => l.status === 'SOLD').length,
      revokedCount: revokedListings.length + revokedApplications.filter((a) => !revokedListings.some((l) => l.parcelReference.toLowerCase() === a.parcelReference.toLowerCase())).length,
      titlesCount: store.titles.length,
    },
  });
}

export async function POST(request: NextRequest) {
  await ensureStoreReady();
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  if (!ADMIN_PANEL_ROLES.has(user.role)) {
    return NextResponse.json(
      { message: 'FORBIDDEN: Admin privileges required' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const action = String(body?.action || '');

    if (action === 'APPROVE_APPLICATION' && body?.applicationId) {
      const updated = performApplicationWorkflowAction(
        user,
        String(body.applicationId),
        'VERIFY_AND_PUBLISH',
        {
          registrarNotes:
            typeof body.notes === 'string' && body.notes.trim()
              ? body.notes.trim()
              : 'Approved by Administrator for Access Land listing.',
          adminOverride: Boolean(body.adminOverride),
          walletProof: body.walletProof || null,
        },
      );
      await persistStoreToSupabase();
      return NextResponse.json({ ok: true, application: updated });
    }

    if (action === 'REJECT_APPLICATION' && body?.applicationId) {
      const updated = performApplicationWorkflowAction(
        user,
        String(body.applicationId),
        'REJECT',
        {
          registrarNotes:
            typeof body.reason === 'string' && body.reason.trim()
              ? body.reason.trim()
              : 'Rejected during Administrator review.',
        },
      );
      await persistStoreToSupabase();
      return NextResponse.json({ ok: true, application: updated });
    }

    if (action === 'REVOKE_APPLICATION' && body?.applicationId) {
      const updated = performApplicationWorkflowAction(
        user,
        String(body.applicationId),
        'REVOKE',
        {
          registrarNotes:
            typeof body.reason === 'string' && body.reason.trim()
              ? body.reason.trim()
              : 'Land application revoked by Administrator.',
          walletProof: body.walletProof || null,
        },
      );
      await persistStoreToSupabase();
      return NextResponse.json({ ok: true, application: updated });
    }

    if (action === 'REVOKE_LISTING' && body?.listingId) {
      const result = revokeMarketplaceListing(user, String(body.listingId), {
        grounds: body.grounds,
        administrativeReference: body.administrativeReference,
        reason: body.reason,
        walletProof: body.walletProof || null,
      });
      await persistStoreToSupabase();
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'REVOKE_TITLE' && body?.tokenId !== undefined) {
      const title = revokeLandTitle(user, {
        tokenId: Number(body.tokenId),
        grounds: body.grounds || 'Overriding Public Interest',
        administrativeReference: String(
          body.administrativeReference || `ADM-REV-TOKEN-${body.tokenId}`,
        ),
        justification: String(
          body.justification || 'Revoked by Administrator under Section 28.',
        ),
        walletProof: body.walletProof || null,
      });
      await persistStoreToSupabase();
      return NextResponse.json({ ok: true, title });
    }

    return NextResponse.json({ message: 'Unsupported admin action' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Admin action failed';
    const status = message.startsWith('FORBIDDEN:') ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
