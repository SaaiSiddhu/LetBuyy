import { tryRestoreRedeemedLoyalty } from '../lib/loyalty-refund-recovery';
import { Hono } from 'hono';
import {
    assessOrderRisk,
    normalizeOrderRecord,
    type OrderRiskAssessmentInput,
    type OrderSourceRow,
} from '@letbuyy/checkout-core';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOrder, resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';
import {
    CodConfirmationSchema,
    CodTimeoutSchema,
    OrderRiskAssessmentSchema,
} from '../schemas/order.schema';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type IdempotencyResponseBody = Parameters<IdempotencyExecutionAdapter['complete']>[0]['responseBody'];

export const orderRiskRouter = new Hono<{ Bindings: Env }>();
export const orderCodRouter = new Hono<{ Bindings: Env }>();

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function firstText(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = textValue(record[key]);
        if (value) return value;
    }
    return null;
}

function orderTotalPayload(order: Record<string, unknown>): { amount_minor: number; currency: string } | null {
    const total = numberValue(order.total);
    if (total === null) return null;
    return {
        amount_minor: Math.round(total * 100),
        currency: textValue(order.currency) || 'INR',
    };
}

function pincodeFromAddress(value: unknown): string | null {
    const address = recordValue(value);
    return firstText(address, ['zip', 'postal_code', 'pincode']);
}

function orderRiskInputFromRow(
    storeId: string,
    order: Record<string, unknown>,
    fallback: OrderRiskAssessmentInput,
): OrderRiskAssessmentInput {
    return {
        ...fallback,
        store_id: storeId,
        order_id: textValue(order.id) || fallback.order_id,
        payment_method: (textValue(order.payment_method) || fallback.payment_method || 'cod') as OrderRiskAssessmentInput['payment_method'],
        order_total_minor: orderTotalPayload(order)?.amount_minor ?? fallback.order_total_minor,
        pincode: pincodeFromAddress(order.shipping_address) || fallback.pincode || null,
        phone: textValue(order.customer_phone) || fallback.phone || null,
    };
}

function replayHttpStatus(statusCode: number): 200 | 201 | 202 {
    if (statusCode === 201) return 201;
    if (statusCode === 202) return 202;
    return 200;
}

async function emitOrderEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        eventType: 'order.risk_assessed' | 'order.confirmed_cod' | 'order.cancelled';
        order: unknown;
        fallbackOrderId?: string;
        siteId: string;
        actorId?: string | null;
        requestId?: string | null;
    },
): Promise<void> {
    const order = recordValue(input.order);
    const orderId = textValue(order.id) || textValue(order.order_id) || input.fallbackOrderId;
    if (!orderId) return;

    const total = orderTotalPayload(order);
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'order',
        aggregateId: orderId,
        eventType: input.eventType,
        payload: {
            site_id: input.siteId,
            order_id: orderId,
            order_number: textValue(order.order_number) || undefined,
            ...(total ? { total } : {}),
        },
        idempotencyKey: `${input.eventType}:${input.siteId}:${orderId}:${input.requestId || crypto.randomUUID()}`,
        requestId: input.requestId || null,
        actorId: input.actorId || null,
    });
}

async function emitCodConfirmationRequestedEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        orderId: string;
        requestId: string;
        idempotencyKey: string;
    },
) {
    // [HUMAN-REQUIRED] HR-WHATSAPP-LIVE: live WABA/BSP credentials and
    // approved HSM templates are required before this sandbox request sends on
    // live WhatsApp rails.
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: 'order',
        aggregateId: input.orderId,
        eventType: 'cod.confirmation_requested',
        payload: {
            site_id: input.siteId,
            order_id: input.orderId,
            channel: 'whatsapp',
            mode: 'sandbox',
        },
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId,
    });
}

function jsonResponseBody(value: unknown): IdempotencyResponseBody {
    return JSON.parse(JSON.stringify(value)) as JsonValue as IdempotencyResponseBody;
}

orderRiskRouter.post('/assess', validate('json', OrderRiskAssessmentSchema), async (c) => {
    const body = c.get('validatedBody') as OrderRiskAssessmentInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const idempotencyKey = body.idempotency_key || `risk-assess:${body.order_id || crypto.randomUUID()}`;
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: idempotencyKey,
        scope: `orders.risk.assess:${body.order_id || 'prospective'}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(recordValue(claim.responseBody), replayHttpStatus(claim.statusCode));
    }

    try {
        let orderRow: Record<string, unknown> | null = null;
        if (body.order_id) {
            const { data, error } = await db
                .from('orders')
                .select('id, store_id, site_id, order_number, customer_phone, shipping_address, payment_method, total, currency')
                .eq('id', body.order_id)
                .eq('store_id', tenant.siteId)
                .is('deleted_at', null)
                .maybeSingle();
            if (error || !data) {
                await idempotency.fail(claim.id);
                return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
            }
            orderRow = data as Record<string, unknown>;
        }

        const input = orderRow ? orderRiskInputFromRow(tenant.siteId, orderRow, body) : body;
        const plan = assessOrderRisk(input);
        const { data: assessment, error: assessmentError } = await db
            .from('order_risk_assessments')
            .upsert({
                site_id: tenant.siteId,
                order_id: input.order_id || null,
                risk_score: plan.risk_score,
                risk_level: plan.risk_level,
                reasons: plan.reasons,
                actions: plan.actions,
                input,
                idempotency_key: idempotencyKey,
                request_id: tenant.requestId,
                created_by: tenant.userId,
                updated_by: tenant.userId,
            }, { onConflict: 'site_id,idempotency_key' })
            .select('*')
            .single();

        if (assessmentError || !assessment) throw new Error('Order risk assessment persistence failed');

        if (input.order_id) {
            const updates: Record<string, unknown> = {
                risk_score: plan.risk_score,
                risk_level: plan.risk_level,
                updated_by: tenant.userId,
            };
            if (plan.actions.includes('request_cod_confirmation')) {
                updates.status = 'pending_cod';
                updates.cod_confirmation_status = 'requested';
                updates.cod_confirmation_requested_at = new Date().toISOString();
                updates.cod_expires_at = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
            }
            if (plan.actions.includes('hold_fulfillment')) {
                updates.fulfillment_state = 'hold';
                updates.rto_status = 'at_risk';
            }

            const { error: updateError } = await db
                .from('orders')
                .update(updates)
                .eq('store_id', tenant.siteId)
                .eq('id', input.order_id);
            if (updateError) throw new Error('Order risk update failed');

            if (plan.actions.includes('request_cod_confirmation')) {
                await db
                    .from('cod_confirmation_requests')
                    .upsert({
                        site_id: tenant.siteId,
                        order_id: input.order_id,
                        status: 'requested',
                        provider: 'letbuyy_sandbox',
                        idempotency_key: `cod-confirm:${input.order_id}:${idempotencyKey}`,
                        request_payload: { mode: 'sandbox', risk_score: plan.risk_score, risk_level: plan.risk_level },
                        expires_at: updates.cod_expires_at as string,
                        request_id: tenant.requestId,
                        created_by: tenant.userId,
                        updated_by: tenant.userId,
                    }, { onConflict: 'site_id,order_id,idempotency_key' });
                await emitCodConfirmationRequestedEvent(db, {
                    siteId: tenant.siteId,
                    orderId: input.order_id,
                    requestId: tenant.requestId,
                    idempotencyKey: `cod.confirmation_requested:${tenant.siteId}:${input.order_id}:${idempotencyKey}`,
                });
            }

            await emitOrderEvent(db, {
                eventType: 'order.risk_assessed',
                order: { id: input.order_id, risk_score: plan.risk_score, risk_level: plan.risk_level },
                fallbackOrderId: input.order_id,
                siteId: tenant.siteId,
                actorId: tenant.userId,
                requestId: tenant.requestId,
            });
        }

        const responseBody = success({ assessment, plan });
        await idempotency.complete({
            id: claim.id,
            responseBody: jsonResponseBody(responseBody),
            statusCode: 200,
            resourceType: 'order_risk_assessment',
            resourceId: String((assessment as Record<string, unknown>).id || ''),
        });

        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

// Pre-launch hardening (Stream F1/F2) — when a COD order is cancelled (reject / timeout / auto-expiry),
// release the reserved inventory and restore any redeemed gift-card balance, mirroring the canonical
// PATCH /:id cancel path (orders.ts). Both are best-effort, idempotent SECURITY DEFINER RPCs (db.rpc,
// not money-table writes — canonical-ledger compliant); neither blocks the cancellation.
async function releaseCancelledCodOrderResources(
    db: ReturnType<typeof getSupabaseAdmin>,
    orderId: string,
    tenant: { siteId: string; userId?: string | null; requestId?: string | null },
): Promise<void> {
    try {
        const { error } = await db.rpc('release_order_inventory_with_ledger', {
            p_order_id: orderId,
            p_actor_id: tenant.userId ?? null,
            p_request_id: tenant.requestId ?? null,
            p_release_reason: 'cod_cancelled',
        });
        if (error) throw new Error(error.message);
    } catch (releaseError) {
        console.warn(JSON.stringify({ level: 'warn', event: 'cod_inventory_release_failed', order_id: orderId, error: String(releaseError) }));
    }
    try {
        await db.rpc('restore_gift_card_on_refund', {
            p_store_id: tenant.siteId,
            p_order_id: orderId,
            p_actor_id: tenant.userId ?? null,
            p_request_id: tenant.requestId ?? null,
        });
    } catch (restoreError) {
        console.warn(JSON.stringify({ level: 'warn', event: 'cod_gift_card_restore_failed', order_id: orderId, error: String(restoreError) }));
    }
    // F-LOY-4 — loyalty points redeemed on a cancelled COD order come back too. Same event, same
    // shape, same place as the gift-card restore above.
    await tryRestoreRedeemedLoyalty(db, { ...tenant, orderId });
}

orderCodRouter.post('/:id/cod/confirm', validate('json', CodConfirmationSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as { idempotency_key: string; confirmed?: boolean; reply_text?: string };
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.cod.confirm:${orderId}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(recordValue(claim.responseBody), replayHttpStatus(claim.statusCode));
    }

    try {
        const now = new Date().toISOString();
        const confirmed = body.confirmed !== false;
        await db
            .from('cod_confirmation_requests')
            .update({
                status: confirmed ? 'confirmed' : 'rejected',
                confirmed_at: confirmed ? now : null,
                response_payload: { reply_text: body.reply_text || null, confirmed },
                updated_by: tenant.userId,
            })
            .eq('site_id', tenant.siteId)
            .eq('order_id', orderId)
            .in('status', ['requested', 'expired']);

        const updates: Record<string, unknown> = confirmed
            ? {
                status: 'confirmed',
                cod_confirmation_status: 'confirmed',
                cod_confirmed_at: now,
                fulfillment_state: 'unfulfilled',
                updated_by: tenant.userId,
            }
            : {
                status: 'cancelled',
                cod_confirmation_status: 'rejected',
                fulfillment_state: 'cancelled',
                updated_by: tenant.userId,
            };
        const { data, error } = await db
            .from('orders')
            .update(updates)
            .eq('store_id', tenant.siteId)
            .eq('id', orderId)
            .select('*')
            .single();
        if (error || !data) throw new Error('COD confirmation update failed');

        await emitOrderEvent(db, {
            eventType: confirmed ? 'order.confirmed_cod' : 'order.cancelled',
            order: data,
            fallbackOrderId: orderId,
            siteId: tenant.siteId,
            actorId: tenant.userId,
            requestId: tenant.requestId,
        });

        // LB-10 — a rejected COD confirmation cancels the order; notify the customer (best-effort).
        if (!confirmed) {
            await releaseCancelledCodOrderResources(db, orderId, tenant);
        }

        const responseBody = success({ order: normalizeOrderRecord(data as unknown as OrderSourceRow), confirmed });
        await idempotency.complete({
            id: claim.id,
            responseBody: jsonResponseBody(responseBody),
            statusCode: 200,
            resourceType: 'order',
            resourceId: orderId,
        });
        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});

orderCodRouter.post('/:id/cod/timeout', validate('json', CodTimeoutSchema), async (c) => {
    const orderId = c.req.param('id');
    const body = c.get('validatedBody') as { idempotency_key: string; reason: string };
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const idempotency = new IdempotencyExecutionAdapter(db);
    const claim = await idempotency.begin({
        siteId: tenant.siteId,
        key: body.idempotency_key,
        scope: `orders.cod.timeout:${orderId}`,
        requestBody: body,
        requestId: tenant.requestId,
    });

    if (claim.kind === 'replay') {
        return c.json(recordValue(claim.responseBody), replayHttpStatus(claim.statusCode));
    }

    try {
        const now = new Date().toISOString();
        await db
            .from('cod_confirmation_requests')
            .update({
                status: 'expired',
                response_payload: { reason: body.reason },
                updated_by: tenant.userId,
            })
            .eq('site_id', tenant.siteId)
            .eq('order_id', orderId)
            .eq('status', 'requested');

        const { data, error } = await db
            .from('orders')
            .update({
                status: 'cancelled',
                cod_confirmation_status: 'expired',
                fulfillment_state: 'cancelled',
                rto_status: 'at_risk',
                notes: body.reason,
                updated_by: tenant.userId,
                updated_at: now,
            })
            .eq('store_id', tenant.siteId)
            .eq('id', orderId)
            .in('status', ['pending_cod', 'pending'])
            .select('*')
            .single();
        if (error || !data) throw new Error('COD timeout update failed');

        await emitOrderEvent(db, {
            eventType: 'order.cancelled',
            order: data,
            fallbackOrderId: orderId,
            siteId: tenant.siteId,
            actorId: tenant.userId,
            requestId: tenant.requestId,
        });

        // The cancellation and its email intent commit together in migration402.
        await releaseCancelledCodOrderResources(db, orderId, tenant);

        const responseBody = success({ order: normalizeOrderRecord(data as unknown as OrderSourceRow), reason: body.reason });
        await idempotency.complete({
            id: claim.id,
            responseBody: jsonResponseBody(responseBody),
            statusCode: 200,
            resourceType: 'order',
            resourceId: orderId,
        });
        return c.json(responseBody);
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }
});
