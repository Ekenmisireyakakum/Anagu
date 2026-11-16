import { NextRequest, NextResponse } from 'next/server';
import { findParcelById } from '../../../../../../lib/mock-gis-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const parcel = findParcelById(params.id);
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
