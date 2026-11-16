import { NextRequest, NextResponse } from 'next/server';
import { refreshMarketRates } from '../../../lib/pricing';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('refresh') === '1';
  const rates = await refreshMarketRates(force);
  return NextResponse.json(rates);
}
