import { NextRequest, NextResponse } from 'next/server';
import { findParcelById } from '../../../../../lib/mock-gis-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const parcel = findParcelById(params.id);
  if (!parcel) {
    return NextResponse.json({ message: `Parcel ${params.id} not found` }, { status: 404 });
  }
  return NextResponse.json(parcel);
}
