# Phase P Migration Report — Theme Releases Idempotency

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** P — Drafts, Revisions, Publish, and Rollback
**Date:** 2026-07-10
**Branch:** `stepup/main`

---

## CRITICAL: Production Apply is ARB / Human-Gated — NOT Applied

Migration 189 has been written and validated. **It has NOT been applied to any production or staging database.** Application to production requires explicit ARB sign-off and a human-run migration step. This document records what the migration does and why, for review purposes only.

---

## 1. Migration Inventory

### Migration 189 — `189_theme_persistence_idempotency.sql`

**File:** `database/supabase/migrations/189_theme_persistence_idempotency.sql`
**Sequence:** Immediately follows committed migration 188 (`188_letbuyy_core_theme_row.sql`).
**Status (as of 2026-07-10):** Written, committed to `stepup/main`. Migration safety validator exits 0. NOT applied to any database.

---

## 2. Migration Content

```sql
ALTER TABLE public.theme_releases
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_theme_releases_idempotency
  ON public.theme_releases (store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.theme_releases.idempotency_key IS
  'Client-supplied dedup key for publish operations. Nullable; set post-publish by TS layer. '
  'Partial unique index (store_id, idempotency_key) WHERE NOT NULL prevents cross-tenant collision and sequential retry duplication.';
```

---

## 3. Justification

### 3.1 Problem Statement

`publish_theme_release` SECURITY DEFINER RPC inserts unconditionally with no deduplication mechanism. Client retries (network timeout, double-submit) call the RPC multiple times, each creating a new release row with an incremented `release_version`. These ghost releases:
- Inflate the release history visible to merchants.
- Can race the `is_current` pointer, leaving an unintended release marked as current.
- Are not recoverable without manual database intervention.

### 3.2 Pattern Precedent

All other write tables in the canonical money path carry `idempotency_key`:
- `orders` — `idempotency_key text UNIQUE`
- `payment_transactions` — `idempotency_key text`
- `checkouts` — `idempotency_key text`

Phase P applies the same pattern to `theme_releases`.

### 3.3 Why a Partial Unique Index (not a column constraint)

The column is **nullable**. Existing rows and the current RPC (which has no `idempotency_key` parameter) produce null values. A `UNIQUE` column constraint would reject multiple nulls (or allow them only on databases with the ISO SQL `DISTINCT FROM NULL` rule). A partial unique index scoped `WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL` enforces uniqueness only for non-null, non-deleted rows — the exact semantics required.

### 3.4 Cross-Tenant Safety

The index is composite `(store_id, idempotency_key)`. A client on Site A with key `abc123` cannot collide with a client on Site B using the same key string. The uniqueness constraint is tenant-scoped.

---

## 4. Safety Analysis

| Property | Status | Detail |
|---|---|---|
| `ADD COLUMN IF NOT EXISTS` | SAFE | Idempotent; applying twice is a no-op |
| `CREATE UNIQUE INDEX IF NOT EXISTS` | SAFE | Idempotent; applying twice is a no-op |
| No `DROP` statement | CONFIRMED | Migration contains no DROP, RENAME, TRUNCATE, or any destructive DDL |
| No `NOT NULL` constraint on existing rows | CONFIRMED | Column is nullable; existing rows unaffected |
| Existing RPC unaffected | CONFIRMED | `publish_theme_release` RPC does not write `idempotency_key`; nulls are allowed |
| No new RLS policy | CONFIRMED | `theme_releases_service_all` covers INSERT/UPDATE of the new column; `theme_releases_owner_read` covers SELECT |
| No tenant registry change | CONFIRMED | `theme_releases` already registered at `tenant-tables.registry.ts:2819`; column type `text` has no tenant implications |
| `migration-safety-validator` exit code | `0` | Confirmed passing |

---

## 5. Rollback Plan

**Warning: Rollback is non-trivial.**

Rollback of migration 189 requires `DROP COLUMN idempotency_key FROM public.theme_releases`, which:
- Removes all `idempotency_key` values that have been written since the migration was applied.
- Cannot be expressed as a `migration-safety-validator`-safe migration (the validator forbids `DROP` operations).
- Requires a dedicated ARB repair runbook including: (1) confirming no in-flight publishes are pending, (2) dropping the index first (`DROP INDEX idx_theme_releases_idempotency`), (3) dropping the column, (4) reverting the TS-layer code that writes `idempotency_key`.

**Pre-apply safety:** Because the column is nullable and additive, applying the migration and then rolling back the TS code (without dropping the column) returns the system to its pre-Phase-P behaviour — the column exists but is never populated and the unique index is effectively dormant.

---

## 6. Pre-Existing Migration Context

| Migration | Status | Notes |
|---|---|---|
| 186 | UNTRACKED (foreign WIP) | Not Phase P's responsibility; do not commit |
| 187 | UNTRACKED (foreign WIP) | Not Phase P's responsibility; do not commit |
| 188 | Committed, unapplied | `188_letbuyy_core_theme_row.sql` — idempotent `INSERT … ON CONFLICT (slug) DO NOTHING`; must be applied before 189 in any environment |
| 189 | Committed, unapplied | Phase P migration — this document |

The `sequential-migration-validator` notes 189 as untracked at discovery time. This resolves on `git add` + commit (now done on `stepup/main`). The pre-existing 186/187 untracked issue is outside Phase P scope.

---

## 7. What Phase P Does NOT Do to the DB

- Does NOT modify the `publish_theme_release` SECURITY DEFINER RPC (ARB gate).
- Does NOT add any new tables.
- Does NOT add any new RLS policies.
- Does NOT alter `tenant-tables.registry.ts`.
- Does NOT apply any migration to any live database.
- Does NOT touch migrations 186 or 187 (foreign WIP).
