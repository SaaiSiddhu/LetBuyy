import { LEGACY_CSRF_COOKIE_NAMES } from '@letbuyy/auth-core/cookies';

export const NEW_CSRF_COOKIE_NAME = '__Host-letbuyy_csrf';

export interface CsrfValidationPlan {
  acceptedCookieNames: readonly string[];
  emittedCookieName: string;
  tokenBound: boolean;
  featureEnabled: boolean;
  legacyAccepted: boolean;
}

export function csrfValidationPlan(featureEnabled: boolean): CsrfValidationPlan {
  return {
    acceptedCookieNames: featureEnabled
      ? [NEW_CSRF_COOKIE_NAME, ...LEGACY_CSRF_COOKIE_NAMES]
      : LEGACY_CSRF_COOKIE_NAMES,
    emittedCookieName: featureEnabled ? NEW_CSRF_COOKIE_NAME : LEGACY_CSRF_COOKIE_NAMES[0],
    tokenBound: featureEnabled,
    featureEnabled,
    legacyAccepted: true,
  };
}
