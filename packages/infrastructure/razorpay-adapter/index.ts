export const RAZORPAY_API_ORIGIN = 'https://api.razorpay.com';

import {
  inrMoney,
  normalizeIdempotencyKey,
  normalizePaymentMoney,
  type PaymentCaptureInput,
  type PaymentCaptureResult,
  type PaymentCreateIntentInput,
  type PaymentProvider,
  type PaymentRefundInput,
  type PaymentRefundResult,
  type PaymentVerifyInput,
  type PaymentVerificationResult,
  type PaymentWebhookHeaders,
  type PaymentWebhookVerifyInput,
  type PaymentWebhookVerificationResult,
} from '@letbuyy/payments';

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

export type RazorpayRefundEventType = 'refund.created' | 'refund.processed' | 'refund.failed';
export type RazorpayRefundStatus = 'created' | 'processed' | 'failed';

/** The event name, not the entity's possibly advanced status, determines the
 * lifecycle transition. A created event must never post a refund reversal. */
export function normalizeRazorpayRefundLifecycle(eventType: string, entityStatus: string | null | undefined):
  { eventType: RazorpayRefundEventType; status: RazorpayRefundStatus } | null {
  if (eventType === 'refund.created') return ['created', 'pending', 'processed'].includes(entityStatus ?? '')
    ? { eventType, status: 'created' } : null;
  if (eventType === 'refund.processed' && entityStatus === 'processed') return { eventType, status: 'processed' };
  if (eventType === 'refund.failed' && entityStatus === 'failed') return { eventType, status: 'failed' };
  return null;
}

export interface RazorpayOrderCreateInput {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderCreateResult {
  id?: string;
  amount?: number;
  currency?: string;
  error?: { description?: string };
}

export class RazorpayOrderMismatchError extends Error {
  constructor() {
    super('Razorpay order amount or currency did not match the requested payment');
    this.name = 'RazorpayOrderMismatchError';
  }
}

export interface RazorpayOrderRecord {
  id?: string;
  entity?: string;
  amount?: number;
  currency?: string;
  receipt?: string | null;
  status?: string;
  notes?: Record<string, unknown>;
}

export interface RazorpayOrderSearchResult {
  items?: RazorpayOrderRecord[];
  count?: number;
  error?: { description?: string };
}

export interface RazorpaySubscriptionAddon {
  item: {
    name: string;
    amount: number;
    currency: string;
  };
  quantity?: number;
}

export interface RazorpaySubscriptionCreateInput {
  plan_id: string;
  total_count: number;
  quantity?: number;
  customer_notify?: boolean;
  start_at?: number;
  expire_by?: number;
  addons?: RazorpaySubscriptionAddon[];
  notes?: Record<string, string>;
}

export interface RazorpaySubscriptionCreateResult {
  id?: string;
  entity?: 'subscription';
  plan_id?: string;
  status?: string;
  short_url?: string;
  total_count?: number;
  paid_count?: number;
  remaining_count?: number;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  start_at?: number | null;
  end_at?: number | null;
  error?: { description?: string };
}

interface RazorpayCaptureResult {
  id?: string;
  order_id?: string;
  amount?: number;
  status?: string;
  error?: { code?: string; description?: string };
}

export interface RazorpayRefundResult {
  id?: string;
  payment_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: { code?: string; description?: string };
}

/** Read refund status with the capturing account; never infer completion from
 * a merchant-supplied refund reference or a successful create HTTP response. */
export async function fetchRazorpayRefund(credentials:RazorpayCredentials,refundId:string,
  options:{fetch?:RazorpayFetch}={}):Promise<RazorpayRefundResult>{
  const response=await (options.fetch??fetch)(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundId)}`,{
    method:'GET',headers:{Authorization:basicAuth(credentials)},
  });
  const raw:unknown=await response.json().catch(()=>null);
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {error:{description:'Razorpay refund status is unavailable'}};
  const data=raw as RazorpayRefundResult;
  return response.ok?data:{...data,error:data.error||{description:'Razorpay refund status is unavailable'}};
}

type RazorpayFetch = typeof fetch;

function basicAuth(credentials: RazorpayCredentials): string {
  return `Basic ${btoa(`${credentials.keyId}:${credentials.keySecret}`)}`;
}

export async function createRazorpayOrder(
  credentials: RazorpayCredentials,
  input: RazorpayOrderCreateInput,
): Promise<RazorpayOrderCreateResult> {
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(credentials),
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({})) as RazorpayOrderCreateResult;
  if (!response.ok) {
    return {
      ...data,
      error: data.error || { description: `Razorpay order create failed with ${response.status}` },
    };
  }
  return data;
}

/**
 * Look up the provider order for an exact receipt after an ambiguous create response.
 * The caller must still validate tenant/order metadata and amount before binding it.
 */
export async function fetchRazorpayOrdersByReceipt(
  credentials: RazorpayCredentials,
  receipt: string,
  options: { fetch?: RazorpayFetch } = {},
): Promise<RazorpayOrderSearchResult> {
  const fetchImpl = options.fetch ?? fetch;
  const query = new URLSearchParams({ receipt, count: '2' });
  const response = await fetchImpl(`https://api.razorpay.com/v1/orders?${query.toString()}`, {
    method: 'GET',
    headers: { Authorization: basicAuth(credentials) },
  });

  const data = await response.json().catch(() => ({})) as RazorpayOrderSearchResult;
  if (!response.ok) {
    return {
      ...data,
      error: data.error || { description: `Razorpay order lookup failed with ${response.status}` },
    };
  }
  return data;
}

export interface RazorpayPaymentFetchResult {
  invoice_id?: string | null;
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  captured?: boolean;
  error?: { code?: string; description?: string };
}

/**
 * Server-side fetch of a Razorpay payment. Use to confirm a payment was actually
 * captured for the expected amount/order BEFORE granting value — never trust a
 * client-supplied signature alone (the HMAC only proves order_id|payment_id, not
 * that the money was taken or how much).
 */
export async function fetchRazorpayPayment(
  credentials: RazorpayCredentials,
  paymentId: string,
  options: { fetch?: RazorpayFetch } = {},
): Promise<RazorpayPaymentFetchResult> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: {
      Authorization: basicAuth(credentials),
    },
  });

  const data = await response.json().catch(() => ({})) as RazorpayPaymentFetchResult;
  if (!response.ok) {
    return {
      ...data,
      error: data.error || { description: `Razorpay payment fetch failed with ${response.status}` },
    };
  }
  return data;
}

export async function createRazorpaySubscription(
  credentials: RazorpayCredentials,
  input: RazorpaySubscriptionCreateInput,
  options: { fetch?: RazorpayFetch } = {},
): Promise<RazorpaySubscriptionCreateResult> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(credentials),
    },
    body: JSON.stringify(input),
  });

  const data = await response.json().catch(() => ({})) as RazorpaySubscriptionCreateResult;
  if (!response.ok) {
    return {
      ...data,
      error: data.error || { description: `Razorpay subscription create failed with ${response.status}` },
    };
  }
  return data;
}

export async function getRazorpayOrderNotes(
  credentials: RazorpayCredentials,
  orderId: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    headers: {
      Authorization: basicAuth(credentials),
    },
  });

  if (!response.ok) return {};
  const order = await response.json().catch(() => ({})) as { notes?: Record<string, unknown> };
  return order.notes || {};
}

export async function verifyRazorpayCredentials(credentials: RazorpayCredentials,
  options: { fetch?: RazorpayFetch } = {}): Promise<boolean> {
  const response = await (options.fetch ?? fetch)('https://api.razorpay.com/v1/payments?count=1', {
    headers: {
      Authorization: basicAuth(credentials),
    },
  });
  if (response.ok) return true;
  if (response.status === 401 || response.status === 403) return false;
  // A provider outage, throttle, or unexpected response cannot prove that the
  // merchant's saved key is invalid. Keep the previous connection unchanged.
  throw new Error('Razorpay credential verification is temporarily unavailable');
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function headerValue(headers: PaymentWebhookHeaders, name: string): string | undefined {
  const candidates = [name, name.toLowerCase(), name.toUpperCase()];
  for (const candidate of candidates) {
    const value = headers[candidate];
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

function metadataNotes(metadata?: Record<string, unknown>): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value === undefined || value === null) continue;
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (typeof serialized === 'string') notes[key] = serialized;
  }
  return notes;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function jsonPayload(rawBody: string): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(rawBody) as unknown);
  } catch {
    return {};
  }
}

async function postRazorpay<TResponse>(
  fetchImpl: RazorpayFetch,
  credentials: RazorpayCredentials,
  path: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const response = await fetchImpl(`https://api.razorpay.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(credentials),
    },
    body: JSON.stringify(body),
  });

  return response.json().catch(() => ({})) as Promise<TResponse>;
}

export function createRazorpayPaymentProvider(
  credentials: RazorpayCredentials,
  options: { fetch?: RazorpayFetch } = {},
): PaymentProvider {
  const fetchImpl = options.fetch ?? fetch;

  return {
    name: 'razorpay',

    async createIntent(input: PaymentCreateIntentInput) {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
      const providerOrder = await createRazorpayOrder(credentials, {
        amount: amount.amountMinor,
        currency: amount.currency,
        receipt: input.receipt || input.orderId,
        notes: {
          order_id: input.orderId,
          store_id: input.storeId,
          idempotency_key: idempotencyKey,
          ...metadataNotes(input.metadata),
        },
      });

      if (!providerOrder.id) {
        throw new Error(providerOrder.error?.description || 'Razorpay order creation failed');
      }
      if (providerOrder.amount !== amount.amountMinor || providerOrder.currency !== amount.currency) {
        throw new RazorpayOrderMismatchError();
      }

      return {
        provider: 'razorpay',
        status: 'pending',
        amount: inrMoney(providerOrder.amount ?? amount.amountMinor),
        idempotencyKey,
        references: {
          providerOrderId: providerOrder.id,
        },
        metadata: input.metadata,
      };
    },

    async verify(input: PaymentVerifyInput): Promise<PaymentVerificationResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      if (!input.providerOrderId || !input.providerPaymentId || !input.signature) {
        return {
          provider: 'razorpay',
          verified: false,
          status: 'failed',
          amount,
          references: {
            providerOrderId: input.providerOrderId,
            providerPaymentId: input.providerPaymentId,
          },
          failureCode: 'RAZORPAY_SIGNATURE_MISSING',
          failureMessage: 'Razorpay verification requires order id, payment id, and signature',
        };
      }

      const expected = await hmacSha256Hex(credentials.keySecret, `${input.providerOrderId}|${input.providerPaymentId}`);
      const verified = timingSafeEqual(expected, input.signature);

      return {
        provider: 'razorpay',
        verified,
        status: verified ? 'paid' : 'failed',
        amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        failureCode: verified ? undefined : 'RAZORPAY_SIGNATURE_INVALID',
        failureMessage: verified ? undefined : 'Razorpay payment signature mismatch',
        metadata: input.metadata,
      };
    },

    async capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult> {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);

      if (!input.providerPaymentId) {
        throw new Error('Razorpay capture requires providerPaymentId');
      }

      const capture = await postRazorpay<RazorpayCaptureResult>(
        fetchImpl,
        credentials,
        `payments/${input.providerPaymentId}/capture`,
        {
          amount: amount.amountMinor,
          currency: amount.currency,
        },
      );
      const captured = capture.status === 'captured';

      return {
        provider: 'razorpay',
        status: captured ? 'paid' : 'failed',
        capturedAmount: inrMoney(capture.amount ?? amount.amountMinor),
        references: {
          providerOrderId: capture.order_id || input.providerOrderId,
          providerPaymentId: capture.id || input.providerPaymentId,
        },
        failureCode: captured ? undefined : capture.error?.code || 'RAZORPAY_CAPTURE_FAILED',
        failureMessage: captured ? undefined : capture.error?.description || 'Razorpay capture failed',
        metadata: input.metadata,
      };
    },

    async refund(input: PaymentRefundInput): Promise<PaymentRefundResult> {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

      const refund = await postRazorpay<RazorpayRefundResult>(
        fetchImpl,
        credentials,
        `payments/${input.paymentId}/refund`,
        {
          amount: amount.amountMinor,
          speed: 'normal',
          receipt: idempotencyKey,
          notes: metadataNotes(input.metadata),
        },
      );
      const refunded = refund.status === 'processed';
      const failed = refund.status === 'failed';

      return {
        provider: 'razorpay',
        status: refunded ? 'refunded' : failed ? 'failed' : 'pending',
        refundedAmount: inrMoney(refund.amount ?? amount.amountMinor),
        references: {
          providerPaymentId: refund.payment_id || input.paymentId,
          providerRefundId: refund.id,
        },
        failureCode: refunded || !failed ? undefined : refund.error?.code || 'RAZORPAY_REFUND_FAILED',
        failureMessage: refunded || !failed ? undefined : refund.error?.description || 'Razorpay refund failed',
        metadata: input.metadata,
      };
    },

    async webhookVerify(input: PaymentWebhookVerifyInput): Promise<PaymentWebhookVerificationResult> {
      const signature = headerValue(input.headers, 'x-razorpay-signature');
      if (!signature) {
        return {
          provider: 'razorpay',
          verified: false,
          failureCode: 'RAZORPAY_WEBHOOK_SIGNATURE_MISSING',
          failureMessage: 'Razorpay webhook signature header is missing',
        };
      }

      const expected = await hmacSha256Hex(input.secret, input.rawBody);
      const verified = timingSafeEqual(expected, signature);
      const payload = jsonPayload(input.rawBody);
      const payment = asRecord(asRecord(asRecord(payload.payload).payment).entity);
      const refund = asRecord(asRecord(asRecord(payload.payload).refund).entity);
      const order = asRecord(asRecord(asRecord(payload.payload).order).entity);
      const eventType = textValue(payload.event) || 'unknown';
      // Razorpay's delivery ID is the retry identity. Older/fixture events may
      // omit it; keep that fallback stable across retries and distinct across
      // event types. Receipt time is not an event identity.
      const deliveryId = headerValue(input.headers, 'x-razorpay-event-id');
      const signedBodyDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.rawBody));
      const digestHex = Array.from(new Uint8Array(signedBodyDigest))
        .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      const eventId = (deliveryId && /^[A-Za-z0-9_-]{1,128}$/.test(deliveryId) ? deliveryId : undefined)
        || textValue(payload.id)
        || `${eventType}:${textValue(refund.id) || textValue(payment.id) || textValue(order.id) || digestHex}`;

      return {
        provider: 'razorpay',
        verified,
        event: verified
          ? {
            id: eventId,
            provider: 'razorpay',
            type: eventType,
            occurredAt: typeof payload.created_at === 'number'
              ? new Date(payload.created_at * 1000).toISOString()
              : input.receivedAt,
            references: {
              providerEventId: eventId,
              providerOrderId: textValue(payment.order_id) || textValue(order.id),
              providerPaymentId: textValue(payment.id),
              providerRefundId: textValue(refund.id),
            },
            payload,
          }
          : undefined,
        failureCode: verified ? undefined : 'RAZORPAY_WEBHOOK_SIGNATURE_INVALID',
        failureMessage: verified ? undefined : 'Razorpay webhook signature mismatch',
      };
    },
  };
}

export interface RazorpayPlanFetchResult {
  id?:string;entity?:string;period?:string;interval?:number;
  item?:{active?:boolean;amount?:number;currency?:string;tax_inclusive?:boolean;tax_rate?:number|null;tax_id?:string|null;tax_group_id?:string|null};
  error?:{description?:string};
}
/** Read the configured plan before a subscription can create a provider charge. */
export async function fetchRazorpayPlan(credentials:RazorpayCredentials,planId:string,options:{fetch?:RazorpayFetch}={}):Promise<RazorpayPlanFetchResult>{
  if(!/^plan_[A-Za-z0-9]+$/.test(planId)||planId.length>120)return {error:{description:'Invalid Razorpay plan reference'}};
  const response=await (options.fetch??fetch)(`${RAZORPAY_API_ORIGIN}/v1/plans/${encodeURIComponent(planId)}`,{
    method:'GET',headers:{Authorization:basicAuth(credentials)},
  });
  const data=await response.json().catch(()=>({})) as RazorpayPlanFetchResult;
  if(!response.ok)return {...data,error:data.error||{description:`Razorpay plan lookup failed with ${response.status}`}};
  return data;
}

/** Minimal provider evidence only. Customer/card/address/notes are not retained. */
export interface RazorpaySubscriptionFetchResult {
 id?:string;entity?:string;plan_id?:string;status?:string;quantity?:number;
 current_start?:number|null;current_end?:number|null;start_at?:number|null;
 paid_count?:number;total_count?:number;error?:{description?:string};
}
export interface RazorpayInvoiceLine {
 id?:string;type?:string;name?:string;quantity?:number;currency?:string;
 amount?:number;unit_amount?:number;gross_amount?:number;tax_amount?:number;
}
export interface RazorpayInvoiceFetchResult {
 id?:string;entity?:string;subscription_id?:string|null;payment_id?:string|null;order_id?:string|null;
 status?:string;currency?:string;amount?:number;amount_paid?:number;amount_due?:number;gross_amount?:number;
 billing_start?:number|null;billing_end?:number|null;partial_payment?:boolean;line_items?:RazorpayInvoiceLine[];
 error?:{description?:string};
}
export async function fetchRazorpaySubscription(credentials:RazorpayCredentials,subscriptionId:string,options:{fetch?:RazorpayFetch}={}):Promise<RazorpaySubscriptionFetchResult>{
 if(!/^sub_[A-Za-z0-9]+$/.test(subscriptionId)||subscriptionId.length>120)return {error:{description:'Invalid Razorpay subscription reference'}};
 const response=await (options.fetch??fetch)(`${RAZORPAY_API_ORIGIN}/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,{method:'GET',headers:{Authorization:basicAuth(credentials)}});
 if(!response.ok)return {error:{description:`Razorpay subscription lookup failed with ${response.status}`}};
 const raw=asRecord(await response.json().catch(()=>null));
 return Object.fromEntries(['id','entity','plan_id','status','quantity','current_start','current_end','start_at','paid_count','total_count'].filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]])) as RazorpaySubscriptionFetchResult;
}
export async function fetchRazorpayInvoice(credentials:RazorpayCredentials,invoiceId:string,options:{fetch?:RazorpayFetch}={}):Promise<RazorpayInvoiceFetchResult>{
 if(!/^inv_[A-Za-z0-9]+$/.test(invoiceId)||invoiceId.length>120)return {error:{description:'Invalid Razorpay invoice reference'}};
 const response=await (options.fetch??fetch)(`${RAZORPAY_API_ORIGIN}/v1/invoices/${encodeURIComponent(invoiceId)}`,{method:'GET',headers:{Authorization:basicAuth(credentials)}});
 if(!response.ok)return {error:{description:`Razorpay invoice lookup failed with ${response.status}`}};
 const raw=asRecord(await response.json().catch(()=>null));
 if(!Array.isArray(raw.line_items)||raw.line_items.length>50)return {error:{description:'Razorpay invoice lines are unavailable'}};
 const result=Object.fromEntries(['id','entity','subscription_id','payment_id','order_id','status','currency','amount','amount_paid','amount_due','gross_amount','billing_start','billing_end','partial_payment'].filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]]));
 return {...result,line_items:raw.line_items.map(line=>{const row=asRecord(line);return Object.fromEntries(['id','type','name','quantity','currency','amount','unit_amount','gross_amount','tax_amount'].filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));})} as RazorpayInvoiceFetchResult;
}
