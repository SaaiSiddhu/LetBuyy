import { z } from 'zod';

export * from './queue-projection-plans';

export const DispatchOutboxSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  webhook_limit: z.number().int().min(1).max(100).optional(),
});

export const DispatchWebhookDeliveriesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});

export const ConsumeQueueJobsSchema = z.object({
  queue_name: z.enum(['analytics-events', 'search-indexing', 'payment-events']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const OperationsListQuerySchema = z.object({
  status: z.string().max(40).optional(),
  site_id: z.string().uuid().optional(),
  queue_name: z.string().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const MarketplaceReviewListQuerySchema = z.object({
  status: z.enum(['pending', 'in_review', 'approved', 'rejected', 'changes_requested']).optional(),
  submission_type: z.enum(['app', 'theme']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const MarketplaceReviewDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'changes_requested']),
  reason: z.string().trim().max(2000).optional(),
});

export const CreateWebhookSubscriptionSchema = z.object({
  site_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  target_url: z.string().url().refine((value) => value.startsWith('https://'), {
    message: 'target_url must use HTTPS',
  }),
  event_types: z.array(z.string().trim().min(1).max(120)).min(1).max(100).default(['*']),
  signing_secret: z.string().min(32).max(256),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateWebhookSubscriptionSchema = z.object({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
  event_types: z.array(z.string().trim().min(1).max(120)).min(1).max(100).optional(),
  target_url: z.string().url().refine((value) => value.startsWith('https://'), {
    message: 'target_url must use HTTPS',
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const RecordUsageSchema = z.object({
  site_id: z.string().uuid(),
  meter_name: z.string().trim().min(1).max(120),
  amount: z.number().finite(),
  idempotency_key: z.string().trim().min(8).max(200),
  source: z.string().trim().min(1).max(80).optional(),
  resource_type: z.string().trim().min(1).max(80).optional(),
  resource_id: z.string().trim().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const JsonRecordSchema = z.record(z.string(), z.unknown());

const UuidSchema = z.string().uuid();
const InrMinorUnitsSchema = z.object({
  amount_minor: z.number().int().nonnegative(),
  currency: z.literal('INR').default('INR'),
});

export const DOMAIN_EVENT_TYPES = [
  'store.created',
  'product.created',
  'product.updated',
  'product.deleted',
  'cart.created',
  'cart.email_captured',
  'cart.abandoned',
  'checkout.started',
  'checkout.completed',
  'checkout.failed',
  'order.created',
  'order.paid',
  'order.confirmed_cod',
  'order.fulfilled',
  'order.delivered',
  'order.cancelled',
  'order.rto',
  'order.returned',
  'order.refunded',
  'order.risk_assessed',
  'cod.confirmation_requested',
  'cod.confirmed',
  'payment.authorized',
  'payment.pending',
  'app.installed',
  'app.uninstalled',
  'app.submitted',
  'app.approved',
  'app.rejected',
  'app.charge.created',
  'app.charge.activated',
  'theme.submitted',
  'theme.approved',
  'theme.rejected',
  'theme.installed',
  'theme.purchase.payment_order_created',
  'theme.purchase.completed',
  'theme.draft.saved',
  'theme.draft.discarded',
  'payment.captured',
  'payment.failed',
  'payment.refunded',
  'refund.created',
  'inventory.reserved',
  'inventory.committed',
  'inventory.released',
  'inventory.low',
  'shipment.created',
  'shipment.out_for_delivery',
  'shipment.delivered',
  'shipment.rto',
  'discount.redeemed',
  'tax.invoice_generated',
  'notification.sent',
  'notification.failed',
  'email.delivered',
  'email.bounced',
  'email.complained',
  'wa.message_received',
  'wa.cod_confirmed',
  'settlement.recorded',
  'settlement.recon.break_detected',
  'payout.scheduled',
  'payout.paid',
  'payment.subscription.activated',
  'billing.charged',
  'billing.failed',
  'billing.plan_changed',
  'auth.login',
  'auth.stepup',
  'customer.created',
  'customer.updated',
  'customer.dsr_requested',
  'media.processed',
  'audit.recorded',
  'payout.ledger_entry.created',
  'payout.released',
  'payout.failed',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export type DomainEventProducer =
  | 'api-gateway'
  | 'identity-platform'
  | 'admin-web'
  | 'platform-operations-portal'
  | 'app-marketplace'
  | 'theme-marketplace'
  | 'customer-web'
  | 'queue-workers'
  | 'webhook-service';

export type DomainEventConsumer =
  | 'analytics'
  | 'search-indexing'
  | 'notifications'
  | 'payout-ledger'
  | 'webhook-service';

export interface DomainEventContract {
  eventType: DomainEventType;
  schemaVersion: 1;
  producer: DomainEventProducer;
  consumers: readonly DomainEventConsumer[];
  aggregateType:
    | 'store'
    | 'product'
    | 'cart'
    | 'checkout'
    | 'order'
    | 'payment'
    | 'inventory'
    | 'shipment'
    | 'discount'
    | 'tax'
    | 'notification'
    | 'email'
    | 'whatsapp'
    | 'settlement'
    | 'billing'
    | 'customer'
    | 'auth'
    | 'media'
    | 'audit'
    | 'app'
    | 'app_charge'
    | 'theme'
    | 'theme_purchase'
    | 'theme_draft'
    | 'subscription'
    | 'payout';
  payloadSchema: z.ZodType<unknown>;
  implementationStatus?: 'active' | 'reserved-human-gated';
  reservedReason?: string;
}

const StoreCreatedPayloadSchema = z.object({
  site_id: UuidSchema,
  store_slug: z.string().trim().min(1).max(120),
  owner_user_id: UuidSchema,
  plan_code: z.string().trim().min(1).max(80).optional(),
});

const ProductPayloadSchema = z.object({
  site_id: UuidSchema,
  product_id: UuidSchema,
  handle: z.string().trim().min(1).max(160).optional(),
  status: z.enum(['draft', 'active', 'archived', 'deleted']).optional(),
});

const OrderPayloadSchema = z.object({
  site_id: UuidSchema,
  order_id: UuidSchema,
  order_number: z.string().trim().min(1).max(120).optional(),
  customer_id: UuidSchema.optional(),
  total: InrMinorUnitsSchema.optional(),
});

const GenericSiteEventPayloadSchema = z.object({
  site_id: UuidSchema,
}).passthrough();

const CartPayloadSchema = GenericSiteEventPayloadSchema.extend({
  cart_id: UuidSchema,
  channel: z.enum(['web', 'whatsapp', 'instagram', 'pos', 'api']).optional(),
});

const CheckoutPayloadSchema = GenericSiteEventPayloadSchema.extend({
  checkout_id: UuidSchema,
  cart_id: UuidSchema.optional(),
});

const InventoryPayloadSchema = GenericSiteEventPayloadSchema.extend({
  variant_id: UuidSchema.optional(),
  reservation_id: UuidSchema.optional(),
  quantity: z.number().int().optional(),
});

const ShipmentPayloadSchema = GenericSiteEventPayloadSchema.extend({
  shipment_id: UuidSchema,
  order_id: UuidSchema.optional(),
  awb: z.string().trim().min(1).max(160).optional(),
});

const NotificationPayloadSchema = GenericSiteEventPayloadSchema.extend({
  notification_id: UuidSchema,
  channel: z.enum(['email', 'sms', 'whatsapp', 'push', 'webhook']).optional(),
});

const EmailPayloadSchema = GenericSiteEventPayloadSchema.extend({
  email_id: UuidSchema,
  template_key: z.string().trim().min(1).max(160),
  provider: z.string().trim().min(1).max(80).optional(),
  recipient_hash: z.string().trim().min(1).max(160).optional(),
});

const WhatsappPayloadSchema = GenericSiteEventPayloadSchema.extend({
  message_id: z.string().trim().min(1).max(200).optional(),
  order_id: UuidSchema.optional(),
});

const SettlementPayloadSchema = GenericSiteEventPayloadSchema.extend({
  settlement_id: UuidSchema.optional(),
  payout_id: UuidSchema.optional(),
  amount: InrMinorUnitsSchema.optional(),
});

const BillingPayloadSchema = GenericSiteEventPayloadSchema.extend({
  subscription_id: UuidSchema.optional(),
  invoice_id: UuidSchema.optional(),
  amount: InrMinorUnitsSchema.optional(),
});

const CustomerPayloadSchema = GenericSiteEventPayloadSchema.extend({
  customer_id: UuidSchema,
});

const MediaPayloadSchema = GenericSiteEventPayloadSchema.extend({
  media_id: UuidSchema,
  asset_id: UuidSchema.optional(),
  object_key: z.string().trim().min(1).max(512).optional(),
  content_type: z.string().trim().min(1).max(160).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
});

const AppInstallationPayloadSchema = z.object({
  site_id: UuidSchema,
  app_id: UuidSchema,
  installation_id: UuidSchema,
  partner_id: UuidSchema.optional(),
  scopes: z.array(z.string().trim().min(1).max(80)).default([]),
});

const AppReviewPayloadSchema = z.object({
  app_id: UuidSchema,
  partner_id: UuidSchema,
  review_id: UuidSchema.optional(),
  reviewer_id: UuidSchema.optional(),
});

const AppChargePayloadSchema = z.object({
  site_id: UuidSchema,
  app_id: UuidSchema,
  installation_id: UuidSchema,
  charge_id: UuidSchema,
  billing_mode: z.enum(['recurring', 'one_time', 'usage']),
  amount: InrMinorUnitsSchema,
  payout_rail: z.enum(['razorpay_route', 'upi', 'manual']).default('razorpay_route'),
  provider_reference: z.string().trim().min(1).max(200).optional(),
  provider_mode: z.enum(['sandbox', 'live']).default('sandbox'),
  revenue_share_bps: z.number().int().min(0).max(10000).default(8500),
  partner_gst_bps: z.number().int().min(0).max(10000).default(1800),
  partner_gst_minor: z.number().int().nonnegative().default(0),
});

const ThemeReviewPayloadSchema = z.object({
  theme_package_id: UuidSchema,
  theme_version_id: UuidSchema,
  partner_id: UuidSchema,
  review_id: UuidSchema.optional(),
  reviewer_id: UuidSchema.optional(),
});

const ThemeInstalledPayloadSchema = z.object({
  site_id: UuidSchema,
  theme_package_id: UuidSchema,
  theme_version_id: UuidSchema,
  installation_id: UuidSchema,
});

const ThemePurchaseOrderCreatedPayloadSchema = z.object({
  theme_id: UuidSchema,
  theme_slug: z.string().trim().min(1).max(160),
  provider: z.literal('razorpay'),
  provider_order_id: z.string().trim().min(1).max(200),
  amount: z.number().int().nonnegative(),
  currency: z.literal('INR').default('INR'),
});

const ThemePurchaseCompletedPayloadSchema = z.object({
  theme_id: UuidSchema,
  theme_slug: z.string().trim().min(1).max(160),
  provider: z.literal('razorpay'),
  provider_order_id: z.string().trim().min(1).max(200),
  provider_payment_id: z.string().trim().min(1).max(200),
});

const ThemeDraftPayloadSchema = z.object({
  store_id: UuidSchema,
  theme_id: z.string().trim().min(1).max(160),
  template_key: z.string().trim().min(1).max(160),
  draft_id: UuidSchema,
  version: z.number().int().positive(),
  theme_instance_id: UuidSchema.nullable().optional(),
  theme_package_version_id: UuidSchema.nullable().optional(),
  theme_instance_draft_id: UuidSchema.nullable().optional(),
  client: z.string().trim().min(1).max(80).optional(),
});

const PaymentProviderSchema = z.enum(['razorpay', 'stripe', 'paypal', 'cashfree']);

const PaymentOrderPayloadSchema = z.object({
  provider: PaymentProviderSchema,
  provider_event_id: z.string().trim().min(1).max(240),
  provider_event_type: z.string().trim().min(1).max(240).optional(),
  order_id: UuidSchema,
  payment_id: z.string().trim().min(1).max(240).nullable().optional(),
  payment_status: z.enum(['authorized', 'pending', 'paid', 'failed', 'refunded']).optional(),
  reason: z.string().trim().max(500).nullable().optional(),
});

const RefundPayloadSchema = z.object({
  provider: PaymentProviderSchema,
  provider_event_id: z.string().trim().min(1).max(240),
  provider_event_type: z.string().trim().min(1).max(240).optional(),
  order_id: UuidSchema,
  payment_status: z.literal('refunded').default('refunded'),
});

const PaymentSubscriptionActivatedPayloadSchema = z.object({
  provider: PaymentProviderSchema,
  provider_event_id: z.string().trim().min(1).max(240),
  provider_event_type: z.string().trim().min(1).max(240).optional(),
  store_id: UuidSchema,
  subscription_id: UuidSchema.nullable().optional(),
  plan_slug: z.string().trim().min(1).max(120),
  billing_period: z.enum(['monthly', 'yearly']).default('monthly'),
  payment_id: z.string().trim().min(1).max(240).nullable().optional(),
});

const PayoutPayloadSchema = z.object({
  partner_id: UuidSchema,
  payout_id: UuidSchema,
  ledger_entry_id: UuidSchema.optional(),
  amount: InrMinorUnitsSchema,
  rail: z.enum(['razorpay_route', 'upi', 'manual']).default('manual'),
});

function activeGatewayContract(
  eventType: DomainEventType,
  aggregateType: DomainEventContract['aggregateType'],
  payloadSchema: z.ZodType<unknown> = GenericSiteEventPayloadSchema,
  consumers: readonly DomainEventConsumer[] = ['analytics', 'notifications', 'webhook-service'],
): DomainEventContract {
  return {
    eventType,
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers,
    aggregateType,
    payloadSchema,
  };
}

export const DOMAIN_EVENT_CONTRACTS: Record<DomainEventType, DomainEventContract> = {
  'store.created': {
    eventType: 'store.created',
    schemaVersion: 1,
    producer: 'identity-platform',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'store',
    payloadSchema: StoreCreatedPayloadSchema,
  },
  'product.created': {
    eventType: 'product.created',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'search-indexing', 'webhook-service'],
    aggregateType: 'product',
    payloadSchema: ProductPayloadSchema,
  },
  'product.updated': {
    eventType: 'product.updated',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'search-indexing', 'webhook-service'],
    aggregateType: 'product',
    payloadSchema: ProductPayloadSchema,
  },
  'product.deleted': {
    eventType: 'product.deleted',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'search-indexing', 'webhook-service'],
    aggregateType: 'product',
    payloadSchema: ProductPayloadSchema,
  },
  'cart.created': activeGatewayContract('cart.created', 'cart', CartPayloadSchema),
  'cart.email_captured': activeGatewayContract('cart.email_captured', 'cart', CartPayloadSchema),
  'cart.abandoned': activeGatewayContract('cart.abandoned', 'cart', CartPayloadSchema),
  'checkout.started': activeGatewayContract('checkout.started', 'checkout', CheckoutPayloadSchema),
  'checkout.completed': activeGatewayContract('checkout.completed', 'checkout', CheckoutPayloadSchema),
  'checkout.failed': activeGatewayContract('checkout.failed', 'checkout', CheckoutPayloadSchema),
  'order.created': {
    eventType: 'order.created',
    schemaVersion: 1,
    producer: 'customer-web',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.paid': {
    eventType: 'order.paid',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.confirmed_cod': activeGatewayContract('order.confirmed_cod', 'order', OrderPayloadSchema),
  'order.fulfilled': {
    eventType: 'order.fulfilled',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.delivered': activeGatewayContract('order.delivered', 'order', OrderPayloadSchema),
  'order.cancelled': {
    eventType: 'order.cancelled',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.rto': activeGatewayContract('order.rto', 'order', OrderPayloadSchema),
  'order.returned': activeGatewayContract('order.returned', 'order', OrderPayloadSchema),
  'order.refunded': {
    eventType: 'order.refunded',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: OrderPayloadSchema,
  },
  'order.risk_assessed': activeGatewayContract('order.risk_assessed', 'order', OrderPayloadSchema),
  'cod.confirmation_requested': activeGatewayContract('cod.confirmation_requested', 'order', GenericSiteEventPayloadSchema),
  'cod.confirmed': activeGatewayContract('cod.confirmed', 'order', GenericSiteEventPayloadSchema),
  'payment.authorized': activeGatewayContract('payment.authorized', 'order', PaymentOrderPayloadSchema),
  'payment.pending': activeGatewayContract('payment.pending', 'order', PaymentOrderPayloadSchema),
  'app.installed': {
    eventType: 'app.installed',
    schemaVersion: 1,
    producer: 'app-marketplace',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppInstallationPayloadSchema,
  },
  'app.uninstalled': {
    eventType: 'app.uninstalled',
    schemaVersion: 1,
    producer: 'app-marketplace',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppInstallationPayloadSchema,
  },
  'app.submitted': {
    eventType: 'app.submitted',
    schemaVersion: 1,
    producer: 'admin-web',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppReviewPayloadSchema,
  },
  'app.approved': {
    eventType: 'app.approved',
    schemaVersion: 1,
    producer: 'platform-operations-portal',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppReviewPayloadSchema,
  },
  'app.rejected': {
    eventType: 'app.rejected',
    schemaVersion: 1,
    producer: 'platform-operations-portal',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app',
    payloadSchema: AppReviewPayloadSchema,
  },
  'app.charge.created': {
    eventType: 'app.charge.created',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'app_charge',
    payloadSchema: AppChargePayloadSchema,
  },
  'app.charge.activated': {
    eventType: 'app.charge.activated',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'payout-ledger', 'webhook-service'],
    aggregateType: 'app_charge',
    payloadSchema: AppChargePayloadSchema,
  },
  'theme.submitted': {
    eventType: 'theme.submitted',
    schemaVersion: 1,
    producer: 'admin-web',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'theme',
    payloadSchema: ThemeReviewPayloadSchema,
  },
  'theme.approved': {
    eventType: 'theme.approved',
    schemaVersion: 1,
    producer: 'platform-operations-portal',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'theme',
    payloadSchema: ThemeReviewPayloadSchema,
  },
  'theme.rejected': {
    eventType: 'theme.rejected',
    schemaVersion: 1,
    producer: 'platform-operations-portal',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'theme',
    payloadSchema: ThemeReviewPayloadSchema,
  },
  'theme.installed': {
    eventType: 'theme.installed',
    schemaVersion: 1,
    producer: 'theme-marketplace',
    consumers: ['analytics', 'notifications', 'search-indexing', 'webhook-service'],
    aggregateType: 'theme',
    payloadSchema: ThemeInstalledPayloadSchema,
  },
  'theme.purchase.payment_order_created': {
    eventType: 'theme.purchase.payment_order_created',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'theme_purchase',
    payloadSchema: ThemePurchaseOrderCreatedPayloadSchema,
  },
  'theme.purchase.completed': {
    eventType: 'theme.purchase.completed',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'theme_purchase',
    payloadSchema: ThemePurchaseCompletedPayloadSchema,
  },
  'theme.draft.saved': {
    eventType: 'theme.draft.saved',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'webhook-service'],
    aggregateType: 'theme_draft',
    payloadSchema: ThemeDraftPayloadSchema,
  },
  'theme.draft.discarded': {
    eventType: 'theme.draft.discarded',
    schemaVersion: 1,
    producer: 'api-gateway',
    consumers: ['analytics', 'webhook-service'],
    aggregateType: 'theme_draft',
    payloadSchema: ThemeDraftPayloadSchema,
  },
  'payment.captured': {
    eventType: 'payment.captured',
    schemaVersion: 1,
    producer: 'webhook-service',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: PaymentOrderPayloadSchema,
  },
  'payment.failed': {
    eventType: 'payment.failed',
    schemaVersion: 1,
    producer: 'webhook-service',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: PaymentOrderPayloadSchema,
  },
  'payment.refunded': activeGatewayContract('payment.refunded', 'order', PaymentOrderPayloadSchema),
  'refund.created': {
    eventType: 'refund.created',
    schemaVersion: 1,
    producer: 'webhook-service',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'order',
    payloadSchema: RefundPayloadSchema,
  },
  'inventory.reserved': activeGatewayContract('inventory.reserved', 'inventory', InventoryPayloadSchema, ['analytics', 'webhook-service']),
  'inventory.committed': activeGatewayContract('inventory.committed', 'inventory', InventoryPayloadSchema, ['analytics', 'webhook-service']),
  'inventory.released': activeGatewayContract('inventory.released', 'inventory', InventoryPayloadSchema, ['analytics', 'webhook-service']),
  'inventory.low': activeGatewayContract('inventory.low', 'inventory', InventoryPayloadSchema),
  'shipment.created': activeGatewayContract('shipment.created', 'shipment', ShipmentPayloadSchema),
  'shipment.out_for_delivery': activeGatewayContract('shipment.out_for_delivery', 'shipment', ShipmentPayloadSchema),
  'shipment.delivered': activeGatewayContract('shipment.delivered', 'shipment', ShipmentPayloadSchema),
  'shipment.rto': activeGatewayContract('shipment.rto', 'shipment', ShipmentPayloadSchema),
  'discount.redeemed': activeGatewayContract('discount.redeemed', 'discount', GenericSiteEventPayloadSchema, ['analytics', 'webhook-service']),
  'tax.invoice_generated': activeGatewayContract('tax.invoice_generated', 'tax', GenericSiteEventPayloadSchema, ['analytics', 'webhook-service']),
  'notification.sent': activeGatewayContract('notification.sent', 'notification', NotificationPayloadSchema, ['analytics', 'webhook-service']),
  'notification.failed': activeGatewayContract('notification.failed', 'notification', NotificationPayloadSchema, ['analytics', 'webhook-service']),
  'email.delivered': activeGatewayContract('email.delivered', 'email', EmailPayloadSchema, ['analytics', 'webhook-service']),
  'email.bounced': activeGatewayContract('email.bounced', 'email', EmailPayloadSchema, ['analytics', 'webhook-service']),
  'email.complained': activeGatewayContract('email.complained', 'email', EmailPayloadSchema, ['analytics', 'webhook-service']),
  'wa.message_received': activeGatewayContract('wa.message_received', 'whatsapp', WhatsappPayloadSchema),
  'wa.cod_confirmed': activeGatewayContract('wa.cod_confirmed', 'whatsapp', WhatsappPayloadSchema),
  'settlement.recorded': activeGatewayContract('settlement.recorded', 'settlement', SettlementPayloadSchema, ['analytics', 'notifications', 'payout-ledger', 'webhook-service']),
  'settlement.recon.break_detected': activeGatewayContract('settlement.recon.break_detected', 'settlement', SettlementPayloadSchema),
  'payout.scheduled': activeGatewayContract('payout.scheduled', 'payout', PayoutPayloadSchema),
  'payout.paid': activeGatewayContract('payout.paid', 'payout', PayoutPayloadSchema),
  'payment.subscription.activated': {
    eventType: 'payment.subscription.activated',
    schemaVersion: 1,
    producer: 'webhook-service',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'subscription',
    payloadSchema: PaymentSubscriptionActivatedPayloadSchema,
  },
  'billing.charged': activeGatewayContract('billing.charged', 'billing', BillingPayloadSchema),
  'billing.failed': activeGatewayContract('billing.failed', 'billing', BillingPayloadSchema),
  'billing.plan_changed': activeGatewayContract('billing.plan_changed', 'billing', BillingPayloadSchema),
  'auth.login': activeGatewayContract('auth.login', 'auth', GenericSiteEventPayloadSchema),
  'auth.stepup': activeGatewayContract('auth.stepup', 'auth', GenericSiteEventPayloadSchema),
  'customer.created': activeGatewayContract('customer.created', 'customer', CustomerPayloadSchema),
  'customer.updated': activeGatewayContract('customer.updated', 'customer', CustomerPayloadSchema),
  'customer.dsr_requested': activeGatewayContract('customer.dsr_requested', 'customer', CustomerPayloadSchema),
  'media.processed': activeGatewayContract('media.processed', 'media', MediaPayloadSchema, ['analytics', 'webhook-service']),
  'audit.recorded': activeGatewayContract('audit.recorded', 'audit', GenericSiteEventPayloadSchema, ['analytics', 'webhook-service']),
  'payout.ledger_entry.created': {
    eventType: 'payout.ledger_entry.created',
    schemaVersion: 1,
    producer: 'queue-workers',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'payout',
    payloadSchema: PayoutPayloadSchema,
  },
  'payout.released': {
    eventType: 'payout.released',
    schemaVersion: 1,
    producer: 'queue-workers',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'payout',
    payloadSchema: PayoutPayloadSchema,
    implementationStatus: 'reserved-human-gated',
    reservedReason: 'No payout release rail or operations approval transition is implemented; live payout credentials and payout policy are human-gated.',
  },
  'payout.failed': {
    eventType: 'payout.failed',
    schemaVersion: 1,
    producer: 'queue-workers',
    consumers: ['analytics', 'notifications', 'webhook-service'],
    aggregateType: 'payout',
    payloadSchema: PayoutPayloadSchema,
    implementationStatus: 'reserved-human-gated',
    reservedReason: 'No payout failure reconciliation transition is implemented; live payout credentials and payout policy are human-gated.',
  },
};

export const DOMAIN_EVENT_PRODUCER_CONSUMER_CONTRACTS = DOMAIN_EVENT_TYPES.map((eventType) => {
  const contract = DOMAIN_EVENT_CONTRACTS[eventType];
  return {
    event_type: eventType,
    schema_version: contract.schemaVersion,
    producer: contract.producer,
    consumers: contract.consumers,
    aggregate_type: contract.aggregateType,
    implementation_status: contract.implementationStatus || 'active',
    reserved_reason: contract.reservedReason,
  };
});

export const DomainEventEnvelopeSchema = z.object({
  event_id: z.string().trim().min(8).max(160),
  event_type: z.enum(DOMAIN_EVENT_TYPES),
  source_runtime: z.string().trim().min(1).max(120),
  site_id: UuidSchema.optional(),
  aggregate_type: z.string().trim().min(1).max(80),
  aggregate_id: z.string().trim().min(1).max(160),
  occurred_at: z.string().datetime(),
  payload: JsonRecordSchema,
  request_id: z.string().trim().min(1).max(160).optional(),
  idempotency_key: z.string().trim().min(1).max(240).optional(),
  schema_version: z.number().int().positive().default(1),
});

export function getDomainEventContract(eventType: string): DomainEventContract | null {
  return DOMAIN_EVENT_TYPES.includes(eventType as DomainEventType)
    ? DOMAIN_EVENT_CONTRACTS[eventType as DomainEventType]
    : null;
}

export const RUNTIME_QUEUE_NAMES = [
  'payment-events',
  'inventory-jobs',
  'webhook-deliveries',
  'analytics-events',
  'search-indexing',
  'fulfillment-jobs',
  'bulk-admin-jobs',
] as const;

export type RuntimeQueueName = (typeof RUNTIME_QUEUE_NAMES)[number];

export interface DomainEventEnvelopeInput {
  event_id: string;
  event_type: string;
  site_id: string | null;
  aggregate_type: string;
  aggregate_id: string;
  created_at: string;
  request_id: string | null;
  trace_id: string | null;
  idempotency_key: string;
  schema_version: number;
  payload: Record<string, unknown>;
}

export function canonicalizeExecutionPayload(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalizeExecutionPayload(item)).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalizeExecutionPayload(record[key])}`)
    .join(',')}}`;
}

export function eventRetryDelaySeconds(attempt: number, baseSeconds = 30): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 8));
  return Math.min(3600, baseSeconds * 2 ** exponent);
}

export function eventMatchesSubscription(eventType: string, eventTypes: string[]): boolean {
  return eventTypes.some((candidate) => {
    if (candidate === '*') return true;
    if (candidate === eventType) return true;
    if (!candidate.endsWith('.*')) return false;
    return eventType.startsWith(candidate.slice(0, -1));
  });
}

export function queueNamesForEvent(eventType: string): RuntimeQueueName[] {
  const queues = new Set<RuntimeQueueName>();
  const contract = getDomainEventContract(eventType);

  if (contract) {
    for (const consumer of contract.consumers) {
      const queueName = queueNameForDomainEventConsumer(consumer);
      if (queueName) queues.add(queueName);
    }

    return [...queues];
  }

  if (eventType.startsWith('payment.') || eventType.startsWith('refund.')) queues.add('payment-events');
  if (eventType.startsWith('inventory.') || eventType.startsWith('po.') || eventType.startsWith('transfer.')) queues.add('inventory-jobs');
  if (eventType.startsWith('fulfillment.') || eventType.startsWith('shipment.') || eventType.startsWith('return.') || eventType.includes('.fulfillment.')) queues.add('fulfillment-jobs');
  if (eventType.startsWith('product.') || eventType.startsWith('collection.') || eventType.startsWith('category.') || eventType.startsWith('customer.') || eventType.startsWith('order.') || eventType.startsWith('theme.')) queues.add('search-indexing');

  queues.add('analytics-events');
  return [...queues];
}

function queueNameForDomainEventConsumer(consumer: DomainEventConsumer): RuntimeQueueName | null {
  switch (consumer) {
    case 'analytics':
      return 'analytics-events';
    case 'search-indexing':
      return 'search-indexing';
    case 'payout-ledger':
      return 'payment-events';
    case 'webhook-service':
    case 'notifications':
      return null;
  }
}

export function buildDomainEventEnvelope(event: DomainEventEnvelopeInput): Record<string, unknown> {
  return {
    id: event.event_id,
    type: event.event_type,
    site_id: event.site_id,
    aggregate: {
      type: event.aggregate_type,
      id: event.aggregate_id,
    },
    occurred_at: event.created_at,
    request_id: event.request_id,
    trace_id: event.trace_id,
    idempotency_key: event.idempotency_key,
    schema_version: event.schema_version,
    payload: event.payload,
  };
}

export function parseDomainEventPayload(eventType: DomainEventType, payload: unknown): Record<string, unknown> {
  const parsed = DOMAIN_EVENT_CONTRACTS[eventType].payloadSchema.parse(payload);
  return JsonRecordSchema.parse(parsed);
}

export function validateDomainEventEnvelope(input: unknown): RuntimeEventEnvelope {
  const base = DomainEventEnvelopeSchema.parse(input);
  const contract = DOMAIN_EVENT_CONTRACTS[base.event_type];

  if (base.schema_version !== contract.schemaVersion) {
    throw new Error(`Unsupported schema version ${base.schema_version} for ${base.event_type}`);
  }

  if (base.aggregate_type !== contract.aggregateType) {
    throw new Error(`Invalid aggregate type ${base.aggregate_type} for ${base.event_type}`);
  }

  return {
    event_id: base.event_id,
    event_type: base.event_type,
    source_runtime: base.source_runtime,
    site_id: base.site_id,
    aggregate_type: base.aggregate_type,
    aggregate_id: base.aggregate_id,
    occurred_at: base.occurred_at,
    payload: parseDomainEventPayload(base.event_type, base.payload),
    request_id: base.request_id,
    idempotency_key: base.idempotency_key,
  };
}

export const RuntimeQueueRecoverySchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  reason: z.string().trim().min(8).max(500),
});

export const RuntimeDeadLetterRedriveSchema = z.object({
  message_ids: z.array(z.string().trim().min(1).max(200)).max(500).default([]),
  reason: z.string().trim().min(8).max(500),
});



export const SubmitRuntimeControlCommandSchema = z.object({
  command_id: z.string().trim().min(8).max(120),
  operation: z.enum([
    'pause-queue',
    'resume-queue',
    'redrive-dead-letter',
    'cancel-workflow',
    'retry-workflow',
    'drain-worker',
    'invalidate-cache',
    'throttle-tenant',
    'release-tenant-throttle',
    'pause-provider',
    'restore-provider',
    'promote-deployment',
    'rollback-deployment',
  ]),
  target_type: z.enum([
    'queue',
    'workflow',
    'dead-letter',
    'worker',
    'cache',
    'tenant-runtime',
    'provider',
    'deployment',
  ]),
  target_id: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(8).max(500),
  secondary_approver_id: z.string().uuid().nullable().optional(),
});

export const RecordProductionIncidentSchema = z.object({
  incident_id: z.string().trim().min(8).max(120),
  title: z.string().trim().min(4).max(200),
  severity: z.enum(['sev1', 'sev2', 'sev3', 'sev4']),
  affected_runtimes: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  affected_regions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  customer_impact: z.string().trim().min(8).max(1000),
  metadata: JsonRecordSchema.default({}),
  reason: z.string().trim().min(8).max(500).optional(),
});

export const UpdateProductionIncidentStatusSchema = z.object({
  status: z.enum(['open', 'mitigating', 'resolved', 'closed']),
  summary: z.string().trim().min(4).max(500),
  details: JsonRecordSchema.default({}),
});




export const RecordDeploymentPromotionSchema = z.object({
  promotion_id: z.string().trim().min(8).max(120),
  runtime_name: z.string().trim().min(1).max(120),
  runtime_root: z.string().trim().min(1).max(200),
  environment: z.enum(['dev', 'staging', 'production']),
  strategy: z.enum(['preview', 'canary', 'blue-green', 'rollback']),
  version: z.string().trim().min(1).max(120),
  status: z.enum(['planned', 'running', 'blocked', 'promoted', 'rolled-back', 'failed']),
  health_gates: z.array(JsonRecordSchema).default([]),
});

export const RecordProductionReadinessGateSchema = z.object({
  gate_run_id: z.string().trim().min(8).max(120),
  environment: z.enum(['staging', 'production']),
  version: z.string().trim().min(1).max(120),
  status: z.enum(['planned', 'running', 'passed', 'failed', 'blocked']),
  gates: z.array(JsonRecordSchema).default([]),
  failure_summary: z.string().trim().min(1).max(1000).nullable().optional(),
});

export const RecordDeploymentHealthGateSchema = z.object({
  gate_id: z.string().trim().min(8).max(120),
  promotion_id: z.string().trim().min(1).max(120).nullable().optional(),
  runtime_root: z.string().trim().min(1).max(200),
  environment: z.enum(['staging', 'production']),
  gate_name: z.string().trim().min(1).max(120),
  status: z.enum(['passed', 'failed', 'skipped', 'blocked']),
  observed_value: JsonRecordSchema.default({}),
  threshold: JsonRecordSchema.default({}),
  evidence_url: z.string().url().nullable().optional(),
});



export const RecordOperationalDashboardSnapshotSchema = z.object({
  snapshot_id: z.string().trim().min(8).max(120),
  dashboard_name: z.string().trim().min(1).max(120),
  environment: z.enum(['staging', 'production']),
  status: z.enum(['healthy', 'degraded', 'unavailable']),
  source_api: z.string().trim().min(1).max(240),
  source_projection: z.string().trim().min(1).max(160),
  panels: z.array(JsonRecordSchema).default([]),
});


export const RecordSecurityEnforcementEventSchema = z.object({
  enforcement_id: z.string().trim().min(8).max(120),
  environment: z.enum(['staging', 'production']),
  control_name: z.string().trim().min(1).max(160),
  runtime_root: z.string().trim().min(1).max(200),
  status: z.enum(['passed', 'failed', 'waived', 'remediated']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  evidence: JsonRecordSchema.default({}),
});


export const RecordOperationalCertificationReportSchema = z.object({
  certification_id: z.string().trim().min(8).max(120),
  environment: z.enum(['staging', 'production']),
  certification_mode: z.enum(['plan', 'execute']),
  status: z.enum(['credential-gated', 'certified', 'failed', 'expired']),
  repository_maturity_score: z.number().min(0).max(10),
  live_maturity_score: z.number().min(0).max(10),
  evidence_summary: JsonRecordSchema.default({}),
  missing_capabilities: z.array(z.string().trim().min(1).max(160)).max(100).default([]),
  expires_at: z.string().datetime().nullable().optional(),
  report: JsonRecordSchema.default({}),
});

export interface DomainOutboxEvent {
  id: string;
  store_id?: string | null;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
  status: 'queued' | 'processing' | 'processed' | 'failed' | 'dead';
  attempts: number;
  available_at: string;
  request_id?: string | null;
  actor_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditActivityEvent {
  id: string;
  store_id?: string | null;
  actor_id?: string | null;
  actor_type: 'user' | 'customer' | 'employee' | 'system' | 'webhook';
  action: string;
  resource_type: string;
  resource_id?: string | null;
  request_id?: string | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RuntimeEventEnvelope<TPayload = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  source_runtime: string;
  site_id?: string;
  aggregate_type?: string;
  aggregate_id?: string;
  occurred_at: string;
  payload: TPayload;
  request_id?: string;
  idempotency_key?: string;
}

export interface WriteWithOutboxEventInput {
  event_id?: string;
  event_type: DomainEventType;
  source_runtime: DomainEventProducer;
  site_id?: string;
  aggregate_type: DomainEventContract['aggregateType'];
  aggregate_id: string;
  payload: Record<string, unknown>;
  request_id?: string | null;
  actor_id?: string | null;
  idempotency_key: string;
  occurred_at?: string;
}

export interface OutboxInsertResult {
  id: string;
  event_type: string;
  status: string;
}

export interface OutboxWritableTransaction {
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };
}

export interface WriteWithOutboxResult<TResult> {
  result: TResult;
  outbox: OutboxInsertResult;
}

function generatedEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function writeWithOutbox<TResult>(
  tx: OutboxWritableTransaction,
  domainWrite: (tx: OutboxWritableTransaction) => Promise<TResult>,
  event: WriteWithOutboxEventInput,
): Promise<WriteWithOutboxResult<TResult>> {
  const result = await domainWrite(tx);
  const envelope = validateDomainEventEnvelope({
    event_id: event.event_id || generatedEventId(),
    event_type: event.event_type,
    source_runtime: event.source_runtime,
    site_id: event.site_id,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    occurred_at: event.occurred_at || new Date().toISOString(),
    payload: event.payload,
    request_id: event.request_id || undefined,
    idempotency_key: event.idempotency_key,
    schema_version: 1,
  });

  const { data, error } = await tx
    .from('outbox_events')
    .insert({
      site_id: envelope.site_id || null,
      store_id: envelope.site_id || null,
      event_id: envelope.event_id,
      aggregate_type: envelope.aggregate_type,
      aggregate_id: envelope.aggregate_id,
      event_type: envelope.event_type,
      payload: envelope.payload,
      idempotency_key: event.idempotency_key,
      request_id: event.request_id || null,
      actor_id: event.actor_id || null,
      schema_version: 1,
      status: 'queued',
    })
    .select('id, event_type, status')
    .single();

  if (error) {
    throw new Error(`Transactional outbox write failed: ${error.message || 'unknown error'}`);
  }

  return {
    result,
    outbox: data as OutboxInsertResult,
  };
}

export type DispatchOutboxInput = z.infer<typeof DispatchOutboxSchema>;
export type DispatchWebhookDeliveriesInput = z.infer<typeof DispatchWebhookDeliveriesSchema>;
export type ConsumeQueueJobsInput = z.infer<typeof ConsumeQueueJobsSchema>;
export type OperationsListQuery = z.infer<typeof OperationsListQuerySchema>;
export type MarketplaceReviewListQuery = z.infer<typeof MarketplaceReviewListQuerySchema>;
export type MarketplaceReviewDecisionInput = z.infer<typeof MarketplaceReviewDecisionSchema>;
export type RecordUsageInput = z.infer<typeof RecordUsageSchema>;
export type CreateWebhookSubscriptionInput = z.infer<typeof CreateWebhookSubscriptionSchema>;
export type UpdateWebhookSubscriptionInput = z.infer<typeof UpdateWebhookSubscriptionSchema>;
export type RuntimeQueueRecoveryInput = z.infer<typeof RuntimeQueueRecoverySchema>;
export type RuntimeDeadLetterRedriveInput = z.infer<typeof RuntimeDeadLetterRedriveSchema>;
export type SubmitRuntimeControlCommandInput = z.infer<typeof SubmitRuntimeControlCommandSchema>;
export type RecordProductionIncidentInput = z.infer<typeof RecordProductionIncidentSchema>;
export type UpdateProductionIncidentStatusInput = z.infer<typeof UpdateProductionIncidentStatusSchema>;
export type RecordDeploymentPromotionInput = z.infer<typeof RecordDeploymentPromotionSchema>;
export type RecordProductionReadinessGateInput = z.infer<typeof RecordProductionReadinessGateSchema>;
export type RecordDeploymentHealthGateInput = z.infer<typeof RecordDeploymentHealthGateSchema>;
export type RecordOperationalDashboardSnapshotInput = z.infer<typeof RecordOperationalDashboardSnapshotSchema>;
export type RecordSecurityEnforcementEventInput = z.infer<typeof RecordSecurityEnforcementEventSchema>;
export type RecordOperationalCertificationReportInput = z.infer<typeof RecordOperationalCertificationReportSchema>;
