# Security Operations Governance

Security operations cover secrets, RBAC, audit, deployment signing, scanning, and operational authorization.

## Required Controls

- Secrets live in Cloudflare Worker secrets, Vercel environment stores, Supabase settings, or CI secrets.
- Production deployments require signed release provenance and SBOM generation.
- Replay, redrive, failover, provider override, tenant throttle, cache invalidation, and deployment rollback require platform-operator authorization.
- Security events must be audit logged through `execution_audit_trail` or `runtime_control_commands`.

## Scanning

- Secret scan: `scripts/validators/environment-validator.mjs`
- Dependency scan: CI audit jobs
- SBOM: CI CycloneDX generation
- Production controls catalog: `infrastructure/security/production-security-controls.yaml`
