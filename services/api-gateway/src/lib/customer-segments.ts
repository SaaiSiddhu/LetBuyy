// The customer segment rules and payload shaping, lifted out of routes/customers.ts unchanged.
//
// Deciding whether a customer matches a segment, and shaping a row into the Customer /
// CustomerSegment payloads, is a separate concern from answering the request — and it is pure, so it
// can be reasoned about without a route around it. This is a byte-for-byte transplant: every
// function below is the text that was running in customers.ts, in the same order, with only
// `export` added.
//
// `loadCustomerSummariesForStore` deliberately did NOT come with it. It depends on
// loadStoreCustomerRows and loadCustomerOrderRows, which depend in turn on the route's own
// schema-drift helpers — and unifying those with the near-identical copies in
// lib/order-read-compat.ts and routes/products.ts is a behaviour question that deserves its own
// phase, not a line-count one.

import { buildCustomerSummaries } from '@letbuyy/commerce-core';
import {
    CustomerSegmentRulesSchema,
    type Customer,
    type CustomerSegment,
    type CustomerSegmentRules,
} from '@letbuyy/shared-types';

export interface CustomerSegmentRow {
    id?: string | null;
    store_id?: string | null;
    name?: string | null;
    description?: string | null;
    rules?: unknown;
    created_by?: string | null;
    updated_by?: string | null;
    deleted_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    deleted_at?: string | null;
}

export function splitCustomerName(fullName: string | null | undefined) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: null, lastName: null };
    return {
        firstName: parts[0] || null,
        lastName: parts.slice(1).join(' ') || null,
    };
}

export function segmentRulesPayload(value: unknown): CustomerSegmentRules {
    const parsed = CustomerSegmentRulesSchema.safeParse(value || {});
    return parsed.success ? parsed.data : { tags_any: [] };
}

export function segmentPayload(row: CustomerSegmentRow, customerCount = 0): CustomerSegment {
    return {
        id: row.id || '',
        store_id: row.store_id || '',
        name: row.name || 'Customer segment',
        description: row.description || null,
        rules: segmentRulesPayload(row.rules),
        customer_count: customerCount,
        created_by: row.created_by || null,
        updated_by: row.updated_by || null,
        deleted_by: row.deleted_by || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        deleted_at: row.deleted_at || null,
    };
}

export function customerSummaryPayload(summary: ReturnType<typeof buildCustomerSummaries>[number], storeId: string): Customer {
    const nameParts = splitCustomerName(summary.customer_name || summary.full_name);
    return {
        id: summary.id,
        store_id: storeId,
        email: summary.customer_email,
        phone: summary.customer_phone,
        gstin: null,
        first_name: nameParts.firstName,
        last_name: nameParts.lastName,
        display_name: summary.customer_name || summary.customer_email,
        status: (summary.status || 'active') as Customer['status'],
        accepts_marketing: summary.accepts_marketing,
        tags: summary.tags,
        notes: null,
        default_address_id: null,
        addresses: [],
        order_count: summary.total_orders,
        total_spent: summary.total_spent,
        last_order_at: summary.last_order_at,
        metadata: {},
        created_by: null,
        updated_by: null,
        deleted_by: null,
        created_at: summary.created_at || new Date().toISOString(),
        updated_at: summary.last_order_at || summary.created_at || new Date().toISOString(),
        deleted_at: null,
    };
}

export function matchesSegmentRules(summary: ReturnType<typeof buildCustomerSummaries>[number], rules: CustomerSegmentRules): boolean {
    if (rules.status && summary.status !== rules.status) return false;
    if (rules.accepts_marketing !== null && rules.accepts_marketing !== undefined && summary.accepts_marketing !== rules.accepts_marketing) {
        return false;
    }

    const tagsAny = rules.tags_any || [];
    if (tagsAny.length > 0) {
        const tags = new Set(summary.tags.map((tag) => tag.toLowerCase()));
        if (!tagsAny.some((tag) => tags.has(tag.toLowerCase()))) return false;
    }

    if (rules.min_order_count !== null && rules.min_order_count !== undefined && summary.total_orders < rules.min_order_count) {
        return false;
    }

    if (rules.min_total_spent !== null && rules.min_total_spent !== undefined && summary.total_spent < rules.min_total_spent) {
        return false;
    }

    if (rules.last_order_after && (!summary.last_order_at || summary.last_order_at < rules.last_order_after)) return false;
    if (rules.last_order_before && summary.last_order_at && summary.last_order_at > rules.last_order_before) return false;
    return true;
}

export function applySegmentRules(
    summaries: ReturnType<typeof buildCustomerSummaries>,
    rules: CustomerSegmentRules,
) {
    return summaries.filter((summary) => matchesSegmentRules(summary, rules));
}
