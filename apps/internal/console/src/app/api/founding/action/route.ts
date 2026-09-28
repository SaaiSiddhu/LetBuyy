import { NextRequest, NextResponse } from 'next/server';
import { fetchConsoleApi } from '@/lib/console-api';
import { requireConsoleApiSession } from '@/lib/console-api-auth';

// Server-side proxy for super-admin founding mutations. Runs with the console API
// token (internal secret) and dispatches to the gateway /internal/founding/* RPCs.
// Every op is audited by the underlying SECURITY DEFINER RPC (actor_type='super_admin').
//
// Auth hardening follow-up (Section 13): this route was reachable with NO session check at all --
// it is not under any of proxy.ts's protectedPrefixes (/api/founding/action matches none of them),
// and PLATFORM_CONSOLE_API_TOKEN (used below via fetchConsoleApi) is a shared, service-level
// credential, not a person-level one -- it proves "this call came from the console app," never "this
// specific operator is still an allowed one." requireConsoleApiSession closes a real static-token
// bypass, not a theoretical one: these actions can pause/disable the entire founding-merchant program
// and reallocate site slots.

const ACTIONS: Record<string, (b: Record<string, unknown>) => { path: string; payload: Record<string, unknown> }> = {
    pause: (b) => ({ path: '/internal/founding/state', payload: { paused: true, reason: b.reason ?? 'admin_pause' } }),
    resume: () => ({ path: '/internal/founding/state', payload: { paused: false } }),
    disable: () => ({ path: '/internal/founding/state', payload: { active: false } }),
    enable: () => ({ path: '/internal/founding/state', payload: { active: true } }),
    reconcile: () => ({ path: '/internal/founding/reconcile', payload: { repair: true } }),
    allocate: (b) => ({ path: '/internal/founding/allocate', payload: { site_id: b.site_id, force: true, allocation_source: b.allocation_source } }),
    reclaim: (b) => ({ path: '/internal/founding/reclaim', payload: { site_id: b.site_id, reason: b.reason ?? 'admin_manual', force: true } }),
    'repair-lock': (b) => ({ path: '/internal/founding/repair-lock', payload: { site_id: b.site_id } }),
};

export async function POST(req: NextRequest) {
    const unauthorized = await requireConsoleApiSession(req, { mfa: true });
    if (unauthorized) return unauthorized;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '');
    const builder = ACTIONS[action];
    if (!builder) {
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    if ((action === 'allocate' || action === 'reclaim' || action === 'repair-lock') && !body.site_id) {
        return NextResponse.json({ error: 'site_id is required' }, { status: 400 });
    }
    const { path, payload } = builder(body);
    const result = await fetchConsoleApi(path, { method: 'POST', body: payload });
    if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({ data: result.data });
}
