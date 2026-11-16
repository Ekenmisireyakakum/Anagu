import { NextRequest, NextResponse } from 'next/server';
import { createInMemoryParcel } from '../../../../lib/mock-gis-store';
import { getAllEffectiveParcels } from '../../../../lib/anagu-store';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const lga = searchParams.get('lga');
  return NextResponse.json(getAllEffectiveParcels({ status, lga }));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parcel = createInMemoryParcel(body);
    return NextResponse.json(parcel, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Failed to create parcel' },
      { status: 400 },
    );
  }
}
