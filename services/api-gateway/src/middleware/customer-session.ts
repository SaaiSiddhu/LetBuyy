import {
    LETBUYY_CUSTOMER_SESSION_COOKIE,
    verifyCustomerSession,
    verifyCustomerSessionToken,
} from '@letbuyy/auth-core';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';
import { writeRuntimeTelemetryDataPoint } from '@letbuyy/infrastructure/runtime-telemetry-adapter';
import { acceptsCustomerSessionFormat } from '../lib/customer-session-compatibility';

export interface CustomerSessionContext {
    storeId: string;
    customerId: string;
}

declare module 'hono' {
    interface ContextVariableMap {
        customer: CustomerSessionContext;
    }
}

export function getCustomerSession(c: Context): CustomerSessionContext | null {
    return c.get('customer') || null;
}

export const requireCustomerSession = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
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
        const session = await verifyGatewayCustomerSession(c);
        if (session) c.set('customer', session);

        await next();
    },
);

export async function verifyGatewayCustomerSession(c: Context<{ Bindings: Env }>): Promise<CustomerSessionContext | null> {
    const token = readCustomerSessionToken(c);
    const compatibility = c.env.CUSTOMER_SESSION_COMPATIBILITY;
    if (acceptsCustomerSessionFormat(compatibility, 'gateway_hs256_v1')) {
        const session = await verifyCustomerSession(token, c.env.CUSTOMER_SESSION_SECRET);
        if (session) {
            recordCustomerSessionFormat(c, 'gateway_hs256_v1');
            return session;
        }
    }

    if (!acceptsCustomerSessionFormat(compatibility, 'shopper_hs256_legacy')) return null;
    const legacySession = await verifyCustomerSessionToken(token, c.env.CUSTOMER_SESSION_SECRET);
    if (!legacySession.accepted || !legacySession.payload) return null;

    recordCustomerSessionFormat(c, 'shopper_hs256_legacy');

    return {
        storeId: legacySession.payload.storeId,
        customerId: legacySession.payload.sub,
    };
}

/** Record a successful gateway-side mint without retaining any buyer, store, or token data. */
export function recordCustomerSessionIssued(
    c: Context<{ Bindings: Env }>,
    operation: 'password_reset' | 'password_login',
): void {
    try {
        writeRuntimeTelemetryDataPoint(c.env.RUNTIME_TELEMETRY, {
            metricName: 'letbuyy.identity.store_customer_session.issued',
            runtimeName: c.env.RUNTIME_NAME || 'api-gateway',
            environment: c.env.ENVIRONMENT,
            deploymentEnv: c.env.DEPLOYMENT_ENV || c.env.ENVIRONMENT,
            telemetryEnv: c.env.TELEMETRY_ENV || c.env.ENVIRONMENT,
            index: 'letbuyy-store-customer-session-transition',
            blobs: ['gateway_hs256_v1', operation],
            doubles: [1],
        });
    } catch {
        // Telemetry is best-effort and must never change session issuance behavior.
    }
}

function customerSessionRouteClass(path: string): string {
    const normalized = path.toLowerCase().split('?')[0];
    if (/\/customer\/orders?(\/|$)/.test(normalized)) return 'orders';
    if (/\/customer\/addresses?(\/|$)/.test(normalized)) return 'addresses';
    if (/\/customer\/(profile|account)(\/|$)/.test(normalized)) return 'profile';
    if (/\/customer\/wishlist(\/|$)/.test(normalized)) return 'wishlist';
    if (/\/customer\/(reviews?|engagement|activity|loyalty)(\/|$)/.test(normalized)) return 'engagement';
    if (/\/graphql(\/|$)/.test(normalized)) return 'graphql';
    return 'other_customer_route';
}

function recordCustomerSessionFormat(
    c: Context<{ Bindings: Env }>,
    format: 'gateway_hs256_v1' | 'shopper_hs256_legacy',
): void {
    try {
        writeRuntimeTelemetryDataPoint(c.env.RUNTIME_TELEMETRY, {
            metricName: 'letbuyy.identity.store_customer_session.accepted',
            runtimeName: c.env.RUNTIME_NAME || 'api-gateway',
            environment: c.env.ENVIRONMENT,
            deploymentEnv: c.env.DEPLOYMENT_ENV || c.env.ENVIRONMENT,
            telemetryEnv: c.env.TELEMETRY_ENV || c.env.ENVIRONMENT,
            // This stable index intentionally groups all stores and users together. The metric
            // contains only accepted token format and a bounded route class, never identifiers.
            index: 'letbuyy-store-customer-session-transition',
            blobs: [format, customerSessionRouteClass(c.req.path)],
            doubles: [1],
        });
    } catch {
        // Telemetry is best-effort and must never change the authentication decision.
    }
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
        if (rawKey === name) {
            try {
                return decodeURIComponent(rawValue.join('=') || '');
            } catch {
                // A malformed cookie is an absent credential, not a request-wide error.
                // Continue through the normal verifier so auth fails closed and a valid
                // explicit session header can still be considered.
                return null;
            }
        }
    }

    return null;
}
