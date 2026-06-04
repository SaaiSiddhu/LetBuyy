# Production Certification Governance

Production certification state is declared in `config/runtime/live-production-certification.json`.
Provider-backed execution requirements are declared in `config/runtime/production-certification-execution.json` and executed by `infrastructure/scripts/operations/run-provider-production-certification.mjs`.

Rules:

- `credential-gated-plan-ready` means workflows and evidence contracts exist, but live provider execution has not been proven.
- `live-certified` requires every evidence category to include `lastVerifiedAt` and `evidenceId`.
- Certification evidence must come from runtime projections or provider verification, not static markdown claims.
- CI must run production readiness validation before accepting certification topology changes.
- Certification docs must name execution mode, credentials required, and evidence authority.
- Provider production certification cannot use staging operational evidence as a substitute for live production evidence.
- Execute mode requires explicit operator approval, provider mutation approval, Node 22-compatible Wrangler, Cloudflare credentials, Supabase/Postgres access, operations API access, and telemetry ingestion endpoints.
- Plan mode may emit missing capabilities and command plans, but it must record `certification: false` and `provider_certification: false`.
