# Cloudflare Infrastructure Governance

Purpose: Cloudflare platform configuration, worker routing, edge bindings, R2/KV intent, DNS-adjacent integration, and provider-specific infrastructure notes.

Boundary: `infrastructure/cloudflare`.

Rules:

- Runtime code belongs in `services/*`; infrastructure config belongs here.
- Secrets must be stored through provider secret systems, not committed files.
- Binding changes must be reflected in service wrangler configuration.
