import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createOAuth2Client, SCOPES } from '@/lib/google';

export async function GET() {
  const state = randomBytes(32).toString('hex');
  const url = createOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });

  const response = NextResponse.redirect(url);
  response.cookies.set('rs_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}