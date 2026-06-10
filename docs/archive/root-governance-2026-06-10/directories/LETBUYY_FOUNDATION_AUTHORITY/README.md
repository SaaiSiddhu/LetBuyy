# LetBuyy — Foundation Authority Set (2026-06-09)

The **final design authority** for LetBuyy. These seven documents sit on top of all prior audits and the `docs/auth/2026-06-08-…/` design corpus; they ratify what's sound, reconcile it with verified code reality + the Phase-2 challenge, resolve contradictions, and set the decided target. **Code beats docs; newer audits beat older.**

**Start here:** [`LETBUYY_SINGLE_SOURCE_OF_TRUTH.md`](LETBUYY_SINGLE_SOURCE_OF_TRUTH.md) — the keystone: current state, per-domain truth, the only approved roadmap (P0–P4), execution order, kill/quarantine/defer lists, and the explicit "what NOT to build/touch/refactor/migrate."

| # | Document | Purpose |
|---|---|---|
| 1 | [DESIGN_SYSTEM_VERDICT.md](DESIGN_SYSTEM_VERDICT.md) | Design governance vs Polaris/Linear/Stripe/Vercel; waves, CI rules, scores, single authority, "how to reach 10/10". |
| 2 | [THEME_ARCHITECTURE_VERDICT.md](THEME_ARCHITECTURE_VERDICT.md) | Theme engine vs Shopify OS2.0; real/fake/over-/under-built; P0–P3; final scorecard. |
| 3 | [TARGET_AUTH_ARCHITECTURE.md](TARGET_AUTH_ARCHITECTURE.md) | Target identity (one IdP, 4 realms, OIDC/JWKS/tokens/consent/passkeys/zero-trust); current vs future; **sequencing decision**. |
| 4 | [SSO_ARCHITECTURE.md](SSO_ARCHITECTURE.md) | OIDC SSO across 8 apps with sequence diagrams; login/silent/logout/realm separation/device/federation. |
| 5 | [SESSION_MANAGEMENT.md](SESSION_MANAGEMENT.md) | Session authority/storage/rotation/timeouts/revocation; cookie ownership matrix; threat model; current→future→migration. |
| 6 | [IDENTITY_MIGRATION_PLAN.md](IDENTITY_MIGRATION_PLAN.md) | Waves 0–8 with objectives/risks/rollback/success/human-deps/codex-deps; gated behind the money+tenancy P0s. |
| 7 | [LETBUYY_SINGLE_SOURCE_OF_TRUTH.md](LETBUYY_SINGLE_SOURCE_OF_TRUTH.md) | **The authoritative implementation guide.** |

**Composite maturity ≈43/100 · Verdict: REQUIRES RESTRUCTURING (two-quarter foundation step-up, not a rewrite).**
The decided sequence: money truth + tenant isolation + backups + secret/perimeter hardening **first** (P0); beta enablers **next** (P1); the full Identity-Platform/OIDC/SSO build and scale work **after** (P2–P3). The north-star auth design is ratified but **deferred** — the same shared secret that forges identity also authorizes money, so its isolation is a P0, but the full IdP is not built before the foundation is true.
