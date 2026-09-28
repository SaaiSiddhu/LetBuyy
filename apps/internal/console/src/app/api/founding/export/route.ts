import { NextRequest, NextResponse } from 'next/server';
import { fetchConsoleApi, type ConsoleDataResponse } from '@/lib/console-api';
import { requireConsoleApiSession } from '@/lib/console-api-auth';

// Auth hardening follow-up (Section 13): this export route was reachable with NO session check at
// all -- see founding/action/route.ts's own comment for the full reasoning (identical gap, same fix).

type Alloc = {
    founding_number: number;
    site_id: string;
    allocation_source: string;
    plan_slug: string;
    locked_monthly_price: number;
    allocated_at: string | null;
    released_at: string | null;
    release_reason: string | null;
};

// CSV export of founding allocations (server-side; uses the console API token).
export async function GET(request: NextRequest) {
    const unauthorized = await requireConsoleApiSession(request, { mfa: true });
    if (unauthorized) return unauthorized;
    const result = await fetchConsoleApi<ConsoleDataResponse<{ allocations: Alloc[] }>>(
        '/internal/founding/allocations',
        { limit: 500 },
    );
    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 502 });
    }
    const rows = result.data?.data?.allocations ?? [];
    const header = 'founding_number,site_id,allocation_source,plan_slug,locked_monthly_price,allocated_at,released_at,release_reason';
    const csv = [
        header,
        ...rows.map((r) => [
            r.founding_number,
            r.site_id,
            r.allocation_source,
            r.plan_slug,
            r.locked_monthly_price,
            r.allocated_at ?? '',
            r.released_at ?? '',
            String(r.release_reason ?? '').replace(/,/g, ';'),
        ].join(',')),
    ].join('\n');

    return new NextResponse(csv, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="founding-allocations.csv"',
        },
    });
}
