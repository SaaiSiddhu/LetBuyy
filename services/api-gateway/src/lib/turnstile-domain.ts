import { DomainCustomerVerificationSchema, type DomainCustomerVerification } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { TurnstileDomainRequestSchema, turnstileDomainManagement } from './turnstile-domain-config';

type DomainEnv = Pick<Env, 'TURNSTILE_DOMAIN_MANAGEMENT' | 'RUNTIME_COORDINATOR'>;
/** An anti-bot configuration observation; it grants no store, session or identity authority. */
export async function customDomainCustomerVerification(
    env: DomainEnv, siteId: string, hostname: string,
    verified?: { txt_verified: boolean; cname_verified: boolean; ssl_active: boolean },
): Promise<DomainCustomerVerification> {
    const input = TurnstileDomainRequestSchema.safeParse({ site_id: siteId, hostname });
    if (!input.success) return { status: 'configuration_required' };
    if (verified && !(verified.txt_verified && verified.cname_verified && verified.ssl_active)) return { status: 'pending' };
    const config = turnstileDomainManagement(env);
    if (!config) return { status: 'configuration_required' };
    if (!env.RUNTIME_COORDINATOR) return { status: 'unavailable' };
    try {
        const name = `turnstile-hostnames:${config.accountId}:${config.siteKey}:${config.configurationId}`;
        const stub = env.RUNTIME_COORDINATOR.get(env.RUNTIME_COORDINATOR.idFromName(name));
        const response = await stub.fetch(`https://runtime.internal/turnstile-hostnames/${verified ? 'ensure' : 'status'}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input.data),
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return { status: 'unavailable' };
        const parsed = DomainCustomerVerificationSchema.safeParse(await response.json());
        return parsed.success ? parsed.data : { status: 'unavailable' };
    } catch { return { status: 'unavailable' }; }
}
