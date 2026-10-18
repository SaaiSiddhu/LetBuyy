import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import {
    BILLING_APPLICATION_WORKFLOWS,
    BILLING_EXECUTION_PIPELINES,
    defineRuntimeBridge,
} from '@letbuyy/shared-types';
import {
    normalizeBillingObject,
    normalizeBillingStringArray,
    resolvePlanEntitlementSnapshot,
} from '@letbuyy/billing-core';

import { AppError } from '../lib/errors';

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export interface SiteEntitlementSnapshot {
    authority: 'persisted' | 'unavailable';
    site_id: string;
    site_type: string;
    plan: string;
    features: string[];
    limits: JsonObject;
    entitlements: JsonObject;
}

// Reads retain an unavailable snapshot rather than losing access to existing
// obligations. New creation must never convert that absence into a plan grant.
export function assertResolvedCreationEntitlements(snapshot: SiteEntitlementSnapshot): void {
    if (snapshot.authority !== 'persisted') {
        throw new AppError('Plan permissions are temporarily unavailable. Try again shortly.', 503, 'ENTITLEMENT_AUTHORITY_UNAVAILABLE');
    }
}

export interface UsageRecordInput {
    siteId: string;
    meterName: string;
    amount: number;
    idempotencyKey: string;
    source?: string;
    resourceType?: string | null;
    resourceId?: string | null;
    requestId?: string | null;
    traceId?: string | null;
    metadata?: JsonObject;
}

interface RawSiteEntitlements {
    site_id?: string;
    site_type?: string;
    plan?: string;
    features?: unknown;
    limits?: unknown;
    entitlements?: unknown;
}

function isMissingSaasTableOrFunction(error: { message?: string } | null | undefined): boolean {
    return Boolean(
        error?.message?.includes('schema cache') ||
        error?.message?.includes('resolve_site_entitlements') ||
        error?.message?.includes('record_site_usage')
    );
}

export class SaasExecutionAdapter {
    static readonly applicationWorkflows = BILLING_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = BILLING_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'saas-execution.adapter',
        workflowAuthority: 'billing-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    constructor(private db: SupabaseClient) {}

    async resolveEntitlements(siteId: string, fallbackPlan = 'free'): Promise<SiteEntitlementSnapshot> {
        const fallback = resolvePlanEntitlementSnapshot(fallbackPlan);
        const { data, error } = await this.db.rpc('resolve_site_entitlements', {
            p_site_id: siteId,
        });

        const raw = data as RawSiteEntitlements | null;
        if (error || !raw || typeof raw.site_id !== 'string' || raw.site_id.toLowerCase() !== siteId.toLowerCase()
            || !raw.plan || typeof raw.plan !== 'string'
            || typeof raw.site_type !== 'string' || !Array.isArray(raw.features)
            || !isJsonObject(raw.limits) || !isJsonObject(raw.entitlements)) {
            // A missing/error/malformed RPC result is not the persisted free tier.
            // Keep metadata available to read consumers, with no creation grant.
            return {
                authority: 'unavailable',
                site_id: siteId,
                site_type: 'store',
                plan: fallback.plan,
                features: [],
                limits: {},
                entitlements: {},
            };
        }

        const defaults = resolvePlanEntitlementSnapshot(raw.plan || fallbackPlan);
        return {
            authority: 'persisted',
            site_id: raw.site_id || siteId,
            site_type: raw.site_type || 'store',
            plan: raw.plan || defaults.plan,
            features: normalizeBillingStringArray(raw.features).length > 0
                ? normalizeBillingStringArray(raw.features)
                : defaults.features,
            limits: {
                ...defaults.limits,
                ...normalizeBillingObject(raw.limits),
            },
            entitlements: {
                ...defaults.entitlements,
                ...normalizeBillingObject(raw.entitlements),
            },
        };
    }

    async recordUsage(input: UsageRecordInput): Promise<JsonObject | null> {
        const { data, error } = await this.db.rpc('record_site_usage', {
            p_site_id: input.siteId,
            p_meter_name: input.meterName,
            p_amount: input.amount,
            p_idempotency_key: input.idempotencyKey,
            p_source: input.source || 'api',
            p_resource_type: input.resourceType || null,
            p_resource_id: input.resourceId || null,
            p_request_id: input.requestId || null,
            p_trace_id: input.traceId || null,
            p_metadata: input.metadata || {},
        });

        if (error) {
            if (isMissingSaasTableOrFunction(error)) {
                return null;
            }

            throw new Error(`Usage metering failed: ${error.message}`);
        }

        return normalizeBillingObject(data);
    }
}
