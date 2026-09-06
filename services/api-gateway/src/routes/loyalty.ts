// Merchant loyalty programme settings (phase F-LOY-3, backend half; schema: migrations 231 and 237).
//
// Before this router existed, `loyalty_programs` had NO writer anywhere in the repository — the only
// TypeScript references to the table were two `.select()` calls — so a merchant could enable loyalty
// only by hand-written SQL, and the queue worker's `is_active = true` sweep could never match a
// store. Loyalty was complete and unusable.
//
// The write goes through `set_loyalty_program`, never through an UPDATE, and the reason is money:
// `redeem_loyalty_points` reads `point_value_minor` AT REDEMPTION TIME, so halving it halves the
// rupee value of every point already earned at that store. The RPC records that change — old and new
// values, the outstanding point balance and the signed liability delta in paise — in the same
// transaction as the change itself. A route-side audit write can fail after the settings change has
// landed, and nothing would ever notice.
//
// Both routes run INSIDE the tenant transaction (`withResolvedTenantTx`: SET LOCAL ROLE app_tenant +
// app.site_id from the resolved owned-store scope). That is what makes 237's tenant fence
// load-bearing: the function refuses any site other than the one the transaction is scoped to, so a
// route that resolved ownership for one store and passed another is stopped by the database rather
// than by review. `app_tenant` has EXECUTE on the function and still has no INSERT or UPDATE on the
// table, so the function is its only way in.
//
// There is deliberately NO service_role fallback: when the pooled SQL connection is unavailable the
// routes answer 503 rather than reaching for the admin client, which would bypass the fence that is
// the whole point of the design.

import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { AppError, ForbiddenError, NotFoundError, formatAppError } from '../lib/errors';
import { success } from '../lib/supabase';
import {
    resolveOwnedStoreScope as resolveOwnedStoreScopeFromGateway,
    withResolvedTenantTx as withResolvedTenantTxFromGateway,
    type OwnedStoreScope,
    type TenantContext,
} from '../lib/tenant-context';
import { TenantTransactionUnavailableError } from '../lib/tenant-transaction';
import { validate } from '../middleware/validation';
import {
    GetLoyaltyProgramQuery,
    SetLoyaltyProgramSchema,
    type GetLoyaltyProgramInput,
    type SetLoyaltyProgramInput,
} from '../schemas/loyalty.schema';

type AppContext = Context<{ Bindings: Env }>;

export const SET_LOYALTY_PROGRAM_RPC = 'set_loyalty_program';
export const LOYALTY_PROGRAM_COLUMNS =
    'site_id, is_active, earn_rate_bps, redeem_cap_bps, point_value_minor, created_at, updated_at';

// The nine positional parameters of set_loyalty_program, in 237's declared order.
export const SET_LOYALTY_PROGRAM_SQL =
    `select public.${SET_LOYALTY_PROGRAM_RPC}($1::uuid, $2::boolean, $3::integer, $4::integer, $5::bigint, $6::uuid, $7::text, $8::text, $9::text) as result`;

export type TenantSql = { unsafe: (query: string, parameters?: unknown[]) => Promise<unknown> };
export type LoyaltyScope = Pick<OwnedStoreScope, 'siteId' | 'customUser' | 'tenant'>;

export interface LoyaltyRouteDependencies {
    resolveOwnedStoreScope: (c: AppContext, siteId: string) => Promise<LoyaltyScope>;
    withResolvedTenantTx: <T>(
        c: AppContext,
        tenant: Pick<TenantContext, 'siteId' | 'requestId'>,
        callback: (sql: TenantSql) => Promise<T>,
    ) => Promise<T>;
}

export const defaultLoyaltyRouteDependencies: LoyaltyRouteDependencies = {
    resolveOwnedStoreScope: (c, siteId) => resolveOwnedStoreScopeFromGateway(c, siteId),
    withResolvedTenantTx: (c, tenant, callback) =>
        withResolvedTenantTxFromGateway(c, tenant, (sql) => callback(sql as unknown as TenantSql)),
};

interface LoyaltyProgramRow {
    site_id: string;
    is_active: boolean;
    earn_rate_bps: number;
    redeem_cap_bps: number;
    point_value_minor: number | string;
    created_at: string;
    updated_at: string;
}

// Postgres → HTTP. Messages are 237's own RAISE texts; codes are SQLSTATE. Anything unrecognised is
// rethrown so the global handler logs it as an unexpected error instead of masking a real bug.
export function mapLoyaltyDatabaseError(error: unknown): AppError | null {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
    if (code === '42501' || /row-level security/i.test(message)) return new ForbiddenError('Not authorized for this store');
    // The route resolved one site and asked the function for another. That is a gateway bug caught by
    // the database, so it must not read as a client validation error.
    if (/tenant context .* does not match the requested site/.test(message)) {
        return new AppError('tenant context did not match the requested store', 500, 'TENANT_CONTEXT_MISMATCH');
    }
    if (/site .* does not exist/.test(message)) return new NotFoundError('Store not found');
    if (/must be between 0 and 10000/.test(message)) return new AppError(message.replace(/^.*?ERROR:\s*/i, ''), 422, 'UNPROCESSABLE');
    if (/point_value_minor must be greater than zero/.test(message)) return new AppError('point_value_minor must be greater than zero', 422, 'UNPROCESSABLE');
    if (/actor_type must be one of/.test(message)) return new AppError('unsupported actor type', 422, 'UNPROCESSABLE');
    return null;
}

function respond(c: AppContext, error: unknown): Response {
    if (error instanceof TenantTransactionUnavailableError) {
        const { body, status } = formatAppError(new AppError('Tenant transaction unavailable', 503, 'TENANT_TX_UNAVAILABLE'));
        return c.json(body, status as 503);
    }
    const appError = error instanceof AppError ? error : mapLoyaltyDatabaseError(error);
    if (!appError) throw error;
    const { body, status } = formatAppError(appError);
    return c.json(body, status as 400);
}

export function createLoyaltyRouter(deps: LoyaltyRouteDependencies = defaultLoyaltyRouteDependencies) {
    const router = new Hono<{ Bindings: Env }>();

    // GET /loyalty/program?store_id=
    router.get('/program', validate('query', GetLoyaltyProgramQuery), async (c) => {
        const query = c.get('validatedQuery') as GetLoyaltyProgramInput;
        try {
            const scope = await deps.resolveOwnedStoreScope(c, query.store_id);
            const result = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(
                    `select ${LOYALTY_PROGRAM_COLUMNS} from public.loyalty_programs where site_id = $1`,
                    [scope.siteId],
                )) as LoyaltyProgramRow[];
                // The outstanding liability is served with the settings on purpose: a merchant about
                // to change point_value_minor should be able to see what it is worth before doing it.
                const outstanding = (await sql.unsafe(
                    'select public.loyalty_outstanding_points($1) as points',
                    [scope.siteId],
                )) as Array<{ points: number | string }>;
                return { row: rows[0] ?? null, outstanding: Number(outstanding[0]?.points ?? 0) };
            });

            if (!result.row) {
                // Not enrolled is a different answer from enrolled-and-paused, exactly as it is on the
                // buyer side. Serving a zeroed programme here would tell a merchant they had one.
                return c.json(success({ store_id: scope.siteId, enrolled: false, program: null, outstanding_points: result.outstanding }));
            }
            return c.json(success({ store_id: scope.siteId, enrolled: true, program: result.row, outstanding_points: result.outstanding }));
        } catch (error) {
            return respond(c, error);
        }
    });

    // PUT /loyalty/program — create or update; an omitted setting is LEFT UNCHANGED (237).
    router.put('/program', validate('json', SetLoyaltyProgramSchema), async (c) => {
        const body = c.get('validatedBody') as SetLoyaltyProgramInput;
        try {
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const result = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(SET_LOYALTY_PROGRAM_SQL, [
                    // The site comes from the resolved scope, never from the body. `store_id` in the
                    // body only chose which owned store to resolve.
                    scope.siteId,
                    body.is_active ?? null,
                    body.earn_rate_bps ?? null,
                    body.redeem_cap_bps ?? null,
                    body.point_value_minor ?? null,
                    scope.customUser.id,
                    'user',
                    scope.customUser.email ?? null,
                    scope.tenant.requestId ?? null,
                ])) as Array<{ result: unknown }>;
                return rows[0]?.result ?? null;
            });
            return c.json(success(result));
        } catch (error) {
            return respond(c, error);
        }
    });

    return router;
}

const loyaltyRouter = createLoyaltyRouter();
export default loyaltyRouter;
