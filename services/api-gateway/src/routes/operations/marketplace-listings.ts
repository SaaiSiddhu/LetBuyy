// Marketplace listing moderation — operator realm (phase ADM-1; schema: migration 217; design:
// docs/architecture/MARKETPLACE_CHANNEL_MODEL.md §4–§5).
//
// The operator half of the listing state machine: list pending marketplace listings across sites,
// inspect one with its moderation events, and approve / reject / take down through
// transition_channel_listing with p_actor_realm = 'operator'. Mirrors operations/marketplace-reviews.ts:
// per-route requirePermission('review:view' | 'review:decide'), validateSensitiveReason for the two
// negative decisions, and an audit_logs row per decision naming the operator.
//
// Two invariants of 217's realm fence are honoured by construction: an operator never acts inside a
// tenant transaction (this file imports neither withResolvedTenantTx nor resolveOwnedStoreScope), and
// the call runs through the admin client, whose PostgREST role is service_role with no tenant GUC.
// Cross-site reads are the operator realm's purpose, exactly as the existing operations routes do.

import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { AppError, NotFoundError, ValidationError, formatAppError } from '../../lib/errors';
import { getSupabaseAdmin, paginated, shouldReturnEmptyForMissingLocalSchema, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import { requirePermission, validateSensitiveReason } from '../../middleware/rbac';
import { mapChannelListingDatabaseError, TRANSITION_CHANNEL_LISTING_RPC } from '../channel-listings';
import {
    OperatorListingDecisionSchema,
    OperatorListingListQuery,
    type OperatorListingDecisionInput,
    type OperatorListingListInput,
} from '../../schemas/channel-listing.schema';

type AppContext = Context<{ Bindings: Env }>;
type JsonRecord = Record<string, unknown>;

export const OPERATOR_LISTING_COLUMNS =
    'id, site_id, product_id, channel, status, visibility, marketplace_category_id, compliance_flags, submitted_at, approved_at, reviewed_at, reviewed_by, rejection_reason, version, created_at, updated_at, products(name, slug, images), sites(store_name, subdomain)';
export const OPERATOR_EVENT_COLUMNS = 'id, from_status, to_status, actor_realm, actor_id, reason, idempotency_key, created_at';

export type OperatorDecision = 'approve' | 'reject' | 'take_down';
// The operator edges of 217's matrix (§4): pending_review → approved | rejected; approved → delisted.
export const DECISION_TARGET: Record<OperatorDecision, 'approved' | 'rejected' | 'delisted'> = {
    approve: 'approved',
    reject: 'rejected',
    take_down: 'delisted',
};

export type OperatorActor = { id: string; email: string | null };
export type ListingRow = JsonRecord & { id: string; site_id: string; status: string };
export type TransitionParams = {
    p_site_id: string;
    p_listing_id: string;
    p_to_status: 'approved' | 'rejected' | 'delisted';
    p_actor_realm: 'operator';
    p_actor_id: string;
    p_reason: string | null;
    p_idempotency_key: string;
};
export type TransitionResult = { listing_id: string; from_status: string; to_status: string; event_id: string; replayed: boolean };
export type AuditInput = {
    actor: OperatorActor;
    action: string;
    resourceId: string;
    reason: string | null;
    metadata: JsonRecord;
};

export interface MarketplaceListingsOperationsDependencies {
    actor: (c: AppContext) => OperatorActor;
    listListings: (c: AppContext, query: OperatorListingListInput) => Promise<{ rows: ListingRow[]; total: number }>;
    loadListing: (c: AppContext, id: string) => Promise<ListingRow | null>;
    loadListingEvents: (c: AppContext, id: string) => Promise<JsonRecord[]>;
    transition: (c: AppContext, params: TransitionParams) => Promise<TransitionResult>;
    writeAudit: (c: AppContext, input: AuditInput) => Promise<void>;
    // Injectable only so unit tests can bypass the permission lookup; production always uses rbac's.
    permission: typeof requirePermission;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function listingIdParam(c: AppContext): string {
    const id = c.req.param('id') || '';
    if (!UUID.test(id)) throw new AppError('listing id must be a UUID', 400, 'VALIDATION_ERROR');
    return id;
}

// An operator id that is not a uuid cannot be written to channel_listing_moderation_events.actor_id;
// that is a gateway/session bug, never a client error.
function operatorActorId(actor: OperatorActor): string {
    if (!UUID.test(actor.id)) throw new AppError('operator identity is not a uuid', 500, 'OPERATOR_IDENTITY_INVALID');
    return actor.id;
}

function respond(c: AppContext, error: unknown): Response {
    const appError = error instanceof AppError ? error : mapChannelListingDatabaseError(error);
    if (!appError) throw error;
    const { body, status } = formatAppError(appError);
    return c.json(body, status as 400);
}

export const defaultMarketplaceListingsOperationsDependencies: MarketplaceListingsOperationsDependencies = {
    actor: (c) => ({ id: c.get('auth').user.id, email: c.get('auth').user.email || null }),
    listListings: async (c, query) => {
        const db = getSupabaseAdmin(c);
        const from = (query.page - 1) * query.limit;
        let request = db
            .from('channel_listings')
            .select(OPERATOR_LISTING_COLUMNS, { count: 'exact' })
            .eq('channel', query.channel)
            .eq('status', query.status)
            .order('submitted_at', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true })
            .range(from, from + query.limit - 1);
        if (query.site_id) request = request.eq('site_id', query.site_id);
        const { data, error, count } = await request;
        if (error) {
            if (shouldReturnEmptyForMissingLocalSchema(c.env, error)) return { rows: [], total: 0 };
            throw error;
        }
        return { rows: (data || []) as unknown as ListingRow[], total: count ?? (data?.length || 0) };
    },
    loadListing: async (c, id) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db.from('channel_listings').select(OPERATOR_LISTING_COLUMNS).eq('id', id).maybeSingle();
        if (error) throw error;
        return (data as unknown as ListingRow | null) ?? null;
    },
    loadListingEvents: async (c, id) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('channel_listing_moderation_events')
            .select(OPERATOR_EVENT_COLUMNS)
            .eq('listing_id', id)
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        return (data || []) as JsonRecord[];
    },
    transition: async (c, params) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db.rpc(TRANSITION_CHANNEL_LISTING_RPC, params);
        if (error) throw error;
        const rows = (Array.isArray(data) ? data : [data]) as TransitionResult[];
        const row = rows[0];
        if (!row) throw new NotFoundError('Listing not found');
        return row;
    },
    writeAudit: async (c, input) => {
        const db = getSupabaseAdmin(c);
        const { error } = await db.from('audit_logs').insert({
            actor_id: input.actor.id,
            actor_type: 'employee',
            actor_email: input.actor.email,
            action: input.action,
            resource_type: 'channel_listing',
            resource_id: input.resourceId,
            metadata: { ...input.metadata, reason: input.reason },
        });
        if (error) throw error;
    },
    permission: requirePermission,
};

export function createMarketplaceListingsOperationsRouter(
    deps: MarketplaceListingsOperationsDependencies = defaultMarketplaceListingsOperationsDependencies,
) {
    const router = new Hono<{ Bindings: Env }>();

    // GET /operations/marketplace-listings?status=&channel=&site_id=&page=&limit=
    router.get('/', deps.permission('review:view'), validate('query', OperatorListingListQuery), async (c) => {
        const query = c.get('validatedQuery') as OperatorListingListInput;
        try {
            const { rows, total } = await deps.listListings(c, query);
            return c.json(paginated(rows, total, query.page, query.limit));
        } catch (error) {
            return respond(c, error);
        }
    });

    // GET /operations/marketplace-listings/:id — the listing and its moderation history
    router.get('/:id', deps.permission('review:view'), async (c) => {
        try {
            const id = listingIdParam(c);
            const listing = await deps.loadListing(c, id);
            if (!listing) throw new NotFoundError('Listing not found');
            const events = await deps.loadListingEvents(c, id);
            return c.json(success({ listing, events }));
        } catch (error) {
            return respond(c, error);
        }
    });

    const decide = (decision: OperatorDecision, action: string) =>
        async (c: AppContext): Promise<Response> => {
            try {
                const id = listingIdParam(c);
                const body = c.get('validatedBody') as OperatorListingDecisionInput;
                const negative = decision !== 'approve';
                const reason = validateSensitiveReason(body.reason);
                if (negative && !reason) {
                    // Same code and shape marketplace-reviews uses for the same rule.
                    return c.json({ error: { code: 'REASON_REQUIRED', message: 'Listing rejections and take-downs require a reason of 8 to 1000 characters.' } }, 400);
                }
                const actor = deps.actor(c);
                const actorId = operatorActorId(actor);
                const listing = await deps.loadListing(c, id);
                if (!listing) throw new NotFoundError('Listing not found');
                const result = await deps.transition(c, {
                    p_site_id: listing.site_id,
                    p_listing_id: id,
                    p_to_status: DECISION_TARGET[decision],
                    p_actor_realm: 'operator',
                    p_actor_id: actorId,
                    p_reason: reason ?? (body.reason ? body.reason : null),
                    p_idempotency_key: body.idempotency_key,
                });
                await deps.writeAudit(c, {
                    actor,
                    action,
                    resourceId: id,
                    reason: reason ?? null,
                    metadata: {
                        site_id: listing.site_id,
                        from_status: result.from_status,
                        to_status: result.to_status,
                        event_id: result.event_id,
                        replayed: result.replayed,
                        idempotency_key: body.idempotency_key,
                    },
                });
                return c.json(success(result));
            } catch (error) {
                return respond(c, error);
            }
        };

    // POST /operations/marketplace-listings/:id/approve|reject|take-down
    router.post('/:id/approve', deps.permission('review:decide'), validate('json', OperatorListingDecisionSchema), decide('approve', 'marketplace_listing.approve'));
    router.post('/:id/reject', deps.permission('review:decide'), validate('json', OperatorListingDecisionSchema), decide('reject', 'marketplace_listing.reject'));
    router.post('/:id/take-down', deps.permission('review:decide'), validate('json', OperatorListingDecisionSchema), decide('take_down', 'marketplace_listing.take_down'));

    return router;
}

// ValidationError is referenced so the typed 400 path stays importable for callers that extend this router.
export type { ValidationError as OperatorListingValidationError };

const operationsMarketplaceListingsRouter = createMarketplaceListingsOperationsRouter();
export default operationsMarketplaceListingsRouter;
