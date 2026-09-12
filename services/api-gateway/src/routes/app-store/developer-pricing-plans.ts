// F-ROUTELEN-6 — the pricing-plan input unit, lifted verbatim out of developer-routes.ts, which sat
// 29 lines under the 1,500-line route-file limit that route-line-count-validator.mjs enforces.
//
// Everything here is pure shaping: it reads a submitted body and produces rows. There is no database
// access in this module, and that is load-bearing rather than incidental — developer-routes.ts is
// named in canonical-ledger-only-validator's SKIP-B3-PARTNER-PAYOUT-LEDGER-BOUNDARY exemption set, so
// a money write moved out of that file would land somewhere that is NOT exempted. Keep it that way:
// if this module ever needs to write, it belongs back in the route file, not in a new exemption.
//
// isUuid is deliberately absent even though it sat between these functions in the original file. Its
// only caller is a route handler, not a pricing function.

import { appBillingModeForPricingModel } from '@letbuyy/billing-core';
import {
    AppPricingPlanInputSchema,
    type AppEngineJsonRecord,
    type AppPricingPlanInput,
    type AppPricingPlanUpdate,
} from '@letbuyy/shared-types';

export function amountMajorToMinor(value: unknown): number {
    const amount = Number(value);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

export function planSlug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 120) || 'plan';
}

export function appPricingPlanRow(input: {
    appId: string;
    developerId: string;
    actorId: string;
    plan: AppPricingPlanInput | AppPricingPlanUpdate;
}): AppEngineJsonRecord {
    const pricingModel = typeof input.plan.pricing_model === 'string' ? input.plan.pricing_model : 'free';
    const billingMode = input.plan.billing_mode || appBillingModeForPricingModel(pricingModel);
    return {
        app_id: input.appId,
        developer_id: input.developerId,
        ...(input.plan.plan_slug !== undefined ? { plan_slug: planSlug(input.plan.plan_slug) } : {}),
        ...(input.plan.name !== undefined ? { name: input.plan.name } : {}),
        ...(input.plan.description !== undefined ? { description: input.plan.description || null } : {}),
        ...(input.plan.pricing_model !== undefined ? { pricing_model: pricingModel } : {}),
        ...(input.plan.billing_mode !== undefined || input.plan.pricing_model !== undefined ? { billing_mode: billingMode } : {}),
        ...(input.plan.currency !== undefined ? { currency: 'INR' } : {}),
        ...(input.plan.amount_minor !== undefined ? { amount_minor: Math.max(0, Math.round(Number(input.plan.amount_minor) || 0)) } : {}),
        ...(input.plan.interval !== undefined ? { interval: input.plan.interval } : {}),
        ...(input.plan.trial_days !== undefined ? { trial_days: Math.max(0, Math.min(365, Math.round(Number(input.plan.trial_days) || 0))) } : {}),
        ...(input.plan.usage_meter !== undefined ? { usage_meter: input.plan.usage_meter || null } : {}),
        ...(input.plan.usage_unit !== undefined ? { usage_unit: input.plan.usage_unit || null } : {}),
        ...(input.plan.included_usage !== undefined ? { included_usage: Math.max(0, Math.round(Number(input.plan.included_usage) || 0)) } : {}),
        ...(input.plan.usage_unit_amount_minor !== undefined ? { usage_unit_amount_minor: Math.max(0, Math.round(Number(input.plan.usage_unit_amount_minor) || 0)) } : {}),
        ...(input.plan.features !== undefined ? { features: input.plan.features } : {}),
        ...(input.plan.limits !== undefined ? { limits: input.plan.limits } : {}),
        ...(input.plan.is_default !== undefined ? { is_default: input.plan.is_default } : {}),
        ...(input.plan.status !== undefined ? { status: input.plan.status } : {}),
        ...(input.plan.sort_order !== undefined ? { sort_order: input.plan.sort_order } : {}),
        updated_by: input.actorId,
    };
}

export function submittedPricingPlans(body: AppEngineJsonRecord, pricingModel: string): { ok: true; plans: AppPricingPlanInput[] } | { ok: false; message: string } {
    const rawPlans = Array.isArray(body.pricing_plans) ? body.pricing_plans : [];
    if (rawPlans.length > 0) {
        const plans: AppPricingPlanInput[] = [];
        for (const rawPlan of rawPlans.slice(0, 12)) {
            const parsed = AppPricingPlanInputSchema.safeParse(rawPlan);
            if (!parsed.success) {
                return { ok: false, message: parsed.error.issues[0]?.message || 'Invalid pricing plan' };
            }
            plans.push(parsed.data);
        }
        return { ok: true, plans };
    }

    if (pricingModel === 'free') {
        return {
            ok: true,
            plans: [AppPricingPlanInputSchema.parse({
                plan_slug: 'free',
                name: 'Free',
                pricing_model: 'free',
                amount_minor: 0,
                interval: 'none',
                is_default: true,
                status: 'active',
            })],
        };
    }

    const monthlyMinor = amountMajorToMinor(body.price_monthly);
    const yearlyMinor = amountMajorToMinor(body.price_yearly);
    const trialDays = Math.max(0, Math.min(365, Math.round(Number(body.trial_days) || 0)));
    const fallbackMinor = monthlyMinor || yearlyMinor || amountMajorToMinor(body.price_inr);
    if (!fallbackMinor && pricingModel !== 'freemium') return { ok: true, plans: [] };

    if (pricingModel === 'one_time') {
        return {
            ok: true,
            plans: [AppPricingPlanInputSchema.parse({
                plan_slug: 'one-time',
                name: 'One-time',
                pricing_model: 'one_time',
                billing_mode: 'one_time',
                amount_minor: fallbackMinor,
                interval: 'none',
                trial_days: 0,
                is_default: true,
                status: 'active',
            })],
        };
    }

    if (pricingModel === 'usage') {
        return {
            ok: true,
            plans: [AppPricingPlanInputSchema.parse({
                plan_slug: 'usage',
                name: 'Usage',
                pricing_model: 'usage',
                billing_mode: 'usage',
                amount_minor: fallbackMinor,
                interval: 'monthly',
                trial_days: trialDays,
                usage_meter: 'usage_events',
                usage_unit: 'event',
                usage_unit_amount_minor: fallbackMinor,
                is_default: true,
                status: 'active',
            })],
        };
    }

    const plans: AppPricingPlanInput[] = [];
    if (monthlyMinor) {
        plans.push(AppPricingPlanInputSchema.parse({
            plan_slug: 'monthly',
            name: 'Monthly',
            pricing_model: pricingModel === 'freemium' ? 'freemium' : 'recurring',
            billing_mode: 'recurring',
            amount_minor: monthlyMinor,
            interval: 'monthly',
            trial_days: trialDays,
            is_default: true,
            status: 'active',
        }));
    }
    if (yearlyMinor) {
        plans.push(AppPricingPlanInputSchema.parse({
            plan_slug: 'annual',
            name: 'Annual',
            pricing_model: pricingModel === 'freemium' ? 'freemium' : 'recurring',
            billing_mode: 'recurring',
            amount_minor: yearlyMinor,
            interval: 'yearly',
            trial_days: trialDays,
            is_default: plans.length === 0,
            status: 'active',
            sort_order: 10,
        }));
    }
    return { ok: true, plans };
}
