import { AppError } from './errors';
import type { getSupabaseAdmin } from './supabase';
import { applyStorePlanTierDefaults, type BillingPlanCatalogRecord } from '@letbuyy/billing-core';
interface StoreThemeLimit {
    limit: number | null;
    plan_name: string;
}
export async function resolveStoreThemeLimit(db: ReturnType<typeof getSupabaseAdmin>, storeId: string): Promise<StoreThemeLimit> {
    const { data: site, error: siteError } = await db
        .from('sites')
        .select('site_type')
        .eq('id', storeId)
        .maybeSingle();
    if (siteError || !site)
        throw new AppError('Theme allowance is temporarily unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
    const siteType = typeof site?.site_type === 'string' && site.site_type ? site.site_type : 'store';
    const { data: sub, error: subscriptionError } = await db
        .from('subscriptions')
        .select('plan')
        .eq('store_id', storeId)
        .in('status', ['active', 'past_due', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (subscriptionError)
        throw new AppError('Theme allowance is temporarily unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
    const slug = typeof sub?.plan === 'string' && sub.plan ? sub.plan : 'free';
    const { data: planRow, error: planError } = await db
        .from('plans')
        .select('*')
        .eq('site_type', siteType)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
    if (planError)
        throw new AppError('Theme allowance is temporarily unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
    const plan = applyStorePlanTierDefaults((planRow as BillingPlanCatalogRecord) ||
        ({ slug, site_type: siteType, name: slug } as unknown as BillingPlanCatalogRecord));
    const rawThemeLimit = (plan.limits as Record<string, unknown> | null | undefined)?.themes;
    const themeLimit = rawThemeLimit === null || rawThemeLimit === undefined
        ? null
        : Number(rawThemeLimit);
    return {
        limit: Number.isFinite(themeLimit) ? themeLimit : null,
        plan_name: plan.name || slug,
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
