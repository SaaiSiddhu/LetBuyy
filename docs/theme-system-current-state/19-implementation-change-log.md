# 19 — Implementation Change Log

> Every file this engagement changed, why, and what it closed. **Date:** 2026-08-04 → 2026-08-05.
>
> **Attribution rule.** The working tree was already dirty with 721 user-owned content changes stamped
> **22:02**, before this engagement began. Only files stamped later are listed here. Files such as
> `config/env/*.env.example`, `packages/infrastructure/resend-adapter/index.ts`,
> `packages/shared-types/src/index.ts`, `pubspec.lock`, `apps/developer-portal/**`,
> `apps/marketing-site/**` and `packages/typescript/ui/**` are **user-owned and untouched**.

---

## 1. Security — tenant isolation (ARB-authorized)

| File | Diff | Change | Closes |
|---|---|---|---|
| `services/api-gateway/src/routes/storefront.ts` | +21/−17 | `loadSiteByHandle`, `loadPublishedStore`, `loadPublishedStoreById` and the pooled-SQL twin resolve `subdomain` exactly instead of `subdomain OR store_name … LIMIT 1`; `.single()` → `.maybeSingle()` so >1 row fails closed; the `deleted_at`-dropping retry is gated on `isSchemaMismatchError` so a soft-deleted site can no longer be resurrected | **TEN-01** cross-tenant read |
| `services/api-gateway/src/routes/onboarding.ts` | +43/−8 | Cross-column collision check before the `sites` insert, using `.in()` (which quotes reserved characters) rather than an interpolated `.or()`; `/check-subdomain` now probes both columns and fails closed on query error instead of reporting "available" | The write path that made handles ambiguous |
| `services/api-gateway/src/routes/storefront/public-routes.ts` | +19/−8 | Fourth resolver — same ambiguous `.or()` with raw interpolation — made single-valued and injection-safe | **TEN-01** (second instance) |
| `services/api-gateway/src/routes/stores.ts` | +61/−19 | Fifth resolver made injection-safe; the uniqueness check at the store-create path now fails **closed** when its query errors instead of skipping the guard | Filter injection + fail-open guard |
| `apps/storefront-runtime/src/proxy.ts` | +106/−25 | `/store/<handle>` is access-gated on **every** host class, not just `*.vercel.app`; `rewriteToStore`'s prefix test is now segment-bounded (`startsWith('/store/saai')` also matched tenant `saaix`); `AbortSignal.timeout(3000)` on both store-access fetches; the fabricated `X-Lb-Render-Engine` header removed | **TEN-11**, **TEN-12**, sibling-tenant leak |
| `apps/storefront-runtime/src/app/preview/page.tsx` | +17/−7 | `loadPreviewStore` no longer falls back to `getStoreBySubdomainAnyStatus`; a valid store-bound preview token is mandatory | Gate bypass via `/preview?subdomain=` |
| `database/supabase/migrations/196_theme_rls_tenant_hardening.sql` (+ rollback) | +109 / +55 | Replaces the `USING(true)` PUBLIC policy on `themes` with scoped catalog + owner policies; raises forced-RLS theme-table coverage 7 → 31 | **TEN-06**, **TEN-07** |

**Verified**: the old predicate was shown live to return the *attacker's* row for the victim's handle
under a forced sequential plan; the new one returns the victim under both plans, through real PostgREST.
Migration 196 was applied, re-applied (idempotent), rolled back (`themes` back to `USING(true)`, 31 → 7),
and re-applied.

---

## 2. `letbuyy-core` and the theme bundle

| File | Diff | Change |
|---|---|---|
| `database/supabase/migrations/197_letbuyy_core_first_class_theme.sql` (+ rollback) | +350 / +66 | Builds the canonical row from **literals**, removing the seed dependency that made migration 188 a silent no-op on every fresh DB. Repairs 188's Urban-Kicks-branded clone where it exists, records provenance so the rollback knows what it created, and **aborts** rather than cascade-deleting when dependents exist. Deliberately does **not** set `rendererEngine: 'liquid'` |
| `packages/theme-engine/src/theme-bundle.ts` | +201/−1 | `collection-filter` and `faq-accordion` sections (their absence degraded every experience's collection template and all of craft); `list-collections` and `contact` templates; layout hardening — skip link, `<header>`/`<footer>` landmarks, `:focus-visible`, mobile-first `min-width` CSS, `--lb-*` tokens |
| `packages/theme-engine/src/theme-bundle-core.ts` | +11/−7 | `urban-offer` added to the brand-replacement chain — the token survived because it is not `urban-kicks` |
| `packages/theme-engine/src/portable-to-liquid.ts` | +19/−6 | Compiles from the neutral Core fixture, not the Urban Kicks demo. Optional `baseTheme` keeps demo/seed callers working |
| `packages/theme-engine/src/{experience-apply,experience-compositions,theme-presets,section-type-map}.ts` | +641/−318 | `COMPOSE_ADDITIVE` safe-apply contract, composition-vs-bundle integrity function, `hasOwnProperty` hardening on section-type lookups |
| `packages/theme-engine/examples/**` | regenerated | 71 → 75 files; all manifest SHA-256 checksums regenerated and spot-verified |

**Branding proof**: `compilePortableToLiquidBundle` output went from `Urban Kicks` ×8 / `urban-kicks` ×2
to **0 / 0**; the Core fixture was shown structurally identical (1 892 JSON paths, 0 differing; one
intentional leaf difference).

---

## 3. The four Liquid failures — root cause and fix

| File | Diff | Change |
|---|---|---|
| `packages/theme-engine/src/theme-renderer.ts` | +16/−1 | `renderLimit` 250 ms → 5 000 ms, with the full diagnosis recorded in-place |

LiquidJS `renderLimit` is a **wall-clock** budget. Sections render concurrently (`Promise.all`) while
`sanitizeRenderedHtml` runs jsdom + DOMPurify **synchronously**, so a trivial section is aborted because
a sibling starved the event loop. `sections/product-detail.liquid` renders in **2.9 ms in isolation under
the same 250 ms limit** yet was replaced by an `lb:section-error` placeholder inside the pipeline —
producing a correct shell with empty item containers, which looked exactly like broken data binding.

Structural sandbox guards unchanged: `ownPropertyOnly`, drop scrub, `outputEscape`, upload-time
`{% render %}` forbidding, `parseLimit` (300 000), `memoryLimit` (2 MB).

**Also reverted, in the same area:** the layout hardening had added `<meta property="og:*">` and
`<link rel="icon">`. The WHOLE_DOCUMENT DOMPurify pass allowlists `name` and `content` but **not**
`property` or `rel`, so they rendered as `<meta content="website">` and `<link href="…">` — malformed
markup no crawler can use. They were **removed** rather than shipped broken. Restoring Open Graph
requires adding `property`/`rel` to `ADD_ATTR`, which is a sanitizer-allowlist change and an ARB gate
under THEME-R4 / SEC-R11. The `twitter:*` tags use `name=` and render intact.

---

## 4. Governance hygiene

| File | Diff | Change | Result |
|---|---|---|---|
| `services/api-gateway/src/routes/themes/theme-update-route.ts` | +1/−9 | Local crypto helpers replaced with the shared `sha256Hex` (verified byte-identical) | `single-source-crypto-validator` **fail → pass** |
| `packages/theme-engine/src/theme-library-schemas.ts` **(new)** | +57 | The 6 Phase-Q library contracts moved out of the gateway facade | — |
| `packages/theme-engine/src/index.ts` | +2 | Barrel export for the above | — |
| `services/api-gateway/src/schemas/theme.schema.ts` | +17/−48 | Now a pure re-export; all exported names preserved | `domain-boundary-validator` **no longer names this file** |
| `database/supabase/rollback/{180,181,188,189,190,191}_*.rollback.sql` **(new)** | +209 | The six theme migrations that shipped with no paired DOWN | MIG-R3 / R-23 |

Migration and rollback files were made visible to `sequential-migration-validator` with `git add -N`
(intent-to-add — path recorded, **no content staged, nothing committed**).

---

## 5. Tests added

| File | Tests | Proves |
|---|---|---|
| `services/api-gateway/src/__tests__/storefront-handle-resolution.test.ts` **(new)** | 6 | Handle resolution is single-valued and fail-closed. Leads with a **control** asserting the removed predicate selects the *namesake* tenant, so the suite fails if the fix is reverted; asserts on a field that differs between the two sites |
| `tests/security/theme-tenant-isolation.test.mjs` **(new)** | 6 | Two-site isolation with the **TEST-R4 positive control ordered first**; forced-RLS posture; zero rows without `app.site_id` |
| `packages/theme-engine/test/liquid-render-limit-contention.test.ts` **(new)** | 3 | No section is dropped as a section error; `product-detail` reaches output; four concurrent renders all complete |

**Assertions changed — declared explicitly.** Adding the two sections invalidated 7 assertions that
encoded their *absence* as expected (e.g. *"faqAccordion returns incompatible (no parity file in UK
bundle)"*). They were inverted, and coverage was preserved rather than deleted:

- the mapped-but-absent branch is now covered by `instagramFeed` / `videoHero`, which genuinely remain absent;
- the `incompatibleReason` test now removes `faq-accordion` from `section_definitions` to reproduce the
  older-bundle case deterministically.

No assertion was weakened to make a failing test pass.

---

## 6. Deliberately not done

- **No commit, push, merge, or deploy.**
- **No frozen path edited** — `packages/theme-engine/src/theme-registry.ts` and
  `packages/typescript/ui/src/tokens.ts` are `0/0` and `9/0` (the latter user-owned).
- **`services/api-gateway/src/execution/theme-execution.adapter.ts` never touched** — it carries 166/81
  of uncommitted user work and was on every agent's never-touch list; integrity re-verified each round.
- **No money RPC, payment, auth-issuer, step-up or sanitizer `FORBID` change.**
- **Liquid default not flipped** — `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains `false`.
- **`customers/reset_password` / `customers/activate_account` templates not added** — adding orphaned
  templates would imply a capability that has no route. See [24-known-limitations.md](24-known-limitations.md) §3.
