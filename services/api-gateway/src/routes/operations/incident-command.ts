import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { getSupabaseAdmin, paginated, shouldReturnEmptyForMissingLocalSchema, success } from '../../lib/supabase';
import { ValidationError } from '../../lib/errors';
import {
    logSensitiveRead,
    requirePermission,
    requireRoleCategory,
    requireSuperAdmin,
    validateSensitiveReason,
} from '../../middleware/rbac';

const router = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;
type Db = ReturnType<typeof getSupabaseAdmin>;
type JsonRecord = Record<string, unknown>;

router.use('*', requireRoleCategory('ops'), requireSuperAdmin);

const ListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

const ListOncallQuerySchema = ListQuerySchema.extend({
    active: z.enum(['true', 'false', 'all']).default('true'),
    team_name: z.string().trim().max(120).optional(),
});

const ListPostmortemQuerySchema = ListQuerySchema.extend({
    status: z.enum(['draft', 'review', 'accepted', 'closed', 'all']).default('all'),
    incident_id: z.string().trim().max(120).optional(),
});

const IncidentEventSchema = z.object({
    event_type: z.enum(['note', 'mitigation', 'escalation', 'recovery']),
    summary: z.string().trim().min(8).max(500),
    details: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(8).max(1000),
});

const OncallScheduleSchema = z.object({
    team_name: z.string().trim().min(2).max(120),
    rotation_name: z.string().trim().min(2).max(160),
    primary_employee_id: z.string().uuid().nullable().optional(),
    backup_employee_ids: z.array(z.string().uuid()).max(10).default([]),
    escalation_tiers: z.array(z.record(z.string(), z.unknown())).max(10).default([]),
    timezone: z.string().trim().min(3).max(80).default('Asia/Kolkata'),
    starts_at: z.string().datetime().optional(),
    ends_at: z.string().datetime().nullable().optional(),
    active: z.boolean().default(true),
    paging_adapter: z.enum(['dry_run', 'pagerduty', 'opsgenie']).default('dry_run'),
    metadata: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(8).max(1000),
});

const DryRunPageSchema = z.object({
    incident_id: z.string().trim().min(1).max(120).nullable().optional(),
    target_team: z.string().trim().max(120).nullable().optional(),
    severity: z.enum(['sev1', 'sev2', 'sev3', 'sev4']).default('sev3'),
    summary: z.string().trim().min(8).max(500),
    escalation_level: z.coerce.number().int().min(1).max(5).default(1),
    reason: z.string().trim().min(8).max(1000),
});

const PostmortemSchema = z.object({
    incident_id: z.string().trim().min(1).max(120),
    owner_id: z.string().uuid().nullable().optional(),
    status: z.enum(['draft', 'review', 'accepted', 'closed']).default('draft'),
    summary: z.string().trim().max(5000).default(''),
    timeline: z.array(z.record(z.string(), z.unknown())).max(100).default([]),
    contributing_factors: z.array(z.record(z.string(), z.unknown())).max(50).default([]),
    action_items: z.array(z.record(z.string(), z.unknown())).max(100).default([]),
    due_at: z.string().datetime().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().trim().min(8).max(1000),
});

const PostmortemPatchSchema = PostmortemSchema.omit({ incident_id: true }).partial().extend({
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

function addBusinessDays(start: Date, days: number): Date {
    const date = new Date(start);
    let remaining = days;
    while (remaining > 0) {
        date.setUTCDate(date.getUTCDate() + 1);
        const day = date.getUTCDay();
        if (day !== 0 && day !== 6) remaining -= 1;
    }
    return date;
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

function requireReason(reason: unknown) {
    const valid = validateSensitiveReason(reason);
    if (!valid) {
        return null;
    }
    return valid;
}

async function activeIncident(db: Db, incidentId: string): Promise<JsonRecord | null> {
    const { data, error } = await db
        .from('production_incidents')
        .select('incident_id, title, severity, status, commander_id, started_at, mitigated_at, resolved_at, metadata')
        .eq('incident_id', incidentId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error('Incident lookup failed');
    return data as JsonRecord | null;
}

async function currentOncall(db: Db, env: Env, now: string, teamName?: string | null): Promise<JsonRecord | null> {
    let query = db
        .from('oncall_schedules')
        .select('*')
        .eq('active', true)
        .lte('starts_at', now)
        .or(`ends_at.is.null,ends_at.gt.${now}`)
        .is('deleted_at', null)
        .order('starts_at', { ascending: false })
        .limit(1);

    if (teamName) query = query.eq('team_name', teamName);

    const { data, error } = await query.maybeSingle();
    if (shouldReturnEmptyForMissingLocalSchema(env, error)) return null;
    if (error) throw new Error('Current on-call lookup failed');
    return data as JsonRecord | null;
}

async function appendIncidentEvent(
    db: Db,
    input: {
        incidentId: string;
        eventType: 'note' | 'mitigation' | 'escalation' | 'recovery' | 'status-change';
        actorId: string;
        summary: string;
        details?: JsonRecord;
    },
) {
    const { data, error } = await db
        .from('production_incident_events')
        .insert({
            incident_id: input.incidentId,
            event_type: input.eventType,
            actor_id: input.actorId,
            summary: input.summary,
            details: input.details || {},
            created_by: input.actorId,
            updated_by: input.actorId,
        })
        .select('id, incident_id, event_type, actor_id, summary, details, recorded_at, created_at')
        .single();

    if (error) throw new Error('Incident event append failed');
    return data as JsonRecord;
}

router.get('/runtime/incidents/:incidentId', requirePermission('incident:view'), async (c) => {
    const incidentId = c.req.param('incidentId');
    const db = getSupabaseAdmin(c);

    const [incidentResult, eventsResult, postmortemResult] = await Promise.all([
        db
            .from('production_incidents')
            .select('incident_id, title, severity, status, affected_runtimes, affected_regions, customer_impact, commander_id, started_at, mitigated_at, resolved_at, postmortem_url, metadata, created_at, updated_at')
            .eq('incident_id', incidentId)
            .is('deleted_at', null)
            .maybeSingle(),
        db
            .from('production_incident_events')
            .select('id, incident_id, event_type, actor_id, summary, details, recorded_at, created_at')
            .eq('incident_id', incidentId)
            .is('deleted_at', null)
            .order('recorded_at', { ascending: true })
            .limit(200),
        db
            .from('incident_postmortems')
            .select('*')
            .eq('incident_id', incidentId)
            .is('deleted_at', null)
            .maybeSingle(),
    ]);

    if (incidentResult.error || eventsResult.error || postmortemResult.error) {
        throw new Error('Incident command detail lookup failed');
    }
    if (!incidentResult.data) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } }, 404);
    }

    await logSensitiveRead(c, {
        action: 'incident.detail.read',
        resourceType: 'production_incident',
        resourceId: null,
        reason: 'Incident command detail read.',
        metadata: { incident_id: incidentId },
    });

    return c.json(success({
        incident: incidentResult.data,
        events: eventsResult.data || [],
        postmortem: postmortemResult.data || null,
    }));
});

router.post('/runtime/incidents/:incidentId/events', requirePermission('incident:command'), async (c) => {
    const body = await readJson(c);
    const parsed = IncidentEventSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid incident event request', parsed.error.flatten());
    }

    const reason = requireReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    const incidentId = c.req.param('incidentId');
    const db = getSupabaseAdmin(c);
    const incident = await activeIncident(db, incidentId);
    if (!incident) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } }, 404);
    }

    const event = await appendIncidentEvent(db, {
        incidentId,
        eventType: parsed.data.event_type,
        actorId: actorUserId(c),
        summary: parsed.data.summary,
        details: {
            ...parsed.data.details,
            reason,
        },
    });

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: `incident.${parsed.data.event_type}.record`,
        resourceType: 'production_incident',
        reason,
        metadata: { incident_id: incidentId, event_id: event.id },
    });

    return c.json(success({ event }), 201);
});

router.post('/runtime/incidents/:incidentId/page', requirePermission('incident:command'), async (c) => {
    const body = await readJson(c);
    const parsed = DryRunPageSchema.safeParse({
        ...body as JsonRecord,
        incident_id: c.req.param('incidentId'),
    });
    if (!parsed.success) {
        throw new ValidationError('Invalid incident page request', parsed.error.flatten());
    }

    const reason = requireReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const incident = await activeIncident(db, c.req.param('incidentId'));
    if (!incident) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } }, 404);
    }

    const schedule = await currentOncall(db, c.env, new Date().toISOString(), parsed.data.target_team || null);
    const payload = {
        mode: 'dry_run',
        adapter: schedule?.paging_adapter || 'dry_run',
        target_team: parsed.data.target_team || schedule?.team_name || null,
        primary_employee_id: schedule?.primary_employee_id || null,
        backup_employee_ids: schedule?.backup_employee_ids || [],
        escalation_level: parsed.data.escalation_level,
        summary: parsed.data.summary,
    };

    const event = await appendIncidentEvent(db, {
        incidentId: c.req.param('incidentId'),
        eventType: 'escalation',
        actorId: actorUserId(c),
        summary: `Dry-run page: ${parsed.data.summary}`,
        details: {
            ...payload,
            reason,
        },
    });

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'incident.page.dry_run',
        resourceType: 'production_incident',
        reason,
        metadata: { incident_id: c.req.param('incidentId'), event_id: event.id, page_payload: payload },
    });

    return c.json(success({ page: payload, event }), 202);
});

router.get('/oncall/schedules', requirePermission('incident:view'), async (c) => {
    const parsed = ListOncallQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        active: c.req.query('active') || 'true',
        team_name: c.req.query('team_name') || undefined,
    });
    if (!parsed.success) {
        throw new ValidationError('Invalid on-call schedule list query', parsed.error.flatten());
    }

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    const db = getSupabaseAdmin(c);
    let query = db
        .from('oncall_schedules')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('starts_at', { ascending: false })
        .range(from, to);

    if (parsed.data.active !== 'all') query = query.eq('active', parsed.data.active === 'true');
    if (parsed.data.team_name) query = query.eq('team_name', parsed.data.team_name);

    const { data, error, count } = await query;
    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, parsed.data.page, parsed.data.limit));
        }
        throw new Error('On-call schedule list failed');
    }

    return c.json(paginated(data || [], count || 0, parsed.data.page, parsed.data.limit));
});

router.post('/oncall/schedules', requirePermission('incident:command'), async (c) => {
    const body = await readJson(c);
    const parsed = OncallScheduleSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid on-call schedule request', parsed.error.flatten());
    }

    const reason = requireReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const actorId = actorUserId(c);
    const { data, error } = await db
        .from('oncall_schedules')
        .insert({
            team_name: parsed.data.team_name,
            rotation_name: parsed.data.rotation_name,
            primary_employee_id: parsed.data.primary_employee_id || null,
            backup_employee_ids: parsed.data.backup_employee_ids,
            escalation_tiers: parsed.data.escalation_tiers,
            timezone: parsed.data.timezone,
            starts_at: parsed.data.starts_at || new Date().toISOString(),
            ends_at: parsed.data.ends_at || null,
            active: parsed.data.active,
            paging_adapter: parsed.data.paging_adapter,
            metadata: parsed.data.metadata,
            actor_id: actorId,
            request_id: c.req.header('X-Request-ID') || null,
            created_by: actorId,
            updated_by: actorId,
        })
        .select('*')
        .single();

    if (error) throw new Error('On-call schedule creation failed');

    await writeAudit(db, {
        actorId,
        actorEmail: actorEmail(c),
        action: 'incident.oncall.schedule.create',
        resourceType: 'oncall_schedule',
        resourceId: data.id,
        reason,
        metadata: { team_name: parsed.data.team_name, rotation_name: parsed.data.rotation_name },
    });

    return c.json(success({ schedule: data }), 201);
});

router.get('/oncall/current', requirePermission('incident:view'), async (c) => {
    const teamName = c.req.query('team_name') || null;
    const now = c.req.query('now') || new Date().toISOString();
    const db = getSupabaseAdmin(c);
    const schedule = await currentOncall(db, c.env, now, teamName);

    return c.json(success({ schedule, paging_adapter_mode: schedule?.paging_adapter || 'dry_run' }));
});

router.post('/oncall/page', requirePermission('incident:command'), async (c) => {
    const body = await readJson(c);
    const parsed = DryRunPageSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid dry-run page request', parsed.error.flatten());
    }

    const reason = requireReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const schedule = await currentOncall(db, c.env, new Date().toISOString(), parsed.data.target_team || null);
    const page = {
        mode: 'dry_run',
        adapter: schedule?.paging_adapter || 'dry_run',
        incident_id: parsed.data.incident_id || null,
        target_team: parsed.data.target_team || schedule?.team_name || null,
        primary_employee_id: schedule?.primary_employee_id || null,
        backup_employee_ids: schedule?.backup_employee_ids || [],
        severity: parsed.data.severity,
        escalation_level: parsed.data.escalation_level,
        summary: parsed.data.summary,
    };

    if (parsed.data.incident_id) {
        await appendIncidentEvent(db, {
            incidentId: parsed.data.incident_id,
            eventType: 'escalation',
            actorId: actorUserId(c),
            summary: `Dry-run page: ${parsed.data.summary}`,
            details: { ...page, reason },
        });
    }

    await writeAudit(db, {
        actorId: actorUserId(c),
        actorEmail: actorEmail(c),
        action: 'incident.oncall.page.dry_run',
        resourceType: 'oncall_schedule',
        resourceId: typeof schedule?.id === 'string' ? schedule.id : null,
        reason,
        metadata: { page },
    });

    return c.json(success({ page }), 202);
});

router.get('/postmortems', requirePermission('incident:view'), async (c) => {
    const parsed = ListPostmortemQuerySchema.safeParse({
        page: c.req.query('page'),
        limit: c.req.query('limit'),
        status: c.req.query('status') || 'all',
        incident_id: c.req.query('incident_id') || undefined,
    });
    if (!parsed.success) {
        throw new ValidationError('Invalid postmortem list query', parsed.error.flatten());
    }

    const { from, to } = rangeFor(parsed.data.page, parsed.data.limit);
    const db = getSupabaseAdmin(c);
    let query = db
        .from('incident_postmortems')
        .select('*, production_incidents(title, severity, status, started_at, resolved_at)', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (parsed.data.status !== 'all') query = query.eq('status', parsed.data.status);
    if (parsed.data.incident_id) query = query.eq('incident_id', parsed.data.incident_id);

    const { data, error, count } = await query;
    if (error) {
        if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) {
            return c.json(paginated([], 0, parsed.data.page, parsed.data.limit));
        }
        throw new Error('Incident postmortem list failed');
    }

    return c.json(paginated(data || [], count || 0, parsed.data.page, parsed.data.limit));
});

router.post('/postmortems', requirePermission('incident:command'), async (c) => {
    const body = await readJson(c);
    const parsed = PostmortemSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid postmortem request', parsed.error.flatten());
    }

    const reason = requireReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const incident = await activeIncident(db, parsed.data.incident_id);
    if (!incident) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Incident not found' } }, 404);
    }

    const actorId = actorUserId(c);
    const status = parsed.data.status;
    const completedAt = status === 'accepted' || status === 'closed' ? new Date().toISOString() : null;
    const dueAt = parsed.data.due_at || addBusinessDays(new Date(), 5).toISOString();
    const { data, error } = await db
        .from('incident_postmortems')
        .upsert({
            incident_id: parsed.data.incident_id,
            owner_id: parsed.data.owner_id || null,
            status,
            summary: parsed.data.summary,
            timeline: parsed.data.timeline,
            contributing_factors: parsed.data.contributing_factors,
            action_items: parsed.data.action_items,
            due_at: dueAt,
            completed_at: completedAt,
            reviewed_by: completedAt ? actorId : null,
            reviewed_at: completedAt,
            metadata: parsed.data.metadata,
            actor_id: actorId,
            request_id: c.req.header('X-Request-ID') || null,
            created_by: actorId,
            updated_by: actorId,
        }, { onConflict: 'incident_id' })
        .select('*')
        .single();

    if (error) throw new Error('Incident postmortem upsert failed');

    await appendIncidentEvent(db, {
        incidentId: parsed.data.incident_id,
        eventType: 'note',
        actorId,
        summary: `Postmortem ${status}`,
        details: { postmortem_id: data.id, reason },
    });
    await writeAudit(db, {
        actorId,
        actorEmail: actorEmail(c),
        action: 'incident.postmortem.upsert',
        resourceType: 'incident_postmortem',
        resourceId: data.id,
        reason,
        metadata: { incident_id: parsed.data.incident_id, status },
    });

    return c.json(success({ postmortem: data }), 201);
});

router.patch('/postmortems/:id', requirePermission('incident:command'), async (c) => {
    const body = await readJson(c);
    const parsed = PostmortemPatchSchema.safeParse(body);
    if (!parsed.success) {
        throw new ValidationError('Invalid postmortem update request', parsed.error.flatten());
    }

    const reason = requireReason(parsed.data.reason);
    if (!reason) {
        return c.json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const actorId = actorUserId(c);
    const patch: JsonRecord = {
        updated_by: actorId,
        actor_id: actorId,
    };
    for (const key of ['owner_id', 'status', 'summary', 'timeline', 'contributing_factors', 'action_items', 'due_at', 'metadata'] as const) {
        if (parsed.data[key] !== undefined) patch[key] = parsed.data[key] === '' ? null : parsed.data[key];
    }
    if (parsed.data.status === 'accepted' || parsed.data.status === 'closed') {
        patch.completed_at = new Date().toISOString();
        patch.reviewed_by = actorId;
        patch.reviewed_at = patch.completed_at;
    }

    const { data, error } = await db
        .from('incident_postmortems')
        .update(patch)
        .eq('id', c.req.param('id'))
        .is('deleted_at', null)
        .select('*')
        .single();

    if (error || !data) throw new Error('Incident postmortem update failed');

    await appendIncidentEvent(db, {
        incidentId: data.incident_id,
        eventType: 'note',
        actorId,
        summary: `Postmortem updated${parsed.data.status ? ` to ${parsed.data.status}` : ''}`,
        details: { postmortem_id: data.id, reason },
    });
    await writeAudit(db, {
        actorId,
        actorEmail: actorEmail(c),
        action: 'incident.postmortem.update',
        resourceType: 'incident_postmortem',
        resourceId: data.id,
        reason,
        metadata: { incident_id: data.incident_id, status: data.status },
    });

    return c.json(success({ postmortem: data }));
});

export default router;
