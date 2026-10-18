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
// every call runs through the service-role client. `channel_listings`/`channel_listing_moderation_
// events` ARE registered tenant tables (unlike the sibling operations routes' own tables), so
// service_role alone does not exempt a query from the tenant guard (services/api-gateway/src/tenant/
// tenant-scoped.ts wraps getSupabaseAdmin regardless of role) -- reads here go through one of two
// narrow, allowlisted, documented exceptions instead: getSupabaseAdminUnguarded for the single-row
// bootstrap lookup (loadChannelListingById) and getSupabaseAdminForOperatorRead for the permission-
// gated cross-site queue (listListings). See both functions' doc comments in lib/supabase.ts.

import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { AppError, ForbiddenError, NotFoundError, ValidationError, formatAppError } from '../../lib/errors';
import {
    getSupabaseAdmin,
    getSupabaseAdminForOperatorRead,
    getSupabaseAdminUnguarded,
    paginated,
    shouldReturnEmptyForMissingLocalSchema,
    success,
} from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import { hasPermissionScope, loadEffectivePermissionScopes, platformEmployeeRows, requirePermission, requirePlatformOperator, validateSensitiveReason } from '../../middleware/rbac';
import { mapChannelListingDatabaseError, TRANSITION_CHANNEL_LISTING_RPC } from '../channel-listings';
import {
    OperatorListingDecisionSchema,
    OperatorListingClaimSchema,
    OperatorListingAssignmentSchema,
    OperatorListingListQuery,
    type OperatorListingDecisionInput,
    type OperatorListingClaimInput,
    type OperatorListingAssignmentInput,
    type OperatorListingListInput,
} from '../../schemas/channel-listing.schema';

type AppContext = Context<{ Bindings: Env }>;
type JsonRecord = Record<string, unknown>;

export const OPERATOR_LISTING_COLUMNS =
    'id, site_id, product_id, channel, status, visibility, marketplace_category_id, compliance_flags, submitted_at, approved_at, reviewed_at, reviewed_by, rejection_reason, assigned_reviewer_id, version, created_at, updated_at, products(name, slug, images), sites(store_name, subdomain)';
export const OPERATOR_LISTING_DETAIL_COLUMNS =
    `${OPERATOR_LISTING_COLUMNS}, submitted_product_snapshot, approved_product_snapshot, assigned_reviewer_id, reviewer_assigned_at, reviewer_assigned_by`;
export const OPERATOR_EVENT_COLUMNS = 'id, from_status, to_status, actor_realm, actor_id, reason, idempotency_key, event_type, assigned_reviewer_id, previous_assigned_reviewer_id, created_at';

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
export type ClaimParams = {
    p_site_id: string;
    p_listing_id: string;
    p_reviewer_id: string;
    p_reason: string;
    p_idempotency_key: string;
    p_expected_version: number;
};
export type ClaimResult = { listing_id: string; assigned_reviewer_id: string; version: number; event_id: string; replayed: boolean };
export type AssignmentParams = {
    p_site_id: string; p_listing_id: string; p_assigning_operator_id: string; p_reviewer_id: string;
    p_reason: string; p_idempotency_key: string; p_expected_version: number;
};
export type AssignmentResult = { listing_id: string; previous_reviewer_id: string | null; assigned_reviewer_id: string; version: number; event_id: string; replayed: boolean };
export type ReviewerSummary = { user_id: string; full_name: string | null };
export type AuditInput = {
    actor: OperatorActor;
    action: string;
    resourceId: string;
    reason: string | null;
    metadata: JsonRecord;
};

export interface MarketplaceListingsOperationsDependencies {
    authorizeOperator: (c: AppContext, userId: string) => Promise<OperatorActor>;
    listListings: (c: AppContext, query: OperatorListingListInput) => Promise<{ rows: ListingRow[]; total: number }>;
    loadListing: (c: AppContext, id: string) => Promise<ListingRow | null>;
    loadListingEvents: (c: AppContext, id: string, siteId: string) => Promise<JsonRecord[]>;
    loadReviewer: (c: AppContext, userId: string) => Promise<{ user_id: string; full_name: string | null } | null>;
    transition: (c: AppContext, params: TransitionParams) => Promise<TransitionResult>;
    claim: (c: AppContext, params: ClaimParams) => Promise<ClaimResult>;
    listEligibleReviewers: (c: AppContext) => Promise<ReviewerSummary[]>;
    authorizeReviewer: (c: AppContext, userId: string) => Promise<ReviewerSummary>;
    assignReviewer: (c: AppContext, params: AssignmentParams) => Promise<AssignmentResult>;
    writeAudit: (c: AppContext, input: AuditInput) => Promise<void>;
    // Injectable only so unit tests can bypass the permission lookup; production always uses rbac's.
    permission: typeof requirePermission;
    // Injectable only for isolated router tests; the production router admits explicit active platform tiers.
    operatorGate: typeof requirePlatformOperator;
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

// Bounded, single-row, globally-unique-key lookup with the site not yet known — exactly
// getSupabaseAdminUnguarded's documented bootstrap shape (lib/supabase.ts), not a new exception.
// A top-level declaration (not an inline arrow) so the allowlist contract test
// (__tests__/unguarded-admin-client-contract.test.ts) can find and bound it by name.
async function loadChannelListingById(c: AppContext, id: string): Promise<ListingRow | null> {
    const db = getSupabaseAdminUnguarded(c);
    const { data, error } = await db.from('channel_listings').select(OPERATOR_LISTING_DETAIL_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as unknown as ListingRow | null) ?? null;
}

async function authorizeMarketplaceListingOperator(c: AppContext, userId: string): Promise<OperatorActor> {
    const id = operatorActorId({ id: userId, email: null });
    const db = getSupabaseAdmin(c);
    const resolution = await loadEffectivePermissionScopes(db, id);
    if (!hasPermissionScope(resolution.scopes, 'review:decide')) {
        throw new ForbiddenError('The authenticated console user cannot decide marketplace listing reviews');
    }
    if (resolution.employeeId) {
        const { data, error } = await platformEmployeeRows(db, 'id, user_id, email, is_active, status')
            .eq('id', resolution.employeeId)
            .eq('user_id', id)
            .eq('is_active', true)
            .eq('status', 'active')
            .maybeSingle();
        if (error || !data) throw new ForbiddenError('Active platform reviewer membership is required');
        const employee = data as { email?: string | null };
        return { id, email: employee.email || null };
    }
    if (!resolution.isSuperAdmin) throw new ForbiddenError('Active platform reviewer membership is required');
    return { id, email: null };
}

function respond(c: AppContext, error: unknown): Response {
    const appError = error instanceof AppError ? error : mapChannelListingDatabaseError(error);
    if (!appError) throw error;
    const { body, status } = formatAppError(appError);
    return c.json(body, status as 400);
}

export const defaultMarketplaceListingsOperationsDependencies: MarketplaceListingsOperationsDependencies = {
    authorizeOperator: authorizeMarketplaceListingOperator,
    // Cross-site by design: an operator queue lists pending items from every site (the request
    // schema OperatorListingListQuery caps `limit` at 100), gated by requirePermission('review:view')
    // on the route below before this ever runs. See getSupabaseAdminForOperatorRead's doc comment.
    listListings: async (c, query) => {
        const db = getSupabaseAdminForOperatorRead(c);
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
    loadListing: loadChannelListingById,
    // The listing's site_id is already known by every caller (loadListing ran first), so this reads
    // as an ordinary single-tenant query through the DEFAULT guarded client — no bypass needed here.
    loadListingEvents: async (c, id, siteId) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('channel_listing_moderation_events')
            .select(OPERATOR_EVENT_COLUMNS)
            .eq('listing_id', id)
            .eq('site_id', siteId)
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        return (data || []) as JsonRecord[];
    },
    loadReviewer: async (c, userId) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await platformEmployeeRows(db, 'user_id, full_name')
            .eq('user_id', userId)
            .eq('is_active', true)
            .eq('status', 'active')
            .maybeSingle();
        if (error) throw error;
        return data ? data as unknown as { user_id: string; full_name: string | null } : null;
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
    claim: async (c, params) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db.rpc('claim_marketplace_listing_review', params);
        if (error) throw error;
        const rows = (Array.isArray(data) ? data : [data]) as ClaimResult[];
        const row = rows[0];
        if (!row) throw new NotFoundError('Listing not found');
        return row;
    },
    listEligibleReviewers: async (c) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await platformEmployeeRows(db, 'user_id, full_name')
            .in('role', ['operations', 'manager', 'admin'])
            .eq('is_active', true)
            .eq('status', 'active')
            .not('user_id', 'is', null)
            .order('full_name', { ascending: true })
            .limit(100);
        if (error) throw error;
        return (data || []) as unknown as ReviewerSummary[];
    },
    authorizeReviewer: async (c, userId) => {
        const id = operatorActorId({ id: userId, email: null });
        const db = getSupabaseAdmin(c);
        const { data, error } = await platformEmployeeRows(db, 'user_id, full_name, role, is_active, status')
            .eq('user_id', id).in('role', ['operations', 'manager', 'admin']).eq('is_active', true).eq('status', 'active').maybeSingle();
        if (error || !data) throw new ForbiddenError('The assigned reviewer must be an active platform lead or admin');
        return data as unknown as ReviewerSummary;
    },
    assignReviewer: async (c, params) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db.rpc('assign_marketplace_listing_reviewer', params);
        if (error) throw error;
        const rows = (Array.isArray(data) ? data : [data]) as AssignmentResult[];
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
    operatorGate: requirePlatformOperator,
};

export function createMarketplaceListingsOperationsRouter(
    deps: MarketplaceListingsOperationsDependencies = defaultMarketplaceListingsOperationsDependencies,
) {
    const router = new Hono<{ Bindings: Env }>();

    // This router sits before incident-command's broad /operations super-admin gate. Give it the
    // same explicit active-platform tier boundary as support, then let each endpoint enforce its
    // narrower review permission. Review assignment is lead-only; viewing remains reviewer-safe.
    router.use('*', deps.operatorGate({ admittedTiers: ['viewer', 'operator', 'lead'] }));

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

    router.get('/reviewers', deps.permission('review:assign'), async (c) => {
        try { return c.json(success(await deps.listEligibleReviewers(c))); }
        catch (error) { return respond(c, error); }
    });

    // GET /operations/marketplace-listings/:id — the listing and its moderation history
    router.get('/:id', deps.permission('review:view'), async (c) => {
        try {
            const id = listingIdParam(c);
            const listing = await deps.loadListing(c, id);
            if (!listing) throw new NotFoundError('Listing not found');
            const [events, assignedReviewer] = await Promise.all([
                deps.loadListingEvents(c, id, listing.site_id),
                typeof listing.assigned_reviewer_id === 'string'
                    ? deps.loadReviewer(c, listing.assigned_reviewer_id)
                    : Promise.resolve(null),
            ]);
            return c.json(success({ listing: { ...listing, assigned_reviewer: assignedReviewer }, events }));
        } catch (error) {
            return respond(c, error);
        }
    });

    // A reviewer may claim an unassigned pending listing for themselves. The RPC writes both the
    // assignment and append-only assignment event atomically, and its version check rejects stale UI.
    router.post('/:id/claim', deps.permission('review:decide'), validate('json', OperatorListingClaimSchema), async (c) => {
        try {
            const id = listingIdParam(c);
            const body = c.get('validatedBody') as OperatorListingClaimInput;
            const actorId = operatorActorId(await deps.authorizeOperator(c, body.operator_user_id));
            const listing = await deps.loadListing(c, id);
            if (!listing) throw new NotFoundError('Listing not found');
            const result = await deps.claim(c, {
                p_site_id: listing.site_id,
                p_listing_id: id,
                p_reviewer_id: actorId,
                p_reason: body.reason,
                p_idempotency_key: body.idempotency_key,
                p_expected_version: body.expected_version,
            });
            return c.json(success(result));
        } catch (error) {
            return respond(c, error);
        }
    });

    router.post('/:id/assign', deps.permission('review:assign'), validate('json', OperatorListingAssignmentSchema), async (c) => {
        try {
            const id = listingIdParam(c);
            const body = c.get('validatedBody') as OperatorListingAssignmentInput;
            const actorId = operatorActorId(await deps.authorizeOperator(c, body.operator_user_id));
            if (actorId === body.assignee_user_id) throw new ValidationError('Choose another active platform lead to assign this review');
            await deps.authorizeReviewer(c, body.assignee_user_id);
            const listing = await deps.loadListing(c, id);
            if (!listing) throw new NotFoundError('Listing not found');
            const result = await deps.assignReviewer(c, {
                p_site_id: listing.site_id,
                p_listing_id: id,
                p_assigning_operator_id: actorId,
                p_reviewer_id: body.assignee_user_id,
                p_reason: body.reason,
                p_idempotency_key: body.idempotency_key,
                p_expected_version: body.expected_version,
            });
            return c.json(success(result));
        } catch (error) { return respond(c, error); }
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
                const actor = await deps.authorizeOperator(c, body.operator_user_id);
                const actorId = operatorActorId(actor);
                const listing = await deps.loadListing(c, id);
                if (!listing) throw new NotFoundError('Listing not found');
                if (decision !== 'take_down' && listing.assigned_reviewer_id !== actorId) {
                    throw new ForbiddenError('Claim this pending listing before recording its review decision');
                }
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
