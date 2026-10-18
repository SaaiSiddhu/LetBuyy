import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchBuyerExportSourceData,
  type BuyerExportSourceDb,
} from '../identity-foundation/buyer-export-source';

const BUYER = 'aaaaaaaa-0000-4000-8000-00000000000a';
const ACTIVE_TICKET = 'bbbbbbbb-0000-4000-8000-00000000000b';
const DELETED_TICKET = 'cccccccc-0000-4000-8000-00000000000c';

type Row = Record<string, unknown>;
type QueryResult = { data: Row[] | null; error: unknown };

class MemoryQuery implements PromiseLike<QueryResult> {
  private filters: Array<(row: Row) => boolean> = [];
  private limitCount = Number.POSITIVE_INFINITY;

  constructor(private readonly rows: Row[], private readonly columns: string) {}

  eq(column: string, value: string): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: string, value: null): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: string[]): this {
    this.filters.push((row) => values.includes(String(row[column])));
    return this;
  }

  order(): this { return this; }

  limit(value: number): this {
    this.limitCount = value;
    return this;
  }

  async maybeSingle(): Promise<{ data: Row | null; error: unknown }> {
    const result = this.rows.filter((row) => this.filters.every((filter) => filter(row))).slice(0, 1);
    return { data: result[0] || null, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const selected = this.columns.split(',').map((column) => column.trim());
    const data = this.rows
      .filter((row) => this.filters.every((filter) => filter(row)))
      .slice(0, this.limitCount)
      .map((row) => Object.fromEntries(selected.map((column) => [column, row[column]])));
    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

function memoryDb(tables: Record<string, Row[]>): BuyerExportSourceDb {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          return new MemoryQuery(tables[table] || [], columns);
        },
      };
    },
  };
}

test('buyer export source excludes soft-deleted tickets and requester messages', async () => {
  const db = memoryDb({
    buyer_accounts: [{ id: BUYER, email: 'buyer@example.test' }],
    buyer_addresses: [],
    support_tickets: [
      { id: ACTIVE_TICKET, requester_user_id: BUYER, requester_type: 'customer', ticket_ref: 'SUP-ACTIVE', topic: 'orders', created_at: '2026-10-01T00:00:00Z', deleted_at: null },
      { id: DELETED_TICKET, requester_user_id: BUYER, requester_type: 'customer', ticket_ref: 'SUP-DELETED', topic: 'orders', created_at: '2026-10-02T00:00:00Z', deleted_at: '2026-10-03T00:00:00Z' },
    ],
    ticket_messages: [
      { ticket_id: ACTIVE_TICKET, author_type: 'requester', body: 'Keep this authored message', deleted_at: null },
      { ticket_id: ACTIVE_TICKET, author_type: 'requester', body: 'Exclude this deleted message', deleted_at: '2026-10-03T00:00:00Z' },
      { ticket_id: ACTIVE_TICKET, author_type: 'agent', body: 'Exclude internal agent content', deleted_at: null },
      { ticket_id: DELETED_TICKET, author_type: 'requester', body: 'Exclude content on the deleted ticket', deleted_at: null },
    ],
    buyer_order_links: [],
    orders: [],
    order_items: [],
  });

  const result = await fetchBuyerExportSourceData(db, BUYER);

  assert.deepEqual(result.source.authoredRequests, [{
    requester_user_id: BUYER,
    ticket_ref: 'SUP-ACTIVE',
    topic: 'orders',
    created_at: '2026-10-01T00:00:00Z',
    body: 'Keep this authored message',
  }]);
});
