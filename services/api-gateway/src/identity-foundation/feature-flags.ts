import {
  IDENTITY_FOUNDATION_FEATURE_FLAGS,
  resolveIdentityFoundationFeatureFlags,
  type IdentityFoundationFeatureFlag,
} from '@letbuyy/auth-core/feature-flags';

export type IdentityFoundationEnv = Partial<Record<IdentityFoundationFeatureFlag, string | undefined>>;

function identityFoundationEnv(env: unknown): IdentityFoundationEnv {
  const source = env && typeof env === 'object' ? env as Record<string, unknown> : {};
  return Object.fromEntries(
    IDENTITY_FOUNDATION_FEATURE_FLAGS.map((flag) => {
      const value = source[flag];
      return [flag, typeof value === 'string' ? value : undefined];
    }),
  ) as IdentityFoundationEnv;
}

export function resolveGatewayIdentityFoundationFlags(env: unknown) {
  return resolveIdentityFoundationFeatureFlags(identityFoundationEnv(env));
}

export function isIdentityFoundationFlagEnabled(
  env: unknown,
  flag: IdentityFoundationFeatureFlag,
): boolean {
  return resolveGatewayIdentityFoundationFlags(env)[flag];
}

export { IDENTITY_FOUNDATION_FEATURE_FLAGS };
