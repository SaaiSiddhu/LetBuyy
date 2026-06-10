# Security Rules

## Secret Handling

- Do not print secret values.
- Rotate historically exposed secrets before trusting production environments.
- Service role keys remain server/worker only.
- Do not hardcode payment provider key IDs or secrets.

## Auth Rules

- Accounts app owns merchant auth UI.
- Worker owns canonical auth/session APIs.
- Storefront customer auth is separate from merchant/admin auth.
- Console/team operations require allowlists, MFA/TOTP, IP/VPN controls where applicable, RBAC, and audit logging before production use.

## Request Protection

- Cookies must be HTTP-only, Secure in production, and SameSite=Strict unless a documented redirect flow requires an exception.
- Sensitive auth and mutation endpoints require rate limits.
- Browser mutation endpoints require CSRF protection unless the auth mechanism makes CSRF non-applicable and the exception is documented.
- Internal app-to-worker requests should prefer signed requests over static shared secrets.

## Payment Security

- Verify provider signatures before side effects.
- Rebuild totals server-side.
- Store idempotency keys/provider event IDs.
- Reconcile asynchronously through webhooks without trusting client confirmation alone.

## Data Security

- Tenant-owned data must be scoped at service and database levels.
- Redact logs and client errors.
- Do not expose draft, private, deleted, internal, or cross-tenant data through public APIs.
