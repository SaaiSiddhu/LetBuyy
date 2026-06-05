import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { getSupabaseAdmin } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

const DomainEventEmitSchema = z.object({
    storeId: z.string().trim().min(1).nullable().optional(),
    aggregateType: z.string().trim().min(1).max(120),
    aggregateId: z.string().trim().min(1).max(200),
    eventType: z.string().trim().min(1).max(160),
    payload: z.record(z.string(), z.unknown()).optional(),
    idempotencyKey: z.string().trim().min(1).max(300),
    requestId: z.string().trim().min(1).max(200).nullable().optional(),
    actorId: z.string().trim().min(1).max(200).nullable().optional(),
});

function isInternalRequest(c: { env: Env; req: { header(name: string): string | undefined } }): boolean {
    const secret = c.env.INTERNAL_API_SECRET;
    if (!secret) return false;
    return c.req.header('X-Internal-API-Secret') === secret;
}

router.post('/domain', async (c) => {
    if (!isInternalRequest(c)) {
        return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Internal API secret required' } }, 403);
    }

    const rawBody = await c.req.json().catch(() => null);
    const parsed = DomainEventEmitSchema.safeParse(rawBody);
    if (!parsed.success) {
        return c.json({
            success: false,
            error: {
                code: 'VALIDATION',
                message: 'Invalid domain event payload',
                issues: parsed.error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            },
        }, 400);
    }

    try {
        const event = await new EventExecutionAdapter(getSupabaseAdmin(c)).emitDomainEvent(parsed.data);
        return c.json({ success: true, data: { event } });
    } catch (error) {
        return c.json({
            success: false,
            error: {
                code: 'DOMAIN_EVENT_EMIT_FAILED',
                message: error instanceof Error ? error.message : 'Domain event emit failed',
            },
        }, 400);
    }
});

export default router;
