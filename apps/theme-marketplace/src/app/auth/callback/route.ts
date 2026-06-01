import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const next = searchParams.get('next') ?? '/';
    const returnTo = next.startsWith('/') ? `${origin}${next}` : origin;
    const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store';
    const loginUrl = new URL('/lookup', accountsUrl);

    loginUrl.searchParams.set('return_to', returnTo);
    return NextResponse.redirect(loginUrl);
}
