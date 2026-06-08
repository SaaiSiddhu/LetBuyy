import type { IdentityRealm, PrincipalRef } from '@letbuyy/identity-core';

export interface PerUserAdminTotpPlan {
  principal: PrincipalRef;
  realm: Extract<IdentityRealm, 'admin'>;
  writeAuthenticator: boolean;
  preserveSharedSecretPath: true;
  legacySharedSecretName: 'PLATFORM_CONSOLE_TOTP_SECRET';
}

export function planPerUserAdminTotp(principal: PrincipalRef, featureEnabled: boolean): PerUserAdminTotpPlan {
  return {
    principal,
    realm: 'admin',
    writeAuthenticator: featureEnabled,
    preserveSharedSecretPath: true,
    legacySharedSecretName: 'PLATFORM_CONSOLE_TOTP_SECRET',
  };
}
