import type { CustomerSegment, CustomerSegmentRules } from '@letbuyy/shared-types'

// Commerce customer summaries and segment spend thresholds share rupee units.
type SegmentRules = CustomerSegmentRules
type SegmentFormSource = Pick<CustomerSegment, 'name' | 'description' | 'rules'>

export function buildEmptyRules(): SegmentRules {
    return { tags_any: [] }
}

export interface SegmentFormState {
    name: string
    description: string
    rules: SegmentRules
    // transient form fields (before they go into rules)
    tagsInput: string
    minOrders: string
    minSpentRupees: string
    lastOrderAfter: string
    lastOrderBefore: string
}

export function buildFormState(segment?: SegmentFormSource): SegmentFormState {
    const rules = segment?.rules ?? buildEmptyRules()
    return {
        name: segment?.name ?? '',
        description: segment?.description ?? '',
        rules,
        tagsInput: (rules.tags_any ?? []).join(', '),
        minOrders: rules.min_order_count != null ? String(rules.min_order_count) : '',
        minSpentRupees: rules.min_total_spent != null ? String(rules.min_total_spent) : '',
        lastOrderAfter: rules.last_order_after
            ? rules.last_order_after.slice(0, 10)  // yyyy-mm-dd for <input type="date">
            : '',
        lastOrderBefore: rules.last_order_before
            ? rules.last_order_before.slice(0, 10)
            : '',
    }
}

export function formStateToRules(form: SegmentFormState): SegmentRules {
    const tags = form.tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    const minOrders = form.minOrders.trim() ? parseInt(form.minOrders, 10) : undefined
    const minSpent = form.minSpentRupees.trim() ? Number(form.minSpentRupees) : undefined
    const afterDate = form.lastOrderAfter ? `${form.lastOrderAfter}T00:00:00.000Z` : undefined
    const beforeDate = form.lastOrderBefore ? `${form.lastOrderBefore}T23:59:59.999Z` : undefined

    return {
        ...(form.rules.status ? { status: form.rules.status } : {}),
        ...(form.rules.accepts_marketing !== undefined && form.rules.accepts_marketing !== null
            ? { accepts_marketing: form.rules.accepts_marketing }
            : {}),
        tags_any: tags,
        ...(minOrders != null && !isNaN(minOrders) ? { min_order_count: minOrders } : {}),
        ...(minSpent != null && !isNaN(minSpent) ? { min_total_spent: minSpent } : {}),
        ...(afterDate ? { last_order_after: afterDate } : {}),
        ...(beforeDate ? { last_order_before: beforeDate } : {}),
    }
}
