import { AppError } from './errors';
import type { getSupabaseAdmin } from './supabase';
import { getStoreBillingTierDefinition } from '@letbuyy/billing-core';
import { SaasExecutionAdapter } from '../execution/saas-execution.adapter';
interface StoreThemeLimit {
    limit: number | null;
    plan_name: string;
}
export async function resolveStoreThemeLimit(db: ReturnType<typeof getSupabaseAdmin>, storeId: string): Promise<StoreThemeLimit> {
    // Match every other creation grant: persisted billing authority, including
    // active trial plans and current per-site overrides. A second subscription
    // lookup cannot silently ignore the canonical entitlement snapshot.
    const snapshot = await new SaasExecutionAdapter(db).resolveEntitlements(storeId);
    const themeLimit = snapshot.limits.themes;
    if (snapshot.authority !== 'persisted' || themeLimit !== null
        && (typeof themeLimit !== 'number' || !Number.isSafeInteger(themeLimit) || themeLimit < 0))
        throw new AppError('Theme allowance is temporarily unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
    return {
        limit: themeLimit as number | null,
        plan_name: getStoreBillingTierDefinition(snapshot.plan)?.name || snapshot.plan,
    };
}
export async function countInstalledSiteThemes(db: ReturnType<typeof getSupabaseAdmin>, storeId: string): Promise<number> {
    const { count, error } = await db
        .from('theme_instances')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .not('instance_status', 'in', '(archived,deleted)')
        .is('deleted_at', null);
    if (error) throw new AppError('Theme allowance is temporarily unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
    return count || 0;
}
