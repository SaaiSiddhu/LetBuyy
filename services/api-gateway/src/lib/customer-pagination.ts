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

export function orderCustomerSummaries(summaries: CommerceCustomerSummary[]): CommerceCustomerSummary[] {
    return [...summaries].sort((a, b) => {
        const dateCompare = compareCursorText(customerCursorValue(b), customerCursorValue(a));
        if (dateCompare !== 0) return dateCompare;
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
