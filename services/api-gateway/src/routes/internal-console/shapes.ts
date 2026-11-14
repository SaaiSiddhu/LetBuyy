// Operator-console row shapes and value coercions, lifted out of routes/internal-console.ts.
//
// Placed in this route family's own directory, beside compliance.ts and money-reconciliation.ts,
// following F-ROUTELEN-3's rule: use the family's convention where one exists, and lib/ only where
// none does (as for orders and customers).
//
// The console reads rollups, cohorts and funnels that predate any shared type, so the row interfaces
// describe what those queries actually return; the coercions turn unknown JSON into the numbers,
// strings and records the handlers expect. None of it touches the request context, so it is pure and
// testable without a route around it.
//
// A byte-for-byte transplant: every declaration below is the text that was running in
// internal-console.ts, in the same order, with only `export` added. The Zod request schemas stayed
// behind with the routes that validate against them, and so did readBearerToken/parseListQuery,
// which read the context rather than being pure.

export interface RevenueSubscriptionRow {
    amount_paid?: number | string | null;
}

export type DbRecord = Record<string, unknown>;

export interface MerchantSiteRow extends DbRecord {
    id: string;
    user_id?: string | null;
    custom_user_id?: string | null;
    name?: string | null;
    store_name?: string | null;
    site_type?: string | null;
    subdomain?: string | null;
    custom_domain?: string | null;
    custom_domain_status?: string | null;
    access_mode?: string | null;
    status?: string | null;
    published?: boolean | null;
    published_at?: string | null;
    views_count?: number | null;
    product_count?: number | null;
    order_count?: number | null;
    current_theme_release_id?: string | null;
    currency?: string | null;
    locale?: string | null;
    trial_status?: string | null;
    trial_ends_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface MerchantOwnerRow extends DbRecord {
    id: string;
    email?: string | null;
    full_name?: string | null;
    email_verified?: boolean | null;
    auth_provider?: string | null;
    created_at?: string | null;
}

export interface MrrRollupRow extends DbRecord {
    id: string;
    period_date?: string | null;
    mrr_paise?: number | string | null;
    arr_paise?: number | string | null;
    new_mrr_paise?: number | string | null;
    expansion_mrr_paise?: number | string | null;
    contraction_mrr_paise?: number | string | null;
    churned_mrr_paise?: number | string | null;
    active_subscriptions?: number | string | null;
    logo_churn_count?: number | string | null;
    subscription_revenue_paise?: number | string | null;
    app_revenue_paise?: number | string | null;
    theme_revenue_paise?: number | string | null;
    partner_payout_liability_paise?: number | string | null;
    definition_version?: string | null;
    computed_at?: string | null;
    metadata?: DbRecord | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface MetricRollupRow extends DbRecord {
    id: string;
    metric_key?: string | null;
    dimension?: DbRecord | null;
    period_date?: string | null;
    value?: number | string | null;
    unit?: string | null;
    definition_version?: string | null;
    computed_at?: string | null;
    metadata?: DbRecord | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface CohortSnapshotRow extends DbRecord {
    id: string;
    cohort_month?: string | null;
    period_index?: number | string | null;
    metric_key?: string | null;
    cohort_size?: number | string | null;
    retained_count?: number | string | null;
    conversion_count?: number | string | null;
    definition_version?: string | null;
    computed_at?: string | null;
    metadata?: DbRecord | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface FunnelStepRow extends DbRecord {
    id: string;
    period_date?: string | null;
    step_key?: string | null;
    step_index?: number | string | null;
    count?: number | string | null;
    conversion_rate_bps?: number | string | null;
    definition_version?: string | null;
    computed_at?: string | null;
    metadata?: DbRecord | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export function dayBounds(date: string) {
    const start = new Date(`${date}T00:00:00.000+05:30`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
        start: start.toISOString(),
        end: end.toISOString(),
    };
}

export function daysAgo(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function numberValue(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function intValue(value: unknown): number {
    return Math.round(numberValue(value));
}

export function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function recordValue(value: unknown): DbRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as DbRecord : {};
}

export function periodDateDaysAgo(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString().slice(0, 10);
}
