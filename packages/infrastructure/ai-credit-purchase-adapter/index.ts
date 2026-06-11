export type AiCreditPurchaseMode = 'sandbox' | 'live';
export type AiCreditPurchaseProvider = 'letbuyy_sandbox' | 'razorpay' | 'manual';
export type AiCreditPurchaseStatus = 'completed' | 'pending_provider_payment' | 'unavailable';

export interface AiCreditPurchaseCredentials {
  mode?: AiCreditPurchaseMode | string | null;
  provider?: AiCreditPurchaseProvider | string | null;
  razorpayKeyId?: string | null;
  razorpayKeySecret?: string | null;
  pricePerCreditMinor?: string | number | null;
  currency?: string | null;
  environment?: string | null;
  appEnv?: string | null;
  nodeEnv?: string | null;
  fetch?: typeof fetch;
}

export interface PurchaseAiCreditsInput {
  storeId: string;
  userId: string;
  credits: number;
  idempotencyKey: string;
}

export interface AiCreditPurchaseResult {
  id: string;
  provider: AiCreditPurchaseProvider;
  providerMode: AiCreditPurchaseMode;
  status: AiCreditPurchaseStatus;
  credits: number;
  amountMinor: number;
  currency: string;
  providerReference: string | null;
  checkoutUrl: string | null;
  metadata: Record<string, unknown>;
}

export interface AiCreditPurchaseAdapter {
  provider: AiCreditPurchaseProvider;
  mode: AiCreditPurchaseMode;
  available: boolean;
  unavailableReason: string | null;
  pricePerCreditMinor: number;
  currency: string;
  purchase(input: PurchaseAiCreditsInput): Promise<AiCreditPurchaseResult>;
}

export const AI_CREDIT_PURCHASE_LIVE_PROVIDER_UNAVAILABLE = 'AI_CREDIT_PURCHASE_LIVE_PROVIDER_UNAVAILABLE';

export class AiCreditPurchaseLiveProviderUnavailableError extends Error {
  readonly code = AI_CREDIT_PURCHASE_LIVE_PROVIDER_UNAVAILABLE;

  constructor() {
    super('AI credit purchase live provider integration is unavailable until SKIP-CAP-AI-CREDIT-PURCHASE-PROVIDER ships');
    this.name = 'AiCreditPurchaseLiveProviderUnavailableError';
  }
}

type RazorpayPaymentLinkResponse = {
  id?: string;
  short_url?: string;
  status?: string;
  error?: { description?: string | null } | null;
};

function isProductionRuntime(credentials: AiCreditPurchaseCredentials): boolean {
  return [credentials.environment, credentials.appEnv, credentials.nodeEnv]
    .some((value) => value?.toLowerCase() === 'production');
}

function normalizeMode(credentials: AiCreditPurchaseCredentials): AiCreditPurchaseMode {
  if (credentials.mode === 'sandbox' || credentials.mode === 'live') return credentials.mode;
  return isProductionRuntime(credentials) ? 'live' : 'sandbox';
}

function normalizeProvider(provider: AiCreditPurchaseCredentials['provider']): AiCreditPurchaseProvider {
  return provider === 'razorpay' || provider === 'manual' ? provider : 'letbuyy_sandbox';
}

function normalizeCurrency(currency: string | null | undefined): string {
  const normalized = currency?.trim().toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : 'INR';
}

function normalizePrice(value: AiCreditPurchaseCredentials['pricePerCreditMinor']): number {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
}

function configuredSecret(value: string | null | undefined): value is string {
  return Boolean(value && !value.toLowerCase().includes('placeholder') && !value.toLowerCase().includes('skip_needs_human'));
}

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

function safeReferencePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18) || 'ref';
}

function paymentLinkReference(input: PurchaseAiCreditsInput): string {
  return `ai_${safeReferencePart(input.storeId)}_${safeReferencePart(input.idempotencyKey)}`.slice(0, 40);
}

function sandboxPurchase(
  adapter: Pick<AiCreditPurchaseAdapter, 'provider' | 'mode' | 'pricePerCreditMinor' | 'currency'>,
  input: PurchaseAiCreditsInput,
): AiCreditPurchaseResult {
  const amountMinor = input.credits * adapter.pricePerCreditMinor;
  return {
    id: `ai_credit_${input.idempotencyKey}`,
    provider: 'letbuyy_sandbox',
    providerMode: 'sandbox',
    status: 'completed',
    credits: input.credits,
    amountMinor,
    currency: adapter.currency,
    providerReference: `sandbox:${input.storeId}:${input.credits}`,
    checkoutUrl: null,
    metadata: {
      sandbox: true,
      store_id: input.storeId,
      user_id: input.userId,
    },
  };
}

async function razorpayPaymentLinkPurchase(
  credentials: { razorpayKeyId: string; razorpayKeySecret: string },
  adapter: Pick<AiCreditPurchaseAdapter, 'pricePerCreditMinor' | 'currency'>,
  input: PurchaseAiCreditsInput,
  fetchImpl: typeof fetch,
): Promise<AiCreditPurchaseResult> {
  const amountMinor = input.credits * adapter.pricePerCreditMinor;
  const referenceId = paymentLinkReference(input);
  const response = await fetchImpl('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(credentials.razorpayKeyId, credentials.razorpayKeySecret),
    },
    body: JSON.stringify({
      amount: amountMinor,
      currency: adapter.currency,
      accept_partial: false,
      reference_id: referenceId,
      description: `LetBuyy AI credits (${input.credits})`,
      notes: {
        source_type: 'ai_credit_purchase',
        store_id: input.storeId,
        user_id: input.userId,
        credits: String(input.credits),
        idempotency_key: input.idempotencyKey,
      },
    }),
  });
  const data = await response.json().catch(() => ({})) as RazorpayPaymentLinkResponse;

  if (!response.ok || data.error || !data.id || !data.short_url) {
    throw new AiCreditPurchaseLiveProviderUnavailableError();
  }

  return {
    id: `ai_credit_${input.idempotencyKey}`,
    provider: 'razorpay',
    providerMode: 'live',
    status: 'pending_provider_payment',
    credits: input.credits,
    amountMinor,
    currency: adapter.currency,
    providerReference: data.id,
    checkoutUrl: data.short_url,
    metadata: {
      provider_link_id: data.id,
      provider_reference_id: referenceId,
      razorpay_payment_link_status: data.status || null,
      credit_grant_deferred_until_provider_webhook: true,
    },
  };
}

export function createAiCreditPurchaseAdapter(
  credentials: AiCreditPurchaseCredentials,
): AiCreditPurchaseAdapter {
  const mode = normalizeMode(credentials);
  const provider = normalizeProvider(credentials.provider);
  const pricePerCreditMinor = normalizePrice(credentials.pricePerCreditMinor);
  const currency = normalizeCurrency(credentials.currency);
  const liveRazorpayKeyId = configuredSecret(credentials.razorpayKeyId) ? credentials.razorpayKeyId : null;
  const liveRazorpayKeySecret = configuredSecret(credentials.razorpayKeySecret) ? credentials.razorpayKeySecret : null;
  const liveRazorpayAvailable = mode === 'live'
    && provider === 'razorpay'
    && Boolean(liveRazorpayKeyId && liveRazorpayKeySecret);
  const available = mode === 'sandbox' || liveRazorpayAvailable;
  const unavailableReason = available ? null : 'AI credit purchase live provider credentials and webhook certification are unavailable until SKIP-CAP-AI-CREDIT-PURCHASE-PROVIDER ships';

  return {
    provider,
    mode,
    available,
    unavailableReason,
    pricePerCreditMinor,
    currency,
    async purchase(input) {
      if (!Number.isInteger(input.credits) || input.credits <= 0) {
        throw new Error('Credits must be a positive integer');
      }

      if (mode === 'sandbox') {
        return sandboxPurchase({ provider, mode, pricePerCreditMinor, currency }, input);
      }

      if (provider === 'razorpay' && liveRazorpayKeyId && liveRazorpayKeySecret) {
        return razorpayPaymentLinkPurchase(
          {
            razorpayKeyId: liveRazorpayKeyId,
            razorpayKeySecret: liveRazorpayKeySecret,
          },
          { pricePerCreditMinor, currency },
          input,
          credentials.fetch ?? fetch,
        );
      }

      throw new AiCreditPurchaseLiveProviderUnavailableError();
    },
  };
}
