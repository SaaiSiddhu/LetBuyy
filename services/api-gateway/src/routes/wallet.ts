import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

const WalletQuerySchema = z.object({
    store_id: z.string().uuid(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

type WalletQuery = z.infer<typeof WalletQuerySchema>;
type WalletEntryDirection = 'credit' | 'debit';
type WalletEntryStatus = 'pending' | 'posted' | 'held' | 'reversed';

interface WalletLedgerRow extends Record<string, unknown> {
    id: string;
    site_id: string;
    payout_statement_id?: string | null;
    entry_type: string;
    direction: WalletEntryDirection;
    status: WalletEntryStatus;
    currency: string;
    amount_minor: number;
    available_on?: string | null;
    reference_type?: string | null;
    reference_id?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

interface CanonicalLedgerEntryRow extends Record<string, unknown> {
    side: 'debit' | 'credit';
    amount_minor: number | string;
    ledger_accounts?: { account_code?: string | null } | null;
}

interface LedgerReconciliationRow extends Record<string, unknown> {
    site_id: string;
    status: 'verified' | 'mismatch';
    wallet_available_minor: number | string;
    ledger_merchant_payable_minor: number | string;
    variance_minor: number | string;
    verified_at?: string | null;
}

function serializeEntry(row: WalletLedgerRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        payout_statement_id: row.payout_statement_id || null,
        entry_type: row.entry_type,
        direction: row.direction,
        status: row.status,
        currency: row.currency || 'INR',
        amount_minor: Number(row.amount_minor || 0),
        available_on: row.available_on || null,
        reference_type: row.reference_type || null,
        reference_id: row.reference_id || null,
        description: row.description || null,
        metadata: row.metadata || {},
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
        deleted_at: row.deleted_at || null,
    };
}

function signedAmount(row: WalletLedgerRow): number {
    const amount = Number(row.amount_minor || 0);
    return row.direction === 'credit' ? amount : -amount;
}

function summarize(siteId: string, rows: WalletLedgerRow[]) {
    let availableMinor = 0;
    let pendingMinor = 0;
    let heldMinor = 0;
    let releasedMinor = 0;

    for (const row of rows) {
        const amount = signedAmount(row);
        if (row.status === 'posted') availableMinor += amount;
        if (row.status === 'pending') pendingMinor += amount;
        if (row.status === 'held') heldMinor += amount;
        if (row.entry_type === 'payout_debit' && row.status === 'posted') releasedMinor += Number(row.amount_minor || 0);
    }

    return {
        site_id: siteId,
        currency: 'INR',
        available_minor: availableMinor,
        pending_minor: pendingMinor,
        held_minor: heldMinor,
        released_minor: releasedMinor,
        ledger: rows.map(serializeEntry),
    };
}

async function loadCanonicalLedgerSummary(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
): Promise<Record<string, number> | null> {
    const { data, error } = await db
        .from('ledger_entries')
        .select('side, amount_minor, ledger_accounts(account_code)')
        .eq('site_id', siteId)
        .is('deleted_at', null);

    if (error) {
        if (error.message.includes('ledger_entries') && error.message.includes('schema cache')) return null;
        throw new Error(`Canonical wallet ledger lookup failed: ${error.message}`);
    }

    const balances: Record<string, number> = {};
    for (const row of (data || []) as unknown as CanonicalLedgerEntryRow[]) {
        const account = row.ledger_accounts?.account_code || 'unknown';
        const amount = Number(row.amount_minor || 0);
        balances[account] = (balances[account] || 0) + (row.side === 'credit' ? amount : -amount);
    }

    return balances;
}

async function loadLedgerReconciliation(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
): Promise<LedgerReconciliationRow | null> {
    const { data, error } = await db
        .from('money_ledger_site_reconciliations')
        .select('*')
        .eq('site_id', siteId)
        .maybeSingle();

    if (error) {
        if (error.message.includes('money_ledger_site_reconciliations') && error.message.includes('schema cache')) return null;
        throw new Error(`Wallet ledger reconciliation lookup failed: ${error.message}`);
    }

    return data as unknown as LedgerReconciliationRow | null;
}

router.get('/', validate('query', WalletQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as WalletQuery;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const { data, error } = await db
        .from('wallet_ledger_entries')
        .select('*')
        .eq('site_id', tenant.siteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(query.limit);

    if (error) throw new Error(`Wallet ledger lookup failed: ${error.message}`);
    const canonicalLedger = await loadCanonicalLedgerSummary(db, tenant.siteId);
    const reconciliation = await loadLedgerReconciliation(db, tenant.siteId);

    if (
        !canonicalLedger
        || !reconciliation
        || reconciliation.status !== 'verified'
        || Number(reconciliation.variance_minor || 0) !== 0
    ) {
        return c.json({
            success: false,
            error: {
                code: 'LEDGER_RECONCILIATION_REQUIRED',
                message: 'Wallet balance is unavailable until canonical ledger reconciliation is verified for this store.',
            },
        }, 409);
    }

    const compatibilitySummary = summarize(tenant.siteId, (data || []) as unknown as WalletLedgerRow[]);

    return c.json(success({
        ...compatibilitySummary,
        available_minor: Number(canonicalLedger.merchant_payable || 0),
        canonical_ledger: canonicalLedger,
        ledger_reconciliation: reconciliation,
    }));
});

export default router;
