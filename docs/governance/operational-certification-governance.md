# Operational Certification Governance

Operational certification is the central Phase 4 evidence aggregation layer. It is owned by `infrastructure/scripts/operations/generate-certification-report.mjs`, `/v1/operations/runtime/certification-reports`, and `operational_certification_reports`.

Rules:

- Plan-mode reports may prove repository readiness, but they must not mark live production as certified.
- Execute-mode reports must fail if required evidence is missing, stale, or below configured score thresholds.
- Certification reports expire after the configured evidence window and must be regenerated from live evidence.
- Report persistence requires the operations control-plane and service-role-backed runtime projections.
- CI artifacts may contain reports, but source authority remains the operations projection table.
- `config/runtime/operational-certification-policy.json` requires hard-fail behavior, 10/10 repository and live scores, and fresh evidence across deployment, observability, failover, chaos, load, security, SRE, event-store, multi-region, and replay categories.
- `credential-gated-plan-ready` is not a live certification.
