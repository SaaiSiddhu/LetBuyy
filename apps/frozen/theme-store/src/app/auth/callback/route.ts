import { NextResponse } from 'next/server';
import { getAccountsUrl } from '@/lib/public-urls';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const next = searchParams.get('next') ?? '/';
    const returnTo = next.startsWith('/') ? `${origin}${next}` : origin;
    const loginUrl = new URL('/lookup', getAccountsUrl());

    loginUrl.searchParams.set('return_to', returnTo);
    return NextResponse.redirect(loginUrl);
}
