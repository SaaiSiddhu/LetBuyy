import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { stepUpErrorBody, verifySensitiveActionStepUp } from '../lib/security-controls';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';
import {
    createPayoutTransferAdapter,
    PayoutProviderUnavailable,
    type MerchantPayoutRail,
    type PayoutTransferMode,
} from '@letbuyy/infrastructure/payout-transfer-adapter';
import {
    planPayoutReleaseLedgerPosting,
    type SettlementLedgerLine,
} from '@letbuyy/billing-core';

const router = new Hono<{ Bindings: Env }>();

const StoreQuerySchema = z.object({
    store_id: z.string().uuid(),
});

const ListPayoutsQuerySchema = StoreQuerySchema.extend({
    status: z.enum(['pending', 'processing', 'released', 'failed']).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
});

const CreatePayoutStatementSchema = StoreQuerySchema.extend({
    idempotency_key: z.string().min(8).max(160),
    period_start: z.string().date().optional(),
    period_end: z.string().date().optional(),
});

const SettlePayoutStatementSchema = z.object({
    idempotency_key: z.string().min(8).max(160),
});

type ListPayoutsQuery = z.infer<typeof ListPayoutsQuerySchema>;
type CreatePayoutStatementInput = z.infer<typeof CreatePayoutStatementSchema>;
type SettlePayoutStatementInput = z.infer<typeof SettlePayoutStatementSchema>;

type JsonRecord = Record<string, unknown>;

interface PayoutStatementRow extends JsonRecord {
    id: string;
    site_id: string;
    statement_number: string;
    status: 'pending' | 'processing' | 'released' | 'failed';
    provider: string;
    provider_mode: 'sandbox' | 'live';
    rail: MerchantPayoutRail;
    currency: string;
    gross_amount_minor: number;
    platform_fee_minor: number;
    tax_minor: number;
    net_amount_minor: number;
    period_start?: string | null;
    period_end?: string | null;
    available_on?: string | null;
    processing_at?: string | null;
    released_at?: string | null;
    failed_at?: string | null;
    utr?: string | null;
    provider_reference?: string | null;
    failure_reason?: string | null;
    canonical_ledger_transaction_id?: string | null;
    release_ledger_transaction_id?: string | null;
    metadata?: JsonRecord | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

interface PaidOrderRow extends JsonRecord {
    id: string;
    order_number?: string | null;
    total?: number | string | null;
    currency?: string | null;
    created_at?: string | null;
}

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function minorFromMajor(value: unknown): number {
    return Math.max(0, Math.round(numberValue(value) * 100));
}

function dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): string {
    const copy = new Date(value.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return dateOnly(copy);
}

function payoutMode(env: Env): PayoutTransferMode {
    return env.RAZORPAY_ROUTE_MODE === 'live' ? 'live' : 'sandbox';
}

function payoutRail(): MerchantPayoutRail {
    return 'razorpayx';
}

function payoutProviderConfigured(env: Env): boolean {
    const envRecord = env as Env & Record<string, string | undefined>;
    return Boolean(
        env.RAZORPAY_KEY_ID
        && (env.RAZORPAY_ROUTE_KEY_SECRET || env.RAZORPAY_KEY_SECRET)
        && env.RAZORPAY_ROUTE_ACCOUNT_ID
        && envRecord.RAZORPAY_ROUTE_PROVIDER_ENABLED === 'true',
    );
}

function statementNumber(siteId: string, now: Date): string {
    return `PYT-${siteId.replace(/-/g, '').slice(0, 8).toUpperCase()}-${now.getTime()}`;
}

function serializePayout(row: PayoutStatementRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        statement_number: row.statement_number,
        status: row.status,
        provider: row.provider,
        provider_mode: row.provider_mode,
        rail: row.rail,
        currency: row.currency || 'INR',
        gross_amount_minor: Number(row.gross_amount_minor || 0),
        platform_fee_minor: Number(row.platform_fee_minor || 0),
        tax_minor: Number(row.tax_minor || 0),
        net_amount_minor: Number(row.net_amount_minor || 0),
        period_start: row.period_start || null,
        period_end: row.period_end || null,
        available_on: row.available_on || null,
        processing_at: row.processing_at || null,
        released_at: row.released_at || null,
        failed_at: row.failed_at || null,
        utr: row.utr || null,
        provider_reference: row.provider_reference || null,
        failure_reason: row.failure_reason || null,
        canonical_ledger_transaction_id: row.canonical_ledger_transaction_id || null,
        release_ledger_transaction_id: row.release_ledger_transaction_id || null,
        metadata: row.metadata || {},
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        deleted_at: row.deleted_at || null,
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

async function postCanonicalPayoutLedger(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        sourceType: 'settlement' | 'payout';
        sourceId: string;
        idempotencyKey: string;
        lines: readonly SettlementLedgerLine[];
        metadata: JsonRecord;
    },
): Promise<string> {
    const { data, error } = await db.rpc('post_settlement_ledger_transaction', {
        p_site_id: input.siteId,
        p_source_type: input.sourceType,
        p_source_id: input.sourceId,
        p_idempotency_key: input.idempotencyKey,
        p_lines: toLedgerRpcLines(input.lines),
        p_metadata: input.metadata,
        p_request_id: null,
    });

    if (error || !data) throw new Error(`Payout canonical ledger post failed: ${error?.message || 'unknown error'}`);
    return String(data);
}

function payoutProviderUnavailableBody(error: PayoutProviderUnavailable) {
    return {
        success: false,
        error: {
            code: error.code,
            message: error.message,
        },
    };
}

function planPayoutFeeAssessmentLedger(input: {
    statementNumber: string;
    platformFeeMinor: number;
    taxMinor: number;
}): SettlementLedgerLine[] {
    const totalFeeMinor = Number(input.platformFeeMinor || 0) + Number(input.taxMinor || 0);
    if (totalFeeMinor <= 0) return [];

    const lines: SettlementLedgerLine[] = [
        {
            account_code: 'merchant_payable',
            side: 'debit',
            amount_minor: totalFeeMinor,
            memo: `Merchant fee assessment ${input.statementNumber}`,
        },
    ];
    if (input.platformFeeMinor > 0) {
        lines.push({
            account_code: 'platform_revenue',
            side: 'credit',
            amount_minor: input.platformFeeMinor,
            memo: `Platform fee assessment ${input.statementNumber}`,
        });
    }
    if (input.taxMinor > 0) {
        lines.push({
            account_code: 'gst_payable',
            side: 'credit',
            amount_minor: input.taxMinor,
            memo: `GST fee assessment ${input.statementNumber}`,
        });
    }
    return lines;
}

function summarize(siteId: string, rows: PayoutStatementRow[]) {
    const totals = rows.reduce((acc, row) => {
        const key = `${row.status}_minor` as keyof typeof acc;
        acc[key] += Number(row.net_amount_minor || 0);
        return acc;
    }, {
        pending_minor: 0,
        processing_minor: 0,
        released_minor: 0,
        failed_minor: 0,
    });
    const next = rows
        .filter((row) => row.status === 'pending' || row.status === 'processing')
        .sort((a, b) => String(a.available_on || a.created_at || '').localeCompare(String(b.available_on || b.created_at || '')))[0] || null;

    return {
        site_id: siteId,
        currency: 'INR',
        ...totals,
        next_payout: next ? serializePayout(next) : null,
    };
}

async function loadPayoutRows(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    status?: string,
    limit = 25,
): Promise<PayoutStatementRow[]> {
    let query = db
        .from('payout_statements')
        .select('*')
        .eq('site_id', siteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(`Payout statement lookup failed: ${error.message}`);
    return (data || []) as unknown as PayoutStatementRow[];
}

async function loadExistingSourceOrderIds(db: ReturnType<typeof getSupabaseAdmin>, siteId: string): Promise<Set<string>> {
    const { data, error } = await db
        .from('payout_statements')
        .select('metadata')
        .eq('site_id', siteId)
        .is('deleted_at', null);

    if (error) throw new Error(`Payout source lookup failed: ${error.message}`);

    const ids = new Set<string>();
    for (const row of (data || []) as Array<{ metadata?: unknown }>) {
        const sourceOrderIds = asRecord(row.metadata).source_order_ids;
        if (!Array.isArray(sourceOrderIds)) continue;
        for (const value of sourceOrderIds) {
            const id = textValue(value);
            if (id) ids.add(id);
        }
    }
    return ids;
}

async function loadPaidOrders(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: CreatePayoutStatementInput,
): Promise<PaidOrderRow[]> {
    let query = db
        .from('orders')
        .select('id, order_number, total, currency, created_at')
        .eq('store_id', input.store_id)
        .eq('payment_status', 'paid')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (input.period_start) query = query.gte('created_at', `${input.period_start}T00:00:00.000Z`);
    if (input.period_end) query = query.lte('created_at', `${input.period_end}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(`Payout source order lookup failed: ${error.message}`);
    return (data || []) as unknown as PaidOrderRow[];
}

async function loadCommissionBps(db: ReturnType<typeof getSupabaseAdmin>, siteId: string): Promise<number> {
    const { data, error } = await db
        .from('commission_schedules')
        .select('commission_bps')
        .eq('site_id', siteId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`Commission schedule lookup failed: ${error.message}`);
    return Number((data as { commission_bps?: number } | null)?.commission_bps ?? 300);
}

router.get('/', validate('query', ListPayoutsQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as ListPayoutsQuery;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const rows = await loadPayoutRows(db, tenant.siteId, query.status, query.limit);

    return c.json(success({
        payouts: rows.map(serializePayout),
        summary: summarize(tenant.siteId, rows),
    }));
});

router.get('/summary', validate('query', StoreQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as z.infer<typeof StoreQuerySchema>;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const rows = await loadPayoutRows(db, tenant.siteId, undefined, 100);

    return c.json(success(summarize(tenant.siteId, rows)));
});

router.post('/', validate('json', CreatePayoutStatementSchema), async (c) => {
    const body = c.get('validatedBody') as CreatePayoutStatementInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const { data: existing, error: existingError } = await db
        .from('payout_statements')
        .select('*')
        .eq('site_id', tenant.siteId)
        .eq('idempotency_key', body.idempotency_key)
        .is('deleted_at', null)
        .maybeSingle();

    if (existingError) throw new Error(`Payout idempotency lookup failed: ${existingError.message}`);
    if (existing) return c.json(success(serializePayout(existing as unknown as PayoutStatementRow)));

    const paidOrders = await loadPaidOrders(db, body);
    const alreadyIncluded = await loadExistingSourceOrderIds(db, tenant.siteId);
    const eligibleOrders = paidOrders.filter((order) => !alreadyIncluded.has(order.id));
    const grossAmountMinor = eligibleOrders.reduce((sum, order) => sum + minorFromMajor(order.total), 0);

    if (grossAmountMinor <= 0) {
        return c.json({
            success: false,
            error: {
                code: 'NO_PAYOUTABLE_ORDERS',
                message: 'No paid orders are available for payout yet.',
            },
        }, 422);
    }

    const commissionBps = await loadCommissionBps(db, tenant.siteId);
    const platformFeeMinor = Math.round(grossAmountMinor * commissionBps / 10000);
    const taxMinor = Math.round(platformFeeMinor * 1800 / 10000);
    const netAmountMinor = Math.max(0, grossAmountMinor - platformFeeMinor - taxMinor);
    const now = new Date();
    const mode = payoutMode(c.env);
    const rail = payoutRail();
    const sourceOrderIds = eligibleOrders.map((order) => order.id);

    const { data: inserted, error } = await db
        .from('payout_statements')
        .insert({
            site_id: tenant.siteId,
            statement_number: statementNumber(tenant.siteId, now),
            status: 'pending',
            provider: rail,
            provider_mode: mode,
            rail,
            currency: 'INR',
            gross_amount_minor: grossAmountMinor,
            platform_fee_minor: platformFeeMinor,
            tax_minor: taxMinor,
            net_amount_minor: netAmountMinor,
            period_start: body.period_start || null,
            period_end: body.period_end || null,
            available_on: addDays(now, 2),
            idempotency_key: body.idempotency_key,
            metadata: {
                source_order_ids: sourceOrderIds,
                source_order_numbers: eligibleOrders.map((order) => textValue(order.order_number)).filter(Boolean),
                commission_bps: commissionBps,
                gst_bps: 1800,
            },
            created_by: tenant.userId,
            updated_by: tenant.userId,
        })
        .select('*')
        .single();

    if (error || !inserted) throw new Error(`Payout statement create failed: ${error?.message || 'unknown error'}`);
    const statement = inserted as unknown as PayoutStatementRow;

    const { error: walletCreditError } = await db.from('wallet_ledger_entries').insert({
        site_id: tenant.siteId,
        payout_statement_id: statement.id,
        entry_type: 'payout_credit',
        direction: 'credit',
        status: 'pending',
        currency: 'INR',
        amount_minor: netAmountMinor,
        available_on: statement.available_on || null,
        reference_type: 'payout_statement',
        reference_id: statement.id,
        description: `Payout ${statement.statement_number} pending settlement`,
        idempotency_key: `payout-credit:${statement.id}`,
        metadata: { source_order_ids: sourceOrderIds },
        created_by: tenant.userId,
        updated_by: tenant.userId,
    }).select('id').single();
    if (walletCreditError) throw new Error(`Payout wallet credit failed: ${walletCreditError.message}`);

    let canonicalLedgerTransactionId: string | null = null;
    const feeAssessmentLines = planPayoutFeeAssessmentLedger({
        statementNumber: statement.statement_number,
        platformFeeMinor,
        taxMinor,
    });
    if (feeAssessmentLines.length > 0) {
        canonicalLedgerTransactionId = await postCanonicalPayoutLedger(db, {
            siteId: tenant.siteId,
            sourceType: 'settlement',
            sourceId: statement.id,
            idempotencyKey: `payout-fee-assessment:${statement.id}`,
            lines: feeAssessmentLines,
            metadata: {
                compatibility_table: 'payout_statements',
                statement_number: statement.statement_number,
                ledger_role: 'fee_assessment',
            },
        });
        await db
            .from('payout_statements')
            .update({ canonical_ledger_transaction_id: canonicalLedgerTransactionId, updated_by: tenant.userId })
            .eq('id', statement.id)
            .eq('site_id', tenant.siteId);
    }

    return c.json(success(serializePayout({ ...statement, canonical_ledger_transaction_id: canonicalLedgerTransactionId })), 201);
});

router.get('/:id', async (c) => {
    const payoutId = c.req.param('id');
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('payout_statements')
        .select('*')
        .eq('id', payoutId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`Payout statement lookup failed: ${error.message}`);
    if (!data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payout not found' } }, 404);
    }

    const statement = data as unknown as PayoutStatementRow;
    await resolveTenantContextForOwnedSite(c, statement.site_id);

    return c.json(success(serializePayout(statement)));
});

router.post('/:id/settle', validate('json', SettlePayoutStatementSchema), async (c) => {
    const payoutId = c.req.param('id');
    const body = c.get('validatedBody') as SettlePayoutStatementInput;
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('payout_statements')
        .select('*')
        .eq('id', payoutId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`Payout statement lookup failed: ${error.message}`);
    if (!data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payout not found' } }, 404);
    }

    const statement = data as unknown as PayoutStatementRow;
    const tenant = await resolveTenantContextForOwnedSite(c, statement.site_id);
    if (statement.status === 'released') return c.json(success(serializePayout(statement)));
    if (statement.status !== 'pending' && statement.status !== 'processing') {
        return c.json({ success: false, error: { code: 'PAYOUT_NOT_SETTLEABLE', message: 'This payout cannot be settled.' } }, 409);
    }

    const stepUp = verifySensitiveActionStepUp({
        action: 'payout.release',
        actorId: tenant.userId,
        siteId: tenant.siteId,
        token: c.req.header('X-Step-Up-Token'),
        verifiedAt: c.req.header('X-Step-Up-Verified-At'),
    });
    if (!stepUp.ok) {
        return c.json(stepUpErrorBody(stepUp), 428);
    }

    if (!payoutProviderConfigured(c.env)) {
        return c.json(payoutProviderUnavailableBody(
            new PayoutProviderUnavailable('RazorpayX Route payout provider is gated off until PA credentials and provider client are configured'),
        ), 503);
    }

    const adapter = createPayoutTransferAdapter({
        mode: payoutMode(c.env),
        rail: statement.rail,
        credentials: {
            keyId: c.env.RAZORPAY_KEY_ID,
            keySecret: c.env.RAZORPAY_ROUTE_KEY_SECRET || c.env.RAZORPAY_KEY_SECRET,
            accountId: c.env.RAZORPAY_ROUTE_ACCOUNT_ID,
        },
    });

    const { data: claimed, error: claimError } = await db.rpc('claim_payout_statement_release', {
        p_site_id: tenant.siteId,
        p_statement_id: statement.id,
        p_idempotency_key: body.idempotency_key,
        p_actor_id: tenant.userId,
    });
    if (claimError || !claimed) {
        return c.json({
            success: false,
            error: {
                code: 'PAYOUT_RELEASE_REJECTED',
                message: claimError?.message || 'Payout release could not be claimed.',
            },
        }, 409);
    }

    const claimedStatement = claimed as unknown as PayoutStatementRow;
    if (claimedStatement.status === 'released') {
        return c.json(success(serializePayout(claimedStatement)));
    }

    const transfer = await adapter.initiateTransfer({
        statementId: claimedStatement.id,
        siteId: tenant.siteId,
        amountMinor: claimedStatement.net_amount_minor,
        currency: claimedStatement.currency || 'INR',
        idempotencyKey: body.idempotency_key,
        metadata: { statement_number: claimedStatement.statement_number },
    });
    const now = transfer.processedAt;
    const nextStatus = transfer.status === 'released' ? 'released' : transfer.status === 'failed' ? 'failed' : 'processing';
    const { data: updated, error: updateError } = await db
        .from('payout_statements')
        .update({
            status: nextStatus,
            released_at: nextStatus === 'released' ? now : null,
            failed_at: nextStatus === 'failed' ? now : null,
            provider_reference: transfer.providerReference,
            utr: transfer.utr,
            failure_reason: transfer.failureReason,
            metadata: { ...(claimedStatement.metadata || {}), ...stepUp.metadata },
            updated_by: tenant.userId,
            updated_at: now,
        })
        .eq('id', claimedStatement.id)
        .eq('site_id', tenant.siteId)
        .select('*')
        .single();

    if (updateError || !updated) throw new Error(`Payout statement settlement update failed: ${updateError?.message || 'unknown error'}`);

    if (nextStatus === 'released') {
        const releaseLedgerTransactionId = await postCanonicalPayoutLedger(db, {
            siteId: tenant.siteId,
            sourceType: 'payout',
            sourceId: claimedStatement.id,
            idempotencyKey: `payout-release:${claimedStatement.id}`,
            lines: planPayoutReleaseLedgerPosting({
                payoutReference: claimedStatement.statement_number,
                amountMinor: claimedStatement.net_amount_minor,
            }),
            metadata: { compatibility_table: 'payout_statements', statement_number: claimedStatement.statement_number },
        });
        await db
            .from('payout_statements')
            .update({ release_ledger_transaction_id: releaseLedgerTransactionId, updated_by: tenant.userId })
            .eq('id', claimedStatement.id)
            .eq('site_id', tenant.siteId);
        await db.from('wallet_ledger_entries').insert({
            site_id: tenant.siteId,
            payout_statement_id: claimedStatement.id,
            entry_type: 'payout_debit',
            direction: 'debit',
            status: 'posted',
            currency: claimedStatement.currency || 'INR',
            amount_minor: claimedStatement.net_amount_minor,
            reference_type: 'payout_statement',
            reference_id: claimedStatement.id,
            description: `Payout ${claimedStatement.statement_number} released`,
            idempotency_key: `payout-debit:${claimedStatement.id}`,
            canonical_ledger_transaction_id: releaseLedgerTransactionId,
            metadata: { provider_reference: transfer.providerReference, utr: transfer.utr },
            created_by: tenant.userId,
            updated_by: tenant.userId,
        });
    }

    return c.json(success(serializePayout(updated as unknown as PayoutStatementRow)));
});

export default router;
