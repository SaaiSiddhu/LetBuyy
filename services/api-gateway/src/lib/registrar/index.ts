export type RegistrarProviderName = 'resellerclub' | 'opensrs' | 'sandbox';

export interface RegistrarEnv {
    ENVIRONMENT?: string;
    APP_ENV?: string;
    REGISTRAR_PROVIDER?: string;
    REGISTRAR_API_URL?: string;
    REGISTRAR_RESELLER_ID?: string;
    REGISTRAR_API_KEY?: string;
    REGISTRAR_USERNAME?: string;
    REGISTRAR_PASSWORD?: string;
    REGISTRAR_DEFAULT_CURRENCY?: string;
    REGISTRAR_SANDBOX_ENABLED?: string;
}

export interface DomainAvailabilityQuote {
    domain: string;
    available: boolean;
    currency: string;
    amountMinor: number;
    provider: RegistrarProviderName;
    premium: boolean;
    reasons: string[];
}

export interface DomainPurchaseInput {
    domain: string;
    years: number;
    owner: {
        name: string;
        email: string;
        phone?: string | null;
    };
    paymentReference: string;
    idempotencyKey: string;
}

export interface DomainPurchaseResult {
    provider: RegistrarProviderName;
    registrarOrderId: string;
    domain: string;
    expiresAt: string | null;
    nameservers: string[];
    raw: Record<string, unknown>;
}

export interface DomainDnsConfigurationResult {
    provider: RegistrarProviderName;
    domain: string;
    configured: boolean;
    raw: Record<string, unknown>;
}

export interface DomainRegistrarProvider {
    readonly name: RegistrarProviderName;
    searchDomain(domain: string): Promise<DomainAvailabilityQuote>;
    purchaseDomain(input: DomainPurchaseInput): Promise<DomainPurchaseResult>;
    configureDns(domain: string, target: string): Promise<DomainDnsConfigurationResult>;
}

type FetchLike = typeof fetch;

class RegistrarConfigError extends Error {
    readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = 'RegistrarConfigError';
        this.code = code;
    }
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isProduction(env: RegistrarEnv): boolean {
    return [env.ENVIRONMENT, env.APP_ENV].some((value) => value?.toLowerCase() === 'production');
}

function defaultCurrency(env: RegistrarEnv): string {
    return env.REGISTRAR_DEFAULT_CURRENCY?.trim().toUpperCase() || 'INR';
}

function requireApiUrl(env: RegistrarEnv): string {
    const url = env.REGISTRAR_API_URL?.trim();
    if (!url) throw new RegistrarConfigError('REGISTRAR_API_URL is required for live registrar calls', 'REGISTRAR_API_URL_REQUIRED');
    return url.replace(/\/+$/, '');
}

function requireResellerClubCredentials(env: RegistrarEnv): { baseUrl: string; resellerId: string; apiKey: string } {
    const baseUrl = requireApiUrl(env);
    const resellerId = env.REGISTRAR_RESELLER_ID?.trim();
    const apiKey = env.REGISTRAR_API_KEY?.trim();
    if (!resellerId) throw new RegistrarConfigError('REGISTRAR_RESELLER_ID is required for ResellerClub', 'REGISTRAR_RESELLER_ID_REQUIRED');
    if (!apiKey) throw new RegistrarConfigError('REGISTRAR_API_KEY is required for ResellerClub', 'REGISTRAR_API_KEY_REQUIRED');
    return { baseUrl, resellerId, apiKey };
}

function requireOpenSrsCredentials(env: RegistrarEnv): { baseUrl: string; username: string; password: string } {
    const baseUrl = requireApiUrl(env);
    const username = env.REGISTRAR_USERNAME?.trim();
    const password = env.REGISTRAR_PASSWORD?.trim();
    if (!username) throw new RegistrarConfigError('REGISTRAR_USERNAME is required for OpenSRS', 'REGISTRAR_USERNAME_REQUIRED');
    if (!password) throw new RegistrarConfigError('REGISTRAR_PASSWORD is required for OpenSRS', 'REGISTRAR_PASSWORD_REQUIRED');
    return { baseUrl, username, password };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
    const body = await response.json().catch(() => null) as unknown;
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

function tldOf(domain: string): string {
    return domain.split('.').pop()?.toLowerCase() || '';
}

function priceForTld(domain: string): number {
    const tld = tldOf(domain);
    if (tld === 'in') return 79900;
    if (tld === 'store') return 99900;
    return 119900;
}

export class ResellerClubRegistrarProvider implements DomainRegistrarProvider {
    readonly name = 'resellerclub' as const;
    private readonly env: RegistrarEnv;
    private readonly fetchImpl: FetchLike;

    constructor(env: RegistrarEnv, fetchImpl: FetchLike = fetch) {
        this.env = env;
        this.fetchImpl = fetchImpl;
    }

    async searchDomain(domain: string): Promise<DomainAvailabilityQuote> {
        const { baseUrl, resellerId, apiKey } = requireResellerClubCredentials(this.env);
        const url = new URL(`${baseUrl}/api/domains/available.json`);
        url.searchParams.set('auth-userid', resellerId);
        url.searchParams.set('api-key', apiKey);
        url.searchParams.set('domain-name', domain);
        const response = await this.fetchImpl(url.toString(), { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new RegistrarConfigError('ResellerClub availability lookup failed', 'REGISTRAR_SEARCH_FAILED');
        const body = await readJson(response);
        const available = body.status === 'available' || body.available === true;
        return {
            domain,
            available,
            currency: defaultCurrency(this.env),
            amountMinor: priceForTld(domain),
            provider: this.name,
            premium: body.premium === true,
            reasons: available ? [] : ['unavailable'],
        };
    }

    async purchaseDomain(input: DomainPurchaseInput): Promise<DomainPurchaseResult> {
        const { baseUrl, resellerId, apiKey } = requireResellerClubCredentials(this.env);
        const response = await this.fetchImpl(`${baseUrl}/api/domains/register.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                'auth-userid': resellerId,
                'api-key': apiKey,
                'domain-name': input.domain,
                years: input.years,
                customer: input.owner,
                invoice: input.paymentReference,
            }),
        });
        if (!response.ok) throw new RegistrarConfigError('ResellerClub registration failed', 'REGISTRAR_PURCHASE_FAILED');
        const body = await readJson(response);
        return {
            provider: this.name,
            registrarOrderId: stringValue(body.orderid) || stringValue(body.order_id) || input.idempotencyKey,
            domain: input.domain,
            expiresAt: stringValue(body.expires_at),
            nameservers: [],
            raw: body,
        };
    }

    async configureDns(domain: string, target: string): Promise<DomainDnsConfigurationResult> {
        const { baseUrl, resellerId, apiKey } = requireResellerClubCredentials(this.env);
        const response = await this.fetchImpl(`${baseUrl}/api/dns/manage/add-cname-record.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
                'auth-userid': resellerId,
                'api-key': apiKey,
                domain,
                host: 'www',
                value: target,
            }),
        });
        if (!response.ok) throw new RegistrarConfigError('ResellerClub DNS configuration failed', 'REGISTRAR_DNS_FAILED');
        return { provider: this.name, domain, configured: true, raw: await readJson(response) };
    }
}

export class OpenSrsRegistrarProvider implements DomainRegistrarProvider {
    readonly name = 'opensrs' as const;
    private readonly env: RegistrarEnv;
    private readonly fetchImpl: FetchLike;

    constructor(env: RegistrarEnv, fetchImpl: FetchLike = fetch) {
        this.env = env;
        this.fetchImpl = fetchImpl;
    }

    async searchDomain(domain: string): Promise<DomainAvailabilityQuote> {
        const { baseUrl, username, password } = requireOpenSrsCredentials(this.env);
        const response = await this.fetchImpl(`${baseUrl}/domains/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ username, password, domain }),
        });
        if (!response.ok) throw new RegistrarConfigError('OpenSRS availability lookup failed', 'REGISTRAR_SEARCH_FAILED');
        const body = await readJson(response);
        const available = body.available === true || body.status === 'available';
        return {
            domain,
            available,
            currency: defaultCurrency(this.env),
            amountMinor: priceForTld(domain),
            provider: this.name,
            premium: body.premium === true,
            reasons: available ? [] : ['unavailable'],
        };
    }

    async purchaseDomain(input: DomainPurchaseInput): Promise<DomainPurchaseResult> {
        const { baseUrl, username, password } = requireOpenSrsCredentials(this.env);
        const response = await this.fetchImpl(`${baseUrl}/domains/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ username, password, ...input }),
        });
        if (!response.ok) throw new RegistrarConfigError('OpenSRS registration failed', 'REGISTRAR_PURCHASE_FAILED');
        const body = await readJson(response);
        return {
            provider: this.name,
            registrarOrderId: stringValue(body.orderId) || stringValue(body.order_id) || input.idempotencyKey,
            domain: input.domain,
            expiresAt: stringValue(body.expiresAt),
            nameservers: [],
            raw: body,
        };
    }

    async configureDns(domain: string, target: string): Promise<DomainDnsConfigurationResult> {
        const { baseUrl, username, password } = requireOpenSrsCredentials(this.env);
        const response = await this.fetchImpl(`${baseUrl}/dns/cname`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ username, password, domain, host: 'www', target }),
        });
        if (!response.ok) throw new RegistrarConfigError('OpenSRS DNS configuration failed', 'REGISTRAR_DNS_FAILED');
        return { provider: this.name, domain, configured: true, raw: await readJson(response) };
    }
}

export class SandboxRegistrarProvider implements DomainRegistrarProvider {
    readonly name = 'sandbox' as const;
    private readonly env: RegistrarEnv;

    constructor(env: RegistrarEnv = {}) {
        this.env = env;
    }

    async searchDomain(domain: string): Promise<DomainAvailabilityQuote> {
        return {
            domain,
            available: !domain.includes('taken'),
            currency: defaultCurrency(this.env),
            amountMinor: priceForTld(domain),
            provider: this.name,
            premium: domain.includes('premium'),
            reasons: domain.includes('taken') ? ['unavailable'] : [],
        };
    }

    async purchaseDomain(input: DomainPurchaseInput): Promise<DomainPurchaseResult> {
        return {
            provider: this.name,
            registrarOrderId: `sandbox-${input.idempotencyKey}`,
            domain: input.domain,
            expiresAt: new Date(Date.now() + input.years * 365 * 24 * 60 * 60 * 1000).toISOString(),
            nameservers: [],
            raw: { provider: this.name, simulated: true },
        };
    }

    async configureDns(domain: string, target: string): Promise<DomainDnsConfigurationResult> {
        return { provider: this.name, domain, configured: true, raw: { target } };
    }
}

export function createDomainRegistrarProvider(env: RegistrarEnv, fetchImpl: FetchLike = fetch): DomainRegistrarProvider {
    const provider = (env.REGISTRAR_PROVIDER?.trim().toLowerCase() || 'resellerclub') as RegistrarProviderName;
    if (provider === 'sandbox') {
        if (isProduction(env) || env.REGISTRAR_SANDBOX_ENABLED !== 'true') {
            throw new RegistrarConfigError('Sandbox registrar is only allowed outside production with REGISTRAR_SANDBOX_ENABLED=true', 'REGISTRAR_SANDBOX_FORBIDDEN');
        }
        return new SandboxRegistrarProvider(env);
    }
    if (provider === 'opensrs') {
        requireOpenSrsCredentials(env);
        return new OpenSrsRegistrarProvider(env, fetchImpl);
    }
    if (provider === 'resellerclub') {
        requireResellerClubCredentials(env);
        return new ResellerClubRegistrarProvider(env, fetchImpl);
    }
    throw new RegistrarConfigError(`Unsupported REGISTRAR_PROVIDER: ${provider}`, 'REGISTRAR_PROVIDER_UNSUPPORTED');
}
