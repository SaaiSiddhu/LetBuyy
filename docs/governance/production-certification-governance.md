# Production Certification Governance

Production certification state is declared in `config/runtime/live-production-certification.json`.
Credential-gated live execution is owned by `infrastructure/scripts/operations/phase4-live-certify.mjs`.

Rules:

- `credential-gated-plan-ready` means workflows and evidence contracts exist, but live provider execution has not been proven.
- `live-certified` requires every evidence category to include `lastVerifiedAt` and `evidenceId`.
- Certification evidence must come from runtime projections or provider verification, not static markdown claims.
- CI must run production readiness validation before accepting certification topology changes.
- Certification docs must name execution mode, credentials required, and evidence authority.
- Staging operational evidence cannot substitute for live production evidence.
- Execute mode requires Cloudflare credentials, Supabase/Postgres access, operations API access, telemetry ingestion endpoints, Vercel credentials, and secret-rotation payloads.
- Plan mode may emit missing capabilities and command plans, but it must record `certification: false`.
