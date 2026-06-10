import { z } from 'zod';
import {
  AddressSchema,
  CommerceChannelSchema,
  CurrencySchema,
  DraftOrderStatusSchema,
  EmailSchema,
  GstinSchema,
  HsnCodeSchema,
  IndianStateCodeSchema,
  MoneySchema,
  PaginationQuery,
  QueryBooleanSchema,
  UuidSchema,
} from '@letbuyy/shared-types';
import type { Address } from '@letbuyy/shared-types';
import type { ProductModel } from '@letbuyy/commerce-core';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'returned';
export type OrderStatus = 'pending' | 'pending_cod' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export const OrderItemInput = z.object({
  product_id: UuidSchema,
  variant_id: UuidSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999),
});

export const CreateOrderSchema = z.object({
  store_id: UuidSchema,
  idempotency_key: z.string().min(8).max(200),
  customer_email: EmailSchema,
  customer_name: z.string().min(1).max(200).trim(),
  customer_phone: z.string().max(20).optional(),
  customer_gstin: GstinSchema.optional(),
  shipping_address: AddressSchema.optional(),
  items: z.array(OrderItemInput).min(1).max(50),
  payment_method: z.enum(['razorpay', 'stripe', 'cashfree', 'cod']).default('cod'),
  shipping_method: z.enum(['standard', 'express']).default('standard'),
  notes: z.string().max(1000).optional(),
  coupon_code: z.string().max(50).optional(),
  gift_card_code: z.string().min(6).max(100).optional(),
});

export const StorefrontCreateOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(200).trim(),
    email: EmailSchema,
    phone: z.string().max(20).optional(),
    gstin: GstinSchema.optional(),
    address: z.object({
      address: z.string().min(1).max(500),
      city: z.string().min(1).max(100),
      state: z.string().min(1).max(100),
      stateCode: IndianStateCodeSchema.optional(),
      pincode: z.string().min(3).max(20),
    }),
  }),
  items: z.array(z.object({
    productId: UuidSchema,
    variantId: UuidSchema.optional().nullable(),
    quantity: z.number().int().min(1).max(999),
  })).min(1).max(50),
  paymentMethod: z.enum(['razorpay', 'stripe', 'paypal', 'cashfree', 'cod']).default('cod'),
  deliveryOption: z.enum(['standard', 'express']).default('standard'),
  notes: z.string().max(1000).optional(),
  couponCode: z.string().max(50).optional(),
  giftCardCode: z.string().min(6).max(100).optional(),
  idempotencyKey: z.string().min(8).max(200),
});

export const CheckoutSessionStateSchema = z.enum([
  'contact',
  'delivery',
  'payment_intent',
  'confirming',
  'completed',
  'failed',
  'cancelled',
  'expired',
]);

export const CheckoutContactSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  email: EmailSchema,
  name: z.string().min(1).max(200).trim(),
  phone: z.string().max(20).optional().nullable(),
  gstin: GstinSchema.optional().nullable(),
}).strict();

export const CheckoutDeliverySchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  shipping_method: z.enum(['standard', 'express']).default('standard'),
  shipping_address: AddressSchema.partial().extend({
    line1: z.string().min(1).max(500).optional(),
    city: z.string().min(1).max(100).optional(),
    state: z.string().min(1).max(100).optional(),
    zip: z.string().min(3).max(20).optional(),
    pincode: z.string().min(3).max(20).optional(),
  }).passthrough(),
  cod_requested: z.boolean().default(false),
  shipping_quote: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const CheckoutPaymentIntentSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  provider: z.enum(['razorpay', 'cashfree', 'upi', 'cod']).default('cod'),
  mode: z.enum(['sandbox', 'live']).default('sandbox'),
  tokenize: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const CheckoutConfirmSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  payment_intent_id: z.string().min(1).max(200).optional(),
  provider_payment_id: z.string().min(1).max(200).optional(),
  simulate_order_failure: z.boolean().default(false),
}).strict();

export const StoreBrandingSchema = z.object({
  logo_url: z.string().url().optional().nullable(),
  favicon_url: z.string().url().optional().nullable(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#111827'),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#2563EB'),
  checkout_theme: z.enum(['system', 'light', 'dark']).default('system'),
  tokens: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
}).strict();

export type CheckoutSessionState = z.infer<typeof CheckoutSessionStateSchema>;
export type CheckoutContactInput = z.infer<typeof CheckoutContactSchema>;
export type CheckoutDeliveryInput = z.infer<typeof CheckoutDeliverySchema>;
export type CheckoutPaymentIntentInput = z.infer<typeof CheckoutPaymentIntentSchema>;
export type CheckoutConfirmInput = z.infer<typeof CheckoutConfirmSchema>;
export type StoreBrandingInput = z.infer<typeof StoreBrandingSchema>;

const CHECKOUT_STATE_ORDER: Record<CheckoutSessionState, number> = {
  contact: 1,
  delivery: 2,
  payment_intent: 3,
  confirming: 4,
  completed: 5,
  failed: 5,
  cancelled: 5,
  expired: 5,
};

export function planCheckoutStateTransition(
  current: CheckoutSessionState | null | undefined,
  next: CheckoutSessionState,
): { allowed: boolean; reason: 'initial' | 'forward' | 'same_state' | 'terminal' | 'backwards' } {
  if (!current) return { allowed: next === 'contact', reason: 'initial' };
  if (current === next) return { allowed: true, reason: 'same_state' };
  if (['completed', 'failed', 'cancelled', 'expired'].includes(current)) {
    return { allowed: false, reason: 'terminal' };
  }

  return CHECKOUT_STATE_ORDER[next] >= CHECKOUT_STATE_ORDER[current]
    ? { allowed: true, reason: 'forward' }
    : { allowed: false, reason: 'backwards' };
}

export function normalizeCheckoutChannel(value: unknown): z.infer<typeof CommerceChannelSchema> {
  const parsed = CommerceChannelSchema.safeParse(value);
  return parsed.success ? parsed.data : 'web';
}

export function assertBrandingIsDataOnly(input: StoreBrandingInput): StoreBrandingInput {
  const serialized = JSON.stringify(input).toLowerCase();
  if (serialized.includes('<script') || serialized.includes('javascript:') || serialized.includes('onerror=')) {
    throw new Error('Store branding must be data-only');
  }
  return input;
}

export const StorefrontRazorpayOrderSchema = z.object({
  orderId: UuidSchema,
  idempotencyKey: z.string().min(8).max(200),
  amount: MoneySchema.optional(),
  amountMinorUnits: z.number().int().positive().optional(),
});

export const StorefrontRazorpayVerifySchema = z.object({
  orderId: UuidSchema,
  razorpay_order_id: z.string().min(1).max(200),
  razorpay_payment_id: z.string().min(1).max(200),
  razorpay_signature: z.string().min(1).max(500),
  idempotencyKey: z.string().min(8).max(200),
});

export const StorefrontStripeCheckoutSchema = z.object({
  orderId: UuidSchema,
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  customerEmail: EmailSchema.optional(),
  idempotencyKey: z.string().min(8).max(200),
});

export const StorefrontPayPalOrderSchema = z.object({
  orderId: UuidSchema,
  returnUrl: z.string().url(),
  cancelUrl: z.string().url(),
  idempotencyKey: z.string().min(8).max(200),
});

export const StorefrontPayPalCaptureSchema = z.object({
  orderId: UuidSchema,
  paypalOrderId: z.string().min(1).max(200),
  idempotencyKey: z.string().min(8).max(200),
});

export const StorefrontCashfreeOrderSchema = z.object({
  orderId: UuidSchema,
  returnUrl: z.string().url(),
  notifyUrl: z.string().url().optional(),
  customerEmail: EmailSchema.optional(),
  customerPhone: z.string().max(20).optional(),
  customerName: z.string().max(200).optional(),
  paymentMethods: z.string().max(200).optional(),
  idempotencyKey: z.string().min(8).max(200),
  amount: MoneySchema.optional(),
  amountMinorUnits: z.number().int().positive().optional(),
});

export const StorefrontCashfreeVerifySchema = z.object({
  orderId: UuidSchema,
  cashfree_order_id: z.string().min(1).max(200),
  cf_payment_id: z.string().min(1).max(200).optional(),
  idempotencyKey: z.string().min(8).max(200),
});

export const UpdateOrderStatusSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  status: z.enum([
    'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
  ]),
  tracking_number: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  cancellation_reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  version: z.number().int().positive('Version required for concurrent safety').optional(),
});

export const OrderRiskAssessmentSchema = z.object({
  store_id: UuidSchema,
  order_id: UuidSchema.optional(),
  payment_method: z.enum(['razorpay', 'stripe', 'paypal', 'cashfree', 'upi', 'cod']).default('cod'),
  order_total_minor: z.number().int().min(0).default(0),
  pincode: z.string().max(20).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  prior_rto_count: z.number().int().min(0).max(100).default(0),
  cod_confirmation_required: z.boolean().optional(),
  idempotency_key: z.string().min(8).max(200).optional(),
}).strict();

export const CodConfirmationSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  confirmed: z.boolean().default(true),
  reply_text: z.string().max(500).optional(),
}).strict();

export const CodTimeoutSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  reason: z.string().max(500).default('cod_confirmation_timeout'),
}).strict();

export type OrderRiskAssessmentInput = z.infer<typeof OrderRiskAssessmentSchema>;
export type CodConfirmationInput = z.infer<typeof CodConfirmationSchema>;
export type CodTimeoutInput = z.infer<typeof CodTimeoutSchema>;

export interface OrderRiskAssessmentPlan {
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  reasons: string[];
  actions: Array<'request_cod_confirmation' | 'hold_fulfillment' | 'allow'>;
}

export function assessOrderRisk(input: OrderRiskAssessmentInput): OrderRiskAssessmentPlan {
  let score = 0;
  const reasons: string[] = [];

  if (input.payment_method === 'cod') {
    score += 25;
    reasons.push('cod_payment');
  }
  if (input.order_total_minor >= 100_000) {
    score += 20;
    reasons.push('high_order_value');
  }
  if (input.prior_rto_count > 0) {
    score += Math.min(40, input.prior_rto_count * 15);
    reasons.push('prior_rto');
  }
  if (!input.phone || input.phone.trim().length < 8) {
    score += 15;
    reasons.push('weak_phone_signal');
  }
  if (!input.pincode || !/^[1-9][0-9]{5}$/.test(input.pincode)) {
    score += 10;
    reasons.push('weak_pincode_signal');
  }
  if (input.cod_confirmation_required === true) {
    score += 10;
    reasons.push('merchant_cod_confirmation_policy');
  }

  const riskScore = Math.min(100, score);
  const riskLevel = riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low';
  const actions: OrderRiskAssessmentPlan['actions'] = [];
  if (input.payment_method === 'cod' && riskScore >= 35) actions.push('request_cod_confirmation');
  if (riskScore >= 60) actions.push('hold_fulfillment');
  if (actions.length === 0) actions.push('allow');

  return {
    risk_score: riskScore,
    risk_level: riskLevel,
    reasons,
    actions,
  };
}

export const FulfillmentLineSchema = z.object({
  order_item_id: UuidSchema,
  quantity: z.number().int().min(1).max(999),
});

export const LogisticsProviderNameSchema = z.enum(['shiprocket', 'delhivery', 'pickrr']);

export const FulfillOrderSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  location_id: UuidSchema.optional().nullable(),
  lines: z.array(FulfillmentLineSchema).min(1).max(100).optional(),
  carrier: z.string().max(100).optional(),
  tracking_number: z.string().max(100).optional(),
  tracking_url: z.string().url().optional(),
  logistics_provider: LogisticsProviderNameSchema.optional(),
  create_shipping_label: z.boolean().default(false),
  package_weight_grams: z.number().int().min(1).max(50_000).optional(),
  package_dimensions_cm: z.object({
    length: z.number().min(1).max(300),
    width: z.number().min(1).max(300),
    height: z.number().min(1).max(300),
  }).optional(),
});

export const OrderLineItemPatchSchema = z.object({
  order_item_id: UuidSchema,
  quantity: z.number().int().min(0).max(999),
});

export const OrderLineItemAddSchema = z.object({
  product_id: UuidSchema,
  variant_id: z.string().max(100).optional().nullable(),
  quantity: z.number().int().min(1).max(999),
});

export const UpdateOrderLineItemsSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  lines: z.array(OrderLineItemPatchSchema).max(100).default([]),
  add_items: z.array(OrderLineItemAddSchema).max(100).default([]),
  remove_line_item_ids: z.array(UuidSchema).max(100).default([]),
  notes: z.string().max(1000).optional(),
});

export const ListDraftOrdersQuery = PaginationQuery.extend({
  store_id: UuidSchema,
  status: DraftOrderStatusSchema.or(z.literal('all')).default('draft'),
});

export const CreateDraftOrderSchema = z.object({
  store_id: UuidSchema,
  idempotency_key: z.string().min(8).max(200),
  customer_email: EmailSchema,
  customer_name: z.string().min(1).max(200).trim(),
  customer_phone: z.string().max(20).optional(),
  customer_gstin: GstinSchema.optional(),
  shipping_address: AddressSchema.optional(),
  items: z.array(OrderItemInput).min(1).max(50),
  payment_method: z.enum(['razorpay', 'stripe', 'cashfree', 'cod']).default('cod'),
  shipping_method: z.enum(['standard', 'express']).default('standard'),
  notes: z.string().max(1000).optional(),
  coupon_code: z.string().max(50).optional(),
  gift_card_code: z.string().min(6).max(100).optional(),
});

export const ConvertDraftOrderSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
});

export const RefundLineSchema = z.object({
  order_item_id: UuidSchema,
  quantity: z.number().int().min(1).max(999),
  restock_quantity: z.number().int().min(0).max(999).optional(),
});

export const ReturnStatusSchema = z.enum([
  'requested',
  'authorized',
  'rejected',
  'received',
  'inspected',
  'approved',
  'refunded',
  'closed',
  'cancelled',
]);

export const ListReturnsQuery = PaginationQuery.extend({
  store_id: UuidSchema,
  order_id: UuidSchema.optional(),
  status: ReturnStatusSchema.or(z.literal('all')).default('all'),
});

export const CreateReturnSchema = z.object({
  order_id: UuidSchema,
  idempotency_key: z.string().min(8).max(200),
  lines: z.array(RefundLineSchema).min(1).max(100).optional(),
  reason: z.string().max(500).optional(),
  refund_method: z.enum(['original_payment', 'gift_card', 'manual']).default('original_payment'),
  restock: z.boolean().default(false),
});

export const UpdateReturnStatusSchema = z.object({
  status: ReturnStatusSchema,
  notes: z.string().max(1000).optional(),
});

export const CompleteReturnRefundSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  refund_id: UuidSchema.optional(),
  provider_refund_id: z.string().max(200).optional(),
  provider_event_id: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export const RefundOrderSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  lines: z.array(RefundLineSchema).min(1).max(100).optional(),
  reason: z.string().max(500).optional(),
  refund_method: z.enum(['original_payment', 'gift_card', 'manual']).default('original_payment'),
  restock: z.boolean().default(false),
});

export const CompleteRefundSchema = z.object({
  idempotency_key: z.string().min(8).max(200),
  refund_id: UuidSchema,
  provider_refund_id: z.string().max(200).optional(),
  provider_event_id: z.string().max(200).optional(),
});

export interface CheckoutOrderItemCommand {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface CreateCheckoutOrderCommand {
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  shipping_address?: Record<string, unknown>;
  customer_gstin?: string;
  items: CheckoutOrderItemCommand[];
  payment_method: string;
  shipping_method?: 'standard' | 'express';
  notes?: string;
  coupon_code?: string;
  gift_card_code?: string;
  idempotency_key: string;
}

export interface CheckoutCartBindingLine {
  product_id?: string | null;
  productId?: string | null;
  variant_id?: string | null;
  variantId?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  price?: number | string | null;
  line_total?: number | string | null;
  total?: number | string | null;
}

export interface CheckoutCartBindingInput {
  siteId: string;
  cartId: string;
  cartToken: string;
  channel: string;
  expiresAt: string;
  couponCodes?: Array<string | null | undefined>;
  lines: CheckoutCartBindingLine[];
}

function checkoutNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function checkoutMoneyMinor(value: unknown): number {
  return Math.round(Math.max(0, checkoutNumber(value)) * 100);
}

function checkoutString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function canonicalCheckoutCartBinding(input: CheckoutCartBindingInput): string {
  const lines = input.lines
    .map((line) => {
      const productId = checkoutString(line.product_id ?? line.productId);
      const variantId = checkoutString(line.variant_id ?? line.variantId);
      const quantity = Math.max(1, Math.trunc(checkoutNumber(line.quantity)));
      const unitPriceMinor = checkoutMoneyMinor(line.unit_price ?? line.price);
      const lineTotalMinor = checkoutMoneyMinor(line.line_total ?? line.total);

      return {
        product_id: productId,
        variant_id: variantId || null,
        quantity,
        unit_price_minor: unitPriceMinor,
        line_total_minor: lineTotalMinor || unitPriceMinor * quantity,
      };
    })
    .filter((line) => line.product_id && line.quantity > 0)
    .sort((left, right) => (
      left.product_id.localeCompare(right.product_id)
      || String(left.variant_id || '').localeCompare(String(right.variant_id || ''))
      || left.quantity - right.quantity
    ));

  return JSON.stringify({
    version: 1,
    site_id: input.siteId,
    cart_id: input.cartId,
    cart_token: input.cartToken,
    channel: normalizeCheckoutChannel(input.channel),
    expires_at: input.expiresAt,
    coupon_codes: [...new Set((input.couponCodes || [])
      .map((code) => checkoutString(code).toUpperCase())
      .filter(Boolean))]
      .sort(),
    lines,
  });
}

export function canonicalCheckoutHandoffPayload(input: CheckoutCartBindingInput & { cartContentDigest: string }): string {
  return JSON.stringify({
    version: 1,
    site_id: input.siteId,
    cart_id: input.cartId,
    cart_token: input.cartToken,
    channel: normalizeCheckoutChannel(input.channel),
    expires_at: input.expiresAt,
    cart_content_digest: input.cartContentDigest,
  });
}

export interface FulfillmentLineCommand {
  order_item_id: string;
  quantity: number;
}

export interface FulfillOrderCommand {
  idempotency_key: string;
  location_id?: string | null;
  lines?: FulfillmentLineCommand[];
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  logistics_provider?: 'shiprocket' | 'delhivery' | 'pickrr';
  create_shipping_label?: boolean;
  package_weight_grams?: number;
  package_dimensions_cm?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface RefundLineCommand {
  order_item_id: string;
  quantity: number;
  restock_quantity?: number;
}

export interface RefundOrderCommand {
  idempotency_key: string;
  lines?: RefundLineCommand[];
  reason?: string;
  refund_method: 'original_payment' | 'gift_card' | 'manual';
  restock: boolean;
}

export interface CompleteRefundCommand {
  idempotency_key: string;
  refund_id: string;
  provider_refund_id?: string;
  provider_event_id?: string;
}

export const GstInvoicePartyInputSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  gstin: GstinSchema.optional().nullable(),
  state: z.string().min(1).max(100).optional().nullable(),
  state_code: IndianStateCodeSchema.optional().nullable(),
  address: AddressSchema.partial().optional().nullable(),
}).passthrough();

export const GstInvoiceLineInputSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  product_id: UuidSchema.optional().nullable(),
  variant_id: UuidSchema.optional().nullable(),
  description: z.string().min(1).max(256),
  sku: z.string().max(100).optional().nullable(),
  hsn_code: HsnCodeSchema.optional().nullable(),
  quantity: z.number().int().min(1).max(999),
  unit_amount_minor: z.number().int().min(0),
  discount_amount_minor: z.number().int().min(0).default(0),
  gst_rate_bps: z.number().int().min(0).max(4000).default(0),
  tax_inclusive: z.boolean().default(false),
}).strict();

export const GenerateGstInvoiceSchema = z.object({
  order_id: z.string().min(1).max(120),
  order_number: z.string().min(1).max(80),
  invoice_number: z.string().min(1).max(80).optional(),
  invoice_date: z.union([z.string().datetime(), z.date()]).optional(),
  currency: CurrencySchema,
  supplier: GstInvoicePartyInputSchema,
  recipient: GstInvoicePartyInputSchema,
  place_of_supply_state_code: IndianStateCodeSchema.optional().nullable(),
  lines: z.array(GstInvoiceLineInputSchema).min(1).max(250),
  marketplace_tcs_bps: z.number().int().min(0).max(1000).default(0),
}).strict();

export const CalculateTaxSchema = GenerateGstInvoiceSchema.extend({
  store_id: UuidSchema.optional(),
}).strict();

export type GstInvoicePartyInput = z.infer<typeof GstInvoicePartyInputSchema>;
export type GstInvoiceLineInput = z.infer<typeof GstInvoiceLineInputSchema>;
export type GenerateGstInvoiceInput = z.infer<typeof GenerateGstInvoiceSchema>;
export type CalculateTaxInput = z.infer<typeof CalculateTaxSchema>;

export interface GeneratedGstInvoiceParty {
  name: string;
  gstin: string | null;
  state: string | null;
  state_code: string;
  address?: Record<string, unknown> | null;
}

export interface GeneratedGstInvoiceLine {
  id?: string;
  product_id?: string | null;
  variant_id?: string | null;
  description: string;
  sku?: string | null;
  hsn_code?: string | null;
  quantity: number;
  unit_amount_minor: number;
  discount_amount_minor: number;
  taxable_amount_minor: number;
  gst_rate_bps: number;
  cgst_amount_minor: number;
  sgst_amount_minor: number;
  igst_amount_minor: number;
  tax_amount_minor: number;
  total_amount_minor: number;
}

export interface GeneratedGstInvoice {
  invoice_number: string;
  order_id: string;
  order_number: string;
  invoice_date: string;
  currency: string;
  supplier: GeneratedGstInvoiceParty;
  recipient: GeneratedGstInvoiceParty;
  place_of_supply_state_code: string;
  supply_type: 'intra_state' | 'inter_state';
  lines: GeneratedGstInvoiceLine[];
  taxable_amount_minor: number;
  cgst_amount_minor: number;
  sgst_amount_minor: number;
  igst_amount_minor: number;
  tax_amount_minor: number;
  total_amount_minor: number;
  marketplace_tcs_bps: number;
  tcs_amount_minor: number;
  irp: {
    mode: 'sandbox';
    irn: string;
    qr_payload: string;
    acknowledged_at: string;
  };
}

function parseOptionalGstin(value: string | null | undefined, fieldName: string): string | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  const parsed = GstinSchema.safeParse(normalized);
  if (!parsed.success) throw new Error(`${fieldName} must be a valid GSTIN`);
  return parsed.data;
}

export function normalizeGstin(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return GstinSchema.safeParse(normalized).success ? normalized : null;
}

export function normalizeHsnCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = String(value).trim();
  return HsnCodeSchema.safeParse(normalized).success ? normalized : null;
}

export function extractGstStateCode(value: string | null | undefined): string | null {
  const gstin = normalizeGstin(value);
  return gstin ? gstin.slice(0, 2) : null;
}

export function normalizeIndianStateCode(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).trim().padStart(2, '0');
  return IndianStateCodeSchema.safeParse(normalized).success ? normalized : null;
}

function requireIndianStateCode(
  explicitStateCode: string | null | undefined,
  gstin: string | null,
  fieldName: string,
): string {
  const stateCode = normalizeIndianStateCode(explicitStateCode) || extractGstStateCode(gstin);
  if (!stateCode) throw new Error(`${fieldName} requires a GST state code`);
  return stateCode;
}

function toInvoiceDate(value: string | Date | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function defaultInvoiceNumber(orderNumber: string, invoiceDate: string): string {
  const yyyymmdd = invoiceDate.slice(0, 10).replace(/-/g, '');
  const safeOrderNumber = orderNumber.replace(/[^A-Za-z0-9-]/g, '').slice(0, 40) || 'ORDER';
  return `LBY-${yyyymmdd}-${safeOrderNumber}`;
}

function stableTaxHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildSandboxIrpAcknowledgement(invoiceNumber: string, orderId: string, invoiceDate: string) {
  const irn = `SANDBOX-IRN-${stableTaxHash(`${invoiceNumber}:${orderId}:${invoiceDate}`).toUpperCase()}`;
  return {
    mode: 'sandbox' as const,
    irn,
    qr_payload: `letbuyy://gst-invoice/${encodeURIComponent(irn)}`,
    acknowledged_at: invoiceDate,
  };
}

function positiveMinorUnit(value: number | undefined, fieldName: string): number {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`${fieldName} must be a non-negative minor-unit amount`);
  return Math.round(amount);
}

function buildGstInvoiceParty(input: GstInvoicePartyInput, fieldName: string): GeneratedGstInvoiceParty {
  const gstin = parseOptionalGstin(input.gstin ?? null, `${fieldName}.gstin`);
  const stateCode = requireIndianStateCode(input.state_code ?? null, gstin, fieldName);

  return {
    name: input.name,
    gstin,
    state: input.state ?? null,
    state_code: stateCode,
    address: input.address ?? null,
  };
}

export function calculateGstLine(input: GstInvoiceLineInput, supplyType: 'intra_state' | 'inter_state'): GeneratedGstInvoiceLine {
  const quantity = Math.max(1, Math.trunc(Number(input.quantity)));
  const unitAmountMinor = positiveMinorUnit(input.unit_amount_minor, 'unit_amount_minor');
  const discountAmountMinor = positiveMinorUnit(input.discount_amount_minor, 'discount_amount_minor');
  const lineAmountMinor = Math.max(0, (unitAmountMinor * quantity) - discountAmountMinor);
  const gstRateBps = Math.max(0, Math.min(4000, Math.trunc(Number(input.gst_rate_bps ?? 0))));
  const taxableAmountMinor = input.tax_inclusive
    ? Math.round((lineAmountMinor * 10_000) / (10_000 + gstRateBps))
    : lineAmountMinor;
  const taxAmountMinor = input.tax_inclusive
    ? lineAmountMinor - taxableAmountMinor
    : Math.round((taxableAmountMinor * gstRateBps) / 10_000);
  const totalAmountMinor = taxableAmountMinor + taxAmountMinor;
  const cgstAmountMinor = supplyType === 'intra_state' ? Math.floor(taxAmountMinor / 2) : 0;
  const sgstAmountMinor = supplyType === 'intra_state' ? taxAmountMinor - cgstAmountMinor : 0;
  const igstAmountMinor = supplyType === 'inter_state' ? taxAmountMinor : 0;

  return {
    id: input.id,
    product_id: input.product_id ?? null,
    variant_id: input.variant_id ?? null,
    description: input.description,
    sku: input.sku ?? null,
    hsn_code: normalizeHsnCode(input.hsn_code ?? null),
    quantity,
    unit_amount_minor: unitAmountMinor,
    discount_amount_minor: discountAmountMinor,
    taxable_amount_minor: taxableAmountMinor,
    gst_rate_bps: gstRateBps,
    cgst_amount_minor: cgstAmountMinor,
    sgst_amount_minor: sgstAmountMinor,
    igst_amount_minor: igstAmountMinor,
    tax_amount_minor: taxAmountMinor,
    total_amount_minor: totalAmountMinor,
  };
}

export function generateGstInvoice(input: GenerateGstInvoiceInput): GeneratedGstInvoice {
  if (!input.lines.length) throw new Error('GST invoice requires at least one line item');

  const invoiceDate = toInvoiceDate(input.invoice_date);
  const supplier = buildGstInvoiceParty(input.supplier, 'supplier');
  const recipient = buildGstInvoiceParty(input.recipient, 'recipient');
  const placeOfSupplyStateCode = normalizeIndianStateCode(input.place_of_supply_state_code)
    || recipient.state_code;
  const supplyType = supplier.state_code === placeOfSupplyStateCode ? 'intra_state' : 'inter_state';
  const lines = input.lines.map((line) => calculateGstLine(line, supplyType));
  const totals = lines.reduce(
    (acc, line) => {
      acc.taxable_amount_minor += line.taxable_amount_minor;
      acc.cgst_amount_minor += line.cgst_amount_minor;
      acc.sgst_amount_minor += line.sgst_amount_minor;
      acc.igst_amount_minor += line.igst_amount_minor;
      acc.tax_amount_minor += line.tax_amount_minor;
      acc.total_amount_minor += line.total_amount_minor;
      return acc;
    },
    {
      taxable_amount_minor: 0,
      cgst_amount_minor: 0,
      sgst_amount_minor: 0,
      igst_amount_minor: 0,
      tax_amount_minor: 0,
      total_amount_minor: 0,
    },
  );
  const marketplaceTcsBps = Math.max(0, Math.min(1000, Math.trunc(Number(input.marketplace_tcs_bps ?? 0))));
  const tcsAmountMinor = Math.round((totals.taxable_amount_minor * marketplaceTcsBps) / 10_000);
  const invoiceNumber = input.invoice_number || defaultInvoiceNumber(input.order_number, invoiceDate);

  return {
    invoice_number: invoiceNumber,
    order_id: input.order_id,
    order_number: input.order_number,
    invoice_date: invoiceDate,
    currency: input.currency || 'INR',
    supplier,
    recipient,
    place_of_supply_state_code: placeOfSupplyStateCode,
    supply_type: supplyType,
    lines,
    ...totals,
    marketplace_tcs_bps: marketplaceTcsBps,
    tcs_amount_minor: tcsAmountMinor,
    irp: buildSandboxIrpAcknowledgement(invoiceNumber, input.order_id, invoiceDate),
  };
}

export const ListOrdersQuery = z.object({
  store_id: UuidSchema.optional(),
  status: z
    .enum(['pending', 'pending_cod', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'all'])
    .default('all'),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded', 'all']).default('all'),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(512).optional(),
  withCount: QueryBooleanSchema,
  sort: z.enum(['created_at', 'total', 'status']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const RazorpayVerifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  order_id: UuidSchema,
  idempotency_key: z.string().min(8).max(200),
});

export const RazorpayOrderSchema = z.object({
  order_id: UuidSchema,
  idempotency_key: z.string().min(8).max(200),
  amount: MoneySchema.optional(),
  amount_minor_units: z.number().int().positive().optional(),
});

export const StripeCheckoutSchema = z.object({
  order_id: UuidSchema,
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
  idempotency_key: z.string().min(8).max(200),
});

export const CreateShippingZoneSchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(100).trim(),
  countries: z.array(z.string().min(2).max(100).trim()).min(1).max(250),
  states: z.array(z.string().max(100)).max(100).optional(),
  zip_codes: z.array(z.string().max(20)).max(500).optional(),
});

export const CreateShippingRateSchema = z.object({
  zone_id: UuidSchema,
  name: z.string().min(1).max(100).trim(),
  type: z.enum(['flat', 'weight_based', 'price_based', 'free']),
  price: MoneySchema.default(0),
  min_weight_grams: z.number().int().min(0).optional(),
  max_weight_grams: z.number().int().min(0).optional(),
  min_order_amount: MoneySchema.optional(),
  max_order_amount: MoneySchema.optional(),
  estimated_days_min: z.number().int().min(0).optional(),
  estimated_days_max: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
});

export const ShippingServiceabilityQuerySchema = z.object({
  store_id: UuidSchema,
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Indian pincode must be 6 digits'),
  cod: z.boolean().default(false),
  order_amount_minor: z.number().int().min(0).default(0),
  weight_grams: z.number().int().min(1).max(50_000).default(500),
});

export const CreateTaxRateSchema = z.object({
  store_id: UuidSchema,
  name: z.string().min(1).max(100).trim(),
  rate: z.number().min(0).max(100),
  country: z.string().length(2).toUpperCase().default('IN'),
  state: z.string().max(100).optional(),
  hsn_code: z.string().max(20).optional(),
  applies_to: z.enum(['all', 'shipping', 'products']).default('all'),
  is_compound: z.boolean().default(false),
  is_shipping: z.boolean().default(false),
  priority: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const CreateCouponSchema = z.object({
  store_id: UuidSchema,
  code: z.string().min(3).max(50).toUpperCase().regex(/^[A-Z0-9_-]+$/, 'Code must be alphanumeric'),
  description: z.string().max(500).optional(),
  type: z.enum(['percentage', 'fixed', 'free_shipping']),
  value: z.number().min(0),
  discount_class: z.enum(['product', 'order', 'shipping']).default('order'),
  combines_with: z.object({
    product: z.boolean().default(false),
    order: z.boolean().default(false),
    shipping: z.boolean().default(false),
  }).default({ product: false, order: false, shipping: false }),
  automatic: z.boolean().default(false),
  priority: z.number().int().min(0).max(10_000).default(100),
  minimum_order_amount: MoneySchema.optional(),
  maximum_discount: MoneySchema.optional(),
  usage_limit: z.number().int().min(1).optional(),
  per_customer_limit: z.number().int().min(1).default(1),
  applicable_products: z.array(UuidSchema).max(100).optional(),
  applicable_categories: z.array(z.string().max(100)).max(20).optional(),
  starts_at: z.coerce.date().optional(),
  expires_at: z.coerce.date().optional(),
  is_active: z.boolean().default(true),
}).refine(
  (data) => data.type !== 'percentage' || (data.value >= 0 && data.value <= 100),
  { message: 'Percentage discount must be between 0 and 100', path: ['value'] },
);

export const ValidateCouponSchema = z.object({
  store_id: UuidSchema,
  code: z.string().min(1).max(50),
  order_total: MoneySchema,
  product_ids: z.array(UuidSchema).optional(),
  customer_id: UuidSchema.optional(),
});

export const ListCouponsQuery = PaginationQuery.extend({
  store_id: UuidSchema.optional(),
  status: z.enum(['active', 'expired', 'all']).default('all'),
});

export interface CouponRecord extends Record<string, unknown> {
  code?: string | null;
  type?: string | null;
  value?: number | string | null;
  minimum_order_amount?: number | string | null;
  maximum_discount?: number | string | null;
  per_customer_limit?: number | string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  min_order_amount?: number | string | null;
  max_discount?: number | string | null;
  per_user_limit?: number | string | null;
  starts_at?: string | Date | null;
  expires_at?: string | Date | null;
  usage_limit?: number | string | null;
  usage_count?: number | string | null;
  discount_class?: string | null;
  combines_with?: unknown;
  automatic?: boolean | null;
  priority?: number | string | null;
}

export interface NormalizedCouponRecord extends CouponRecord {
  type: string | null;
  value: number | string | null;
  minimum_order_amount: number | string | null;
  maximum_discount: number | string | null;
  per_customer_limit: number | string | null;
  discount_class: string;
  combines_with: DiscountCombinesWith;
  automatic: boolean;
  priority: number;
}

export interface CouponCreatePlan {
  couponInsert: Record<string, unknown>;
}

export interface CouponUpdatePlan {
  updates: Record<string, unknown>;
}

export type CouponValidationFailureCode =
  | 'expired'
  | 'not_started'
  | 'usage_limit_reached'
  | 'minimum_order_not_met';

export type DiscountClass = 'product' | 'order' | 'shipping';
export type DiscountSourceType = 'code' | 'automatic';
export type DiscountRejectionReason = 'combine_blocked' | 'amount_exhausted';

export interface DiscountCombinesWith {
  product: boolean;
  order: boolean;
  shipping: boolean;
}

export interface DiscountStackCandidate {
  id: string;
  code?: string | null;
  discountClass: DiscountClass;
  sourceType?: DiscountSourceType;
  amountMinor: number;
  combinesWith?: Partial<DiscountCombinesWith> | null;
  priority?: number | null;
}

export interface DiscountStackInput {
  subtotalMinor: number;
  shippingMinor?: number;
  candidates: readonly DiscountStackCandidate[];
}

export interface DiscountAllocationPlan {
  discountId: string;
  code?: string | null;
  discountClass: DiscountClass;
  sourceType: DiscountSourceType;
  amountMinor: number;
}

export interface DiscountStackPlan {
  allocations: DiscountAllocationPlan[];
  rejected: Array<{
    discountId: string;
    code?: string | null;
    reason: DiscountRejectionReason;
    blockedBy?: string;
  }>;
  totalDiscountMinor: number;
}

export interface CouponValidationPlan {
  valid: boolean;
  failureCode?: CouponValidationFailureCode;
  coupon: {
    code: string;
    type: string | null;
    value: number;
    discountClass: DiscountClass;
    combinesWith: DiscountCombinesWith;
    minimumOrderAmount: number;
    maximumDiscount: number | null;
    discount: number;
    freeShipping: boolean;
  };
  pricingAuthority: 'checkout';
}

const COUPON_UPDATE_FIELDS = [
  'code',
  'type',
  'description',
  'value',
  'minimum_order_amount',
  'maximum_discount',
  'usage_limit',
  'per_customer_limit',
  'discount_class',
  'combines_with',
  'automatic',
  'priority',
  'starts_at',
  'expires_at',
  'is_active',
] as const;

const COUPON_COLUMN_MAP: Record<string, string> = {
  type: 'discount_type',
  value: 'discount_value',
  minimum_order_amount: 'min_order_amount',
  maximum_discount: 'max_discount',
  per_customer_limit: 'per_user_limit',
};

function toCouponIsoTimestamp(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toCouponNumber(value: number | string | null | undefined, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalCouponNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DISCOUNT_CLASS_RANK: Record<DiscountClass, number> = {
  product: 0,
  order: 1,
  shipping: 2,
};

const DEFAULT_COMBINES_WITH: DiscountCombinesWith = {
  product: false,
  order: false,
  shipping: false,
};

function normalizeDiscountClass(value: unknown): DiscountClass {
  return value === 'product' || value === 'shipping' ? value : 'order';
}

function normalizeDiscountCombinesWith(value: unknown): DiscountCombinesWith {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_COMBINES_WITH };
  }

  const record = value as Partial<Record<DiscountClass, unknown>>;
  return {
    product: record.product === true,
    order: record.order === true,
    shipping: record.shipping === true,
  };
}

function positiveMinor(value: number | null | undefined): number {
  if (typeof value !== 'number') return 0;
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function discountsCanCombine(
  candidate: DiscountStackCandidate,
  accepted: DiscountAllocationPlan,
  acceptedCombinesWith: DiscountCombinesWith,
): boolean {
  const candidateCombinesWith = normalizeDiscountCombinesWith(candidate.combinesWith);
  return candidateCombinesWith[accepted.discountClass] === true
    && acceptedCombinesWith[candidate.discountClass] === true;
}

export function planDiscountStack(input: DiscountStackInput): DiscountStackPlan {
  const subtotalMinor = positiveMinor(input.subtotalMinor);
  const shippingMinor = positiveMinor(input.shippingMinor);
  const classCapacity: Record<DiscountClass, number> = {
    product: subtotalMinor,
    order: subtotalMinor,
    shipping: shippingMinor,
  };
  const classAllocated: Record<DiscountClass, number> = {
    product: 0,
    order: 0,
    shipping: 0,
  };
  const allocations: DiscountAllocationPlan[] = [];
  const allocationCombines = new Map<string, DiscountCombinesWith>();
  const rejected: DiscountStackPlan['rejected'] = [];

  const sorted = [...input.candidates].sort((left, right) => {
    const leftClass = normalizeDiscountClass(left.discountClass);
    const rightClass = normalizeDiscountClass(right.discountClass);
    return DISCOUNT_CLASS_RANK[leftClass] - DISCOUNT_CLASS_RANK[rightClass]
      || toCouponNumber(left.priority, 100) - toCouponNumber(right.priority, 100)
      || String(left.code || left.id).localeCompare(String(right.code || right.id));
  });

  for (const candidate of sorted) {
    const discountClass = normalizeDiscountClass(candidate.discountClass);
    const blockedBy = allocations.find((accepted) => {
      const acceptedCombinesWith = allocationCombines.get(accepted.discountId) || DEFAULT_COMBINES_WITH;
      return !discountsCanCombine(candidate, accepted, acceptedCombinesWith);
    });

    if (blockedBy) {
      rejected.push({
        discountId: candidate.id,
        code: candidate.code,
        reason: 'combine_blocked',
        blockedBy: blockedBy.discountId,
      });
      continue;
    }

    const remainingCapacity = Math.max(0, classCapacity[discountClass] - classAllocated[discountClass]);
    const amountMinor = Math.min(positiveMinor(candidate.amountMinor), remainingCapacity);
    if (amountMinor <= 0) {
      rejected.push({ discountId: candidate.id, code: candidate.code, reason: 'amount_exhausted' });
      continue;
    }

    allocations.push({
      discountId: candidate.id,
      code: candidate.code,
      discountClass,
      sourceType: candidate.sourceType || 'code',
      amountMinor,
    });
    allocationCombines.set(candidate.id, normalizeDiscountCombinesWith(candidate.combinesWith));
    classAllocated[discountClass] += amountMinor;
  }

  return {
    allocations,
    rejected,
    totalDiscountMinor: allocations.reduce((total, allocation) => total + allocation.amountMinor, 0),
  };
}

function isCouponDateBefore(value: CouponRecord['expires_at'], date: Date) {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return !Number.isNaN(parsed.getTime()) && parsed < date;
}

function isCouponDateAfter(value: CouponRecord['starts_at'], date: Date) {
  if (!value) return false;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return !Number.isNaN(parsed.getTime()) && parsed > date;
}

export function normalizeCouponRecord(coupon: unknown): unknown {
  if (!coupon || typeof coupon !== 'object') {
    return coupon;
  }

  const row = coupon as CouponRecord;

  return {
    ...row,
    type: row.type ?? row.discount_type ?? null,
    value: row.value ?? row.discount_value ?? null,
    minimum_order_amount: row.minimum_order_amount ?? row.min_order_amount ?? null,
    maximum_discount: row.maximum_discount ?? row.max_discount ?? null,
    per_customer_limit: row.per_customer_limit ?? row.per_user_limit ?? 1,
    discount_class: normalizeDiscountClass(row.discount_class),
    combines_with: normalizeDiscountCombinesWith(row.combines_with),
    automatic: row.automatic === true,
    priority: toCouponNumber(row.priority, 100),
  } satisfies NormalizedCouponRecord;
}

export function planCouponCreate(input: CreateCouponInput): CouponCreatePlan {
  return {
    couponInsert: {
      store_id: input.store_id,
      code: input.code,
      description: input.description ?? null,
      discount_type: input.type,
      discount_value: input.value,
      discount_class: input.discount_class,
      combines_with: input.combines_with,
      automatic: input.automatic,
      priority: input.priority,
      min_order_amount: input.minimum_order_amount ?? null,
      max_discount: input.maximum_discount ?? null,
      usage_limit: input.usage_limit ?? null,
      usage_count: 0,
      per_user_limit: input.per_customer_limit ?? 1,
      starts_at: toCouponIsoTimestamp(input.starts_at),
      expires_at: toCouponIsoTimestamp(input.expires_at),
      is_active: input.is_active,
    },
  };
}

export function planCouponUpdate(patch: Record<string, unknown>): CouponUpdatePlan {
  const updates: Record<string, unknown> = {};

  for (const key of COUPON_UPDATE_FIELDS) {
    if (patch[key] === undefined) continue;

    const column = COUPON_COLUMN_MAP[key] || key;
    updates[column] = key === 'starts_at' || key === 'expires_at'
      ? toCouponIsoTimestamp(patch[key])
      : patch[key];
  }

  return { updates };
}

export function planCouponValidation(
  coupon: CouponRecord,
  input: { subtotal?: number; now?: Date; enforceMinimumOrder?: boolean } = {},
): CouponValidationPlan {
  const now = input.now || new Date();
  const subtotal = Number.isFinite(input.subtotal) ? Math.max(Number(input.subtotal), 0) : 0;
  const type = coupon.type ?? coupon.discount_type ?? null;
  const value = toCouponNumber(coupon.value ?? coupon.discount_value);
  const minimumOrderAmount = toCouponNumber(coupon.minimum_order_amount ?? coupon.min_order_amount);
  const maximumDiscount = toOptionalCouponNumber(coupon.maximum_discount ?? coupon.max_discount);
  const usageLimit = toOptionalCouponNumber(coupon.usage_limit);
  const usageCount = toCouponNumber(coupon.usage_count);

  let failureCode: CouponValidationFailureCode | undefined;
  if (isCouponDateBefore(coupon.expires_at, now)) {
    failureCode = 'expired';
  } else if (isCouponDateAfter(coupon.starts_at, now)) {
    failureCode = 'not_started';
  } else if (usageLimit !== null && usageLimit > 0 && usageCount >= usageLimit) {
    failureCode = 'usage_limit_reached';
  } else if (input.enforceMinimumOrder && minimumOrderAmount > 0 && subtotal < minimumOrderAmount) {
    failureCode = 'minimum_order_not_met';
  }

  let discount = 0;
  if (!failureCode && type === 'percentage') {
    discount = Math.round(subtotal * (value / 100));
    if (maximumDiscount !== null && maximumDiscount > 0) discount = Math.min(discount, maximumDiscount);
  } else if (!failureCode && (type === 'fixed' || type === 'fixed_amount')) {
    discount = Math.min(value, subtotal);
  }

  return {
    valid: !failureCode,
    failureCode,
    coupon: {
      code: coupon.code || '',
      type,
      value,
      discountClass: normalizeDiscountClass(coupon.discount_class),
      combinesWith: normalizeDiscountCombinesWith(coupon.combines_with),
      minimumOrderAmount,
      maximumDiscount,
      discount,
      freeShipping: type === 'free_shipping',
    },
    pricingAuthority: 'checkout',
  };
}

export function couponValidationReason(code: CouponValidationFailureCode | undefined): string {
  switch (code) {
    case 'expired':
      return 'Coupon has expired';
    case 'not_started':
      return 'Coupon is not yet active';
    case 'usage_limit_reached':
      return 'Coupon usage limit reached';
    case 'minimum_order_not_met':
      return 'Minimum order amount not met';
    default:
      return 'Coupon is invalid';
  }
}

export function storefrontCouponValidationError(
  code: CouponValidationFailureCode | undefined,
  minimumOrderAmount: number,
): string {
  switch (code) {
    case 'expired':
      return 'This coupon has expired';
    case 'not_started':
      return 'This coupon is not yet active';
    case 'usage_limit_reached':
      return 'This coupon has reached its usage limit';
    case 'minimum_order_not_met':
      return `Minimum purchase of ₹${minimumOrderAmount.toLocaleString('en-IN')} required`;
    default:
      return 'Invalid coupon code';
  }
}

export const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  pending_cod: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export interface OrderStatusTransitionPlan {
  allowed: boolean;
  allowedTransitions: string[];
  updates: Record<string, unknown>;
  delegatesToFulfillment: boolean;
  requiresInventoryRelease: boolean;
}

export function planOrderStatusTransition(
  currentStatus: string,
  newStatus: string,
  metadata: Record<string, unknown> = {},
): OrderStatusTransitionPlan {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
  const allowed = allowedTransitions.includes(newStatus);
  const updates: Record<string, unknown> = allowed ? { status: newStatus } : {};

  if (allowed && newStatus === 'delivered') {
    updates.payment_status = 'paid';
  }

  if (allowed && newStatus === 'cancelled') {
    updates.payment_status = 'refunded';
    updates.notes = metadata.cancellation_reason || 'Order cancelled';
  }

  return {
    allowed,
    allowedTransitions,
    updates,
    delegatesToFulfillment: newStatus === 'shipped',
    requiresInventoryRelease: allowed && newStatus === 'cancelled',
  };
}

export interface OrderItemSourceRow extends Record<string, unknown> {
  product_id?: string | null;
  variant_id?: string | null;
  title?: string | null;
  name?: string | null;
  product_name?: string | null;
  variant_title?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  price?: number | string | null;
  total?: number | string | null;
  image?: string | null;
  image_url?: string | null;
  product_snapshot?: Record<string, unknown> | string | null;
}

export interface OrderSourceRow extends Record<string, unknown> {
  id: string;
  store_id: string;
  order_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  subtotal?: number | string | null;
  shipping_cost?: number | string | null;
  tax?: number | string | null;
  discount?: number | string | null;
  total?: number | string | null;
  coupon_code?: string | null;
  coupon_discount?: number | string | null;
  tracking_number?: string | null;
  shipping_method?: string | null;
  shipping_address?: Record<string, unknown> | string | null;
  items?: unknown;
  order_items?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

function toCheckoutRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function toCheckoutArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function toCheckoutText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function toCheckoutNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstImageFromOrderSnapshot(snapshot: Record<string, unknown>) {
  const images = snapshot.images;
  if (Array.isArray(images) && typeof images[0] === 'string') return images[0];
  return toCheckoutText(snapshot.image || snapshot.image_url);
}

export function normalizeOrderItemRecord(value: unknown) {
  const item = toCheckoutRecord(value) as OrderItemSourceRow;
  const snapshot = toCheckoutRecord(item.product_snapshot);
  const quantity = toCheckoutNumber(item.quantity, 0);
  const unitPrice = toCheckoutNumber(item.unit_price ?? item.price, 0);
  const total = toCheckoutNumber(item.total, unitPrice * quantity);

  return {
    product_id: toCheckoutText(item.product_id),
    variant_id: toCheckoutText(item.variant_id) || null,
    title: toCheckoutText(item.title || item.name || item.product_name || snapshot.name, 'Item'),
    variant_title: toCheckoutText(item.variant_title) || null,
    sku: toCheckoutText(item.sku || snapshot.sku) || null,
    quantity,
    unit_price: unitPrice,
    total,
    image: toCheckoutText(item.image || item.image_url) || firstImageFromOrderSnapshot(snapshot) || null,
  };
}

export function normalizeOrderRecord<TOrder extends OrderSourceRow>(row: TOrder) {
  const relationalItems = toCheckoutArray(row.order_items);
  const legacyItems = toCheckoutArray(row.items);
  const items = (relationalItems.length > 0 ? relationalItems : legacyItems).map(normalizeOrderItemRecord);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    ...row,
    order_number: row.order_number || '',
    customer_name: row.customer_name || '',
    customer_email: row.customer_email || '',
    customer_phone: row.customer_phone || '',
    status: row.status || 'pending',
    payment_status: row.payment_status || 'pending',
    payment_method: row.payment_method || 'cod',
    subtotal: toCheckoutNumber(row.subtotal),
    shipping_cost: toCheckoutNumber(row.shipping_cost),
    tax: toCheckoutNumber(row.tax),
    discount: toCheckoutNumber(row.discount ?? row.coupon_discount),
    total: toCheckoutNumber(row.total),
    coupon_code: row.coupon_code || null,
    coupon_discount: toCheckoutNumber(row.coupon_discount ?? row.discount),
    tracking_number: row.tracking_number || null,
    shipping_method: row.shipping_method || null,
    shipping_address: toCheckoutRecord(row.shipping_address),
    items,
    order_items: items,
    item_count: itemCount,
  };
}

export interface Order {
  id: string;
  store_id: string;
  order_number: string;
  customer_email: string;
  customer_phone?: string;
  customer_name?: string;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  payment_method?: string;
  payment_gateway?: string;
  payment_id?: string;
  shipping_address?: Address;
  billing_address?: Address;
  shipping_method?: string;
  tracking_number?: string;
  notes?: string;
  coupon_code?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id?: string;
  variant_id?: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  total?: number;
  productId?: string;
  image?: string;
  variant?: Record<string, string>;
}

export interface CartItem extends ProductModel {
  quantity: number;
  selectedVariant?: Record<string, string>;
}

export interface OrderModel {
  id: string;
  storeId: string;
  sellerId: string;
  subdomain: string;
  orderNumber: string;
  customer: OrderCustomer;
  items: OrderItem[];
  pricing: OrderPricing;
  payment: OrderPayment;
  status: OrderStatus;
  tracking?: OrderTracking;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface OrderCustomer {
  name: string;
  email: string;
  phone: string;
  address: ShippingAddress;
}

export interface ShippingAddress {
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderPricing {
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  total: number;
}

export interface OrderPayment {
  method: 'razorpay' | 'stripe' | 'paypal' | 'cashfree' | 'cod';
  status: PaymentStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  stripeSessionId?: string;
  paypalOrderId?: string;
  cashfreeOrderId?: string;
  cashfreePaymentId?: string;
}

export interface OrderTracking {
  number?: string;
  carrier?: string;
  url?: string;
  updatedAt?: string;
}

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type StorefrontCreateOrderInput = z.infer<typeof StorefrontCreateOrderSchema>;
export type StorefrontRazorpayOrderInput = z.infer<typeof StorefrontRazorpayOrderSchema>;
export type StorefrontRazorpayVerifyInput = z.infer<typeof StorefrontRazorpayVerifySchema>;
export type StorefrontStripeCheckoutInput = z.infer<typeof StorefrontStripeCheckoutSchema>;
export type StorefrontPayPalOrderInput = z.infer<typeof StorefrontPayPalOrderSchema>;
export type StorefrontPayPalCaptureInput = z.infer<typeof StorefrontPayPalCaptureSchema>;
export type StorefrontCashfreeOrderInput = z.infer<typeof StorefrontCashfreeOrderSchema>;
export type StorefrontCashfreeVerifyInput = z.infer<typeof StorefrontCashfreeVerifySchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type LogisticsProviderName = z.infer<typeof LogisticsProviderNameSchema>;
export type FulfillOrderInput = z.infer<typeof FulfillOrderSchema>;
export type UpdateOrderLineItemsInput = z.infer<typeof UpdateOrderLineItemsSchema>;
export type CheckoutDraftOrderStatusInput = z.infer<typeof DraftOrderStatusSchema>;
export type ListDraftOrdersInput = z.infer<typeof ListDraftOrdersQuery>;
export type CreateDraftOrderInput = z.infer<typeof CreateDraftOrderSchema>;
export type ConvertDraftOrderInput = z.infer<typeof ConvertDraftOrderSchema>;
export type ListReturnsInput = z.infer<typeof ListReturnsQuery>;
export type CreateReturnInput = z.infer<typeof CreateReturnSchema>;
export type UpdateReturnStatusInput = z.infer<typeof UpdateReturnStatusSchema>;
export type CompleteReturnRefundInput = z.infer<typeof CompleteReturnRefundSchema>;
export type RefundOrderInput = z.infer<typeof RefundOrderSchema>;
export type CompleteRefundInput = z.infer<typeof CompleteRefundSchema>;
export type ListOrdersInput = z.infer<typeof ListOrdersQuery>;
export type RazorpayVerifyInput = z.infer<typeof RazorpayVerifySchema>;
export type RazorpayOrderInput = z.infer<typeof RazorpayOrderSchema>;
export type StripeCheckoutInput = z.infer<typeof StripeCheckoutSchema>;
export type CreateShippingZoneInput = z.infer<typeof CreateShippingZoneSchema>;
export type CreateShippingRateInput = z.infer<typeof CreateShippingRateSchema>;
export type ShippingServiceabilityQueryInput = z.infer<typeof ShippingServiceabilityQuerySchema>;

export interface ShippingServiceabilityRule {
  provider: 'shiprocket' | 'delhivery' | 'pickrr';
  pincode: string;
  serviceable: boolean;
  cod_available: boolean;
  min_cod_amount_minor?: number | null;
  max_cod_amount_minor?: number | null;
  min_weight_grams?: number | null;
  max_weight_grams?: number | null;
  estimated_days_min?: number | null;
  estimated_days_max?: number | null;
}

export interface ShippingServiceabilityPlan {
  pincode: string;
  serviceable: boolean;
  cod_available: boolean;
  provider: ShippingServiceabilityRule['provider'];
  estimated_days_min: number;
  estimated_days_max: number;
  reason: 'matched_rule' | 'cod_unavailable' | 'amount_out_of_range' | 'weight_out_of_range' | 'no_rule';
}
export type CreateTaxRateInput = z.infer<typeof CreateTaxRateSchema>;
export type CreateCouponInput = z.infer<typeof CreateCouponSchema>;
export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;
export type ListCouponsInput = z.infer<typeof ListCouponsQuery>;

export interface ShippingZoneCreatePlan {
  zoneInsert: Record<string, unknown>;
}

export interface ShippingZoneUpdatePlan {
  updates: Record<string, unknown>;
}

export interface ShippingRateCreatePlan {
  rateInsert: Record<string, unknown>;
}

export interface ShippingRateUpdatePlan {
  updates: Record<string, unknown>;
}

export interface TaxRateCreatePlan {
  taxRateInsert: Record<string, unknown>;
}

export interface TaxRateUpdatePlan {
  updates: Record<string, unknown>;
}

const SHIPPING_ZONE_UPDATE_FIELDS = ['name', 'countries', 'states'] as const;
const SHIPPING_RATE_UPDATE_FIELDS = [
  'name',
  'description',
  'price',
  'min_order_amount',
  'max_order_amount',
  'min_weight_grams',
  'max_weight_grams',
  'estimated_days_min',
  'estimated_days_max',
  'type',
  'is_active',
] as const;
const TAX_RATE_UPDATE_FIELDS = ['name', 'rate', 'country', 'state', 'hsn_code', 'applies_to', 'is_compound', 'is_shipping', 'priority', 'is_active'] as const;

export function planShippingZoneCreate(input: CreateShippingZoneInput): ShippingZoneCreatePlan {
  return {
    zoneInsert: {
      store_id: input.store_id,
      name: input.name,
      countries: input.countries,
      states: input.states || [],
    },
  };
}

export function planShippingZoneUpdate(patch: Record<string, unknown>): ShippingZoneUpdatePlan {
  const updates: Record<string, unknown> = {};
  for (const key of SHIPPING_ZONE_UPDATE_FIELDS) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  return { updates };
}

export function planShippingRateCreate(input: CreateShippingRateInput): ShippingRateCreatePlan {
  return {
    rateInsert: {
      zone_id: input.zone_id,
      name: input.name,
      price: input.price || 0,
      min_order_amount: input.min_order_amount || null,
      max_order_amount: input.max_order_amount || null,
      estimated_days_min: input.estimated_days_min || null,
      estimated_days_max: input.estimated_days_max || null,
      type: input.type,
      is_active: input.is_active ?? true,
    },
  };
}

export function planShippingRateUpdate(patch: Record<string, unknown>): ShippingRateUpdatePlan {
  const updates: Record<string, unknown> = {};
  for (const key of SHIPPING_RATE_UPDATE_FIELDS) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  return { updates };
}

export function planShippingServiceability(
  input: ShippingServiceabilityQueryInput,
  rules: ShippingServiceabilityRule[],
): ShippingServiceabilityPlan {
  const matchingRule = rules.find((rule) => rule.pincode === input.pincode && rule.serviceable)
    || rules.find((rule) => rule.pincode === input.pincode);

  if (!matchingRule || !matchingRule.serviceable) {
    return {
      pincode: input.pincode,
      serviceable: false,
      cod_available: false,
      provider: matchingRule?.provider || 'shiprocket',
      estimated_days_min: matchingRule?.estimated_days_min || 0,
      estimated_days_max: matchingRule?.estimated_days_max || 0,
      reason: matchingRule ? 'matched_rule' : 'no_rule',
    };
  }

  const minWeight = matchingRule.min_weight_grams ?? 1;
  const maxWeight = matchingRule.max_weight_grams ?? 50_000;
  if (input.weight_grams < minWeight || input.weight_grams > maxWeight) {
    return {
      pincode: input.pincode,
      serviceable: false,
      cod_available: false,
      provider: matchingRule.provider,
      estimated_days_min: matchingRule.estimated_days_min || 0,
      estimated_days_max: matchingRule.estimated_days_max || 0,
      reason: 'weight_out_of_range',
    };
  }

  let codAvailable = matchingRule.cod_available;
  let reason: ShippingServiceabilityPlan['reason'] = 'matched_rule';
  if (input.cod && !matchingRule.cod_available) {
    codAvailable = false;
    reason = 'cod_unavailable';
  }
  if (input.cod && matchingRule.cod_available) {
    const minAmount = matchingRule.min_cod_amount_minor ?? 0;
    const maxAmount = matchingRule.max_cod_amount_minor ?? Number.MAX_SAFE_INTEGER;
    if (input.order_amount_minor < minAmount || input.order_amount_minor > maxAmount) {
      codAvailable = false;
      reason = 'amount_out_of_range';
    }
  }

  return {
    pincode: input.pincode,
    serviceable: true,
    cod_available: codAvailable,
    provider: matchingRule.provider,
    estimated_days_min: matchingRule.estimated_days_min || 3,
    estimated_days_max: matchingRule.estimated_days_max || 7,
    reason,
  };
}

export function planTaxRateCreate(input: CreateTaxRateInput): TaxRateCreatePlan {
  return {
    taxRateInsert: {
      store_id: input.store_id,
      name: input.name,
      rate: input.rate,
      country: input.country || 'IN',
      state: input.state || null,
      hsn_code: input.hsn_code || null,
      applies_to: input.applies_to || 'all',
      is_compound: input.is_compound ?? false,
      is_shipping: input.is_shipping ?? false,
      priority: input.priority || 0,
      is_active: input.is_active ?? true,
    },
  };
}

export function planTaxRateUpdate(patch: Record<string, unknown>): TaxRateUpdatePlan {
  const updates: Record<string, unknown> = {};
  for (const key of TAX_RATE_UPDATE_FIELDS) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  return { updates };
}
