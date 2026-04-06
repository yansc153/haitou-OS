import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'crypto';

const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET) console.warn('[admin-auth] WARNING: ADMIN_SECRET not set. Admin panel disabled.');

function makeToken(secret: string): string {
  return createHash('sha256').update(`admin:${secret}:salt-haitou`).digest('hex').slice(0, 32);
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!ADMIN_SECRET || password !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'wrong password' }, { status: 401 });
  }

  const token = makeToken(ADMIN_SECRET);
  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  return res;
}
