# Phase Q Test Report — Cross-Tenant, UI-State, and Accessibility Coverage

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** Q — Merchant Theme Library
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## 1. Test Gate Summary

| Stage | Tests | Typecheck |
|---|---|---|
| Phase P baseline (entering Phase Q) | 438 api-gateway · 1034 theme-engine | Clean (32/32 tasks) |
| Phase Q implementation | 36 new (theme-library-q.test.ts) · 23 new (theme-library-q.test.mjs) | Clean |
| Phase Q hardening | +5 gateway · +1 merchant (total 41 + 24) | Clean |
| **Phase Q final** | **41/41** (gateway file-scoped) · **39/39** (merchant: 24 Q + 15 pre-existing) | **Clean** |

**Gateway command:** `npx tsx --test services/api-gateway/src/__tests__/theme-library-q.test.ts && pnpm typecheck --filter=@letbuyy/api-gateway`  
**Merchant command:** `pnpm typecheck test --filter=@letbuyy/merchant-control-plane`

**Net new tests (Phase Q):** +41 gateway · +24 merchant = **+65 total**

**Pre-existing failures:** 3 (unchanged from Phase P — merchant AI route, executive analytics migration, storefront runtime payment route). None introduced by Phase Q.

---

## 2. Gateway Test File

**File:** `services/api-gateway/src/__tests__/theme-library-q.test.ts`  
**Total tests:** 41 (36 implementation + 5 hardening)  
**Test runner:** Node.js `node:test` with `tsx`  
**DB:** Mocked (makeMockDb / makeChain helpers — no real database connection required)

### 2.1 Cross-Tenant Isolation (Tests 1–6)

One test per operation. Each test creates a mock `sites` chain that returns an empty row (simulating Site B's `store_id` supplied by a Site A merchant). Verifies that `ForbiddenError` is thrown from within `verifyStoreOwner` before any `theme_instances` query runs.

| Test # | Operation | Assertion |
|---|---|---|
| 1 | `listSiteThemes` | ForbiddenError on null sites row |
| 2 | `createSiteTheme` | ForbiddenError on null sites row |
| 3 | `duplicateSiteTheme` | ForbiddenError on null sites row |
| 4 | `renameSiteTheme` | ForbiddenError on null sites row |
| 5 | `archiveSiteTheme` | ForbiddenError on null sites row |
| 6 | `deleteUnpublishedSiteTheme` | ForbiddenError on null sites row |

### 2.2 Conflict Guards (Tests 7–10)

| Test # | Operation | Scenario | Expected result |
|---|---|---|---|
| 7 | `archiveSiteTheme` | `sites.theme_id === slug` | ConflictError `THEME_CURRENTLY_PUBLISHED` |
| 8 | `deleteUnpublishedSiteTheme` | `sites.theme_id === slug` | ConflictError `CANNOT_DELETE_PUBLISHED_THEME` |
| 9 | `deleteUnpublishedSiteTheme` | `theme_releases.is_current=true` for store | ConflictError `CANNOT_DELETE_PUBLISHED_THEME` |
| 10 | `duplicateSiteTheme` | Source instance not in this store | NotFoundError (not 403 — enumeration prevention) |

### 2.3 Source-Pattern Assertions — Route Registration Order (Tests 11–16)

Tests read `services/api-gateway/src/routes/themes.ts` source text (via `readFileSync`) and assert that:

| Test # | Assertion |
|---|---|
| 11 | `router.use('/library', authMiddleware)` appears before `router.use('/:slug/editor', authMiddleware)` |
| 12 | `router.use('/:slug/duplicate', authMiddleware)` appears before `router.use('/:slug/editor', authMiddleware)` |
| 13 | `router.use('/:slug/archive', authMiddleware)` appears in the source |
| 14 | `router.get('/library'` appears before `router.get('/:slug'` (no shadowing) |
| 15 | `router.post('/library/create'` appears before `router.get('/:slug'` (no shadowing) |
| 16 | `router.delete('/:slug/unpublished'` appears before `router.get('/:slug'` (no shadowing) |

### 2.4 Source-Pattern Assertions — Adapter Scoping (Tests 17–19)

| Test # | Assertion |
|---|---|
| 17 | `listSiteThemes` adapter: `.eq('store_id', storeId)` appears before `.eq('theme_slug'` on theme_instances query |
| 18 | `archiveSiteTheme` adapter: `instance_status` update scoped by `store_id` |
| 19 | `deleteUnpublishedSiteTheme` adapter: soft-delete update scoped by `store_id` |

### 2.5 Audit Event Assertions (Tests 20–22)

| Test # | Assertion |
|---|---|
| 20 | `createSiteTheme` adapter source contains `action: 'theme.create'` |
| 21 | `archiveSiteTheme` adapter source contains `action: 'theme.archive'` |
| 22 | `deleteUnpublishedSiteTheme` adapter source contains `action: 'theme.delete'` |

### 2.6 Schema safeParse Tests (Tests 23–33)

| Tests | Schema | Assertions |
|---|---|---|
| 23–25 | `ListSiteThemesQuerySchema` | accepts valid UUID · rejects missing store_id · rejects non-UUID |
| 26–28 | `CreateSiteThemeSchema` | accepts valid body · rejects empty name · rejects name > 120 chars |
| 29 | `DuplicateSiteThemeSchema` | name is optional |
| 30–31 | `RenameSiteThemeSchema` | name is required |
| 32 | `ArchiveSiteThemeSchema` | accepts store_id only |
| 33 | `DeleteUnpublishedThemeQuerySchema` | accepts valid UUID store_id |

### 2.7 Migration 190 Safety Assertions (Tests 34–36)

| Test # | Assertion |
|---|---|
| 34 | No `USING (true)` in migration 190 SQL |
| 35 | No forbidden DDL: no `DROP TABLE`, `DROP COLUMN`, `RENAME COLUMN`, `TRUNCATE` |
| 36 | `ADD COLUMN IF NOT EXISTS` present (idempotent re-run safe) |
| — | `CREATE INDEX IF NOT EXISTS` present (idempotent) |
| — | `owned_by_site_id` column appears in migration SQL |

_Tests 34–36 cover 5 logical assertions via `assert.ok` calls within 3 `test()` blocks._

### 2.8 Hardening Tests (Tests 37–41)

Added after code review findings. All confirm the three HIGH/MEDIUM fixes:

| Test # | Finding fixed | Assertion |
|---|---|---|
| 37 | renameSiteTheme catalog contamination (HIGH) | ForbiddenError when `owned_by_site_id IS NULL` (marketplace theme) |
| 38 | renameSiteTheme catalog contamination (HIGH) | ForbiddenError when `owned_by_site_id` belongs to a different store |
| 39 | renameSiteTheme catalog contamination (HIGH) | Source-pattern: UPDATE `themes` scoped by `.eq('owned_by_site_id', storeId)` |
| 40 | IDOR plan limit leak (MEDIUM) | Source: `verifyStoreOwner` call before `resolveStoreThemeLimit` in `/library/create` |
| 41 | IDOR plan limit leak (MEDIUM) | Source: `verifyStoreOwner` call before `resolveStoreThemeLimit` in `/:slug/duplicate` |

---

## 3. Merchant Control Plane Test File

**File:** `apps/merchant-control-plane/tests/theme-library-q.test.mjs`  
**Total tests:** 24 (23 implementation + 1 hardening)  
**Test runner:** Node.js `node:test`  
**Method:** Static-contract / source-pattern analysis (no Next.js runtime, no browser)

### 3.1 Proxy Route Existence and Structure (Tests 1–10)

| Test # | Coverage |
|---|---|
| 1 | All six new proxy route files exist at expected paths |
| 2 | `ThemeLibraryCard.tsx` and `ThemeLibraryWorkspace.tsx` exist |
| 3 | Library GET proxy reads `store_name` from query string and calls `resolveOwnedStoreId` |
| 4 | Library create proxy reads `store_name` from body and calls `resolveOwnedStoreId` |
| 5 | Duplicate proxy calls `resolveOwnedStoreId` |
| 6 | Rename proxy calls `resolveOwnedStoreId` |
| 7 | Archive proxy calls `resolveOwnedStoreId` |
| 8 | Delete proxy calls `resolveOwnedStoreId` |
| 9 | No proxy route imports Supabase or writes to DB directly |
| 10 | No proxy route trusts a browser-supplied store UUID (store_id not read from request without resolution) |

### 3.2 Error Passthrough (Tests 11–12)

| Test # | Coverage |
|---|---|
| 11 | `ThemeLibraryWorkspace` exposes `CANNOT_DELETE_PUBLISHED_THEME` as a user-friendly message |
| 12 | `ThemeLibraryWorkspace` exposes `THEME_LIMIT_REACHED` as a user-friendly message |

### 3.3 UI State and a11y (Tests 13–19)

| Test # | Coverage |
|---|---|
| 13 | Workspace uses `ConfirmDialog` for archive and delete operations |
| 14 | Workspace handles loading (Skeleton), empty state, and error (Banner) |
| 15 | Workspace uses responsive grid classes (`sm:grid-cols-2`, `lg:grid-cols-3`) for mobile-first layout |
| 16 | `ThemeLibraryCard` uses `aria-label` for all action menu buttons |
| 17 | Tab strip on themes page uses ARIA `tablist`/`tab`/`tabpanel` pattern |
| 18 | Themes page imports and renders `ThemeLibraryWorkspace` |
| 19 | `ThemeLibraryCard` formats dates using en-IN locale |

### 3.4 Design Tokens and Conventions (Tests 20–23)

| Test # | Coverage |
|---|---|
| 20 | New components use only `--lb-*` design tokens; no raw pixel values (`px` outside data attributes) |
| 21 | All proxy routes use `merchantApiErrorResponse` for error handling |
| 22 | Workspace uses `Modal` for create and rename dialogs |
| 23 | `ThemeLibraryWorkspace` imports no Supabase or direct gateway client |

### 3.5 Hardening Test (Test 24)

| Test # | Finding fixed | Assertion |
|---|---|---|
| 24 | handlePublish 400 on every click (MEDIUM) | `handlePublish` in `ThemeLibraryWorkspace` sends `store_name` as a URL query parameter in `fetch`, not as a JSON body field |

---

## 4. Coverage Summary

| Category | Gateway | Merchant |
|---|---|---|
| Cross-tenant isolation | 6 tests (all 6 operations) | 8 tests (all 6 proxies + no-DB-write assertion) |
| Conflict guards (published-theme blocks) | 3 tests | 2 tests (error passthrough to UI) |
| Source-pattern (route registration order) | 6 tests | — |
| Source-pattern (adapter query scoping) | 3 tests | — |
| Source-pattern (call order: ownership before limit) | 2 tests | — |
| Audit event assertions | 3 tests | — |
| Schema safeParse | 11 tests | — |
| Migration safety | 3 tests (5 assertions) | — |
| Hardening (catalog contamination fix) | 3 tests | — |
| UI state (loading/empty/error) | — | 1 test |
| Accessibility (ARIA, aria-label, tab strip) | — | 2 tests |
| Responsive grid / mobile-first | — | 1 test |
| Design token compliance (`--lb-*`) | — | 1 test |
| en-IN date formatting | — | 1 test |
| Modal / ConfirmDialog usage | — | 2 tests |
| handlePublish query param fix | — | 1 test |
| **Total** | **41** | **24** |

---

## 5. What Was Not Tested by Phase Q

The following items are outside the Phase Q test scope:

- **Plan limit TOCTOU (concurrent create/duplicate):** Non-atomic count-then-insert race. Requires concurrent request simulation; ARB-gated for DB-level fix. Documented as RISK-TOCTOU-Q01.
- **`listSiteThemes` N+1 query pattern:** For a store with many installed themes, `listSiteThemes` issues 3 parallel sub-queries per theme (theme metadata, last release, draft check). No performance test was added. Flagged for Phase R when the library is integrated with the editor.
- **Full api-gateway suite re-run with Phase Q file:** The Phase Q gateway tests are run in file scope (`npx tsx --test theme-library-q.test.ts`). The combined suite count (438 Phase P + 41 Phase Q = 479) was not explicitly verified in a single run in this phase.
- **Integration test (real DB):** All tests are logic-level with mocked DB. A real Supabase staging run against migration 190 is ARB/human-gated before production deployment.
