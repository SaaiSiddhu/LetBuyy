import {
  LETBUYY_CUSTOMER_SESSION_COOKIE,
  LETBUYY_MERCHANT_SESSION_COOKIE,
  LETBUYY_PLATFORM_SESSION_COOKIE,
  type SessionKind,
} from './index';

export type CookieSameSite = 'strict' | 'lax' | 'none';
export type CookieRealm = Extract<SessionKind, 'merchant' | 'customer' | 'employee'>;

export interface CookiePolicy {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: CookieSameSite;
  path: '/';
  maxAgeSeconds: number;
  domain?: string;
  hostOnly: boolean;
}

export interface CookiePolicyService {
  policyFor(realm: CookieRealm): CookiePolicy;
}

export const LEGACY_REALM_COOKIE_NAMES: Record<CookieRealm, string> = {
  merchant: LETBUYY_MERCHANT_SESSION_COOKIE,
  customer: LETBUYY_CUSTOMER_SESSION_COOKIE,
  employee: LETBUYY_PLATFORM_SESSION_COOKIE,
};

export const LEGACY_CSRF_COOKIE_NAMES = ['letbuyy_csrf', 'lb_csrf'] as const;
