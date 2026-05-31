import type { PaymentProvider } from '@letbuyy/payments';

function cashfreeUnavailable(action: string): never {
  throw new Error(`[Cashfree] ${action} is scaffolded; configure Cashfree credentials and execution before enabling this provider.`);
}

export function createCashfreePaymentProvider(): PaymentProvider {
  return {
    name: 'cashfree',
    createIntent: async () => cashfreeUnavailable('createIntent'),
    verify: async () => cashfreeUnavailable('verify'),
    capture: async () => cashfreeUnavailable('capture'),
    refund: async () => cashfreeUnavailable('refund'),
    webhookVerify: async () => cashfreeUnavailable('webhookVerify'),
  };
}
