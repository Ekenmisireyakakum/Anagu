import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  createSessionToken,
  ensureStoreReady,
  hashPassword,
  persistStoreToSupabase,
  recordAudit,
  toSafeUser,
  type UserAccount,
} from '../../../../lib/anagu-store';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '../../../../lib/server-auth';
import {
  findUserByEmailInSupabase,
  getSupabaseAuthClient,
  upsertUserInSupabase,
} from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const store = await ensureStoreReady({ force: true });
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!store.users.some((u) => u.email.trim().toLowerCase() === normalizedEmail)) {
      const dbUser = await findUserByEmailInSupabase(normalizedEmail);
      if (dbUser) {
        store.users.push(dbUser);
      }
    }

    let user = authenticateUser(normalizedEmail, String(password));

    if (!user) {
      const supabase = getSupabaseAuthClient();
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: String(password),
        });
        if (!error && data.user) {
          let record: UserAccount | undefined = store.users.find(
            (u) => u.email.trim().toLowerCase() === normalizedEmail,
          );
          if (!record) {
            record = {
              id: data.user.id,
              email: normalizedEmail,
              passwordHash: hashPassword(String(password)),
              role: 'CITIZEN',
              fullName:
                String(data.user.user_metadata?.full_name || '').trim() ||
                normalizedEmail.split('@')[0],
              phone: '',
              walletAddress: '0x' + crypto.randomBytes(20).toString('hex'),
              walletVerified: false,
              walletLinkedAt: null,
              isActive: true,
              createdAt: new Date().toISOString(),
            };
            store.users.push(record);
          } else {
            if (!record.isActive) {
              return NextResponse.json(
                { message: 'This account is suspended. Contact Land Administrator.' },
                { status: 403 },
              );
            }
            record.passwordHash = hashPassword(String(password));
          }
          await upsertUserInSupabase(record);
          user = toSafeUser(record);
        }
      }
    }

    if (!user) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    const token = createSessionToken(user);
    recordAudit(
      user.id,
      user.fullName,
      user.role,
      'USER_LOGIN',
      'USER',
      user.id,
      'SUCCESS',
      `Authenticated session started for ${user.email}`,
    );
    await persistStoreToSupabase();

    const response = NextResponse.json({ user, accessToken: token });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(request, 86400));
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Login failed' },
      { status: 500 },
    );
  }
}

