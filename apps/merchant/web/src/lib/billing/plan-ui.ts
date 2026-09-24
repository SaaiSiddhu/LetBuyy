import type { SubscriptionPlan } from '@letbuyy/shared-types'

export interface SubscriptionPlanFeatureView {
    label: string
    icon: string
}

export interface SubscriptionPlanCompareItemView {
    label: string
    description?: string
    [planSlug: string]: string | boolean | undefined
}

export interface SubscriptionPlanCompareGroupView {
    category: string
    items: SubscriptionPlanCompareItemView[]
}

export interface SubscriptionPlanView {
    id: string
    slug: string
    name: string
    tagline: string
    is_popular: boolean
    price_monthly_inr: number
    price_yearly_inr: number
    gmv_percentage: number
    promo_price_inr: number
    promo_months: number
    promo_label: string | null
    features: SubscriptionPlanFeatureView[]
    compare_features: SubscriptionPlanCompareGroupView[]
    requires_contact: boolean
    status: string
    purchasable: boolean
    founding_price_inr: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null
}

function stringField(record: Record<string, unknown>, key: string, fallback = '') {
    const value = record[key]
    return typeof value === 'string' ? value : fallback
}

function nullableStringField(record: Record<string, unknown>, key: string) {
    const value = record[key]
    return typeof value === 'string' ? value : null
}

function booleanField(record: Record<string, unknown>, key: string, fallback = false) {
    const value = record[key]
    return typeof value === 'boolean' ? value : fallback
}

function featureViews(value: unknown): SubscriptionPlanFeatureView[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((item) => {
        // V1 plans store features as plain strings; legacy plans use { label, icon }.
        if (typeof item === 'string') {
            const label = item.trim()
            return label ? [{ label, icon: 'check' }] : []
        }
        const record = asRecord(item)
        const label = record ? stringField(record, 'label') : ''
        if (!label) return []

        return [{
            label,
            icon: record ? stringField(record, 'icon', 'check') : 'check',
        }]
    })
}

function compareItemViews(value: unknown): SubscriptionPlanCompareItemView[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((item) => {
        const record = asRecord(item)
        const label = record ? stringField(record, 'label') : ''
        if (!record || !label) return []

        const view: SubscriptionPlanCompareItemView = {
            label,
            description: nullableStringField(record, 'description') || undefined,
        }

        Object.entries(record).forEach(([key, value]) => {
            if (key === 'label' || key === 'description') return
            view[key] = compareValue(value)
        })

        return [view]
    })
}

function compareFeatureViews(value: unknown): SubscriptionPlanCompareGroupView[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((group) => {
        const record = asRecord(group)
        const category = record ? stringField(record, 'category') : ''
        if (!record || !category) return []

        return [{
            category,
            items: compareItemViews(record.items),
        }]
    })
}

function compareValue(value: unknown): string | boolean {
    if (typeof value === 'boolean' || typeof value === 'string') return value
    return false
}

export function toSubscriptionPlanView(plan: SubscriptionPlan): SubscriptionPlanView {
    const record = plan as SubscriptionPlan & Record<string, unknown>

    return {
        id: plan.id || plan.slug,
        slug: plan.slug,
        name: plan.name,
        tagline: stringField(record, 'tagline', plan.description || ''),
        is_popular: booleanField(record, 'is_popular'),
        price_monthly_inr: plan.price_monthly_inr,
        price_yearly_inr: plan.price_yearly_inr,
        gmv_percentage: 0,
        promo_price_inr: plan.promo_price_inr || 0,
        promo_months: plan.promo_months || 0,
        promo_label: nullableStringField(record, 'promo_label'),
        features: featureViews(record.features),
        compare_features: compareFeatureViews(record.compare_features),
        requires_contact: plan.requires_contact,
        status: stringField(record, 'status', 'available'),
        purchasable: typeof record.purchasable === 'boolean' ? record.purchasable : true,
        founding_price_inr: typeof record.founding_price_inr === 'number' ? record.founding_price_inr : 0,
    }
}

// ── Positioning layer (static copy keyed by plan slug) ───────────────────────
// Catalog data (prices/features/matrix) stays the source of truth in `plans`.
// These are shared positioning maps consumed by the pricing surfaces. No prices.

export interface RevenueStageView {
    range: string
    examples: string[]
}

export const REVENUE_STAGE: Record<string, RevenueStageView> = {
    launch: { range: '₹0–₹50k / month', examples: ['New online stores', 'Side businesses', 'First-time entrepreneurs'] },
    growth: { range: '₹50k–₹5L / month', examples: ['Growing D2C brands', 'Active marketing campaigns', 'Small teams'] },
    scale: { range: '₹5L–₹50L / month', examples: ['Multi-channel brands', 'Warehouse operations', 'Established businesses'] },
    commerce_os: { range: '₹50L+ / month', examples: ['Multi-store operators', 'B2B + DTC businesses', 'Large commerce organizations'] },
}

// Catalog-driven competitor benchmark (extensible: add more competitors later).
export interface CompetitorBenchmark {
    name: string
    entryPlan: string
    annualSavings: string
    rows: Array<{ feature: string; competitor: string; letbuyy: string }>
}

export const COMPETITOR_BENCHMARKS: Record<string, CompetitorBenchmark> = {
    shopify: {
        name: 'Shopify',
        entryPlan: 'Basic',
        annualSavings: '₹20,000+',
        rows: [
            { feature: 'Monthly price', competitor: '₹1,994', letbuyy: '₹299' },
            { feature: 'Commission', competitor: 'Variable fees', letbuyy: '0% forever' },
            { feature: 'UPI payments', competitor: 'Limited', letbuyy: 'Native' },
            { feature: 'GST invoices', competitor: 'Additional setup', letbuyy: 'Built in' },
            { feature: 'AI features', competitor: 'Add-ons', letbuyy: 'Included' },
            { feature: 'Custom commerce stack', competitor: 'Limited', letbuyy: 'Native' },
            { feature: 'India-first commerce', competitor: 'Partial', letbuyy: 'Built for Bharat' },
        ],
    },
}

export const COMMERCE_OS_HIGHLIGHTS: Array<{ label: string; icon: string }> = [
    { label: 'LCIS intelligence layer', icon: 'analytics' },
    { label: 'Executive Center', icon: 'trending_up' },
    { label: 'Operations Center', icon: 'dashboard' },
    { label: 'Multi-store management', icon: 'store' },
    { label: 'B2B catalogs', icon: 'inventory_2' },
    { label: 'AI Copilot', icon: 'smart_toy' },
    { label: 'Enterprise automations', icon: 'flash_on' },
    { label: 'Dedicated success manager', icon: 'support' },
]

export const TRUST_INDICATORS: Array<{ icon: string; label: string }> = [
    { icon: 'currency_rupee', label: '0% commission forever' },
    { icon: 'language', label: 'India-first commerce platform' },
    { icon: 'verified', label: 'GST-ready & KYC-verified payouts' },
    { icon: 'smart_toy', label: 'AI-native architecture' },
]

// Subscription checkout offers ("you feel lucky" bonuses) shown in the
// Shopify-style "offers included" accordion. Informational/marketing — distinct
// from coupon codes (which are DB-driven and discount the charge server-side).
export const SUBSCRIPTION_OFFERS: Array<{ title: string; body: string }> = [
    {
        title: 'Domain credit',
        body: 'Earn ₹1,500 in subscription credits toward future bills when you connect a custom domain. Terms apply.',
    },
    {
        title: 'Onboarding bonus',
        body: 'Bonus AI credits + a free store-setup review in your first 30 days on any paid plan. Terms apply.',
    },
]

/** Annual saving (in paise) of paying yearly vs monthly. */
export function planAnnualSavingMinor(monthlyMinor: number, yearlyMinor: number): number {
    if (!monthlyMinor || !yearlyMinor || yearlyMinor >= monthlyMinor) return 0
    return (monthlyMinor - yearlyMinor) * 12
}
