export type WishlistIdentityMode = 'buyer' | 'store_customer' | 'guest';

/** Prefer canonical buyer authority whenever both transitional and canonical sessions exist. */
export function getWishlistIdentityMode(
    buyerSession: boolean,
    storeCustomerSession: boolean,
): WishlistIdentityMode {
    if (buyerSession) return 'buyer';
    if (storeCustomerSession) return 'store_customer';
    return 'guest';
}
