// BUYER-3 (D-8) — the gateway's data operations for the marketplace buyer realm.
//
// WHY THESE LIVE HERE AND THE TOKEN DOES NOT. identity-platform is the sole token issuer (ART-05)
// and holds no database client — its /api/auth/{signup,login} call the gateway through
// identityApiRequest with a signed internal header and mint only the token. Buyer auth is therefore
// two-sided on purpose: the gateway owns buyer_accounts rows, identity-platform owns the
// credential-to-token step. Minting a session here would make the gateway a second issuer, which is
// the exact violation an earlier phase closed as an S0. Nothing in this file issues anything.
//
// NOT PUBLIC. Both routes accept an email and a password, so both sit behind
// verifyInternalAppRequest(c, 'storefront') — the same signed-internal gate the customer lifecycle
// endpoints use. A public credential-verification endpoint is a password oracle.

import type { Hono } from 'hono';
import * as bcrypt from 'bcryptjs';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import type { AppContext } from './customer-engagement-routes';

const BCRYPT_COST = 10;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

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
    insertBuyer: (c: AppContext, row: { email: string; password_hash: string }) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
    setBuyerPassword: (c: AppContext, id: string, passwordHash: string) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
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

export function registerBuyerAccountRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerAccountRoutesDeps,
): void {
    const { normalizeEmail, requireStorefrontInternal, loadBuyerByEmail, insertBuyer, setBuyerPassword } = deps;

    router.post('/buyer/register', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null;
        if (!body?.email || !body?.password) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'email and password are required' } }, 400);
        }
        if (body.password.length < MIN_PASSWORD || body.password.length > MAX_PASSWORD) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: `Password must be ${MIN_PASSWORD} to ${MAX_PASSWORD} characters` } }, 400);
        }

        // NO store_id, and that is the whole point of this realm: a buyer spans sellers. If a caller
        // ever needs to pass one here, the buyer model has been misunderstood.
        const email = normalizeEmail(body.email);

        const { data: existing, error: lookupError } = await loadBuyerByEmail(c, email);
        if (lookupError) return c.json(dbFailureBody(), 500);

        // Not-exists precondition, carried over from customer-registration.ts for the same reason it
        // exists there: setting a first password without proving control of the address is only safe
        // when no credential exists yet. Otherwise this route IS an account takeover.
        if (existing?.password_hash) {
            return c.json({ success: false, error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists. Please sign in.' } }, 409);
        }
        if (existing?.status === 'disabled') {
            return c.json({ success: false, error: { code: 'BUYER_DISABLED', message: 'Account is disabled.' } }, 403);
        }

        const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);

        if (existing) {
            const { data: updated, error: updateError } = await setBuyerPassword(c, existing.id, passwordHash);
            if (updateError || !updated) return c.json(dbFailureBody(), 500);
            return c.json(success({ buyer: publicBuyerAccount(updated) }), 200);
        }

        const { data: created, error: createError } = await insertBuyer(c, { email, password_hash: passwordHash });
        if (createError || !created) return c.json(dbFailureBody(), 500);

        return c.json(success({ buyer: publicBuyerAccount(created) }), 201);
    });

    router.post('/buyer/verify-credentials', async (c) => {
        const unauthorized = await requireStorefrontInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null;
        if (!body?.email || !body?.password) {
            return c.json({ success: false, error: { code: 'VALIDATION', message: 'email and password are required' } }, 400);
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
            return c.json({ success: false, error: { code: 'BUYER_DISABLED', message: 'Account is disabled.' } }, 403);
        }

        return c.json(success({ buyer: publicBuyerAccount(account) }));
    });
}
