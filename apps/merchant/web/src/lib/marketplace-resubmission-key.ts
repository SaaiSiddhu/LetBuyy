export interface MarketplaceResubmissionKey {
    reason: string
    key: string
}

export function retainMarketplaceResubmissionKey(
    current: MarketplaceResubmissionKey | null,
    reason: string,
    createKey: () => string,
): MarketplaceResubmissionKey {
    const normalizedReason = reason.trim()
    if (current?.reason === normalizedReason) return current
    return { reason: normalizedReason, key: createKey() }
}

export function keepMarketplaceResubmissionKeyForReason(
    current: MarketplaceResubmissionKey | null,
    reason: string,
): MarketplaceResubmissionKey | null {
    return current?.reason === reason.trim() ? current : null
}
