// Phase 2 / D05 independent preparation (Mandate 6, Sections 12-13).
//
// A DRAFT export data contract, field-by-field from the actual schema (not SELECT *), plus a pure
// generator that can be exercised against synthetic fixtures. This module is NOT wired to any HTTP
// route -- BUYER_EXPORT_GENERATION_AVAILABLE is hardcoded false, and nothing imports this file from
// routes/. It exists so the scope/release decision (D05, PHASE2_DECISIONS.md) can be answered
// against a concrete, reviewable, testable contract instead of a prose description -- not so an
// export can be requested by anyone yet.
//
// "Whole rows" are never the unit here: every field is named individually, with its own source,
// ownership predicate, transformation and omission rationale, so a reviewer can accept or reject one
// field without accepting the shape of an entire table.

export const BUYER_EXPORT_CONTRACT_VERSION = 'v1-draft-not-yet-approved';

/** This must stay false until the owner accepts an export scope (D05.1) AND a release/verification
 *  design (D05.2-3). Flipping it is a policy activation, not a code change this module should do
 *  for itself -- keeping the constant here, checked by name in its own test, makes an accidental
 *  flip a one-line, reviewable diff rather than a buried conditional. */
export const BUYER_EXPORT_GENERATION_AVAILABLE = false as const;

export type ExportTransformation = 'verbatim' | 'redacted' | 'omitted';

export interface ExportFieldSpec {
  field: string;
  /** Exact table.column this field is read from. Never a table name alone. */
  canonicalSource: string;
  /** The predicate that proves this row belongs to the requesting buyer -- always keyed off the
   *  session's own buyerAccountId, never a client-supplied id (matching every other buyer route's
   *  established discipline in this codebase). */
  ownershipPredicate: string;
  transformation: ExportTransformation;
  /** Required when transformation is 'omitted' or 'redacted' -- why, not just that. */
  rationale?: string;
  nullBehavior: 'omit_key' | 'null_value';
  since: string;
}

export type ExportSectionName = 'profile' | 'addresses' | 'authored_requests' | 'orders';

export interface ExportSectionSpec {
  section: ExportSectionName;
  fields: ExportFieldSpec[];
}

const V1 = BUYER_EXPORT_CONTRACT_VERSION;

/** Proposed scope only (D05.1) -- see SECURITY_ACCEPTANCE.md / PHASE2_DECISIONS.md for the
 *  classification reasoning. Every excluded field names why, so "excluded" is never silent. */
export const BUYER_EXPORT_CONTRACT: readonly ExportSectionSpec[] = [
  {
    section: 'profile',
    fields: [
      { field: 'email', canonicalSource: 'buyer_accounts.email', ownershipPredicate: 'buyer_accounts.id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'full_name', canonicalSource: 'buyer_accounts.full_name', ownershipPredicate: 'buyer_accounts.id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'null_value', since: V1 },
      { field: 'phone', canonicalSource: 'buyer_accounts.phone', ownershipPredicate: 'buyer_accounts.id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'null_value', since: V1 },
      { field: 'status', canonicalSource: 'buyer_accounts.status', ownershipPredicate: 'buyer_accounts.id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'created_at', canonicalSource: 'buyer_accounts.created_at', ownershipPredicate: 'buyer_accounts.id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'password_hash', canonicalSource: 'buyer_accounts.password_hash', ownershipPredicate: 'buyer_accounts.id = :buyerAccountId', transformation: 'omitted', rationale: 'credential/security material, not personal data the access right discloses', nullBehavior: 'omit_key', since: V1 },
      { field: 'session_epoch', canonicalSource: 'buyer_accounts.session_epoch', ownershipPredicate: 'buyer_accounts.id = :buyerAccountId', transformation: 'omitted', rationale: 'session-control state, not personal data', nullBehavior: 'omit_key', since: V1 },
    ],
  },
  {
    section: 'addresses',
    fields: [
      { field: 'label', canonicalSource: 'buyer_addresses.label', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'null_value', since: V1 },
      { field: 'full_name', canonicalSource: 'buyer_addresses.full_name', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'phone', canonicalSource: 'buyer_addresses.phone', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'null_value', since: V1 },
      { field: 'address_line1', canonicalSource: 'buyer_addresses.address_line1', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'address_line2', canonicalSource: 'buyer_addresses.address_line2', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'null_value', since: V1 },
      { field: 'city', canonicalSource: 'buyer_addresses.city', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'state', canonicalSource: 'buyer_addresses.state', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'postal_code', canonicalSource: 'buyer_addresses.postal_code', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'country', canonicalSource: 'buyer_addresses.country', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'null_value', since: V1 },
      { field: 'is_default', canonicalSource: 'buyer_addresses.is_default', ownershipPredicate: 'buyer_addresses.buyer_account_id = :buyerAccountId', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
    ],
  },
  {
    section: 'authored_requests',
    fields: [
      { field: 'ticket_reference', canonicalSource: 'support_tickets.ticket_ref', ownershipPredicate: 'support_tickets.requester_user_id = :buyerAccountId AND support_tickets.requester_type = customer', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'topic', canonicalSource: 'support_tickets.topic', ownershipPredicate: 'support_tickets.requester_user_id = :buyerAccountId AND support_tickets.requester_type = customer', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'created_at', canonicalSource: 'support_tickets.created_at', ownershipPredicate: 'support_tickets.requester_user_id = :buyerAccountId AND support_tickets.requester_type = customer', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'authored_messages', canonicalSource: 'ticket_messages.body', ownershipPredicate: 'ticket_messages.ticket_id IN (buyer\'s own tickets) AND ticket_messages.author_type = requester', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'agent_notes', canonicalSource: 'ticket_messages.body (author_type=agent, visibility=internal)', ownershipPredicate: 'n/a', transformation: 'omitted', rationale: 'the platform\'s/merchant\'s own internal operational content, not the buyer\'s authored data', nullBehavior: 'omit_key', since: V1 },
    ],
  },
  {
    // Corrected against the REAL orders/order_items schema (Mandate 7, Section 12) -- the v1 draft
    // above guessed `total_minor`/`product_name`/`price_minor`, none of which exist. orders stores
    // money as `total numeric(12,2)` (decimal rupees, not a *_minor bigint -- a pre-canonicalization
    // column, not this contract's concern to fix) and order_items uses `name`/`price`/`quantity`.
    section: 'orders',
    fields: [
      { field: 'order_reference', canonicalSource: 'orders.order_number', ownershipPredicate: 'orders.id IN (SELECT order_id FROM buyer_order_links WHERE buyer_account_id = :buyerAccountId)', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'status', canonicalSource: 'orders.status', ownershipPredicate: 'same as order_reference', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'total', canonicalSource: 'orders.total', ownershipPredicate: 'same as order_reference', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'currency', canonicalSource: 'orders.currency', ownershipPredicate: 'same as order_reference', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'created_at', canonicalSource: 'orders.created_at', ownershipPredicate: 'same as order_reference', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'items', canonicalSource: 'order_items (name, quantity, price, total) WHERE order_id = orders.id', ownershipPredicate: 'same as order_reference', transformation: 'verbatim', nullBehavior: 'omit_key', since: V1 },
      { field: 'notes', canonicalSource: 'orders.notes', ownershipPredicate: 'n/a', transformation: 'omitted', rationale: 'a real, free-text merchant-internal notes column on the order itself -- merchant-internal operational data, not the buyer\'s own authored or commerce data', nullBehavior: 'omit_key', since: V1 },
      { field: 'payment_id', canonicalSource: 'orders.payment_id', ownershipPredicate: 'n/a', transformation: 'omitted', rationale: 'a provider-side payment reference; treated as security-adjacent operational data pending an explicit decision, not the buyer\'s own authored content', nullBehavior: 'omit_key', since: V1 },
    ],
  },
];

export interface ExportGenerationRequest {
  requestingBuyerAccountId: string;
  requestId: string;
}

export interface ExportResult {
  contractVersion: string;
  requestId: string;
  buyerAccountId: string;
  generatedAt: string;
  sections: Record<ExportSectionName, Record<string, unknown>[]>;
  /** Explicit partial-failure signal -- a partial export must never be reported as success by a
   *  caller that only checks for a 200/truthy result without reading this. */
  complete: boolean;
  incompleteSections?: ExportSectionName[];
}

export interface SyntheticSourceData {
  profile?: Record<string, unknown> & { id: string };
  addresses?: (Record<string, unknown> & { buyer_account_id: string })[];
  authoredRequests?: (Record<string, unknown> & { requester_user_id: string })[];
  orders?: (Record<string, unknown> & { buyer_account_id: string })[];
}

/** `canonicalSource` is authoritative for what to READ; `field` is only the output name. A simple
 *  `table.column` source (the common case) names its own row key after the column, which can
 *  legitimately differ from the buyer-facing `field` name (e.g. `ticket_ref` -> `ticket_reference`).
 *  A compound/descriptive source (a join, a WHERE clause, a parenthetical column list) has no single
 *  column to extract, so those fall back to `field` itself as the row key -- matching how this
 *  module's own synthetic fixtures are shaped for those rows today. */
function sourceRowKey(spec: ExportFieldSpec): string {
  const simpleColumn = /^[a-zA-Z_][a-zA-Z0-9_]*\.([a-zA-Z_][a-zA-Z0-9_]*)$/.exec(spec.canonicalSource);
  return simpleColumn ? simpleColumn[1] : spec.field;
}

function applyFieldSpec(fields: ExportFieldSpec[], row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const spec of fields) {
    if (spec.transformation === 'omitted') continue;
    const sourceKey = sourceRowKey(spec);
    const value = row[sourceKey];
    if (value === undefined || value === null) {
      if (spec.nullBehavior === 'null_value') out[spec.field] = null;
      continue;
    }
    out[spec.field] = spec.transformation === 'redacted' ? '[redacted]' : value;
  }
  return out;
}

/**
 * Pure, deterministic generator over SYNTHETIC fixtures only -- there is no database access in
 * this file. A real implementation would replace `source` with actual scoped queries using exactly
 * the ownership predicates named in BUYER_EXPORT_CONTRACT, never a broader read. Object keys are
 * inserted in the contract's own field order, which is fixed at module load -- so two calls with
 * the same input serialize identically (checked by a dedicated test), which matters for any future
 * "did this export change" comparison.
 */
export function generateBuyerExport(
  request: ExportGenerationRequest,
  source: SyntheticSourceData,
  now: Date = new Date(),
): ExportResult {
  const sections: Record<ExportSectionName, Record<string, unknown>[]> = {
    profile: [], addresses: [], authored_requests: [], orders: [],
  };
  const incompleteSections: ExportSectionName[] = [];

  const profileSpec = BUYER_EXPORT_CONTRACT.find((s) => s.section === 'profile')!;
  if (source.profile && source.profile.id === request.requestingBuyerAccountId) {
    sections.profile = [applyFieldSpec(profileSpec.fields, source.profile)];
  } else if (source.profile) {
    // A profile row was supplied but does not belong to the requester -- never included, and
    // flagged incomplete rather than silently dropped without a trace.
    incompleteSections.push('profile');
  }

  const addressSpec = BUYER_EXPORT_CONTRACT.find((s) => s.section === 'addresses')!;
  sections.addresses = (source.addresses || [])
    .filter((row) => row.buyer_account_id === request.requestingBuyerAccountId)
    .map((row) => applyFieldSpec(addressSpec.fields, row));

  const requestSpec = BUYER_EXPORT_CONTRACT.find((s) => s.section === 'authored_requests')!;
  sections.authored_requests = (source.authoredRequests || [])
    .filter((row) => row.requester_user_id === request.requestingBuyerAccountId)
    .map((row) => applyFieldSpec(requestSpec.fields, row));

  const orderSpec = BUYER_EXPORT_CONTRACT.find((s) => s.section === 'orders')!;
  sections.orders = (source.orders || [])
    .filter((row) => row.buyer_account_id === request.requestingBuyerAccountId)
    .map((row) => applyFieldSpec(orderSpec.fields, row));

  return {
    contractVersion: BUYER_EXPORT_CONTRACT_VERSION,
    requestId: request.requestId,
    buyerAccountId: request.requestingBuyerAccountId,
    generatedAt: now.toISOString(),
    sections,
    complete: incompleteSections.length === 0,
    ...(incompleteSections.length > 0 ? { incompleteSections } : {}),
  };
}

/** Every field this contract could ever emit, for a test to assert against -- catches an
 *  accidental future addition of a raw column that was never given a spec. */
export function allEmittableFieldNames(): string[] {
  return BUYER_EXPORT_CONTRACT
    .flatMap((section) => section.fields)
    .filter((f) => f.transformation !== 'omitted')
    .map((f) => f.field);
}
