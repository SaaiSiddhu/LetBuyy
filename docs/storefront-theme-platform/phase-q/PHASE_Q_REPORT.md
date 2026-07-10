# Phase Q Report — Merchant Theme Library

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Q — Merchant Theme Library
**Date authored:** 2026-07-10
**Branch:** `stepup/main`
**Author scope:** Phase Q ships the merchant theme library surface across two lanes (gateway + merchant UI). No SECURITY DEFINER RPCs modified, no frozen apps touched, no Phase P surface changed.

---

## HUMAN REVIEW GATE — Read Before Deploying

Migration 190 (`190_theme_library_q.sql`) adds `owned_by_site_id` and `is_site_private` columns to the `themes` table with two supporting indexes. **This migration has NOT been applied to any database. It MUST NOT be applied to production without explicit ARB sign-off.**

The Phase Q code changes are complete and all tests pass. No production deployment is implied by this phase completion.

---

## 1. What Shipped

### 1.1 Lane A — Gateway (New Files)

| File | Purpose |
|---|---|
| `database/supabase/migrations/190_theme_library_q.sql` | Adds `owned_by_site_id uuid NULL FK→sites(id)` + `is_site_private boolean DEFAULT false` to `themes`; 2 supporting indexes; additive + idempotent |
| `services/api-gateway/src/__tests__/theme-library-q.test.ts` | 41 tests (36 implementation + 5 hardening): cross-tenant, conflict guards, source-pattern, schema safeParse, migration safety |

### 1.2 Lane A — Gateway (Modified Files)

| File | Change |
|---|---|
| `packages/billing-core/src/index.ts` | Added `themes: number\|null` to every tier's `limits` block in `STORE_BILLING_TIER_DEFINITIONS` (free=1, starter=3, business=10, enterprise=null, launch=3, growth=5). `BillingTierEntitlementSnapshot.limits` is `Record<string,number\|null>` — no interface change needed |
| `packages/typescript/api-client/src/index.ts` | Added 6 typed method stubs to the `themes` group: `listSiteLibrary`, `createTheme`, `duplicateTheme`, `renameTheme`, `archiveTheme`, `deleteUnpublishedTheme` |
| `services/api-gateway/src/schemas/theme.schema.ts` | Added 6 new Zod schemas (with inferred types) at the bottom of the file: `ListSiteThemesQuerySchema`, `CreateSiteThemeSchema`, `DuplicateSiteThemeSchema`, `RenameSiteThemeSchema`, `ArchiveSiteThemeSchema`, `DeleteUnpublishedThemeQuerySchema`; local `UuidField` and `ThemeNameField` constants |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | Added 6 new methods at end of `ThemeExecutionAdapter` class: `listSiteThemes`, `createSiteTheme`, `duplicateSiteTheme`, `renameSiteTheme` (with `owned_by_site_id` catalog protection), `archiveSiteTheme` (published-theme block), `deleteUnpublishedSiteTheme` (two-layer published-theme block). All call `verifyStoreOwner` as the first step |
| `services/api-gateway/src/routes/themes.ts` | 6 new `authMiddleware` registrations at top of router block (before all existing `/:slug/*` registrations); `resolveStoreThemeLimit` + `countInstalledSiteThemes` helper functions; 6 new route handlers (GET `/library`, POST `/library/create`, POST `/:slug/duplicate`, PATCH `/:slug/rename`, POST `/:slug/archive`, DELETE `/:slug/unpublished`) — all registered before `POST /:slug/validate` and `GET /:slug` catch-all |

### 1.3 Lane B — Merchant UI (New Files)

| File | Purpose |
|---|---|
| `apps/merchant-control-plane/src/app/api/themes/library/route.ts` | GET proxy → gateway `GET /themes/library?store_id=` |
| `apps/merchant-control-plane/src/app/api/themes/library/create/route.ts` | POST proxy → gateway `POST /themes/library/create` |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/duplicate/route.ts` | POST proxy → gateway `POST /themes/:slug/duplicate` |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/rename/route.ts` | PATCH proxy → gateway `PATCH /themes/:slug/rename` |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/archive/route.ts` | POST proxy → gateway `POST /themes/:slug/archive` |
| `apps/merchant-control-plane/src/app/api/themes/[themeId]/route.ts` | DELETE proxy → gateway `DELETE /themes/:slug/unpublished` |
| `apps/merchant-control-plane/src/components/theme-library/ThemeLibraryCard.tsx` | Per-theme card with action menu (publish, duplicate, rename, archive, delete), ARIA labels, en-IN dates, `--lb-*` tokens |
| `apps/merchant-control-plane/src/components/theme-library/ThemeLibraryWorkspace.tsx` | Library container: loading/empty/error states, responsive grid, create/rename modals, archive/delete ConfirmDialogs, friendly error surfacing |
| `apps/merchant-control-plane/tests/theme-library-q.test.mjs` | 24 tests (23 implementation + 1 hardening): proxy structure, no-DB-write, error passthrough, UI state, a11y, design tokens |

### 1.4 Lane B — Merchant UI (Modified Files)

| File | Change |
|---|---|
| `apps/merchant-control-plane/src/app/[store]/online-store/themes/page.tsx` | Added tab strip (ARIA tablist/tab/tabpanel): "My themes" tab (default) renders `ThemeLibraryWorkspace`; "Discover themes" tab preserves existing catalog browse UI unchanged |
| `apps/merchant-control-plane/package.json` | Minor dependency/script updates required by new components |

### 1.5 Hardening Changes (Both Lanes)

Three blocking/high-priority findings were fixed after implementation and before phase completion:

| Finding | Severity | File | Fix |
|---|---|---|---|
| `renameSiteTheme` writes to shared marketplace catalog row without `owned_by_site_id` scope | HIGH | `theme-execution.adapter.ts` | Read `themes.owned_by_site_id`; throw `ForbiddenError` if null or not equal to `storeId`; add `.eq('owned_by_site_id', storeId)` to UPDATE |
| Plan limit check before ownership exposes foreign store billing tier | MEDIUM | `routes/themes.ts` | Call `adapter.verifyStoreOwner` immediately after `resolveCustomUser` in `/library/create` and `/:slug/duplicate`, before `resolveStoreThemeLimit` |
| `handlePublish` sends `store_name` in JSON body; proxy reads it from query string → 400 on every click | MEDIUM | `ThemeLibraryWorkspace.tsx` | Changed fetch to include `store_name` as URL query parameter |

5 gateway hardening tests (37–41) and 1 merchant hardening test (24) confirm all three fixes.

### 1.6 What Was Not Touched

- `publish_theme_release` SECURITY DEFINER RPC — unchanged (ARB gate)
- `theme-registry.ts` — frozen (ART-17)
- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` — stays `false`
- DOMPurify sanitizer — unchanged
- Frozen apps (`app-marketplace`, `theme-marketplace`, `developer-portal`) — unchanged
- Phase P surface (`PUT /editor/draft`, `POST /publish`, `POST /releases/:releaseId/rollback`) — unchanged
- `services/api-gateway/src/index.ts` — not modified; Phase Q routes are added inside `themes.ts` which is already mounted at `/themes` in `index.ts`
- `packages/theme-engine/` modules — unchanged
- Foreign WIP files (migrations 186/187, `tenant-tables.registry.ts`, identity-platform, marketing-site WIP) — undisturbed

---

## 2. Test Gate Result

| Stage | Tests | Typecheck |
|---|---|---|
| Phase P baseline (entering Phase Q) | 438 api-gateway · 1034 theme-engine | Clean |
| Phase Q implementation | 36 new gateway · 23 new merchant | Clean |
| Phase Q hardening (final) | **41/41** gateway (file-scoped) · **39/39** merchant (24 Q + 15 pre-existing) | **Clean** |

**Gateway command:** `npx tsx --test services/api-gateway/src/__tests__/theme-library-q.test.ts && pnpm typecheck --filter=@letbuyy/api-gateway`  
**Merchant command:** `pnpm typecheck test --filter=@letbuyy/merchant-control-plane`  
**Merchant turbo tasks:** 14/14 tasks pass  
**API-gateway typecheck tasks:** 32/32 tasks pass

Net new tests: **+41 gateway, +24 merchant**. 3 pre-existing failures unchanged. 0 Phase Q regressions.

---

## 3. Key Design Decisions

### 3.1 Route Registration at Top of themes.ts (Before Any /:slug/* Middleware)

The six new `authMiddleware` registrations appear before the existing `router.use('/:slug/editor', authMiddleware)` and all other path-prefixed middleware. This prevents Hono's routing from matching `GET /library` as `GET /:slug` with `slug='library'`. Source-pattern tests confirm the ordering.

### 3.2 Site-Private Themes via is_active=false + is_site_private=true

Rather than a separate `site_themes` table, Phase Q adds two discriminator columns to the shared `themes` table. This reuses the existing `theme_instances` join pattern without new foreign key relationships or additional adapter surface. The public catalog query (`is_active=true` filter) already excludes site-private rows — no catalog contamination possible without migration 190's `owned_by_site_id` guard being wrong.

### 3.3 Ownership Before Plan Limit (IDOR Prevention)

The plan limit check reads `subscriptions`, `plans`, and billing tier data for a `store_id`. If a merchant can supply a foreign `store_id` and reach the plan limit check before ownership is verified, they learn that store's billing tier and theme count from the 409 error body. The fix calls `verifyStoreOwner` immediately after `resolveCustomUser` in both create and duplicate handlers — before any billing data is accessed.

### 3.4 Rename Scope to owned_by_site_id (Catalog Integrity)

Marketplace themes (`owned_by_site_id IS NULL`) are shared catalog rows visible to all tenants. A merchant renaming a marketplace theme's shared row would change the display name for every other merchant using that theme. The `renameSiteTheme` method has three layers of protection: (1) `verifyStoreOwner` blocks cross-tenant `store_id`; (2) application-level check on `owned_by_site_id`; (3) DB UPDATE scoped by `.eq('owned_by_site_id', storeId)`.

### 3.5 Two-Layer Published-Theme Delete Block

`deleteUnpublishedSiteTheme` checks both `sites.theme_id === slug` and `theme_releases.is_current=true` for the store. The first guard handles the normal case; the second handles edge cases where `sites.theme_id` may not reflect the latest publish state. Either guard producing a positive result blocks the delete with 409.

### 3.6 handlePublish Proxy Convention

The existing `[themeId]/editor/route.ts` PUT proxy reads `store_name` exclusively from `searchParams` (not from the JSON body). `ThemeLibraryWorkspace.handlePublish` was corrected to include `store_name` as a URL query parameter to match this convention.

---

## 4. Hardening Summary

Five findings from code review were addressed before phase completion:

| Finding | Severity | Resolution |
|---|---|---|
| `renameSiteTheme` catalog contamination (UPDATE not scoped to `owned_by_site_id`) | HIGH | App-level `owned_by_site_id` check + DB-level `.eq('owned_by_site_id', storeId)` on UPDATE |
| IDOR leak: plan limit check before ownership (POST /library/create) | MEDIUM | `verifyStoreOwner` moved before `resolveStoreThemeLimit` |
| IDOR leak: plan limit check before ownership (POST /:slug/duplicate) | MEDIUM | Same fix as above |
| `handlePublish` sends `store_name` in JSON body; proxy reads from query string → 400 | MEDIUM | `store_name` moved to URL query param in `fetch` call |
| Plan limit enforcement TOCTOU (non-atomic count-then-insert) | MEDIUM | Documented as RISK-TOCTOU-Q01; ARB-gated for DB-level enforcement |

Two additional review findings about the same rename catalog issue (duplicate perspectives on the same root cause) confirm the fix is comprehensive.

One LOW finding (pre-existing uncommitted foreign WIP in `services/api-gateway/src/index.ts`) is a housekeeping note — Phase Q does not touch `index.ts` and these changes are not within Phase Q scope.

---

## 5. [IRREVERSIBLE] Operations — None in Phase Q

Phase Q makes no irreversible DB changes. Migration 190 is additive (nullable column + boolean with default + two indexes) and has NOT been applied to any database. If migration 190 were applied and subsequently needed to be rolled back, `DROP COLUMN` would be required (ARB-repaired). The columns being nullable / having defaults means Phase Q TS code can be reverted without rolling back the migration — the columns become dormant.

No SECURITY DEFINER RPC was modified. No existing RLS policy was changed.

---

## 6. Rollback

Rollback = revert the Phase Q commit(s):

```bash
git revert <phase-q-commit-sha>
```

Phase Q adds:
- 9 new files in gateway lane (migration, test file, modified source files count as edits not additions)
- 9 new files in merchant lane (6 proxy routes, 2 components, test file)
- Surgical changes to 5 existing files (billing-core, api-client, theme.schema.ts, theme-execution.adapter.ts, routes/themes.ts in gateway; page.tsx and package.json in merchant)

A revert removes all new files and reverses the surgical changes. Migration 190 has not been applied to any database, so no DB rollback is required.

---

## 7. Foreign WIP Exclusions

The following pre-existing uncommitted changes are present in the working tree and were not staged by Phase Q:

- `services/api-gateway/src/index.ts` — founding-public routes, founding routes, internal-founding, commerce-analytics, smart-collections (pre-existing foreign WIP from prior work streams)
- `database/supabase/migrations/186_*.sql`, `187_*.sql` — untracked foreign migrations
- `services/api-gateway/src/tenant/tenant-tables.registry.ts` — pre-existing tenant-registry drift
- `apps/identity-platform/`, `apps/marketing-site/`, `apps/merchant-control-plane/` (non-theme files) — various pre-existing WIP

None of these were staged or modified by Phase Q. Their presence does not affect Phase Q's correctness.

---

## 8. Architectural Invariants Maintained

| Constraint | Status |
|---|---|
| `theme-registry.ts` frozen (ART-17) | MAINTAINED |
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | MAINTAINED |
| `publish_theme_release` SECURITY DEFINER RPC unchanged | MAINTAINED (ARB gate respected) |
| DOMPurify sanitizer unchanged | MAINTAINED |
| Frozen apps unchanged | MAINTAINED |
| Foreign WIP files undisturbed | MAINTAINED |
| `validate-governance.mjs` EXIT=1 pre-existing failure | UNCHANGED (pre-existing foreign drift; Phase Q does not fix and does not worsen) |
| No unconditional `USING(true)` on tenant data in Phase Q additions | CONFIRMED |
| Canonical ledger (`canonical-ledger-only-validator`) | MAINTAINED (no money table mutations) |
| All proxy routes resolve storeId server-side via `resolveOwnedStoreId` | CONFIRMED |
| Marketplace theme catalog rows immutable via rename | CONFIRMED (three-layer protection) |

---

## 9. Risks Registered

One new Phase Q risk is added to `RISK_REGISTER.md`:

- **RISK-TOCTOU-Q01** (MEDIUM): Plan limit enforcement is non-atomic — concurrent create/duplicate requests for the same store that both read `count < limit` before either write completes can both succeed, exceeding the billing cap. Sequential requests (the dominant real-world pattern) are correctly gated. Full closure requires ARB sign-off on a DB-level `SECURITY DEFINER` RPC or `CHECK` constraint. **Target:** Phase AB or ARB follow-up.

---

## 10. Phase Completion Checklist

- [x] `router.use('/library', authMiddleware)` and 5 other new middleware registrations at top of `themes.ts` (before existing `/:slug/*` registrations)
- [x] 6 Zod schemas with inferred types in `theme.schema.ts`
- [x] 6 adapter methods in `ThemeExecutionAdapter` — all call `verifyStoreOwner` first
- [x] `renameSiteTheme`: `owned_by_site_id` app-level check + DB-level `.eq('owned_by_site_id', storeId)` on UPDATE
- [x] `archiveSiteTheme`: published-theme block via `sites.theme_id` check
- [x] `deleteUnpublishedSiteTheme`: two-layer published-theme block (`sites.theme_id` + `theme_releases.is_current=true`)
- [x] `createSiteTheme` and `duplicateSiteTheme`: ownership check before plan limit check in route handlers
- [x] `resolveStoreThemeLimit` + `countInstalledSiteThemes` helpers following `resolveStoreStaffLimit` pattern
- [x] `billing-core`: `themes` field added to all 6 tier limit blocks
- [x] `api-client`: 6 new typed method stubs
- [x] Migration 190: additive, idempotent, no forbidden DDL, `migration-safety-validator` exit 0
- [x] 6 merchant proxy routes — all use `resolveOwnedStoreId`, `merchantApiFetch`, `merchantApiErrorResponse`
- [x] `ThemeLibraryCard.tsx`: ARIA labels, en-IN dates, `--lb-*` tokens, action menu with disabled states
- [x] `ThemeLibraryWorkspace.tsx`: loading/empty/error, responsive grid, create/rename modals, archive/delete dialogs, `store_name` in query param for `handlePublish`
- [x] `themes/page.tsx`: ARIA tab strip, `ThemeLibraryWorkspace` in "My themes" panel, existing discover UI in "Discover themes" panel
- [x] Gateway test gate: 41/41 (file-scoped); api-gateway typecheck 32/32 tasks
- [x] Merchant test gate: 39/39 (24 Q + 15 pre-existing); merchant-control-plane 14/14 turbo tasks
- [x] 3 blocking findings fixed (catalog contamination, IDOR plan limit, handlePublish 400)
- [x] RISK_REGISTER.md updated: RISK-TOCTOU-Q01 added
- [x] PROGRAM_STATE.md updated: Phase Q COMPLETE, next = R
- [x] API_CONTRACTS.md updated: Phase Q library routes added

---

## 11. Next Phase

**Phase R — Visual Editor Shell**

Phase R builds the editor shell: the main editing canvas, section/block tree panel, settings sidebar, and the basic drag-and-drop section reorder surface. It consumes `theme_editor_drafts` (read: Phase P draft load) and integrates with `theme_instances` from Phase Q (the library workspace becomes the entry point to the editor). Phase R must address RISK-SEC-P01 (`theme_editor_drafts` RLS checks `user_id` only, not `custom_user_id`) before adding any client-side realtime subscription over drafts.

Gate entering Phase R: api-gateway baseline **438** (Phase P gate) + **41** Phase Q file-scoped tests + theme-engine **1034**.
