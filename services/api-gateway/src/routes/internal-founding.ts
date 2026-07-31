import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';

// INTERNAL/SUPER-ADMIN founding administration + recovery operations. Mounted under
// /internal/* behind the internal perimeter (internal API secret). Every mutating
// op records the actor (X-Admin-User-Id) and emits an event via the underlying RPC.
// The platform-console admin UI proxies here.

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;
type Db = ReturnType<typeof getSupabaseAdmin>;

function actorId(c: AppContext): string | null {
    return c.req.header('X-Admin-User-Id') || null;
}

async function readBody(c: AppContext): Promise<Record<string, unknown>> {
    return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
}

// GET /internal/founding/overview — program config + reconciliation status.
router.get('/overview', async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const { data: program } = await db.from('founding_merchant_program').select('*').eq('program_key', 'v1').maybeSingle();
    const { data: reconcile } = await db.rpc('reconcile_founding_program', { p_repair: false });
    return c.json(success({ program: program ?? null, reconcile: reconcile ?? null }));
});

// GET /internal/founding/allocations?search=&limit= — list / search allocations.
router.get('/allocations', async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const limit = Math.min(Number(c.req.query('limit') || 100), 500);
    const search = (c.req.query('search') || '').trim();
    let query = db
        .from('founding_merchant_allocations')
        .select('id, site_id, founding_number, allocation_source, plan_slug, locked_monthly_price, allocated_at, released_at, release_reason, founding_released')
        .order('founding_number', { ascending: true })
        .limit(limit);
    if (search) {
        query = /^\d+$/.test(search) ? query.eq('founding_number', Number(search)) : query.eq('site_id', search);
    }
    const { data } = await query;
    return c.json(success({ allocations: data ?? [] }));
});

// GET /internal/founding/export — CSV export of all allocations.
router.get('/export', async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const { data } = await db
        .from('founding_merchant_allocations')
        .select('founding_number, site_id, allocation_source, plan_slug, locked_monthly_price, allocated_at, released_at, release_reason')
        .order('founding_number', { ascending: true });
    const rows = (data as Array<Record<string, unknown>>) ?? [];
    const header = 'founding_number,site_id,allocation_source,plan_slug,locked_monthly_price,allocated_at,released_at,release_reason';
    const body = [header, ...rows.map((r) => [
        r.founding_number, r.site_id, r.allocation_source, r.plan_slug, r.locked_monthly_price,
        r.allocated_at, r.released_at ?? '', String(r.release_reason ?? '').replace(/,/g, ';'),
    ].join(','))].join('\n');
    return c.body(body, 200, { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="founding-allocations.csv"' });
});

// POST /internal/founding/state — pause / resume / disable the program.
router.post('/state', async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const body = await readBody(c);
    const { data } = await db.rpc('set_founding_program_state', {
        p_active: typeof body.active === 'boolean' ? body.active : null,
        p_paused: typeof body.paused === 'boolean' ? body.paused : null,
        p_reason: typeof body.reason === 'string' ? body.reason : null,
        p_actor_id: actorId(c),
    });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

// POST /internal/founding/allocate — manual allocation recovery (force optional).
router.post('/allocate', async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const body = await readBody(c);
    if (!body.site_id) return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    const { data } = await db.rpc('allocate_founding_merchant', {
        p_site_id: body.site_id,
        p_subscription_id: body.subscription_id ?? null,
        p_idempotency_key: `admin-allocate:${String(body.site_id)}`,
        p_actor_id: actorId(c),
        p_actor_type: 'super_admin',
        p_force: Boolean(body.force),
        p_source_override: typeof body.allocation_source === 'string' ? body.allocation_source : null,
    });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

// POST /internal/founding/reclaim — manual reclaim (force bypasses the 14-day window).
router.post('/reclaim', async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const body = await readBody(c);
    if (!body.site_id) return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    const { data } = await db.rpc('reclaim_founding_merchant', {
        p_site_id: body.site_id,
        p_reason: typeof body.reason === 'string' ? body.reason : 'admin_manual',
        p_actor_id: actorId(c),
        p_actor_type: 'super_admin',
        p_force: Boolean(body.force),
    });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

// POST /internal/founding/repair-lock — re-sync sites lock columns from the allocation.
router.post('/repair-lock', async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const body = await readBody(c);
    if (!body.site_id) return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    const { data } = await db.rpc('admin_repair_price_lock', {
        p_site_id: body.site_id,
        p_actor_id: actorId(c),
        p_reason: typeof body.reason === 'string' ? body.reason : 'price_lock_repair',
    });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

// POST /internal/founding/reconcile — counter drift check (repair=true to fix).
router.post('/reconcile', async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const body = await readBody(c);
    const { data } = await db.rpc('reconcile_founding_program', { p_repair: Boolean(body.repair) });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

export default router;
