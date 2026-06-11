import {
  inrMoney,
  normalizeIdempotencyKey,
  normalizePaymentMoney,
  type PaymentCaptureInput,
  type PaymentCreateIntentInput,
  type PaymentProvider,
  type PaymentRefundInput,
  type PaymentVerifyInput,
  type PaymentWebhookVerifyInput,
} from '@letbuyy/payments';

export interface CodPaymentProviderOptions {
  requireVerification?: boolean;
}

function isCodVerified(metadata: Record<string, unknown> | undefined): boolean {
  return metadata?.cod_verified === true || metadata?.verification_status === 'verified';
}

export function createCodPaymentProvider(options: CodPaymentProviderOptions = {}): PaymentProvider {
  const requireVerification = options.requireVerification !== false;

  return {
    name: 'cod',

    async createIntent(input: PaymentCreateIntentInput) {
      const amount = normalizePaymentMoney(input.amount);
      const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
      return {
        provider: 'cod',
        status: requireVerification ? 'requires_action' : 'authorized',
        amount,
        idempotencyKey,
        references: {
          providerOrderId: `cod_${input.orderId}`,
        },
        metadata: {
          verification_required: requireVerification,
          verification_channel: 'otp_or_call',
          ...input.metadata,
        },
      };
    },

    async verify(input: PaymentVerifyInput) {
      const amount = normalizePaymentMoney(input.amount);
      const verified = !requireVerification || isCodVerified(input.metadata);
      return {
        provider: 'cod',
        verified,
        status: verified ? 'authorized' : 'failed',
        amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        failureCode: verified ? undefined : 'COD_VERIFICATION_REQUIRED',
        failureMessage: verified ? undefined : 'COD requires OTP/call verification before order confirmation',
        metadata: input.metadata,
      };
    },

    async capture(input: PaymentCaptureInput) {
      const amount = normalizePaymentMoney(input.amount);
      normalizeIdempotencyKey(input.idempotencyKey);
      return {
        provider: 'cod',
        status: 'paid',
        capturedAmount: amount,
        references: {
          providerOrderId: input.providerOrderId,
          providerPaymentId: input.providerPaymentId,
        },
        metadata: input.metadata,
      };
    },

    async refund(input: PaymentRefundInput) {
      normalizeIdempotencyKey(input.idempotencyKey);
      return {
        provider: 'cod',
        status: 'refunded',
        refundedAmount: inrMoney(0),
        references: {
          providerPaymentId: input.paymentId,
          providerRefundId: input.providerRefundId,
        },
        metadata: {
          settlement: 'manual_cash_return_or_adjustment',
          ...input.metadata,
        },
      };
    },

    async webhookVerify(input: PaymentWebhookVerifyInput) {
      return {
        provider: 'cod',
        verified: false,
        failureCode: 'COD_HAS_NO_PROVIDER_WEBHOOK',
        failureMessage: `COD verification uses internal challenge events, not provider webhooks (${input.receivedAt})`,
      };
    },
  };
}
