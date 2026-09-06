// Merchant ad campaigns and prepaid credits (phase F-ADS-2; schema: migrations 232, 236 and 238).
//
// Before this router existed the ad-credit money path had NO merchant entry point at all:
// `record_ad_credit_purchase` and `allocate_ad_campaign_budget` were named by one test file and
// nothing else, and `ad_campaigns` / `ad_campaign_placements` had no CRUD. Only the buyer-facing
// sponsored read was wired. A merchant could not create a campaign, sponsor a product, or move a
// paisa of prepaid credit.
//
// Everything here runs INSIDE the tenant transaction (withResolvedTenantTx: SET LOCAL ROLE app_tenant
// + app.site_id from the resolved owned-store scope). That is what makes 238's tenant fence
// load-bearing — allocate_ad_campaign_budget refuses any site other than the one the transaction is
// scoped to — and it is why there is no service_role fallback: when the pooled connection is
// unavailable these routes answer 503 rather than reaching for the admin client, which would bypass
// both the fence and RLS.
//
// THE BUDGET NEVER MOVES FROM TYPESCRIPT. `allocated_minor` is absent from every insert and update
// below; it moves only through the RPC, which writes a matching `allocated` ledger entry in the same
// transaction. Migration 236 makes the direct write impossible at the database as well — a
// column-level grant withholds `allocated_minor` from `service_role` — so this is belt and braces,
// not a convention.
//
// WHAT IS DELIBERATELY MISSING: buying credits. `record_ad_credit_purchase` requires a verified
// payment reference, and Razorpay verification in this repository is bound to `orders` — it fetches
// the order, checks `payment_status`, and fails closed unless `orders.payment_id` matches the
// provider order id. A merchant buying ad credits is not a storefront order, so wiring it means
// either inventing an `orders` row for a platform charge, or building a SECOND Razorpay verification
// path (which 232's own comment forbids), or riding `billing`'s mandate model, whose payment id is
// currently the placeholder `sandbox_autopay_payment:<key>`. That is a decision about how the
// platform charges a merchant, and it belongs to the owner. Until then a merchant has no credits and
// the allocation route refuses for want of an account — which is the honest behaviour, not a bug.

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
    AdAccountQuery,
    AdPlacementQuery,
    AllocateAdBudgetSchema,
    CreateAdCampaignSchema,
    CreateAdPlacementSchema,
    ListAdCampaignsQuery,
    UpdateAdCampaignSchema,
    type AdAccountInput,
    type AdPlacementInput,
    type AllocateAdBudgetInput,
    type CreateAdCampaignInput,
    type CreateAdPlacementInput,
    type ListAdCampaignsInput,
    type UpdateAdCampaignInput,
} from '../schemas/ads.schema';

type AppContext = Context<{ Bindings: Env }>;

export const ALLOCATE_AD_BUDGET_RPC = 'allocate_ad_campaign_budget';
// allocated_minor is READ here and never written. Its absence from every write below is the point.
export const AD_CAMPAIGN_COLUMNS =
    'id, site_id, name, status, allocated_minor, starts_at, ends_at, created_at, updated_at';
export const AD_PLACEMENT_COLUMNS = 'id, campaign_id, product_id, "position", is_active, created_at';
// The six positional parameters of allocate_ad_campaign_budget, in 232's declared order.
export const ALLOCATE_AD_BUDGET_SQL =
    `select public.${ALLOCATE_AD_BUDGET_RPC}($1::uuid, $2::uuid, $3::bigint, $4::text, $5::text, $6::uuid) as result`;

export type TenantSql = { unsafe: (query: string, parameters?: unknown[]) => Promise<unknown> };
export type AdsScope = Pick<OwnedStoreScope, 'siteId' | 'customUser' | 'tenant'>;

export interface AdsRouteDependencies {
    resolveOwnedStoreScope: (c: AppContext, siteId: string) => Promise<AdsScope>;
    withResolvedTenantTx: <T>(
        c: AppContext,
        tenant: Pick<TenantContext, 'siteId' | 'requestId'>,
        callback: (sql: TenantSql) => Promise<T>,
    ) => Promise<T>;
}

export const defaultAdsRouteDependencies: AdsRouteDependencies = {
    resolveOwnedStoreScope: (c, siteId) => resolveOwnedStoreScopeFromGateway(c, siteId),
    withResolvedTenantTx: (c, tenant, callback) =>
        withResolvedTenantTxFromGateway(c, tenant, (sql) => callback(sql as unknown as TenantSql)),
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function uuidParam(c: AppContext, name: string): string {
    const id = c.req.param(name) || '';
    if (!UUID.test(id)) throw new AppError(`${name} must be a UUID`, 400, 'VALIDATION_ERROR');
    return id;
}

// Postgres → HTTP. Messages are 232's and 238's own RAISE texts; codes are SQLSTATE.
export function mapAdsDatabaseError(error: unknown): AppError | null {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
    if (code === '42501' || /row-level security/i.test(message)) return new ForbiddenError('Not authorized for this store');
    if (/tenant context .* does not match the requested site/.test(message)) {
        return new AppError('tenant context did not match the requested store', 500, 'TENANT_CONTEXT_MISMATCH');
    }
    // Prepaid, per D-5: there is no overdraft because an overdraft is credit extended.
    if (/insufficient ad credits/.test(message)) {
        return new AppError('not enough prepaid ad credits for this allocation', 422, 'INSUFFICIENT_AD_CREDITS');
    }
    if (/no prepaid ad credit account/.test(message)) {
        return new AppError('this store has no ad credit balance yet', 422, 'NO_AD_CREDIT_ACCOUNT');
    }
    if (/campaign .* does not belong to site/.test(message)) return new NotFoundError('Campaign not found');
    if (/ad credit account is /.test(message)) return new ConflictError('the ad credit account is not active');
    if (/allocation must be greater than zero/.test(message)) return new AppError('amount_minor must be greater than zero', 422, 'UNPROCESSABLE');
    if (code === '23505') return new ConflictError('this product is already placed in the campaign');
    if (code === '23503') return new AppError('the product or campaign does not belong to this store', 422, 'UNPROCESSABLE');
    return null;
}

function respond(c: AppContext, error: unknown): Response {
    if (error instanceof TenantTransactionUnavailableError) {
        const { body, status } = formatAppError(new AppError('Tenant transaction unavailable', 503, 'TENANT_TX_UNAVAILABLE'));
        return c.json(body, status as 503);
    }
    const appError = error instanceof AppError ? error : mapAdsDatabaseError(error);
    if (!appError) throw error;
    const { body, status } = formatAppError(appError);
    return c.json(body, status as 400);
}

export function createAdsRouter(deps: AdsRouteDependencies = defaultAdsRouteDependencies) {
    const router = new Hono<{ Bindings: Env }>();

    // GET /ads/account?store_id=&limit= — prepaid balance and the recent ledger.
    router.get('/account', validate('query', AdAccountQuery), async (c) => {
        const query = c.get('validatedQuery') as AdAccountInput;
        try {
            const scope = await deps.resolveOwnedStoreScope(c, query.store_id);
            const result = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const accounts = (await sql.unsafe(
                    'select id, status, currency, created_at from public.ad_credit_accounts where site_id = $1',
                    [scope.siteId],
                )) as Array<{ id: string; status: string; currency: string; created_at: string }>;
                if (!accounts[0]) return { account: null, balance_minor: 0, entries: [] };

                // The balance is the database's own projection. Summing entries here would be a
                // SECOND projection of a money balance, and the two would eventually disagree.
                const balance = (await sql.unsafe(
                    'select public.ad_credit_balance_minor($1) as balance_minor',
                    [accounts[0].id],
                )) as Array<{ balance_minor: number | string }>;
                const entries = (await sql.unsafe(
                    `select id, entry_type, amount_minor, balance_after_minor, campaign_id, created_at
                       from public.ad_credit_ledger_entries
                      where site_id = $1 order by created_at desc, id desc limit $2`,
                    [scope.siteId, query.limit],
                )) as Array<Record<string, unknown>>;
                return { account: accounts[0], balance_minor: Number(balance[0]?.balance_minor ?? 0), entries };
            });
            // No account is a real state, not an error: it means no credits have ever entered.
            return c.json(success({ store_id: scope.siteId, funded: result.account !== null, ...result }));
        } catch (error) {
            return respond(c, error);
        }
    });

    // GET /ads/campaigns?store_id=&status=&page=&limit=
    router.get('/campaigns', validate('query', ListAdCampaignsQuery), async (c) => {
        const query = c.get('validatedQuery') as ListAdCampaignsInput;
        try {
            const scope = await deps.resolveOwnedStoreScope(c, query.store_id);
            const offset = (query.page - 1) * query.limit;
            const { rows, total } = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                // spent_minor is the ledger projection, never a stored counter: System A kept
                // spentToday/spentTotal as mutable fields and concurrent spend silently lost itself.
                const rows = (await sql.unsafe(
                    `select ${AD_CAMPAIGN_COLUMNS}, public.ad_campaign_spent_minor(id) as spent_minor
                       from public.ad_campaigns
                      where site_id = $1 and ($2::text is null or status = $2)
                      order by created_at desc, id desc limit $3 offset $4`,
                    [scope.siteId, query.status ?? null, query.limit, offset],
                )) as Array<Record<string, unknown>>;
                const counted = (await sql.unsafe(
                    'select count(*)::int as total from public.ad_campaigns where site_id = $1 and ($2::text is null or status = $2)',
                    [scope.siteId, query.status ?? null],
                )) as Array<{ total: number }>;
                return { rows, total: counted[0]?.total ?? rows.length };
            });
            return c.json(paginated(rows, total, query.page, query.limit));
        } catch (error) {
            return respond(c, error);
        }
    });

    // POST /ads/campaigns — a new campaign always starts with a zero budget.
    router.post('/campaigns', validate('json', CreateAdCampaignSchema), async (c) => {
        const body = c.get('validatedBody') as CreateAdCampaignInput;
        try {
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const row = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const inserted = (await sql.unsafe(
                    `insert into public.ad_campaigns (site_id, name, status, starts_at, ends_at)
                     values ($1, $2, $3, $4, $5) returning ${AD_CAMPAIGN_COLUMNS}`,
                    [scope.siteId, body.name, body.status, body.starts_at ?? null, body.ends_at ?? null],
                )) as Array<Record<string, unknown>>;
                return inserted[0];
            });
            return c.json(success(row), 201);
        } catch (error) {
            return respond(c, error);
        }
    });

    // PATCH /ads/campaigns/:id — settings only. The budget is not a setting.
    router.patch('/campaigns/:id', validate('json', UpdateAdCampaignSchema), async (c) => {
        const body = c.get('validatedBody') as UpdateAdCampaignInput;
        try {
            const id = uuidParam(c, 'id');
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const row = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                // COALESCE per column: an omitted field is left unchanged rather than nulled, so a
                // rename cannot clear a schedule as a side effect.
                const updated = (await sql.unsafe(
                    `update public.ad_campaigns
                        set name = coalesce($3, name),
                            status = coalesce($4, status),
                            starts_at = case when $5::text = 'set' then $6::timestamptz else starts_at end,
                            ends_at = case when $7::text = 'set' then $8::timestamptz else ends_at end,
                            updated_at = now()
                      where id = $1 and site_id = $2 returning ${AD_CAMPAIGN_COLUMNS}`,
                    [
                        id,
                        scope.siteId,
                        body.name ?? null,
                        body.status ?? null,
                        body.starts_at === undefined ? 'keep' : 'set',
                        body.starts_at ?? null,
                        body.ends_at === undefined ? 'keep' : 'set',
                        body.ends_at ?? null,
                    ],
                )) as Array<Record<string, unknown>>;
                return updated[0] ?? null;
            });
            if (!row) throw new NotFoundError('Campaign not found');
            return c.json(success(row));
        } catch (error) {
            return respond(c, error);
        }
    });

    // POST /ads/campaigns/:id/budget — the ONLY way the budget moves.
    router.post('/campaigns/:id/budget', validate('json', AllocateAdBudgetSchema), async (c) => {
        const body = c.get('validatedBody') as AllocateAdBudgetInput;
        try {
            const id = uuidParam(c, 'id');
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const result = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(ALLOCATE_AD_BUDGET_SQL, [
                    // The site comes from the resolved scope, never the body; 238's fence checks the
                    // same thing again at the database.
                    scope.siteId,
                    id,
                    body.amount_minor,
                    body.idempotency_key,
                    scope.tenant.requestId ?? null,
                    scope.customUser.id,
                ])) as Array<{ result: unknown }>;
                return rows[0]?.result ?? null;
            });
            return c.json(success(result));
        } catch (error) {
            return respond(c, error);
        }
    });

    // GET /ads/campaigns/:id/placements?store_id=
    router.get('/campaigns/:id/placements', validate('query', AdPlacementQuery), async (c) => {
        const query = c.get('validatedQuery') as AdPlacementInput;
        try {
            const id = uuidParam(c, 'id');
            const scope = await deps.resolveOwnedStoreScope(c, query.store_id);
            const rows = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => (await sql.unsafe(
                `select ${AD_PLACEMENT_COLUMNS} from public.ad_campaign_placements
                  where campaign_id = $1 and site_id = $2 order by "position" asc, created_at asc`,
                [id, scope.siteId],
            )) as Array<Record<string, unknown>>);
            return c.json(success(rows));
        } catch (error) {
            return respond(c, error);
        }
    });

    // POST /ads/campaigns/:id/placements — which products the campaign sponsors.
    router.post('/campaigns/:id/placements', validate('json', CreateAdPlacementSchema), async (c) => {
        const body = c.get('validatedBody') as CreateAdPlacementInput;
        try {
            const id = uuidParam(c, 'id');
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const row = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                // Both composite foreign keys in 232 refuse another merchant's campaign or product,
                // so a wrong id is a 422 from the database rather than a silent cross-tenant link.
                const inserted = (await sql.unsafe(
                    `insert into public.ad_campaign_placements (site_id, campaign_id, product_id, "position")
                     values ($1, $2, $3, $4) returning ${AD_PLACEMENT_COLUMNS}`,
                    [scope.siteId, id, body.product_id, body.position],
                )) as Array<Record<string, unknown>>;
                return inserted[0];
            });
            return c.json(success(row), 201);
        } catch (error) {
            return respond(c, error);
        }
    });

    // DELETE /ads/campaigns/:id/placements/:placementId
    router.delete('/campaigns/:id/placements/:placementId', validate('query', AdPlacementQuery), async (c) => {
        const query = c.get('validatedQuery') as AdPlacementInput;
        try {
            const campaignId = uuidParam(c, 'id');
            const placementId = uuidParam(c, 'placementId');
            const scope = await deps.resolveOwnedStoreScope(c, query.store_id);
            const removed = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => (await sql.unsafe(
                'delete from public.ad_campaign_placements where id = $1 and campaign_id = $2 and site_id = $3 returning id',
                [placementId, campaignId, scope.siteId],
            )) as Array<{ id: string }>);
            if (removed.length === 0) throw new NotFoundError('Placement not found');
            return c.json(success({ id: placementId, removed: true }));
        } catch (error) {
            return respond(c, error);
        }
    });

    return router;
}

const adsRouter = createAdsRouter();
export default adsRouter;
