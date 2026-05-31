import type { SubscriptionPlan } from '@letbuyy/shared-types'

export interface SubscriptionPlanFeatureView {
    label: string
    icon: string
}

export interface SubscriptionPlanCompareItemView {
    label: string
    description?: string
    starter: string | boolean
    business: string | boolean
    enterprise: string | boolean
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

function numberField(record: Record<string, unknown>, key: string, fallback = 0) {
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function booleanField(record: Record<string, unknown>, key: string, fallback = false) {
    const value = record[key]
    return typeof value === 'boolean' ? value : fallback
}

function featureViews(value: unknown): SubscriptionPlanFeatureView[] {
    if (!Array.isArray(value)) return []

    return value.flatMap((item) => {
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

        return [{
            label,
            description: nullableStringField(record, 'description') || undefined,
            starter: compareValue(record.starter),
            business: compareValue(record.business),
            enterprise: compareValue(record.enterprise),
        }]
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
        gmv_percentage: numberField(record, 'gmv_percentage'),
        promo_price_inr: plan.promo_price_inr || 0,
        promo_months: plan.promo_months || 0,
        promo_label: nullableStringField(record, 'promo_label'),
        features: featureViews(record.features),
        compare_features: compareFeatureViews(record.compare_features),
        requires_contact: plan.requires_contact,
    }
}
