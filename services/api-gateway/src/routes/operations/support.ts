import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS,
    SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS,
    SUPPORT_ESCALATION_KEYWORDS,
    SupportTicketChannelSchema,
    SupportTicketEscalationTargetSchema,
    SupportTicketMessageVisibilitySchema,
    SupportTicketPrioritySchema,
    SupportTicketStatusSchema,
    SupportTicketTopicSchema,
    type JsonRecord,
} from '@letbuyy/shared-types';
import type { Env } from '../../index';
import { getSupabaseAdmin, getSupabaseAdminForOperatorRead, paginated, success } from '../../lib/supabase';
import {
    logSensitiveRead,
    requirePermission,
    requirePlatformOperator,
    validateSensitiveReason,
} from '../../middleware/rbac';

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
router.use('*', requirePlatformOperator());

const ListTicketsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: SupportTicketStatusSchema.optional(),
    priority: SupportTicketPrioritySchema.optional(),
    topic: SupportTicketTopicSchema.optional(),
    assignee_id: z.string().uuid().optional(),
    site_id: z.string().uuid().optional(),
    q: z.string().trim().max(160).optional(),
});

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

async function readJson(c: AppContext): Promise<unknown> {
    return c.req.json().catch(() => ({}));
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

function recordValue(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function detectTrustSafetyEscalation(...values: Array<string | null | undefined>): boolean {
    const haystack = values.join(' ').toLowerCase();
    return SUPPORT_ESCALATION_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

async function writeAudit(
    db: Db,
    input: {
        actorId: string;
        actorEmail: string | null;
        action: string;
        resourceType: string;
        resourceId?: string | null;
        reason: string;
        metadata?: JsonRecord;
    },
) {
    await db.from('audit_logs').insert({
        actor_id: input.actorId,
        actor_type: 'employee',
        actor_email: input.actorEmail,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason,
        },
    });
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

async function createSlaClocks(db: Db, ticket: JsonRecord, actorId: string) {
    const ticketId = stringValue(ticket.id);
    if (!ticketId) return;

    const now = new Date();
    const firstResponseDueAt = stringValue(ticket.first_response_due_at)
        || new Date(now.getTime() + SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS * 60 * 60 * 1000).toISOString();
    const resolutionDueAt = stringValue(ticket.resolution_due_at)
        || addBusinessDays(now, SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS).toISOString();

    await db.from('ticket_sla_clocks').insert([
        {
            ticket_id: ticketId,
            clock_type: 'first_response',
            due_at: firstResponseDueAt,
            created_by: actorId,
            updated_by: actorId,
        },
        {
            ticket_id: ticketId,
            clock_type: 'resolution',
            due_at: resolutionDueAt,
            created_by: actorId,
            updated_by: actorId,
        },
    ]);
}

async function appendSystemMessage(db: Db, ticketId: string, body: string, metadata: JsonRecord, actorId: string | null) {
    await db.from('ticket_messages').insert({
        ticket_id: ticketId,
        author_type: 'system',
        author_id: actorId,
        visibility: 'internal',
        body,
        metadata,
        created_by: actorId,
    });
}

async function openTrustSafetyCaseFromTicket(
    db: Db,
    input: { ticket: JsonRecord; reason: string; actorId: string; actorEmail: string | null },
): Promise<string | null> {
    const ticketId = stringValue(input.ticket.id);
    const siteId = stringValue(input.ticket.site_id);
    const subject = stringValue(input.ticket.subject) || 'Support escalation';
    if (!ticketId) return null;

    const { data: caseRow, error } = await db
        .from('ts_cases')
        .insert({
            site_id: siteId,
            subject_type: siteId ? 'site' : 'custom',
            subject_id: siteId || ticketId,
            category: 'abuse_report',
            severity: 'high',
            status: 'open',
            title: `Support escalation: ${subject}`,
            summary: input.reason,
            opened_by: input.actorId,
            metadata: {
                source: 'support-ticket',
                support_ticket_id: ticketId,
            },
            created_by: input.actorId,
        })
        .select('id')
        .single();

    if (error || !caseRow) return null;
    const caseId = String(caseRow.id);

    await db.from('ts_evidence').insert({
        case_id: caseId,
        evidence_type: 'support_ticket',
        source: 'support',
        title: 'Support ticket escalation evidence',
        description: input.reason,
        content: {
            support_ticket_id: ticketId,
            subject,
            requester_email: stringValue(input.ticket.requester_email),
        },
        metadata: { actor_email: input.actorEmail },
        created_by: input.actorId,
    });
    await db.from('ts_case_events').insert({
        case_id: caseId,
        event_type: 'case_opened',
        actor_type: 'employee',
        actor_id: input.actorId,
        reason: input.reason,
        evidence: { support_ticket_id: ticketId },
        metadata: { source: 'support-ticket' },
        created_by: input.actorId,
    });

    return caseId;
}

async function maybeEscalateTrustSafety(
    db: Db,
    input: { ticket: JsonRecord; reason: string; actorId: string; actorEmail: string | null; body?: string },
): Promise<string | null> {
    const ticketId = stringValue(input.ticket.id);
    if (!ticketId || stringValue(input.ticket.linked_ts_case_id)) return null;
    if (!detectTrustSafetyEscalation(stringValue(input.ticket.subject), input.body, input.reason)) return null;

    const caseId = await openTrustSafetyCaseFromTicket(db, input);
    if (!caseId) return null;

    await db
        .from('support_tickets')
        .update({
            status: 'escalated',
            escalated_to: 'trust_safety',
            linked_ts_case_id: caseId,
            updated_by: input.actorId,
        })
        .eq('id', ticketId);
    await appendSystemMessage(
        db,
        ticketId,
        'Ticket escalated to Trust & Safety because the thread mentioned fraud, abuse, or chargeback risk.',
        { linked_ts_case_id: caseId },
        input.actorId,
    );

    return caseId;
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

router.get('/tickets', requirePermission('support:view'), async (c) => {
    const query = ListTicketsQuerySchema.parse(c.req.query());
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
    if (query.q) request = request.or(`subject.ilike.%${query.q}%,requester_email.ilike.%${query.q}%,ticket_ref.ilike.%${query.q}%`);

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

router.get('/tickets/:id', requirePermission('support:view'), async (c) => {
    // Phase 2 (Mandate 7 follow-up): fetchTicket below looks up by the ticket's own primary key
    // (id), whose site is not known until the row returns -- bounded to exactly one row by
    // construction (.maybeSingle()), never an enumeration. See the allowlist entry for the review.
    const db = getSupabaseAdminForOperatorRead(c);
    const ticketId = c.req.param('id');
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

router.post('/tickets', requirePermission('support:reply'), async (c) => {
    const body = CreateTicketSchema.parse(await readJson(c));
    const reason = validateSensitiveReason(body.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required to create a support ticket' } }, 400);

    // Phase 2 (Mandate 7 follow-up): the insert below always includes the site_id key (even when
    // null for a platform-level ticket), which already satisfies the tenant guard on its own -- the
    // operator-scoped client is needed here only for the CONDITIONAL trust-safety escalation update
    // further down (maybeEscalateTrustSafety), a single-row-by-id update on the ticket just created
    // in this same request. See the allowlist entry for the full review.
    const db = getSupabaseAdminForOperatorRead(c);
    const actorId = actorUserId(c);
    const actor = actorEmail(c);
    const now = new Date();
    const firstResponseDueAt = new Date(now.getTime() + SUPPORT_DEFAULT_FIRST_RESPONSE_HOURS * 60 * 60 * 1000).toISOString();
    const resolutionDueAt = addBusinessDays(now, SUPPORT_DEFAULT_RESOLUTION_BUSINESS_DAYS).toISOString();

    const { data: ticket, error } = await db
        .from('support_tickets')
        .insert({
            ticket_ref: generateTicketRef(now),
            site_id: body.site_id || null,
            requester_type: body.requester_type,
            requester_email: body.requester_email || null,
            requester_user_id: body.requester_user_id || null,
            subject: body.subject,
            channel: body.channel,
            topic: body.topic,
            priority: body.priority,
            status: 'open',
            assignee_id: body.assignee_id || null,
            first_response_due_at: firstResponseDueAt,
            resolution_due_at: resolutionDueAt,
            last_customer_message_at: now.toISOString(),
            metadata: body.metadata,
            created_by: actorId,
            updated_by: actorId,
        })
        .select('*')
        .single();

    if (error || !ticket) return c.json({ error: { code: 'DB_ERROR', message: 'Support ticket create failed' } }, 500);

    await db.from('ticket_messages').insert({
        ticket_id: ticket.id,
        author_type: 'requester',
        author_id: body.requester_user_id || null,
        author_email: body.requester_email || null,
        visibility: 'public',
        body: body.body,
        created_by: actorId,
    });
    await createSlaClocks(db, ticket as JsonRecord, actorId);
    const linkedCaseId = await maybeEscalateTrustSafety(db, {
        ticket: ticket as JsonRecord,
        reason,
        actorId,
        actorEmail: actor,
        body: body.body,
    });

    await writeAudit(db, {
        actorId,
        actorEmail: actor,
        action: 'support.ticket.create',
        resourceType: 'support_ticket',
        resourceId: String(ticket.id),
        reason,
        metadata: { site_id: body.site_id || null, linked_ts_case_id: linkedCaseId },
    });

    return c.json(success({ ticket: { ...ticket, linked_ts_case_id: linkedCaseId || ticket.linked_ts_case_id || null } }), 201);
});

router.post('/tickets/:id/messages', requirePermission('support:reply'), async (c) => {
    const body = MessageSchema.parse(await readJson(c));
    const reason = validateSensitiveReason(body.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required to update a support ticket' } }, 400);

    // Phase 2 (Mandate 7 follow-up): fetchTicket (by primary key) and the status update below
    // (.eq('id', ticketId)) are both single-row-by-id. See the allowlist entry for the full review.
    const db = getSupabaseAdminForOperatorRead(c);
    const actorId = actorUserId(c);
    const actor = actorEmail(c);
    const ticketId = c.req.param('id');
    const ticket = await fetchTicket(db, ticketId);
    if (!ticket) return c.json({ error: { code: 'NOT_FOUND', message: 'Support ticket not found' } }, 404);

    const { data: message, error } = await db
        .from('ticket_messages')
        .insert({
            ticket_id: ticketId,
            author_type: 'agent',
            author_id: actorId,
            author_email: actor,
            visibility: body.visibility,
            body: body.body,
            macro_id: body.macro_id || null,
            attachments: body.attachments,
            metadata: body.metadata,
            created_by: actorId,
        })
        .select('*')
        .single();

    if (error || !message) return c.json({ error: { code: 'DB_ERROR', message: 'Support ticket reply failed' } }, 500);

    const status = body.status || (body.visibility === 'public' ? 'pending_customer' : String(ticket.status || 'open'));
    const firstResponseAt = stringValue(ticket.first_response_at) || (body.visibility === 'public' ? new Date().toISOString() : null);
    await db
        .from('support_tickets')
        .update({
            status,
            first_response_at: firstResponseAt || null,
            last_agent_message_at: new Date().toISOString(),
            updated_by: actorId,
        })
        .eq('id', ticketId);

    if (firstResponseAt) {
        await db.from('ticket_sla_clocks').update({ satisfied_at: firstResponseAt, updated_by: actorId }).eq('ticket_id', ticketId).eq('clock_type', 'first_response');
    }
    if (status === 'pending_customer') {
        await db.from('ticket_sla_clocks').update({ paused: true, paused_at: new Date().toISOString(), updated_by: actorId }).eq('ticket_id', ticketId).eq('clock_type', 'resolution').is('satisfied_at', null);
    }

    const linkedCaseId = await maybeEscalateTrustSafety(db, { ticket, reason, actorId, actorEmail: actor, body: body.body });

    await writeAudit(db, {
        actorId,
        actorEmail: actor,
        action: body.visibility === 'internal' ? 'support.ticket.internal_note' : 'support.ticket.reply',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        reason,
        metadata: { visibility: body.visibility, linked_ts_case_id: linkedCaseId },
    });

    return c.json(success({ message, linked_ts_case_id: linkedCaseId }));
});

router.patch('/tickets/:id/assign', requirePermission('support:manage'), async (c) => {
    const body = AssignSchema.parse(await readJson(c));
    const reason = validateSensitiveReason(body.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required to assign a support ticket' } }, 400);

    // Phase 2 (Mandate 7 follow-up): single-row-by-id update (.eq('id', ticketId)). See the
    // allowlist entry for the full review.
    const db = getSupabaseAdminForOperatorRead(c);
    const actorId = actorUserId(c);
    const ticketId = c.req.param('id');
    const { data, error } = await db
        .from('support_tickets')
        .update({ assignee_id: body.assignee_id, status: 'pending_internal', updated_by: actorId })
        .eq('id', ticketId)
        .is('deleted_at', null)
        .select('*')
        .single();

    if (error || !data) return c.json({ error: { code: 'DB_ERROR', message: 'Support ticket assignment failed' } }, 500);
    await appendSystemMessage(db, ticketId, 'Ticket assignment changed.', { assignee_id: body.assignee_id }, actorId);
    await writeAudit(db, {
        actorId,
        actorEmail: actorEmail(c),
        action: 'support.ticket.assign',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        reason,
        metadata: { assignee_id: body.assignee_id },
    });

    return c.json(success({ ticket: data }));
});

router.post('/tickets/:id/escalate', requirePermission('support:reply'), async (c) => {
    const body = EscalateSchema.parse(await readJson(c));
    const reason = validateSensitiveReason(body.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required to escalate a support ticket' } }, 400);

    // Phase 2 (Mandate 7 follow-up): fetchTicket and the escalation update below are both
    // single-row-by-id. See the allowlist entry for the full review.
    const db = getSupabaseAdminForOperatorRead(c);
    const actorId = actorUserId(c);
    const ticketId = c.req.param('id');
    const ticket = await fetchTicket(db, ticketId);
    if (!ticket) return c.json({ error: { code: 'NOT_FOUND', message: 'Support ticket not found' } }, 404);

    const linkedCaseId = body.target === 'trust_safety'
        ? await openTrustSafetyCaseFromTicket(db, { ticket, reason, actorId, actorEmail: actorEmail(c) })
        : null;

    const { data, error } = await db
        .from('support_tickets')
        .update({
            status: 'escalated',
            escalated_to: body.target,
            linked_ts_case_id: linkedCaseId || stringValue(ticket.linked_ts_case_id),
            linked_incident_id: body.linked_incident_id || stringValue(ticket.linked_incident_id),
            metadata: { ...recordValue(ticket.metadata), escalation: body.metadata },
            updated_by: actorId,
        })
        .eq('id', ticketId)
        .select('*')
        .single();

    if (error || !data) return c.json({ error: { code: 'DB_ERROR', message: 'Support ticket escalation failed' } }, 500);
    await appendSystemMessage(db, ticketId, `Ticket escalated to ${body.target.replace('_', ' ')}.`, { linked_ts_case_id: linkedCaseId, linked_incident_id: body.linked_incident_id || null }, actorId);
    await writeAudit(db, {
        actorId,
        actorEmail: actorEmail(c),
        action: 'support.ticket.escalate',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        reason,
        metadata: { target: body.target, linked_ts_case_id: linkedCaseId, linked_incident_id: body.linked_incident_id || null },
    });

    return c.json(success({ ticket: data, linked_ts_case_id: linkedCaseId }));
});

router.post('/tickets/:id/resolve', requirePermission('support:reply'), async (c) => {
    const body = ResolveSchema.parse(await readJson(c));
    const reason = validateSensitiveReason(body.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required to resolve a support ticket' } }, 400);

    // Phase 2 (Mandate 7 follow-up): fetchTicket and the resolution update below are both
    // single-row-by-id. See the allowlist entry for the full review.
    const db = getSupabaseAdminForOperatorRead(c);
    const actorId = actorUserId(c);
    const ticketId = c.req.param('id');
    const ticket = await fetchTicket(db, ticketId);
    if (!ticket) return c.json({ error: { code: 'NOT_FOUND', message: 'Support ticket not found' } }, 404);

    const resolvedAt = new Date().toISOString();
    const surveyToken = crypto.randomUUID();
    const { data, error } = await db
        .from('support_tickets')
        .update({ status: 'resolved', resolved_at: resolvedAt, updated_by: actorId })
        .eq('id', ticketId)
        .select('*')
        .single();

    if (error || !data) return c.json({ error: { code: 'DB_ERROR', message: 'Support ticket resolution failed' } }, 500);

    await db.from('ticket_sla_clocks').update({ satisfied_at: resolvedAt, paused: false, updated_by: actorId }).eq('ticket_id', ticketId).eq('clock_type', 'resolution');
    await db.from('ticket_csat').insert({
        ticket_id: ticketId,
        survey_token: surveyToken,
        requester_email: stringValue(ticket.requester_email),
        sent_at: resolvedAt,
        metadata: { delivery_mode: 'dry_run' },
        created_by: actorId,
    });
    await appendSystemMessage(db, ticketId, body.resolution_note || 'Ticket resolved. CSAT survey queued on the dry-run path.', { survey_token: surveyToken }, actorId);
    await writeAudit(db, {
        actorId,
        actorEmail: actorEmail(c),
        action: 'support.ticket.resolve',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        reason,
        metadata: { survey_token: surveyToken },
    });

    return c.json(success({ ticket: data, csat_survey_token: surveyToken }));
});

router.post('/tickets/:id/csat', requirePermission('support:reply'), async (c) => {
    const body = CsatSchema.parse(await readJson(c));
    const reason = validateSensitiveReason(body.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required to record CSAT' } }, 400);

    const db = getSupabaseAdmin(c);
    const actorId = actorUserId(c);
    const ticketId = c.req.param('id');
    const { data: latestSurvey, error: lookupError } = await db
        .from('ticket_csat')
        .select('id')
        .eq('ticket_id', ticketId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (lookupError) return c.json({ error: { code: 'DB_ERROR', message: 'CSAT lookup failed' } }, 500);
    if (!latestSurvey) return c.json({ error: { code: 'NOT_FOUND', message: 'CSAT survey not found' } }, 404);

    const { data, error } = await db
        .from('ticket_csat')
        .update({ score: body.score, comment: body.comment || null, responded_at: new Date().toISOString(), updated_by: actorId })
        .eq('id', latestSurvey.id)
        .select('*')
        .single();

    if (error) return c.json({ error: { code: 'DB_ERROR', message: 'CSAT update failed' } }, 500);
    if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'CSAT survey not found' } }, 404);

    await writeAudit(db, {
        actorId,
        actorEmail: actorEmail(c),
        action: 'support.csat.record',
        resourceType: 'support_ticket',
        resourceId: ticketId,
        reason,
        metadata: { score: body.score },
    });

    return c.json(success({ csat: data }));
});

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

router.post('/macros', requirePermission('support:manage'), async (c) => {
    const body = MacroSchema.parse(await readJson(c));
    const reason = validateSensitiveReason(body.reason);
    if (!reason) return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required to create a macro' } }, 400);

    const db = getSupabaseAdmin(c);
    const actorId = actorUserId(c);
    const { data, error } = await db
        .from('ticket_macros')
        .insert({
            name: body.name,
            description: body.description,
            topic: body.topic,
            body: body.body,
            is_active: body.is_active,
            tags: body.tags,
            metadata: body.metadata,
            created_by: actorId,
            updated_by: actorId,
        })
        .select('*')
        .single();

    if (error || !data) return c.json({ error: { code: 'DB_ERROR', message: 'Support macro create failed' } }, 500);
    await writeAudit(db, {
        actorId,
        actorEmail: actorEmail(c),
        action: 'support.macro.create',
        resourceType: 'ticket_macro',
        resourceId: String(data.id),
        reason,
        metadata: { topic: body.topic },
    });

    return c.json(success({ macro: data }), 201);
});

export default router;
