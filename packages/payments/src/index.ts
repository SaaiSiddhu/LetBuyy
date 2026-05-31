import type {
  CurrencyCode,
  MoneyMinorUnit,
  PaymentMethod as SharedPaymentMethod,
  PaymentProvider as SharedPaymentProviderName,
  PaymentStatus as SharedPaymentStatus,
} from '@letbuyy/shared-types';

export const INR_CURRENCY = 'INR' as const;
export const INR_MINOR_UNITS_PER_MAJOR = 100;
export const MAX_INR_MINOR_UNITS = 9_999_999_999;
export const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 200;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]+$/;

export type InrCurrencyCode = typeof INR_CURRENCY;
export type PaymentCurrencyCode = Extract<CurrencyCode, InrCurrencyCode> | InrCurrencyCode;
export type PaymentProviderName = Exclude<SharedPaymentProviderName, 'manual'>;
export type PaymentMethodName = SharedPaymentMethod;
export type PaymentLifecycleStatus = SharedPaymentStatus;
export type PaymentMetadata = Record<string, unknown>;
export type PaymentWebhookHeaders = Record<string, string | string[] | undefined>;
export type PaymentProviderReference = {
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  providerCustomerId?: string;
  providerEventId?: string;
};

declare const idempotencyKeyBrand: unique symbol;
export type IdempotencyKey = string & { readonly [idempotencyKeyBrand]: true };

export interface PaymentMoney {
  amountMinor: MoneyMinorUnit;
  currency: PaymentCurrencyCode;
}

export interface PaymentCustomerSnapshot {
  id?: string;
  email?: string;
  phone?: string;
  name?: string;
}

export interface PaymentCreateIntentInput {
  storeId: string;
  orderId: string;
  amount: PaymentMoney;
  idempotencyKey: IdempotencyKey | string;
  method?: PaymentMethodName;
  customer?: PaymentCustomerSnapshot;
  receipt?: string;
  description?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentIntentResult {
  provider: PaymentProviderName;
  status: Extract<PaymentLifecycleStatus, 'pending' | 'requires_action' | 'authorized'>;
  amount: PaymentMoney;
  idempotencyKey: IdempotencyKey;
  references: PaymentProviderReference;
  clientSecret?: string;
  redirectUrl?: string;
  expiresAt?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentVerifyInput extends PaymentProviderReference {
  storeId: string;
  orderId: string;
  amount: PaymentMoney;
  idempotencyKey: IdempotencyKey | string;
  signature?: string;
  rawPayload?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentVerificationResult {
  provider: PaymentProviderName;
  verified: boolean;
  status: Extract<PaymentLifecycleStatus, 'authorized' | 'paid' | 'failed'>;
  amount: PaymentMoney;
  references: PaymentProviderReference;
  failureCode?: string;
  failureMessage?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentCaptureInput extends PaymentProviderReference {
  storeId: string;
  orderId: string;
  amount: PaymentMoney;
  idempotencyKey: IdempotencyKey | string;
  metadata?: PaymentMetadata;
}

export interface PaymentCaptureResult {
  provider: PaymentProviderName;
  status: Extract<PaymentLifecycleStatus, 'paid' | 'failed'>;
  capturedAmount: PaymentMoney;
  references: PaymentProviderReference;
  failureCode?: string;
  failureMessage?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentRefundInput extends PaymentProviderReference {
  storeId: string;
  orderId: string;
  paymentId: string;
  amount: PaymentMoney;
  idempotencyKey: IdempotencyKey | string;
  reason?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentRefundResult {
  provider: PaymentProviderName;
  status: Extract<PaymentLifecycleStatus, 'refunded' | 'partially_refunded' | 'failed'>;
  refundedAmount: PaymentMoney;
  references: PaymentProviderReference;
  failureCode?: string;
  failureMessage?: string;
  metadata?: PaymentMetadata;
}

export interface PaymentWebhookVerifyInput {
  provider: PaymentProviderName;
  rawBody: string;
  headers: PaymentWebhookHeaders;
  secret: string;
  receivedAt: string;
}

export interface PaymentWebhookEvent {
  id: string;
  provider: PaymentProviderName;
  type: string;
  occurredAt?: string;
  references: PaymentProviderReference;
  payload: PaymentMetadata;
}

export interface PaymentWebhookVerificationResult {
  provider: PaymentProviderName;
  verified: boolean;
  event?: PaymentWebhookEvent;
  failureCode?: string;
  failureMessage?: string;
}

/**
 * Provider adapters implement the only payment-side-effect contract used by
 * services. Every method must verify amounts in INR minor units and must treat
 * the idempotency key as part of the provider or persistence request.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createIntent(input: PaymentCreateIntentInput): Promise<PaymentIntentResult>;
  verify(input: PaymentVerifyInput): Promise<PaymentVerificationResult>;
  capture(input: PaymentCaptureInput): Promise<PaymentCaptureResult>;
  refund(input: PaymentRefundInput): Promise<PaymentRefundResult>;
  webhookVerify(input: PaymentWebhookVerifyInput): Promise<PaymentWebhookVerificationResult>;
}

export function isValidInrMinorUnits(value: number): value is MoneyMinorUnit {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_INR_MINOR_UNITS;
}

export function assertInrMinorUnits(value: number): MoneyMinorUnit {
  if (!isValidInrMinorUnits(value)) {
    throw new Error(`INR amount must be an integer between 0 and ${MAX_INR_MINOR_UNITS} paise`);
  }
  return value;
}

export function inrMoney(amountMinor: number): PaymentMoney {
  return {
    amountMinor: assertInrMinorUnits(amountMinor),
    currency: INR_CURRENCY,
  };
}

export function toInrMinorUnits(amountMajor: number | string): MoneyMinorUnit {
  const value = typeof amountMajor === 'number' ? amountMajor.toString() : amountMajor.trim();
  const match = value.match(/^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/);

  if (!match) {
    throw new Error('INR major amount must be a non-negative rupee value with at most two paise digits');
  }

  const major = Number(match[1]);
  const minor = Number((match[2] ?? '').padEnd(2, '0'));
  return assertInrMinorUnits((major * INR_MINOR_UNITS_PER_MAJOR) + minor);
}

export function fromInrMinorUnits(amountMinor: number): string {
  const normalized = assertInrMinorUnits(amountMinor);
  const major = Math.floor(normalized / INR_MINOR_UNITS_PER_MAJOR);
  const minor = String(normalized % INR_MINOR_UNITS_PER_MAJOR).padStart(2, '0');
  return `${major}.${minor}`;
}

export function isValidIdempotencyKey(value: string): value is IdempotencyKey {
  return (
    value.length >= IDEMPOTENCY_KEY_MIN_LENGTH &&
    value.length <= IDEMPOTENCY_KEY_MAX_LENGTH &&
    IDEMPOTENCY_KEY_PATTERN.test(value)
  );
}

export function normalizeIdempotencyKey(value: string): IdempotencyKey {
  const normalized = value.trim();
  if (!isValidIdempotencyKey(normalized)) {
    throw new Error(
      `Idempotency key must be ${IDEMPOTENCY_KEY_MIN_LENGTH}-${IDEMPOTENCY_KEY_MAX_LENGTH} characters and contain only letters, numbers, colon, underscore, or hyphen`,
    );
  }
  return normalized;
}

export function normalizePaymentMoney(value: PaymentMoney): PaymentMoney {
  if (value.currency !== INR_CURRENCY) {
    throw new Error('Payment money currently supports INR only');
  }
  return inrMoney(value.amountMinor);
}
