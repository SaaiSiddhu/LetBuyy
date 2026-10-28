import { z } from 'zod';
import { OrderSchema, LineItemSchema } from '@letbuyy/shared-types';
import { DEFAULT_EMAIL_BRAND, renderEmailShell, heading, paragraph, detailTable, detailRow, smallPrint, escapeHtml, safeSubject } from './email';

/** Saved order facts only. A delayed notification must not recalculate a receipt. */
export const OrderEmailSnapshotSchema = z.object({
  kind: z.enum(['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'payment_received', 'payment_updated', 'tracking_updated', 'fulfilment_updated', 'refund_updated', 'return_updated']),
  store_name: z.string().min(1).max(200),
  order: OrderSchema.pick({ id: true, store_id: true, order_number: true, customer_name: true,
    status: true, payment_status: true, fulfillment_status: true, currency: true, subtotal: true, discount_amount: true,
    shipping_amount: true, tax_amount: true, total: true, coupon_code: true, tracking_number: true }).extend({
      line_items: z.array(LineItemSchema.pick({ name: true, quantity: true, total: true })).max(250),
      metadata: z.object({ refund_status: z.string().max(80), return_status: z.string().max(80) }).strict(),
    }),
}).strict();
export type OrderEmailSnapshot = z.infer<typeof OrderEmailSnapshotSchema>;
export const OrderEmailDeliverySchema = z.object({ send: z.literal(true), log_id: z.string().uuid(), site_id: z.string().uuid(),
  to: z.string().email().max(320), idempotency_key: z.string().min(8).max(200), snapshot: OrderEmailSnapshotSchema });
export const OrderEmailDeliveryReceiptSchema = z.object({ send: z.literal(false), log_id: z.string().uuid(), status: z.string(),
  provider_message_id: z.string().nullable().optional() });
export const OrderEmailMessageSchema = z.object({ from: z.string().min(3).max(500), subject: z.string().min(1).max(240),
  html: z.string().min(1).max(200000), text: z.string().min(1).max(50000) }).strict();

const LABELS: Record<OrderEmailSnapshot['kind'], [string, string]> = {
  placed: ['Order received', 'We have received your order. Payment and fulfilment updates will follow as they are recorded.'],
  confirmed: ['Order confirmed', 'Your order has been confirmed.'],
  processing: ['Preparing your order', 'Your order is being prepared.'],
  shipped: ['Your order has shipped', 'Your order is on its way.'],
  delivered: ['Your order was delivered', 'The store has marked your order as delivered.'],
  cancelled: ['Order cancelled', 'Your order has been cancelled. Any payment or refund update is recorded separately.'],
  payment_received: ['Payment received', 'Payment has been recorded for your order.'],
  payment_updated: ['Payment update', 'The payment status of your order has changed. See the recorded status below.'],
  tracking_updated: ['Tracking update', 'The store has updated the tracking information for your order.'],
  fulfilment_updated: ['Fulfilment update', 'The store has updated the fulfilment status of your order.'],
  refund_updated: ['Refund update', 'The recorded refund status has changed. The order totals below are the original saved receipt, not a refund amount.'],
  return_updated: ['Return update', 'The store has updated the recorded return status of your order.'],
};

export function renderOrderLifecycleEmail(input: unknown) {
  const { kind, store_name: storeName, order } = OrderEmailSnapshotSchema.parse(input);
  const [title, message] = LABELS[kind];
  const amount = (value: number) => `${order.currency} ${value.toFixed(2)}`;
  const facts: Array<[string, string]> = [
    ['Store', storeName], ['Order', order.order_number],
    ['Payment status', order.payment_status.replace(/_/g, ' ')],
    ['Fulfilment status', order.fulfillment_status.replace(/_/g, ' ')],
    ...(kind==='refund_updated' ? [['Refund status', order.metadata.refund_status.replace(/_/g,' ')] as [string,string]] : []),
    ...(kind==='return_updated' ? [['Return status', order.metadata.return_status.replace(/_/g,' ')] as [string,string]] : []),
    ...order.line_items.map(item => [`${item.name} × ${item.quantity}`, amount(item.total)] as [string, string]),
    ['Subtotal', amount(order.subtotal)],
    ...(order.discount_amount > 0 ? [[order.coupon_code ? `Coupon (${order.coupon_code})` : 'Discount', `−${amount(order.discount_amount)}`] as [string, string]] : []),
    ['Shipping', amount(order.shipping_amount)], ['Tax', amount(order.tax_amount)], ['Final total', amount(order.total)],
    ...(order.tracking_number ? [['Tracking number', order.tracking_number] as [string, string]] : []),
  ];
  const greeting = order.customer_name ? `Hello ${order.customer_name},` : 'Hello,';
  return {
    subject: safeSubject(`${title} · ${order.order_number} · ${storeName}`),
    text: [greeting, message, ...facts.map(([label, value]) => `${label}: ${value}`)].join('\n\n'),
    html: renderEmailShell(DEFAULT_EMAIL_BRAND, heading(escapeHtml(title)) + paragraph(escapeHtml(greeting)) +
      paragraph(escapeHtml(message)) + detailTable(facts.map(([label, value]) => detailRow(escapeHtml(label), escapeHtml(value)))) +
      smallPrint('These are the amounts saved with your order. Delivery status does not confirm payment collection or a refund.'),
      { preheader: `${title} from ${storeName}.`, reason: 'You received this transactional update about an order placed through LetBuyy.', category: 'transactional' }),
  };
}
