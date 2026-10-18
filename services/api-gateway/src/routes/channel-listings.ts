// Channel listings — merchant realm (phase MKT-1; schema: migration 217; design:
// docs/architecture/MARKETPLACE_CHANNEL_MODEL.md).
//
// Every read and write here runs as `app_tenant` inside the tenant transaction (withResolvedTenantTx:
// SET LOCAL ROLE app_tenant + app.site_id from the resolved owned-store scope), so RLS on
// channel_listings scopes the query and transition_channel_listing's merchant fence sees the GUC it
// requires. The site is never taken from the request body — `store_id` in the body only selects which
// owned store to resolve, and resolveOwnedStoreScope refuses a store the caller does not own.
//
// There is deliberately NO service_role path in this file: when the pooled SQL connection is not
// configured the write routes answer 503 TENANT_TX_UNAVAILABLE. Falling back to the admin client
// would bypass the database fence, which is exactly the boundary the Constitution makes canonical.

import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { AppError, ConflictError, ForbiddenError, NotFoundError, formatAppError } from '../lib/errors';
import { paginated, success } from '../lib/supabase';
import {
    resolveOwnedStoreScope as resolveOwnedStoreScopeFromGateway,
    withResolvedTenantTx as withResolvedTenantTxFromGateway,
    type OwnedStoreScope,
    type TenantContext,
} from '../lib/tenant-context';
import { TenantTransactionUnavailableError } from '../lib/tenant-transaction';
import { validate } from '../middleware/validation';
import {
    CreateChannelListingSchema,
    GetChannelListingQuery,
    ListChannelListingsQuery,
    ResubmitRejectedChannelListingSchema,
    TransitionChannelListingSchema,
    UpdateChannelListingSchema,
    type CreateChannelListingInput,
    type GetChannelListingInput,
    type ListChannelListingsInput,
    type ResubmitRejectedChannelListingInput,
    type TransitionChannelListingInput,
    type UpdateChannelListingInput,
} from '../schemas/channel-listing.schema';

type AppContext = Context<{ Bindings: Env }>;

export const TRANSITION_CHANNEL_LISTING_RPC = 'transition_channel_listing';
export const CHANNEL_LISTING_COLUMNS =
    'id, site_id, product_id, channel, status, visibility, marketplace_category_id, pricing_policy, compliance_flags, submitted_at, approved_at, reviewed_at, rejection_reason, version, created_at, updated_at';
// The seven positional parameters of transition_channel_listing, in 217's declared order.
export const TRANSITION_SQL = `select listing_id, from_status, to_status, event_id, replayed from public.${TRANSITION_CHANNEL_LISTING_RPC}($1, $2, $3, $4, $5, $6, $7)`;
export const RESUBMIT_CHANNEL_LISTING_SQL = 'select listing_id, from_status, to_status, event_id, replayed from public.resubmit_rejected_marketplace_listing($1, $2, $3, $4, $5)';

export type TenantSql = { unsafe: (query: string, parameters?: unknown[]) => Promise<unknown> };
export type ChannelListingScope = Pick<OwnedStoreScope, 'siteId' | 'customUser' | 'tenant'>;

export interface ChannelListingRouteDependencies {
    resolveOwnedStoreScope: (c: AppContext, siteId: string) => Promise<ChannelListingScope>;
    withResolvedTenantTx: <T>(c: AppContext, tenant: Pick<TenantContext, 'siteId' | 'requestId'>, callback: (sql: TenantSql) => Promise<T>) => Promise<T>;
}

export const defaultChannelListingRouteDependencies: ChannelListingRouteDependencies = {
    resolveOwnedStoreScope: (c, siteId) => resolveOwnedStoreScopeFromGateway(c, siteId),
    withResolvedTenantTx: (c, tenant, callback) =>
        withResolvedTenantTxFromGateway(c, tenant, (sql) => callback(sql as unknown as TenantSql)),
};

type ChannelListingRow = Record<string, unknown> & { id: string; site_id: string; status: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function listingIdParam(c: AppContext): string {
    const id = c.req.param('id') || '';
    if (!UUID.test(id)) throw new AppError('listing id must be a UUID', 400, 'VALIDATION_ERROR');
    return id;
}

// Postgres → HTTP. Messages are 217's own RAISE texts; codes are SQLSTATE. Anything unrecognised is
// rethrown so the global handler logs it as an unexpected error instead of masking a real bug.
export function mapChannelListingDatabaseError(error: unknown): AppError | null {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
    if (/idempotency_key_conflict/.test(message)) return new ConflictError('this resubmission key was already used for a different correction request');
    if (code === '23505') return new ConflictError('a listing for this product and channel already exists');
    if (code === '42501' || /row-level security/i.test(message)) return new ForbiddenError('Not authorized for this store');
    if (/must match the product's site/.test(message)) return new AppError('product does not belong to this store', 422, 'UNPROCESSABLE');
    if (/invalid_transition/.test(message)) return new ConflictError('this transition is not allowed from the listing\'s current status');
    if (/listing_already_claimed/.test(message)) return new ConflictError('this listing has already been claimed by another reviewer');
    if (/stale_listing_version/.test(message)) return new ConflictError('this listing changed; refresh before claiming it');
    if (/idempotency_key_conflict/.test(message)) return new ConflictError('this idempotency key was already used for a different reviewer claim');
    if (/listing is not awaiting review/.test(message)) return new ConflictError('only pending marketplace listings can be claimed');
    if (/listing not found/.test(message)) return new NotFoundError('Listing not found');
    if (/marketplace_category_id/.test(message)) return new AppError('a marketplace category is required before review', 422, 'UNPROCESSABLE');
    if (/product is not sellable/.test(message)) return new AppError('the product is inactive or deleted', 422, 'UNPROCESSABLE');
    if (/reason is required/.test(message)) return new AppError('a reason is required', 422, 'UNPROCESSABLE');
    if (/tenant context required/.test(message)) {
        // A merchant route that reaches the RPC without the GUC is a gateway bug, not a client error.
        return new AppError('tenant context was not established', 500, 'TENANT_CONTEXT_MISSING');
    }
    return null;
}

function respond(c: AppContext, error: unknown): Response {
    if (error instanceof TenantTransactionUnavailableError) {
        const { body, status } = formatAppError(new AppError('Tenant transaction unavailable', 503, 'TENANT_TX_UNAVAILABLE'));
        return c.json(body, status as 503);
    }
    const appError = error instanceof AppError ? error : mapChannelListingDatabaseError(error);
    if (!appError) throw error;
    const { body, status } = formatAppError(appError);
    return c.json(body, status as 400);
}

export function createChannelListingsRouter(deps: ChannelListingRouteDependencies = defaultChannelListingRouteDependencies) {
    const router = new Hono<{ Bindings: Env }>();

    // GET /channel-listings?store_id=&channel=&status=&page=&limit=
    router.get('/', validate('query', ListChannelListingsQuery), async (c) => {
        const query = c.get('validatedQuery') as ListChannelListingsInput;
        try {
            const scope = await deps.resolveOwnedStoreScope(c, query.store_id);
            const offset = (query.page - 1) * query.limit;
            const { rows, total } = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(
                    `select ${CHANNEL_LISTING_COLUMNS} from public.channel_listings where site_id = $1 and ($2::text is null or channel = $2) and ($3::text is null or status = $3) and ($4::uuid is null or product_id = $4) order by created_at desc, id desc limit $5 offset $6`,
                    [scope.siteId, query.channel ?? null, query.status ?? null, query.product_id ?? null, query.limit, offset],
                )) as ChannelListingRow[];
                const counted = (await sql.unsafe(
                    'select count(*)::int as total from public.channel_listings where site_id = $1 and ($2::text is null or channel = $2) and ($3::text is null or status = $3) and ($4::uuid is null or product_id = $4)',
                    [scope.siteId, query.channel ?? null, query.status ?? null, query.product_id ?? null],
                )) as Array<{ total: number }>;
                return { rows, total: counted[0]?.total ?? rows.length };
            });
            return c.json(paginated(rows, total, query.page, query.limit));
        } catch (error) {
            return respond(c, error);
        }
    });

    // POST /channel-listings — create a DRAFT listing (status moves only through the transition RPC)
    router.post('/', validate('json', CreateChannelListingSchema), async (c) => {
        const body = c.get('validatedBody') as CreateChannelListingInput;
        try {
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const row = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const inserted = (await sql.unsafe(
                    `insert into public.channel_listings (site_id, product_id, channel, marketplace_category_id, visibility, pricing_policy, created_by, updated_by) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $7) returning ${CHANNEL_LISTING_COLUMNS}`,
                    [
                        scope.siteId,
                        body.product_id,
                        body.channel,
                        body.marketplace_category_id ?? null,
                        body.visibility,
                        JSON.stringify(body.pricing_policy ?? {}),
                        scope.customUser.id,
                    ],
                )) as ChannelListingRow[];
                return inserted[0];
            });
            return c.json(success(row), 201);
        } catch (error) {
            return respond(c, error);
        }
    });

    // GET /channel-listings/:id?store_id=
    router.get('/:id', validate('query', GetChannelListingQuery), async (c) => {
        const query = c.get('validatedQuery') as GetChannelListingInput;
        try {
            const id = listingIdParam(c);
            const scope = await deps.resolveOwnedStoreScope(c, query.store_id);
            const row = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(
                    `select ${CHANNEL_LISTING_COLUMNS} from public.channel_listings where id = $1 and site_id = $2`,
                    [id, scope.siteId],
                )) as ChannelListingRow[];
                return rows[0] ?? null;
            });
            if (!row) throw new NotFoundError('Listing not found');
            return c.json(success(row));
        } catch (error) {
            return respond(c, error);
        }
    });

    // PATCH /channel-listings/:id — merchant-editable fields only; `status` is not in the schema
    router.patch('/:id', validate('json', UpdateChannelListingSchema), async (c) => {
        const body = c.get('validatedBody') as UpdateChannelListingInput;
        try {
            const id = listingIdParam(c);
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const sets: string[] = [];
            const params: unknown[] = [];
            const bind = (value: unknown) => {
                params.push(value);
                return `$${params.length}`;
            };
            if (body.marketplace_category_id !== undefined) sets.push(`marketplace_category_id = ${bind(body.marketplace_category_id)}`);
            if (body.visibility !== undefined) sets.push(`visibility = ${bind(body.visibility)}`);
            if (body.pricing_policy !== undefined) sets.push(`pricing_policy = ${bind(JSON.stringify(body.pricing_policy))}::jsonb`);
            sets.push(`updated_by = ${bind(scope.customUser.id)}`);
            const whereId = bind(id);
            const whereSite = bind(scope.siteId);
            const row = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(
                    `update public.channel_listings set ${sets.join(', ')} where id = ${whereId} and site_id = ${whereSite} returning ${CHANNEL_LISTING_COLUMNS}`,
                    params,
                )) as ChannelListingRow[];
                return rows[0] ?? null;
            });
            if (!row) throw new NotFoundError('Listing not found');
            return c.json(success(row));
        } catch (error) {
            return respond(c, error);
        }
    });

    // POST /channel-listings/:id/transition — merchant edges only, through the RPC, inside the tenant tx
    router.post('/:id/transition', validate('json', TransitionChannelListingSchema), async (c) => {
        const body = c.get('validatedBody') as TransitionChannelListingInput;
        try {
            const id = listingIdParam(c);
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const result = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(TRANSITION_SQL, [
                    scope.siteId,
                    id,
                    body.to_status,
                    'merchant',
                    scope.customUser.id,
                    body.reason ?? null,
                    body.idempotency_key,
                ])) as Array<{ listing_id: string; from_status: string; to_status: string; event_id: string; replayed: boolean }>;
                return rows[0] ?? null;
            });
            if (!result) throw new NotFoundError('Listing not found');
            return c.json(success(result));
        } catch (error) {
            return respond(c, error);
        }
    });

    // Resubmit a rejected marketplace revision atomically. The RPC runs inside the same validated
    // tenant transaction and records the merchant's correction note with the new submitted snapshot.
    router.post('/:id/resubmit', validate('json', ResubmitRejectedChannelListingSchema), async (c) => {
        const body = c.get('validatedBody') as ResubmitRejectedChannelListingInput;
        try {
            const id = listingIdParam(c);
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const result = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(RESUBMIT_CHANNEL_LISTING_SQL, [
                    scope.siteId,
                    id,
                    scope.customUser.id,
                    body.reason,
                    body.idempotency_key,
                ])) as Array<{ listing_id: string; from_status: string; to_status: string; event_id: string; replayed: boolean }>;
                return rows[0] ?? null;
            });
            if (!result) throw new NotFoundError('Listing not found');
            return c.json(success(result));
        } catch (error) {
            return respond(c, error);
        }
    });

    return router;
}

const channelListingsRouter = createChannelListingsRouter();
export default channelListingsRouter;
