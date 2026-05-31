import type { PaymentProvider } from '@letbuyy/payments';

function phonePeUnavailable(action: string): never {
  throw new Error(`[PhonePe] ${action} is scaffolded; configure PhonePe merchant credentials and execution before enabling this provider.`);
}

export function createPhonePePaymentProvider(): PaymentProvider {
  return {
    name: 'phonepe',
    createIntent: async () => phonePeUnavailable('createIntent'),
    verify: async () => phonePeUnavailable('verify'),
    capture: async () => phonePeUnavailable('capture'),
    refund: async () => phonePeUnavailable('refund'),
    webhookVerify: async () => phonePeUnavailable('webhookVerify'),
  };
}
