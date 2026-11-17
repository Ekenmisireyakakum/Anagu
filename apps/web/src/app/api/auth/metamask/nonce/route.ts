import { NextRequest, NextResponse } from 'next/server';
import { issueMetaMaskChallenge } from '../../../../../lib/anagu-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { challengeToken, ...publicChallenge } = issueMetaMaskChallenge(String(body.address || ''));
    const response = NextResponse.json(publicChallenge);
    response.cookies.set('anagu_mm_nonce', challengeToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Unable to create MetaMask challenge' },
      { status: 400 },
    );
  }
}
