import { NextRequest, NextResponse } from 'next/server';
import { getAllEffectiveParcels } from '../../../../../lib/anagu-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const parcel = getAllEffectiveParcels().find((p) => p.id === params.id) ?? null;
  if (!parcel) {
    return NextResponse.json({ message: `Parcel ${params.id} not found` }, { status: 404 });
  }
  return NextResponse.json(parcel);
}
