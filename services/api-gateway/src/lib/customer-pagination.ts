import type { CommerceCustomerSummary } from '@letbuyy/commerce-core';

type CustomerCursor = { id: string; value: string };

function customerCursorValue(summary: CommerceCustomerSummary): string {
    return summary.last_order_at || summary.created_at || '';
}

// Continuation uses the same code-unit comparison. Locale collation can put
// email punctuation in a different order and silently drop equal-date rows.
function compareCursorText(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export type CustomerSummarySort = 'name' | 'email' | 'phone' | 'total_orders' | 'total_spent' | 'last_order_at' | 'status';

function sortValue(summary: CommerceCustomerSummary, sort: CustomerSummarySort): string | number {
    switch (sort) {
        case 'name': return summary.full_name || summary.customer_email;
        case 'email': return summary.customer_email;
        case 'phone': return summary.customer_phone || '';
        case 'total_orders': return summary.total_orders;
        case 'total_spent': return summary.total_spent;
        case 'status': return summary.status;
        case 'last_order_at': return customerCursorValue(summary);
    }
}

export function orderCustomerSummaries(summaries: CommerceCustomerSummary[], sort: CustomerSummarySort = 'last_order_at', order: 'asc' | 'desc' = 'desc'): CommerceCustomerSummary[] {
    return [...summaries].sort((a, b) => {
        const aValue = sortValue(a, sort);
        const bValue = sortValue(b, sort);
        const compared = typeof aValue === 'number' && typeof bValue === 'number'
            ? aValue - bValue
            : compareCursorText(String(aValue).toLowerCase(), String(bValue).toLowerCase());
        if (compared !== 0) return order === 'asc' ? compared : -compared;
        return compareCursorText(String(a.id || a.customer_email), String(b.id || b.customer_email));
    });
}

function encodeCustomerCursor(summary: CommerceCustomerSummary): string | null {
    const id = String(summary.id || summary.customer_email || '');
    const value = customerCursorValue(summary);
    if (!id || !value) return null;
    return btoa(JSON.stringify({ id, value }));
}

function decodeCustomerCursor(cursor?: string): CustomerCursor | null {
    if (!cursor) return null;
    try {
        const parsed = JSON.parse(atob(cursor)) as Record<string, unknown>;
        const id = parsed.id;
        const value = parsed.value;
        if (typeof id !== 'string' || id.length === 0) return null;
        if (typeof value !== 'string' || value.length === 0) return null;
        return { id, value };
    } catch {
        return null;
    }
}

function customerIsAfterCursor(summary: CommerceCustomerSummary, cursor: CustomerCursor): boolean {
    const value = customerCursorValue(summary);
    if (value < cursor.value) return true;
    if (value > cursor.value) return false;
    return String(summary.id || summary.customer_email || '') > cursor.id;
}

export function customerCursorPage(
    summaries: CommerceCustomerSummary[],
    query: { cursor?: string; page: number; limit: number },
): { rows: CommerceCustomerSummary[]; nextCursor: string | null } {
    const decodedCursor = decodeCustomerCursor(query.cursor);
    const rowsAfterCursor = decodedCursor
        ? summaries.filter((summary) => customerIsAfterCursor(summary, decodedCursor))
        : query.page === 1
            ? summaries
            : summaries.slice((query.page - 1) * query.limit);
    const pageRows = rowsAfterCursor.slice(0, query.limit);
    const nextCursor = rowsAfterCursor.length > query.limit && pageRows.length > 0
        ? encodeCustomerCursor(pageRows[pageRows.length - 1])
        : null;
    return { rows: pageRows, nextCursor };
}

export function customerSortedPage(
    summaries: CommerceCustomerSummary[],
    query: { cursor?: string; page: number; limit: number; sort: CustomerSummarySort; order: 'asc' | 'desc' },
): { rows: CommerceCustomerSummary[]; nextCursor: string | null } {
    let start = (query.page - 1) * query.limit;
    if (query.cursor) {
        try {
            const cursor = JSON.parse(atob(query.cursor)) as Record<string, unknown>;
            if (cursor.sort !== query.sort || cursor.order !== query.order || typeof cursor.id !== 'string') {
                return { rows: [], nextCursor: null };
            }
            const index = summaries.findIndex(summary => String(summary.id || summary.customer_email) === cursor.id);
            if (index < 0) return { rows: [], nextCursor: null };
            start = index + 1;
        } catch {
            return { rows: [], nextCursor: null };
        }
    }
    const rows = summaries.slice(start, start + query.limit);
    const last = rows[rows.length - 1];
    const nextCursor = last && start + rows.length < summaries.length
        ? btoa(JSON.stringify({ id: String(last.id || last.customer_email), sort: query.sort, order: query.order }))
        : null;
    return { rows, nextCursor };
}
