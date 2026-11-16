import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, registerCitizenUser } from '../../../../lib/anagu-store';
import { SESSION_COOKIE_NAME } from '../../../../lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, phone, walletAddress } = await request.json();
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { message: 'Full name, email, and password are required' },
        { status: 400 },
      );
    }
    if (String(password).length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 },
      );
    }
    const user = registerCitizenUser({ email, password, fullName, phone, walletAddress });
    const token = createSessionToken(user);
    const response = NextResponse.json({ user, accessToken: token }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Registration failed' },
      { status: 400 },
    );
  }
}
