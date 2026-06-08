export type DomainRiskTier = 'low' | 'medium' | 'high';
export type DomainScreeningAction = 'allow' | 'review' | 'reject';

export interface AbuseReputationEnv {
    ABUSE_REPUTATION_API_URL?: string;
    ABUSE_REPUTATION_API_KEY?: string;
}

export interface DomainScreeningResult {
    tier: DomainRiskTier;
    action: DomainScreeningAction;
    reasons: string[];
    providerConfigured: boolean;
    providerEvidence: Record<string, unknown> | null;
}

type FetchLike = typeof fetch;

const PROTECTED_BRANDS = [
    'aadhaar',
    'amazon',
    'axis',
    'flipkart',
    'googlepay',
    'gov',
    'hdfc',
    'icici',
    'irctc',
    'letbuyy',
    'meesho',
    'myntra',
    'paytm',
    'phonepe',
    'sbi',
    'upi',
] as const;

const STATIC_BLOCKLIST_FRAGMENTS = [
    'account-verify',
    'bank-kyc',
    'free-gift',
    'login-verify',
    'payment-verify',
    'phishing',
    'refund-claim',
    'support-kyc',
] as const;

const HOMOGLYPHS: Record<string, string> = {
    '0': 'o',
    '1': 'l',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '7': 't',
    '@': 'a',
    '$': 's',
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeDomainForScreening(domain: string): string {
    return domain
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w.-]+/g, '')
        .split('.')
        .slice(0, -1)
        .join('');
}

function skeleton(value: string): string {
    return value
        .toLowerCase()
        .split('')
        .map((char) => HOMOGLYPHS[char] || char)
        .join('')
        .replace(/[^a-z0-9]+/g, '');
}

function levenshtein(left: string, right: string): number {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        let diagonal = leftIndex - 1;
        previous[0] = leftIndex;
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const current = previous[rightIndex];
            const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
            previous[rightIndex] = Math.min(
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + 1,
                diagonal + cost,
            );
            diagonal = current;
        }
    }
    return previous[right.length] || 0;
}

function maxTier(left: DomainRiskTier, right: DomainRiskTier): DomainRiskTier {
    const order: Record<DomainRiskTier, number> = { low: 0, medium: 1, high: 2 };
    return order[right] > order[left] ? right : left;
}

async function reputationLookup(
    env: AbuseReputationEnv,
    domain: string,
    fetchImpl: FetchLike,
): Promise<{ tier: DomainRiskTier; evidence: Record<string, unknown> | null }> {
    const url = env.ABUSE_REPUTATION_API_URL?.trim();
    const key = env.ABUSE_REPUTATION_API_KEY?.trim();
    if (!url || !key) return { tier: 'low', evidence: null };

    const endpoint = new URL(url);
    endpoint.searchParams.set('domain', domain);
    const response = await fetchImpl(endpoint.toString(), {
        headers: {
            Authorization: `Bearer ${key}`,
            Accept: 'application/json',
        },
    });
    if (!response.ok) return { tier: 'medium', evidence: { status: response.status, unavailable: true } };

    const body = await response.json().catch(() => null) as unknown;
    const evidence = isRecord(body) ? body : {};
    const risk = typeof evidence.risk === 'string' ? evidence.risk.toLowerCase() : '';
    if (risk === 'high' || evidence.blocked === true) return { tier: 'high', evidence };
    if (risk === 'medium' || evidence.suspicious === true) return { tier: 'medium', evidence };
    return { tier: 'low', evidence };
}

export async function screenCustomDomainClaim(
    env: AbuseReputationEnv,
    domain: string,
    fetchImpl: FetchLike = fetch,
): Promise<DomainScreeningResult> {
    const normalized = normalizeDomainForScreening(domain);
    const domainSkeleton = skeleton(normalized);
    const reasons: string[] = [];
    let tier: DomainRiskTier = 'low';

    for (const fragment of STATIC_BLOCKLIST_FRAGMENTS) {
        if (domainSkeleton.includes(fragment.replace(/-/g, ''))) {
            tier = maxTier(tier, 'high');
            reasons.push(`static-blocklist:${fragment}`);
        }
    }

    for (const brand of PROTECTED_BRANDS) {
        const brandSkeleton = skeleton(brand);
        if (domainSkeleton === brandSkeleton || domainSkeleton.includes(`${brandSkeleton}login`)) {
            tier = maxTier(tier, 'high');
            reasons.push(`protected-brand-exact:${brand}`);
            continue;
        }
        const distance = levenshtein(domainSkeleton.slice(0, Math.max(brandSkeleton.length, 4)), brandSkeleton);
        if (distance <= 1 && brandSkeleton.length >= 4) {
            tier = maxTier(tier, 'high');
            reasons.push(`protected-brand-lookalike:${brand}`);
        } else if (distance <= 2 && brandSkeleton.length >= 5) {
            tier = maxTier(tier, 'medium');
            reasons.push(`protected-brand-near-match:${brand}`);
        }
    }

    const providerConfigured = Boolean(env.ABUSE_REPUTATION_API_URL?.trim() && env.ABUSE_REPUTATION_API_KEY?.trim());
    const reputation = await reputationLookup(env, domain, fetchImpl).catch(() => ({
        tier: 'medium' as DomainRiskTier,
        evidence: { unavailable: true },
    }));
    tier = maxTier(tier, reputation.tier);
    if (reputation.tier !== 'low') reasons.push(`reputation:${reputation.tier}`);

    const action: DomainScreeningAction = tier === 'high'
        ? 'reject'
        : tier === 'medium'
            ? 'review'
            : 'allow';

    return {
        tier,
        action,
        reasons,
        providerConfigured,
        providerEvidence: reputation.evidence,
    };
}
