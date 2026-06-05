import {
    LETBUYY_CUSTOMER_SESSION_COOKIE,
    verifyCustomerSession,
    verifyCustomerSessionToken,
} from '@letbuyy/auth-core';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';

export interface CustomerSessionContext {
    storeId: string;
    customerId: string;
}

declare module 'hono' {
    interface ContextVariableMap {
        customer: CustomerSessionContext;
    }
}

export function isCustomerLegacyAuthEnabled(env: Pick<Env, 'CUSTOMER_LEGACY_AUTH'>): boolean {
    const value = env.CUSTOMER_LEGACY_AUTH?.trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'on';
}

export function getCustomerSession(c: Context): CustomerSessionContext | null {
    return c.get('customer') || null;
}

export const requireCustomerSession = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        if (isCustomerLegacyAuthEnabled(c.env)) {
            await next();
            return;
        }

        const session = await verifyGatewayCustomerSession(c);

        if (!session) {
            return c.json(
                {
                    success: false,
                    error: {
                        code: 'CUSTOMER_SESSION_REQUIRED',
                        message: 'A valid customer session is required',
                    },
                },
                401,
            );
        }

        c.set('customer', session);
        await next();
    },
);

export const optionalCustomerSession = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        if (!isCustomerLegacyAuthEnabled(c.env)) {
            const session = await verifyGatewayCustomerSession(c);
            if (session) c.set('customer', session);
        }

        await next();
    },
);

export async function verifyGatewayCustomerSession(c: Context<{ Bindings: Env }>): Promise<CustomerSessionContext | null> {
    const token = readCustomerSessionToken(c);
    const session = await verifyCustomerSession(token, c.env.CUSTOMER_SESSION_SECRET);
    if (session) return session;

    const legacySession = await verifyCustomerSessionToken(token, c.env.CUSTOMER_SESSION_SECRET);
    if (!legacySession.accepted || !legacySession.payload) return null;

    return {
        storeId: legacySession.payload.storeId,
        customerId: legacySession.payload.sub,
    };
}

function readCustomerSessionToken(c: Context): string | null {
    return (
        parseCookie(c.req.header('cookie'), LETBUYY_CUSTOMER_SESSION_COOKIE) ||
        c.req.header('X-LetBuyy-Customer-Session') ||
        null
    );
}

function parseCookie(header: string | undefined, name: string): string | null {
    if (!header) return null;

    for (const part of header.split(';')) {
        const [rawKey, ...rawValue] = part.trim().split('=');
        if (rawKey === name) return decodeURIComponent(rawValue.join('=') || '');
    }

    return null;
}
