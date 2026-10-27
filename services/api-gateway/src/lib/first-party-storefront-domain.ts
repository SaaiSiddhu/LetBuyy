import { normalizeStoreRootDomain, resolveStorefrontHost, validateSubdomainFormat } from '@letbuyy/tenant-core';
import type { Store, StorefrontDomainProvisioning } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { readVercelDomainStatus } from './vercel-domains';
import { AppError } from './errors';

type PersistedStoreHost = Pick<Store, 'subdomain'> & { store_name?: string | null };
/** Call only after resolving the persisted store through the current owner's query. */
export async function provisionFirstPartyStorefrontDomain(
    env: Env, store: PersistedStoreHost, fetchImpl: typeof fetch = fetch,
): Promise<StorefrontDomainProvisioning> {
    const modes = [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV, env.DEPLOYMENT_ENV];
    const hosted = modes.some(mode => mode === 'production' || mode === 'staging');
    const local = !hosted && modes.some(mode => mode === 'local' || mode === 'test' || mode === 'development');
    const handle = store.subdomain || store.store_name || '';
    const root = normalizeStoreRootDomain(env.NEXT_PUBLIC_STORE_ROOT_DOMAIN);
    const hostname = `${handle}.${root}`;
    const resolved = resolveStorefrontHost(hostname, root);
    if (!validateSubdomainFormat(handle).valid || resolved.kind !== 'subdomain' || resolved.subdomain !== handle) {
        return { hostname: null, status: 'pending', reason: 'invalid_host' };
    }
    if (local) return { hostname, status: 'local', reason: 'local_runtime' };
    if (!env.NEXT_PUBLIC_STORE_ROOT_DOMAIN || !root.includes('.') || root.includes(':') || root.includes('/')) {
        return { hostname: null, status: 'pending', reason: 'invalid_host' };
    }
    if (!env.VERCEL_API_TOKEN || !env.VERCEL_STOREFRONT_PROJECT_ID) {
        return { hostname, status: 'pending', reason: 'provider_not_configured' };
    }
    try {
        // First-party stores share the already verified wildcard. Creating or
        // publishing a store must never register an individual provider domain.
        const wildcard = `*.${root}`;
        const result = await readVercelDomainStatus(env, wildcard, fetchImpl, hostname);
        const productionWildcard = result.projectDomain?.name === wildcard
            && result.projectDomain?.projectId === env.VERCEL_STOREFRONT_PROJECT_ID
            && result.projectDomain?.gitBranch == null
            && result.projectDomain?.customEnvironmentId == null
            && result.projectDomain?.redirect == null
            && modes.includes('production') && !modes.includes('staging');
        return result.status === 'active' && productionWildcard
            ? { hostname, status: 'ready' }
            : { hostname, status: 'pending', reason: 'provider_pending' };
    } catch {
        return { hostname, status: 'pending', reason: 'provider_unavailable' };
    }
}

/** Existing publication/receipt replay survives a temporary provider outage. */
export async function assertReadyFirstPartyStorefrontDomain(
    env: Env, store: PersistedStoreHost & Partial<Pick<Store, 'published' | 'status'>>,
): Promise<void> {
    if (store.published === true && store.status === 'published') return;
    const domain = await provisionFirstPartyStorefrontDomain(env, store);
    if (domain.status === 'pending') throw new AppError(
        'Your store is saved. Its address is still being prepared; retry publishing shortly.', 503, 'STOREFRONT_DOMAIN_PENDING',
    );
}
