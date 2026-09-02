# Security Operations Governance

Security operations cover secrets, RBAC, audit, deployment signing, scanning, and operational authorization.

## Required Controls

- Secrets live in Cloudflare Worker secrets, Vercel environment stores, Supabase settings, or CI secrets.
- Production deployments require signed release provenance and SBOM generation.
- Redrive, provider override, tenant throttle, cache invalidation, and deployment rollback require platform-operator authorization.
- Security events must be audit logged through `execution_audit_trail`, `runtime_control_commands`, or `security_enforcement_events`.
- Cookie-backed mutating worker requests require CSRF double-submit validation.
- Provider webhooks must persist signature verification evidence before side effects.
- Credentialed CORS may reflect only fixed platform origins or exact HTTPS origins listed in `CORS_CREDENTIAL_ORIGINS`; wildcard tenant subdomain reflection is forbidden.
- Development auth bypasses, including identity `devOtp`, Turnstile `dev-bypass-token`, and admin-web `PLATFORM_CONSOLE_DEV_MFA_CODE`, require `LETBUYY_ENABLE_DEV_AUTH_BYPASS=true` in a `NODE_ENV=development` build and must fail closed in production/staging runtime flags.

## Scanning

- Secret scan: `scripts/validators/environment-validator.mjs`
- Dependency scan: CI audit jobs
- SBOM: CI CycloneDX generation
- Production controls catalog: `infrastructure/security/production-security-controls.yaml`
- Security gate script: `infrastructure/scripts/security/verify-security-gates.mjs`
- Secret rotation script: `infrastructure/scripts/security/rotate-secrets.mjs`
- Secret rotation runbook: `docs/runbooks/secret-rotation.md`

## Secret Rotation Execution

- Rotation execution is credential-gated and uses `ROTATE_SECRET_<NAME>` environment variables as input.
- Worker secrets are rotated through Wrangler against each runtime `wrangler.toml`; secret values must never be printed or stored in repository files.
- Rotation evidence must be recorded through `/v1/operations/runtime/security/enforcement-events` during live production validation.
