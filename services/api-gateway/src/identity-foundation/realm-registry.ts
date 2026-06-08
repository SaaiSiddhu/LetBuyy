import {
  LETBUYY_CUSTOMER_SESSION_COOKIE,
  LETBUYY_MERCHANT_SESSION_COOKIE,
  LETBUYY_PLATFORM_SESSION_COOKIE,
} from '@letbuyy/auth-core';
import type { IdentityRealm } from '@letbuyy/identity-core';

export interface RealmConfig {
  realm: IdentityRealm;
  issuer: string;
  audience: string;
  cookieName: string;
  accessTokenTtlSeconds: number;
  sessionTtlSeconds: number;
  mfaPolicy: 'optional' | 'required' | 'step_up';
}

export const DEFAULT_MOCK_IDENTITY_ORIGIN = 'http://identity.localhost';

function issuerForRealm(realm: IdentityRealm): string {
  return `${DEFAULT_MOCK_IDENTITY_ORIGIN}/realms/${realm}`;
}

export const REALM_REGISTRY: Record<'merchant' | 'customer' | 'admin', RealmConfig> = {
  merchant: {
    realm: 'merchant',
    issuer: issuerForRealm('merchant'),
    audience: 'letbuyy:merchant',
    cookieName: LETBUYY_MERCHANT_SESSION_COOKIE,
    accessTokenTtlSeconds: 10 * 60,
    sessionTtlSeconds: 30 * 24 * 60 * 60,
    mfaPolicy: 'optional',
  },
  customer: {
    realm: 'customer',
    issuer: issuerForRealm('customer'),
    audience: 'letbuyy:customer',
    cookieName: LETBUYY_CUSTOMER_SESSION_COOKIE,
    accessTokenTtlSeconds: 10 * 60,
    sessionTtlSeconds: 7 * 24 * 60 * 60,
    mfaPolicy: 'optional',
  },
  admin: {
    realm: 'admin',
    issuer: issuerForRealm('admin'),
    audience: 'letbuyy:admin',
    cookieName: LETBUYY_PLATFORM_SESSION_COOKIE,
    accessTokenTtlSeconds: 5 * 60,
    sessionTtlSeconds: 8 * 60 * 60,
    mfaPolicy: 'required',
  },
} as const;
