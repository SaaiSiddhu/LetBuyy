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
  increment: number;
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
  aggregateId?: string | null;
  payload?: Record<string, unknown>;
}): AnalyticsRollupIncrementPlan[] {
  const date = analyticsRollupDate(input.occurredAt);
  const plans: AnalyticsRollupIncrementPlan[] = [
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

  if (input.eventType === 'order.created') {
    plans.push({
      siteId: input.siteId,
      metricName: 'orders.created',
      date,
      dimensions: {},
      increment: 1,
    });
    plans.push({
      siteId: input.siteId,
      metricName: 'orders.status',
      date,
      dimensions: { status: 'created' },
      increment: 1,
    });
  }

  if (input.eventType === 'order.paid') {
    plans.push({
      siteId: input.siteId,
      metricName: 'orders.paid',
      date,
      dimensions: {},
      increment: 1,
    });
    plans.push({
      siteId: input.siteId,
      metricName: 'orders.status',
      date,
      dimensions: { status: 'paid' },
      increment: 1,
    });

    const amountMinor = analyticsAmountMinor(input.payload?.total);
    if (amountMinor !== null) {
      plans.push({
        siteId: input.siteId,
        metricName: 'revenue.paid_minor',
        date,
        dimensions: { currency: 'INR' },
        increment: amountMinor,
      });
    }
  }

  const status = orderStatusFromEventType(input.eventType);
  if (status && status !== 'created' && status !== 'paid') {
    plans.push({
      siteId: input.siteId,
      metricName: 'orders.status',
      date,
      dimensions: { status },
      increment: 1,
    });
  }

  if (input.eventType === 'media.processed') {
    plans.push({
      siteId: input.siteId,
      metricName: 'media.processed',
      date,
      dimensions: {
        content_type: typeof input.payload?.content_type === 'string' ? input.payload.content_type : null,
      },
      increment: 1,
    });

    const sizeBytes = analyticsPositiveNumber(input.payload?.size_bytes, 0);
    if (sizeBytes > 0) {
      plans.push({
        siteId: input.siteId,
        metricName: 'media.size_bytes',
        date,
        dimensions: {},
        increment: sizeBytes,
      });
    }
  }

  const storefrontKind = storefrontAnalyticsKind(input.eventType, input.payload);
  if (storefrontKind) {
    const sampleWeight = analyticsPositiveNumber(input.payload?.sample_weight, 1);
    const source = analyticsDimension(input.payload?.source, 'direct');
    const referrer = analyticsDimension(input.payload?.referrer, null);
    const campaign = analyticsDimension(input.payload?.campaign, null);
    const medium = analyticsDimension(input.payload?.medium, null);
    const sourceDimensions = { source, referrer, campaign, medium };

    if (storefrontKind === 'session_started') {
      plans.push({
        siteId: input.siteId,
        metricName: 'storefront.sessions.started',
        date,
        dimensions: sourceDimensions,
        increment: sampleWeight,
      });
      plans.push({
        siteId: input.siteId,
        metricName: 'storefront.sessions.active',
        date,
        dimensions: {
          session_id: analyticsDimension(input.payload?.session_id, null),
          source,
        },
        increment: sampleWeight,
      });
      plans.push({
        siteId: input.siteId,
        metricName: 'storefront.traffic.source',
        date,
        dimensions: sourceDimensions,
        increment: sampleWeight,
      });

      const device = analyticsDimension(input.payload?.device, null);
      if (device) {
        plans.push({
          siteId: input.siteId,
          metricName: 'storefront.session.device',
          date,
          dimensions: { device },
          increment: sampleWeight,
        });
      }

      const country = analyticsDimension(input.payload?.country, null);
      if (country) {
        plans.push({
          siteId: input.siteId,
          metricName: 'storefront.session.country',
          date,
          dimensions: { country },
          increment: sampleWeight,
        });
      }
    }

    if (storefrontKind === 'page_view' || storefrontKind === 'product_view') {
      plans.push({
        siteId: input.siteId,
        metricName: 'storefront.page.views',
        date,
        dimensions: {
          path: analyticsDimension(input.payload?.path, '/'),
          page_title: analyticsDimension(input.payload?.page_title, null),
          source,
          referrer,
        },
        increment: sampleWeight,
      });
    }

    if (storefrontKind === 'product_view') {
      plans.push({
        siteId: input.siteId,
        metricName: 'storefront.product.views',
        date,
        dimensions: {
          product_id: analyticsDimension(input.payload?.product_id, input.aggregateId || null),
          product_slug: analyticsDimension(input.payload?.product_slug, null),
          source,
        },
        increment: sampleWeight,
      });
    }

    if (storefrontKind === 'cart_add') {
      plans.push({
        siteId: input.siteId,
        metricName: 'storefront.cart.added',
        date,
        dimensions: sourceDimensions,
        increment: sampleWeight,
      });
    }

    if (storefrontKind === 'checkout_started') {
      plans.push({
        siteId: input.siteId,
        metricName: 'storefront.checkouts.started',
        date,
        dimensions: sourceDimensions,
        increment: sampleWeight,
      });
    }
  }

  return plans;
}

export interface OrderItemAnalyticsRollupInput {
  productId?: string | null;
  name?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  total?: number | string | null;
}

export function planOrderItemAnalyticsRollupIncrements(input: {
  siteId: string;
  occurredAt?: string;
  items: OrderItemAnalyticsRollupInput[];
}): AnalyticsRollupIncrementPlan[] {
  const date = analyticsRollupDate(input.occurredAt);
  const plans: AnalyticsRollupIncrementPlan[] = [];

  for (const item of input.items) {
    if (!item.productId) continue;

    const quantity = analyticsPositiveNumber(item.quantity, 1);
    const dimensions = {
      product_id: item.productId,
      product_name: item.name || item.productId,
      sku: item.sku || null,
    };

    plans.push({
      siteId: input.siteId,
      metricName: 'product.units_sold',
      date,
      dimensions,
      increment: quantity,
    });

    const revenueMinor = analyticsMajorToMinor(item.total);
    if (revenueMinor !== null) {
      plans.push({
        siteId: input.siteId,
        metricName: 'product.revenue_minor',
        date,
        dimensions,
        increment: revenueMinor,
      });
    }
  }

  return plans;
}

function orderStatusFromEventType(eventType: string): string | null {
  switch (eventType) {
    case 'order.fulfilled':
      return 'fulfilled';
    case 'order.cancelled':
      return 'cancelled';
    case 'order.refunded':
      return 'refunded';
    default:
      return null;
  }
}

function analyticsAmountMinor(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const amount = (value as Record<string, unknown>).amount_minor;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount);
}

function analyticsPositiveNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return fallback;
  return Math.max(1, Math.trunc(numberValue));
}

function analyticsDimension(value: unknown, fallback: string | null): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 240) : fallback;
}

function storefrontAnalyticsKind(
  eventType: string,
  payload?: Record<string, unknown>,
): 'session_started' | 'page_view' | 'product_view' | 'cart_add' | 'checkout_started' | null {
  const explicit = typeof payload?.storefront_event_type === 'string' ? payload.storefront_event_type : null;
  switch (explicit || eventType) {
    case 'session_started':
    case 'storefront.session_started':
    case 'storefront.session.started':
      return 'session_started';
    case 'page_view':
    case 'storefront.page_view':
    case 'storefront.page.view':
      return 'page_view';
    case 'product_view':
    case 'storefront.product_view':
    case 'storefront.product.view':
    case 'product.viewed':
      return 'product_view';
    case 'cart_add':
    case 'storefront.cart_add':
    case 'storefront.cart.added':
      return 'cart_add';
    case 'checkout_started':
    case 'storefront.checkout_started':
    case 'storefront.checkout.started':
      return 'checkout_started';
    default:
      return null;
  }
}

function analyticsMajorToMinor(value: unknown): number | null {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return null;
  return Math.round(numberValue * 100);
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
