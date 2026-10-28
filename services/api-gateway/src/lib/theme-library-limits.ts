import { ThemeLibraryAllowanceSchema, type ThemeLibraryAllowance } from '@letbuyy/theme-engine';
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
async function readThemeLibraryUsage(db: ReturnType<typeof getSupabaseAdmin>, storeId: string, actorId: string, boundSiteId?: string) {
    const { data, error } = await db.rpc('read_owned_theme_library_allowance_v1', {
        p_actor: actorId, p_site: storeId, p_bound_site: boundSiteId || null,
    });
    const raw = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
    const parsed = ThemeLibraryAllowanceSchema.pick({ included_themes: true, custom_used: true }).safeParse(raw);
    if (error || !parsed.success) throw new AppError('Theme allowance is temporarily unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
    return parsed.data;
}
export async function readStoreThemeAllowance(db: ReturnType<typeof getSupabaseAdmin>, storeId: string, actorId: string, boundSiteId?: string): Promise<ThemeLibraryAllowance> {
    const { limit, plan_name } = await resolveStoreThemeLimit(db, storeId);
    const usage = await readThemeLibraryUsage(db, storeId, actorId, boundSiteId);
    return { ...usage, custom_limit: limit, plan_name };
}
export async function countInstalledSiteThemes(db: ReturnType<typeof getSupabaseAdmin>, storeId: string, actorId: string): Promise<number> {
    return (await readThemeLibraryUsage(db, storeId, actorId)).custom_used;
}
