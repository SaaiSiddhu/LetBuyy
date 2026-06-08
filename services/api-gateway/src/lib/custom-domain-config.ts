export interface CustomDomainTargetEnv {
    CUSTOM_DOMAIN_CNAME_TARGET?: string;
    NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET?: string;
}

function normalizeDnsTarget(value: string | null | undefined): string | null {
    const normalized = typeof value === 'string'
        ? value.trim().toLowerCase().replace(/\.$/, '')
        : '';
    if (!normalized || normalized.length > 255 || normalized.includes('/') || normalized.includes(':')) {
        return null;
    }
    return normalized;
}

export function getCustomDomainCnameTarget(env: CustomDomainTargetEnv): string {
    const target = normalizeDnsTarget(env.CUSTOM_DOMAIN_CNAME_TARGET || env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET);
    if (!target) {
        throw new Error('CUSTOM_DOMAIN_CNAME_TARGET or NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET is required');
    }
    return target;
}

export function dnsAnswerMatchesTarget(answer: string, target: string): boolean {
    return normalizeDnsTarget(answer) === normalizeDnsTarget(target);
}
