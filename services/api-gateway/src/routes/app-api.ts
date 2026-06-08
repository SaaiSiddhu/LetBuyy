import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { readAppSpendSnapshot } from '../lib/app-spend-controls';
import { cursorPaginated, decodeListCursor, encodeListCursor, getSupabaseAdmin, success } from '../lib/supabase';
import { appAuthMiddleware } from '../middleware/app-auth';
import { validate } from '../middleware/validation';
import {
    ListProductsQuery,
    type ListProductsInput as ListProductsQueryInput,
} from '@letbuyy/commerce-core';
import {
    ListOrdersQuery,
    normalizeOrderRecord,
    type ListOrdersInput as ListOrdersQueryInput,
    type OrderSourceRow,
} from '@letbuyy/checkout-core';
import {
    CreateAppUsageEventSchema,
    appUsageBillingPeriod,
    planAppUsageMetering,
} from '@letbuyy/billing-core';

const router = new Hono<{ Bindings: Env }>();
type AppApiContext = Context<{ Bindings: Env }>;
type AppApiAuthContext = {
    app: {
        appId: string;
        installationId: string;
        storeId: string;
    };
};

const APP_PRODUCT_LIST_COLUMNS = [
    'id',
    'store_id',
    'site_id',
    'name',
    'description',
    'price',
    'compare_price',
    'images',
    'thumbnail_url',
    'category',
    'tags',
    'stock',
    'track_inventory',
    'allow_backorder',
    'is_active',
    'is_featured',
    'created_at',
    'updated_at',
    'slug',
    'sku',
    'barcode',
    'seo_title',
    'seo_description',
    'status',
    'product_type',
    'vendor',
    'url_handle',
    'version',
].join(',');

const APP_ORDER_LIST_COLUMNS = [
    'id',
    'store_id',
    'site_id',
    'order_number',
    'customer_email',
    'customer_name',
    'customer_phone',
    'shipping_address',
    'billing_address',
    'items',
    'subtotal',
    'shipping_cost',
    'tax',
    'discount',
    'total',
    'coupon_code',
    'coupon_discount',
    'status',
    'payment_status',
    'payment_method',
    'payment_id',
    'tracking_number',
    'carrier',
    'created_at',
    'updated_at',
    'fulfillment_status',
    'payment_gateway',
    'shipping_method',
    'notes',
    'version',
    'payment_processed_at',
    'currency',
].join(',');

const AppInstallationMetadataSchema = z.object({
    metadata: z.record(z.string().min(1).max(120), z.unknown()),
}).strict().refine((body) => JSON.stringify(body.metadata).length <= 8192, {
    message: 'metadata must be 8KB or smaller',
    path: ['metadata'],
});

type AppInstallationMetadataInput = z.infer<typeof AppInstallationMetadataSchema>;

const SECRET_KEY_PATTERN = /(^|[_-])(access|refresh|id)?[_-]?token$|(^|[_-])secret$|password|private[_-]?key|signing[_-]?secret|client[_-]?secret/i;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
}

function firstRecord(value: unknown): Record<string, unknown> {
    if (Array.isArray(value)) return parseRecord(value[0]);
    return parseRecord(value);
}

function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function secretLikePath(value: unknown, path: string[] = []): string | null {
    if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
            const nested = secretLikePath(value[index], [...path, `[${index}]`]);
            if (nested) return nested;
        }
        return null;
    }

    if (!isRecord(value)) return null;

    for (const [key, nestedValue] of Object.entries(value)) {
        const nextPath = [...path, key];
        if (SECRET_KEY_PATTERN.test(key)) return nextPath.join('.');
        const nested = secretLikePath(nestedValue, nextPath);
        if (nested) return nested;
    }

    return null;
}

function databaseError() {
    return { error: { code: 'DB_ERROR', message: 'Database operation failed' } };
}

function nextUtcDayStart(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function defaultDailyQuota(routeGroup: string): number {
    if (routeGroup === 'usage-events') return 50_000;
    if (routeGroup === 'products') return 20_000;
    if (routeGroup === 'orders') return 10_000;
    return 5_000;
}

function quotaRowScore(row: Record<string, unknown>, routeGroup: string, appAuth: AppApiAuthContext): number {
    let score = 0;
    if (textValue(row.route_group) === routeGroup) score += 4;
    if (textValue(row.installation_id) === appAuth.app.installationId) score += 2;
    if (textValue(row.site_id) === appAuth.app.storeId) score += 1;
    return score;
}

function writeQuotaHeaders(c: AppApiContext, input: {
    routeGroup: string;
    limit: number;
    used: number;
    resetAt: string;
}) {
    const remaining = Math.max(0, input.limit - input.used);
    c.header('X-App-Quota-Limit', input.limit.toString());
    c.header('X-App-Quota-Remaining', remaining.toString());
    c.header('X-App-Quota-Reset', Math.ceil(new Date(input.resetAt).getTime() / 1000).toString());
    c.header('X-App-Quota-Used', input.used.toString());
    c.header('X-App-Quota-Route', input.routeGroup);
}

async function enforceAppApiQuota(c: AppApiContext, routeGroup: string): Promise<Response | null> {
    const appAuth = c.get('appAuth');
    const db = getSupabaseAdmin(c);
    const now = Date.now();
    const defaultLimit = defaultDailyQuota(routeGroup);
    const resetAt = nextUtcDayStart();

    const { data: quotaRows, error } = await db
        .from('app_api_quotas')
        .select('id, app_id, installation_id, site_id, route_group, limit_per_day, used_count, reset_at, status')
        .eq('app_id', appAuth.app.appId)
        .in('route_group', [routeGroup, '*'])
        .or(`installation_id.eq.${appAuth.app.installationId},installation_id.is.null`)
        .or(`site_id.eq.${appAuth.app.storeId},site_id.is.null`)
        .is('deleted_at', null)
        .limit(10);

    if (error) {
        return c.json({ error: { code: 'APP_API_QUOTA_UNAVAILABLE', message: 'App API quota accounting is unavailable' } }, 503);
    }

    const rows = Array.isArray(quotaRows) ? quotaRows as Array<Record<string, unknown>> : [];
    const selected = rows
        .sort((left, right) => quotaRowScore(right, routeGroup, appAuth) - quotaRowScore(left, routeGroup, appAuth))[0];

    if (!selected) {
        const { data: inserted, error: insertError } = await db
            .from('app_api_quotas')
            .insert({
                app_id: appAuth.app.appId,
                installation_id: appAuth.app.installationId,
                site_id: appAuth.app.storeId,
                route_group: routeGroup,
                limit_per_day: defaultLimit,
                used_count: 1,
                reset_at: resetAt,
                status: 'active',
                metadata: { source: 'default_app_api_quota' },
            })
            .select('id, limit_per_day, used_count, reset_at')
            .single();

        if (insertError) {
            return c.json({ error: { code: 'APP_API_QUOTA_UNAVAILABLE', message: 'App API quota accounting is unavailable' } }, 503);
        }

        writeQuotaHeaders(c, {
            routeGroup,
            limit: numberValue(inserted?.limit_per_day) || defaultLimit,
            used: numberValue(inserted?.used_count) || 1,
            resetAt: textValue(inserted?.reset_at) || resetAt,
        });
        return null;
    }

    const status = textValue(selected.status) || 'active';
    const quotaId = textValue(selected.id);
    const limit = Math.max(1, numberValue(selected.limit_per_day) || defaultLimit);
    const selectedResetAt = textValue(selected.reset_at) || resetAt;
    const shouldReset = new Date(selectedResetAt).getTime() <= now;
    const currentUsed = shouldReset ? 0 : numberValue(selected.used_count);

    if (status !== 'active') {
        writeQuotaHeaders(c, { routeGroup, limit, used: currentUsed, resetAt: shouldReset ? resetAt : selectedResetAt });
        return c.json({ error: { code: 'APP_API_QUOTA_DISABLED', message: 'App API access is disabled for this quota' } }, 429);
    }

    if (currentUsed >= limit) {
        writeQuotaHeaders(c, { routeGroup, limit, used: currentUsed, resetAt: shouldReset ? resetAt : selectedResetAt });
        c.header('Retry-After', Math.max(1, Math.ceil((new Date(shouldReset ? resetAt : selectedResetAt).getTime() - now) / 1000)).toString());
        return c.json({
            error: {
                code: 'APP_API_QUOTA_EXCEEDED',
                message: 'App API quota exceeded for this installation',
                route_group: routeGroup,
            },
        }, 429);
    }

    const nextUsed = currentUsed + 1;
    const nextResetAt = shouldReset ? resetAt : selectedResetAt;
    if (quotaId) {
        const { error: updateError } = await db
            .from('app_api_quotas')
            .update({
                used_count: nextUsed,
                reset_at: nextResetAt,
                last_request_at: new Date().toISOString(),
            })
            .eq('id', quotaId);
        if (updateError) {
            return c.json({ error: { code: 'APP_API_QUOTA_UNAVAILABLE', message: 'App API quota accounting is unavailable' } }, 503);
        }
    }

    writeQuotaHeaders(c, { routeGroup, limit, used: nextUsed, resetAt: nextResetAt });
    return null;
}

function assertTokenStoreScope(queryStoreId: string | undefined, tokenStoreId: string) {
    if (queryStoreId && queryStoreId !== tokenStoreId) {
        return {
            ok: false as const,
            response: {
                error: {
                    code: 'FORBIDDEN',
                    message: 'App token store does not match the requested store_id',
                },
            },
        };
    }

    return { ok: true as const };
}

async function recordAppApiUsageMetric(c: AppApiContext, routeGroup: string, startedAt: number, status = 200) {
    try {
        const appAuth = c.get('appAuth');
        const db = getSupabaseAdmin(c);
        const { data: app } = await db
            .from('marketplace_apps')
            .select('developer_id')
            .eq('id', appAuth.app.appId)
            .maybeSingle();
        const developerId = textValue(app?.developer_id);
        if (!developerId) return;

        const metricDate = new Date().toISOString().slice(0, 10);
        const method = c.req.method || 'GET';
        const latency = Math.max(0, Math.round(Date.now() - startedAt));
        const { data: current } = await db
            .from('app_api_usage_metrics')
            .select('id, request_count, error_count, avg_latency_ms, p95_latency_ms')
            .eq('app_id', appAuth.app.appId)
            .eq('metric_date', metricDate)
            .eq('route_group', routeGroup)
            .eq('method', method)
            .is('deleted_at', null)
            .maybeSingle();

        const requestCount = numberValue(current?.request_count) + 1;
        const previousAvg = numberValue(current?.avg_latency_ms);
        const previousCount = Math.max(0, requestCount - 1);
        const avgLatency = Math.round(((previousAvg * previousCount) + latency) / requestCount);
        const metricRow = {
            developer_id: developerId,
            app_id: appAuth.app.appId,
            metric_date: metricDate,
            route_group: routeGroup,
            method,
            request_count: requestCount,
            error_count: numberValue(current?.error_count) + (status >= 400 ? 1 : 0),
            avg_latency_ms: avgLatency,
            p95_latency_ms: Math.max(numberValue(current?.p95_latency_ms), latency),
            metadata: { installation_id: appAuth.app.installationId, store_id: appAuth.app.storeId },
        };
        const currentId = textValue(current?.id);
        if (currentId) {
            await db.from('app_api_usage_metrics').update(metricRow).eq('id', currentId);
        } else {
            await db.from('app_api_usage_metrics').insert(metricRow);
        }
    } catch {
        // API usage telemetry is best-effort and must not block app API responses.
    }
}

// POST /app/usage-events -- app-token metered usage ingest for usage-priced apps.
router.post('/usage-events', appAuthMiddleware(['write_usage']), async (c) => {
    const appAuth = c.get('appAuth');
    const startedAt = Date.now();
    const input = CreateAppUsageEventSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!input.success) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 400);
        return c.json({ error: { code: 'VALIDATION', message: input.error.issues[0]?.message || 'Invalid usage event' } }, 400);
    }
    const quotaBlock = await enforceAppApiQuota(c, 'usage-events');
    if (quotaBlock) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 429);
        return quotaBlock;
    }

    const db = getSupabaseAdmin(c);
    const { data: existingEvent, error: existingError } = await db
        .from('app_usage_events')
        .select('*')
        .eq('installation_id', appAuth.app.installationId)
        .eq('idempotency_key', input.data.idempotency_key)
        .maybeSingle();

    if (existingError) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 500);
        return c.json(databaseError(), 500);
    }

    if (existingEvent) {
        const { data: existingRollup, error: rollupError } = await db
            .from('app_usage_meter_rollups')
            .select('*')
            .eq('installation_id', appAuth.app.installationId)
            .eq('meter_name', input.data.meter_name)
            .eq('period_start', existingEvent.period_start)
            .eq('period_end', existingEvent.period_end)
            .maybeSingle();
        if (rollupError) {
            await recordAppApiUsageMetric(c, 'usage-events', startedAt, 500);
            return c.json(databaseError(), 500);
        }
        if (!existingRollup) {
            await recordAppApiUsageMetric(c, 'usage-events', startedAt, 500);
            return c.json(databaseError(), 500);
        }
        await recordAppApiUsageMetric(c, 'usage-events', startedAt);
        return c.json(success({ event: existingEvent, rollup: existingRollup }));
    }

    const { data: charges, error: chargeError } = await db
        .from('app_billing_charges')
        .select('id, site_id, app_id, installation_id, pricing_plan_id, billing_mode, status, app_pricing_plans(id, usage_meter, usage_unit, included_usage, usage_unit_amount_minor)')
        .eq('site_id', appAuth.app.storeId)
        .eq('app_id', appAuth.app.appId)
        .eq('installation_id', appAuth.app.installationId)
        .eq('billing_mode', 'usage')
        .in('status', ['active', 'trialing'])
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

    if (chargeError) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 500);
        return c.json(databaseError(), 500);
    }
    const charge = firstRecord(charges);
    const chargeId = textValue(charge.id);
    if (!chargeId) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 402);
        return c.json({
            error: {
                code: 'USAGE_BILLING_NOT_ACTIVE',
                message: 'Usage metering requires an active usage billing approval for this installation',
            },
        }, 402);
    }

    const plan = firstRecord(charge.app_pricing_plans);
    const planMeterName = textValue(plan.usage_meter);
    const meterName = planMeterName || input.data.meter_name;
    if (planMeterName && planMeterName !== input.data.meter_name) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 400);
        return c.json({
            error: {
                code: 'USAGE_METER_MISMATCH',
                message: `Usage events for this plan must use meter ${planMeterName}`,
            },
        }, 400);
    }

    const period = appUsageBillingPeriod();
    const { data: currentRollup, error: currentRollupError } = await db
        .from('app_usage_meter_rollups')
        .select('*')
        .eq('installation_id', appAuth.app.installationId)
        .eq('meter_name', meterName)
        .eq('period_start', period.period_start)
        .eq('period_end', period.period_end)
        .maybeSingle();

    if (currentRollupError) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 500);
        return c.json(databaseError(), 500);
    }

    const usagePlan = planAppUsageMetering({
        quantity: input.data.quantity,
        previousQuantity: numberValue(currentRollup?.quantity),
        includedQuantity: numberValue(plan.included_usage),
        unitAmountMinor: numberValue(plan.usage_unit_amount_minor),
        trialing: textValue(charge.status) === 'trialing',
    });
    const usageUnit = textValue(plan.usage_unit) || 'unit';
    const now = new Date().toISOString();
    const spendSnapshot = await readAppSpendSnapshot(db, {
        siteId: appAuth.app.storeId,
        projectedAmountMinor: usagePlan.amount_minor,
    });
    if (!spendSnapshot.ok) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 500);
        return c.json(databaseError(), 500);
    }
    if (spendSnapshot.value.blocking) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 402);
        return c.json({
            error: {
                code: 'APP_SPEND_CAP_EXCEEDED',
                message: 'This usage event would exceed the monthly app spend cap for this store',
                spend: spendSnapshot.value,
            },
        }, 402);
    }

    const { data: event, error: eventError } = await db
        .from('app_usage_events')
        .insert({
            site_id: appAuth.app.storeId,
            app_id: appAuth.app.appId,
            installation_id: appAuth.app.installationId,
            pricing_plan_id: textValue(charge.pricing_plan_id),
            charge_id: chargeId,
            meter_name: meterName,
            quantity: usagePlan.quantity,
            billable_quantity: usagePlan.billable_quantity,
            usage_unit: usageUnit,
            unit_amount_minor: usagePlan.unit_amount_minor,
            amount_minor: usagePlan.amount_minor,
            currency: 'INR',
            billing_status: usagePlan.billing_status,
            period_start: period.period_start,
            period_end: period.period_end,
            idempotency_key: input.data.idempotency_key,
            source: input.data.source,
            resource_type: input.data.resource_type || null,
            resource_id: input.data.resource_id || null,
            metadata: {
                ...input.data.metadata,
                charge_status: textValue(charge.status),
                included_quantity: usagePlan.included_quantity,
                spend_control: {
                    projected_amount_minor: spendSnapshot.value.projected_amount_minor,
                    over_alert_threshold: spendSnapshot.value.over_alert_threshold,
                    over_cap: spendSnapshot.value.over_cap,
                },
            },
        })
        .select()
        .single();

    if (eventError) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 500);
        return c.json(databaseError(), 500);
    }

    const totalQuantity = numberValue(currentRollup?.quantity) + usagePlan.quantity;
    const totalBillableQuantity = numberValue(currentRollup?.billable_quantity) + usagePlan.billable_quantity;
    const totalAmountMinor = Math.max(0, Math.round(numberValue(currentRollup?.amount_minor) + usagePlan.amount_minor));
    const { data: rollup, error: rollupError } = await db
        .from('app_usage_meter_rollups')
        .upsert({
            id: textValue(currentRollup?.id) || undefined,
            site_id: appAuth.app.storeId,
            app_id: appAuth.app.appId,
            installation_id: appAuth.app.installationId,
            pricing_plan_id: textValue(charge.pricing_plan_id),
            charge_id: chargeId,
            meter_name: meterName,
            usage_unit: usageUnit,
            period_start: period.period_start,
            period_end: period.period_end,
            quantity: totalQuantity,
            included_quantity: usagePlan.included_quantity,
            billable_quantity: totalBillableQuantity,
            unit_amount_minor: usagePlan.unit_amount_minor,
            amount_minor: totalAmountMinor,
            currency: 'INR',
            last_event_at: now,
            metadata: {
                charge_status: textValue(charge.status),
                last_event_id: event.id,
            },
        }, { onConflict: 'installation_id,meter_name,period_start,period_end' })
        .select()
        .single();

    if (rollupError) {
        await recordAppApiUsageMetric(c, 'usage-events', startedAt, 500);
        return c.json(databaseError(), 500);
    }

    await recordAppApiUsageMetric(c, 'usage-events', startedAt, 201);
    return c.json(success({ event, rollup }), 201);
});

function isMissingDeletedAtError(error: { message?: string; details?: string; hint?: string; code?: string } | null | undefined): boolean {
    const haystack = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
    return Boolean(error && (error.code === '42703' || (haystack.includes('deleted_at') && haystack.includes('column'))));
}

// GET /app/products -- scoped, app-token product reads for the token installation store.
router.get('/products', appAuthMiddleware(['read_products']), validate('query', ListProductsQuery), async (c) => {
    const appAuth = c.get('appAuth');
    const startedAt = Date.now();
    const query = c.get('validatedQuery') as ListProductsQueryInput;
    const storeScope = assertTokenStoreScope(query.store_id, appAuth.app.storeId);
    if (!storeScope.ok) {
        await recordAppApiUsageMetric(c, 'products', startedAt, 403);
        return c.json(storeScope.response, 403);
    }
    const quotaBlock = await enforceAppApiQuota(c, 'products');
    if (quotaBlock) {
        await recordAppApiUsageMetric(c, 'products', startedAt, 429);
        return quotaBlock;
    }

    const offset = (query.page - 1) * query.limit;
    const decodedCursor = decodeListCursor(query.cursor);
    const db = getSupabaseAdmin(c);

    const buildProductsQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('products')
            .select(APP_PRODUCT_LIST_COLUMNS, query.withCount ? { count: 'exact' } : undefined)
            .eq('store_id', appAuth.app.storeId);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        if (query.category) dbQuery = dbQuery.eq('category', query.category);
        if (query.status === 'active') dbQuery = dbQuery.eq('is_active', true);
        if (query.status === 'inactive') dbQuery = dbQuery.eq('is_active', false);
        if (query.search) dbQuery = dbQuery.ilike('name', `%${query.search}%`);
        if (decodedCursor) {
            dbQuery = query.order === 'asc'
                ? dbQuery.gt(query.sort, decodedCursor.value)
                : dbQuery.lt(query.sort, decodedCursor.value);
        }

        dbQuery = dbQuery
            .order(query.sort, { ascending: query.order === 'asc' })
            .order('id', { ascending: query.order === 'asc' });

        if (query.cursor || query.page === 1) return dbQuery.limit(query.limit + 1);
        return dbQuery.range(offset, offset + query.limit);
    };

    let { data, error, count } = await buildProductsQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildProductsQuery(false));
    }

    if (error) {
        await recordAppApiUsageMetric(c, 'products', startedAt, 500);
        return c.json(databaseError(), 500);
    }

    const rows = (data || []) as unknown as Array<Record<string, unknown>>;
    const pageRows = rows.slice(0, query.limit);
    const nextCursor = rows.length > query.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as Record<string, unknown>, query.sort)
        : null;

    await recordAppApiUsageMetric(c, 'products', startedAt);
    return c.json(cursorPaginated(pageRows, {
        page: query.page,
        limit: query.limit,
        total: query.withCount ? count || 0 : undefined,
        nextCursor,
    }));
});

// GET /app/orders -- scoped, app-token order reads for the token installation store.
router.get('/orders', appAuthMiddleware(['read_orders']), validate('query', ListOrdersQuery), async (c) => {
    const appAuth = c.get('appAuth');
    const startedAt = Date.now();
    const query = c.get('validatedQuery') as ListOrdersQueryInput;
    const storeScope = assertTokenStoreScope(query.store_id, appAuth.app.storeId);
    if (!storeScope.ok) {
        await recordAppApiUsageMetric(c, 'orders', startedAt, 403);
        return c.json(storeScope.response, 403);
    }
    const quotaBlock = await enforceAppApiQuota(c, 'orders');
    if (quotaBlock) {
        await recordAppApiUsageMetric(c, 'orders', startedAt, 429);
        return quotaBlock;
    }

    const offset = (query.page - 1) * query.limit;
    const decodedCursor = decodeListCursor(query.cursor);
    const db = getSupabaseAdmin(c);

    const buildOrdersQuery = (includeDeletedAtFilter: boolean) => {
        let dbQuery = db
            .from('orders')
            .select(APP_ORDER_LIST_COLUMNS, query.withCount ? { count: 'exact' } : undefined)
            .eq('store_id', appAuth.app.storeId);

        if (includeDeletedAtFilter) dbQuery = dbQuery.is('deleted_at', null);
        if (query.status !== 'all') dbQuery = dbQuery.eq('status', query.status);
        if (query.payment_status !== 'all') dbQuery = dbQuery.eq('payment_status', query.payment_status);
        if (decodedCursor) {
            dbQuery = query.order === 'asc'
                ? dbQuery.gt(query.sort, decodedCursor.value)
                : dbQuery.lt(query.sort, decodedCursor.value);
        }
        if (query.search) {
            const search = query.search.replace(/[%(),]/g, '').trim();
            if (search) {
                dbQuery = dbQuery.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%,customer_name.ilike.%${search}%`);
            }
        }

        dbQuery = dbQuery
            .order(query.sort, { ascending: query.order === 'asc' })
            .order('id', { ascending: query.order === 'asc' });

        if (query.cursor || query.page === 1) return dbQuery.limit(query.limit + 1);
        return dbQuery.range(offset, offset + query.limit);
    };

    let { data, error, count } = await buildOrdersQuery(true);
    if (isMissingDeletedAtError(error)) {
        ({ data, error, count } = await buildOrdersQuery(false));
    }

    if (error) {
        await recordAppApiUsageMetric(c, 'orders', startedAt, 500);
        return c.json(databaseError(), 500);
    }

    const rawRows = (data || []) as unknown as Array<Record<string, unknown>>;
    const pageRows = rawRows.slice(0, query.limit);
    const nextCursor = rawRows.length > query.limit
        ? encodeListCursor(pageRows[pageRows.length - 1] as Record<string, unknown>, query.sort)
        : null;
    const rows = (pageRows as unknown as OrderSourceRow[]).map(normalizeOrderRecord);

    await recordAppApiUsageMetric(c, 'orders', startedAt);
    return c.json(cursorPaginated(rows, {
        page: query.page,
        limit: query.limit,
        total: query.withCount ? count || 0 : undefined,
        nextCursor,
    }));
});

// PATCH /app/installation/metadata -- app-owned metadata only; no merchant record mutation.
router.patch('/installation/metadata', appAuthMiddleware(['write_app_metadata']), validate('json', AppInstallationMetadataSchema), async (c) => {
    const appAuth = c.get('appAuth');
    const startedAt = Date.now();
    const body = c.get('validatedBody') as AppInstallationMetadataInput;
    const rejectedPath = secretLikePath(body.metadata);
    if (rejectedPath) {
        await recordAppApiUsageMetric(c, 'installation-metadata', startedAt, 400);
        return c.json(
            {
                error: {
                    code: 'SECRET_METADATA_REJECTED',
                    message: `metadata key is not allowed: ${rejectedPath}`,
                },
            },
            400,
        );
    }
    const quotaBlock = await enforceAppApiQuota(c, 'installation-metadata');
    if (quotaBlock) {
        await recordAppApiUsageMetric(c, 'installation-metadata', startedAt, 429);
        return quotaBlock;
    }

    const db = getSupabaseAdmin(c);
    const { data: installation, error: loadError } = await db
        .from('app_installations')
        .select('id, store_id, config')
        .eq('id', appAuth.app.installationId)
        .eq('app_id', appAuth.app.appId)
        .eq('store_id', appAuth.app.storeId)
        .eq('status', 'active')
        .maybeSingle();

    if (loadError) {
        await recordAppApiUsageMetric(c, 'installation-metadata', startedAt, 500);
        return c.json(databaseError(), 500);
    }
    if (!installation) {
        await recordAppApiUsageMetric(c, 'installation-metadata', startedAt, 401);
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'App installation is not active' } }, 401);
    }

    const config = parseRecord(installation.config);
    const appApiConfig = parseRecord(config.app_api);
    const updatedAt = new Date().toISOString();
    const updatedConfig = {
        ...config,
        app_api: {
            ...appApiConfig,
            metadata: body.metadata,
            metadata_updated_at: updatedAt,
        },
    };

    const { error: updateError } = await db
        .from('app_installations')
        .update({ config: updatedConfig })
        .eq('id', appAuth.app.installationId)
        .eq('app_id', appAuth.app.appId)
        .eq('store_id', appAuth.app.storeId)
        .eq('status', 'active');

    if (updateError) {
        await recordAppApiUsageMetric(c, 'installation-metadata', startedAt, 500);
        return c.json(databaseError(), 500);
    }

    await recordAppApiUsageMetric(c, 'installation-metadata', startedAt);
    return c.json(success({
        installation_id: appAuth.app.installationId,
        app_id: appAuth.app.appId,
        store_id: appAuth.app.storeId,
        metadata: body.metadata,
        updated_at: updatedAt,
    }));
});

export default router;
