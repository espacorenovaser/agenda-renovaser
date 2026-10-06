import { NextResponse } from 'next/server';
import { oauth2Client, SCOPES } from '@/lib/google';

export async function GET() {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  return NextResponse.redirect(url);
}