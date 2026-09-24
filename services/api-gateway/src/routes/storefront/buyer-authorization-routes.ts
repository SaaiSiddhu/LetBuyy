// APPID-P4b — first-party authorization codes for buyer sign-in at a storefront (migration 258).
//
// The flow: a storefront sends the buyer to identity-platform with a PKCE S256 challenge and its
// callback URL. identity-platform asks /check which store that callback belongs to, so it can name
// the store; the buyer signs in there and chooses to continue; identity-platform asks for a code
// (/authorization-codes, with the buyer's session) and sends the browser back to the callback with
// it. The storefront's server exchanges code and verifier at identity-platform, which redeems the
// code here (/redeem) and mints a session bound to that store. The storefront's server then reads who
// is signed in with /storefront-session.
//
// THE CALLBACK IS WHERE THE CODE GOES, so it is checked twice: its shape here (parseStorefrontCallback)
// and its host against the storefront's own host resolver (a published store, at its primary domain).
// A code is never issued for a URL that fails either, and identity-platform never redirects to one.
//
// Nothing here mints a token. identity-platform is the sole issuer (ART-05).

import type { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { LETBUYY_STOREFRONT_BUYER_CALLBACK_PATH, LETBUYY_STOREFRONT_CLIENT_ID } from '@letbuyy/auth-core';
import type { Env } from '../../index';
import { dbFailureBody, success } from '../../lib/supabase';
import { getBuyerSession, requireBuyerSession } from '../../middleware/buyer-session';
import { getStorefrontBuyerSession, requireStorefrontBuyerSession } from '../../middleware/storefront-buyer-session';
import { publicBuyerAccount, type BuyerAccountRow } from './buyer-account-routes';
import type { AppContext } from './customer-engagement-routes';

const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export interface RedirectSite {
    id: string;
    name: string | null;
}

/// issue_buyer_authorization_code (258). `code` goes back to identity-platform, which puts it in the
/// callback URL: an authorization code is useless without the PKCE verifier the storefront holds.
export type AuthorizationCodeIssue =
    | { outcome: 'issued'; code: string; expires_at: string }
    | { outcome: 'buyer_unavailable' | 'invalid_request' };

/// redeem_buyer_authorization_code (258). Every refusal is 'invalid_grant'; audit_logs has the reason.
export type AuthorizationCodeRedemption =
    | { outcome: 'redeemed'; buyer_account_id: string; site_id: string; client_id: string; session_epoch: number }
    | { outcome: 'invalid_grant' };

export interface BuyerAuthorizationRoutesDeps {
    requireIdentityInternal: (c: AppContext) => Promise<Response | null>;
    /// commerce/web's server signs as 'storefront'. Requiring it on the storefront-session read means a
    /// storefront session is usable only through LetBuyy's own storefront servers, not by whoever
    /// copied the cookie.
    requireStorefrontInternal: (c: AppContext) => Promise<Response | null>;
    /// The published store whose PRIMARY host this is, or null.
    resolveRedirectSite: (c: AppContext, host: string) => Promise<{ data: RedirectSite | null; error: unknown }>;
    issueCode: (
        c: AppContext,
        input: { buyerAccountId: string; clientId: string; redirectUri: string; siteId: string; codeChallenge: string },
    ) => Promise<{ data: AuthorizationCodeIssue | null; error: unknown }>;
    redeemCode: (
        c: AppContext,
        input: { code: string; codeVerifier: string; clientId: string; redirectUri: string },
    ) => Promise<{ data: AuthorizationCodeRedemption | null; error: unknown }>;
    loadBuyerById: (c: AppContext, id: string) => Promise<{ data: BuyerAccountRow | null; error: unknown }>;
}

/// The only shape a storefront callback may take: https, or http on a localhost development host; no
/// credentials, query or fragment; the default port outside development; the exact callback path; and
/// written exactly as the URL parser writes it back, so two spellings of one address cannot be told
/// apart by one check and treated alike by another.
export function parseStorefrontCallback(redirectUri: string): { host: string } | null {
    let url: URL;
    try {
        url = new URL(redirectUri);
    } catch {
        return null;
    }
    const hostname = url.hostname.toLowerCase();
    const local = hostname === 'localhost' || hostname.endsWith('.localhost');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.port && !local) return null;
    if (url.pathname !== LETBUYY_STOREFRONT_BUYER_CALLBACK_PATH) return null;
    if (url.toString() !== redirectUri) return null;
    return { host: url.host };
}

const failure = (code: string, message: string) => ({ success: false, error: { code, message } });

export function registerBuyerAuthorizationRoutes(
    router: Hono<{ Bindings: Env }>,
    deps: BuyerAuthorizationRoutesDeps,
): void {
    const { requireIdentityInternal, requireStorefrontInternal, resolveRedirectSite, issueCode, redeemCode, loadBuyerById } = deps;

    const identityInternal = createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const refused = await requireIdentityInternal(c);
        if (refused) return refused;
        await next();
    });
    const storefrontInternal = createMiddleware<{ Bindings: Env }>(async (c, next) => {
        const refused = await requireStorefrontInternal(c);
        if (refused) return refused;
        await next();
    });

    async function callbackSite(
        c: AppContext,
        clientId: unknown,
        redirectUri: unknown,
    ): Promise<{ site: RedirectSite; redirectUri: string } | { response: Response }> {
        if (clientId !== LETBUYY_STOREFRONT_CLIENT_ID) {
            return { response: c.json(failure('UNAUTHORIZED_CLIENT', 'Unknown client.'), 400) };
        }
        const parsed = typeof redirectUri === 'string' ? parseStorefrontCallback(redirectUri) : null;
        if (!parsed || typeof redirectUri !== 'string') {
            return { response: c.json(failure('INVALID_REDIRECT', 'That return address is not a LetBuyy store.'), 400) };
        }
        const { data: site, error } = await resolveRedirectSite(c, parsed.host);
        if (error) return { response: c.json(dbFailureBody(), 500) };
        if (!site) {
            return { response: c.json(failure('INVALID_REDIRECT', 'That return address is not a LetBuyy store.'), 400) };
        }
        return { site, redirectUri };
    }

    // Asked before the buyer signs in, so identity-platform can name the store, and refuse a callback
    // that is not one, without a session.
    router.post('/buyer/authorization-codes/check', identityInternal, async (c) => {
        const body = await c.req.json().catch(() => null) as { client_id?: unknown; redirect_uri?: unknown } | null;
        const resolved = await callbackSite(c, body?.client_id, body?.redirect_uri);
        if ('response' in resolved) return resolved.response;
        return c.json(success({ site: resolved.site }));
    });

    router.post('/buyer/authorization-codes', identityInternal, requireBuyerSession, async (c) => {
        const session = getBuyerSession(c);
        if (!session) return c.json(failure('UNAUTHORIZED', 'A buyer session is required.'), 401);

        const body = await c.req.json().catch(() => null) as {
            client_id?: unknown; redirect_uri?: unknown; code_challenge?: unknown; code_challenge_method?: unknown;
        } | null;
        if (body?.code_challenge_method !== 'S256' || typeof body.code_challenge !== 'string' || !PKCE_CHALLENGE.test(body.code_challenge)) {
            return c.json(failure('INVALID_REQUEST', 'A PKCE S256 code challenge is required.'), 400);
        }
        const resolved = await callbackSite(c, body.client_id, body.redirect_uri);
        if ('response' in resolved) return resolved.response;

        // The buyer is the session's, never the body's.
        const { data: issued, error } = await issueCode(c, {
            buyerAccountId: session.buyerAccountId,
            clientId: LETBUYY_STOREFRONT_CLIENT_ID,
            redirectUri: resolved.redirectUri,
            siteId: resolved.site.id,
            codeChallenge: body.code_challenge,
        });
        if (error || !issued) return c.json(dbFailureBody(), 500);
        if (issued.outcome === 'buyer_unavailable') return c.json(failure('BUYER_DISABLED', 'Account is disabled.'), 403);
        if (issued.outcome !== 'issued') return c.json(failure('INVALID_REQUEST', 'The sign-in request is not valid.'), 400);
        return c.json(success({ code: issued.code, expires_at: issued.expires_at, site: resolved.site }));
    });

    router.post('/buyer/authorization-codes/redeem', identityInternal, async (c) => {
        const body = await c.req.json().catch(() => null) as {
            code?: unknown; code_verifier?: unknown; client_id?: unknown; redirect_uri?: unknown;
        } | null;
        const invalidGrant = () => c.json(failure('INVALID_GRANT', 'The sign-in code is not valid.'), 400);
        if (
            typeof body?.code !== 'string' || typeof body.code_verifier !== 'string'
            || typeof body.client_id !== 'string' || typeof body.redirect_uri !== 'string'
        ) {
            return invalidGrant();
        }

        const { data: redeemed, error } = await redeemCode(c, {
            code: body.code,
            codeVerifier: body.code_verifier,
            clientId: body.client_id,
            redirectUri: body.redirect_uri,
        });
        if (error || !redeemed) return c.json(dbFailureBody(), 500);
        if (redeemed.outcome !== 'redeemed') return invalidGrant();

        const { data: buyer, error: buyerError } = await loadBuyerById(c, redeemed.buyer_account_id);
        if (buyerError) return c.json(dbFailureBody(), 500);
        if (!buyer || buyer.status !== 'active') return invalidGrant();

        return c.json(success({
            buyer: publicBuyerAccount(buyer),
            site_id: redeemed.site_id,
            // The epoch the code was issued in, which the database has just confirmed is current.
            session_epoch: redeemed.session_epoch,
        }));
    });

    // Who is signed in at this store. Read by the storefront's own server, with the store in the query.
    router.get('/buyer/storefront-session', storefrontInternal, requireStorefrontBuyerSession, async (c) => {
        const session = getStorefrontBuyerSession(c);
        if (!session) return c.json(failure('UNAUTHORIZED', 'A storefront sign-in is required.'), 401);
        const { data: buyer, error } = await loadBuyerById(c, session.buyerAccountId);
        if (error) return c.json(dbFailureBody(), 500);
        if (!buyer) return c.json(failure('UNAUTHORIZED', 'A storefront sign-in is required.'), 401);
        return c.json(success({
            buyer: { id: buyer.id, email: buyer.email, email_verified: Boolean(buyer.email_verified) },
            site_id: session.siteId,
        }));
    });
}
