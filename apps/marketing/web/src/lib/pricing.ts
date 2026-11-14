import {
    createLetbuyyApiClient, resolveLetbuyyApiBaseUrl, LETBUYY_PRODUCTION_API_BASE_URL,
    type FoundingPricingResponse, type FoundingProgramRemaining,
} from '@letbuyy/api-client'

export interface PublicPricingData {
    pricing: FoundingPricingResponse
    remaining: FoundingProgramRemaining | null
}

/** Shared public gateway read for SSR and the existing browser retry route.
 * Prices and availability come from the same canonical public response.
 */
export async function loadPublicPricing(): Promise<PublicPricingData | null> {
    const api = createLetbuyyApiClient({
        baseUrl: resolveLetbuyyApiBaseUrl(
            [process.env.LETBUYY_API_URL, process.env.NEXT_PUBLIC_API_URL],
            { fallback: LETBUYY_PRODUCTION_API_BASE_URL },
        ),
        fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
    })
    const signal = AbortSignal.timeout(6000)
    let pricing: FoundingPricingResponse
    try {
        pricing = await api.foundingProgram.pricing({ signal })
    } catch {
        return null
    }
    if (!Array.isArray(pricing.plans)) return null
    if (!pricing.plans.every(plan =>
        typeof plan.slug === 'string' && typeof plan.name === 'string' &&
        typeof plan.status === 'string' && typeof plan.purchasable === 'boolean' &&
        Number.isFinite(plan.regular_inr) && plan.regular_inr >= 0 &&
        Number.isFinite(plan.founding_inr) && plan.founding_inr >= 0 &&
        Number.isFinite(plan.savings_inr) && Array.isArray(plan.features),
    )) return null
    // /pricing already includes the same program RPC used by /remaining.
    // Avoid a duplicate database read and waiting for its independent timeout.
    const program = pricing.founding_program
    const remaining = program &&
        typeof program.total_slots === 'number' && Number.isFinite(program.total_slots) &&
        typeof program.used_slots === 'number' && Number.isFinite(program.used_slots) &&
        typeof program.remaining_slots === 'number' && Number.isFinite(program.remaining_slots) &&
        typeof program.active === 'boolean' && typeof program.paused === 'boolean'
        ? {
            total_slots: program.total_slots, used_slots: program.used_slots,
            remaining_slots: program.remaining_slots, active: program.active, paused: program.paused,
        }
        : null
    // The API may repeat an identical comparison matrix on each plan. Share its
    // reference for React Flight while preserving every canonical response value.
    const comparisons = new Map<string, unknown[]>()
    const plans = pricing.plans.map(plan => {
        const view = plan as typeof plan & { compare_features?: unknown[] }
        if (!Array.isArray(view.compare_features)) return plan
        const key = JSON.stringify(view.compare_features)
        const existing = comparisons.get(key)
        if (!existing) {
            comparisons.set(key, view.compare_features)
            return plan
        }
        return { ...plan, compare_features: existing }
    })
    return { pricing: { ...pricing, plans }, remaining }
}
