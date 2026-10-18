// Phase 2 / D05 approved local slice (Mandate 7, Sections 12-13) -- REAL, read-only queries feeding
// the existing pure generateBuyerExport function (buyer-export-contract.ts), using exactly the
// ownership predicates already named in BUYER_EXPORT_CONTRACT. No SELECT * anywhere -- every query
// names its own columns, matching the contract's field list one-to-one.
//
// This file is NOT imported by any route. BUYER_EXPORT_GENERATION_AVAILABLE (buyer-export-
// contract.ts) stays false; wiring a real query path does not itself make export generation a
// reachable capability. Exercised in this pass only against synthetic local buyer accounts, never
// against any real buyer's data.

import type { SyntheticSourceData } from './buyer-export-contract';

export interface BuyerExportSourceDb {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): BuyerExportSourceQuery;
    };
  };
}
interface BuyerExportSourceQuery {
  eq(column: string, value: string): BuyerExportSourceQuery;
  is(column: string, value: null): BuyerExportSourceQuery;
  in(column: string, values: string[]): BuyerExportSourceQuery;
  order(column: string, opts?: { ascending?: boolean }): BuyerExportSourceQuery;
  limit(n: number): BuyerExportSourceQuery;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  then: Promise<{ data: Record<string, unknown>[] | null; error: unknown }>['then'];
}

/** Bounds a single export's own generation -- not the buyer's total history, which this pass makes
 *  no claim about paginating end-to-end. Named so the limit is a decision, not an accident. */
const MAX_ADDRESSES = 200;
const MAX_TICKETS = 500;
const MAX_MESSAGES_PER_TICKET = 500;
const MAX_ORDERS = 500;
const MAX_ORDER_ITEMS_PER_ORDER = 200;

export interface ExportSourceFetchResult {
  source: SyntheticSourceData;
  /** True if any bound above was actually hit -- the caller (generateBuyerExport's result already
   *  has its own `complete` flag for ownership mismatches; this is the OTHER partial-completion
   *  signal, for "there was more data than this pass fetched", so a truncated export is never
   *  reported identically to a complete one). */
  truncated: boolean;
}

export async function fetchBuyerExportSourceData(
  db: BuyerExportSourceDb,
  buyerAccountId: string,
): Promise<ExportSourceFetchResult> {
  let truncated = false;

  const profileRes = await db
    .from('buyer_accounts')
    .select('id, email, full_name, phone, status, created_at')
    .eq('id', buyerAccountId)
    .maybeSingle();
  if (profileRes.error) throw new Error(`buyer_accounts read failed: ${JSON.stringify(profileRes.error)}`);

  const addressesRes = await db
    .from('buyer_addresses')
    .select('buyer_account_id, label, full_name, address_line1, address_line2, city, state, postal_code, country, is_default')
    .eq('buyer_account_id', buyerAccountId)
    .limit(MAX_ADDRESSES + 1);
  if (addressesRes.error) throw new Error(`buyer_addresses read failed: ${JSON.stringify(addressesRes.error)}`);
  const addresses = (addressesRes.data || []) as SyntheticSourceData['addresses'] & Record<string, unknown>[];
  if (addresses && addresses.length > MAX_ADDRESSES) { truncated = true; addresses.length = MAX_ADDRESSES; }

  // Buyer-authored request content: requester_type='customer' scopes to the buyer realm specifically
  // (never a merchant-side 'employee' or platform 'anonymous' ticket that happens to share an id
  // space); requester_user_id is the session-derived buyer id, never a client-supplied value.
  const ticketsRes = await db
    .from('support_tickets')
    .select('id, ticket_ref, topic, created_at')
    .eq('requester_user_id', buyerAccountId)
    .eq('requester_type', 'customer')
    .is('deleted_at', null)
    .limit(MAX_TICKETS + 1);
  if (ticketsRes.error) throw new Error(`support_tickets read failed: ${JSON.stringify(ticketsRes.error)}`);
  const tickets = (ticketsRes.data || []) as Record<string, unknown>[];
  if (tickets.length > MAX_TICKETS) { truncated = true; tickets.length = MAX_TICKETS; }

  const authoredRequests: SyntheticSourceData['authoredRequests'] = [];
  for (const ticket of tickets) {
    const ticketId = String(ticket.id);
    // author_type='requester' excludes every agent-authored message on the SAME thread by
    // construction -- never a post-hoc filter on the output, a predicate on the query itself.
    const messagesRes = await db
      .from('ticket_messages')
      .select('body')
      .eq('ticket_id', ticketId)
      .eq('author_type', 'requester')
      .is('deleted_at', null)
      .limit(MAX_MESSAGES_PER_TICKET + 1);
    if (messagesRes.error) throw new Error(`ticket_messages read failed: ${JSON.stringify(messagesRes.error)}`);
    const messages = (messagesRes.data || []) as Array<{ body: string }>;
    if (messages.length > MAX_MESSAGES_PER_TICKET) { truncated = true; messages.length = MAX_MESSAGES_PER_TICKET; }
    for (const message of messages) {
      authoredRequests!.push({
        requester_user_id: buyerAccountId,
        ticket_ref: String(ticket.ticket_ref ?? ''),
        topic: String(ticket.topic ?? ''),
        created_at: String(ticket.created_at ?? ''),
        body: message.body,
      });
    }
  }

  // Order access is ALWAYS through buyer_order_links -- never a direct match on orders.customer_email,
  // which would let one buyer claim another person's order merely by sharing an email string. The
  // link itself was already established by a separate, already-vetted process (link_basis:
  // authenticated_checkout | verified_email | operator_resolution); this query trusts that a link
  // exists, it does not re-derive one.
  const linksRes = await db
    .from('buyer_order_links')
    .select('order_id')
    .eq('buyer_account_id', buyerAccountId)
    .limit(MAX_ORDERS + 1);
  if (linksRes.error) throw new Error(`buyer_order_links read failed: ${JSON.stringify(linksRes.error)}`);
  const links = (linksRes.data || []) as Array<{ order_id: string }>;
  if (links.length > MAX_ORDERS) { truncated = true; links.length = MAX_ORDERS; }

  const orders: SyntheticSourceData['orders'] = [];
  for (const link of links) {
    const orderRes = await db
      .from('orders')
      .select('id, order_number, status, total, currency, created_at')
      .eq('id', link.order_id)
      .maybeSingle();
    if (orderRes.error) throw new Error(`orders read failed: ${JSON.stringify(orderRes.error)}`);
    if (!orderRes.data) continue; // a dangling link (order deleted after linking) is skipped, never fabricated
    const itemsRes = await db
      .from('order_items')
      .select('name, quantity, price, total')
      .eq('order_id', link.order_id)
      .is('deleted_at', null)
      .limit(MAX_ORDER_ITEMS_PER_ORDER + 1);
    if (itemsRes.error) throw new Error(`order_items read failed: ${JSON.stringify(itemsRes.error)}`);
    const items = (itemsRes.data || []) as Record<string, unknown>[];
    if (items.length > MAX_ORDER_ITEMS_PER_ORDER) { truncated = true; items.length = MAX_ORDER_ITEMS_PER_ORDER; }
    orders!.push({
      buyer_account_id: buyerAccountId,
      order_number: String(orderRes.data.order_number ?? ''),
      status: String(orderRes.data.status ?? ''),
      total: orderRes.data.total,
      currency: orderRes.data.currency,
      created_at: String(orderRes.data.created_at ?? ''),
      items,
    });
  }

  return {
    source: {
      profile: (profileRes.data as SyntheticSourceData['profile']) || undefined,
      addresses,
      authoredRequests,
      orders,
    },
    truncated,
  };
}
