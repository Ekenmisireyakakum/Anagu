import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateUser,
  createSessionToken,
  ensureStoreReady,
  persistStoreToSupabase,
  recordAudit,
  toSafeUser,
  type SafeUser,
  type UserAccount,
  type UserRole,
} from '../../../../lib/anagu-store';
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from '../../../../lib/server-auth';
import {
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  getSupabaseConfig,
} from '../../../../lib/supabase';

const ALLOWED_ADMIN_ROLES = new Set(['LAND_ADMINISTRATOR', 'REGISTRAR', 'GOVERNOR']);

export async function POST(request: NextRequest) {
  try {
    const store = await ensureStoreReady({ force: true });
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { message: 'Admin email and password are required' },
        { status: 400 },
      );
    }

    let user: SafeUser | null = authenticateUser(email, password);

    if (!user) {
      const supabaseCfg = getSupabaseConfig();
      const supabaseAuth = getSupabaseAuthClient();

      if (supabaseAuth) {
        const { data: sbData, error: sbError } = await supabaseAuth.auth.signInWithPassword({
          email,
          password,
        });

        if (!sbError && sbData?.user) {
          const normalizedEmail = (sbData.user.email || email).trim().toLowerCase();
          const existingUser = store.users.find(
            (u) => u.email.trim().toLowerCase() === normalizedEmail,
          );
          const appMetaRole =
            typeof sbData.user.app_metadata?.role === 'string'
              ? sbData.user.app_metadata.role.trim().toUpperCase()
              : '';
          const hasAdminAppMeta = ALLOWED_ADMIN_ROLES.has(appMetaRole);

          if (existingUser) {
            if (!existingUser.isActive) {
              return NextResponse.json(
                { message: 'This administrator account is suspended.' },
                { status: 403 },
              );
            }
            if (!ALLOWED_ADMIN_ROLES.has(existingUser.role)) {
              if (hasAdminAppMeta) {
                existingUser.role = appMetaRole as UserRole;
              } else {
                recordAudit(
                  existingUser.id,
                  existingUser.fullName,
                  existingUser.role,
                  'ADMIN_LOGIN_DENIED',
                  'USER',
                  existingUser.id,
                  'DENIED',
                  `Supabase Auth account ${existingUser.email} (${existingUser.role}) attempted admin login without admin role`,
                );
                await persistStoreToSupabase();
                return NextResponse.json(
                  {
                    message: `Supabase Auth credentials are valid for ${normalizedEmail}, but its role in public.anagu_users is ${existingUser.role}. Update role to LAND_ADMINISTRATOR in Supabase SQL Editor.`,
                  },
                  { status: 403 },
                );
              }
            }
            user = toSafeUser(existingUser);
          } else if (hasAdminAppMeta) {
            const newAdmin: UserAccount = {
              id: sbData.user.id,
              email: normalizedEmail,
              passwordHash: '',
              role: appMetaRole as UserRole,
              fullName:
                (typeof sbData.user.user_metadata?.full_name === 'string' &&
                  sbData.user.user_metadata.full_name.trim()) ||
                normalizedEmail.split('@')[0],
              phone: '',
              walletAddress:
                '0x' + Buffer.from(sbData.user.id.padEnd(20, '0')).subarray(0, 20).toString('hex'),
              walletVerified: false,
              walletLinkedAt: null,
              isActive: true,
              createdAt: new Date().toISOString(),
            };
            store.users.push(newAdmin);
            user = toSafeUser(newAdmin);
          } else {
            return NextResponse.json(
              {
                message: `Supabase Auth succeeded for ${normalizedEmail}, but this account does not have an Admin role in public.anagu_users yet. Run: update public.anagu_users or insert ${normalizedEmail} with role = 'LAND_ADMINISTRATOR'.`,
              },
              { status: 403 },
            );
          }
        } else if (sbError?.message?.toLowerCase().includes('email not confirmed')) {
          return NextResponse.json(
            {
              message:
                'Your Supabase user email is not confirmed yet. In Supabase Dashboard -> Authentication -> Users, confirm the user before signing in.',
            },
            { status: 401 },
          );
        }
      }

      if (!user) {
        if (!supabaseCfg.isConfigured) {
          return NextResponse.json(
            {
              message:
                'Invalid admin email or password. Supabase is not connected on this server yet (SUPABASE_URL and SUPABASE_SECRET_KEY are missing from environment variables), so external Supabase users cannot be checked here until connected. Sign in locally with davidemma256@gmail.com.',
            },
            { status: 401 },
          );
        }
        if (!getSupabaseAdminClient()) {
          return NextResponse.json(
            {
              message:
                'Invalid admin email or password. Note: SUPABASE_SECRET_KEY is not set on the server, so custom users in public.anagu_users cannot be loaded.',
            },
            { status: 401 },
          );
        }
        return NextResponse.json(
          { message: 'Invalid admin email or password' },
          { status: 401 },
        );
      }
    }

    if (!ALLOWED_ADMIN_ROLES.has(user.role)) {
      recordAudit(
        user.id,
        user.fullName,
        user.role,
        'ADMIN_LOGIN_DENIED',
        'USER',
        user.id,
        'DENIED',
        `Non-admin account ${user.email} (${user.role}) attempted to sign in at /admin/login`,
      );
      await persistStoreToSupabase();
      return NextResponse.json(
        {
          message:
            'Access denied: only Land Administrator, Registrar, or Governor accounts may access the Admin Dashboard.',
        },
        { status: 403 },
      );
    }

    const token = createSessionToken(user);
    recordAudit(
      user.id,
      user.fullName,
      user.role,
      'ADMIN_LOGIN',
      'USER',
      user.id,
      'SUCCESS',
      `Admin session started for ${user.email} (${user.role})`,
    );
    await persistStoreToSupabase();

    const response = NextResponse.json({ user, accessToken: token });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(request, 86400));
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Admin login failed' },
      { status: 500 },
    );
  }
}
