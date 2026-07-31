import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { resolveTenantContextForOwnedSite } from '../lib/tenant-context';

// AUTHENTICATED merchant founding endpoints. Mounted AFTER auth middleware.
// A merchant reads only their OWN founding status (ownership verified via
// resolveTenantContextForOwnedSite, mirroring the billing routes).

const router = new Hono<{ Bindings: Env }>();

// GET /founding/me?store_id= — the caller's founding number, source, and locked prices.
router.get('/me', async (c) => {
    const storeId = c.req.query('store_id') || '';
    if (!storeId) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id is required' } }, 400);
    }
    const db = getSupabaseAdmin(c);
    const tenant = await resolveTenantContextForOwnedSite(c, storeId);

    const { data: site } = await db
        .from('sites')
        .select('is_founding_merchant, founding_number, founding_allocated_at, price_lock_enabled, locked_launch_price, locked_growth_price, allocation_source')
        .eq('id', tenant.siteId)
        .maybeSingle();

    let allocation: Record<string, unknown> | null = null;
    if (site?.is_founding_merchant) {
        const { data } = await db
            .from('founding_merchant_allocations')
            .select('founding_number, allocation_source, plan_slug, locked_launch_price, locked_growth_price, locked_monthly_price, benefits, allocated_at')
            .eq('site_id', tenant.siteId)
            .is('released_at', null)
            .maybeSingle();
        allocation = (data as Record<string, unknown>) ?? null;
    }

    return c.json(success({
        is_founding_merchant: Boolean(site?.is_founding_merchant),
        founding_number: site?.founding_number ?? null,
        allocation_source: site?.allocation_source ?? null,
        price_lock_enabled: Boolean(site?.price_lock_enabled),
        locked_launch_price: site?.locked_launch_price ?? null,
        locked_growth_price: site?.locked_growth_price ?? null,
        founding_allocated_at: site?.founding_allocated_at ?? null,
        allocation,
    }));
});

export default router;
