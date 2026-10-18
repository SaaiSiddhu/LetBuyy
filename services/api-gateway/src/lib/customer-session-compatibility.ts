export type CustomerSessionFormat = 'gateway_hs256_v1' | 'shopper_hs256_legacy';
export type CustomerSessionCompatibility = 'both' | CustomerSessionFormat | 'disabled';

/** Missing configuration preserves the current bridge; unknown values accept no format. */
export function acceptsCustomerSessionFormat(
    policy: string | undefined,
    format: CustomerSessionFormat,
): boolean {
    const effectivePolicy = policy ?? 'both';
    return effectivePolicy === 'both' || effectivePolicy === format;
}
