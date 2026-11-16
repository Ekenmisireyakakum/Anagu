import { NextRequest, NextResponse } from 'next/server';
import { verifyWktParcel } from '../../../../lib/mock-gis-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wkt, applicationId, excludeParcelId } = body ?? {};
    if (!wkt || typeof wkt !== 'string') {
      return NextResponse.json({ message: 'wkt is required' }, { status: 400 });
    }
    const result = verifyWktParcel(wkt, applicationId || 'anonymous', excludeParcelId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Verification failed' },
      { status: 400 },
    );
  }
}
