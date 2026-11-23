import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  ensureStoreReady,
  persistStoreToSupabase,
  registerCitizenUser,
} from '../../../../lib/anagu-store';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '../../../../lib/server-auth';
import {
  ensureSupabaseAuthUser,
  findUserByEmailInSupabase,
  upsertUserInSupabase,
} from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const store = await ensureStoreReady({ force: true });
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

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!store.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      const existingDb = await findUserByEmailInSupabase(normalizedEmail);
      if (existingDb) {
        store.users.push(existingDb);
      }
    }

    const user = registerCitizenUser({ email: normalizedEmail, password, fullName, phone, walletAddress });
    const createdRecord = store.users.find((u) => u.id === user.id);
    if (createdRecord) {
      await upsertUserInSupabase(createdRecord);
    }
    await ensureSupabaseAuthUser({ email: normalizedEmail, password, fullName });
    await persistStoreToSupabase();

    const token = createSessionToken(user);
    const response = NextResponse.json({ user, accessToken: token }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(request, 86400));
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Registration failed' },
      { status: 400 },
    );
  }
}

