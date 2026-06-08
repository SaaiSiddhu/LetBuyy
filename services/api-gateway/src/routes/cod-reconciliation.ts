import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

const CodStatusSchema = z.enum(['pending', 'collected', 'reconciled', 'short', 'over', 'reversed']);

const CodQuerySchema = z.object({
    store_id: z.string().uuid(),
    status: z.union([CodStatusSchema, z.literal('all')]).default('all'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

const CollectCodSchema = z.object({
    store_id: z.string().uuid(),
    order_id: z.string().uuid(),
    collected_amount_minor: z.number().int().nonnegative().optional(),
    notes: z.string().max(1000).optional(),
    idempotency_key: z.string().min(8).max(160),
});

const ReconcileCodSchema = z.object({
    store_id: z.string().uuid(),
    deposited_amount_minor: z.number().int().nonnegative().optional(),
    notes: z.string().max(1000).optional(),
    idempotency_key: z.string().min(8).max(160),
});

type CodQuery = z.infer<typeof CodQuerySchema>;
type CollectCodInput = z.infer<typeof CollectCodSchema>;
type ReconcileCodInput = z.infer<typeof ReconcileCodSchema>;
type Db = ReturnType<typeof getSupabaseAdmin>;
type CodStatus = z.infer<typeof CodStatusSchema>;

interface CodOrderRow extends Record<string, unknown> {
    id: string;
    order_number?: string | null;
    total?: number | string | null;
    currency?: string | null;
    payment_method?: string | null;
    payment_status?: string | null;
    status?: string | null;
    created_at?: string | null;
}

interface CodReconciliationRow extends Record<string, unknown> {
    id: string;
    site_id: string;
    order_id: string;
    status: CodStatus;
    currency: string;
    expected_amount_minor: number;
    collected_amount_minor: number;
    deposited_amount_minor: number;
    difference_amount_minor: number;
    collected_at?: string | null;
    deposited_at?: string | null;
    reconciled_at?: string | null;
    collection_idempotency_key?: string | null;
    reconciliation_idempotency_key?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
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

function serializeEntry(row: CodReconciliationRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        order_id: row.order_id,
        status: row.status,
        currency: row.currency || 'INR',
        expected_amount_minor: Number(row.expected_amount_minor || 0),
        collected_amount_minor: Number(row.collected_amount_minor || 0),
        deposited_amount_minor: Number(row.deposited_amount_minor || 0),
        difference_amount_minor: Number(row.difference_amount_minor || 0),
        collected_at: row.collected_at || null,
        deposited_at: row.deposited_at || null,
        reconciled_at: row.reconciled_at || null,
        collection_idempotency_key: row.collection_idempotency_key || null,
        reconciliation_idempotency_key: row.reconciliation_idempotency_key || null,
        notes: row.notes || null,
        metadata: row.metadata || {},
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        deleted_at: row.deleted_at || null,
    };
}

function summarize(siteId: string, rows: CodReconciliationRow[]) {
    return rows.reduce((summary, row) => {
        const expected = Number(row.expected_amount_minor || 0);
        const collected = Number(row.collected_amount_minor || 0);
        const deposited = Number(row.deposited_amount_minor || 0);
        const difference = Number(row.difference_amount_minor || 0);
        summary.expected_amount_minor += expected;
        summary.collected_amount_minor += collected;
        summary.deposited_amount_minor += deposited;
        summary.difference_amount_minor += difference;
        summary.counts[row.status] = (summary.counts[row.status] || 0) + 1;
        return summary;
    }, {
        site_id: siteId,
        currency: 'INR',
        expected_amount_minor: 0,
        collected_amount_minor: 0,
        deposited_amount_minor: 0,
        difference_amount_minor: 0,
        counts: {
            pending: 0,
            collected: 0,
            reconciled: 0,
            short: 0,
            over: 0,
            reversed: 0,
        } as Record<CodStatus, number>,
    });
}

async function loadCodOrder(db: Db, siteId: string, orderId: string): Promise<CodOrderRow | null> {
    const { data, error } = await db
        .from('orders')
        .select('id, order_number, total, currency, payment_method, payment_status, status, created_at')
        .eq('id', orderId)
        .eq('store_id', siteId)
        .eq('payment_method', 'cod')
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`COD order lookup failed: ${error.message}`);
    return (data || null) as unknown as CodOrderRow | null;
}

async function loadExistingEntries(db: Db, siteId: string): Promise<CodReconciliationRow[]> {
    const { data, error } = await db
        .from('cod_reconciliation_entries')
        .select('*')
        .eq('site_id', siteId)
        .is('deleted_at', null);

    if (error) throw new Error(`COD reconciliation lookup failed: ${error.message}`);
    return (data || []) as unknown as CodReconciliationRow[];
}

async function ensureEntriesForCodOrders(db: Db, siteId: string, userId: string | null): Promise<void> {
    const existing = await loadExistingEntries(db, siteId);
    const existingOrderIds = new Set(existing.map((row) => row.order_id));
    const { data, error } = await db
        .from('orders')
        .select('id, order_number, total, currency, payment_method, payment_status, status, created_at')
        .eq('store_id', siteId)
        .eq('payment_method', 'cod')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`COD source order lookup failed: ${error.message}`);

    const rows = ((data || []) as unknown as CodOrderRow[])
        .filter((order) => !existingOrderIds.has(order.id))
        .filter((order) => !['cancelled', 'refunded'].includes(order.status || ''))
        .map((order) => ({
            site_id: siteId,
            order_id: order.id,
            status: 'pending',
            currency: order.currency || 'INR',
            expected_amount_minor: minorFromMajor(order.total),
            collected_amount_minor: 0,
            deposited_amount_minor: 0,
            difference_amount_minor: 0,
            metadata: {
                order_number: order.order_number || null,
                payment_status: order.payment_status || null,
                source: 'mobile_cod_reconciliation',
            },
            created_by: userId,
            updated_by: userId,
        }))
        .filter((row) => row.expected_amount_minor > 0);

    if (rows.length === 0) return;

    const { error: insertError } = await db.from('cod_reconciliation_entries').insert(rows);
    if (insertError) throw new Error(`COD reconciliation seed failed: ${insertError.message}`);
}

async function loadEntries(db: Db, siteId: string, status: CodQuery['status'], limit: number): Promise<CodReconciliationRow[]> {
    let query = db
        .from('cod_reconciliation_entries')
        .select('*')
        .eq('site_id', siteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new Error(`COD reconciliation list failed: ${error.message}`);
    return (data || []) as unknown as CodReconciliationRow[];
}

async function overview(db: Db, siteId: string, userId: string | null, status: CodQuery['status'], limit: number) {
    await ensureEntriesForCodOrders(db, siteId, userId);
    const entries = await loadEntries(db, siteId, status, limit);
    return {
        site_id: siteId,
        currency: 'INR',
        entries: entries.map(serializeEntry),
        summary: summarize(siteId, entries),
    };
}

async function loadEntryById(db: Db, siteId: string, id: string): Promise<CodReconciliationRow | null> {
    const { data, error } = await db
        .from('cod_reconciliation_entries')
        .select('*')
        .eq('id', id)
        .eq('site_id', siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`COD reconciliation entry lookup failed: ${error.message}`);
    return (data || null) as unknown as CodReconciliationRow | null;
}

async function loadEntryByOrder(db: Db, siteId: string, orderId: string): Promise<CodReconciliationRow | null> {
    const { data, error } = await db
        .from('cod_reconciliation_entries')
        .select('*')
        .eq('site_id', siteId)
        .eq('order_id', orderId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`COD reconciliation order entry lookup failed: ${error.message}`);
    return (data || null) as unknown as CodReconciliationRow | null;
}

async function loadEntryByIdempotency(
    db: Db,
    siteId: string,
    column: 'collection_idempotency_key' | 'reconciliation_idempotency_key',
    key: string,
): Promise<CodReconciliationRow | null> {
    const { data, error } = await db
        .from('cod_reconciliation_entries')
        .select('*')
        .eq('site_id', siteId)
        .eq(column, key)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`COD idempotency lookup failed: ${error.message}`);
    return (data || null) as unknown as CodReconciliationRow | null;
}

function reconciliationStatus(expectedAmountMinor: number, depositedAmountMinor: number): CodStatus {
    if (depositedAmountMinor < expectedAmountMinor) return 'short';
    if (depositedAmountMinor > expectedAmountMinor) return 'over';
    return 'reconciled';
}

async function insertWalletCreditIfMissing(
    db: Db,
    entry: CodReconciliationRow,
    userId: string | null,
    idempotencyKey: string,
): Promise<void> {
    const walletIdempotencyKey = `cod-remittance:${entry.id}:${idempotencyKey}`;
    const { data: existing, error: existingError } = await db
        .from('wallet_ledger_entries')
        .select('id')
        .eq('site_id', entry.site_id)
        .eq('idempotency_key', walletIdempotencyKey)
        .is('deleted_at', null)
        .maybeSingle();

    if (existingError) throw new Error(`COD wallet idempotency lookup failed: ${existingError.message}`);
    if (existing) return;
    if (Number(entry.deposited_amount_minor || 0) <= 0) return;

    const orderNumber = typeof entry.metadata?.order_number === 'string'
        ? entry.metadata.order_number
        : entry.order_id;

    const { error } = await db.from('wallet_ledger_entries').insert({
        site_id: entry.site_id,
        entry_type: 'cod_remittance_credit',
        direction: 'credit',
        status: 'posted',
        currency: entry.currency || 'INR',
        amount_minor: Number(entry.deposited_amount_minor || 0),
        reference_type: 'cod_reconciliation_entry',
        reference_id: entry.id,
        description: `COD remittance for order ${orderNumber}`,
        idempotency_key: walletIdempotencyKey,
        metadata: {
            order_id: entry.order_id,
            difference_amount_minor: Number(entry.difference_amount_minor || 0),
            reconciliation_status: entry.status,
        },
        created_by: userId,
        updated_by: userId,
    });

    if (error) throw new Error(`COD wallet credit failed: ${error.message}`);
}

router.get('/reconciliation', validate('query', CodQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as CodQuery;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    return c.json(success(await overview(db, tenant.siteId, tenant.userId, query.status, query.limit)));
});

router.post('/reconciliation', validate('json', CollectCodSchema), async (c) => {
    const body = c.get('validatedBody') as CollectCodInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const existingByKey = await loadEntryByIdempotency(db, tenant.siteId, 'collection_idempotency_key', body.idempotency_key);
    if (existingByKey) return c.json(success({ entry: serializeEntry(existingByKey) }));

    const order = await loadCodOrder(db, tenant.siteId, body.order_id);
    if (!order) {
        return c.json({ success: false, error: { code: 'COD_ORDER_NOT_FOUND', message: 'COD order not found.' } }, 404);
    }

    await ensureEntriesForCodOrders(db, tenant.siteId, tenant.userId);
    const current = await loadEntryByOrder(db, tenant.siteId, body.order_id);
    if (!current) {
        return c.json({ success: false, error: { code: 'COD_ENTRY_NOT_FOUND', message: 'COD reconciliation entry not found.' } }, 404);
    }

    const expectedAmountMinor = Number(current.expected_amount_minor || minorFromMajor(order.total));
    const collectedAmountMinor = body.collected_amount_minor ?? expectedAmountMinor;
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('cod_reconciliation_entries')
        .update({
            status: 'collected',
            collected_amount_minor: collectedAmountMinor,
            collected_at: current.collected_at || now,
            collection_idempotency_key: body.idempotency_key,
            notes: body.notes || current.notes || null,
            metadata: {
                ...(current.metadata || {}),
                collected_by: 'merchant_mobile',
            },
            updated_by: tenant.userId,
        })
        .eq('id', current.id)
        .eq('site_id', tenant.siteId)
        .select('*')
        .single();

    if (error || !data) throw new Error(`COD collection update failed: ${error?.message || 'unknown error'}`);
    return c.json(success({ entry: serializeEntry(data as unknown as CodReconciliationRow) }));
});

router.post('/reconciliation/:id/reconcile', validate('json', ReconcileCodSchema), async (c) => {
    const id = c.req.param('id');
    const body = c.get('validatedBody') as ReconcileCodInput;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, body.store_id);
    const existingByKey = await loadEntryByIdempotency(db, tenant.siteId, 'reconciliation_idempotency_key', body.idempotency_key);
    if (existingByKey) return c.json(success({ entry: serializeEntry(existingByKey) }));

    const current = await loadEntryById(db, tenant.siteId, id);
    if (!current) {
        return c.json({ success: false, error: { code: 'COD_ENTRY_NOT_FOUND', message: 'COD reconciliation entry not found.' } }, 404);
    }

    const collectedAmountMinor = Number(current.collected_amount_minor || current.expected_amount_minor || 0);
    const depositedAmountMinor = body.deposited_amount_minor ?? collectedAmountMinor;
    const expectedAmountMinor = Number(current.expected_amount_minor || 0);
    const status = reconciliationStatus(expectedAmountMinor, depositedAmountMinor);
    const now = new Date().toISOString();
    const { data, error } = await db
        .from('cod_reconciliation_entries')
        .update({
            status,
            collected_amount_minor: collectedAmountMinor,
            deposited_amount_minor: depositedAmountMinor,
            difference_amount_minor: depositedAmountMinor - expectedAmountMinor,
            deposited_at: current.deposited_at || now,
            reconciled_at: now,
            reconciliation_idempotency_key: body.idempotency_key,
            notes: body.notes || current.notes || null,
            metadata: {
                ...(current.metadata || {}),
                reconciled_by: 'merchant_mobile',
            },
            updated_by: tenant.userId,
        })
        .eq('id', current.id)
        .eq('site_id', tenant.siteId)
        .select('*')
        .single();

    if (error || !data) throw new Error(`COD reconciliation update failed: ${error?.message || 'unknown error'}`);
    const updated = data as unknown as CodReconciliationRow;
    await insertWalletCreditIfMissing(db, updated, tenant.userId, body.idempotency_key);

    return c.json(success({ entry: serializeEntry(updated) }));
});

export default router;
