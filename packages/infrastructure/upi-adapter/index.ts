import {
  inrMoney,
  normalizeIdempotencyKey,
  normalizePaymentMoney,
  type PaymentProvider,
} from '@letbuyy/payments';

export interface NativeUpiPaymentProviderOptions {
  merchantVpa?: string;
  merchantName?: string;
  autopayEnabled?: boolean;
}

function isVerified(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.verification_status === 'verified' || metadata?.upi_verified === true;
}

export function createNativeUpiPaymentProvider(options: NativeUpiPaymentProviderOptions = {}): PaymentProvider {
  return {
    name: 'upi',

    async createIntent(input) {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
      return {
        provider: 'upi',
        status: 'requires_action',
        amount,
        idempotencyKey,
        references: {
          providerOrderId: `upi_${input.orderId}`,
        },
        metadata: {
          payment_rail: 'upi',
          merchant_vpa: options.merchantVpa ?? null,
          merchant_name: options.merchantName ?? 'LetBuyy merchant',
          upi_autopay_supported: options.autopayEnabled === true,
          upi_autopay_status: options.autopayEnabled === true ? 'scaffolded' : 'disabled',
          ...input.metadata,
        },
      };
    },

    async verify(input) {
      const amount = normalizePaymentMoney(input.amount);
      const verified = isVerified(input.metadata);
      return {
        provider: 'upi',
        verified,
        status: verified ? 'authorized' : 'failed',
        amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        failureCode: verified ? undefined : 'UPI_VERIFICATION_REQUIRED',
        failureMessage: verified ? undefined : 'Native UPI verification is scaffolded and requires backend reconciliation',
        metadata: input.metadata,
      };
    },

    async capture(input) {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);
      return {
        provider: 'upi',
        status: 'paid',
        capturedAmount: amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        metadata: input.metadata,
      };
    },

    async refund(input) {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);
      return {
        provider: 'upi',
        status: 'failed',
        refundedAmount: inrMoney(0),
        references: {
          providerPaymentId: input.paymentId,
          providerRefundId: input.providerRefundId,
        },
        failureCode: 'UPI_REFUND_SCAFFOLDED',
        failureMessage: 'Native UPI refund execution requires PSP integration before enablement',
        metadata: {
          requested_amount_minor: amount.amountMinor,
          ...input.metadata,
        },
      };
    },

    async webhookVerify(input) {
      return {
        provider: 'upi',
        verified: false,
        failureCode: 'UPI_WEBHOOK_SCAFFOLDED',
        failureMessage: `Native UPI webhook verification is scaffolded as of ${input.receivedAt}`,
      };
    },
  };
}
