import { Hono } from 'hono';
import { z } from 'zod';
import {
    SettlementIngestSchema,
    planSettlementLedgerPosting,
    type SettlementIngestInput,
    type SettlementLedgerLine,
} from '@letbuyy/billing-core';
import type { Env } from '../index';
import { isLivePASplitProviderReady } from '@letbuyy/payments';
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
    idempotency_key: string;
    settlement_reference: string;
    provider: string;
    provider_mode: 'sandbox' | 'live';
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

class SettlementPayoutConflict extends Error {}

function configured(value: string | undefined): boolean {
    return Boolean(value && !value.startsWith('SKIP_NEEDS_HUMAN_') && !value.includes('replace-with'));
}

function stableJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

export function assertLiveSettlementReady(env: Env, input: SettlementIngestInput) {
    if (input.provider_mode !== 'live') return;

    if (input.rail === 'cod_remittance') {
        if (input.provider === 'cod' || input.provider === 'manual') return;
        throw new HumanRequiredError('Live COD remittance records must use the COD or manual provider classification.');
    }

    // Easy Split is researched as a candidate, but this runtime has no Cashfree-specific
    // split/settlement execution and reconciliation adapter. Do not let a settlement row fall
    // through to the Razorpay Route payout path merely because Cashfree credentials exist.
    if (input.provider === 'cashfree') {
        throw new HumanRequiredError('Cashfree Easy Split live settlement is unavailable until its provider-specific execution and reconciliation adapter is implemented.');
    }

    if (input.rail === 'pa_split'
        && input.provider === 'razorpay_route'
        && isLivePASplitProviderReady('razorpay_route', {
            razorpay_route: env.RAZORPAY_ROUTE_LIVE_APPROVAL_REFERENCE,
        }, configured(env.RAZORPAY_ROUTE_ACCOUNT_ID)
            && configured(env.RAZORPAY_KEY_ID)
            && configured(env.RAZORPAY_ROUTE_KEY_SECRET || env.RAZORPAY_KEY_SECRET))) {
        return;
    }

    // [HUMAN-REQUIRED] HR-PA-SPLIT-LIVE: the provider-specific evidence reference represents
    // separately reviewed provider onboarding and legal acceptance; its presence is not itself proof.
    throw new HumanRequiredError('Live PA settlement eligibility, contract review, and provider setup are required before live settlement ingest can be enabled.');
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

function dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function toLedgerRpcLines(lines: readonly SettlementLedgerLine[]) {
    return lines.map((line) => ({
        account_code: line.account_code,
        side: line.side,
        amount_minor: line.amount_minor,
        memo: line.memo,
    }));
}

async function loadExistingSettlement(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        idempotencyKey: string;
        provider: string;
        settlementReference: string;
    },
): Promise<{ row: SettlementRow; dedupeKey: 'idempotency_key' | 'provider_reference' } | null> {
    const byIdempotency = await db
        .from('settlements')
        .select('*')
        .eq('site_id', input.siteId)
        .eq('idempotency_key', input.idempotencyKey)
        .is('deleted_at', null)
        .maybeSingle();

    if (byIdempotency.error) throw new Error(`Settlement idempotency lookup failed: ${byIdempotency.error.message}`);
    if (byIdempotency.data) {
        return { row: byIdempotency.data as unknown as SettlementRow, dedupeKey: 'idempotency_key' };
    }

    const byProviderReference = await db
        .from('settlements')
        .select('*')
        .eq('site_id', input.siteId)
        .eq('provider', input.provider)
        .eq('settlement_reference', input.settlementReference)
        .is('deleted_at', null)
        .maybeSingle();

    if (byProviderReference.error) {
        throw new Error(`Settlement provider reference lookup failed: ${byProviderReference.error.message}`);
    }
    if (byProviderReference.data) {
        return { row: byProviderReference.data as unknown as SettlementRow, dedupeKey: 'provider_reference' };
    }

    return null;
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

async function createSettlementPayoutWithEffects(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        userId: string | null;
        settlement: SettlementRow;
        amountMinor: number;
        requestId?: string | null;
    },
): Promise<JsonRecord> {
    const { data, error } = await db.rpc('create_settlement_payout_with_effects', {
        p_site_id: input.siteId,
        p_settlement_id: input.settlement.id,
        p_expected_amount_minor: input.amountMinor,
        p_available_on: dateOnly(new Date()),
        p_actor_id: input.userId,
        p_request_id: input.requestId || null,
    });
    if (error?.code === '23505' || error?.code === '23514') throw new SettlementPayoutConflict();
    if (error || !data) throw new Error(`Settlement payout transaction failed: ${error?.message || 'unknown error'}`);
    return data as JsonRecord;
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
    const existing = await loadExistingSettlement(db, {
        siteId: tenant.siteId,
        idempotencyKey: body.idempotency_key,
        provider: body.provider,
        settlementReference: body.settlement_reference,
    });
    const plan = planSettlementLedgerPosting(body);
    const status = plan.recon_break_minor === 0 ? 'recorded' : 'break_detected';
    let settlementRow: SettlementRow;
    if (existing) {
        const prior = existing.row;
        if (prior.settlement_reference !== body.settlement_reference
            || prior.provider !== body.provider || prior.provider_mode !== body.provider_mode || prior.rail !== body.rail
            || prior.currency !== 'INR'
            || Number(prior.gross_amount_minor) !== plan.gross_amount_minor
            || Number(prior.platform_fee_minor) !== plan.platform_fee_minor
            || Number(prior.gst_minor) !== plan.gst_minor
            || Number(prior.net_amount_minor) !== plan.net_amount_minor
            || Number(prior.reserve_minor) !== plan.reserve_minor
            || Number(prior.recon_break_minor) !== plan.recon_break_minor
            || stableJson(prior.metadata || {}) !== stableJson(body.metadata || {})) {
            return c.json({
                success: false,
                error: { code: 'CONFLICT', message: 'Settlement key or provider reference is already bound to different settlement amounts.' },
            }, 409);
        }
        settlementRow = prior;
    } else {
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
        settlementRow = settlement as unknown as SettlementRow;
    }
    let ledgerTransactionId: string | null = settlementRow.ledger_transaction_id || null;
    let updatedSettlement: SettlementRow = settlementRow;
    if (plan.recon_break_minor === 0 && plan.balanced) {
        ledgerTransactionId = await postSettlementLedgerTransaction(db, {
            siteId: tenant.siteId,
            sourceType: plan.source_type,
            sourceId: settlementRow.id,
            idempotencyKey: `settlement:${settlementRow.idempotency_key}`,
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
        updatedSettlement = updated.data as unknown as SettlementRow;
    }

    if (plan.recon_break_minor !== 0) {
        const priorBreak = await db.from('recon_breaks')
            .select('id, amount_minor')
            .eq('site_id', tenant.siteId)
            .eq('settlement_id', settlementRow.id)
            .eq('break_type', 'amount_mismatch')
            .is('deleted_at', null)
            .maybeSingle();
        if (priorBreak.error) throw new Error(`Settlement break lookup failed: ${priorBreak.error.message}`);
        if (priorBreak.data) {
            if (Number(priorBreak.data.amount_minor) !== Math.abs(plan.recon_break_minor)) {
                return c.json({ success: false, error: { code: 'CONFLICT', message: 'Settlement reconciliation break differs from the stored break.' } }, 409);
            }
        } else {
            const { error: breakError } = await db.from('recon_breaks').insert({
                site_id: tenant.siteId,
                settlement_id: settlementRow.id,
                break_type: 'amount_mismatch',
                status: 'open',
                currency: 'INR',
                amount_minor: Math.abs(plan.recon_break_minor),
                suspense_account_code: 'reserve',
                explanation: 'Canonical settlement ledger posting skipped until the provider mismatch is reconciled.',
                metadata: { recon_break_minor: plan.recon_break_minor },
                created_by: tenant.userId,
                updated_by: tenant.userId,
            });
            if (breakError) throw new Error(`Settlement break create failed: ${breakError.message}`);
        }
    }

    let payout: JsonRecord | null = null;
    if (plan.recon_break_minor === 0 && plan.net_amount_minor > 0
        && body.rail === 'pa_split' && body.provider === 'razorpay_route') {
        try {
            payout = await createSettlementPayoutWithEffects(db, {
                siteId: tenant.siteId,
                userId: tenant.userId,
                settlement: settlementRow,
                amountMinor: plan.net_amount_minor,
                requestId: c.req.header('X-Request-ID') || null,
            });
        } catch (error) {
            if (error instanceof SettlementPayoutConflict) {
                return c.json({ success: false, error: { code: 'CONFLICT', message: 'Payout instruction is bound to different settlement terms.' } }, 409);
            }
            throw error;
        }
    }

    await emitSettlementEvent(db, {
        siteId: tenant.siteId,
        aggregateId: settlementRow.id,
        eventType: 'settlement.recorded',
        idempotencyKey: `event:settlement.recorded:${settlementRow.id}`,
        requestId: c.req.header('X-Request-ID') || null,
        actorId: tenant.userId,
        payload: { amount: { amount_minor: plan.gross_amount_minor, currency: 'INR' } },
    });
    if (plan.recon_break_minor !== 0) {
        await emitSettlementEvent(db, {
            siteId: tenant.siteId,
            aggregateId: settlementRow.id,
            eventType: 'settlement.recon.break_detected',
            idempotencyKey: `event:settlement.recon.break_detected:${settlementRow.id}`,
            requestId: c.req.header('X-Request-ID') || null,
            actorId: tenant.userId,
            payload: { amount: { amount_minor: Math.abs(plan.recon_break_minor), currency: 'INR' } },
        });
    }

    return c.json(success({
        settlement: serializeSettlement(updatedSettlement),
        ledger_transaction_id: ledgerTransactionId,
        payout,
        recon_break_minor: plan.recon_break_minor,
        replayed: Boolean(existing),
        ...(existing ? { dedupe_key: existing.dedupeKey } : {}),
    }), existing ? 200 : 201);
});

export default router;
