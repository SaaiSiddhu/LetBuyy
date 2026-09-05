// D-8 — the marketplace buyer session, as read by the gateway.
//
// Mirrors middleware/customer-session.ts in shape, and differs from it in the one way that matters:
// it accepts ONLY a buyer-realm token. A merchant or customer token presented here is rejected, and
// that is enforced by the verifier's audience and realm checks rather than by this file's diligence.

import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { LETBUYY_BUYER_SESSION_COOKIE } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { resolveIdentityIssuedBuyerSession } from '../lib/identity-session-verifier';

export interface BuyerSessionContext {
    buyerAccountId: string;
}

declare module 'hono' {
    interface ContextVariableMap {
        // A SEPARATE slot from 'customer'. Sharing one would let a buyer session satisfy a
        // getCustomerSession() check somewhere downstream, which is the realm confusion this whole
        // programme is built to avoid.
        buyerSession: BuyerSessionContext;
    }
}

export function getBuyerSession(c: Context): BuyerSessionContext | null {
    return c.get('buyerSession') || null;
}

function readBuyerToken(c: Context<{ Bindings: Env }>): string | null {
    const cookieHeader = c.req.header('cookie');
    if (cookieHeader) {
        for (const part of cookieHeader.split(';')) {
            const [name, ...rest] = part.trim().split('=');
            if (name === LETBUYY_BUYER_SESSION_COOKIE) return decodeURIComponent(rest.join('='));
        }
    }
    return c.req.header('X-LetBuyy-Buyer-Session') || null;
}

export const requireBuyerSession = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const token = readBuyerToken(c);
    if (!token) {
        return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
    }

    const resolved = await resolveIdentityIssuedBuyerSession(c.env, token);
    if (!resolved.ok) {
        // The reason is deliberately not echoed. It distinguishes "wrong realm" from "expired" from
        // "bad signature", which tells an attacker which of those to fix next.
        return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
    }

    c.set('buyerSession', { buyerAccountId: resolved.buyerAccountId });
    await next();
});
