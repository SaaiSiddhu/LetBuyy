import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';
import { isBoundStorefrontRequestTarget, isBoundDomainReconcileTarget, isNotificationRequestTarget, isProductImportRequestTarget } from '@letbuyy/auth-core';
import { authenticateProductImportRequest } from '../lib/product-import-internal-request';
import { authenticateNotificationRequest } from '../lib/notification-internal-request';
import { authenticateDomainReconcileRequest } from '../lib/domain-reconcile-internal-request';
import { authenticateBoundStorefrontRequest } from '../lib/storefront-internal-request';

type RuntimeEnvironmentFlags = Pick<Env, 'ENVIRONMENT' | 'APP_ENV' | 'NODE_ENV' | 'DEPLOYMENT_ENV'>;

function runtimeFlagValues(env: RuntimeEnvironmentFlags): string[] {
    return [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV, env.DEPLOYMENT_ENV]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}

function isProductionRuntime(env: RuntimeEnvironmentFlags): boolean {
    return runtimeFlagValues(env).includes('production');
}

type GatewayContext = Context<{ Bindings: Env }>;

function sourceIp(c: GatewayContext): string | null {
    const forwardedFor = c.req.header('X-Forwarded-For')?.split(',')[0]?.trim();
    return c.req.header('CF-Connecting-IP')?.trim() || c.req.header('X-Real-IP')?.trim() || forwardedFor || null;
}

function ipv4ToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let value = 0;
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) return null;
        const octet = Number(part);
        if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
        value = (value << 8) + octet;
    }

    return value >>> 0;
}

function matchesIpv4Cidr(ip: string, cidr: string): boolean {
    const [base, prefixText] = cidr.split('/');
    const prefix = Number(prefixText);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

    const ipNumber = ipv4ToNumber(ip);
    const baseNumber = ipv4ToNumber(base);
    if (ipNumber === null || baseNumber === null) return false;

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipNumber & mask) === (baseNumber & mask);
}

function allowlistEntries(env: Pick<Env, 'INTERNAL_GATEWAY_IP_ALLOWLIST'>): string[] {
    return String(env.INTERNAL_GATEWAY_IP_ALLOWLIST || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function ipAllowed(ip: string | null, entries: string[]): boolean {
    if (!ip) return false;

    return entries.some((entry) => {
        if (entry.includes('/')) return matchesIpv4Cidr(ip, entry);
        return entry === ip;
    });
}

function hasInternalCredential(c: GatewayContext): boolean {
    const bearer = c.req.header('Authorization')?.startsWith('Bearer ');
    const directSecret = Boolean(c.req.header('X-Internal-API-Secret'));
    const signedInternal = Boolean(
        c.req.header('X-LetBuyy-Internal-Signature') &&
        c.req.header('X-LetBuyy-Internal-Timestamp') &&
        c.req.header('X-LetBuyy-Internal-JTI'),
    );

    return Boolean(bearer || directSecret || signedInternal);
}

export const internalPerimeter = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    // Dormant until this distinct fixed-purpose secret binding is admitted.
    // This grants no generic internal route or app/Identity credential.
    if(isProductImportRequestTarget(c.req.method,c.req.url)) {
        const result=await authenticateProductImportRequest(c);
        if(result!=='accepted')return c.json({success:false,error:{
            code:result==='unavailable'?'PRODUCT_IMPORT_UNAVAILABLE':'UNAUTHORIZED',
            message:result==='unavailable'?'Import recovery is unavailable.':'Invalid import recovery request',
        }},result==='unavailable'?503:401);
        await next();return;
    }
    // Owner-approved fixed notification transport; no general RPC/IP exemption.
    if (isNotificationRequestTarget(c.req.method, c.req.url)) {
        const result = await authenticateNotificationRequest(c);
        if (result !== 'accepted') return c.json({ success: false, error: {
            code: result === 'unavailable' ? 'NOTIFICATION_JOB_UNAVAILABLE' : 'UNAUTHORIZED',
            message: result === 'unavailable' ? 'Notification processing is unavailable.' : 'Invalid notification request',
        } }, result === 'unavailable' ? 503 : 401);
        await next(); return;
    }
    // Owner-approved workload boundary for these two fixed Commerce operations.
    // Every other internal path still takes the IP perimeter below.
    const storefrontPolicy = c.env.STOREFRONT_INTERNAL_PERIMETER?.trim();
    if (storefrontPolicy && isBoundStorefrontRequestTarget(c.req.method, c.req.url)) {
        const result = storefrontPolicy === 'bound-request-v1'
            ? await authenticateBoundStorefrontRequest(c) : 'unavailable';
        if (result !== 'accepted') {
            return c.json({ success: false, error: {
                code: result === 'unavailable' ? 'STOREFRONT_INTERNAL_UNAVAILABLE' : 'UNAUTHORIZED',
                message: result === 'unavailable' ? 'Store access is unavailable.' : 'Invalid storefront internal request',
            } }, result === 'unavailable' ? 503 : 401);
        }
        await next();
        return;
    }

    // Owner-approved exception for exactly this queue-owned operation. A configured
    // keyring opts in; every other path and an unconfigured deployment retain the IP gate.
    if (c.env.INTERNAL_API_KEYRING && isBoundDomainReconcileTarget(c.req.method, c.req.url)) {
        const result = await authenticateDomainReconcileRequest(c);
        if (result !== 'accepted') return c.json({ success: false, error: {
            code: result === 'unavailable' ? 'DOMAIN_RECONCILE_UNAVAILABLE' : 'UNAUTHORIZED',
            message: result === 'unavailable' ? 'Domain reconciliation is unavailable.' : 'Invalid domain reconciliation request',
        } }, result === 'unavailable' ? 503 : 401);
        await next(); return;
    }
    const entries = allowlistEntries(c.env);
    const production = isProductionRuntime(c.env);

    if (production && entries.length === 0) {
        return c.json({
            success: false,
            error: {
                code: 'INTERNAL_PERIMETER_UNCONFIGURED',
                message: 'Internal gateway IP allowlist is not configured.',
            },
        }, 503);
    }

    if (entries.length > 0 && !ipAllowed(sourceIp(c), entries)) {
        return c.json({
            success: false,
            error: {
                code: 'INTERNAL_PERIMETER_FORBIDDEN',
                message: 'Internal gateway source is not allowed.',
            },
        }, 403);
    }

    if (!hasInternalCredential(c)) {
        return c.json({
            success: false,
            error: {
                code: 'INTERNAL_CREDENTIAL_REQUIRED',
                message: 'Internal gateway credential is required.',
            },
        }, 401);
    }

    await next();
});
