import { NextResponse } from 'next/server';
import {
    createLetbuyyApiClient,
    resolveLetbuyyApiBaseUrl,
    LETBUYY_PRODUCTION_API_BASE_URL,
} from '@letbuyy/api-client';

// Same-origin proxy so the (client) Pricing component can read the PUBLIC gateway
// pricing + live remaining-slots counter without CORS. No auth token (these gateway
// endpoints are mounted before the auth middleware). Never hardcodes counts.
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const api = createLetbuyyApiClient({
            baseUrl: resolveLetbuyyApiBaseUrl(
                [process.env.LETBUYY_API_URL, process.env.NEXT_PUBLIC_API_URL],
                { fallback: LETBUYY_PRODUCTION_API_BASE_URL },
            ),
            fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
        });
        const [pricing, remaining] = await Promise.all([
            api.foundingProgram.pricing(),
            api.foundingProgram.remaining(),
        ]);
        return NextResponse.json({ data: { pricing, remaining } });
    } catch {
        return NextResponse.json(
            { error: 'Pricing is temporarily unavailable. Please try again later.' },
            { status: 502 },
        );
    }
}
