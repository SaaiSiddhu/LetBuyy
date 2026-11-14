import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
    InternalMerchantOperationsQuerySchema,
    type InternalMerchantOperationsSnapshot,
} from '@letbuyy/shared-types';
import {
    normalizeOrderRecord,
    type OrderSourceRow,
} from '@letbuyy/checkout-core';
import type { Env } from '../../index';
import { bindConsoleOperatorIdentity } from '../../identity-foundation/console-session-repository';
import { consolePermission } from '../../identity-foundation/console-approval-repository';
import { SaasExecutionAdapter } from '../../execution/saas-execution.adapter';
import { getSupabaseAdmin, paginated, success } from '../../lib/supabase';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import { logSensitiveRead } from '../../middleware/rbac';
import { StoreHealthAdapter } from '../../execution/store-health.adapter';

const router = new Hono<{ Bindings: Env }>();
type C = Context<{ Bindings: Env }>;
const guard = consolePermission('merchant:view');
const params = z.object({
    id: z.string().uuid(),
    recordId: z.string().uuid().optional(),
});
const productFields = 'id,name,sku,price,status,is_active,updated_at';
const orderFields =
    'id,order_number,status,payment_status,total,currency,created_at,updated_at';
function unavailable() {
    return new AppError(
        'Merchant operations are temporarily unavailable.',
        503,
        'MERCHANT_OPERATIONS_UNAVAILABLE',
    );
}
async function scope(c: C) {
    const p = params.safeParse(c.req.param());
    if (!p.success) throw new ValidationError('Invalid merchant or record ID.');
    c.header('Cache-Control', 'no-store');
    const db = getSupabaseAdmin(c);
    const site = await db
        .from('sites')
        .select(
            'id,name,store_name,site_type,status,published,currency,trial_status,trial_ends_at',
        )
        .eq('id', p.data.id)
        .is('deleted_at', null)
        .maybeSingle();
    if (site.error) throw unavailable();
    if (!site.data) throw new NotFoundError('Merchant not found.');
    return {
        db,
        site: site.data as InternalMerchantOperationsSnapshot['site'],
        ...p.data,
    };
}
function query(c: C) {
    const q = InternalMerchantOperationsQuerySchema.safeParse(c.req.query());
    if (!q.success)
        throw new ValidationError('Invalid merchant operations query.');
    return q.data;
}
async function audit(c: C, siteId: string, section: string) {
    await logSensitiveRead(c, {
        action: 'merchant.operations.read',
        resourceType: 'site',
        resourceId: siteId,
        reason: 'Operator opened merchant operational evidence.',
        metadata: { section },
    });
}
const number = (v: unknown) => {
    const n = Number(v);
    if (v === null || v === undefined || !Number.isFinite(n))
        throw unavailable();
    return n;
};

router.get('/:id/operations/health', bindConsoleOperatorIdentity, guard, async (c) => {
    const { db, id } = await scope(c);
    const health = await new StoreHealthAdapter(db, Boolean(c.env.PAYMENT_CONFIG_ENCRYPTION_KEY)).read(id);
    await audit(c, id, 'health');
    return c.json(success(health));
});

router.get('/:id/operations', bindConsoleOperatorIdentity, guard, async (c) => {
    const { db, site, id } = await scope(c),
        now = new Date().toISOString();
    const [products, orders, saas, usage, verification] =
        await Promise.allSettled([
            db
                .from('products')
                .select('id', { head: true, count: 'exact' })
                .eq('store_id', id)
                .is('deleted_at', null),
            db
                .from('orders')
                .select('id', { head: true, count: 'exact' })
                .eq('store_id', id)
                .is('deleted_at', null),
            new SaasExecutionAdapter(db).resolveEntitlements(id),
            db
                .from('site_usage_meters')
                .select(
                    'id,meter_name,quantity,limit_quantity,period_start,period_end,updated_at',
                )
                .eq('site_id', id)
                .is('deleted_at', null)
                .lte('period_start', now)
                .gt('period_end', now)
                .order('meter_name')
                .order('id')
                .limit(50),
            db
                .from('merchant_kyc_documents')
                .select('document_type,status,provider_mode,updated_at')
                .eq('site_id', id)
                .is('deleted_at', null)
                .order('updated_at', { ascending: false })
                .order('id')
                .limit(25),
        ]);
    const failed = (v: PromiseSettledResult<{ error: unknown }>) =>
        v.status === 'rejected' || Boolean(v.value.error);
    const snapshot: InternalMerchantOperationsSnapshot = {
        observed_at: now,
        site,
        counts: {
            products:
                products.status === 'fulfilled' && !products.value.error
                    ? products.value.count
                    : null,
            orders:
                orders.status === 'fulfilled' && !orders.value.error
                    ? orders.value.count
                    : null,
        },
        saas:
            saas.status === 'fulfilled' && saas.value.authority === 'persisted'
                ? {
                      authority: 'persisted',
                      plan: saas.value.plan,
                      features: saas.value.features,
                      limits: saas.value.limits,
                  }
                : {
                      authority: 'unavailable',
                      plan: 'unknown',
                      features: [],
                      limits: {},
                  },
        usage:
            usage.status === 'fulfilled' && !usage.value.error
                ? usage.value.data || []
                : [],
        verification:
            verification.status === 'fulfilled' && !verification.value.error
                ? verification.value.data || []
                : [],
        unavailable: [],
    };
    if (failed(products)) snapshot.unavailable.push('product_count');
    if (failed(orders)) snapshot.unavailable.push('order_count');
    if (snapshot.saas.authority === 'unavailable')
        snapshot.unavailable.push('saas');
    if (failed(usage)) snapshot.unavailable.push('usage');
    if (failed(verification)) snapshot.unavailable.push('verification');
    await audit(c, id, 'summary');
    return c.json(success(snapshot));
});
router.get(
    '/:id/operations/products',
    bindConsoleOperatorIdentity,
    guard,
    async (c) => {
        const { db, id } = await scope(c),
            q = query(c);
        let request = db
            .from('products')
            .select(productFields, { count: 'exact' })
            .eq('store_id', id)
            .is('deleted_at', null);
        if (q.q)
            request = request.ilike(
                'name',
                '%' + q.q.replace(/[\\%_]/g, '\\$&') + '%',
            );
        if (q.status) request = request.eq('status', q.status);
        const result = await request
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range((q.page - 1) * q.limit, q.page * q.limit - 1);
        if (result.error) throw unavailable();
        await audit(c, id, 'products');
        return c.json(
            paginated(
                (result.data || []).map((p) => ({
                    ...p,
                    price: number(p.price),
                })),
                result.count || 0,
                q.page,
                q.limit,
            ),
        );
    },
);
router.get(
    '/:id/operations/orders',
    bindConsoleOperatorIdentity,
    guard,
    async (c) => {
        const { db, id } = await scope(c),
            q = query(c);
        let request = db
            .from('orders')
            .select(orderFields, { count: 'exact' })
            .eq('store_id', id)
            .is('deleted_at', null);
        if (q.q)
            request = request.ilike(
                'order_number',
                '%' + q.q.replace(/[\\%_]/g, '\\$&') + '%',
            );
        if (q.status) request = request.eq('status', q.status);
        const result = await request
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range((q.page - 1) * q.limit, q.page * q.limit - 1);
        if (result.error) throw unavailable();
        await audit(c, id, 'orders');
        return c.json(
            paginated(
                (result.data || []).map((o) => ({
                    ...o,
                    total: number(o.total),
                })),
                result.count || 0,
                q.page,
                q.limit,
            ),
        );
    },
);
router.get(
    '/:id/operations/orders/:recordId',
    bindConsoleOperatorIdentity,
    guard,
    async (c) => {
        const { db, id, recordId } = await scope(c),
            q = query(c);
        const order = await db
            .from('orders')
            .select(orderFields)
            .eq('id', recordId!)
            .eq('store_id', id)
            .is('deleted_at', null)
            .maybeSingle();
        if (order.error) throw unavailable();
        if (!order.data)
            throw new NotFoundError('Order not found for this merchant.');
        const items = await db
            .from('order_items')
            .select(
                'id,title,name,sku,quantity,unit_price,price,total,product_snapshot',
                {
                    count: 'exact',
                },
            )
            .eq('store_id', id)
            .eq('order_id', recordId!)
            .is('deleted_at', null)
            .order('created_at')
            .order('id')
            .range((q.page - 1) * q.limit, q.page * q.limit - 1);
        if (items.error) throw unavailable();
        await audit(c, id, 'order_snapshot');
        const normalized = normalizeOrderRecord({
            ...order.data,
            order_items: items.data || [],
        } as unknown as OrderSourceRow);
        return c.json(
            success({
                order: { ...order.data, total: number(order.data.total) },
                items: normalized.items.map((line, index) => {
                    return {
                        id: items.data![index].id as string,
                        name: line.title,
                        sku: line.sku,
                        quantity: line.quantity,
                        unit_price: line.unit_price,
                        total: line.total,
                    };
                }),
                item_meta: paginated([], items.count || 0, q.page, q.limit)
                    .meta,
            }),
        );
    },
);
export default router;
