export type CheckoutPaymentMethod = 'online' | 'cod';

export interface CheckoutPaymentAvailabilityInput {
    hostedCheckout: boolean;
    onlinePaymentEnabled: boolean;
    codEnabled: boolean;
}

export interface CheckoutPaymentAvailability {
    online: boolean;
    cod: boolean;
    hasAvailableMethod: boolean;
    initialMethod: CheckoutPaymentMethod;
}

/**
 * Storefront and hosted online payments are each backed by their server-authoritative order flow.
 * Hosted checkout uses its signed cart state machine; merchant-origin checkout keeps its existing
 * store-scoped payment routes.
 */
export function resolveCheckoutPaymentAvailability(
    input: CheckoutPaymentAvailabilityInput,
): CheckoutPaymentAvailability {
    const online = input.onlinePaymentEnabled;
    const cod = input.codEnabled;

    return {
        online,
        cod,
        hasAvailableMethod: online || cod,
        initialMethod: online ? 'online' : cod ? 'cod' : 'online',
    };
}
