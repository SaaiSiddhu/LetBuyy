import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { CommerceCustomerSummary } from '@letbuyy/commerce-core';
import { buildCustomerSummaries, ListCustomersQuery } from '@letbuyy/commerce-core';
import { customerCursorPage, orderCustomerSummaries } from '../lib/customer-pagination';

const customersRouteSource = readFileSync(new URL('../routes/customers.ts', import.meta.url), 'utf8');
const customerPaginationSource = readFileSync(new URL('../lib/customer-pagination.ts', import.meta.url), 'utf8');
const dartTypesSource = readFileSync(new URL('../../../../packages/dart/api_client/lib/src/types.dart', import.meta.url), 'utf8');
const dartClientSource = readFileSync(new URL('../../../../packages/dart/api_client/lib/src/api_client.dart', import.meta.url), 'utf8');
const productServiceSource = readFileSync(new URL('../../../../apps/merchant/mobile/lib/services/product_service.dart', import.meta.url), 'utf8');
const orderServiceSource = readFileSync(new URL('../../../../apps/merchant/mobile/lib/services/order_service.dart', import.meta.url), 'utf8');
const customerServiceSource = readFileSync(new URL('../../../../apps/merchant/mobile/lib/services/customer_service.dart', import.meta.url), 'utf8');
const cacheServiceSource = readFileSync(new URL('../../../../apps/merchant/mobile/lib/services/cache_service.dart', import.meta.url), 'utf8');

test('customer query preserves false over the URL boundary and filters customers without orders', () => {
    for (const input of [false, 'false', '0']) {
        const query = ListCustomersQuery.parse({ has_orders: input });
        assert.equal(query.has_orders, false);
        const customers = buildCustomerSummaries([
            { id: 'empty', email: 'empty@example.invalid', total_orders: 0 },
            { id: 'buyer', email: 'buyer@example.invalid', total_orders: 2 },
        ], [], query);
        assert.deepEqual(customers.map(customer => customer.id), ['empty']);
    }
    for (const input of [true, 'true', '1']) assert.equal(ListCustomersQuery.parse({ has_orders: input }).has_orders, true);
    assert.equal(ListCustomersQuery.parse({}).has_orders, undefined, 'an omitted filter includes both groups');
});

function summary(index: number): CommerceCustomerSummary {
    const padded = String(index).padStart(3, '0');
    return {
        id: `cust_${padded}`,
        customer_email: `buyer${padded}@example.com`,
        customer_name: `Buyer ${padded}`,
        customer_phone: null,
        full_name: `Buyer ${padded}`,
        email: `buyer${padded}@example.com`,
        phone: null,
        status: 'active',
        accepts_marketing: false,
        tags: [],
        total_orders: index,
        total_spent: index * 100,
        first_order_at: `2026-05-${String((index % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
        last_order_at: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
        last_order_id: `order_${padded}`,
        created_at: `2026-05-${String((index % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
    };
}

test('customer list uses cursor pagination while preserving page-number fallback', () => {
    assert.match(customersRouteSource, /import \{ customerCursorPage, orderCustomerSummaries \} from '\.\.\/lib\/customer-pagination'/);
    assert.match(customersRouteSource, /cursorPaginated\(page\.rows\.map/);
    assert.match(customersRouteSource, /nextCursor:\s*page\.nextCursor/);
    assert.match(customerPaginationSource, /query\.page === 1/);
    assert.match(customerPaginationSource, /summaries\.slice\(\(query\.page - 1\) \* query\.limit\)/);
    assert.doesNotMatch(customersRouteSource, /const offset = \(q\.page - 1\) \* q\.limit[\s\S]{0,400}summaries\.slice\(offset/);
});

test('customer cursor helper paginates a large sorted list without overlap', () => {
    const ordered = orderCustomerSummaries(Array.from({ length: 125 }, (_, index) => summary(index + 1)));
    const first = customerCursorPage(ordered, { page: 1, limit: 50 });
    const second = customerCursorPage(ordered, { page: 1, limit: 50, cursor: first.nextCursor || undefined });
    const third = customerCursorPage(ordered, { page: 1, limit: 50, cursor: second.nextCursor || undefined });

    assert.equal(first.rows.length, 50);
    assert.equal(second.rows.length, 50);
    assert.equal(third.rows.length, 25);
    assert.ok(first.nextCursor);
    assert.ok(second.nextCursor);
    assert.equal(third.nextCursor, null);

    const ids = [...first.rows, ...second.rows, ...third.rows].map((row) => row.id);
    assert.equal(new Set(ids).size, 125);
    assert.deepEqual(ids, ordered.map((row) => row.id));
});

test('customer cursor ordering and continuation agree for equal-date email IDs with punctuation', () => {
    const ids = ['a_b@example.invalid', 'a-b@example.invalid', 'a.b@example.invalid'];
    const ordered = orderCustomerSummaries(ids.map(id => ({ ...summary(1), id, customer_email: id })));
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < ids.length + 1; page++) {
        const result = customerCursorPage(ordered, { page: 1, limit: 1, cursor });
        seen.push(...result.rows.map(row => row.id));
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
    }
    assert.deepEqual(seen, ordered.map(row => row.id), 'cursor pages cannot omit or repeat an equally recent customer');
    assert.equal(seen.length, ids.length);
});

test('Dart client and mobile services expose keyset cursor metadata', () => {
    assert.match(dartTypesSource, /final String\? nextCursor/);
    assert.match(dartClientSource, /meta\['next_cursor'\]/);
    assert.match(productServiceSource, /String\? get productsNextCursor/);
    assert.match(productServiceSource, /if \(cursor != null && cursor\.trim\(\)\.isNotEmpty\)\s*'cursor': cursor\.trim\(\)/);
    assert.match(orderServiceSource, /String\? get ordersNextCursor/);
    assert.match(orderServiceSource, /'cursor': normalizedCursor/);
    assert.match(customerServiceSource, /String\? get customersNextCursor/);
    assert.match(customerServiceSource, /'cursor': normalizedCursor/);
    assert.match(cacheServiceSource, /_cursorSegment\(cursor\)/);
});
