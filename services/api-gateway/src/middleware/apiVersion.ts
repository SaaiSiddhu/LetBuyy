import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';

export const CURRENT_API_VERSION = '2026-06-01';
export const SUPPORTED_API_VERSIONS = ['2026-01-01', CURRENT_API_VERSION] as const;

declare module 'hono' {
    interface ContextVariableMap {
        apiVersion: string;
    }
}

function isDateVersion(version: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(version) && !Number.isNaN(Date.parse(`${version}T00:00:00.000Z`));
}

export function resolveApiVersion(input: {
    headerVersion?: string | null;
    alternateHeaderVersion?: string | null;
    queryVersion?: string | null;
}): { accepted: true; version: string } | { accepted: false; status: number; code: string; message: string } {
    const requestedVersion = (
        input.headerVersion ||
        input.alternateHeaderVersion ||
        input.queryVersion ||
        CURRENT_API_VERSION
    ).trim();

    if (!isDateVersion(requestedVersion)) {
        return {
            accepted: false,
            status: 400,
            code: 'INVALID_API_VERSION',
            message: 'API version must use YYYY-MM-DD format',
        };
    }

    if (!SUPPORTED_API_VERSIONS.includes(requestedVersion as typeof SUPPORTED_API_VERSIONS[number])) {
        return {
            accepted: false,
            status: 400,
            code: 'UNSUPPORTED_API_VERSION',
            message: `Unsupported API version: ${requestedVersion}`,
        };
    }

    return { accepted: true, version: requestedVersion };
}

export const apiVersioning = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const resolved = resolveApiVersion({
        headerVersion: c.req.header('X-LetBuyy-API-Version'),
        alternateHeaderVersion: c.req.header('LetBuyy-API-Version'),
        queryVersion: c.req.query('api_version'),
    });

    if (!resolved.accepted) {
        return c.json(
            {
                error: {
                    code: resolved.code,
                    message: resolved.message,
                    current_version: CURRENT_API_VERSION,
                    supported_versions: [...SUPPORTED_API_VERSIONS],
                },
            },
            resolved.status as 400
        );
    }

    c.set('apiVersion', resolved.version);
    c.header('X-LetBuyy-API-Version', resolved.version);
    c.header('Vary', 'X-LetBuyy-API-Version, LetBuyy-API-Version');

    await next();
});
