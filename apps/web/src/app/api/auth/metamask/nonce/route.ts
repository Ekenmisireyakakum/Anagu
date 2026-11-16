import { NextRequest, NextResponse } from 'next/server';
import { issueMetaMaskChallenge } from '../../../../../lib/anagu-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challenge = issueMetaMaskChallenge(String(body.address || ''));
    return NextResponse.json(challenge);
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Unable to create MetaMask challenge' },
      { status: 400 },
    );
  }
}
