export const IDENTITY_FOUNDATION_FEATURE_FLAGS = [
  'FEATURE_IDENTITY_PROVIDER',
  'FEATURE_OIDC_CLIENT',
  'FEATURE_NEW_SESSION_ENGINE',
  'FEATURE_NEW_PERMISSION_ENGINE',
  'FEATURE_NEW_AUDIT_ENGINE',
  'FEATURE_AUDIT_DUAL_WRITE',
  'FEATURE_NEW_KEY_SERVICE',
  'FEATURE_ORG_MODEL',
  'FEATURE_NEW_MFA_ENGINE',
  'FEATURE_SHADOW_AUTH',
  'FEATURE_SHADOW_PERMISSION',
  'FEATURE_SHADOW_SESSION',
  'FEATURE_TOKEN_HASH_SHADOW',
  'FEATURE_NEW_CSRF',
  'FEATURE_PERUSER_ADMIN_TOTP',
] as const;

export type IdentityFoundationFeatureFlag = typeof IDENTITY_FOUNDATION_FEATURE_FLAGS[number];
export type IdentityFoundationFeatureFlagMap = Record<IdentityFoundationFeatureFlag, boolean>;
export type FeatureFlagEnvironment = Record<string, string | undefined>;

export const DEFAULT_IDENTITY_FOUNDATION_FEATURES: IdentityFoundationFeatureFlagMap =
  Object.freeze(Object.fromEntries(
    IDENTITY_FOUNDATION_FEATURE_FLAGS.map((flag) => [flag, false]),
  ) as IdentityFoundationFeatureFlagMap);

export function isIdentityFoundationFeatureEnabled(
  flag: IdentityFoundationFeatureFlag,
  env: FeatureFlagEnvironment = {},
): boolean {
  return env[flag] === 'true';
}

export function resolveIdentityFoundationFeatureFlags(
  env: FeatureFlagEnvironment = {},
): IdentityFoundationFeatureFlagMap {
  return Object.freeze(Object.fromEntries(
    IDENTITY_FOUNDATION_FEATURE_FLAGS.map((flag) => [
      flag,
      isIdentityFoundationFeatureEnabled(flag, env),
    ]),
  ) as IdentityFoundationFeatureFlagMap);
}
