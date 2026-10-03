// Own profile/address data is shared across approved buyer channels. Each channel
// keeps its existing verifier, audience and live account checks. This gate belongs
// only on these data routes; it does not grant storefront tokens broker authority.
import { createMiddleware } from 'hono/factory';
import { LETBUYY_BUYER_SESSION_COOKIE, LETBUYY_BUYER_SESSION_HEADER, LETBUYY_STOREFRONT_SESSION_HEADER } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { requireBuyerSession } from './buyer-session';
import { requireStorefrontBuyerSession } from './storefront-buyer-session';

export const requireBuyerDataSession = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    if (c.req.header(LETBUYY_STOREFRONT_SESSION_HEADER) === undefined) return requireBuyerSession(c, next);
    const hasPlatformCookie = (c.req.header('cookie') || '').split(';')
        .some((part) => part.trim().split('=')[0] === LETBUYY_BUYER_SESSION_COOKIE);
    if (c.req.header(LETBUYY_BUYER_SESSION_HEADER) !== undefined || hasPlatformCookie) {
        return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
    }
    return requireStorefrontBuyerSession(c, async () => {
        const session = c.get('storefrontBuyerSession');
        c.set('buyerSession', { buyerAccountId: session.buyerAccountId });
        await next();
    });
});
