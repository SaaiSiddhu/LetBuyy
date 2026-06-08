export type MerchantPayoutRail = 'razorpay_route' | 'razorpayx' | 'upi' | 'manual';
export type PayoutTransferMode = 'sandbox' | 'live';
export type PayoutTransferStatus = 'processing' | 'released' | 'failed';

export interface PayoutTransferCredentials {
  keyId?: string | null;
  keySecret?: string | null;
  accountId?: string | null;
}

export interface PayoutTransferOptions {
  mode?: PayoutTransferMode;
  rail?: MerchantPayoutRail;
  credentials?: PayoutTransferCredentials;
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

function safeToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 24) || 'PAYOUT';
}

function assertLiveCredentials(rail: MerchantPayoutRail, credentials: PayoutTransferCredentials | undefined) {
  if (rail === 'manual') return;
  if (credentials?.keyId && credentials.keySecret) return;
  throw new Error(`${rail} live payout mode requires provider credentials`);
}

export function createPayoutTransferAdapter(options: PayoutTransferOptions = {}): PayoutTransferAdapter {
  const mode = normalizeMode(options.mode);
  const rail = normalizeRail(options.rail);

  if (mode === 'live') assertLiveCredentials(rail, options.credentials);

  return {
    rail,
    mode,

    async initiateTransfer(input) {
      if (input.amountMinor < 0) {
        throw new Error('Payout transfer amount cannot be negative');
      }
      const now = (options.now || (() => new Date()))().toISOString();

      if (mode === 'sandbox') {
        const referenceToken = safeToken(`${input.siteId}-${input.statementId}-${input.idempotencyKey}`);
        return {
          rail,
          mode,
          status: 'released',
          providerReference: `sandbox_${rail}_${referenceToken}`,
          utr: `UTR${referenceToken.slice(0, 16)}`,
          failureReason: null,
          processedAt: now,
        };
      }

      return {
        rail,
        mode,
        status: 'processing',
        providerReference: `${rail}_${safeToken(input.statementId)}`,
        utr: null,
        failureReason: null,
        processedAt: now,
      };
    },
  };
}
