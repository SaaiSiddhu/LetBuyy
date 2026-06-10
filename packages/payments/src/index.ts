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
export type PaymentProviderMode = 'sandbox' | 'live';
export type V1PaymentSessionProvider = Extract<PaymentProviderName, 'razorpay' | 'cashfree' | 'upi' | 'cod'>;
export type V1PaymentSessionStatus = 'pending' | 'requires_action' | 'authorized' | 'captured' | 'failed' | 'voided' | 'refunded';
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

export interface PaymentSessionPlanInput {
  provider: V1PaymentSessionProvider;
  mode?: string | null;
  productionRuntime?: boolean;
  orderId: string;
  amount: PaymentMoney;
  idempotencyKey: IdempotencyKey | string;
  merchantCredentialPresent?: boolean;
  metadata?: PaymentMetadata;
}

export interface PaymentSessionPlan {
  provider: V1PaymentSessionProvider;
  mode: PaymentProviderMode;
  status: Extract<V1PaymentSessionStatus, 'pending' | 'requires_action' | 'authorized'>;
  amount: PaymentMoney;
  idempotencyKey: IdempotencyKey;
  providerOrderId: string;
  providerSessionId: string;
  clientAction: 'none' | 'redirect' | 'upi_collect' | 'cod_confirm';
  expiresInSeconds: number;
  metadata: PaymentMetadata;
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

export function isProductionRuntime(input?: {
  environment?: string | null;
  nodeEnv?: string | null;
  vercelEnv?: string | null;
  mode?: string | null;
} | null): boolean {
  const values = [
    input?.environment,
    input?.nodeEnv,
    input?.vercelEnv,
    input?.mode,
  ].map((value) => String(value || '').trim().toLowerCase());

  return values.some((value) => value === 'production' || value === 'prod' || value === 'live');
}

export function resolvePaymentProviderMode(
  value?: string | null,
  options?: { productionRuntime?: boolean },
): PaymentProviderMode {
  const normalized = (value || (options?.productionRuntime ? 'live' : 'sandbox')).trim().toLowerCase();
  if (normalized === 'sandbox' || normalized === 'live') {
    return normalized;
  }
  throw new Error('Payment provider mode must be sandbox or live');
}

export function normalizeV1PaymentSessionProvider(value: string): V1PaymentSessionProvider {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'razorpay' || normalized === 'cashfree' || normalized === 'upi' || normalized === 'cod') {
    return normalized;
  }
  throw new Error('Unsupported V1 payment session provider');
}

export function livePaymentCredentialsAreRequired(input: {
  provider: V1PaymentSessionProvider;
  mode: PaymentProviderMode;
  merchantCredentialPresent?: boolean;
}): boolean {
  return input.mode === 'live' && input.merchantCredentialPresent !== true;
}

export function buildSandboxPaymentSessionPlan(input: PaymentSessionPlanInput): PaymentSessionPlan {
  const provider = input.provider;
  const mode = resolvePaymentProviderMode(input.mode, { productionRuntime: input.productionRuntime });
  const amount = normalizePaymentMoney(input.amount);
  const idempotencyKey = normalizeIdempotencyKey(String(input.idempotencyKey));
  const providerOrderId = `${provider}_${mode}_${input.orderId}`;
  const clientAction: PaymentSessionPlan['clientAction'] = provider === 'upi'
    ? 'upi_collect'
    : provider === 'cod'
      ? 'cod_confirm'
      : 'redirect';

  return {
    provider,
    mode,
    status: provider === 'cod' ? 'requires_action' : 'pending',
    amount,
    idempotencyKey,
    providerOrderId,
    providerSessionId: `${provider}_${mode}_session_${idempotencyKey}`,
    clientAction,
    expiresInSeconds: provider === 'cod' ? 86400 : 900,
    metadata: {
      ...(input.metadata || {}),
      provider,
      provider_mode: mode,
      external_rail: provider,
    },
  };
}

export const LEDGER_ACCOUNT_CODES = [
  'pa_clearing',
  'merchant_payable',
  'platform_revenue',
  'gst_payable',
  'cod_receivable',
  'reserve',
  'vendor_payable',
  'refund_clearing',
] as const;

export type LedgerAccountCode = (typeof LEDGER_ACCOUNT_CODES)[number];
export type LedgerSide = 'debit' | 'credit';

export interface LedgerPostingLine {
  accountCode: LedgerAccountCode;
  side: LedgerSide;
  amountMinor: MoneyMinorUnit;
  currency: PaymentCurrencyCode;
  memo?: string;
}

export interface LedgerPostingPlan {
  siteId: string;
  currency: PaymentCurrencyCode;
  sourceType: 'payment_capture' | 'refund' | 'settlement' | 'cod_remittance' | 'payout' | 'reversal';
  sourceId: string;
  idempotencyKey: IdempotencyKey | string;
  lines: readonly LedgerPostingLine[];
}

export interface PaymentCaptureLedgerPostingInput {
  siteId: string;
  orderId: string;
  providerPaymentId: string;
  grossAmountMinor: number;
  platformFeeMinor: number;
  gstMinor: number;
  idempotencyKey: IdempotencyKey | string;
}

export interface PaymentRefundLedgerPostingInput {
  siteId: string;
  paymentId: string;
  providerRefundId: string;
  refundAmountMinor: number;
  idempotencyKey: IdempotencyKey | string;
}

function assertLedgerAccountCode(value: LedgerAccountCode): LedgerAccountCode {
  if (!LEDGER_ACCOUNT_CODES.includes(value)) {
    throw new Error(`Unsupported ledger account code: ${value}`);
  }
  return value;
}

function normalizeLedgerLine(line: LedgerPostingLine, expectedCurrency: PaymentCurrencyCode): LedgerPostingLine {
  if (line.currency !== expectedCurrency) {
    throw new Error('Ledger posting lines must use a single currency');
  }

  return {
    accountCode: assertLedgerAccountCode(line.accountCode),
    side: line.side,
    amountMinor: assertInrMinorUnits(line.amountMinor),
    currency: expectedCurrency,
    memo: line.memo,
  };
}

export function signedLedgerAmountMinor(line: LedgerPostingLine): bigint {
  const amount = BigInt(assertInrMinorUnits(line.amountMinor));
  return line.side === 'debit' ? amount : -amount;
}

export function assertBalancedLedgerLines(
  lines: readonly LedgerPostingLine[],
  currency: PaymentCurrencyCode = INR_CURRENCY,
): readonly LedgerPostingLine[] {
  if (lines.length < 2) {
    throw new Error('A double-entry posting must contain at least two ledger lines');
  }

  let debitTotal = 0n;
  let creditTotal = 0n;
  const normalized = lines.map((line) => normalizeLedgerLine(line, currency));

  for (const line of normalized) {
    if (line.amountMinor <= 0) {
      throw new Error('Ledger line amount must be positive');
    }

    if (line.side === 'debit') {
      debitTotal += BigInt(line.amountMinor);
    } else {
      creditTotal += BigInt(line.amountMinor);
    }
  }

  if (debitTotal !== creditTotal) {
    throw new Error(`Ledger posting must balance: debit=${debitTotal.toString()} credit=${creditTotal.toString()}`);
  }

  return normalized;
}

export function reverseLedgerLines(lines: readonly LedgerPostingLine[]): readonly LedgerPostingLine[] {
  return lines.map((line) => ({
    ...line,
    side: line.side === 'debit' ? 'credit' : 'debit',
    memo: line.memo ? `Reversal: ${line.memo}` : 'Reversal',
  }));
}

export function buildPaymentCaptureLedgerPosting(input: PaymentCaptureLedgerPostingInput): LedgerPostingPlan {
  const grossAmountMinor = assertInrMinorUnits(input.grossAmountMinor);
  const platformFeeMinor = assertInrMinorUnits(input.platformFeeMinor);
  const gstMinor = assertInrMinorUnits(input.gstMinor);
  const merchantPayableMinor = assertInrMinorUnits(grossAmountMinor - platformFeeMinor - gstMinor);

  const lines: LedgerPostingLine[] = [
    {
      accountCode: 'pa_clearing',
      side: 'debit',
      amountMinor: grossAmountMinor,
      currency: INR_CURRENCY,
      memo: `Provider capture ${input.providerPaymentId}`,
    },
    {
      accountCode: 'merchant_payable',
      side: 'credit',
      amountMinor: merchantPayableMinor,
      currency: INR_CURRENCY,
      memo: `Merchant payable for order ${input.orderId}`,
    },
  ];

  if (platformFeeMinor > 0) {
    lines.push({
      accountCode: 'platform_revenue',
      side: 'credit',
      amountMinor: platformFeeMinor,
      currency: INR_CURRENCY,
      memo: `Platform revenue for order ${input.orderId}`,
    });
  }

  if (gstMinor > 0) {
    lines.push({
      accountCode: 'gst_payable',
      side: 'credit',
      amountMinor: gstMinor,
      currency: INR_CURRENCY,
      memo: `GST payable for order ${input.orderId}`,
    });
  }

  return {
    siteId: input.siteId,
    currency: INR_CURRENCY,
    sourceType: 'payment_capture',
    sourceId: input.providerPaymentId,
    idempotencyKey: normalizeIdempotencyKey(String(input.idempotencyKey)),
    lines: assertBalancedLedgerLines(lines, INR_CURRENCY),
  };
}

export function buildPaymentRefundLedgerPosting(input: PaymentRefundLedgerPostingInput): LedgerPostingPlan {
  const refundAmountMinor = assertInrMinorUnits(input.refundAmountMinor);
  const lines: LedgerPostingLine[] = [
    {
      accountCode: 'merchant_payable',
      side: 'debit',
      amountMinor: refundAmountMinor,
      currency: INR_CURRENCY,
      memo: `Merchant payable refund ${input.paymentId}`,
    },
    {
      accountCode: 'refund_clearing',
      side: 'credit',
      amountMinor: refundAmountMinor,
      currency: INR_CURRENCY,
      memo: `Provider refund ${input.providerRefundId}`,
    },
  ];

  return {
    siteId: input.siteId,
    currency: INR_CURRENCY,
    sourceType: 'refund',
    sourceId: input.providerRefundId,
    idempotencyKey: normalizeIdempotencyKey(String(input.idempotencyKey)),
    lines: assertBalancedLedgerLines(lines, INR_CURRENCY),
  };
}

export function buildReversalLedgerPosting(
  original: LedgerPostingPlan,
  reversalId: string,
  idempotencyKey: IdempotencyKey | string,
): LedgerPostingPlan {
  return {
    siteId: original.siteId,
    currency: original.currency,
    sourceType: 'reversal',
    sourceId: reversalId,
    idempotencyKey: normalizeIdempotencyKey(String(idempotencyKey)),
    lines: assertBalancedLedgerLines(reverseLedgerLines(original.lines), original.currency),
  };
}
