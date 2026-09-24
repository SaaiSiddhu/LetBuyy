# Developer Platform Map (frozen)

`apps/frozen/developer-portal` is **frozen / pending consolidation** — not a production deploy target.

## Status
- Excluded from the deploy matrix; not an active surface.
- Any API-key / OAuth-app concepts here are dormant until a human-approved scope activates them.

## Invariants (if/when activated — requires ARB)
- **API keys** hashed at rest, shown once, scoped, revocable; never returned in list responses or logs.
- **OAuth apps** — least-privilege scopes; validated redirect URIs; PKCE for public clients.
- **Single issuer** — developer/OAuth tokens must not cross the merchant (ES256) / customer (HS256) issuer boundaries.
- **Tenant isolation** — developer resources scoped to the owning account; no cross-tenant key access.

## Governance
- `prompt-perimeter-validator` (canonical prompt registry, deleted hazards, archive quarantine).
- Activation = ARB-approved scope change with real source, tests, RLS, and deploy config.
