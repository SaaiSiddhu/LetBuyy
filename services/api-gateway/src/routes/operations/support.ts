import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS,
    SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS,
    SupportTicketChannelSchema,
    SupportTicketEscalationTargetSchema,
    SupportTicketMessageVisibilitySchema,
    SupportTicketPrioritySchema,
    SupportTicketQueueTopicSchema,
    SupportTicketStatusSchema,
    SupportTicketTopicSchema,
    type JsonRecord,
} from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { SupportExecutionAdapter, type SupportMutation } from '../../execution/support-execution.adapter';
import { getSupabaseAdmin, getSupabaseAdminForOperatorRead, paginated, success } from '../../lib/supabase';
import {
    logSensitiveRead,
    requirePermission,
    requirePlatformOperator,
} from '../../middleware/rbac';
import { validate } from '../../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;
type Db = ReturnType<typeof getSupabaseAdmin>;

// Phase 2 / D04 (Mandate 7, Section 7): replaced requireRoleCategory('ops') + requireSuperAdmin
// (superadmin-only, unconditionally, for every route below) with requirePlatformOperator()
// (rbac.ts) -- a NEW, explicitly-designed, separately-tested (require-platform-operator.test.ts, 8
// cases against real middleware + route wiring) gate that preserves every property the old pair
// established -- authentication, fresh-per-request revocation, and platform-scoped (store_id IS
// NULL) membership, verified to still exclude a merchant's own staff even given a role/permission
// string that looks platform-related -- while ALSO permitting the Reviewer/Moderator/Administrator
// tiers D04 approved: an active, non-superadmin platform employee can now reach this router, where
// each route's own EXISTING requirePermission('support:...') call (unchanged, still present on
// every route below) decides which specific actions they may take, using the tiered
// viewer/operator/lead scopes already defined in INTERNAL_PERMISSION_TIERS. A superadmin's access is
// completely unchanged: isSuperAdmin still passes requirePlatformOperator, and still receives the
// full admin-tier scope set from loadEffectivePermissionScopes as before.
//
// P2-OPERATOR-QUEUE-GATE-AND-ACCEPTANCE (owner decision O1, 2026-10-02): the queue is open, in production, to an allowlisted
// super admin and to ACTIVE PLATFORM employees of exactly the reviewer (viewer), operator and lead tiers -- including what a
// buyer's privacy request holds (the buyer-authored note) and the internal notes. A platform role whose default tier is not one
// of those three (today only `admin`, which D04 left unassigned) is refused here. Until O1 this gate was never reached by anyone
// but a super admin: index.ts mounted this router after incident-command's gate on every /operations route; it is now mounted
// before it.
router.use('*', requirePlatformOperator({ admittedTiers: ['viewer', 'operator', 'lead'] }));

// Every route validates its id, query and body with the gateway's validate() middleware, registered AFTER the route's
// requirePermission(...): a caller who may not use the route is refused before anything they sent is looked at, and a
// malformed request from one who may is a 400 (VALIDATION_ERROR, or INVALID_INPUT for a body that is not JSON), never the
// 500 an uncaught ZodError used to become (P2-OPERATOR-QUEUE-CORRECTNESS).
//
// Two topic contracts, on purpose. The queue is FILTERED with SupportTicketQueueTopicSchema, which includes 'privacy' (a
// buyer's privacy request is a ticket the queue holds, so an operator must be able to find them). Tickets and macros are
// CREATED with SupportTicketTopicSchema, which does not: only the buyer's privacy intake writes a privacy ticket, and
// widening the creation enum would let an operator write one with arbitrary metadata.
const ListTicketsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: SupportTicketStatusSchema.optional(),
    priority: SupportTicketPrioritySchema.optional(),
    topic: SupportTicketQueueTopicSchema.optional(),
    assignee_id: z.string().uuid().optional(),
    site_id: z.string().uuid().optional(),
    q: z.string().trim().max(160).optional(),
});

const TicketParamSchema = z.object({
    id: z.string().uuid(),
});

type TicketParam = z.infer<typeof TicketParamSchema>;

const CreateTicketSchema = z.object({
    site_id: z.string().uuid().nullable().optional(),
    requester_type: z.enum(['merchant', 'customer', 'employee', 'anonymous', 'system']).default('merchant'),
    requester_email: z.string().email().nullable().optional(),
    requester_user_id: z.string().uuid().nullable().optional(),
    subject: z.string().trim().min(3).max(240),
    body: z.string().trim().min(1).max(8000),
    channel: SupportTicketChannelSchema.default('in_app'),
    topic: SupportTicketTopicSchema.default('general'),
    priority: SupportTicketPrioritySchema.default('normal'),
    assignee_id: z.string().uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(8).max(1000),
});

const MessageSchema = z.object({
    body: z.string().trim().min(1).max(8000),
    visibility: SupportTicketMessageVisibilitySchema.default('public'),
    status: SupportTicketStatusSchema.optional(),
    macro_id: z.string().uuid().nullable().optional(),
    attachments: z.array(z.record(z.string(), z.unknown())).max(10).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(8).max(1000),
});

const AssignSchema = z.object({
    assignee_id: z.string().uuid().nullable(),
    reason: z.string().trim().min(8).max(1000),
});

const EscalateSchema = z.object({
    target: SupportTicketEscalationTargetSchema,
    reason: z.string().trim().min(8).max(1000),
    linked_incident_id: z.string().uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});

const ResolveSchema = z.object({
    reason: z.string().trim().min(8).max(1000),
    resolution_note: z.string().trim().max(2000).optional(),
});

const CsatSchema = z.object({
    score: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).nullable().optional(),
    reason: z.string().trim().min(8).max(1000),
});

const MacroSchema = z.object({
    name: z.string().trim().min(3).max(160),
    description: z.string().trim().max(500).default(''),
    topic: SupportTicketTopicSchema.default('general'),
    body: z.string().trim().min(1).max(8000),
    is_active: z.boolean().default(true),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    metadata: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(8).max(1000),
});

function actorUserId(c: AppContext): string {
    return c.get('auth').user.id;
}

function actorEmail(c: AppContext): string | null {
    return c.get('auth').user.email || null;
}

function rangeFor(page: number, limit: number) {
    const from = (page - 1) * limit;
    return { from, to: from + limit - 1 };
}

// The search text as ONE quoted operand of an ilike inside PostgREST's or=(...). Quoting keeps the logic-tree grammar's own
// characters -- , . : ( ) -- part of the value instead of being read as filter syntax (unquoted, a search for the subject
// text '(urgent), order #12: "late"' was measured to find nothing); inside the quotes \ and " are escaped. A backslash is
// first doubled for LIKE itself, whose escape character it is, so it matches as text. % and _ keep the wildcard meaning they
// always had here.
function ilikeOperand(text: string): string {
    const pattern = `%${text.replace(/\\/g, '\\\\')}%`;
    return `"${pattern.replace(/["\\]/g, (character) => `\\${character}`)}"`;
}

export function addBusinessDays(start: Date, days: number): Date {
    const date = new Date(start);
    let remaining = days;
    while (remaining > 0) {
        date.setUTCDate(date.getUTCDate() + 1);
        const day = date.getUTCDay();
        if (day !== 0 && day !== 6) remaining -= 1;
    }
    return date;
}

// Exported so the buyer-realm support routes use the SAME reference format. A second generator
// would give the same ticket system two human-facing reference shapes.
export function generateTicketRef(now = new Date()): string {
    const year = now.getUTCFullYear();
    const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `SUP-${year}-${random}`;
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

async function fetchTicket(db: Db, ticketId: string): Promise<JsonRecord | null> {
    const { data, error } = await db
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error('Support ticket lookup failed');
    return data as JsonRecord | null;
}

// Called only inside a permission-gated, validated mutation route. Fresh authorization runs
// before the execution contract can consult its durable database receipt.
async function executeMutation(c: AppContext, operation: SupportMutation, targetId: string | null, status: 200 | 201 = 200) {
    const result = await new SupportExecutionAdapter(getSupabaseAdmin(c)).execute({
        actorId: actorUserId(c), actorEmail: actorEmail(c), operation, targetId,
        key: c.req.header('Idempotency-Key') ?? null,
        alternateKey: c.req.header('X-Idempotency-Key') ?? null,
        payload: c.get('validatedBody') as Record<string, unknown>,
    });
    return c.json(success(result), status);
}

async function fetchMerchantContext(db: Db, siteId: string | null) {
    if (!siteId) return null;

    const [site, subscription, riskScore, trustSafetyCases] = await Promise.all([
        db.from('sites').select('id, name, store_name, subdomain, custom_domain, status, trial_status, created_at').eq('id', siteId).maybeSingle(),
        db.from('subscriptions').select('id, status, plan_id, current_period_end, created_at').eq('site_id', siteId).order('created_at', { ascending: false }).limit(1),
        db.from('risk_scores').select('id, score, band, status, scored_at').eq('site_id', siteId).order('scored_at', { ascending: false }).limit(1),
        db.from('ts_cases').select('id, title, severity, status, category, created_at').eq('site_id', siteId).in('status', ['open', 'under_review', 'actioned', 'appealed']).order('created_at', { ascending: false }).limit(5),
    ]);

    return {
        site: site.data || null,
        subscription: subscription.data?.[0] || null,
        risk_score: riskScore.data?.[0] || null,
        open_trust_safety_cases: trustSafetyCases.data || [],
    };
}

router.get('/overview', requirePermission('support:view'), async (c) => {
    // Phase 2 (Mandate 7 follow-up): support_tickets is a registered tenant table; these are
    // platform-wide aggregate counts across every site by design (an operator's dashboard), which no
    // site_id/requester_user_id predicate could correctly narrow without defeating the route's own
    // purpose. Safe here specifically because requirePlatformOperator() (router-level) and
    // requirePermission('support:view') (this route) have ALREADY verified the caller before this
    // line runs -- see operator-scoped-admin-client-contract.test.ts's allowlist entry for the full
    // review. Every query below is a head:true count -- no row is ever returned to enumerate.
    const db = getSupabaseAdminForOperatorRead(c);
    const [open, pendingCustomer, escalated, overdueClocks, csatRows, macroCount] = await Promise.all([
        db.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'pending_internal']),
        db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'pending_customer'),
        db.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'escalated'),
        db.from('ticket_sla_clocks').select('id', { count: 'exact', head: true }).lt('due_at', new Date().toISOString()).is('satisfied_at', null).eq('paused', false),
        db.from('ticket_csat').select('score').not('score', 'is', null).order('created_at', { ascending: false }).limit(100),
        db.from('ticket_macros').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null),
    ]);

    const csatScores = (csatRows.data || [])
        .map((row) => typeof row.score === 'number' ? row.score : null)
        .filter((score): score is number => typeof score === 'number');
    const csatAverage = csatScores.length === 0
        ? null
        : Math.round((csatScores.reduce((sum, score) => sum + score, 0) / csatScores.length) * 10) / 10;

    return c.json(success({
        open_count: open.count || 0,
        pending_customer_count: pendingCustomer.count || 0,
        escalated_count: escalated.count || 0,
        sla_breach_count: overdueClocks.count || 0,
        active_macro_count: macroCount.count || 0,
        csat_average: csatAverage,
        sla_defaults: {
            first_response_hours: SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS,
            resolution_business_days: SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS,
        },
    }));
});

router.get('/tickets', requirePermission('support:view'), validate('query', ListTicketsQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as z.infer<typeof ListTicketsQuerySchema>;
    const { from, to } = rangeFor(query.page, query.limit);
    // Phase 2 (Mandate 7 follow-up): the platform queue lists tickets across every site by design
    // unless the caller opts into one via ?site_id=; bounded by ListTicketsQuerySchema's own
    // limit.max(100), never an unbounded scan. See the allowlist entry for the full review.
    const db = getSupabaseAdminForOperatorRead(c);

    let request = db
        .from('support_tickets')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (query.status) request = request.eq('status', query.status);
    if (query.priority) request = request.eq('priority', query.priority);
    if (query.topic) request = request.eq('topic', query.topic);
    if (query.assignee_id) request = request.eq('assignee_id', query.assignee_id);
    if (query.site_id) request = request.eq('site_id', query.site_id);
    if (query.q) {
        const term = ilikeOperand(query.q);
        request = request.or(`subject.ilike.${term},requester_email.ilike.${term},ticket_ref.ilike.${term}`);
    }

    const { data, error, count } = await request;
    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Support ticket list failed' } }, 500);

    await logSensitiveRead(c, {
        action: 'support.ticket.list',
        resourceType: 'support_ticket',
        reason: 'Support queue loaded by operator.',
        metadata: { filters: query },
    });

    return c.json(paginated((data || []) as JsonRecord[], count || 0, query.page, query.limit));
});

router.get('/tickets/:id', requirePermission('support:view'), validate('param', TicketParamSchema), async (c) => {
    // Phase 2 (Mandate 7 follow-up): fetchTicket below looks up by the ticket's own primary key
    // (id), whose site is not known until the row returns -- bounded to exactly one row by
    // construction (.maybeSingle()), never an enumeration. See the allowlist entry for the review.
    const db = getSupabaseAdminForOperatorRead(c);
    const { id: ticketId } = c.get('validatedParam') as TicketParam;
    const ticket = await fetchTicket(db, ticketId);
    if (!ticket) return c.json({ error: { code: 'NOT_FOUND', message: 'Support ticket not found' } }, 404);

    const [messages, clocks, csat, merchantContext] = await Promise.all([
        db.from('ticket_messages').select('*').eq('ticket_id', ticketId).is('deleted_at', null).order('created_at', { ascending: true }),
        db.from('ticket_sla_clocks').select('*').eq('ticket_id', ticketId).is('deleted_at', null).order('clock_type', { ascending: true }),
        db.from('ticket_csat').select('*').eq('ticket_id', ticketId).is('deleted_at', null).order('created_at', { ascending: false }),
        fetchMerchantContext(db, stringValue(ticket.site_id)),
    ]);

    await logSensitiveRead(c, {
        action: 'support.ticket.view',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        reason: 'Support ticket detail opened by operator.',
        metadata: { site_id: stringValue(ticket.site_id) },
    });

    return c.json(success({
        ticket,
        messages: messages.data || [],
        sla_clocks: clocks.data || [],
        csat: csat.data || [],
        merchant_context: merchantContext,
    }));
});

router.post('/tickets', requirePermission('support:reply'), validate('json', CreateTicketSchema), (c) =>
    executeMutation(c, 'create', null, 201));

router.post('/tickets/:id/messages', requirePermission('support:reply'), validate('param', TicketParamSchema), validate('json', MessageSchema), (c) =>
    executeMutation(c, 'reply', (c.get('validatedParam') as TicketParam).id));

router.patch('/tickets/:id/assign', requirePermission('support:manage'), validate('param', TicketParamSchema), validate('json', AssignSchema), (c) =>
    executeMutation(c, 'assign', (c.get('validatedParam') as TicketParam).id));

router.post('/tickets/:id/escalate', requirePermission('support:reply'), validate('param', TicketParamSchema), validate('json', EscalateSchema), (c) =>
    executeMutation(c, 'escalate', (c.get('validatedParam') as TicketParam).id));

router.post('/tickets/:id/resolve', requirePermission('support:reply'), validate('param', TicketParamSchema), validate('json', ResolveSchema), (c) =>
    executeMutation(c, 'resolve', (c.get('validatedParam') as TicketParam).id));

router.post('/tickets/:id/csat', requirePermission('support:reply'), validate('param', TicketParamSchema), validate('json', CsatSchema), (c) =>
    executeMutation(c, 'csat', (c.get('validatedParam') as TicketParam).id));

router.get('/macros', requirePermission('support:view'), async (c) => {
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('ticket_macros')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true });

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'Support macros lookup failed' } }, 500);
    return c.json(success(data || []));
});

router.post('/macros', requirePermission('support:manage'), validate('json', MacroSchema), (c) =>
    executeMutation(c, 'macro', null, 201));

export default router;
