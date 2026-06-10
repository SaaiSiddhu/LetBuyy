import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { planSettlementLedgerPosting, type SettlementLedgerLine } from '@letbuyy/billing-core';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

const CommissionQuerySchema = z.object({
    store_id: z.string().uuid(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ReconcileCommissionSchema = z.object({
    store_id: z.string().uuid(),
    idempotency_key: z.string().min(8).max(160),
});

type CommissionQuery = z.infer<typeof CommissionQuerySchema>;
type ReconcileCommissionInput = z.infer<typeof ReconcileCommissionSchema>;

interface CommissionScheduleRow extends Record<string, unknown> {
    id: string;
    site_id: string;
    name: string;
    status: 'draft' | 'active' | 'archived';
    currency: string;
    commission_bps: number;
    gst_bps: number;
    effective_from: string;
    effective_to?: string | null;
    source: string;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

interface CommissionEntryRow extends Record<string, unknown> {
    id: string;
    site_id: string;
    order_id?: string | null;
    payout_statement_id?: string | null;
    commission_schedule_id?: string | null;
    status: 'pending' | 'included_in_payout' | 'reconciled' | 'reversed';
    currency: string;
    gross_amount_minor: number;
    commission_bps: number;
    commission_amount_minor: number;
    gst_bps: number;
    gst_amount_minor: number;
    net_payable_minor: number;
    idempotency_key?: string | null;
    canonical_ledger_transaction_id?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

interface PaidOrderRow extends Record<string, unknown> {
    id: string;
    order_number?: string | null;
    total?: number | string | null;
    currency?: string | null;
    created_at?: string | null;
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

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function serializeSchedule(row: CommissionScheduleRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        name: row.name,
        status: row.status,
        currency: row.currency || 'INR',
        commission_bps: Number(row.commission_bps || 0),
        gst_bps: Number(row.gst_bps || 0),
        effective_from: row.effective_from,
        effective_to: row.effective_to || null,
        source: row.source,
        metadata: row.metadata || {},
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        deleted_at: row.deleted_at || null,
    };
}

function serializeEntry(row: CommissionEntryRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        order_id: row.order_id || null,
        payout_statement_id: row.payout_statement_id || null,
        commission_schedule_id: row.commission_schedule_id || null,
        status: row.status,
        currency: row.currency || 'INR',
        gross_amount_minor: Number(row.gross_amount_minor || 0),
        commission_bps: Number(row.commission_bps || 0),
        commission_amount_minor: Number(row.commission_amount_minor || 0),
        gst_bps: Number(row.gst_bps || 0),
        gst_amount_minor: Number(row.gst_amount_minor || 0),
        net_payable_minor: Number(row.net_payable_minor || 0),
        canonical_ledger_transaction_id: row.canonical_ledger_transaction_id || null,
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

async function postCommissionLedger(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        sourceId: string;
        idempotencyKey: string;
        lines: readonly SettlementLedgerLine[];
    },
): Promise<string> {
    const { data, error } = await db.rpc('post_settlement_ledger_transaction', {
        p_site_id: input.siteId,
        p_source_type: 'settlement',
        p_source_id: input.sourceId,
        p_idempotency_key: input.idempotencyKey,
        p_lines: toLedgerRpcLines(input.lines),
        p_metadata: { compatibility_table: 'commission_reconciliation_entries' },
        p_request_id: null,
    });

    if (error || !data) throw new Error(`Commission canonical ledger post failed: ${error?.message || 'unknown error'}`);
    return String(data);
}

function summarize(entries: CommissionEntryRow[]) {
    return entries.reduce((acc, entry) => {
        acc.gross_amount_minor += Number(entry.gross_amount_minor || 0);
        acc.commission_amount_minor += Number(entry.commission_amount_minor || 0);
        acc.gst_amount_minor += Number(entry.gst_amount_minor || 0);
        acc.net_payable_minor += Number(entry.net_payable_minor || 0);
        return acc;
    }, {
        gross_amount_minor: 0,
        commission_amount_minor: 0,
        gst_amount_minor: 0,
        net_payable_minor: 0,
    });
}

async function ensureSchedule(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    userId: string | null,
): Promise<CommissionScheduleRow> {
    const { data, error } = await db
        .from('commission_schedules')
        .select('*')
        .eq('site_id', siteId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new Error(`Commission schedule lookup failed: ${error.message}`);
    if (data) return data as unknown as CommissionScheduleRow;

    const { data: inserted, error: insertError } = await db
        .from('commission_schedules')
        .insert({
            site_id: siteId,
            name: 'Default commission',
            status: 'active',
            currency: 'INR',
            commission_bps: 0,
            gst_bps: 1800,
            effective_from: today(),
            source: 'mobile_money_contract',
            metadata: { defaulted_by: 'mobile_money_contract' },
            created_by: userId,
            updated_by: userId,
        })
        .select('*')
        .single();

    if (insertError || !inserted) throw new Error(`Commission schedule create failed: ${insertError?.message || 'unknown error'}`);
    return inserted as unknown as CommissionScheduleRow;
}

async function loadEntries(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    limit: number,
): Promise<CommissionEntryRow[]> {
    const { data, error } = await db
        .from('commission_reconciliation_entries')
        .select('*')
        .eq('site_id', siteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`Commission reconciliation lookup failed: ${error.message}`);
    return (data || []) as unknown as CommissionEntryRow[];
}

async function overview(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    userId: string | null,
    limit: number,
) {
    const schedule = await ensureSchedule(db, siteId, userId);
    const entries = await loadEntries(db, siteId, limit);

    return {
        site_id: siteId,
        currency: 'INR',
        schedule: serializeSchedule(schedule),
        entries: entries.map(serializeEntry),
        summary: summarize(entries),
    };
}

router.get('/', validate('query', CommissionQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as CommissionQuery;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);

    return c.json(success(await overview(db, tenant.siteId, tenant.userId, query.limit)));
});

router.post('/reconcile', validate('json', ReconcileCommissionSchema), async (c) => {
    const body = c.get('validatedBody') as ReconcileCommissionInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const schedule = await ensureSchedule(db, tenant.siteId, tenant.userId);
    const { data: existingRows, error: existingError } = await db
        .from('commission_reconciliation_entries')
        .select('order_id')
        .eq('site_id', tenant.siteId)
        .is('deleted_at', null);

    if (existingError) throw new Error(`Commission reconciliation idempotency lookup failed: ${existingError.message}`);

    const existingOrderIds = new Set(
        ((existingRows || []) as Array<{ order_id?: string | null }>)
            .map((row) => row.order_id)
            .filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    const { data: orders, error: ordersError } = await db
        .from('orders')
        .select('id, order_number, total, currency, created_at')
        .eq('store_id', tenant.siteId)
        .eq('payment_status', 'paid')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (ordersError) throw new Error(`Commission source order lookup failed: ${ordersError.message}`);

    const rows = ((orders || []) as unknown as PaidOrderRow[])
        .filter((order) => !existingOrderIds.has(order.id))
        .map((order) => {
            const grossAmountMinor = minorFromMajor(order.total);
            const commissionAmountMinor = Math.round(grossAmountMinor * Number(schedule.commission_bps || 0) / 10000);
            const gstAmountMinor = Math.round(commissionAmountMinor * Number(schedule.gst_bps || 0) / 10000);
            return {
                site_id: tenant.siteId,
                order_id: order.id,
                commission_schedule_id: schedule.id,
                status: 'pending',
                currency: 'INR',
                gross_amount_minor: grossAmountMinor,
                commission_bps: schedule.commission_bps,
                commission_amount_minor: commissionAmountMinor,
                gst_bps: schedule.gst_bps,
                gst_amount_minor: gstAmountMinor,
                net_payable_minor: Math.max(0, grossAmountMinor - commissionAmountMinor - gstAmountMinor),
                idempotency_key: `${body.idempotency_key}:${order.id}`,
                metadata: { order_number: order.order_number || null },
                created_by: tenant.userId,
                updated_by: tenant.userId,
            };
        })
        .filter((row) => row.gross_amount_minor > 0);

    if (rows.length > 0) {
        const { data: insertedRows, error } = await db
            .from('commission_reconciliation_entries')
            .insert(rows)
            .select('*');
        if (error) throw new Error(`Commission reconciliation create failed: ${error.message}`);

        for (const entry of (insertedRows || []) as unknown as CommissionEntryRow[]) {
            const plan = planSettlementLedgerPosting({
                store_id: tenant.siteId,
                settlement_reference: `commission:${entry.id}`,
                idempotency_key: entry.idempotency_key ? String(entry.idempotency_key) : `commission:${entry.id}`,
                rail: 'pa_split',
                provider: 'manual',
                provider_mode: 'sandbox',
                currency: 'INR',
                gross_amount_minor: Number(entry.gross_amount_minor || 0),
                platform_fee_minor: Number(entry.commission_amount_minor || 0),
                gst_minor: Number(entry.gst_amount_minor || 0),
                net_amount_minor: Number(entry.net_payable_minor || 0),
                reserve_minor: 0,
                metadata: { order_id: entry.order_id || null },
            });
            const ledgerTransactionId = await postCommissionLedger(db, {
                siteId: tenant.siteId,
                sourceId: entry.id,
                idempotencyKey: `commission:${entry.id}`,
                lines: plan.lines,
            });
            await db
                .from('commission_reconciliation_entries')
                .update({ canonical_ledger_transaction_id: ledgerTransactionId, updated_by: tenant.userId })
                .eq('id', entry.id)
                .eq('site_id', tenant.siteId);
        }
    }

    return c.json(success({
        created: rows.length,
        overview: await overview(db, tenant.siteId, tenant.userId, 100),
    }));
});

export default router;
