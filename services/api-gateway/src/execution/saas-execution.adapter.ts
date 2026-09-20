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

type JsonObject = Record<string, unknown>;

export interface SiteEntitlementSnapshot {
    site_id: string;
    site_type: string;
    plan: string;
    features: string[];
    limits: JsonObject;
    entitlements: JsonObject;
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

        // Entitlements are enrichment on top of an already-verified site
        // owner/caller, never the authorization decision itself -- any RPC
        // failure (missing function, transient error, unexpected schema
        // variance) must degrade to the plan's default snapshot rather than
        // fail the whole request with an opaque 500.
        if (error) {
            if (!isMissingSaasTableOrFunction(error)) {
                console.error(JSON.stringify({ level: 'warn', service: 'letbuyy-api', context: 'resolveEntitlements', error: error.message }));
            }
            return {
                site_id: siteId,
                site_type: 'store',
                plan: fallback.plan,
                features: fallback.features,
                limits: fallback.limits,
                entitlements: fallback.entitlements,
            };
        }

        const raw = (data || {}) as RawSiteEntitlements;
        const defaults = resolvePlanEntitlementSnapshot(raw.plan || fallbackPlan);
        return {
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
