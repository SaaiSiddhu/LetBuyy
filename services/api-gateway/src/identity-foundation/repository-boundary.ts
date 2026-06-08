import type { AuditEmitter } from '@letbuyy/audit-core';
import type { PrincipalRepository } from '@letbuyy/identity-core';
import type { OrganizationRepository } from '@letbuyy/organization-core';
import type { PermissionEngine } from '@letbuyy/permission-core';
import type { SessionServiceV2 } from '@letbuyy/session-core';

export type IdentityFoundationRepositoryName =
  | 'principal'
  | 'credential'
  | 'session'
  | 'authenticator'
  | 'consent'
  | 'device'
  | 'verificationToken'
  | 'membership'
  | 'oauthClient'
  | 'audit';

export interface IdentityFoundationBoundary {
  principalRepository: PrincipalRepository;
  organizationRepository: OrganizationRepository;
  sessionService: SessionServiceV2;
  permissionEngine: PermissionEngine;
  auditEmitter: AuditEmitter;
}

export const LEGACY_REPOSITORY_TABLES: Record<IdentityFoundationRepositoryName, readonly string[]> = {
  principal: ['users_custom', 'users', 'store_customers', 'employees'],
  credential: ['users_custom.password_hash', 'customer_credentials'],
  session: ['sessions'],
  authenticator: ['merchant_2fa_factors', 'super_admin_allowlist.two_factor_secret'],
  consent: ['consents'],
  device: ['devices', 'device_tokens'],
  verificationToken: ['verification_tokens', 'auth_password_set_intents'],
  membership: ['site_memberships', 'site_roles', 'site_role_permissions'],
  oauthClient: ['app_installations', 'site_api_clients'],
  audit: ['audit_logs', 'audit_activity_events', 'audit_events'],
} as const;

export const IDENTITY_FOUNDATION_WRITER_OWNERS: Record<string, string> = {
  principals: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via PrincipalRepository',
  account_links: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via PrincipalRepository',
  credentials: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via CredentialRepository',
  authenticators: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via AuthenticatorRepository',
  recovery_codes: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via AuthenticatorRepository',
  sessions_v2: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via SessionRepository',
  refresh_chains: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via RefreshTokenService',
  refresh_tokens: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via RefreshTokenService',
  oauth_clients: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OAuthClientRepository',
  oauth_grants: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OAuthClientRepository',
  authorization_codes: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OAuthClientRepository',
  federation_tokens: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via FederationTokenRepository',
  organizations: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  org_memberships: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  teams: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  team_memberships: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  store_memberships: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  org_store_links: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  delegations: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  invitations: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  ownership_transfers: 'services/api-gateway/src/identity-foundation/repository-boundary.ts via OrganizationRepository',
  signing_keys: 'services/api-gateway/src/identity-foundation/mock-key-service.ts via KeyService',
  security_events: 'services/api-gateway/src/identity-foundation/shadow-compare.ts via SecurityEventRepository',
  audit_events: 'services/api-gateway/src/identity-foundation/audit-dual-write.ts via AuditRepository',
} as const;

export function identityFoundationUsesStoresTable(): boolean {
  return Object.values(LEGACY_REPOSITORY_TABLES)
    .flat()
    .some((table) => table === 'stores' || table.startsWith('stores.'));
}
