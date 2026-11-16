import { NextRequest, NextResponse } from 'next/server';
import {
  getAnaguStore,
  recordAudit,
  toSafeUser,
  type UserRole,
} from '../../../lib/anagu-store';
import { getAuthenticatedUser } from '../../../lib/server-auth';

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  const store = getAnaguStore();
  // Registrars and Admins can view user directory for transfer / governance lookup
  if (user.role === 'LAND_ADMINISTRATOR' || user.role === 'REGISTRAR') {
    return NextResponse.json(store.users.map(toSafeUser));
  }
  return NextResponse.json(
    { message: 'FORBIDDEN: Only Land Administrators or Registrars may list users' },
    { status: 403 },
  );
}

export async function PATCH(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }
  if (user.role !== 'LAND_ADMINISTRATOR') {
    recordAudit(
      user.id,
      user.fullName,
      user.role,
      'USER_ROLE_CHANGE_BLOCKED',
      'USER',
      'N/A',
      'DENIED',
      `Non-admin role ${user.role} attempted to modify user accounts`,
    );
    return NextResponse.json(
      { message: 'FORBIDDEN: Only Land Administrators may modify user roles or active status' },
      { status: 403 },
    );
  }
  const body = await request.json();
  const store = getAnaguStore();
  const target = store.users.find((u) => u.id === body.userId);
  if (!target) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }
  if (typeof body.isActive === 'boolean') {
    target.isActive = body.isActive;
  }
  if (body.role) {
    target.role = body.role as UserRole;
  }
  recordAudit(
    user.id,
    user.fullName,
    user.role,
    'USER_UPDATED',
    'USER',
    target.id,
    'SUCCESS',
    `Updated ${target.email}: role=${target.role}, active=${target.isActive}`,
  );
  return NextResponse.json(toSafeUser(target));
}
