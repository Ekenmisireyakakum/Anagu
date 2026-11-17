import { NextResponse } from 'next/server';
import { ensureStoreReady } from '../../../../lib/anagu-store';
import { checkSupabaseStatus } from '../../../../lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  await ensureStoreReady();
  const status = await checkSupabaseStatus();
  return NextResponse.json(status);
}
