import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
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
  verifySupabaseJwt,
} from '../../../../lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const store = await ensureStoreReady({ force: true });
    const body = await request.json();
    const mode = body?.mode === 'signup' ? 'signup' : body?.mode === 'token' ? 'token' : 'signin';
    const walletAddress =
      typeof body?.walletAddress === 'string' && ethers.isAddress(body.walletAddress)
        ? ethers.getAddress(body.walletAddress)
        : undefined;

    let supabaseUid = '';
    let email = '';
    let displayName = '';
    let submittedPassword = '';

    if (mode === 'token') {
      const accessToken = String(body?.accessToken || '').trim();
      if (!accessToken) {
        return NextResponse.json({ message: 'Supabase access token is required' }, { status: 400 });
      }
      const claims = await verifySupabaseJwt(accessToken);
      if (!claims?.sub) {
        return NextResponse.json(
          { message: 'Supabase token verification failed against JWKS' },
          { status: 401 },
        );
      }
      supabaseUid = String(claims.sub);
      email = String(claims.email || '').trim().toLowerCase();
      const meta = (claims.user_metadata || {}) as Record<string, unknown>;
      displayName = String(meta.full_name || meta.name || email.split('@')[0] || 'Supabase User');
    } else {
      const rawEmail = String(body?.email || '').trim().toLowerCase();
      const password = String(body?.password || '');
      submittedPassword = password;
      const fullName = String(body?.fullName || '').trim();

      if (!rawEmail || !password) {
        return NextResponse.json(
          { message: 'Email and password are required for Supabase authentication' },
          { status: 400 },
        );
      }

      const supabase = getSupabaseAuthClient();
      if (!supabase) {
        return NextResponse.json(
          { message: 'Supabase authentication is not configured on the server' },
          { status: 500 },
        );
      }

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: rawEmail,
          password,
          options: {
            data: {
              full_name: fullName || rawEmail.split('@')[0],
            },
          },
        });
        if (error) {
          return NextResponse.json({ message: error.message }, { status: 400 });
        }
        if (!data.user) {
          return NextResponse.json({ message: 'Unable to create Supabase user' }, { status: 400 });
        }
        if (!data.session) {
          return NextResponse.json(
            {
              confirmationRequired: true,
              message:
                'Supabase account created. Please check your email to confirm your address before signing in.',
            },
            { status: 200 },
          );
        }
        supabaseUid = data.user.id;
        email = (data.user.email || rawEmail).toLowerCase();
        displayName = fullName || (data.user.user_metadata?.full_name as string) || email.split('@')[0];
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: rawEmail,
          password,
        });
        if (error || !data.user) {
          return NextResponse.json(
            { message: error?.message || 'Invalid Supabase credentials' },
            { status: 401 },
          );
        }
        supabaseUid = data.user.id;
        email = (data.user.email || rawEmail).toLowerCase();
        displayName =
          (data.user.user_metadata?.full_name as string) ||
          fullName ||
          email.split('@')[0];
      }
    }

    if (!email) {
      return NextResponse.json(
        { message: 'Verified Supabase email is required' },
        { status: 400 },
      );
    }

    let user: UserAccount | undefined = store.users.find(
      (u) => u.email.trim().toLowerCase() === email,
    );
    if (!user) {
      const dbUser = await findUserByEmailInSupabase(email);
      if (dbUser) {
        store.users.push(dbUser);
        user = dbUser;
      }
    }

    if (!user) {
      user = {
        id: supabaseUid,
        email,
        passwordHash: submittedPassword ? hashPassword(submittedPassword) : '',
        role: 'CITIZEN',
        fullName: displayName || email.split('@')[0],
        phone: '',
        walletAddress:
          walletAddress ||
          '0x' + Buffer.from(supabaseUid.padEnd(20, '0')).subarray(0, 20).toString('hex'),
        walletVerified: Boolean(walletAddress),
        walletLinkedAt: walletAddress ? new Date().toISOString() : null,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      store.users.push(user);
      recordAudit(
        user.id,
        user.fullName,
        user.role,
        'USER_SUPABASE_LOGIN',
        'USER',
        user.id,
        'SUCCESS',
        `Created ${user.role} session via Supabase Auth (${email})`,
      );
    } else {
      if (!user.isActive) {
        return NextResponse.json(
          { message: 'This account is suspended. Contact Land Administrator.' },
          { status: 403 },
        );
      }
      if (submittedPassword && !user.passwordHash) {
        user.passwordHash = hashPassword(submittedPassword);
      }
      if (walletAddress && !user.walletVerified) {
        user.walletAddress = walletAddress;
        user.walletVerified = true;
        user.walletLinkedAt = new Date().toISOString();
      }
      recordAudit(
        user.id,
        user.fullName,
        user.role,
        'USER_SUPABASE_LOGIN',
        'USER',
        user.id,
        'SUCCESS',
        `Authenticated via Supabase Auth (${email})`,
      );
    }

    await upsertUserInSupabase(user);
    await persistStoreToSupabase();

    const safeUser = toSafeUser(user);
    const token = createSessionToken(safeUser);
    const response = NextResponse.json({ user: safeUser, accessToken: token });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(request, 86400));
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Supabase session error' },
      { status: 500 },
    );
  }
}
