import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ensureStoreReady, persistStoreToSupabase } from '../../../lib/anagu-store';

export async function POST(request: NextRequest) {
  try {
    const store = await ensureStoreReady();
    const body = await request.json();
    const { name, email, organization, subject, message } = body ?? {};
    if (!name || !email || !message) {
      return NextResponse.json(
        { message: 'Name, email, and message are required' },
        { status: 400 },
      );
    }
    const entry = {
      id: crypto.randomUUID(),
      name: String(name),
      email: String(email),
      organization: String(organization || 'Public Inquiry'),
      subject: String(subject || 'General Inquiry'),
      message: String(message),
      createdAt: new Date().toISOString(),
    };
    store.contacts.unshift(entry);
    await persistStoreToSupabase();
    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'Failed to submit inquiry' }, { status: 400 });
  }
}
