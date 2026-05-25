# Production Certification Governance

Production certification state is declared in `config/runtime/live-production-certification.json`.

Rules:

- `credential-gated-plan-ready` means workflows and evidence contracts exist, but live provider execution has not been proven.
- `live-certified` requires every evidence category to include `lastVerifiedAt` and `evidenceId`.
- Certification evidence must come from runtime projections or provider verification, not static markdown claims.
- CI must run production readiness validation before accepting certification topology changes.
- Certification docs must name execution mode, credentials required, and evidence authority.
