import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreReady, getAllEffectiveParcels } from '../../../../../lib/anagu-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  await ensureStoreReady();
  const parcel = getAllEffectiveParcels().find((p) => p.id === params.id) ?? null;
  if (!parcel) {
    return NextResponse.json({ message: `Parcel ${params.id} not found` }, { status: 404 });
  }
  return NextResponse.json(parcel);
}
