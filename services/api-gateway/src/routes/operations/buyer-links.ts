// Buyer ownership conflicts — operator realm (APPID-P3; schema: migration 255).
//
// A buyer can never move a store customer record or an order that another buyer holds:
// link_buyer_store_customer and claim_buyer_orders refuse and write the attempt to audit_logs. This
// is the other half of that rule, the "defined, auditable conflict-resolution path" the founder asked
// for on 2026-09-24. An operator who has established out of band which buyer owns the record (a
// support case with proof) moves it with a reason. The database function performs the move and writes
// the audit row naming the operator, the previous owner and the reason in the same transaction, so
// this router adds no second audit trail that could disagree with it.
//
// Permissions mirror the support desk: listing conflicts is support:view; resolving one is
// support:manage (lead tier), because a resolution re-points a person's order history. Every
// resolution needs a reason of 8 to 1000 characters, the same rule as other sensitive operator acts.
// Cross-buyer reads are the operator realm's purpose; nothing here is reachable by a buyer or merchant.

import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { requirePermission, validateSensitiveReason } from '../../middleware/rbac';

type AppContext = Context<{ Bindings: Env }>;
type JsonRecord = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const BUYER_LINK_CONFLICT_ACTIONS = ['buyer_store_link.conflict', 'buyer_orders.claimed'] as const;

export interface BuyerLinkConflictRow {
    id: string;
    action: string;
    created_at: string;
    resource_id: string | null;
    actor_id: string | null;
    metadata: JsonRecord | null;
}

export type ResolutionOutcome =
    | 'resolved'
    | 'store_customer_unavailable'
    | 'order_unavailable'
    | 'buyer_unavailable_or_unverified'
    | 'buyer_has_other_record_at_store';

interface ResolveParams {
    p_buyer_account_id: string;
    p_operator_id: string;
    p_reason: string;
}

export interface BuyerLinkOperationsDependencies {
    operatorId: (c: AppContext) => string;
    /// Recent conflicts, newest first. Claims are included only when they counted a conflict.
    listConflicts: (c: AppContext, limit: number) => Promise<BuyerLinkConflictRow[]>;
    /// Who holds each record now, so an operator decides against the present state, not the audit row's.
    currentStoreHolders: (c: AppContext, storeCustomerIds: string[]) => Promise<Record<string, { buyer_account_id: string; link_basis: string }>>;
    currentOrderOwners: (c: AppContext, orderIds: string[]) => Promise<Record<string, { buyer_account_id: string; link_basis: string }>>;
    resolveStoreCustomer: (c: AppContext, params: ResolveParams & { p_store_customer_id: string }) => Promise<ResolutionOutcome>;
    resolveOrder: (c: AppContext, params: ResolveParams & { p_order_id: string }) => Promise<ResolutionOutcome>;
    // Injectable only so unit tests can bypass the permission lookup; production always uses rbac's.
    permission: typeof requirePermission;
}

const failure = (code: string, message: string) => ({ error: { code, message } });

function outcomeOf(data: unknown): ResolutionOutcome {
    return ((data ?? {}) as { outcome?: ResolutionOutcome }).outcome ?? 'order_unavailable';
}

export const defaultBuyerLinkOperationsDependencies: BuyerLinkOperationsDependencies = {
    operatorId: (c) => c.get('auth').user.id,
    listConflicts: async (c, limit) => {
        const { data, error } = await getSupabaseAdmin(c)
            .from('audit_logs')
            .select('id, action, created_at, resource_id, actor_id, metadata')
            .in('action', [...BUYER_LINK_CONFLICT_ACTIONS])
            .order('created_at', { ascending: false })
            .limit(limit * 4);
        if (error) throw error;
        return ((data || []) as BuyerLinkConflictRow[])
            .filter((row) => row.action !== 'buyer_orders.claimed'
                || (Array.isArray(row.metadata?.conflict_order_ids) && (row.metadata?.conflict_order_ids as unknown[]).length > 0))
            .slice(0, limit);
    },
    currentStoreHolders: async (c, storeCustomerIds) => {
        if (storeCustomerIds.length === 0) return {};
        const { data, error } = await getSupabaseAdmin(c)
            .from('buyer_store_customers')
            .select('store_customer_id, buyer_account_id, link_basis')
            .in('store_customer_id', storeCustomerIds);
        if (error) throw error;
        return Object.fromEntries((data || []).map((row) => [
            row.store_customer_id as string,
            { buyer_account_id: row.buyer_account_id as string, link_basis: row.link_basis as string },
        ]));
    },
    currentOrderOwners: async (c, orderIds) => {
        if (orderIds.length === 0) return {};
        const { data, error } = await getSupabaseAdmin(c)
            .from('buyer_order_links')
            .select('order_id, buyer_account_id, link_basis')
            .in('order_id', orderIds);
        if (error) throw error;
        return Object.fromEntries((data || []).map((row) => [
            row.order_id as string,
            { buyer_account_id: row.buyer_account_id as string, link_basis: row.link_basis as string },
        ]));
    },
    resolveStoreCustomer: async (c, params) => {
        const { data, error } = await getSupabaseAdmin(c).rpc('resolve_buyer_store_customer_link', params);
        if (error) throw error;
        return outcomeOf(data);
    },
    resolveOrder: async (c, params) => {
        const { data, error } = await getSupabaseAdmin(c).rpc('resolve_buyer_order_link', params);
        if (error) throw error;
        return outcomeOf(data);
    },
    permission: requirePermission,
};

const RESOLUTION_STATUS: Record<ResolutionOutcome, { status: 200 | 404 | 409 | 422; code?: string; message?: string }> = {
    resolved: { status: 200 },
    store_customer_unavailable: { status: 404, code: 'NOT_FOUND', message: 'Store customer record not found.' },
    order_unavailable: { status: 404, code: 'NOT_FOUND', message: 'Order not found.' },
    buyer_unavailable_or_unverified: { status: 422, code: 'BUYER_NOT_VERIFIED', message: 'The target buyer must be active and have a verified email address.' },
    buyer_has_other_record_at_store: { status: 409, code: 'BUYER_HAS_OTHER_RECORD', message: 'The target buyer already holds a different customer record at this store.' },
};

export function createBuyerLinkOperationsRouter(
    deps: BuyerLinkOperationsDependencies = defaultBuyerLinkOperationsDependencies,
) {
    const router = new Hono<{ Bindings: Env }>();

    // GET /operations/buyer-links/conflicts?limit=
    router.get('/conflicts', deps.permission('support:view'), async (c) => {
        const requested = Number(c.req.query('limit') || 50);
        const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 200) : 50;
        const rows = await deps.listConflicts(c, limit);
        const storeCustomerIds = rows.filter((r) => r.action === 'buyer_store_link.conflict' && r.resource_id).map((r) => r.resource_id as string);
        const orderIds = rows.flatMap((r) => (Array.isArray(r.metadata?.conflict_order_ids) ? (r.metadata?.conflict_order_ids as string[]) : []));
        const [holders, owners] = await Promise.all([
            deps.currentStoreHolders(c, [...new Set(storeCustomerIds)]),
            deps.currentOrderOwners(c, [...new Set(orderIds)]),
        ]);
        const conflicts = rows.map((row) => row.action === 'buyer_store_link.conflict'
            ? {
                id: row.id,
                kind: 'store_customer',
                created_at: row.created_at,
                store_customer_id: row.resource_id,
                site_id: row.metadata?.site_id ?? null,
                requesting_buyer_account_id: row.metadata?.requesting_buyer_account_id ?? null,
                current: row.resource_id ? holders[row.resource_id] ?? null : null,
            }
            : {
                id: row.id,
                kind: 'orders',
                created_at: row.created_at,
                // The claimant is the audit row's actor.
                requesting_buyer_account_id: row.actor_id,
                orders: ((row.metadata?.conflict_order_ids as string[]) || []).map((orderId) => ({ order_id: orderId, current: owners[orderId] ?? null })),
            });
        return c.json(success({ conflicts }));
    });

    const resolve = (kind: 'store_customer' | 'order') => async (c: AppContext): Promise<Response> => {
        const id = c.req.param('id') || '';
        if (!UUID.test(id)) return c.json(failure('VALIDATION_ERROR', `${kind === 'order' ? 'order' : 'store customer'} id must be a UUID`), 400);
        const body = await c.req.json().catch(() => null) as { buyer_account_id?: string; reason?: string } | null;
        if (!body?.buyer_account_id || !UUID.test(body.buyer_account_id)) {
            return c.json(failure('VALIDATION_ERROR', 'buyer_account_id must be a UUID'), 400);
        }
        const reason = validateSensitiveReason(body.reason);
        if (!reason) {
            return c.json(failure('REASON_REQUIRED', 'Ownership resolutions require a reason of 8 to 1000 characters.'), 400);
        }
        const operatorId = deps.operatorId(c);
        if (!UUID.test(operatorId)) {
            // A session whose operator id is not a uuid cannot be written as an audit actor: a gateway bug.
            return c.json(failure('OPERATOR_IDENTITY_INVALID', 'operator identity is not a uuid'), 500);
        }
        const common = { p_buyer_account_id: body.buyer_account_id, p_operator_id: operatorId, p_reason: reason };
        const outcome = kind === 'order'
            ? await deps.resolveOrder(c, { ...common, p_order_id: id })
            : await deps.resolveStoreCustomer(c, { ...common, p_store_customer_id: id });
        const mapped = RESOLUTION_STATUS[outcome] ?? RESOLUTION_STATUS.order_unavailable;
        if (mapped.status === 200) return c.json(success({ outcome }));
        return c.json(failure(mapped.code as string, mapped.message as string), mapped.status);
    };

    // POST /operations/buyer-links/store-customers/:id/resolve  { buyer_account_id, reason }
    router.post('/store-customers/:id/resolve', deps.permission('support:manage'), resolve('store_customer'));
    // POST /operations/buyer-links/orders/:id/resolve  { buyer_account_id, reason }
    router.post('/orders/:id/resolve', deps.permission('support:manage'), resolve('order'));

    return router;
}

const operationsBuyerLinksRouter = createBuyerLinkOperationsRouter();
export default operationsBuyerLinksRouter;
