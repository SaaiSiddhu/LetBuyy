import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { stepUpErrorBody } from '../lib/security-controls';
import { verifyMerchantStepUp } from '../lib/merchant-step-up';
import { AppError } from '../lib/errors';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';
import { validate } from '../middleware/validation';
import {
    createPayoutTransferAdapter,
    createRazorpayRoutePayoutProviderClient,
    PayoutProviderUnavailable,
    type MerchantPayoutRail,
    type PayoutTransferMode,
} from '@letbuyy/infrastructure/payout-transfer-adapter';
import { isLivePASplitProviderReady, requireZeroPlatformTransactionFee } from '@letbuyy/payments';
import { MerchantPayoutListSchema, MerchantPayoutStatementSchema, MerchantPayoutSummarySchema } from '@letbuyy/shared-types';
import {
    type SettlementLedgerLine,
} from '@letbuyy/billing-core';

const router = new Hono<{ Bindings: Env }>();

const StoreQuerySchema = z.object({
    store_id: z.string().uuid(),
});

const ListPayoutsQuerySchema = StoreQuerySchema.extend({
    status: z.enum(['pending', 'processing', 'released', 'failed']).optional(),
    mode: z.enum(['sandbox','live']).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    cursor: z.string().min(1).max(1024).optional(),
});
const PayoutSummaryQuerySchema = StoreQuerySchema.extend({mode:z.enum(['sandbox','live']).optional()});
const PayoutCursorSchema = z.object({site_id:z.string().uuid(),mode:z.enum(['sandbox','live']),
    status:z.enum(['pending','processing','released','failed']).nullable(),created_at:z.string().datetime({offset:true}),id:z.string().uuid()}).strict();

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
    release_idempotency_key?: string | null;
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
    return 'razorpay_route';
}

export function payoutProviderConfigured(env: Env): boolean {
    const envRecord = env as Env & Record<string, string | undefined>;
    const providerConfigurationReady = Boolean(
        env.RAZORPAY_KEY_ID
        && (env.RAZORPAY_ROUTE_KEY_SECRET || env.RAZORPAY_KEY_SECRET)
        && env.RAZORPAY_ROUTE_ACCOUNT_ID
        && envRecord.RAZORPAY_ROUTE_PROVIDER_ENABLED === 'true',
    );
    if (payoutMode(env) === 'live') {
        return isLivePASplitProviderReady('razorpay_route', {
            razorpay_route: env.RAZORPAY_ROUTE_LIVE_APPROVAL_REFERENCE,
        }, providerConfigurationReady);
    }
    return providerConfigurationReady;
}

function payoutProviderClient(rail: MerchantPayoutRail) {
    if (rail === 'razorpay_route') return createRazorpayRoutePayoutProviderClient();
    return undefined;
}

function statementNumber(siteId: string, now: Date): string {
    return `PYT-${siteId.replace(/-/g, '').slice(0, 8).toUpperCase()}-${now.getTime()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
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

async function serializePayoutWithSourceLineage(
    db: ReturnType<typeof getSupabaseAdmin>,
    row: PayoutStatementRow,
    siteId: string,
) {
    const [ordersResult, transactionsResult] = await Promise.all([
        db.from('payout_statement_source_orders')
            .select('order_id,source_order_gross_minor,canonical_merchant_payable_delta_minor,canonical_transaction_count,origin_transaction_count,lineage_status')
            .eq('site_id', siteId)
            .eq('payout_statement_id', row.id)
            .order('order_id'),
        db.from('payout_statement_source_ledger_transactions')
            .select('order_id,ledger_transaction_id,source_type,merchant_payable_delta_minor,ledger_created_at')
            .eq('site_id', siteId)
            .eq('payout_statement_id', row.id)
            .order('ledger_created_at'),
    ]);

    if (ordersResult.error) throw new Error(`Payout source lineage lookup failed: ${ordersResult.error.message}`);
    if (transactionsResult.error) throw new Error(`Payout source transaction lookup failed: ${transactionsResult.error.message}`);

    const transactionsByOrder = new Map<string, Array<Record<string, unknown>>>();
    for (const transaction of transactionsResult.data || []) {
        const orderId = String(transaction.order_id);
        const rows = transactionsByOrder.get(orderId) || [];
        rows.push({
            ledger_transaction_id: transaction.ledger_transaction_id,
            source_type: transaction.source_type,
            merchant_payable_delta_minor: Number(transaction.merchant_payable_delta_minor || 0),
            created_at: transaction.ledger_created_at,
        });
        transactionsByOrder.set(orderId, rows);
    }

    return {
        ...serializePayout(row),
        source_order_lineage: (ordersResult.data || []).map((sourceOrder) => ({
            order_id: sourceOrder.order_id,
            source_order_gross_minor: Number(sourceOrder.source_order_gross_minor || 0),
            canonical_merchant_payable_delta_minor: Number(sourceOrder.canonical_merchant_payable_delta_minor || 0),
            canonical_transaction_count: Number(sourceOrder.canonical_transaction_count || 0),
            origin_transaction_count: Number(sourceOrder.origin_transaction_count || 0),
            lineage_status: sourceOrder.lineage_status,
            ledger_transactions: transactionsByOrder.get(String(sourceOrder.order_id)) || [],
        })),
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

class PayoutReleaseConflict extends Error {}

async function finalizePayoutStatementRelease(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        statementId: string;
        idempotencyKey: string;
        status: 'processing' | 'released' | 'failed';
        processedAt: string;
        providerReference: string | null;
        utr: string | null;
        failureReason: string | null;
        actorId: string | null;
        stepUpMetadata?: JsonRecord;
    },
): Promise<PayoutStatementRow> {
    const { data, error } = await db.rpc('finalize_payout_statement_release_with_effects', {
        p_site_id: input.siteId,
        p_statement_id: input.statementId,
        p_release_idempotency_key: input.idempotencyKey,
        p_result_status: input.status,
        p_processed_at: input.processedAt,
        p_provider_reference: input.providerReference,
        p_utr: input.utr,
        p_failure_reason: input.failureReason,
        p_actor_id: input.actorId,
        p_step_up_metadata: input.stepUpMetadata || {},
    });
    if (error?.code === '23505' || error?.code === '23514') throw new PayoutReleaseConflict();
    if (error || !data) throw new Error(`Payout release finalization failed: ${error?.message || 'unknown error'}`);
    return data as unknown as PayoutStatementRow;
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

async function ensurePayoutStatementEffects(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        userId: string | null;
        statement: PayoutStatementRow;
        sourceOrderIds: string[];
    },
): Promise<string | null> {
    const statement = input.statement;
    const statementMetadata = asRecord(statement.metadata);
    const isSettlementBacked = statementMetadata.source_type === 'settlement';
    const sourceSettlementId = isSettlementBacked ? textValue(statementMetadata.source_settlement_id) : null;
    if (isSettlementBacked && !sourceSettlementId) {
        throw new Error('Settlement payout statement is missing its source settlement link');
    }
    const walletIdempotencyKey = isSettlementBacked
        ? `settlement-payout-credit:${sourceSettlementId}`
        : `payout-credit:${statement.id}`;
    const { data: existingCredit, error: creditLookupError } = await db
        .from('wallet_ledger_entries')
        .select('id, payout_statement_id, entry_type, direction, status, currency, amount_minor, reference_type, reference_id')
        .eq('site_id', input.siteId)
        .eq('idempotency_key', walletIdempotencyKey)
        .is('deleted_at', null)
        .maybeSingle();
    if (creditLookupError) throw new Error(`Payout wallet credit lookup failed: ${creditLookupError.message}`);

    if (existingCredit) {
        const credit = existingCredit as Record<string, unknown>;
        if (credit.payout_statement_id !== statement.id || credit.direction !== 'credit'
            || credit.currency !== statement.currency || Number(credit.amount_minor) !== Number(statement.net_amount_minor)
            || credit.entry_type !== 'payout_credit' || !['pending', 'posted'].includes(String(credit.status))
            || (isSettlementBacked && (credit.reference_type !== 'settlement' || credit.reference_id !== sourceSettlementId))) {
            throw new Error('Payout wallet credit conflicts with its statement');
        }
    } else {
        if (isSettlementBacked) {
            throw new Error('Settlement payout wallet projection is missing from its atomic source transaction');
        }
        const { error: walletCreditError } = await db.from('wallet_ledger_entries').insert({
            site_id: input.siteId,
            payout_statement_id: statement.id,
            entry_type: 'payout_credit',
            direction: 'credit',
            status: 'pending',
            currency: statement.currency,
            amount_minor: statement.net_amount_minor,
            available_on: statement.available_on || null,
            reference_type: 'payout_statement',
            reference_id: statement.id,
            description: `Payout ${statement.statement_number} pending settlement`,
            idempotency_key: walletIdempotencyKey,
            metadata: { source_order_ids: input.sourceOrderIds },
            created_by: input.userId,
            updated_by: input.userId,
        });
        if (walletCreditError) {
            // A concurrent replay may have won the unique idempotency key. Re-read and
            // accept it only if it represents the exact same pending payout credit.
            const { data: concurrentCredit, error: concurrentLookupError } = await db
                .from('wallet_ledger_entries')
                .select('id, payout_statement_id, entry_type, direction, status, currency, amount_minor, reference_type, reference_id')
                .eq('site_id', input.siteId)
                .eq('idempotency_key', walletIdempotencyKey)
                .is('deleted_at', null)
                .maybeSingle();
            if (concurrentLookupError || !concurrentCredit) {
                throw new Error(`Payout wallet credit failed: ${walletCreditError.message}`);
            }
            const credit = concurrentCredit as Record<string, unknown>;
            if (credit.payout_statement_id !== statement.id || credit.direction !== 'credit'
                || credit.currency !== statement.currency || Number(credit.amount_minor) !== Number(statement.net_amount_minor)
                || credit.entry_type !== 'payout_credit' || !['pending', 'posted'].includes(String(credit.status))) {
                throw new Error('Payout wallet credit conflicts with its statement');
            }
        }
    }

    const feeAssessmentLines = planPayoutFeeAssessmentLedger({
        statementNumber: statement.statement_number,
        platformFeeMinor: Number(statement.platform_fee_minor || 0),
        taxMinor: Number(statement.tax_minor || 0),
    });
    if (feeAssessmentLines.length === 0) return statement.canonical_ledger_transaction_id || null;

    const canonicalLedgerTransactionId = await postCanonicalPayoutLedger(db, {
        siteId: input.siteId,
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
    if (statement.canonical_ledger_transaction_id !== canonicalLedgerTransactionId) {
        const { error } = await db
            .from('payout_statements')
            .update({ canonical_ledger_transaction_id: canonicalLedgerTransactionId, updated_by: input.userId })
            .eq('id', statement.id)
            .eq('site_id', input.siteId);
        if (error) throw new Error(`Payout canonical ledger link failed: ${error.message}`);
    }
    return canonicalLedgerTransactionId;
}

async function readPayoutPage(
    db: ReturnType<typeof getSupabaseAdmin>,
    siteId: string,
    mode: PayoutTransferMode,
    query: {status?:ListPayoutsQuery['status'];limit:number;cursor?:string},
) {
    let cursor:z.infer<typeof PayoutCursorSchema>|undefined;
    if(query.cursor) {
        try {
            cursor=PayoutCursorSchema.parse(JSON.parse(atob(query.cursor.replaceAll('-','+').replaceAll('_','/'))));
            if(cursor.site_id!==siteId || cursor.mode!==mode || cursor.status!==(query.status??null)) throw new Error('scope');
        } catch { throw new AppError('Reload the statement list before continuing.',400,'PAYOUT_CURSOR_INVALID'); }
    }
    const {data,error}=await db.rpc('read_payout_statement_page_v1',{
        p_site_id:siteId,p_mode:mode,p_limit:query.limit,p_status:query.status??null,
        p_before_created_at:cursor?.created_at??null,p_before_id:cursor?.id??null,
    });
    const read=z.object({payouts:MerchantPayoutStatementSchema.array(),summary:MerchantPayoutSummarySchema,
        pagination:z.object({limit:z.number().int(),matching_count:z.number().int().safe().nonnegative(),has_more:z.boolean()}),
        next_position:z.object({created_at:z.string().datetime({offset:true}),id:z.string().uuid()}).nullable(),
    }).safeParse(data);
    if(error || !read.success || read.data.summary.site_id!==siteId || read.data.summary.provider_mode!==mode
        || read.data.payouts.some(row=>row.site_id!==siteId || row.provider_mode!==mode || row.currency!=='INR' || (query.status && row.status!==query.status))
        || (read.data.summary.next_payout && (read.data.summary.next_payout.site_id!==siteId || read.data.summary.next_payout.provider_mode!==mode))
        || read.data.pagination.limit!==query.limit || read.data.payouts.length>query.limit
        || read.data.pagination.has_more!==Boolean(read.data.next_position)) {
        throw new AppError('Payout statements are temporarily unavailable. Retry loading.',503,'PAYOUT_READ_UNAVAILABLE');
    }
    const next=read.data.next_position;
    const nextCursor=next?btoa(JSON.stringify({site_id:siteId,mode,status:query.status??null,...next})).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''):null;
    return MerchantPayoutListSchema.parse({
        payouts:read.data.payouts.map(row=>serializePayout(row as unknown as PayoutStatementRow)),
        summary:{...read.data.summary,next_payout:read.data.summary.next_payout
            ?serializePayout(read.data.summary.next_payout as unknown as PayoutStatementRow):null},
        pagination:{...read.data.pagination,next_cursor:nextCursor},
    });
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
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

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
    try {
        return requireZeroPlatformTransactionFee((data as { commission_bps?: number } | null)?.commission_bps ?? 0);
    } catch {
        throw new AppError('The saved transaction-fee schedule needs review before a new statement can be created. No statement was created.', 409, 'TRANSACTION_FEE_POLICY_CONFLICT');
    }
}

router.get('/', validate('query', ListPayoutsQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as ListPayoutsQuery;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const page=await readPayoutPage(db,tenant.siteId,query.mode??payoutMode(c.env),query);
    c.header('Cache-Control','no-store');
    return c.json(success(page));
});

router.get('/summary', validate('query', PayoutSummaryQuerySchema), async (c) => {
    const query = c.get('validatedQuery') as z.infer<typeof PayoutSummaryQuerySchema>;
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, query.store_id);
    const page=await readPayoutPage(db,tenant.siteId,query.mode??payoutMode(c.env),{limit:1});
    c.header('Cache-Control','no-store');
    return c.json(success(page.summary));
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
    if (existing) {
        const statement = existing as unknown as PayoutStatementRow;
        if ((statement.period_start || null) !== (body.period_start || null)
            || (statement.period_end || null) !== (body.period_end || null)) {
            return c.json({
                success: false,
                error: {
                    code: 'IDEMPOTENCY_KEY_REUSED',
                    message: 'This idempotency key is already bound to a different payout period.',
                },
            }, 409);
        }
        const metadata = asRecord(statement.metadata);
        const sourceOrderIds = Array.isArray(metadata.source_order_ids)
            ? metadata.source_order_ids.filter((id): id is string => typeof id === 'string')
            : [];
        const canonicalLedgerTransactionId = await ensurePayoutStatementEffects(db, {
            siteId: tenant.siteId,
            userId: tenant.userId,
            statement,
            sourceOrderIds,
        });
        return c.json(success(serializePayout({ ...statement, canonical_ledger_transaction_id: canonicalLedgerTransactionId })));
    }

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
    const platformFeeMinor = 0;
    const taxMinor = 0;
    const netAmountMinor = Math.max(0, grossAmountMinor - platformFeeMinor - taxMinor);
    const now = new Date();
    const mode = payoutMode(c.env);
    const rail = payoutRail();
    const sourceOrderIds = eligibleOrders.map((order) => order.id);

    const metadata = {
        source_order_ids: sourceOrderIds,
        source_order_numbers: eligibleOrders.map((order) => textValue(order.order_number)).filter(Boolean),
        commission_bps: commissionBps,
        gst_bps: 1800,
    };
    const { data: statementId, error } = await db.rpc('create_payout_statement_with_effects', {
        p_site_id: tenant.siteId,
        p_statement_number: statementNumber(tenant.siteId, now),
        p_provider: rail,
        p_provider_mode: mode,
        p_rail: rail,
        p_gross_amount_minor: grossAmountMinor,
        p_platform_fee_minor: platformFeeMinor,
        p_tax_minor: taxMinor,
        p_net_amount_minor: netAmountMinor,
        p_period_start: body.period_start || null,
        p_period_end: body.period_end || null,
        p_available_on: addDays(now, 2),
        p_idempotency_key: body.idempotency_key,
        p_source_order_ids: sourceOrderIds,
        p_source_settlement_id: null,
        p_metadata: metadata,
        p_actor_id: tenant.userId,
    });
    if (error?.code === '23505') {
        return c.json({
            success: false,
            error: { code: 'CONFLICT', message: 'Payout source or idempotency key is already bound to another statement.' },
        }, 409);
    }
    if (error || !statementId) throw new Error(`Payout statement transaction failed: ${error?.message || 'unknown error'}`);

    const { data: inserted, error: readError } = await db
        .from('payout_statements')
        .select('*')
        .eq('id', statementId)
        .eq('site_id', tenant.siteId)
        .single();
    if (readError || !inserted) throw new Error(`Payout statement readback failed: ${readError?.message || 'unknown error'}`);
    const statement = inserted as unknown as PayoutStatementRow;

    return c.json(success(await serializePayoutWithSourceLineage(db, statement, tenant.siteId)), 201);
});

router.get('/:id', async (c) => {
    const payoutId = c.req.param('id');
    const tenant = await resolveTenantContextForOwnedSite(c, c.get('auth').user.storeId || c.req.header('X-Store-ID')?.trim() || '');
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('payout_statements')
        .select('*')
        .eq('id', payoutId)
        .eq('site_id', tenant.siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`Payout statement lookup failed: ${error.message}`);
    if (!data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payout not found' } }, 404);
    }
    return c.json(success(await serializePayoutWithSourceLineage(
        db,
        data as unknown as PayoutStatementRow,
        tenant.siteId,
    )));
});

router.post('/:id/settle', validate('json', SettlePayoutStatementSchema), async (c) => {
    const payoutId = c.req.param('id');
    const body = c.get('validatedBody') as SettlePayoutStatementInput;
    const tenant = await resolveTenantContextForOwnedSite(c, c.get('auth').user.storeId || c.req.header('X-Store-ID')?.trim() || '');
    const db = getSupabaseAdmin(c);
    const { data, error } = await db
        .from('payout_statements')
        .select('*')
        .eq('id', payoutId)
        .eq('site_id', tenant.siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (error) throw new Error(`Payout statement lookup failed: ${error.message}`);
    if (!data) {
        return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Payout not found' } }, 404);
    }

    const statement = data as unknown as PayoutStatementRow;
    if (statement.status === 'released') {
        const releaseKey = statement.release_idempotency_key || textValue(statement.metadata?.release_idempotency_key);
        if (!releaseKey) {
            return c.json({ success: false, error: { code: 'PAYOUT_RELEASE_REPAIR_REQUIRED', message: 'Released payout is missing its durable release claim.' } }, 409);
        }
        try {
            const repaired = await finalizePayoutStatementRelease(db, {
                siteId: tenant.siteId,
                statementId: statement.id,
                idempotencyKey: releaseKey,
                status: statement.status,
                processedAt: statement.released_at || statement.updated_at || new Date().toISOString(),
                providerReference: statement.provider_reference || null,
                utr: statement.utr || null,
                failureReason: null,
                actorId: tenant.userId,
            });
            return c.json(success(serializePayout(repaired)));
        } catch (error) {
            if (error instanceof PayoutReleaseConflict) {
                return c.json({ success: false, error: { code: 'CONFLICT', message: 'Stored payout release evidence conflicts with its canonical accounting state.' } }, 409);
            }
            throw error;
        }
    }
    if (statement.status !== 'pending' && statement.status !== 'processing') {
        return c.json({ success: false, error: { code: 'PAYOUT_NOT_SETTLEABLE', message: 'This payout cannot be settled.' } }, 409);
    }

    const stepUp = await verifyMerchantStepUp(db, {
        action: 'payout.release',
        actorId: tenant.userId,
        siteId: tenant.siteId,
        token: c.req.header('X-Step-Up-Token'),
        verifiedAt: c.req.header('X-Step-Up-Verified-At'),
        signingSecret: c.env.STEP_UP_SIGNING_SECRET,
    });
    if (!stepUp.ok) {
        return c.json(stepUpErrorBody(stepUp), 428);
    }

    if (!payoutProviderConfigured(c.env)) {
        return c.json(payoutProviderUnavailableBody(
            new PayoutProviderUnavailable('Razorpay Route payout provider is gated off until PA credentials and provider client are configured'),
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
        provider: payoutProviderClient(statement.rail),
    });

    const { data: claimed, error: claimError } = await db.rpc('claim_owned_payout_release_v1', {
        p_step_up: stepUp.metadata, p_request_id: c.req.header('X-Request-ID') || null,
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
                message: 'Payout release could not be claimed.',
            },
        }, 409);
    }

    const outcome = claimed as { accepted: boolean; status?: number; code?: string; statement?: PayoutStatementRow };
    if (!outcome.accepted || !outcome.statement) throw new AppError('Payout approval or ownership changed. Refresh and retry.', outcome.status || 409, outcome.code || 'PAYOUT_RELEASE_REJECTED');
    const claimedStatement = outcome.statement;
    if (claimedStatement.status === 'released') {
        const releaseKey = claimedStatement.release_idempotency_key || textValue(claimedStatement.metadata?.release_idempotency_key);
        if (!releaseKey) {
            return c.json({ success: false, error: { code: 'PAYOUT_RELEASE_REPAIR_REQUIRED', message: 'Released payout is missing its durable release claim.' } }, 409);
        }
        try {
            const repaired = await finalizePayoutStatementRelease(db, {
                siteId: tenant.siteId,
                statementId: claimedStatement.id,
                idempotencyKey: releaseKey,
                status: claimedStatement.status,
                processedAt: claimedStatement.released_at || claimedStatement.updated_at || new Date().toISOString(),
                providerReference: claimedStatement.provider_reference || null,
                utr: claimedStatement.utr || null,
                failureReason: null,
                actorId: tenant.userId,
            });
            return c.json(success(serializePayout(repaired)));
        } catch (error) {
            if (error instanceof PayoutReleaseConflict) {
                return c.json({ success: false, error: { code: 'CONFLICT', message: 'Stored payout release evidence conflicts with its canonical accounting state.' } }, 409);
            }
            throw error;
        }
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
    try {
        const finalized = await finalizePayoutStatementRelease(db, {
            siteId: tenant.siteId,
            statementId: claimedStatement.id,
            idempotencyKey: body.idempotency_key,
            status: nextStatus,
            processedAt: now,
            providerReference: transfer.providerReference,
            utr: transfer.utr,
            failureReason: transfer.failureReason,
            actorId: tenant.userId,
            stepUpMetadata: stepUp.metadata,
        });
        return c.json(success(serializePayout(finalized)));
    } catch (error) {
        if (error instanceof PayoutReleaseConflict) {
            return c.json({ success: false, error: { code: 'CONFLICT', message: 'Payout provider response conflicts with the durable release claim.' } }, 409);
        }
        throw error;
    }
});

export default router;
