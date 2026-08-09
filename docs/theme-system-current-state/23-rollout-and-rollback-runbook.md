# 23 — Rollout & Rollback Runbook

> **Date:** 2026-08-05. Operational procedure for the Liquid theme system.
>
> ## ⛔ The headline finding, stated first
>
> **THEME-R6 designates the per-theme `renderer.engine` switch as *the* rollback. It does not currently
> work.** Coerced Liquid sections carry `rendererKey: 'liquid.section.<type>'`, which never matches
> `COMPATIBILITY_RENDERER_KEYS` in `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx`.
> **22 of 44 sections** therefore fall back to a "Renderer not available" placeholder rather than a
> working React page.
>
> **Consequence: do not expand the canary.** A rollback lever that yields a broken page is not a rollback.

---

## 1. Current flag posture — preserve exactly

| Control | Value | Where | Do not change without ARB |
|---|---|---|---|
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` | **`false`** | `packages/theme-engine/src/theme-governance.ts:14` — a compile-time constant, identical in every environment | ✅ Class-A act (ART-17 / THEME-R6) |
| Per-theme `rendererEngine` | opt-in per theme/release | `sites.template_config` / `release_manifest` | ✅ this is the canary control |
| `FEATURE_LIQUID` | declared, **gates nothing** | `services/api-gateway/src/middleware/featureFlags.ts:4`; `wrangler.toml` | ⚠️ **not a kill switch** — see §2 |
| Migration 197 (`letbuyy-core`) | does **not** set `rendererEngine` | `database/supabase/migrations/197_*.sql` | ✅ deliberate |

### The precedence that actually decides the renderer

`resolveThemeLiquidRenderingEnabled` (`theme-governance.ts:144-182`), first match wins:

1. **Explicit engine** — any of `templateConfig.rendererEngine`, `releaseManifest.renderer_engine`,
   `releaseManifest.rendererEngine`, `releaseManifest.renderer.engine` equal to `'liquid'` ⇒ **true**,
   short-circuiting the default-off constant.
2. **Canary booleans** — the first explicit boolean among the `liquidRenderingCanary` / `liquid_canary`
   variants. An explicit `false` here forces React.
3. **Default** — the constant, `false`.

> ⚠️ **Operational trap.** The gateway writes `renderer_engine: 'liquid'` into `release_manifest` for
> **any** release carrying a Liquid bundle, and theme install writes `rendererEngine` into
> `sites.template_config`. **Publishing a Liquid-bundled theme therefore opts a store into Liquid with no
> human canary decision.** Treat every publish of a Liquid-bundled theme as a canary enrolment.

---

## 2. `FEATURE_LIQUID` is not a kill switch

It is declared and set per environment (`dev` `"true"`, `staging` `"true"`, `production` `"false"`), but
`featureGate()` is only ever instantiated for `FEATURE_GRAPHQL` and `FEATURE_EXTENSIONS`, and `/themes`
mounts ungated. **Toggling it changes nothing.** Any runbook or incident procedure naming it as a lever
is wrong. Renderer selection is entirely storefront-side and per-theme.

Resolving this — wire it or formally document it as dormant — is ARB docket **D-08**.

---

## 3. Per-site canary strategy

**Currently supported:** per-theme / per-release opt-in via `rendererEngine`. There is **no tenant
allowlist mechanism** — no percentage rollout, no cohort, no env-scoped gate.

| Step | Action | Gate |
|---|---|---|
| 1 | Confirm `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is still `false` | `node scripts/validators/theme-governance-validator.mjs` must report *"Liquid default OFF"* |
| 2 | Confirm the store is explicitly enrolled | `select template_config->>'rendererEngine' from sites where subdomain = '<handle>';` |
| 3 | Confirm a valid Liquid bundle parses | Absent/invalid bundle silently falls back to React |
| 4 | **Confirm rollback works for this store's sections** | ⛔ **Currently fails** — see the header |
| 5 | Confirm the parity harness is green | ⛔ `scripts/liquid-parity/run-parity-matrix.mjs` is wired into no CI job |

**Steps 4 and 5 cannot be satisfied today. No new store may be enrolled.**

---

## 4. Rollback procedures

### 4.1 Renderer rollback (per store) — ⚠️ currently degraded

```sql
-- Verify first
select subdomain, template_config->>'rendererEngine' from sites where subdomain = '<handle>';
-- Roll back to React
update sites set template_config = template_config - 'rendererEngine' where subdomain = '<handle>';
```

Also clear `renderer_engine` on the current `theme_releases` row, or precedence rule 1 re-enables Liquid.

> ⚠️ Expect placeholder boxes on cart, login, account, blog and policy pages until the fallback defect is
> fixed. For a store in incident, **unpublishing is currently safer than renderer rollback.**

### 4.2 Active-theme rollback

Three stores disagree on "which theme is active" — `sites.theme_id`, `theme_instances.instance_status`,
`store_themes.is_active`. **`sites.theme_id` is what the storefront reads.** Which is canonical is ARB
docket **D-06** (an R-15 ruling).

```sql
select s.subdomain, s.theme_id,
       (select string_agg(theme_slug || '=' || instance_status, ', ') from theme_instances where store_id = s.id) as instances,
       (select count(*) from store_themes where store_id = s.id and is_active) as legacy_active
from sites s where s.subdomain = '<handle>';
```

Prefer the gateway rollback route (`POST /themes/:slug/releases/:releaseId/rollback`) over raw SQL — it
writes the audit and outbox rows. A raw-SQL write leaves the DB internally inconsistent; that is exactly
what was found at 13:30:32 on 2026-08-04 (three writes, zero audit rows, an unreachable
`is_current=true` + `release_status='superseded'` combination).

### 4.3 Migration rollback

| Migration | Rollback | Caveat |
|---|---|---|
| `196_theme_rls_tenant_hardening` | ✅ verified round-trip | **Restores the `USING(true)` PUBLIC policy on `themes`** and drops forced RLS 31 → 7 — it reopens a tenancy exposure. Treat as break-glass only |
| `197_letbuyy_core_first_class_theme` | ✅ verified | **Aborts** if dependents exist; refuses when provenance is `repair` (reverting would restore Urban Kicks branding) |
| `180`, `181`, `188`, `189`, `190`, `191` | ✅ authored here | Previously unpaired (MIG-R3 violation) |

**General caveat:** these are DDL/data rollbacks, not point-in-time recovery. Take a `pg_dump` first.

---

## 5. Monitoring — what to watch, and what is not available

| Signal | Where | Status |
|---|---|---|
| Section render failures | `lb:section-error` comments in output; renderer warnings | ✅ emitted |
| Render-limit aborts | warning text `template render limit exceeded` | ✅ — **watch this**, it was the root cause of the empty-shell defect |
| Liquid vs React per request | `X-Lb-Render-Engine` header | ❌ **removed** — it read an env var declared nowhere and always reported `react`. A fabricated value is worse than none (ANTI-R9) |
| Fallback rate | — | ❌ not instrumented |
| Parity harness | `run-parity-matrix.mjs` | ❌ not in CI |

**Rollback triggers** — any of: `lb:section-error` on a shopper-facing template; a spike in
`template render limit exceeded`; a cross-tenant report; checkout handoff failures; a shopper unable to
reach cart or account.

---

## 6. ARB approvals still required

| # | Decision | Blocks |
|---|---|---|
| D-09 | React fallback + parity harness — **Liquid has no working rollback** | **All canary expansion** |
| D-01 | Unsigned public order-create vs the orphaned ART-14 signed handoff | Broad enablement |
| D-02 | Pre-payment inventory hard-decrement never released | Broad enablement |
| D-03 | GST computed to zero; invoices never issued | Broad enablement (legal) |
| D-04 | COD not ledgered at confirm | Broad enablement |
| D-06 | Theme-lifecycle mutation contract + which active-theme store is canonical | Deterministic rollback |
| D-07 | Shopper auth — no-JS Turnstile, brute-force, two token shapes | Broad enablement |
| D-08 | `FEATURE_LIQUID`: wire it or declare it dormant | Incident procedure correctness |
| — | Sanitizer `ADD_ATTR` for `property`/`rel` (Open Graph, favicon) | SEO/social completeness |
| — | Global Liquid default flip | **Production default** |

Full docket: [17-open-decisions-and-arb-gates.md](17-open-decisions-and-arb-gates.md).

---

## 7. Standing invariants

- **React is not deleted** (ART-17 — the data decision belongs to the hardening wave).
- **No new React-per-section components** (`THEME-R2`; `no-new-react-sections-validator` green).
- **Global Liquid default stays OFF.**
- **Sanitizer `FORBID` lists unchanged.** `ownPropertyOnly`, drop scrub, `outputEscape`, upload-time
  `{% render %}` forbidding, `parseLimit`, `memoryLimit` all intact. Only `renderLimit` — a wall-clock
  abort — was retuned, with the reasoning recorded at `theme-renderer.ts`.
- **Never run `node scripts/validate-governance.mjs` on a developer machine** without expecting a full
  `pnpm install` afterwards — it deletes `node_modules` under `apps/`, `packages/`, `services/`.
