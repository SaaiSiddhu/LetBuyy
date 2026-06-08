# Identity Foundation Table Ownership

Status date: 2026-06-09

This file declares single-writer ownership for new dormant identity-foundation tables. Existing live tables keep their current writers; the foundation repositories wrap them without switching production callers.

| Table | Writer |
|---|---|
| `principals` | `PrincipalRepository` in `services/api-gateway/src/identity-foundation/repository-boundary.ts` |
| `account_links` | `PrincipalRepository` |
| `credentials` | `CredentialRepository` |
| `authenticators` | `AuthenticatorRepository` |
| `recovery_codes` | `AuthenticatorRepository` |
| `sessions_v2` | `SessionRepository` |
| `refresh_chains` | `RefreshTokenService` |
| `refresh_tokens` | `RefreshTokenService` |
| `oauth_clients` | `OAuthClientRepository` |
| `oauth_grants` | `OAuthClientRepository` |
| `authorization_codes` | `OAuthClientRepository` |
| `federation_tokens` | `FederationTokenRepository` |
| `organizations` | `OrganizationRepository` |
| `org_memberships` | `OrganizationRepository` |
| `teams` | `OrganizationRepository` |
| `team_memberships` | `OrganizationRepository` |
| `store_memberships` | `OrganizationRepository`; `store_id` references `public.sites(id)` |
| `org_store_links` | `OrganizationRepository`; `store_id` references `public.sites(id)` |
| `delegations` | `OrganizationRepository` |
| `invitations` | `OrganizationRepository` |
| `ownership_transfers` | `OrganizationRepository` |
| `signing_keys` | `KeyService` in `services/api-gateway/src/identity-foundation/mock-key-service.ts` |
| `security_events` | `SecurityEventRepository` |
| `audit_events` | `AuditRepository` |

Reused tables: `consents`, `merchant_2fa_factors`, `sessions`, `devices`, `verification_tokens`, `auth_password_set_intents`, `site_memberships`, `site_roles`, `site_role_permissions`, `audit_logs`, and `audit_activity_events`.
