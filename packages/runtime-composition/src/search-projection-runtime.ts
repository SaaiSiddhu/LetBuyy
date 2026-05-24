export interface SearchProjectionSource {
  objectType: 'product' | 'order';
  objectId: string;
  siteId: string;
  sourceEventId: string;
  title: string;
  subtitle?: string | null;
  textParts: Array<string | number | null | undefined | string[]>;
  attributes: Record<string, unknown>;
  status: 'active' | 'hidden' | 'deleted';
  deletedAt?: string | null;
}

export interface SearchProjectionDocument {
  site_id: string;
  object_type: 'product' | 'order';
  object_id: string;
  title: string;
  subtitle?: string | null;
  searchable_text: string;
  attributes: Record<string, unknown>;
  source_event_id: string;
  status: 'active' | 'hidden' | 'deleted';
  indexed_at: string;
  deleted_at?: string | null;
}

export interface ProductSearchProjectionInput {
  id: string;
  store_id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  category?: string | null;
  product_type?: string | null;
  vendor?: string | null;
  tags?: string[] | null;
  status?: string | null;
  is_active?: boolean | null;
  price?: number | string | null;
  deleted_at?: string | null;
}

export interface OrderSearchProjectionInput {
  id: string;
  store_id: string;
  order_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status?: string | null;
  total?: number | string | null;
  deleted_at?: string | null;
}

export interface AnalyticsRollupIncrementPlan {
  siteId: string;
  metricName: string;
  date: string;
  dimensions: Record<string, unknown>;
  increment: 1;
}

export interface AnalyticsEventStreamInput {
  siteId: string;
  eventId: string;
  eventType: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  occurredAt: string;
  requestId?: string | null;
  traceId?: string | null;
  idempotencyKey: string;
  schemaVersion: number;
  properties: Record<string, unknown>;
}

export interface AnalyticsEventStreamRecord {
  site_id: string;
  event_id: string;
  event_type: string;
  aggregate_type: string | null;
  aggregate_id: string | null;
  occurred_at: string;
  request_id: string | null;
  trace_id: string | null;
  idempotency_key: string;
  schema_version: number;
  properties: Record<string, unknown>;
}

export function normalizeQueueEnvelope<TEnvelope>(payload: Record<string, unknown>): TEnvelope {
  return payload as TEnvelope;
}

export function analyticsRollupDate(occurredAt?: string): string {
  const date = occurredAt ? new Date(occurredAt) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function buildSearchableText(...parts: Array<string | number | null | undefined | string[]>): string {
  return parts
    .flatMap((part) => Array.isArray(part) ? part : [part])
    .filter((part): part is string | number => part !== null && part !== undefined && String(part).length > 0)
    .map((part) => String(part))
    .join(' ');
}

export function buildSearchProjectionDocument(source: SearchProjectionSource): SearchProjectionDocument {
  const now = new Date().toISOString();

  return {
    site_id: source.siteId,
    object_type: source.objectType,
    object_id: source.objectId,
    title: source.title,
    subtitle: source.subtitle || null,
    searchable_text: buildSearchableText(...source.textParts),
    attributes: source.attributes,
    source_event_id: source.sourceEventId,
    status: source.status,
    indexed_at: now,
    deleted_at: source.deletedAt ?? null,
  };
}

export function planProductSearchProjectionDocument(
  product: ProductSearchProjectionInput,
  sourceEventId: string,
): SearchProjectionDocument {
  const status = product.deleted_at || product.is_active === false || product.status === 'draft'
    ? 'hidden'
    : 'active';

  return buildSearchProjectionDocument({
    siteId: product.store_id,
    objectType: 'product',
    objectId: product.id,
    title: product.name || '',
    subtitle: product.sku || product.category || null,
    textParts: [
      product.name,
      product.description,
      product.sku,
      product.category,
      product.product_type,
      product.vendor,
      product.tags,
    ],
    attributes: {
      price: product.price,
      category: product.category,
      product_type: product.product_type,
      vendor: product.vendor,
      tags: product.tags || [],
    },
    sourceEventId,
    status,
  });
}

export function planOrderSearchProjectionDocument(
  order: OrderSearchProjectionInput,
  sourceEventId: string,
): SearchProjectionDocument {
  return buildSearchProjectionDocument({
    siteId: order.store_id,
    objectType: 'order',
    objectId: order.id,
    title: order.order_number || order.id,
    subtitle: order.customer_email || null,
    textParts: [
      order.order_number,
      order.customer_name,
      order.customer_email,
      order.status,
      order.total,
    ],
    attributes: {
      status: order.status,
      total: order.total,
      customer_email: order.customer_email,
    },
    sourceEventId,
    status: order.deleted_at ? 'deleted' : 'active',
    deletedAt: order.deleted_at || null,
  });
}

export function planDeletedSearchProjectionDocument(
  siteId: string,
  objectType: 'product' | 'order',
  objectId: string,
  sourceEventId: string,
): SearchProjectionDocument {
  return buildSearchProjectionDocument({
    siteId,
    objectType,
    objectId,
    title: objectId,
    textParts: [objectId],
    attributes: {},
    sourceEventId,
    status: 'deleted',
    deletedAt: new Date().toISOString(),
  });
}

export function planAnalyticsRollupIncrements(input: {
  siteId: string;
  eventType: string;
  occurredAt?: string;
  aggregateType?: string | null;
}): AnalyticsRollupIncrementPlan[] {
  const date = analyticsRollupDate(input.occurredAt);
  return [
    {
      siteId: input.siteId,
      metricName: 'events.total',
      date,
      dimensions: {},
      increment: 1,
    },
    {
      siteId: input.siteId,
      metricName: `events.${input.eventType}`,
      date,
      dimensions: { aggregate_type: input.aggregateType || null },
      increment: 1,
    },
  ];
}

export function planAnalyticsEventStreamRecord(input: AnalyticsEventStreamInput): AnalyticsEventStreamRecord {
  return {
    site_id: input.siteId,
    event_id: input.eventId,
    event_type: input.eventType,
    aggregate_type: input.aggregateType || null,
    aggregate_id: input.aggregateId || null,
    occurred_at: input.occurredAt,
    request_id: input.requestId || null,
    trace_id: input.traceId || null,
    idempotency_key: input.idempotencyKey,
    schema_version: input.schemaVersion,
    properties: input.properties,
  };
}
