# SOC2 Control Map

Status date: 2026-06-09

This map is foundation scaffolding only. It links planned identity controls to dormant code or existing governance evidence without claiming live certification.

| Control area | Foundation evidence | Live dependency |
|---|---|---|
| CC6.1 Logical access | `packages/identity-core`, `packages/session-core`, `services/api-gateway/src/identity-foundation/realm-registry.ts` | Future feature-flagged IdP rollout and HR-IDENTITY-DECISIONS. |
| CC6.2 Authentication | Disabled OIDC skeleton routes in `apps/identity-platform/src/app/oauth2/*`; legacy auth unchanged | HR-HYDRA-LIVE before live OIDC. |
| CC6.3 Authorization | `packages/permission-core`; `services/api-gateway/src/identity-foundation/shadow-compare.ts` | Future shadow evidence and authz boundary sign-off. |
| CC6.6 Encryption and keys | `packages/token-core`; mock key service in `services/api-gateway/src/identity-foundation/mock-key-service.ts` | HR-KMS-LIVE before live signing custody. |
| CC7.2 Monitoring | Audit envelope in `packages/audit-core`; `audit_events` migration; dual-write plan | FEATURE_AUDIT_DUAL_WRITE and operational evidence. |
| CC7.3 Incident response | `security_events` migration and existing operations governance | Live incident drills in operations control plane. |
| CC8.1 Change management | `EXECUTION_LEDGER.md` and `SKIPPED_HUMAN_DECISIONS.md` | CI/governance gates before merge; human seams remain explicitly recorded. |
| Privacy P1 | `consents` reuse, residency config `config/runtime/identity/residency.json` | HR-RESIDENCY-DPDP and HR-LEGAL-DPDP-PA. |
| Availability A1 | OIDC remains disabled; JWKS mock service is untrusted | HR-HYDRA-LIVE plus HA/DR drills before Wave 1. |
