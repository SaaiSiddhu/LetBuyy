const BUSINESS_PROFILE_PATCH_KEYS = [
    'trade_name', 'entity_type', 'pan_last4',
    'email', 'phone', 'website', 'public_contact_enabled',
] as const

/** Keep only fields owned by business_profile. Legal name and GST live in sites columns. */
export function businessProfileForStorePatch(source: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(BUSINESS_PROFILE_PATCH_KEYS
        .filter(key => Object.hasOwn(source, key))
        .map(key => [key, source[key]]))
}
