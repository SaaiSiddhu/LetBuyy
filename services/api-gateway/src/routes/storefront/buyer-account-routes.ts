// BUYER-3 (D-8) — the gateway's data operations for the marketplace buyer realm.
//
// WHY THESE LIVE HERE AND THE TOKEN DOES NOT. identity-platform is the sole token issuer (ART-05)
// and holds no database client — its /api/auth/{signup,login} call the gateway through
// identityApiRequest with a signed internal header and mint only the token. Buyer auth is therefore
// two-sided on purpose: the gateway owns buyer_accounts rows, identity-platform owns the
// credential-to-token step. Minting a session here would make the gateway a second issuer, which is
// the exact violation an earlier phase closed as an S0. Nothing in this file issues anything.
//
// NOT PUBLIC. Both credential routes accept an email and a password, so both sit behind
// verifyInternalAppRequest(c, 'storefront') — the same signed-internal gate the customer lifecycle
// endpoints use. A public credential-verification endpoint is a password oracle.
//
// OWNERSHIP NEEDS A PROVEN ADDRESS (APPID-P3, migration 255). A buyer account is created unverified.
// Until identity-platform has proven the address, the account may sign in and place its own orders,
// but it cannot attach itself to a store's existing customer record or claim orders placed with that
// address: both decisions are taken by database functions that check verification, refuse a record
// another buyer holds, and write the outcome to audit_logs in the same transaction.

import type { Hono } from 'hono';
import * as bcrypt from 'bcryptjs';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import type { AppContext } from './customer-engagement-routes';

const BCRYPT_COST = 10;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
// Shape only: it turns garbage into a 400 before Postgres turns it into a 500.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/// The outcomes link_buyer_store_customer (255) can return. Another buyer's id is never among them.
export type StoreLinkOutcome =
    | { outcome: 'linked' | 'already_linked'; store_customer_id: string }
    | { outcome: 'unverified' | 'conflict' | 'buyer_unavailable' | 'store_unavailable' };

/// The outcomes claim_buyer_orders (255) can return. Conflicts are a count, never another buyer's order.
export type OrderClaimOutcome =
    | { outcome: 'claimed'; linked: number; already_linked: number; conflicts: number }
    | { outcome: 'unverified' | 'buyer_unavailable' };

/// Reads and writes are INJECTED rather than reached for inline, matching the marketplace detail
/// routes. It keeps the wire contract testable without a database, and keeps the one thing that must
/// never vary — that a password hash is compared here and never returned — visible in one file.
export interface BuyerAccountRoutesDeps {
    /// Injected, never re-implemented: buyer_accounts carries a CHECK that email = lower(btrim(email)),
    /// so a second normalizer that disagreed with this one would produce rows the database refuses,
    /// and lookups that silently miss.
    normalizeEmail: (email: string) => string;
    requireStorefrontInternal: (c: AppContext) => Promise<Response | null>;
    loadBuyerByEmail: (c: AppContext, email: string) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
    loadBuyerById: (c: AppContext, id: string) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
    insertBuyer: (c: AppContext, row: { email: string; password_hash: string }) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
    /// public.link_buyer_store_customer. One transaction decides and audits; this file only maps the
    /// outcome to a response, so the rule cannot drift between a read here and a write elsewhere.
    linkStoreCustomer: (c: AppContext, input: { buyerAccountId: string; siteId: string }) => Promise<{ data: StoreLinkOutcome | null; error: unknown }>;
    /// public.claim_buyer_orders, optionally narrowed to one store.
    claimOrders: (c: AppContext, input: { buyerAccountId: string; siteId: string | null }) => Promise<{ data: OrderClaimOutcome | null; error: unknown }>;
}

export interface BuyerAccountRow {
    id: string;
    email: string;
    password_hash: string | null;
    email_verified: boolean;
    status: string;
}

export const BUYER_ACCOUNT_COLUMNS = 'id, email, password_hash, email_verified, status';

/// What a caller is allowed to see. password_hash is deliberately absent: it never leaves this file.
function publicBuyerAccount(row: BuyerAccountRow): Record<string, unknown> {
    return {
        id: row.id,
        email: row.email,
        email_verified: Boolean(row.email_verified),
        status: row.status,
    };
}

const failure = (code: string, message: string) => ({ success: false, error: { code, message } });

export function registerBuyerAccountRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerAccountRoutesDeps,
): void {
    const {
        normalizeEmail,
        requireStorefrontInternal,
        loadBuyerByEmail,
        insertBuyer,
        loadBuyerById,
        linkStoreCustomer,
        claimOrders,
    } = deps;

    router.post('/buyer/register', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null;
        if (!body?.email || !body?.password) {
            return c.json(failure('VALIDATION', 'email and password are required'), 400);
        }
        if (body.password.length < MIN_PASSWORD || body.password.length > MAX_PASSWORD) {
            return c.json(failure('VALIDATION', `Password must be ${MIN_PASSWORD} to ${MAX_PASSWORD} characters`), 400);
        }

        // NO store_id, and that is the whole point of this realm: a buyer spans sellers. If a caller
        // ever needs to pass one here, the buyer model has been misunderstood.
        const email = normalizeEmail(body.email);

        const { data: existing, error: lookupError } = await loadBuyerByEmail(c, email);
        if (lookupError) return c.json(dbFailureBody(), 500);

        if (existing?.status === 'disabled') {
            return c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403);
        }
        // ANY existing account, with or without a password. Registration used to set a first password
        // on a password-less account, which let whoever typed the address first take the account over
        // without ever proving they own it. Setting a credential on an existing account now goes
        // through identity-platform's verified recovery path instead.
        if (existing) {
            return c.json(failure('ACCOUNT_EXISTS', 'An account with this email already exists. Sign in, or reset your password.'), 409);
        }

        const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);
        const { data: created, error: createError } = await insertBuyer(c, { email, password_hash: passwordHash });
        if (createError || !created) return c.json(dbFailureBody(), 500);

        return c.json(success({ buyer: publicBuyerAccount(created) }), 201);
    });

    router.post('/buyer/verify-credentials', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null;
        if (!body?.email || !body?.password) {
            return c.json(failure('VALIDATION', 'email and password are required'), 400);
        }

        const email = normalizeEmail(body.email);

        const { data: account, error } = await loadBuyerByEmail(c, email);
        if (error) return c.json(dbFailureBody(), 500);

        // ONE outcome for "no such account", "no password set" and "wrong password". Distinguishing
        // them turns this into an email-enumeration oracle, and the storefront customer login already
        // answers the same way (success({ customer: null })) — a second convention here would make
        // one of the two look like the exception.
        if (!account?.password_hash) {
            // Still spend the bcrypt time. Returning early on a missing account makes the response
            // measurably faster than a wrong password, which is the same disclosure by another route.
            await bcrypt.compare(body.password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
            return c.json(success({ buyer: null }));
        }

        const valid = await bcrypt.compare(body.password, account.password_hash);
        if (!valid) return c.json(success({ buyer: null }));

        if (account.status === 'disabled') {
            return c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403);
        }

        return c.json(success({ buyer: publicBuyerAccount(account) }));
    });

    // Resolve the session's buyer, or answer for it. Shared by both ownership routes so they cannot
    // disagree about what an unusable session looks like.
    async function sessionBuyer(c: AppContext): Promise<{ buyer: BuyerAccountRow } | { response: Response }> {
        const session = getBuyerSession(c);
        if (!session) {
            return { response: c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401) };
        }
        // THE identity comes from the VERIFIED TOKEN, never from the body. A body-supplied
        // buyer_account_id would let any caller attach any buyer to any customer record — the entire
        // cross-store identity, forgeable by typing a uuid. Nothing in the request may influence it.
        const { data: buyer, error } = await loadBuyerById(c, session.buyerAccountId);
        if (error) return { response: c.json(dbFailureBody(), 500) };
        if (!buyer) {
            // A validly signed token for an account that no longer exists — deleted between issuance
            // and use. Treated as unauthenticated rather than 404, which would confirm the id.
            return { response: c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401) };
        }
        if (buyer.status === 'disabled') {
            return { response: c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403) };
        }
        return { buyer };
    }

    router.post('/buyer/link-store-customer', requireBuyerSession, async (c) => {
        const resolved = await sessionBuyer(c);
        if ('response' in resolved) return resolved.response;

        const body = await c.req.json().catch(() => null) as { store_id?: string } | null;
        if (!body?.store_id || !UUID.test(body.store_id)) {
            return c.json(failure('VALIDATION', 'store_id is required'), 400);
        }

        const { data: result, error } = await linkStoreCustomer(c, { buyerAccountId: resolved.buyer.id, siteId: body.store_id });
        if (error || !result) return c.json(dbFailureBody(), 500);

        switch (result.outcome) {
            case 'linked':
            case 'already_linked':
                return c.json(success({ linked: { buyer_account_id: resolved.buyer.id, store_customer_id: result.store_customer_id } }));
            case 'unverified':
                return c.json(failure('EMAIL_UNVERIFIED', 'Verify your email address before linking your account to a store.'), 403);
            case 'conflict':
                // Never who holds it. The database wrote the conflict to audit_logs for an operator.
                return c.json(failure('LINK_CONFLICT', 'This store record is linked to another LetBuyy account. Contact support to resolve it.'), 409);
            case 'store_unavailable':
                return c.json(failure('STORE_NOT_FOUND', 'Store not found.'), 404);
            case 'buyer_unavailable':
                return c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403);
            default:
                return c.json(dbFailureBody(), 500);
        }
    });

    router.post('/buyer/orders/claim', requireBuyerSession, async (c) => {
        const resolved = await sessionBuyer(c);
        if ('response' in resolved) return resolved.response;

        const body = await c.req.json().catch(() => ({})) as { store_id?: string } | null;
        const storeId = body?.store_id ?? null;
        if (storeId !== null && !UUID.test(storeId)) {
            return c.json(failure('VALIDATION', 'store_id must be a store id'), 400);
        }

        const { data: result, error } = await claimOrders(c, { buyerAccountId: resolved.buyer.id, siteId: storeId });
        if (error || !result) return c.json(dbFailureBody(), 500);

        switch (result.outcome) {
            case 'claimed':
                return c.json(success({ claimed: { linked: result.linked, already_linked: result.already_linked, conflicts: result.conflicts } }));
            case 'unverified':
                return c.json(failure('EMAIL_UNVERIFIED', 'Verify your email address before claiming orders placed with it.'), 403);
            case 'buyer_unavailable':
                return c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403);
            default:
                return c.json(dbFailureBody(), 500);
        }
    });
}
