import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreReady, getAllEffectiveParcels } from '../../../../../../lib/anagu-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  await ensureStoreReady();
  const parcel = getAllEffectiveParcels().find((p) => p.id === params.id) ?? null;
  if (!parcel) {
    return NextResponse.json({ message: `Parcel ${params.id} not found` }, { status: 404 });
  }
  return NextResponse.json({
    type: 'Feature',
    geometry: parcel.geometry,
    properties: {
      id: parcel.id,
      parcelNumber: parcel.parcelNumber,
      status: parcel.status,
      areaSqm: parcel.areaSqm,
      lga: parcel.lga,
      address: parcel.address,
    },
  });
}
