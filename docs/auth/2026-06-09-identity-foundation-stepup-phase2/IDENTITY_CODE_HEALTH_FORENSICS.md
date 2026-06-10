# IDENTITY CODE HEALTH FORENSICS
### Phase 2 Recovery Mission · 2026-06-09 · ANALYSIS-ONLY · measured against CURRENT tree

> Scope: `apps/identity-platform/src` (9,800+ LOC) + the auth-adjacent surface it depends on. Code is truth.

## Duplicate code (verified)
| Cluster | Locations | Approx redundant LOC | Severity |
|---|---|--:|:--:|
| **Turnstile verifier ×2** (different bypass predicates) | `src/lib/turnstile.ts:7-34` ‖ `services/api-gateway/src/middleware/security.ts:219-249` | ~35 | **S1** (security drift) |
| **Dev-bypass / prod-detection forks** | `src/lib/dev-auth-bypass.ts` (canonical) ‖ console `console-auth-server.ts:138-148` ‖ gw `routes/auth.ts:92-108` ‖ gw `security.ts:199-205` ‖ widget ×2 — **(one fork already removed: `cookies.ts` now reuses the canonical helper)** | ~50 remaining | **S1** |
| **CSRF logic ×3** | `src/lib/auth/csrf.ts:11-25` ‖ `src/lib/csrf-client.ts:9-24` ‖ `src/proxy.ts:43-58` (mint) + dual cookie names (`letbuyy_csrf`/`lb_csrf`) | ~70 | **S1** |
| **base64url ×10 / timingSafeEqual ×28** | `auth-core` + ~20 gateway files | ~120 | **S2** |
| **`login`≈`lookup` page clone** | `login/page.tsx` ‖ `lookup/page.tsx` (~282 common lines) | ~282 | **S0** |
| **9× page boilerplate** (i18n/top-bar/lang) | all 9 `src/app/*/page.tsx` | ~360 | **S1** |
| **`reset`≈`set` password-strength UI** | `reset-password:101-262` ‖ `set-password:125-269` | ~110 | **S2** |
| **Gateway dual auth backend** (custom vs Supabase) | gw `routes/auth.ts:266-1210` vs `:1214-1372` | ~160 | **S1** |

## Dead / legacy code (candidates for deletion)
| Item | Evidence | When safe |
|---|---|---|
| Legacy Supabase auth path | gw `routes/auth.ts:1214-1372` | Wave 7 (zero-traffic gate) |
| In-memory auth fallback Maps | gw `routes/auth.ts:82-85,925,1058` | after build verification |
| Dual CSRF `lb_csrf` read | `csrf.ts:22`, `csrf-client.ts:12` | after gateway coordination |
| Shadow `.auth-*` stylesheet (~1,700 deletable of 2,005) | `globals.css` | as pages convert (Wave 2) |
| Orphan classes `.auth-label`/`.auth-input` | used `onboarding:885,950`, never defined | on onboarding conversion |
| **NOT dead — keep:** `*-core` packages, gateway `identity-foundation/*`, `oauth2/*` skeletons, migration 159 | dormant frozen target | keep & complete |

## Files: delete / merge / centralize
- **Delete (post-cutover):** the legacy Supabase block in `routes/auth.ts`; in-memory Maps; shadow `globals.css` (once converted).
- **Merge:** `turnstile.ts` + gateway turnstile → one module; `csrf.ts`+`csrf-client.ts`+`proxy` CSRF → one; `reset`+`set` strength UI → shared component; `login`+`lookup` → one page.
- **Centralize (new shared modules):** `AuthShell` (chrome/i18n, kills 9× dup); one prod-detection helper (started — `dev-auth-bypass.ts`); shared `base64url`/`timingSafeEqual` in `auth-core`; one i18n module.

## Import / boundary / type health
- **Cycles:** none introduced by the applied edits (verified by inspection: `cookies.ts`→`dev-auth-bypass.ts`, `switch`→existing libs are acyclic).
- **Boundary:** the frozen Identity↔Commerce rule (no cross-boundary SQL) is documented; the live `service_role`/BYPASSRLS violation is a Wave-8 security item, not a code-health refactor.
- **Lint/type:** 0 hex in TSX (lint works); full `tsc`/eslint not runnable in this sandbox (no app deps) — flagged honestly.

## Estimate
**Redundant/removable ≈ 3,000–3,500 LOC** (≈1,700 shadow CSS + ~640 page dup + ~160 legacy + ~190 crypto/CSRF/turnstile). The single highest-leverage cleanup is one shared **auth-runtime module** (Turnstile + dev-bypass + CSRF + cookie-domain) consumed by identity/gateway/console/mobile — collapsing the 4 most drift-dangerous S1 clusters at once.

## Severity roll-up
**S0:** 1 (login/lookup clone) + the shadow stylesheet (counted under design). **S1:** 5. **S2:** 4. Most code-health debt is *maintainability/drift*, except the two duplicated **security primitives** (Turnstile, dev-bypass) which are S1 because divergence is a vulnerability, not just churn.
