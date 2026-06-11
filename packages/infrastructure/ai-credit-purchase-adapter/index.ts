export type AiCreditPurchaseMode = 'sandbox' | 'live';
export type AiCreditPurchaseProvider = 'letbuyy_sandbox' | 'razorpay' | 'manual';
export type AiCreditPurchaseStatus = 'completed' | 'unavailable';

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
    super('AI credit purchase live provider client is not implemented');
    this.name = 'AiCreditPurchaseLiveProviderUnavailableError';
  }
}

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

export function createAiCreditPurchaseAdapter(
  credentials: AiCreditPurchaseCredentials,
): AiCreditPurchaseAdapter {
  const mode = normalizeMode(credentials);
  const provider = normalizeProvider(credentials.provider);
  const pricePerCreditMinor = normalizePrice(credentials.pricePerCreditMinor);
  const currency = normalizeCurrency(credentials.currency);
  const available = mode === 'sandbox';
  const unavailableReason = available ? null : 'AI credit purchase live provider client is not implemented';

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

      throw new AiCreditPurchaseLiveProviderUnavailableError();
    },
  };
}
