# FOUNDATION CONSOLIDATION REPORT
### Wave 1 — Foundation Cleanup · 2026-06-09 · IMPLEMENTATION (partial applied) · architecture FROZEN

> Goal: collapse duplicate primitives to a single source of truth. Most of this is **cross-app/cross-package** (identity-platform + gateway + console + merchant-control-plane) and cannot be build-verified in this sandbox — so cross-app moves are spec'd, not applied blind. One in-app consolidation step was applied as part of Wave 0.

## APPLIED
| Step | Evidence | Note |
|---|---|---|
| **Prod-detection consolidation (in-app)** — `lib/auth/cookies.ts` now reuses the canonical `isProductionIdentityRuntime` (`lib/dev-auth-bypass.ts`) instead of its own `NODE_ENV`-only check | `cookies.ts:3,16` | One fork of "is this prod?" eliminated inside identity-platform; this is the start of CD-S0-3/C6 consolidation |

## SPEC / deferred (cross-app — needs build verification; detailed in `IDENTITY_TECHNICAL_DEBT_REGISTER` + `DUPLICATION_FORENSICS_REPORT`)
| Cluster | Canonical | Action | Why deferred |
|---|---|---|---|
| **Turnstile verifier ×2** | `apps/identity-platform/src/lib/turnstile.ts` (strict, flag-gated) | merge gateway `security.ts:219-249` into a shared module; delete the loose no-flag bypass | edits span Next app + Hono gateway; import graph can't be compiled here |
| **Dev-bypass/prod-detection ×6** | `dev-auth-bypass.ts` | route console/gateway/widgets through one helper (1 fork already removed, above) | cross-package |
| **CSRF ×3 + dual cookie names** | one CSRF module | collapse `csrf.ts`/`csrf-client.ts`/`proxy.ts:43-58`; retire `lb_csrf` read | removing `lb_csrf` read while gateway `security.ts` still accepts it must be coordinated |
| **base64url ×10 / timingSafeEqual ×28** | shared crypto util in `auth-core` | replace re-declarations | mass cross-file change; needs build |
| **Cookie-domain `.letbuyy.store` ×2** | single `COOKIE_DOMAIN` config | dedupe `cookies.ts:54` + merchant-cp `logout/route.ts:33` before `.com` cutover | must be coordinated with the SEO domain migration (Recovery Plan §6) |
| **Legacy Supabase auth backend (~160 LOC)** | `/custom/*` stack | delete `routes/auth.ts:1214-1372` | Wave 7 (zero-traffic gate) |

## LOC impact
Applied: ~+2 / −3 (one fork removed). Spec'd consolidation reclaims ≈ **1,490–1,600 LOC** across waves (see `DUPLICATION_FORENSICS_REPORT`).

## Risk & decision
**Decision:** apply only the in-app fork removal now (safe); stage cross-app primitive consolidation behind a human build because a wrong import in the Hono/Workers gateway runtime would break the build and can't be caught here. **Risk:** the *unconsolidated* duplicates remain a drift hazard (two Turnstile validators with different bypass predicates) — tracked as the highest Wave-1 priority for the human build loop.

## Remaining debt
All "SPEC" rows above. **Human-required blockers:** none external — these need a developer with the workspace toolchain to apply + `pnpm build`/`test` each consolidation; `[SKIPPED FOR FUTURE]` in this sandbox.
