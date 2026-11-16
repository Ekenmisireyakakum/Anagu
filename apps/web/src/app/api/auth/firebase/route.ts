import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
  createSessionToken,
  getAnaguStore,
  recordAudit,
  toSafeUser,
  type UserAccount,
} from '../../../../lib/anagu-store';
import { SESSION_COOKIE_NAME } from '../../../../lib/server-auth';

const BOOTSTRAPPED_ADMIN_EMAIL = 'blinxtanimuyakakum@gmail.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const uid = String(body.uid || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim();
    const emailVerified = Boolean(body.emailVerified);
    const walletAddress =
      typeof body.walletAddress === 'string' && ethers.isAddress(body.walletAddress)
        ? ethers.getAddress(body.walletAddress)
        : undefined;

    if (!uid || !email || !emailVerified) {
      return NextResponse.json(
        { message: 'Verified Firebase Google account is required' },
        { status: 400 },
      );
    }

    const store = getAnaguStore();
    let user: UserAccount | undefined = store.users.find(
      (u) => u.email.toLowerCase() === email,
    );

    if (!user) {
      const assignedRole =
        email === BOOTSTRAPPED_ADMIN_EMAIL ? 'LAND_ADMINISTRATOR' : 'CITIZEN';
      user = {
        id: uid,
        email,
        passwordHash: '',
        role: assignedRole,
        fullName: displayName || email.split('@')[0],
        phone: '',
        walletAddress:
          walletAddress || '0x' + Buffer.from(uid.padEnd(20, '0')).subarray(0, 20).toString('hex'),
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
        'USER_FIREBASE_LOGIN',
        'USER',
        user.id,
        'SUCCESS',
        `Created ${user.role} session via Firebase Google Auth (${email})`,
      );
    } else {
      if (!user.isActive) {
        return NextResponse.json(
          { message: 'This account is suspended. Contact Land Administrator.' },
          { status: 403 },
        );
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
        'USER_FIREBASE_LOGIN',
        'USER',
        user.id,
        'SUCCESS',
        `Authenticated via Firebase Google Auth (${email})`,
      );
    }

    const safeUser = toSafeUser(user);
    const token = createSessionToken(safeUser);
    const response = NextResponse.json({ user: safeUser, accessToken: token });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : 'Firebase session error' },
      { status: 500 },
    );
  }
}
