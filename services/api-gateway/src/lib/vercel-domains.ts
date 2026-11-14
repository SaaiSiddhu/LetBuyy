export type VercelMappedDomainStatus = 'pending' | 'verifying' | 'active' | 'error';

export interface VercelDomainEnv {
    VERCEL_API_TOKEN?: string;
    VERCEL_STOREFRONT_PROJECT_ID?: string;
    VERCEL_TEAM_ID?: string;
    VERCEL_ORG_ID?: string;
    VERCEL_TEAM_SLUG?: string;
}

export interface VercelDomainStatusResult {
    status: VercelMappedDomainStatus;
    verified: boolean;
    configuredBy: string | null;
    misconfigured: boolean;
    projectDomain: Record<string, unknown> | null;
    config: Record<string, unknown> | null;
}

export class VercelDomainConfigError extends Error {
    readonly code: string;
    readonly status: number;

    constructor(message: string, code: string, status = 500) {
        super(message);
        this.name = 'VercelDomainConfigError';
        this.code = code;
        this.status = status;
    }
}

type FetchLike = typeof fetch;

function requireVercelEnv(env: VercelDomainEnv): { token: string; projectId: string; teamId?: string; slug?: string } {
    const token = env.VERCEL_API_TOKEN?.trim();
    const projectId = env.VERCEL_STOREFRONT_PROJECT_ID?.trim();
    if (!token) throw new VercelDomainConfigError('VERCEL_API_TOKEN is required for custom-domain automation', 'VERCEL_API_TOKEN_REQUIRED', 503);
    if (!projectId) throw new VercelDomainConfigError('VERCEL_STOREFRONT_PROJECT_ID is required for custom-domain automation', 'VERCEL_STOREFRONT_PROJECT_ID_REQUIRED', 503);
    return {
        token,
        projectId,
        teamId: env.VERCEL_TEAM_ID?.trim() || env.VERCEL_ORG_ID?.trim() || undefined,
        slug: env.VERCEL_TEAM_SLUG?.trim() || undefined,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringField(value: Record<string, unknown> | null, key: string): string | null {
    const candidate = value?.[key];
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

function boolField(value: Record<string, unknown> | null, key: string): boolean {
    return value?.[key] === true;
}

function vercelUrl(path: string, env: VercelDomainEnv, extra: Record<string, string | undefined> = {}): string {
    const { projectId, teamId, slug } = requireVercelEnv(env);
    const url = new URL(`https://api.vercel.com${path.replace('{projectId}', encodeURIComponent(projectId))}`);
    for (const [key, value] of Object.entries({ teamId, slug, ...extra })) {
        if (value) url.searchParams.set(key, value);
    }
    return url.toString();
}

function retryAfterMs(headers: Headers): number {
    const retryAfter = headers.get('Retry-After');
    const seconds = retryAfter ? Number(retryAfter) : 0;
    return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5000) : 250;
}

async function delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestVercelJson(
    env: VercelDomainEnv,
    path: string,
    init: RequestInit = {},
    fetchImpl: FetchLike = fetch,
    retries = 2,
): Promise<Record<string, unknown>> {
    const { token } = requireVercelEnv(env);
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');
    const response = await fetchImpl(vercelUrl(path, env), {
        ...init,
        headers,
    });
    const body = await response.json().catch(() => null) as unknown;
    const payload = isRecord(body) ? body : {};

    if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && retries > 0) {
            await delay(retryAfterMs(response.headers));
            return requestVercelJson(env, path, init, fetchImpl, retries - 1);
        }
        const errorRecord = isRecord(payload.error) ? payload.error : null;
        const code = stringField(errorRecord, 'code') || `VERCEL_${response.status}`;
        const message = stringField(errorRecord, 'message') || stringField(payload, 'message') || 'Vercel domain request failed';
        throw new VercelDomainConfigError(message, code, response.status);
    }

    return payload;
}

export async function getVercelProjectDomain(
    env: VercelDomainEnv,
    domain: string,
    fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown> | null> {
    try {
        return await requestVercelJson(env, `/v9/projects/{projectId}/domains/${encodeURIComponent(domain)}`, {}, fetchImpl);
    } catch (error) {
        if (error instanceof VercelDomainConfigError && error.status === 404) return null;
        throw error;
    }
}

export async function attachVercelProjectDomain(
    env: VercelDomainEnv,
    domain: string,
    fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown> | null> {
    try {
        return await requestVercelJson(env, '/v10/projects/{projectId}/domains', {
            method: 'POST',
            body: JSON.stringify({ name: domain }),
        }, fetchImpl);
    } catch (error) {
        if (
            error instanceof VercelDomainConfigError
            && (error.status === 400 || error.status === 409)
            && /already|exists|domain/i.test(error.message)
        ) {
            return getVercelProjectDomain(env, domain, fetchImpl);
        }
        throw error;
    }
}

export async function getVercelDomainConfig(
    env: VercelDomainEnv,
    domain: string,
    fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown> | null> {
    const { projectId } = requireVercelEnv(env);
    try {
        return await requestVercelJson(
            env,
            `/v6/domains/${encodeURIComponent(domain)}/config?projectIdOrName=${encodeURIComponent(projectId)}`,
            {},
            fetchImpl,
        );
    } catch (error) {
        if (error instanceof VercelDomainConfigError && error.status === 404) return null;
        throw error;
    }
}

export async function readVercelDomainStatus(
    env: VercelDomainEnv,
    domain: string,
    fetchImpl: FetchLike = fetch,
): Promise<VercelDomainStatusResult> {
    const [projectDomain, config] = await Promise.all([
        getVercelProjectDomain(env, domain, fetchImpl),
        getVercelDomainConfig(env, domain, fetchImpl),
    ]);
    const verified = boolField(projectDomain, 'verified');
    const configuredBy = stringField(config, 'configuredBy');
    const misconfigured = boolField(config, 'misconfigured');

    const status: VercelMappedDomainStatus = !projectDomain
        ? 'pending'
        : verified && configuredBy && !misconfigured
            ? 'active'
            : misconfigured
                ? 'error'
                : 'verifying';

    return {
        status,
        verified,
        configuredBy,
        misconfigured,
        projectDomain,
        config,
    };
}
