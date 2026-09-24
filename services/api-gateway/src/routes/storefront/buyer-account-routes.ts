// BUYER-3 (D-8) — the gateway's data operations for the marketplace buyer realm.
//
// WHY THESE LIVE HERE AND THE TOKEN DOES NOT. identity-platform is the sole token issuer (ART-05)
// and holds no database client — its /api/auth/{signup,login} call the gateway through
// identityApiRequest with a signed internal header and mint only the token. Buyer auth is therefore
// two-sided on purpose: the gateway owns buyer_accounts rows, identity-platform owns the
// credential-to-token step. Minting a session here would make the gateway a second issuer, which is
// the exact violation an earlier phase closed as an S0. Nothing in this file issues anything.
//
// NOT PUBLIC. Every route that takes a credential or a code sits behind the signed internal header of
// identity-platform, which signs as the 'accounts' app (apps/platform/identity/src/lib/api/client.ts).
// A public credential-verification endpoint is a password oracle. Until APPID-P4a these routes
// accepted only the 'storefront' app, which identity-platform never signs as, so every buyer register
// and sign-in through identity-platform was refused with a 401 it reported as a failed login.
//
// PROVING THE ADDRESS AND ENDING SESSIONS (APPID-P4a, migration 257). The database generates each
// one-time code, keeps only its hash, and hands it to this file once; sendEmailCode delivers it, and
// no response carries it. A password reset and "sign out everywhere" advance the account's session
// epoch, which requireBuyerSession compares on every request.
//
// OWNERSHIP NEEDS A PROVEN ADDRESS (APPID-P3, migration 255). A buyer account is created unverified.
// Until identity-platform has proven the address, the account may sign in and place its own orders,
// but it cannot attach itself to a store's existing customer record or claim orders placed with that
// address: both decisions are taken by database functions that check verification, refuse a record
// another buyer holds, and write the outcome to audit_logs in the same transaction.

import type { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import * as bcrypt from 'bcryptjs';
import type { Env } from '../../index';
import type { BuyerEmailCodeSender } from '../../lib/buyer-email-code';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import type { AppContext } from './customer-engagement-routes';

const BCRYPT_COST = 10;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
// Shape only: it turns garbage into a 400 before Postgres turns it into a 500.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_CODE = /^\d{6}$/;
// A bcrypt hash of nothing in particular, compared against when there is no account, so that path
// costs what a real comparison costs.
const TIMING_HASH = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';

/// The outcomes link_buyer_store_customer (255) can return. Another buyer's id is never among them.
export type StoreLinkOutcome =
    | { outcome: 'linked' | 'already_linked'; store_customer_id: string }
    | { outcome: 'unverified' | 'conflict' | 'buyer_unavailable' | 'store_unavailable' };

/// The outcomes claim_buyer_orders (255) can return. Conflicts are a count, never another buyer's order.
export type OrderClaimOutcome =
    | { outcome: 'claimed'; linked: number; already_linked: number; conflicts: number }
    | { outcome: 'unverified' | 'buyer_unavailable' };

export type EmailChallengePurpose = 'verify_email' | 'reset_password';

/// start_buyer_email_challenge (257). `code` goes to sendEmailCode and nowhere else.
export type EmailChallengeStart =
    | { outcome: 'started'; challenge_id: string; code: string; email: string; expires_at: string }
    | { outcome: 'buyer_unavailable' | 'rate_limited' };

/// consume_buyer_email_challenge (257).
export type EmailChallengeOutcome =
    | { outcome: 'verified' | 'password_reset'; buyer_account_id: string; session_epoch: number }
    | { outcome: 'invalid' | 'expired' | 'locked' | 'address_changed' | 'buyer_unavailable' };

/// revoke_buyer_sessions (257).
export type SessionRevocation =
    | { outcome: 'revoked'; session_epoch: number }
    | { outcome: 'buyer_unavailable' };

/// Reads and writes are INJECTED rather than reached for inline, matching the marketplace detail
/// routes. It keeps the wire contract testable without a database, and keeps the one thing that must
/// never vary — that a password hash is compared here and never returned — visible in one file.
export interface BuyerAccountRoutesDeps {
    /// Injected, never re-implemented: buyer_accounts carries a CHECK that email = lower(btrim(email)),
    /// so a second normalizer that disagreed with this one would produce rows the database refuses,
    /// and lookups that silently miss.
    normalizeEmail: (email: string) => string;
    /// identity-platform's signed internal header, and nobody else's: identity-platform is the sole
    /// issuer, and credential checks, codes and session revocation exist only to serve it.
    requireIdentityInternal: (c: AppContext) => Promise<Response | null>;
    loadBuyerByEmail: (c: AppContext, email: string) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
    loadBuyerById: (c: AppContext, id: string) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
    insertBuyer: (c: AppContext, row: { email: string; password_hash: string }) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
    /// public.link_buyer_store_customer. One transaction decides and audits; this file only maps the
    /// outcome to a response, so the rule cannot drift between a read here and a write elsewhere.
    linkStoreCustomer: (c: AppContext, input: { buyerAccountId: string; siteId: string }) => Promise<{ data: StoreLinkOutcome | null; error: unknown }>;
    /// public.claim_buyer_orders, optionally narrowed to one store.
    claimOrders: (c: AppContext, input: { buyerAccountId: string; siteId: string | null }) => Promise<{ data: OrderClaimOutcome | null; error: unknown }>;
    /// Migration 257. The database generates, hashes, limits, expires and audits; these only call it.
    startEmailChallenge: (c: AppContext, input: { buyerAccountId: string; purpose: EmailChallengePurpose }) => Promise<{ data: EmailChallengeStart | null; error: unknown }>;
    consumeEmailChallenge: (
        c: AppContext,
        input: { buyerAccountId: string; purpose: EmailChallengePurpose; code: string; newPasswordHash: string | null },
    ) => Promise<{ data: EmailChallengeOutcome | null; error: unknown }>;
    revokeSessions: (c: AppContext, buyerAccountId: string) => Promise<{ data: SessionRevocation | null; error: unknown }>;
    sendEmailCode: BuyerEmailCodeSender;
}

export interface BuyerAccountRow {
    id: string;
    email: string;
    password_hash: string | null;
    email_verified: boolean;
    status: string;
    session_epoch: number;
}

export const BUYER_ACCOUNT_COLUMNS = 'id, email, password_hash, email_verified, status, session_epoch';

/// What a caller is allowed to see. password_hash is deliberately absent: it never leaves this file.
function publicBuyerAccount(row: BuyerAccountRow): Record<string, unknown> {
    return {
        id: row.id,
        email: row.email,
        email_verified: Boolean(row.email_verified),
        status: row.status,
        // identity-platform puts this in every token it issues for the account (requireBuyerSession).
        session_epoch: row.session_epoch,
    };
}

const failure = (code: string, message: string) => ({ success: false, error: { code, message } });

export function registerBuyerAccountRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerAccountRoutesDeps,
): void {
    const {
        normalizeEmail,
        requireIdentityInternal,
        loadBuyerByEmail,
        insertBuyer,
        loadBuyerById,
        linkStoreCustomer,
        claimOrders,
        startEmailChallenge,
        consumeEmailChallenge,
        revokeSessions,
        sendEmailCode,
    } = deps;

    // For the routes that also need a buyer session: the internal check runs FIRST, so a caller
    // without identity-platform's signature learns nothing about the token it presented.
    const identityInternal = createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const unauthorized = await requireIdentityInternal(c);
        if (unauthorized) return unauthorized;
        await next();
    });

    router.post('/buyer/register', async (c) => {
        const unauthorized = await requireIdentityInternal(c);
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
        const unauthorized = await requireIdentityInternal(c);
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
            await bcrypt.compare(body.password, TIMING_HASH);
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

    // ---------------------------------------------------------------------------------------------
    // APPID-P4a — proving the address, recovering the password, ending every session (migration 257)
    // ---------------------------------------------------------------------------------------------

    // One mapping for the outcomes both code routes share, so verify and reset cannot drift apart in
    // what they tell a buyer about a wrong, spent, expired or locked code.
    function codeFailure(c: AppContext, outcome: EmailChallengeOutcome['outcome']): Response {
        switch (outcome) {
            case 'invalid':
                return c.json(failure('CODE_INVALID', 'That code is incorrect or has already been used.'), 400);
            case 'expired':
                return c.json(failure('CODE_EXPIRED', 'That code has expired. Request a new one.'), 400);
            case 'locked':
                return c.json(failure('CODE_LOCKED', 'Too many incorrect attempts. Request a new code.'), 429);
            case 'address_changed':
                return c.json(failure('ADDRESS_CHANGED', 'Your email address changed after this code was sent. Request a new code.'), 409);
            case 'buyer_unavailable':
                return c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403);
            default:
                return c.json(dbFailureBody(), 500);
        }
    }

    router.post('/buyer/email-verification/start', identityInternal, requireBuyerSession, async (c) => {
        const resolved = await sessionBuyer(c);
        if ('response' in resolved) return resolved.response;
        if (resolved.buyer.email_verified) {
            return c.json(success({ already_verified: true }));
        }

        const { data: started, error } = await startEmailChallenge(c, { buyerAccountId: resolved.buyer.id, purpose: 'verify_email' });
        if (error || !started) return c.json(dbFailureBody(), 500);
        if (started.outcome === 'rate_limited') {
            return c.json(failure('TOO_MANY_CODES', 'Too many codes requested. Try again in an hour.'), 429);
        }
        if (started.outcome !== 'started') {
            return c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403);
        }

        const delivery = await sendEmailCode(c.env, { email: started.email, code: started.code, purpose: 'verify_email' });
        if (!delivery.sent) {
            return c.json(failure('EMAIL_UNAVAILABLE', "We couldn't send the code right now. Try again in a few minutes."), 503);
        }
        return c.json(success({ sent: true, expires_at: started.expires_at }));
    });

    router.post('/buyer/email-verification/complete', identityInternal, requireBuyerSession, async (c) => {
        const resolved = await sessionBuyer(c);
        if ('response' in resolved) return resolved.response;

        const body = await c.req.json().catch(() => null) as { code?: unknown } | null;
        const code = typeof body?.code === 'string' ? body.code.trim() : '';
        if (!EMAIL_CODE.test(code)) {
            return c.json(failure('VALIDATION', 'Enter the 6-digit code from the email.'), 400);
        }

        const { data: result, error } = await consumeEmailChallenge(c, {
            buyerAccountId: resolved.buyer.id,
            purpose: 'verify_email',
            code,
            newPasswordHash: null,
        });
        if (error || !result) return c.json(dbFailureBody(), 500);
        if (result.outcome !== 'verified') return codeFailure(c, result.outcome);

        return c.json(success({ buyer: publicBuyerAccount({ ...resolved.buyer, email_verified: true }) }));
    });

    // The same 202 whether or not an account exists, is active, is over its hourly limit, or could be
    // emailed, and identity-platform shows every caller one message. Two things still tell an address
    // with an account from one without, and neither is hidden here: only an account gets an email, so
    // this answers more slowly for one, and registration answers 409 for a taken address.
    router.post('/buyer/password-recovery/start', async (c) => {
        const unauthorized = await requireIdentityInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json().catch(() => null) as { email?: unknown } | null;
        if (typeof body?.email !== 'string' || !body.email.trim()) {
            return c.json(failure('VALIDATION', 'email is required'), 400);
        }
        const email = normalizeEmail(body.email);

        const { data: account, error } = await loadBuyerByEmail(c, email);
        if (error) return c.json(dbFailureBody(), 500);
        if (account && account.status === 'active') {
            const { data: started, error: startError } = await startEmailChallenge(c, { buyerAccountId: account.id, purpose: 'reset_password' });
            if (startError) return c.json(dbFailureBody(), 500);
            if (started?.outcome === 'started') {
                await sendEmailCode(c.env, { email: started.email, code: started.code, purpose: 'reset_password' });
            }
        }
        return c.json(success({ accepted: true }), 202);
    });

    router.post('/buyer/password-recovery/complete', async (c) => {
        const unauthorized = await requireIdentityInternal(c);
        if (unauthorized) return unauthorized;

        const body = await c.req.json().catch(() => null) as { email?: unknown; code?: unknown; password?: unknown } | null;
        const code = typeof body?.code === 'string' ? body.code.trim() : '';
        if (typeof body?.email !== 'string' || !body.email.trim() || typeof body.password !== 'string') {
            return c.json(failure('VALIDATION', 'email, code and password are required'), 400);
        }
        if (!EMAIL_CODE.test(code)) {
            return c.json(failure('VALIDATION', 'Enter the 6-digit code from the email.'), 400);
        }
        if (body.password.length < MIN_PASSWORD || body.password.length > MAX_PASSWORD) {
            return c.json(failure('VALIDATION', `Password must be ${MIN_PASSWORD} to ${MAX_PASSWORD} characters`), 400);
        }
        const email = normalizeEmail(body.email);

        const { data: account, error } = await loadBuyerByEmail(c, email);
        if (error) return c.json(dbFailureBody(), 500);
        // Hashed before the outcome is known, on every path, so an address with no account costs what
        // a wrong code costs and answers the same way.
        const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);
        if (!account) return codeFailure(c, 'invalid');

        const { data: result, error: consumeError } = await consumeEmailChallenge(c, {
            buyerAccountId: account.id,
            purpose: 'reset_password',
            code,
            newPasswordHash: passwordHash,
        });
        if (consumeError || !result) return c.json(dbFailureBody(), 500);
        if (result.outcome !== 'password_reset') return codeFailure(c, result.outcome);

        return c.json(success({
            buyer: publicBuyerAccount({ ...account, email_verified: true, session_epoch: result.session_epoch }),
        }));
    });

    // "Sign out everywhere". Application logout is identity-platform clearing one cookie and never
    // reaches this route; this one ends every session the account has, including the caller's.
    router.post('/buyer/sessions/revoke', identityInternal, requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);

        const { data: result, error } = await revokeSessions(c, session.buyerAccountId);
        if (error || !result) return c.json(dbFailureBody(), 500);
        if (result.outcome !== 'revoked') {
            return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);
        }
        return c.json(success({ revoked: true, session_epoch: result.session_epoch }));
    });
}
