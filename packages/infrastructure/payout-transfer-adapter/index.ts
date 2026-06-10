export type MerchantPayoutRail = 'razorpay_route' | 'razorpayx' | 'upi' | 'manual';
export type PayoutTransferMode = 'sandbox' | 'live';
export type PayoutTransferStatus = 'processing' | 'released' | 'failed';

export class PayoutProviderUnavailable extends Error {
  readonly code = 'PAYOUT_PROVIDER_UNAVAILABLE';

  constructor(message = 'Payout provider credentials or client are unavailable') {
    super(message);
    this.name = 'PayoutProviderUnavailable';
  }
}

export interface PayoutTransferCredentials {
  keyId?: string | null;
  keySecret?: string | null;
  accountId?: string | null;
}

export interface PayoutTransferOptions {
  mode?: PayoutTransferMode;
  rail?: MerchantPayoutRail;
  credentials?: PayoutTransferCredentials;
  provider?: PayoutProviderClient;
  now?: () => Date;
}

export interface InitiatePayoutTransferInput {
  statementId: string;
  siteId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  beneficiaryName?: string | null;
  metadata?: Record<string, string>;
}

export interface PayoutTransferResult {
  rail: MerchantPayoutRail;
  mode: PayoutTransferMode;
  status: PayoutTransferStatus;
  providerReference: string | null;
  utr: string | null;
  failureReason: string | null;
  processedAt: string;
}

export interface PayoutProviderClient {
  initiateTransfer(input: InitiatePayoutTransferInput & {
    rail: MerchantPayoutRail;
    mode: PayoutTransferMode;
    credentials: PayoutTransferCredentials;
  }): Promise<{
    status: PayoutTransferStatus;
    providerReference: string | null;
    utr?: string | null;
    failureReason?: string | null;
    processedAt?: string | null;
  }>;
}

export interface PayoutTransferAdapter {
  rail: MerchantPayoutRail;
  mode: PayoutTransferMode;
  initiateTransfer(input: InitiatePayoutTransferInput): Promise<PayoutTransferResult>;
}

function normalizeMode(mode: PayoutTransferMode | undefined): PayoutTransferMode {
  return mode === 'live' ? 'live' : 'sandbox';
}

function normalizeRail(rail: MerchantPayoutRail | undefined): MerchantPayoutRail {
  return rail || 'razorpay_route';
}

function assertProviderReady(
  rail: MerchantPayoutRail,
  credentials: PayoutTransferCredentials | undefined,
  provider: PayoutProviderClient | undefined,
): PayoutTransferCredentials {
  if (rail === 'manual') {
    throw new PayoutProviderUnavailable('Manual payout release must be executed by a human runbook, not the API adapter');
  }
  if (credentials?.keyId && credentials.keySecret) return credentials;
  if (!provider) throw new PayoutProviderUnavailable(`${rail} payout provider client is not configured`);
  throw new PayoutProviderUnavailable(`${rail} payout provider credentials are not configured`);
}

export function createPayoutTransferAdapter(options: PayoutTransferOptions = {}): PayoutTransferAdapter {
  const mode = normalizeMode(options.mode);
  const rail = normalizeRail(options.rail);

  return {
    rail,
    mode,

    async initiateTransfer(input) {
      if (input.amountMinor <= 0) {
        throw new Error('Payout transfer amount must be positive');
      }
      const now = (options.now || (() => new Date()))().toISOString();
      const credentials = assertProviderReady(rail, options.credentials, options.provider);
      if (!options.provider) {
        throw new PayoutProviderUnavailable(`${rail} payout provider client is not configured`);
      }

      const providerResult = await options.provider.initiateTransfer({
        ...input,
        rail,
        mode,
        credentials,
      });
      return {
        rail,
        mode,
        status: providerResult.status,
        providerReference: providerResult.providerReference,
        utr: providerResult.utr || null,
        failureReason: providerResult.failureReason || null,
        processedAt: providerResult.processedAt || now,
      };
    },
  };
}
