# Phase AB — Security Review: Theme Version Update

**Program:** LetBuyy Liquid Theme Platform + Shopify-Class Merchant Editor (M→AE)
**Phase:** AB — Theme Versioning + Updates
**Date:** 2026-07-11
**Reviewer:** Phase AB documentation pass (ground-truth verified)
**Status:** REVIEW COMPLETE — all CRITICAL and HIGH findings fixed in hardening; LOW TOCTOU residual documented and ARB-gated

---

## 1. Tenancy Model

### 1.1 Gateway route tenancy

Both the preview and apply routes enforce an identical three-step tenancy model, matching the `media-library.ts` pattern established in Phase X:

| Step | Guard | Failure mode |
|------|-------|-------------|
| 1 | `resolveCustomUser` | Rejects customer HS256 tokens — `users_custom` row lookup fails → 403 |
| 2 | `verifySiteOwnership(storeId)` | Rejects cross-tenant access: JWT `storeId` claim vs DB ownership → 403 |
| 3 | All DB reads scoped to verified `storeId` | Never reads using caller-supplied values directly |

**Cross-tenant probe prevention:** The idempotency pre-check in `publishVersionUpdateRelease` filters by `store_id` FIRST, then `idempotency_key`. A cross-tenant actor cannot discover another store's release existence via an idempotency key probe.

### 1.2 Merchant UI proxy tenancy

All three proxy routes (`update-preview`, `update`, rollback) use `resolveOwnedStoreId` to resolve the authenticated merchant's `storeId` from their session, then pass it as `store_id` in the gateway request body. The merchant never supplies `storeId` directly — it is always derived from the authenticated session.

### 1.3 `ThemeUpdatePanel` tenancy contract

The component receives `storeId` as a prop from the server-component parent (`UpdatePageClient`). It calls same-origin proxy routes (`/api/themes/...`) only. It never calls the gateway directly (no cross-origin; CSP path-match enforced). The `storeId` prop is injected by the parent from the resolved server context, not from URL params or user input.

---

## 2. NO-DATA-LOSS Proof

### 2.1 `planThemeSafeUpdate` — pure, fail-closed, deterministic

The merge engine is a **pure function** with no DB I/O, no network calls, and no mutations of shared state. It:

1. Applies the G4 gate (rejects unknown/future schemas) before any merge.
2. Applies G schema migrations on current sections before merge.
3. For each section type present in the current document:
   - Runs `classifyUpdateSetting(key, value)` on every setting.
   - Carries forward `merchant-content` and `resource-binding` classified values.
   - Replaces `token` and `generated-placeholder` values from the new bundle's defaults.
   - Preserves the full `blocks[]` array (including `children[]` recursively).
4. For sections removed from the new bundle that have `merchant-content` or `resource-binding` settings: sets `requiresDuplicateBeforeApply = true` and populates `diff.conflicts[n].lostContent`.
5. For retained sections with block types removed from the new bundle definition: if the dropped blocks have meaningful content, populates `diff.conflicts[n].lostContent.blocks` and sets `requiresDuplicateBeforeApply = true` (hardening fix).
6. Calls `parseThemeDocument(merged)` as a fail-closed gate — if the merged document is structurally invalid, the function throws rather than returning a corrupt document.

**No silent loss is possible:** every setting value that cannot be carried forward either (a) appears in `diff.conflicts`, or (b) is a design token or placeholder that intentionally should be replaced by the new bundle.

### 2.2 Gateway route ordering — publish after merge

The POST apply route enforces this ordering in source:

```
planThemeSafeUpdate (pure merge, preserves merchant content)
  ↓
fromThemeDocumentV2 (encode merged doc as a new bundle)
  ↓
confirm_diff_hash verification (CAS guard — 409 on mismatch)
  ↓
publishVersionUpdateRelease (DB write via publishReleaseSnapshot)
```

The `confirm_diff_hash` CAS guard fires BEFORE `publishVersionUpdateRelease`. If the hash does not match (stale preview), the route returns 409 and no write occurs. If the hash matches, the merged document has already been produced by `planThemeSafeUpdate` with all merchant content preserved — and then `publishVersionUpdateRelease` writes it.

The test `'confirm_diff_hash mismatch throws ConflictError before publish'` asserts this ordering at the source level.

### 2.3 `ThemeUpdatePanel` canApply guard

The Apply Update button in the UI is disabled until ALL of the following are true:
- `diff !== null` (preview must have been fetched).
- `diff.diffHash` is present (the hash was returned by the preview response).
- `diff.compatible === true` (schema is compatible — no G4 gate failure).
- `!diff.requiresDuplicate || conflictsAcknowledged` (if conflicts exist, the merchant must have checked the acknowledgement checkbox).

No silent apply can occur. The CAS guard (`confirm_diff_hash`) in the proxy and gateway provides an additional layer.

---

## 3. RISK-DUAL-N01 — Section Definitions Dual-Truth

Phase AB touches the per-store ThemeDocument (section instance settings and block children). It does NOT touch `section_definitions` or `block_definitions` in the shared catalog.

**Merge engine:** `planThemeSafeUpdate` swaps `section_definitions` and `block_definitions` FROM the new bundle into the merged document. This is correct — the new bundle's definitions replace the old bundle's definitions in the per-store document. The shared `section_definitions` catalog row in `theme_packages` is never modified.

**`buildDraftConfig` unaffected:** The Phase AB update path persists via `publishVersionUpdateRelease` → `publishReleaseSnapshot`, not via the `saveDraft` + `buildDraftConfig` autosave path. The RISK-DUAL-N01 mechanical backstop in `buildDraftConfig` (immutable `section_definitions` from `baseConfig`) is not involved in the Phase AB write path and is therefore undisturbed.

**ThemeUpdatePanel:** The component never reads or writes `section_definitions` or `block_definitions`. Static-contract tests assert `does not assign to section_definitions` in both `ThemeUpdatePanel.tsx` and `UpdatePageClient.tsx`.

---

## 4. RPC-Unchanged Proof

Phase AB uses the existing Phase P publish path exclusively. No SECURITY DEFINER RPC was modified:

| RPC | Change |
|-----|--------|
| `publish_theme_release` | Unchanged. Called via `publishReleaseSnapshot` (pre-existing P adapter method). |
| `rollback_theme_release` | Unchanged. Phase AB rollback UI calls the pre-existing Phase P rollback proxy. |
| `create_checkout_order` | Unchanged (canonical money ledger — untouched). |
| `confirm_order_payment_with_ledger` | Unchanged. |
| `complete_order_refund` | Unchanged. |

The canonical-ledger-only validator is not triggered by any Phase AB code path. No `from(money_table).insert/update` exists in Phase AB files.

---

## 5. CAS Guard Analysis

### 5.1 How the CAS guard works

1. `GET /:slug/update-preview` computes `diffHash = SHA-256(JSON.stringify(diff))` using the Web Crypto API (`crypto.subtle.digest`). Returns `{ diff, diffHash }`.
2. `POST /:slug/update` requires `confirm_diff_hash` (validated as `/^[0-9a-f]{64}$/` at the proxy, Zod UUID at the gateway).
3. The gateway recomputes the diff from the same inputs and compares `SHA-256(JSON.stringify(diff)) === confirm_diff_hash`. On mismatch → HTTP 409 `DIFF_HASH_MISMATCH`.

### 5.2 What the CAS guard prevents

- **Stale preview attack:** a merchant previews the diff, another update is applied between preview and apply, the merchant submits the original hash — the gateway recomputes the diff and the hash will not match → 409.
- **UI bypass:** calling the apply endpoint without a prior preview is rejected (no valid hash available without running the preview first).

### 5.3 Residual TOCTOU (ARB-gated)

The CAS guard is TypeScript-level only. Two concurrent POST requests with the same valid `diffHash` (from the same prior preview) both pass the hash comparison before either write lands. Both would call `publishVersionUpdateRelease`. The `idempotency_key` pre-check prevents duplicate writes if the same key is supplied; two requests with different idempotency keys can each create a release. No merchant content is lost in either case (both produce identical merged documents), but duplicate releases can accumulate.

Full closure requires a DB-level advisory lock inside the `publish_theme_release` RPC — ARB-gated follow-up. Documented in RISK_REGISTER.md as RISK-AB-01.

---

## 6. Findings Summary

| Severity | Finding | Status |
|----------|---------|--------|
| CRITICAL | UI `ThemeUpdateDiff` type mismatch — `diff.rows` undefined → TypeError crash; `diff.requiresDuplicate` undefined → conflict warning never shown; Apply always disabled | FIXED: proxy now reshapes gateway response at the boundary |
| HIGH | Preview proxy: `target_version_id` forwarded but gateway requires `target_package_version_id` | FIXED: renamed in proxy |
| HIGH | Apply proxy: `target_bundle_version_id` forwarded but gateway requires `target_package_version_id` | FIXED: renamed in proxy |
| MEDIUM | `update_message` forwarded but gateway expects `publish_message` | FIXED: renamed in proxy |
| MEDIUM | `idempotency_key` conditionally forwarded; gateway requires it | FIXED: now required + always forwarded |
| MEDIUM | Retained section with dropped block types: content silently dropped without conflict entry | FIXED: `lostContent.blocks` populated; conflicts filter extended |
| LOW | `confirm_diff_hash` proxy guard too weak (min 8 chars vs gateway's 64-char hex) | FIXED: tightened to `/^[0-9a-f]{64}$/` |
| LOW | TOCTOU residual: same-hash concurrent submits can create duplicate releases | DOCUMENTED as RISK-AB-01; ARB-gated |
| LOW | Foreign WIP isolation test: does not detect non-AB changes in editor/page.tsx | DOCUMENTED; test proves only no-AB-symbol introduction |
| LOW | Gateway test position shift from #270 to #298 for pre-existing foreign failure | DOCUMENTED; use test names not positions |

---

## 7. No New Realtime Subscriptions

Phase AB adds no client-side realtime subscriptions over `theme_editor_drafts` or any other table. RISK-SEC-P01 (`theme_editor_drafts` RLS policies check `user_id` only, not `custom_user_id`) remains bounded and unchanged.

---

## 8. Auth Middleware Ordering

Auth middleware for the AB routes is placed AFTER the `/media-library` and `/resource-search` static prefixes in `themes.ts`, preserving the pre-existing test X-T10 (media-library route registered) and W-T08 (resource-search route registered) ordering invariants. No pre-existing route tests were broken by the Phase AB mount.
