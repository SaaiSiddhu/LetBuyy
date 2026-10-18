// Merchant loyalty settings over canonical237 audit/projection and334 owner/retry/policy guards.
//
// Before this router existed, `loyalty_programs` had NO writer anywhere in the repository — the only
// TypeScript references to the table were two `.select()` calls — so a merchant could enable loyalty
// only by hand-written SQL, and the queue worker's `is_active = true` sweep could never match a
// store. Loyalty was complete and unusable.
//
// The write goes through `set_loyalty_program`, never through an UPDATE, and the reason is money:
// `redeem_loyalty_points` reads `point_value_minor` AT REDEMPTION TIME. The owner-approved
// rule forbids decreases while points remain. Allowed changes record old and new
// values, the outstanding point balance and the signed liability delta in paise — in the same
// transaction as the change itself. A route-side audit write can fail after the settings change has
// landed, and nothing would ever notice.
//
// 334 blocks decreases while buyers hold points (owner16October2026),
// uses exact timestamp versions and durable scoped retry receipts.
// Both routes run INSIDE the tenant transaction (`withResolvedTenantTx`: SET LOCAL ROLE app_tenant +
// app.site_id from the resolved owned-store scope). That is what makes the current tenant fence
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

export const SET_LOYALTY_PROGRAM_RPC = 'mutate_loyalty_program_v1';
// 334 guards retries/version, then calls the one 237 settings/audit authority.
// The text cast avoids postgres.js's timestamptz serializer converting the
// microsecond version to a millisecond JS Date before PostgreSQL receives it.
export const SET_LOYALTY_PROGRAM_SQL =
    `select public.${SET_LOYALTY_PROGRAM_RPC}($1::uuid, $2::uuid, $3::jsonb, $4::text, $5::text::timestamptz, $6::text) as result`;

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
    if (/LOYALTY_VALUE_DECREASE_BLOCKED/.test(message)) return new AppError('Point value cannot decrease while buyers hold points', 409, 'LOYALTY_VALUE_DECREASE_BLOCKED');
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
                const rows = (await sql.unsafe('select public.read_loyalty_program_v1($1::uuid,$2::uuid) as result',
                    [scope.siteId, scope.customUser.id])) as Array<{ result: unknown }>;
                if (!rows[0]?.result) throw new AppError('Loyalty state unavailable', 503, 'LOYALTY_STATE_UNAVAILABLE');
                return rows[0].result;
            });
            return c.json(success(result));
        } catch (error) {
            return respond(c, error);
        }
    });

    // PUT /loyalty/program — create or update; an omitted setting is LEFT UNCHANGED (237).
    router.put('/program', validate('json', SetLoyaltyProgramSchema), async (c) => {
        const body = c.get('validatedBody') as SetLoyaltyProgramInput;
        try {
            const key = c.req.header('X-Idempotency-Key');
            if (!key || key.length < 8 || key.length > 200 || key.trim() !== key || /[\u0000-\u001f\u007f]/.test(key)) {
                throw new AppError('A stable X-Idempotency-Key is required', 400, 'IDEMPOTENCY_KEY_REQUIRED');
            }
            const scope = await deps.resolveOwnedStoreScope(c, body.store_id);
            const { store_id: _store, expected_updated_at: _version, ...intent } = body;
            const result = await deps.withResolvedTenantTx(c, scope.tenant, async (sql) => {
                const rows = (await sql.unsafe(SET_LOYALTY_PROGRAM_SQL, [
                    // The site comes from the resolved scope, never from the body. `store_id` in the
                    // body only chose which owned store to resolve.
                    scope.siteId,
                    scope.customUser.id,
                    intent,
                    key,
                    body.expected_updated_at,
                    scope.tenant.requestId ?? null,
                ])) as Array<{ result: { data?: unknown; status?: number; error?: string; replayed?: boolean } }>;
                const reply = rows[0]?.result;
                if (!reply || ![200,400,409,503].includes(reply.status ?? 0)) throw new AppError('Loyalty state unavailable', 503, 'LOYALTY_STATE_UNAVAILABLE');
                if (reply.error) {
                    const messages: Record<string,string> = {
                        LOYALTY_VERSION_CONFLICT: 'Settings changed. Reload before saving again.',
                        IDEMPOTENCY_CONFLICT: 'The retry key belongs to a different save.',
                        LOYALTY_STATE_UNAVAILABLE: 'Loyalty state is temporarily unavailable.',
                        VALIDATION: 'Invalid loyalty settings.',
                    };
                    throw new AppError(messages[reply.error] ?? 'Loyalty save unavailable', reply.status ?? 503, reply.error);
                }
                if (reply.data === undefined) throw new AppError('Loyalty state unavailable', 503, 'LOYALTY_STATE_UNAVAILABLE');
                return reply;
            });
            c.header('X-Idempotency-Replayed', result.replayed ? 'true' : 'false');
            return c.json(success(result.data));
        } catch (error) {
            return respond(c, error);
        }
    });

    return router;
}

const loyaltyRouter = createLoyaltyRouter();
export default loyaltyRouter;
