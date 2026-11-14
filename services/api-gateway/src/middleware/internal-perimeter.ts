import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import type { Env } from '../index';

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
