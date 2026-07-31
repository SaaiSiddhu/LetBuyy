import { Hono } from 'hono';
import type { Env } from '../index';
import { resolvePlanPublicPricing, type BillingPlanCatalogRecord } from '@letbuyy/billing-core';
import { getSupabaseAdmin, success } from '../lib/supabase';

// PUBLIC (unauthenticated) founding-program + pricing endpoints. Mounted BEFORE the
// auth middleware. Exposes only non-PII program counts (via the SECURITY DEFINER RPC
// get_founding_program_public) and the public plan catalog. Drives the marketing
// pricing page + the live "X / 100 remaining" counter (never hardcoded).

const router = new Hono<{ Bindings: Env }>();

type Db = ReturnType<typeof getSupabaseAdmin>;

async function loadProgramPublic(db: Db): Promise<Record<string, unknown>> {
    const { data } = await db.rpc('get_founding_program_public');
    return (data as Record<string, unknown>) ?? { available: false };
}

async function loadStorePlans(db: Db): Promise<Array<Record<string, unknown>>> {
    const { data } = await db
        .from('plans')
        .select('id, slug, name, tagline, price_monthly_inr, price_yearly_inr, founding_price_inr, features, compare_features, is_popular, display_order, status, purchasable')
        .eq('site_type', 'store')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });
    return (data as Array<Record<string, unknown>>) ?? [];
}

router.get('/founding-program', async (c) => {
    return c.json(success(await loadProgramPublic(getSupabaseAdmin(c))));
});

router.get('/founding-program/stats', async (c) => {
    return c.json(success(await loadProgramPublic(getSupabaseAdmin(c))));
});

router.get('/founding-program/remaining', async (c) => {
    const p = await loadProgramPublic(getSupabaseAdmin(c));
    return c.json(success({
        total_slots: p.total_slots ?? 100,
        used_slots: p.used_slots ?? 0,
        remaining_slots: p.remaining_slots ?? 0,
        active: p.active ?? false,
        paused: p.paused ?? false,
    }));
});

router.get('/pricing', async (c) => {
    const db = getSupabaseAdmin(c);
    const [program, plans] = await Promise.all([loadProgramPublic(db), loadStorePlans(db)]);
    const pricing = plans.map((plan) => {
        const pub = resolvePlanPublicPricing(plan as unknown as BillingPlanCatalogRecord);
        return {
            slug: plan.slug,
            name: plan.name,
            tagline: plan.tagline ?? null,
            is_popular: Boolean(plan.is_popular),
            display_order: Number(plan.display_order ?? 0),
            status: pub.status,
            purchasable: pub.purchasable,
            regular_inr: pub.regularInr,
            founding_inr: pub.foundingInr,
            savings_inr: pub.savingsInr,
            has_founding: pub.hasFounding,
            features: Array.isArray(plan.features) ? plan.features : [],
            compare_features: Array.isArray(plan.compare_features) ? plan.compare_features : [],
        };
    });
    return c.json(success({ plans: pricing, founding_program: program }));
});

router.get('/plans', async (c) => {
    return c.json(success({ plans: await loadStorePlans(getSupabaseAdmin(c)) }));
});

export default router;
