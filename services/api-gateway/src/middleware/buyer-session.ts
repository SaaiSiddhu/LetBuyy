// D-8 — the marketplace buyer session, as read by the gateway.
//
// Mirrors middleware/customer-session.ts in shape, and differs from it in the one way that matters:
// it accepts ONLY a buyer-realm token. A merchant or customer token presented here is rejected, and
// that is enforced by the verifier's audience and realm checks rather than by this file's diligence.
//
// A valid signature is not enough on its own (APPID-P4a, migration 257). The token must also come
// from the account's CURRENT session epoch, and the account must still be active. A password reset
// or "sign out everywhere" advances the epoch, and from that moment every earlier token is refused
// here, on every device, although each stays signed and unexpired for up to 30 days. That needs one
// indexed read of buyer_accounts per request, and it fails closed: if the read fails, the request
// is refused with a 503, never waved through on the signature alone.

import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { LETBUYY_BUYER_SESSION_COOKIE, LETBUYY_BUYER_SESSION_HEADER } from '@letbuyy/auth-core';
import type { Env } from '../index';
import { resolveIdentityIssuedBuyerSession } from '../lib/identity-session-verifier';
import { getSupabaseAdmin } from '../lib/supabase';

export interface BuyerSessionContext {
    buyerAccountId: string;
}

export interface BuyerSessionState {
    status: string;
    session_epoch: number;
}

/// Reads what decides whether a verified token is still good. Injectable per request through the
/// 'buyerSessionStateLoader' context variable so route tests can run without a database; nothing in
/// production sets that variable, so production always reads buyer_accounts.
export type BuyerSessionStateLoader = (
    c: Context<{ Bindings: Env }>,
    buyerAccountId: string,
) => Promise<{ data: BuyerSessionState | null; error: unknown }>;

export const loadBuyerSessionState: BuyerSessionStateLoader = async (c, buyerAccountId) => {
    const { data, error } = await getSupabaseAdmin(c)
        .from('buyer_accounts')
        .select('status, session_epoch')
        .eq('id', buyerAccountId)
        .maybeSingle();
    return { data: (data ?? null) as BuyerSessionState | null, error };
};

declare module 'hono' {
    interface ContextVariableMap {
        // A SEPARATE slot from 'customer'. Sharing one would let a buyer session satisfy a
        // getCustomerSession() check somewhere downstream, which is the realm confusion this whole
        // programme is built to avoid.
        buyerSession: BuyerSessionContext;
        buyerSessionStateLoader: BuyerSessionStateLoader;
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
            if (name === LETBUYY_BUYER_SESSION_COOKIE) {
                try { return decodeURIComponent(rest.join('=')); } catch { return null; }
            }
        }
    }
    return c.req.header(LETBUYY_BUYER_SESSION_HEADER) || null;
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

    const loader = c.get('buyerSessionStateLoader') ?? loadBuyerSessionState;
    let state: Awaited<ReturnType<BuyerSessionStateLoader>>;
    try {
        state = await loader(c, resolved.buyerAccountId);
    } catch (error) {
        state = { data: null, error };
    }
    if (state.error) {
        return c.json({ success: false, error: { code: 'SESSION_CHECK_UNAVAILABLE', message: 'Your session could not be checked. Try again shortly.' } }, 503);
    }
    // A deleted account and a token from an ended session get the same answer as a bad signature.
    if (!state.data || state.data.session_epoch !== resolved.sessionEpoch) {
        return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'A buyer session is required.' } }, 401);
    }
    if (state.data.status !== 'active') {
        return c.json({ success: false, error: { code: 'BUYER_DISABLED', message: 'Account is disabled.' } }, 403);
    }

    c.set('buyerSession', { buyerAccountId: resolved.buyerAccountId });
    await next();
});
