import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
    MerchantSupportScopeSchema,
    MerchantSupportCreateSchema,
    MerchantSupportReplySchema,
    MerchantSupportRecoverySchema,
} from '@letbuyy/shared-types';
import type { Env } from '../index';
import { validate } from '../middleware/validation';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { getSupabaseAdmin, paginated, success } from '../lib/supabase';
import { AppError, NotFoundError, ValidationError } from '../lib/errors';
import { executeMerchantSupport } from '../execution/merchant-support.adapter';
const router = new Hono<{ Bindings: Env }>();
const ticketFields =
    'id,site_id,ticket_ref,subject,status,topic,created_at,updated_at';
const param = z.object({ id: z.string().uuid() });
async function owner(c: Context<{ Bindings: Env }>, siteId: string) {
    const tenant = await resolveTenantContextForOwnedSite(c, siteId);
    if (!tenant.userId) throw new NotFoundError('Store owner not found.');
    return { ...tenant, userId: tenant.userId };
}

router.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
});
function key(c: { req: { header: (name: string) => string | undefined } }) {
    const a = c.req.header('Idempotency-Key'),
        b = c.req.header('X-Idempotency-Key');
    if (a && b && a !== b)
        throw new ValidationError('Idempotency headers must agree.');
    if (!a && !b)
        throw new ValidationError('A stable request key is required.');
    return (a || b)!;
}
router.get(
    '/tickets',
    validate('query', MerchantSupportScopeSchema),
    async (c) => {
        const q = MerchantSupportScopeSchema.parse(c.get('validatedQuery'));
        const tenant = await owner(c, q.site_id);
        const { data, error, count } = await getSupabaseAdmin(c)
            .from('support_tickets')
            .select(ticketFields, { count: 'exact' })
            .eq('site_id', tenant.siteId)
            .eq('requester_type', 'merchant')
            .eq('requester_user_id', tenant.userId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range((q.page - 1) * q.limit, q.page * q.limit - 1);
        if (error)
            throw new AppError(
                'Support tickets are unavailable.',
                503,
                'SUPPORT_UNAVAILABLE',
            );
        return c.json(paginated(data || [], count || 0, q.page, q.limit));
    },
);
router.get(
    '/tickets/:id',
    validate('param', param),
    validate('query', MerchantSupportScopeSchema),
    async (c) => {
        const q = MerchantSupportScopeSchema.parse(c.get('validatedQuery'));
        const tenant = await owner(c, q.site_id),
            db = getSupabaseAdmin(c);
        const { data: ticket, error } = await db
            .from('support_tickets')
            .select(ticketFields)
            .eq('id', c.req.param('id'))
            .eq('site_id', tenant.siteId)
            .eq('requester_type', 'merchant')
            .eq('requester_user_id', tenant.userId)
            .is('deleted_at', null)
            .maybeSingle();
        if (error)
            throw new AppError(
                'Support ticket is unavailable.',
                503,
                'SUPPORT_UNAVAILABLE',
            );
        if (!ticket) throw new NotFoundError('Support ticket not found.');
        // Filter at the data boundary; private agent notes never enter the projection.
        const messages = await db
            .from('ticket_messages')
            .select('id,author_type,body,created_at', { count: 'exact' })
            .eq('ticket_id', ticket.id)
            .eq('visibility', 'public')
            .is('deleted_at', null)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range((q.page - 1) * q.limit, q.page * q.limit - 1);
        if (messages.error)
            throw new AppError(
                'Support messages are unavailable.',
                503,
                'SUPPORT_UNAVAILABLE',
            );
        return c.json(
            success({
                ticket,
                messages: messages.data || [],
                message_meta: paginated(
                    [],
                    messages.count || 0,
                    q.page,
                    q.limit,
                ).meta,
            }),
        );
    },
);
router.post(
    '/tickets',
    validate('json', MerchantSupportCreateSchema),
    async (c) => {
        const body = MerchantSupportCreateSchema.parse(c.get('validatedBody'));
        const tenant = await owner(c, body.site_id);
        return c.json(
            success(
                await executeMerchantSupport(getSupabaseAdmin(c), {
                    actorId: tenant.userId,
                    siteId: tenant.siteId,
                    operation: 'create',
                    ticketId: null,
                    key: key(c),
                    payload: body,
                }),
            ),
            201,
        );
    },
);
router.post(
    '/tickets/recovery',
    validate('json', MerchantSupportRecoverySchema),
    async (c) => {
        const body = MerchantSupportRecoverySchema.parse(
            c.get('validatedBody'),
        );
        const tenant = await owner(c, body.site_id);
        if ((body.operation === 'create') !== (body.target_id === null))
            throw new ValidationError('Invalid support recovery target.');
        return c.json(
            success(
                await executeMerchantSupport(getSupabaseAdmin(c), {
                    actorId: tenant.userId,
                    siteId: tenant.siteId,
                    operation:
                        body.operation === 'create'
                            ? 'recover_create'
                            : 'recover_reply',
                    ticketId: body.target_id,
                    key: body.key,
                    payload: {},
                }),
            ),
        );
    },
);
router.post(
    '/tickets/:id/messages',
    validate('param', param),
    validate('json', MerchantSupportReplySchema),
    async (c) => {
        const body = MerchantSupportReplySchema.parse(c.get('validatedBody'));
        const tenant = await owner(c, body.site_id);
        return c.json(
            success(
                await executeMerchantSupport(getSupabaseAdmin(c), {
                    actorId: tenant.userId,
                    siteId: tenant.siteId,
                    operation: 'reply',
                    ticketId: c.req.param('id'),
                    key: key(c),
                    payload: body,
                }),
            ),
            201,
        );
    },
);
export default router;
