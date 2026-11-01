import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import type { Context } from 'hono';
import type { Env } from '../index';
import { IdempotencyExecutionAdapter } from '../execution/idempotency-execution.adapter';
import { getSupabaseAdmin } from '../lib/supabase';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { assertStaffPermission } from './staff-permission';
import {isWarehouseCommandPath,isProductImportCommandPath} from '@letbuyy/shared-types';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type GatewayContext = Context<{ Bindings: Env }>;

declare module 'hono' {
    interface ContextVariableMap {
        paymentConfigurationClaim: { id: string; siteId: string; requestHash: string } | undefined;
        atomicIdempotencyCommitted: boolean | undefined;
    }
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const IDEMPOTENT_PROTECTED_PREFIXES = [
    '/stores',
    '/domains',
    '/custom',
    '/store-access',
    '/products',
    '/orders',
    '/risk',
    '/returns',
    '/shipping/labels',
    '/shipping',
    '/payouts',
    '/wallet',
    '/commission',
    '/cod',
    '/kyc',
    '/2fa',
    '/payments',
    '/upload',
    '/blog',
    '/customers',
    '/notifications',
    '/whatsapp',
    '/marketing',
    '/media',
    '/metafields',
    '/ai',
    '/export',
    '/shipping-tax',
    '/tax',
    '/onboarding',
    '/inventory',
    '/coupons',
    '/discounts',
    '/categories',
    '/analytics',
    '/reviews',
    '/form-submissions',
    '/pages',
] as const;

function normalizePath(path: string): string {
    return path.replace(/^\/v1(?=\/|$)/, '') || '/';
}

const BOOTSTRAP_CREATION_PATHS = new Set(['/stores']);

function isProtectedMutationPath(path: string, method?: string): boolean {
    const normalized = normalizePath(path);
    // Device registration is actor-bound, including before store selection.
    // Upsert(user_id,token) and DELETE(user_id,token) are intrinsically idempotent;
    // the site-scoped response cache must never replay registration after logout.
    if (normalized === '/notifications/device-tokens' && (method === 'POST' || method === 'DELETE')) return false;
    // The pre-store web draft is account-bound and has no site_id yet. Its
    // SECURITY DEFINER RPC takes a per-user advisory lock and upserts one row,
    // so the site-scoped idempotency table cannot represent this operation.
    if (method === 'PUT' && normalized === '/onboarding/web-draft') return false;
    // Store creation (POST /stores) has no site_id yet — guarded by subdomain uniqueness.
    // All sub-resource mutations (/stores/{id}/...) still require idempotency.
    if (method === 'POST' && BOOTSTRAP_CREATION_PATHS.has(normalized)) return false;
    return IDEMPOTENT_PROTECTED_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function stringField(input: Record<string, unknown> | null, ...keys: string[]): string | null {
    if (!input) return null;
    for (const key of keys) {
        const value = input[key];
        if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    return null;
}

function safeJsonRecord(rawBody: string): Record<string, unknown> | null {
    if (!rawBody.trim()) return null;
    try {
        const parsed = JSON.parse(rawBody) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
}

async function readJsonBodySnapshot(c: GatewayContext): Promise<{
    rawBody: string;
    body: Record<string, unknown> | null;
}> {
    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('application/json')) return { rawBody: '', body: null };

    const rawBody = await c.req.raw.clone().text().catch(() => '');
    return { rawBody, body: safeJsonRecord(rawBody) };
}

function idempotencyKeyFromRequest(c: GatewayContext, body: Record<string, unknown> | null): string | null {
    const header = c.req.header('X-Idempotency-Key') || c.req.header('Idempotency-Key');
    if (header?.trim()) return header.trim();
    return stringField(body, 'idempotency_key', 'idempotencyKey');
}

function siteIdFromStorePath(path: string): string | null {
    const normalized = normalizePath(path);
    const [, resource, id] = normalized.split('/');
    if (resource !== 'stores' || !id || id === 'public' || id === 'handle') return null;
    return decodeURIComponent(id);
}

function siteIdFromRequest(c: GatewayContext, body: Record<string, unknown> | null): string | null {
    return stringField(body, 'site_id', 'siteId', 'store_id', 'storeId')
        || c.req.query('site_id')
        || c.req.query('store_id')
        || c.req.header('X-Store-ID')
        || c.get('auth')?.user?.storeId
        || siteIdFromStorePath(c.req.path);
}

function requestBodyForHash(input: {
    method: string;
    path: string;
    query: Record<string, string>;
    rawBody: string;
    body: Record<string, unknown> | null;
    contentType: string;
    contentLength?: string;
}): Record<string, unknown> {
    if (input.body) {
        return {
            method: input.method,
            path: normalizePath(input.path),
            query: input.query,
            body: input.body,
        };
    }

    return {
        method: input.method,
        path: normalizePath(input.path),
        query: input.query,
        content_type: input.contentType,
        content_length: input.contentLength || null,
        raw_body: input.rawBody || null,
    };
}

async function responseBodyForReplay(response: Response): Promise<JsonValue | null> {
    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    const value = await response.clone().json() as unknown;
    return value as JsonValue;
}

function isPendingPayoutRelease(path: string, method: string, responseBody: JsonValue): boolean {
    if (method !== 'POST' || !/^\/payouts\/[^/]+\/settle$/.test(normalizePath(path))) return false;
    if (!responseBody || typeof responseBody !== 'object' || Array.isArray(responseBody)) return false;
    const data = (responseBody as Record<string, JsonValue>).data;
    return Boolean(data && typeof data === 'object' && !Array.isArray(data)
        && (data as Record<string, JsonValue>).status === 'processing');
}

export const protectedMutationIdempotency = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const method = c.req.method.toUpperCase();
    // These mutations have route-owned receipts after live order ownership and
    // permission checks. A second HTTP cache would bypass both those checks and
    // committed reversal recovery on an exact retry. Their schemas still require
    // keys and their adapters still bind the complete request body.
    const orderPath = normalizePath(c.req.path);
    // Account-bound factor commands own encrypted, actor-bound retry receipts.
    // A store-selected HTTP response cache must never retain setup credentials.
    const credentialCommand = method === 'POST' && ['/2fa/totp/enroll', '/2fa/totp/verify', '/2fa/disable'].includes(orderPath);
    const routeOwnedOrderReceipt = (method === 'PATCH' && /^\/orders\/[^/]+$/.test(orderPath))
        || (method === 'POST' && /^\/(?:orders|returns)\/[^/]+\/refund\/complete$/.test(orderPath));
    const routeOwnedMoneyClaim = method === 'POST' && (/^\/payments\/[^/]+\/refund$/.test(orderPath) || /^\/payouts\/[^/]+\/settle$/.test(orderPath));
    // Subscription checkout owns a live-owner, actor/site/key/payload-bound
    // durable source. Replaying an outer HTTP cache would bypass owner checks
    // and split the free activation from its mandatory receipt completion.
    const routeOwnedSubscriptionCheckout = method === 'POST'
        && ['/payments/subscription/order', '/payments/subscription/recover', '/payments/subscription/verify'].includes(orderPath);
    // Product PATCH owns an atomic actor/payload/version-bound receipt after live access checks.
    const routeOwnedInventoryAdjustment = method === 'POST' && orderPath === '/inventory/adjust';
    // These warehouse commands and their stop protocol own immutable receipts in one transaction.
    const routeOwnedWarehouseCommand = method === 'POST' && isWarehouseCommandPath(orderPath);
    const routeOwnedProductImport = method === 'POST' && isProductImportCommandPath(orderPath);
    // Membership commands own live-owner/version/payload-bound SQL receipts.
    const routeOwnedCollectionMembership = method === 'PUT' && /^\/products\/collections\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/products$/i.test(orderPath);
    // Product PATCH owns an atomic actor/payload/version-bound receipt after live access checks.
    const routeOwnedProductReceipt = method === 'PATCH' && /^\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderPath);
    // The gift-card RPC owns a serialised, site-bound issue receipt. HTTP replay
    // would return its one-time code again and skip the route's live owner check.
    const routeOwnedGiftCardIssue = method === 'POST' && orderPath === '/products/gift-cards';
    if (routeOwnedProductImport || routeOwnedGiftCardIssue || routeOwnedCollectionMembership || routeOwnedWarehouseCommand || routeOwnedInventoryAdjustment || routeOwnedSubscriptionCheckout || routeOwnedProductReceipt || routeOwnedMoneyClaim || credentialCommand || routeOwnedOrderReceipt || !MUTATION_METHODS.has(method) || !isProtectedMutationPath(c.req.path, method)) {
        await next();
        return;
    }

    const { rawBody, body } = await readJsonBodySnapshot(c);
    const idempotencyKey = idempotencyKeyFromRequest(c, body);
    if (!idempotencyKey) {
        return c.json({
            error: {
                code: 'IDEMPOTENCY_KEY_REQUIRED',
                message: 'An idempotency key is required for this mutation.',
            },
        }, 400);
    }

    const siteId = siteIdFromRequest(c, body);
    if (!siteId) {
        return c.json({
            error: {
                code: 'IDEMPOTENCY_SITE_REQUIRED',
                message: 'A store context is required for this mutation.',
            },
        }, 400);
    }

    if (!z.string().uuid().safeParse(siteId).success) {
        return c.json({ error: { code: 'IDEMPOTENCY_SITE_INVALID',
            message: 'A valid store context is required for this mutation.' } }, 400);
    }

    // Product creation still owns its existing HTTP receipt and mandatory key.
    // Recheck the route's current principal authority before returning that
    // receipt, so a revoked owner/staff member cannot bypass the route guard.
    if (method === 'POST' && orderPath === '/products') {
        const auth = c.get('auth');
        const customUser = auth?.user ? await resolveCustomUser(getSupabaseAdmin(c), auth.user) : null;
        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }
        const staffBlock = await assertStaffPermission(c, siteId, customUser.id, 'products:write');
        if (staffBlock) return staffBlock;
    }

    // Settings/cancellation receipts contain tenant configuration and billing
    // state. Re-verify the live owner before begin() can return an old response,
    // including revocation and signed-store/selection mismatches.
    const storeSettingsReceipt = /^\/stores\/[^/]+(?:\/payment-config)?$/.test(orderPath);
    if (storeSettingsReceipt && siteIdFromStorePath(c.req.path) !== siteId) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }
    if (storeSettingsReceipt || orderPath === '/shipping-tax' || orderPath.startsWith('/shipping-tax/') || orderPath === '/payments/subscription/cancel') {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = auth?.user ? await resolveCustomUser(db, auth.user) : null;
        if (!customUser || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
        }
    }

    const idempotency = new IdempotencyExecutionAdapter(getSupabaseAdmin(c));
    const claim = await idempotency.begin({
        siteId,
        key: idempotencyKey,
        scope: `http:${method}:${normalizePath(c.req.path)}`,
        requestBody: requestBodyForHash({
            method,
            path: c.req.path,
            query: c.req.query(),
            rawBody,
            body,
            contentType: c.req.header('content-type') || '',
            contentLength: c.req.header('content-length'),
        }),
        requestId: c.req.header('X-Request-ID') || null,
    });

    if (claim.kind === 'replay') {
        return new Response(JSON.stringify(claim.responseBody), {
            status: claim.statusCode,
            headers: {
                'content-type': 'application/json; charset=UTF-8',
                'X-Idempotent-Replay': 'true',
            },
        });
    }

    if (/^\/stores\/[^/]+\/payment-config$/.test(orderPath)) c.set('paymentConfigurationClaim', {
        id: claim.id, siteId: claim.siteId, requestHash: claim.requestHash,
    });

    try {
        await next();
    } catch (error) {
        await idempotency.fail(claim.id);
        throw error;
    }

    if (c.get('atomicIdempotencyCommitted')) return;

    if (c.res.status < 200 || c.res.status >= 300) {
        await idempotency.fail(claim.id);
        return;
    }

    const replayBody = await responseBodyForReplay(c.res);
    if (replayBody === null && c.res.status !== 204) {
        await idempotency.fail(claim.id);
        return;
    }

    if (replayBody !== null && isPendingPayoutRelease(c.req.path, method, replayBody)) {
        // The payout statement's durable release claim and Route's provider
        // idempotency key own this retry. Caching a 200/processing response at
        // the HTTP layer would strand the statement on an exact retry before
        // its provider request could advance to a terminal result.
        await idempotency.fail(claim.id);
        return;
    }

    await idempotency.complete({
        id: claim.id,
        responseBody: replayBody,
        statusCode: c.res.status,
    });
});
