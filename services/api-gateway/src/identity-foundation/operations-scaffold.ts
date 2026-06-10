import type { IdentityRealm } from '@letbuyy/identity-core';

export interface IdentityHealthSnapshot {
  surface: 'oidc' | 'jwks' | 'session' | 'permission' | 'audit';
  status: 'disabled' | 'healthy' | 'degraded';
  featureFlag: string;
  requestId?: string;
}

export interface IdentityMetricHook {
  name: string;
  value: number;
  labels: Record<string, string>;
}

export function identityHealthSnapshot(input: IdentityHealthSnapshot): IdentityHealthSnapshot {
  return input;
}

export function jwksCacheMetric(realm: IdentityRealm, hit: boolean): IdentityMetricHook {
  return {
    name: 'identity_jwks_cache_hit',
    value: hit ? 1 : 0,
    labels: { realm, mode: 'scaffold' },
  };
}

export function shadowDivergenceMetric(surface: 'auth' | 'session' | 'permission', diverged: boolean): IdentityMetricHook {
  return {
    name: 'identity_shadow_divergence',
    value: diverged ? 1 : 0,
    labels: { surface },
  };
}
