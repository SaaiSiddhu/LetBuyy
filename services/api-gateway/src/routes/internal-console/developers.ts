import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import {
    buildDeveloperOverview,
    searchDeveloperProfiles,
    type JsonRecord,
} from '../../lib/internal-developer-ops';
import { getSupabaseAdmin, paginated, success } from '../../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

const DeveloperSearchQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    q: z.string().trim().max(120).optional(),
    status: z.enum(['pending', 'approved', 'suspended', 'rejected', 'all']).default('all'),
});

function validationMessage(error: z.ZodError): string {
    return error.issues[0]?.message || 'Invalid request query';
}

function cleanOptional(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

router.get('/search', async (c) => {
    const parsed = DeveloperSearchQuerySchema.safeParse({
        page: c.req.query('page') || undefined,
        limit: c.req.query('limit') || undefined,
        q: c.req.query('q') || undefined,
        status: c.req.query('status') || undefined,
    });
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: validationMessage(parsed.error) } }, 400);
    }

    const result = await searchDeveloperProfiles(getSupabaseAdmin(c), parsed.data);
    return c.json(paginated(result.rows as JsonRecord[], result.total, parsed.data.page, parsed.data.limit));
});

router.get('/:developerId/overview', async (c) => {
    const overview = await buildDeveloperOverview(getSupabaseAdmin(c), c.req.param('developerId'), {
        actorId: cleanOptional(c.req.query('actor_id')),
        actorEmail: cleanOptional(c.req.query('actor_email')),
        actorType: 'super_admin',
        reason: cleanOptional(c.req.query('reason')),
        auditRead: true,
    });

    if (!overview) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Developer profile not found' } }, 404);
    }

    return c.json(success(overview));
});

export default router;
