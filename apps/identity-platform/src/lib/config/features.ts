import {
    resolveIdentityFoundationFeatureFlags,
} from '@letbuyy/auth-core/feature-flags'

/**
 * Feature flags for gradual rollout of new auth features.
 * Controlled via environment variables for easy toggling.
 */
export const features = {
    /** Enable magic link login option */
    magicLink: process.env.FEATURE_MAGIC_LINK === 'true',

    /** Enable passkey/WebAuthn login */
    passkey: process.env.FEATURE_PASSKEY === 'true',

    /** Dormant Identity Platform foundation flags. All default false. */
    identityFoundation: resolveIdentityFoundationFeatureFlags(process.env),
} as const
