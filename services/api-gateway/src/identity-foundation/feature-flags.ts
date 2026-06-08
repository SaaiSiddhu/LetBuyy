import {
  IDENTITY_FOUNDATION_FEATURE_FLAGS,
  resolveIdentityFoundationFeatureFlags,
  type IdentityFoundationFeatureFlag,
} from '@letbuyy/auth-core/feature-flags';

export type IdentityFoundationEnv = Partial<Record<IdentityFoundationFeatureFlag, string | undefined>>;

export function resolveGatewayIdentityFoundationFlags(env: IdentityFoundationEnv) {
  return resolveIdentityFoundationFeatureFlags(env);
}

export function isIdentityFoundationFlagEnabled(
  env: IdentityFoundationEnv,
  flag: IdentityFoundationFeatureFlag,
): boolean {
  return resolveGatewayIdentityFoundationFlags(env)[flag];
}

export { IDENTITY_FOUNDATION_FEATURE_FLAGS };
