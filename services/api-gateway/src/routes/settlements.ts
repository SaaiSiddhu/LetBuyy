import { Hono } from 'hono';
import { z } from 'zod';
import {
    SettlementIngestSchema,
    planPayoutReleaseLedgerPosting,
    planSettlementLedgerPosting,
    type SettlementIngestInput,
    type SettlementLedgerLine,
} from '@letbuyy/billing-core';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { HumanRequiredError } from '../lib/errors';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

const SettlementQuerySchema = z.object({
    store_id: z.string().uuid(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

type SettlementQuery = z.infer<typeof SettlementQuerySchema>;
type JsonRecord = Record<string, unknown>;
type SettlementEventType = 'settlement.recorded' | 'settlement.recon.break_detected' | 'payout.scheduled';

interface SettlementRow extends JsonRecord {
    id: string;
    site_id: string;
    settlement_reference: string;
    provider: string;
    provider_mode: 'mock' | 'sandbox' | 'live';
    rail: 'pa_split' | 'cod_remittance';
    status: 'recorded' | 'break_detected' | 'failed';
    currency: 'INR';
    gross_amount_minor: number;
    platform_fee_minor: number;
    gst_minor: number;
    net_amount_minor: number;
    reserve_minor: number;
    recon_break_minor: number;
    ledger_transaction_id?: string | null;
    metadata?: JsonRecord | null;
    created_at?: string | null;
    updated_at?: string | null;
}

function configured(value: string | undefined): boolean {
    return Boolean(value && !value.startsWith('SKIP_NEEDS_HUMAN_') && !value.includes('replace-with'));
}

function assertLiveSettlementReady(env: Env, input: SettlementIngestInput) {
    if (input.provider_mode !== 'live') return;
    if (input.provider === 'manual') return;
    if (
        configured(env.RAZORPAY_ROUTE_ACCOUNT_ID)
        && configured(env.RAZORPAY_KEY_ID)
        && configured(env.RAZORPAY_ROUTE_KEY_SECRET || env.RAZORPAY_KEY_SECRET)
    ) {
        return;
    }

    // [HUMAN-REQUIRED] HR-PA-SPLIT-LIVE: live PA settlement feeds and Route/Easy-Split credentials require provider onboarding and legal approval.
    throw new HumanRequiredError('Live PA settlement setup is required before live settlement ingest can be enabled.');
}

function settlementSetupError(c: import('hono').Context<{ Bindings: Env }>) {
    return c.json({
        error: {
            code: 'SETTLEMENT_PROVIDER_SETUP_REQUIRED',
            message: 'Settlement provider setup is not enabled for this environment.',
        },
    }, 503);
}

function serializeSettlement(row: SettlementRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        settlement_reference: row.settlement_reference,
        provider: row.provider,
        provider_mode: row.provider_mode,
        rail: row.rail,
        status: row.status,
        currency: row.currency || 'INR',
        gross_amount_minor: Number(row.gross_amount_minor || 0),
        platform_fee_minor: Number(row.platform_fee_minor || 0),
        gst_minor: Number(row.gst_minor || 0),
        net_amount_minor: Number(row.net_amount_minor || 0),
        reserve_minor: Number(row.reserve_minor || 0),
        recon_break_minor: Number(row.recon_break_minor || 0),
        ledger_transaction_id: row.ledger_transaction_id || null,
        metadata: row.metadata || {},
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
    };
}

function toLedgerRpcLines(lines: readonly SettlementLedgerLine[]) {
    return lines.map((line) => ({
        account_code: line.account_code,
        side: line.side,
        amount_minor: line.amount_minor,
        memo: line.memo,
    }));
}

async function postSettlementLedgerTransaction(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        sourceType: 'settlement' | 'cod_remittance' | 'payout';
        sourceId: string;
        idempotencyKey: string;
        lines: readonly SettlementLedgerLine[];
        metadata: JsonRecord;
        requestId?: string | null;
    },
): Promise<string> {
    const { data, error } = await db.rpc('post_settlement_ledger_transaction', {
        p_site_id: input.siteId,
        p_source_type: input.sourceType,
        p_source_id: input.sourceId,
        p_idempotency_key: input.idempotencyKey,
        p_lines: toLedgerRpcLines(input.lines),
        p_metadata: input.metadata,
        p_request_id: input.requestId || null,
    });

    if (error || !data) throw new Error(`Settlement ledger post failed: ${error?.message || 'unknown error'}`);
    return String(data);
}

async function emitSettlementEvent(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        aggregateId: string;
        eventType: SettlementEventType;
        idempotencyKey: string;
        requestId?: string | null;
        actorId?: string | null;
        payload?: JsonRecord;
    },
) {
    await new EventExecutionAdapter(db).emitDomainEvent({
        storeId: input.siteId,
        aggregateType: input.eventType === 'payout.scheduled' ? 'payout' : 'settlement',
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: {
            site_id: input.siteId,
            settlement_id: input.eventType === 'payout.scheduled' ? undefined : input.aggregateId,
            payout_id: input.eventType === 'payout.scheduled' ? input.aggregateId : undefined,
            ...input.payload,
        },
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId || null,
        actorId: input.actorId || null,
    });
}

router.get('/:site', validate('query', SettlementQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as SettlementQuery;
    const requestedSiteId = c.req.param('site');
    if (requestedSiteId !== query.store_id) {
        return c.json({ error: { code: 'STORE_MISMATCH', message: 'Store query must match the settlement path.' } }, 400);
    }

    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const { data, error } = await db
        .from('settlements')
        .select('*, recon_breaks(*), payouts(*, payout_items(*))')
        .eq('site_id', tenant.siteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (error) throw new Error(`Settlement lookup failed: ${error.message}`);
    return c.json(success({ settlements: (data || []).map((row) => serializeSettlement(row as unknown as SettlementRow)) }));
});

router.post('/ingest', validate('json', SettlementIngestSchema), async (c) => {
    const body = c.get('validatedBody') as SettlementIngestInput;
    try {
        assertLiveSettlementReady(c.env, body);
    } catch (error) {
        if (error instanceof HumanRequiredError) return settlementSetupError(c);
        throw error;
    }

    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const existing = await db
        .from('settlements')
        .select('*')
        .eq('site_id', tenant.siteId)
        .eq('idempotency_key', body.idempotency_key)
        .is('deleted_at', null)
        .maybeSingle();

    if (existing.error) throw new Error(`Settlement idempotency lookup failed: ${existing.error.message}`);
    if (existing.data) return c.json(success({ settlement: serializeSettlement(existing.data as unknown as SettlementRow), replayed: true }));

    const plan = planSettlementLedgerPosting(body);
    const status = plan.recon_break_minor === 0 ? 'recorded' : 'break_detected';
    const { data: settlement, error: insertError } = await db
        .from('settlements')
        .insert({
            site_id: tenant.siteId,
            settlement_reference: body.settlement_reference,
            provider: body.provider,
            provider_mode: body.provider_mode,
            rail: body.rail,
            status,
            currency: 'INR',
            gross_amount_minor: plan.gross_amount_minor,
            platform_fee_minor: plan.platform_fee_minor,
            gst_minor: plan.gst_minor,
            net_amount_minor: plan.net_amount_minor,
            reserve_minor: plan.reserve_minor,
            recon_break_minor: plan.recon_break_minor,
            idempotency_key: body.idempotency_key,
            metadata: body.metadata,
            created_by: tenant.userId,
            updated_by: tenant.userId,
        })
        .select('*')
        .single();

    if (insertError || !settlement) throw new Error(`Settlement create failed: ${insertError?.message || 'unknown error'}`);
    const settlementRow = settlement as unknown as SettlementRow;
    const ledgerTransactionId = await postSettlementLedgerTransaction(db, {
        siteId: tenant.siteId,
        sourceType: plan.source_type,
        sourceId: settlementRow.id,
        idempotencyKey: `settlement:${body.idempotency_key}`,
        lines: plan.lines,
        metadata: {
            provider: body.provider,
            provider_mode: body.provider_mode,
            rail: body.rail,
            settlement_reference: body.settlement_reference,
            no_custody: true,
        },
        requestId: c.req.header('X-Request-ID') || null,
    });

    const updated = await db
        .from('settlements')
        .update({ ledger_transaction_id: ledgerTransactionId, updated_by: tenant.userId })
        .eq('id', settlementRow.id)
        .eq('site_id', tenant.siteId)
        .select('*')
        .single();
    if (updated.error || !updated.data) throw new Error(`Settlement ledger link failed: ${updated.error?.message || 'unknown error'}`);

    if (plan.recon_break_minor !== 0) {
        const { error: breakError } = await db.from('recon_breaks').insert({
            site_id: tenant.siteId,
            settlement_id: settlementRow.id,
            break_type: 'amount_mismatch',
            status: 'explained',
            currency: 'INR',
            amount_minor: Math.abs(plan.recon_break_minor),
            suspense_account_code: 'reserve',
            explanation: 'Explained through reserve suspense account in the canonical settlement ledger posting.',
            metadata: { recon_break_minor: plan.recon_break_minor },
            created_by: tenant.userId,
            updated_by: tenant.userId,
        });
        if (breakError) throw new Error(`Settlement break create failed: ${breakError.message}`);
    }

    let payout: JsonRecord | null = null;
    if (plan.net_amount_minor > 0 && body.rail === 'pa_split') {
        const { data: payoutRow, error: payoutError } = await db
            .from('payouts')
            .insert({
                site_id: tenant.siteId,
                settlement_id: settlementRow.id,
                status: 'scheduled',
                provider: body.provider,
                provider_mode: body.provider_mode,
                rail: 'razorpay_route',
                currency: 'INR',
                amount_minor: plan.net_amount_minor,
                idempotency_key: `payout:${body.idempotency_key}`,
                requires_step_up: true,
                maker_actor_id: tenant.userId,
                metadata: { no_custody: true, instruction_only: true },
                created_by: tenant.userId,
                updated_by: tenant.userId,
            })
            .select('*')
            .single();
        if (payoutError || !payoutRow) throw new Error(`Payout schedule create failed: ${payoutError?.message || 'unknown error'}`);

        const payoutLines = planPayoutReleaseLedgerPosting({
            payoutReference: String(payoutRow.id),
            amountMinor: plan.net_amount_minor,
        });
        const { error: itemError } = await db.from('payout_items').insert({
            site_id: tenant.siteId,
            payout_id: payoutRow.id,
            settlement_id: settlementRow.id,
            source_type: 'settlement',
            source_id: settlementRow.id,
            currency: 'INR',
            amount_minor: plan.net_amount_minor,
            ledger_preview: { lines: payoutLines },
            created_by: tenant.userId,
            updated_by: tenant.userId,
        });
        if (itemError) throw new Error(`Payout item create failed: ${itemError.message}`);

        payout = payoutRow as JsonRecord;
        await emitSettlementEvent(db, {
            siteId: tenant.siteId,
            aggregateId: String(payoutRow.id),
            eventType: 'payout.scheduled',
            idempotencyKey: `event:payout.scheduled:${payoutRow.id}`,
            requestId: c.req.header('X-Request-ID') || null,
            actorId: tenant.userId,
            payload: { amount: plan.net_amount_minor },
        });
    }

    await emitSettlementEvent(db, {
        siteId: tenant.siteId,
        aggregateId: settlementRow.id,
        eventType: 'settlement.recorded',
        idempotencyKey: `event:settlement.recorded:${settlementRow.id}`,
        requestId: c.req.header('X-Request-ID') || null,
        actorId: tenant.userId,
        payload: { amount: plan.gross_amount_minor },
    });
    if (plan.recon_break_minor !== 0) {
        await emitSettlementEvent(db, {
            siteId: tenant.siteId,
            aggregateId: settlementRow.id,
            eventType: 'settlement.recon.break_detected',
            idempotencyKey: `event:settlement.recon.break_detected:${settlementRow.id}`,
            requestId: c.req.header('X-Request-ID') || null,
            actorId: tenant.userId,
            payload: { amount: Math.abs(plan.recon_break_minor) },
        });
    }

    return c.json(success({
        settlement: serializeSettlement(updated.data as unknown as SettlementRow),
        ledger_transaction_id: ledgerTransactionId,
        payout,
        recon_break_minor: plan.recon_break_minor,
    }), 201);
});

export default router;
