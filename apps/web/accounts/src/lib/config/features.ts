/**
 * Feature flags for gradual rollout of new auth features.
 * Controlled via environment variables for easy toggling.
 */
export const features = {
    /** Enable magic link login option */
    magicLink: process.env.FEATURE_MAGIC_LINK === 'true',

    /** Enable passkey/WebAuthn login */
    passkey: process.env.FEATURE_PASSKEY === 'true',

    /** Enable multi-account switching */
    multiAccount: process.env.FEATURE_MULTI_ACCOUNT === 'true',
} as const
