// APPID-P4b — a buyer's session at one storefront, as the gateway reads it.
//
// identity-platform mints it when a storefront redeems a first-party authorization code, and it
// names the site it was issued for. Three things must hold, in this order, or the request is refused:
//
//   1. The token verifies as a storefront session (its own audience: a platform buyer session is not
//      accepted here, and this one is not accepted where a platform buyer session is required).
//   2. The account is active and still in the session epoch the token was issued in, read on every
//      request exactly as requireBuyerSession reads it, and failing closed the same way.
//   3. The request is for the token's site. The site comes from the `store_id` query parameter, so a
//      route using this middleware must take its store there. A session from one store is refused
//      at every other store, which is the whole point of binding it: a storefront keeps it in a
//      cookie on the store's own host, and a merchant can point a custom domain at their own server.

import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { resolveIdentityIssuedStorefrontSession } from '../lib/identity-session-verifier';
import { loadBuyerSessionState, type BuyerSessionStateLoader } from './buyer-session';

export interface StorefrontBuyerSessionContext {
    buyerAccountId: string;
    siteId: string;
}

declare module 'hono' {
    interface ContextVariableMap {
        storefrontBuyerSession: StorefrontBuyerSessionContext;
    }
}

export function getStorefrontBuyerSession(c: Context): StorefrontBuyerSessionContext | null {
    return c.get('storefrontBuyerSession') || null;
}

const unauthorized = (c: Context) =>
    c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A storefront sign-in is required.' } }, 401);

export const requireStorefrontBuyerSession = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const token = c.req.header(LETBUYY_STOREFRONT_SESSION_HEADER);
    if (!token) return unauthorized(c);

    const resolved = await resolveIdentityIssuedStorefrontSession(c.env, token);
    if (!resolved.ok) return unauthorized(c);

    // Before the account read, so a token presented at the wrong store costs no database work.
    const requestedSite = (c.req.query('store_id') || '').toLowerCase();
    if (!requestedSite || requestedSite !== resolved.siteId) return unauthorized(c);

    const loader: BuyerSessionStateLoader = c.get('buyerSessionStateLoader') ?? loadBuyerSessionState;
    let state: Awaited<ReturnType<BuyerSessionStateLoader>>;
    try {
        state = await loader(c, resolved.buyerAccountId);
    } catch (error) {
        state = { data: null, error };
    }
    if (state.error) {
        return c.json({ success: false, error: { code: 'SESSION_CHECK_UNAVAILABLE', message: 'Your session could not be checked. Try again shortly.' } }, 503);
    }
    if (!state.data || state.data.session_epoch !== resolved.sessionEpoch) return unauthorized(c);
    if (state.data.status !== 'active') {
        return c.json({ success: false, error: { code: 'BUYER_DISABLED', message: 'Account is disabled.' } }, 403);
    }

    c.set('storefrontBuyerSession', { buyerAccountId: resolved.buyerAccountId, siteId: resolved.siteId });
    await next();
});
