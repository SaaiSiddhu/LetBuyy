import type { CustomDomainHealth, CustomDomainStatus } from '@letbuyy/shared-types';
import { dnsAnswerMatchesTarget, getCustomDomainCnameTarget, type CustomDomainTargetEnv } from './custom-domain-config';
import { resolveDoh, resolveMxOrNsSnapshot } from './dns';
import {
    readVercelDomainStatus,
    VercelDomainConfigError,
    type VercelDomainEnv,
    type VercelDomainStatusResult,
} from './vercel-domains';

type DomainHealthEnv = CustomDomainTargetEnv & VercelDomainEnv;
type DomainHealthRecord = CustomDomainHealth['records'][number];

interface CustomDomainHealthInput {
    siteId: string;
    domain: string;
    status?: string | null;
    verificationToken?: string | null;
    checkedAt?: Date;
}

const DOMAIN_STATUSES = new Set<CustomDomainStatus>([
    'none',
    'pending',
    'review',
    'verifying',
    'active',
    'error',
]);

function normalizeDomainStatus(value: string | null | undefined): CustomDomainStatus {
    return DOMAIN_STATUSES.has(value as CustomDomainStatus) ? value as CustomDomainStatus : 'pending';
}

function apexDomain(domain: string): string {
    const labels = domain.split('.').filter(Boolean);
    return labels.length >= 2 ? labels.slice(-2).join('.') : domain;
}

function sanitizeDate(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function collectDateCandidates(value: unknown, depth = 0): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 3) return [];
    const record = value as Record<string, unknown>;
    const directKeys = [
        'expiresAt',
        'expiration',
        'expirationDate',
        'sslExpiresAt',
        'certificateExpiresAt',
        'certExpiresAt',
        'renewalDate',
        'renewAt',
    ];
    const direct = directKeys
        .map((key) => sanitizeDate(record[key]))
        .filter((date): date is string => Boolean(date));
    if (direct.length > 0) return direct;

    return Object.values(record).flatMap((nested) => collectDateCandidates(nested, depth + 1));
}

function renewalDateFrom(vercel: VercelDomainStatusResult | null): string | null {
    if (!vercel) return null;
    return [
        ...collectDateCandidates(vercel.projectDomain),
        ...collectDateCandidates(vercel.config),
    ][0] ?? null;
}

function deriveStatus(input: {
    current: CustomDomainStatus;
    txtVerified: boolean;
    cnameVerified: boolean;
    sslActive: boolean;
    misconfigured: boolean;
    providerUnavailable: boolean;
}): CustomDomainStatus {
    if (input.providerUnavailable) return input.current;
    if (input.current === 'review') return 'review';
    if (input.sslActive) return 'active';
    if (input.misconfigured) return 'error';
    if (input.txtVerified || input.cnameVerified || input.current === 'verifying') return 'verifying';
    return input.current === 'none' ? 'pending' : input.current;
}

function recordStatus(verified: boolean, actual: string[]): DomainHealthRecord['status'] {
    if (verified) return 'verified';
    return actual.length > 0 ? 'mismatch' : 'pending';
}

function vercelPayload(vercel: VercelDomainStatusResult | null): Record<string, unknown> {
    if (!vercel) {
        return {
            status: 'unavailable',
            verified: false,
            configured_by: null,
            misconfigured: false,
        };
    }

    return {
        status: vercel.status,
        verified: vercel.verified,
        configured_by: vercel.configuredBy,
        misconfigured: vercel.misconfigured,
        project_domain: vercel.projectDomain,
        config: vercel.config,
    };
}

export async function readCustomDomainHealth(
    env: DomainHealthEnv,
    input: CustomDomainHealthInput,
): Promise<CustomDomainHealth> {
    const checkedAt = input.checkedAt ?? new Date();
    const currentStatus = normalizeDomainStatus(input.status);
    const domain = input.domain.trim().toLowerCase();
    const token = input.verificationToken?.trim() || null;
    const cnameTarget = getCustomDomainCnameTarget(env);
    const apex = apexDomain(domain);

    const [txtAnswers, cnameAnswers, apexSnapshot] = await Promise.all([
        token ? resolveDoh(`_letbuyy-challenge.${domain}`, 'TXT').catch(() => []) : Promise.resolve([]),
        resolveDoh(domain, 'CNAME').catch(() => []),
        resolveMxOrNsSnapshot(apex).catch(() => ({ mx: [], ns: [] })),
    ]);

    let providerUnavailable = false;
    let vercel: VercelDomainStatusResult | null = null;
    try {
        vercel = await readVercelDomainStatus(env, domain);
    } catch (error) {
        if (error instanceof VercelDomainConfigError) {
            providerUnavailable = true;
        } else {
            throw error;
        }
    }

    const txtVerified = Boolean(token && txtAnswers.filter((answer) => answer.includes(token)).length >= 2);
    const cnameVerified = cnameAnswers.some((answer) => dnsAnswerMatchesTarget(answer, cnameTarget));
    const sslActive = Boolean(vercel && vercel.status === 'active' && vercel.verified && !vercel.misconfigured);
    const renewalDate = renewalDateFrom(vercel);
    const renewalStatus: CustomDomainHealth['renewal_status'] = vercel?.misconfigured
        ? 'action_required'
        : sslActive
            ? 'managed'
            : 'unknown';
    const status = deriveStatus({
        current: currentStatus,
        txtVerified,
        cnameVerified,
        sslActive,
        misconfigured: Boolean(vercel?.misconfigured),
        providerUnavailable,
    });

    const records: DomainHealthRecord[] = [
        {
            type: 'TXT',
            host: `_letbuyy-challenge.${domain}`,
            value: token ?? 'Generated by gateway after Save domain',
            status: token ? recordStatus(txtVerified, txtAnswers) : 'pending',
            actual: txtAnswers,
            message: txtVerified ? 'Ownership challenge is visible.' : 'Add the ownership TXT record at your DNS provider.',
        },
        {
            type: 'CNAME',
            host: domain,
            value: cnameTarget,
            status: recordStatus(cnameVerified, cnameAnswers),
            actual: cnameAnswers,
            message: cnameVerified ? 'Storefront traffic points to LetBuyy.' : 'Point this hostname to the LetBuyy connect target.',
        },
    ];

    return {
        site_id: input.siteId,
        domain,
        status,
        txt_verified: txtVerified,
        cname_verified: cnameVerified,
        ssl_active: sslActive,
        provider_status: providerUnavailable ? 'unavailable' : 'configured',
        configured_by: vercel?.configuredBy ?? null,
        misconfigured: Boolean(vercel?.misconfigured),
        apex_mx_warning: apexSnapshot.mx.length > 0,
        renewal_status: renewalStatus,
        renewal_date: renewalDate,
        checked_at: checkedAt.toISOString(),
        records,
        vercel: vercelPayload(vercel),
    };
}
