# Operational Evidence Governance

Operational evidence is authoritative only when stored in runtime projection tables or emitted by provider verification commands.

Rules:

- Evidence categories are deployment, Cloudflare, Supabase, observability, incident, failover, chaos, load, security, dashboards, control-plane, SRE, event-store, and multi-region.
- Markdown may document state, but it must not replace operations control-plane evidence.
- Evidence recording requires `LETBUYY_OPERATIONS_TOKEN`.
- Evidence records must include runtime, environment, status, and a traceable run identifier.
- Generated local logs are not source authority and must remain untracked.
- Certification scoring only counts fresh records whose status is passing, healthy, successful, closed, or otherwise proves integrity/signature validity.
- Planned or requested evidence proves only operator workflow readiness; it must never be promoted to live success without measured provider or runtime data.
