import { Hono } from 'hono';
import { z } from 'zod';
import { consolePermission, requireConsolePermission } from '../identity-foundation/console-approval-repository';
import { consoleBridge } from '../identity-foundation/console-bridge';
import { AppError, ValidationError } from '../lib/errors';
import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, getSupabaseAdminForOperatorRead, success } from '../lib/supabase';

// INTERNAL/SUPER-ADMIN founding administration + recovery operations. Mounted under
// /internal/* behind the internal perimeter (internal API secret). Every mutating
// op binds the current permitted Console operator and emits its event via the underlying RPC.
// The admin-web admin UI proxies here.

const router = new Hono<{ Bindings: Env }>();
router.use('*', consoleBridge);
type AppContext = Context<{ Bindings: Env }>;
type Db = ReturnType<typeof getSupabaseAdmin>;

function actorId(c: AppContext): string | null {
    const actor = c.get('consolePermissionState');
    if (!actor) throw new AppError('A current Console session is required.', 401, 'CONSOLE_SESSION_REQUIRED');
    return actor.actor_id;
}

const commandSchemas = {
    state: z.object({active:z.boolean().optional(),paused:z.boolean().optional(),reason:z.string().trim().min(8).max(1000).optional()})
        .refine(value=>value.active!==undefined||value.paused!==undefined),
    allocate: z.object({site_id:z.string().uuid(),subscription_id:z.string().uuid().nullable().optional(),force:z.boolean().optional(),allocation_source:z.enum(['PUBLIC','INVITED','PARTNER']).optional()}),
    reclaim: z.object({site_id:z.string().uuid(),reason:z.string().trim().min(8).max(1000).default('admin_manual'),force:z.boolean().optional()}),
    'repair-lock': z.object({site_id:z.string().uuid(),reason:z.string().trim().min(8).max(1000).default('price_lock_repair')}),
    reconcile: z.object({repair:z.boolean().default(false)}),
};
async function readBody(c: AppContext): Promise<Record<string, unknown>> {
    await requireConsolePermission(c, 'rbac:manage');
    const key = c.req.path.split('/').at(-1) as keyof typeof commandSchemas;
    const parsed = commandSchemas[key].safeParse(await c.req.json().catch(()=>null));
    if (!parsed.success) throw new ValidationError('Invalid founding program action. Check the site ID, state and reason.');
    return parsed.data;
}
async function foundingRpc(c: AppContext, name: string, args: Record<string, unknown>) {
    const { data, error } = await getSupabaseAdmin(c).rpc(name, args);
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('The founding action could not be confirmed. Review the current record before retrying.',503,'FOUNDING_ACTION_UNAVAILABLE');
    const result = data as Record<string, unknown>;
    if (result.allocated === false || result.reclaimed === false || result.ok === false || result.status === 'program_not_found') {
        throw new AppError('The founding action was not applied. Review programme eligibility and the current allocation.',409,'FOUNDING_ACTION_REJECTED');
    }
    return result;
}

// GET /internal/founding/overview — program config + reconciliation status.
router.get('/overview', consolePermission('merchant:view'), async (c) => {
    const db: Db = getSupabaseAdmin(c);
    const { data: program, error: programError } = await db.from('founding_merchant_program').select('*').eq('program_key', 'v1').maybeSingle();
    const { data: reconcile, error: reconcileError } = await db.rpc('reconcile_founding_program', { p_repair: false });
    if (programError || reconcileError) throw new AppError('Founding programme data is unavailable.',503,'FOUNDING_READ_UNAVAILABLE');
    return c.json(success({ program: program ?? null, reconcile: reconcile ?? null }));
});

// GET /internal/founding/allocations?search=&limit= — list / search allocations.
const AllocationListSchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    page: z.coerce.number().int().min(1).default(1),
    search: z.union([z.string().uuid(), z.string().regex(/^\d{1,9}$/), z.literal('')]).default(''),
});
router.get('/allocations', consolePermission('merchant:view'), async (c) => {
    const parsed = AllocationListSchema.safeParse({ limit: c.req.query('limit'), page: c.req.query('page'), search: c.req.query('search') });
    if (!parsed.success) return c.json({ error: { code: 'VALIDATION', message: 'Use a founding number or site ID and a valid page size.' } }, 400);
    const { limit, page, search } = parsed.data;
    const db: Db = getSupabaseAdminForOperatorRead(c);
    let query = db
        .from('founding_merchant_allocations')
        .select('id, site_id, founding_number, allocation_source, plan_slug, locked_monthly_price, allocated_at, released_at, release_reason, founding_released', { count: 'exact' })
        .order('founding_number', { ascending: true })
        .range((page - 1) * limit, page * limit - 1);
    if (search) {
        query = /^\d+$/.test(search) ? query.eq('founding_number', Number(search)) : query.eq('site_id', search);
    }
    const { data, error, count } = await query;
    if (error) return c.json({ error: { code: 'FOUNDING_READ_UNAVAILABLE', message: 'Founding allocations could not be loaded.' } }, 503);
    return c.json(success({ allocations: data ?? [], page, per_page: limit, total: count ?? 0 }));
});

// GET /internal/founding/export — a validated allocation page, never a silent full-export cap.
router.get('/export', consolePermission('merchant:view'), async (c) => {
    const parsed = AllocationListSchema.safeParse({ limit:c.req.query('limit'),page:c.req.query('page'),search:c.req.query('search') });
    if (!parsed.success) throw new ValidationError('Use a founding number or site ID and a valid page size.');
    const {limit,page,search}=parsed.data;
    const db = getSupabaseAdminForOperatorRead(c);
    let query = db.from('founding_merchant_allocations')
        .select('founding_number, site_id, allocation_source, plan_slug, locked_monthly_price, allocated_at, released_at, release_reason')
        .order('founding_number', {ascending:true}).range((page - 1) * limit, page * limit - 1);
    if(search)query=/^\d+$/.test(search)?query.eq('founding_number',Number(search)):query.eq('site_id',search);
    const {data,error}=await query;
    if(error)throw new AppError('Founding export is unavailable.',503,'FOUNDING_READ_UNAVAILABLE');
    const columns=['founding_number','site_id','allocation_source','plan_slug','locked_monthly_price','allocated_at','released_at','release_reason'];
    const cell=(value:unknown)=>{
        let text=value==null?'':String(value);
        if(typeof value==='string'&&/^\s*[=+@-]/.test(text))text="'"+text;
        return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
    };
    const csv=[columns.join(','),...((data??[]) as Array<Record<string,unknown>>).map(row=>columns.map(key=>cell(row[key])).join(','))].join('\r\n');
    return c.body(csv,200,{'Content-Type':'text/csv; charset=utf-8','Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="founding-allocations-page-${page}.csv"`});
});

// POST /internal/founding/state — pause / resume / disable the program.
router.post('/state', consolePermission('rbac:manage'), async (c) => {
    const body = await readBody(c);
    const data = await foundingRpc(c, 'set_founding_program_state', {
        p_active: typeof body.active === 'boolean' ? body.active : null,
        p_paused: typeof body.paused === 'boolean' ? body.paused : null,
        p_reason: typeof body.reason === 'string' ? body.reason : null,
        p_actor_id: actorId(c),
    });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

// POST /internal/founding/allocate — manual allocation recovery (force optional).
router.post('/allocate', consolePermission('rbac:manage'), async (c) => {
    const body = await readBody(c);
    if (!body.site_id) return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    const data = await foundingRpc(c, 'allocate_founding_merchant', {
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
router.post('/reclaim', consolePermission('rbac:manage'), async (c) => {
    const body = await readBody(c);
    if (!body.site_id) return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    const data = await foundingRpc(c, 'reclaim_founding_merchant', {
        p_site_id: body.site_id,
        p_reason: typeof body.reason === 'string' ? body.reason : 'admin_manual',
        p_actor_id: actorId(c),
        p_actor_type: 'super_admin',
        p_force: Boolean(body.force),
    });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

// POST /internal/founding/repair-lock — re-sync sites lock columns from the allocation.
router.post('/repair-lock', consolePermission('rbac:manage'), async (c) => {
    const body = await readBody(c);
    if (!body.site_id) return c.json({ error: { code: 'VALIDATION', message: 'site_id is required' } }, 400);
    const data = await foundingRpc(c, 'admin_repair_price_lock', {
        p_site_id: body.site_id,
        p_actor_id: actorId(c),
        p_reason: typeof body.reason === 'string' ? body.reason : 'price_lock_repair',
    });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

// POST /internal/founding/reconcile — counter drift check (repair=true to fix).
router.post('/reconcile', consolePermission('rbac:manage'), async (c) => {
    const body = await readBody(c);
    const data = await foundingRpc(c, 'reconcile_founding_program', { p_repair: Boolean(body.repair) });
    return c.json(success((data as Record<string, unknown>) ?? {}));
});

export default router;
