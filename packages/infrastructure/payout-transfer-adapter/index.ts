export type MerchantPayoutRail = 'razorpay_route' | 'upi' | 'manual';
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

type JsonRecord = Record<string, unknown>;

interface FetchResponseLike {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<FetchResponseLike>;

export interface RazorpayRouteProviderOptions {
  fetch?: FetchLike;
  baseUrl?: string;
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
  if (!provider) throw new PayoutProviderUnavailable(`${rail} payout provider client is not configured`);
  if (credentials?.keyId && credentials.keySecret && (rail !== 'razorpay_route' || credentials.accountId)) return credentials;
  if (rail === 'razorpay_route' && !credentials?.accountId) {
    throw new PayoutProviderUnavailable('Razorpay Route linked account id is not configured');
  }
  throw new PayoutProviderUnavailable(`${rail} payout provider credentials are not configured`);
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function providerFailureReason(payload: JsonRecord, response?: FetchResponseLike): string {
  const error = asRecord(payload.error);
  return stringValue(error.description)
    || stringValue(error.reason)
    || stringValue(error.code)
    || stringValue(payload.description)
    || response?.statusText
    || 'Payout provider rejected the transfer';
}

function normalizeProviderStatus(value: unknown): PayoutTransferStatus {
  const status = stringValue(value)?.toLowerCase();
  if (status === 'processed' || status === 'settled' || status === 'completed' || status === 'released') return 'released';
  if (status === 'failed' || status === 'reversed' || status === 'cancelled') return 'failed';
  return 'processing';
}

function timestampToIso(value: unknown): string | null {
  const seconds = numberValue(value);
  if (seconds !== null) return new Date(seconds * 1000).toISOString();
  const text = stringValue(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function encodeBasicAuth(keyId: string, keySecret: string): string {
  if (typeof btoa !== 'function') {
    throw new PayoutProviderUnavailable('Base64 encoder is unavailable for provider authentication');
  }
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

function resolveFetch(fetchOverride: FetchLike | undefined): FetchLike {
  const runtimeFetch = globalThis.fetch as unknown as FetchLike | undefined;
  const fetcher = fetchOverride || runtimeFetch;
  if (!fetcher) throw new PayoutProviderUnavailable('Fetch client is unavailable for payout provider calls');
  return fetcher;
}

export function createRazorpayRoutePayoutProviderClient(
  options: RazorpayRouteProviderOptions = {},
): PayoutProviderClient {
  const baseUrl = (options.baseUrl || 'https://api.razorpay.com/v1').replace(/\/+$/, '');
  const fetcher = resolveFetch(options.fetch);

  return {
    async initiateTransfer(input) {
      if (input.rail !== 'razorpay_route') {
        throw new PayoutProviderUnavailable(`${input.rail} is not supported by the Razorpay Route provider client`);
      }
      const { keyId, keySecret, accountId } = input.credentials;
      if (!keyId || !keySecret || !accountId) {
        throw new PayoutProviderUnavailable('Razorpay Route payout credentials are not configured');
      }

      const response = await fetcher(`${baseUrl}/transfers`, {
        method: 'POST',
        headers: {
          Authorization: encodeBasicAuth(keyId, keySecret),
          'Content-Type': 'application/json',
          'Idempotency-Key': input.idempotencyKey,
        },
        body: JSON.stringify({
          account: accountId,
          amount: input.amountMinor,
          currency: input.currency,
          notes: {
            site_id: input.siteId,
            statement_id: input.statementId,
            beneficiary_name: input.beneficiaryName || undefined,
            ...(input.metadata || {}),
          },
          reference_id: input.idempotencyKey,
        }),
      });

      const payload = asRecord(await response.json().catch(async () => {
        const text = await response.text().catch(() => '');
        return text ? { description: text } : {};
      }));
      if (!response.ok) {
        return {
          status: 'failed',
          providerReference: stringValue(payload.id) || null,
          utr: null,
          failureReason: providerFailureReason(payload, response),
        };
      }

      const status = normalizeProviderStatus(payload.status);
      return {
        status,
        providerReference: stringValue(payload.id) || stringValue(payload.transfer_id) || null,
        utr: stringValue(payload.utr) || stringValue(payload.settlement_utr) || null,
        failureReason: status === 'failed' ? providerFailureReason(payload) : null,
        processedAt: timestampToIso(payload.processed_at) || timestampToIso(payload.created_at),
      };
    },
  };
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
      const provider = options.provider;
      const credentials = assertProviderReady(rail, options.credentials, provider);
      if (!provider) {
        throw new PayoutProviderUnavailable(`${rail} payout provider client is not configured`);
      }

      const providerResult = await provider.initiateTransfer({
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
