import type { Context } from 'hono';
import type { Env } from '../index';
import { isIdentityFoundationFlagEnabled } from './feature-flags';

export type AuthVerifierName =
  | 'internal-session-hmac'
  | 'internal-identity-hmac'
  | 'supabase-bearer'
  | 'oidc-jwks';

export interface AuthVerifierRegistration {
  name: AuthVerifierName;
  activeByDefault: boolean;
  order: number;
  realm?: 'merchant' | 'customer' | 'admin' | 'service';
  description: string;
}

export const AUTH_VERIFIER_REGISTRY: AuthVerifierRegistration[] = [
  {
    name: 'internal-session-hmac',
    activeByDefault: true,
    order: 20,
    realm: 'merchant',
    description: 'Existing internal session-token HMAC branch.',
  },
  {
    name: 'internal-identity-hmac',
    activeByDefault: true,
    order: 30,
    realm: 'merchant',
    description: 'Existing internal identity assertion HMAC branch.',
  },
  {
    name: 'supabase-bearer',
    activeByDefault: true,
    order: 40,
    description: 'Existing Supabase bearer token branch.',
  },
  {
    name: 'oidc-jwks',
    activeByDefault: false,
    order: 90,
    description: 'Dormant Identity Provider JWT verifier, enabled only by FEATURE_OIDC_CLIENT.',
  },
];

export function activeVerifierNames(env: Partial<Env>): AuthVerifierName[] {
  return AUTH_VERIFIER_REGISTRY
    .filter((verifier) => verifier.activeByDefault || (
      verifier.name === 'oidc-jwks'
      && isIdentityFoundationFlagEnabled(env, 'FEATURE_OIDC_CLIENT')
    ))
    .sort((left, right) => left.order - right.order)
    .map((verifier) => verifier.name);
}

export function dormantIdpVerifierEnabled(c: Context<{ Bindings: Env }>): boolean {
  return isIdentityFoundationFlagEnabled(c.env, 'FEATURE_OIDC_CLIENT');
}

export const ROUTE_REALM_METADATA = {
  '/v1/products': { realm: 'merchant', audience: 'letbuyy:merchant', acr: 'urn:letbuyy:acr:password' },
  '/v1/orders': { realm: 'merchant', audience: 'letbuyy:merchant', acr: 'urn:letbuyy:acr:password' },
  '/v1/storefront': { realm: 'customer', audience: 'letbuyy:customer', acr: 'urn:letbuyy:acr:anonymous' },
  '/v1/internal-console': { realm: 'admin', audience: 'letbuyy:admin', acr: 'urn:letbuyy:acr:mfa' },
} as const;
