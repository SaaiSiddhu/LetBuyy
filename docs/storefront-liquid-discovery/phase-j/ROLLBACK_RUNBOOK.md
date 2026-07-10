# Phase J — Rollback Runbook

**Document ID:** PHASE-J-ROLLBACK-RUNBOOK-2026-07-10
**Date:** 2026-07-10
**Branch:** stepup/main
**Author role:** Phase J rollback author
**Companion document:** `ROLLOUT_READINESS_PACKAGE.md` (this same directory)

---

## Authority Law

The platform-wide Liquid flip is **ARB-AUTHORITY only**. `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is a compiled constant set to `false` at `packages/theme-engine/src/theme-governance.ts:14`. It stays `false` until the ARB authorises a code change and storefront-runtime redeploy. `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` stays `deferred` (same file, lines 16–21). This runbook prepares the procedures the ARB and on-call team would use; it does not perform any activation or rollback itself.

---

## Honesty Law

Every signal and lever in this runbook is classified as one of:

- **CONNECTED** — verifiable from committed code on `stepup/main` right now; structural/in-repo.
- **NOT-CONNECTED** — requires live infrastructure not yet wired (Cloudflare Analytics Engine, Cloudflare Logpush, production Supabase service-role credentials, or a deployed Worker). The exact required credential or adapter is named in every NOT-CONNECTED entry.

No dashboards or alert-count numbers are fabricated. Every threshold labeled in this document is a **PROPOSAL** — it is a candidate threshold for the ARB to set or adjust based on live data once ingestion is wired.

---

## 1. Rollback Architecture — How the System Degrades

Liquid rendering in `stepup/main` is designed to degrade to React on every failure path. There is no failure mode that produces a blank page or a hard HTTP 500, provided the React rendering path itself is healthy. The following degradation layers apply **automatically, per-request, with no human action**:

| Layer | Trigger | Behavior | Evidence signal | Source |
|---|---|---|---|---|
| **L1 — G4 version gate** | Liquid bundle carries an unrecognized `schema_version` | `parseLiquidThemePackageBundle()` throws `UnsupportedLiquidBundleSchemaVersionError`; caught at `theme-renderer.ts:491` → returns `status:'unsupported'` → composition-engine renders React | `lb:canary:render` with `fallback_reason:'renderer_returned_null'` (no dedicated G4 field) | `packages/theme-engine/src/theme-bundle.ts:14–29`, `theme-renderer.ts:488–499` |
| **L2 — Per-section crash recovery (C1)** | A single Liquid section throws during `renderLiquidTemplateSections()` | Section is skipped; `sectionErrors` incremented; `<!-- lb:section-error sectionId='...' type='...' -->` inserted in HTML at the failed section's position; remaining sections continue | `lb:liquid:block-error` structured warn; HTML comment in page source | `packages/theme-engine/src/theme-renderer.ts` (Phase C C1) |
| **L3 — Per-region failure (C1)** | Header, body, or footer region throws as a whole | Failed region degrades to empty string; other regions continue; if body main template `status:'error'` or all sections fail → `status:'error'` → composition-engine React fallback | Warnings array logged by caller; `lb:canary:render:fallback` if composition-engine outer catch fires | `theme-renderer.ts:527–598` |
| **L4 — Composition-engine outer catch** | Unexpected throw from inside `renderLiquidPlan()` (OOM, JSDOM failure, etc.) — not covered by C1 | `catch` at `composition-engine.tsx:623–635` logs `lb:canary:render:fallback`; returns `null`; React renders | `lb:canary:render:fallback` (structured warn, `event`, `reason`, `subdomain`, `template`) | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:623–635` |
| **L5 — Chrome-fallback seam (F5)** | `plan.rendererEngine==='liquid'` but `liquidHtml===null` (any of L1–L4 fired) | Composition-engine renders React body sections; wraps them with React header/footer from `plan.sectionGroups` (not React layout's chrome, which was suppressed because `liquidPage` was truthy); prevents a headerless/footerless fallback page | `lb:canary:render` with `engine:'react'` and `fallback_reason:'renderer_returned_null'` | `composition-engine.tsx:705–735` |

**Important**: `lb:canary:render:fallback` fires only on unexpected throws caught by the composition-engine outer catch (L4). It does **not** fire when the renderer returns `status:'unsupported'` or `status:'error'` normally (the renderer does not throw in those cases). The reliable signal for any Liquid→React fallback is the `lb:canary:render` event with `engine:'react'` combined with `fallback_reason:'renderer_returned_null'`, but live ingestion of that event is **NOT-CONNECTED** (see Section 3).

---

## 2. Rollback Stages

Two rollback stages exist, corresponding to the two activation paths in the system.

### Stage 1 — Per-Store Canary Rollback

**Context:** One or more stores have been activated for Liquid rendering via a published theme release carrying `release_manifest.renderer_engine='liquid'` (set by `buildReleaseArtifacts()` at `services/api-gateway/src/execution/theme-execution.adapter.ts:620–643` when `liquidBundle` is present). The global default `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` remains `false`. No other stores are affected.

This is the only live Liquid activation path on `stepup/main` at the time of writing (2026-07-10).

### Stage 2 — Post-ARB Platform Flip Rollback

**Context:** The ARB has authorised changing `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` to `true` in `packages/theme-engine/src/theme-governance.ts:14` and redeploying storefront-runtime. All stores without an explicit non-liquid engine signal now render Liquid by default.

This stage does not exist yet. This runbook pre-positions the procedures for when it does.

---

## 3. Signal Map — Detection

Before deciding on a rollback, an on-call engineer must identify which signal fired and on which store(s).

### 3.1 Structural Signals (CONNECTED — observable now, no live infra required)

| Signal | How to observe | What it means |
|---|---|---|
| `lb:canary:render` structured log | `wrangler tail --format=json` (requires deployed Worker and Cloudflare account access) or Cloudflare Logpush sink | Every SSR render. Fields: `engine` (`'liquid'` or `'react'`), `subdomain`, `template`, `route_type`, `latency_ms`, `fallback_reason` (null or `'renderer_returned_null'`). Emitted at `composition-engine.tsx:663–677`. |
| `lb:canary:render:fallback` structured warn | Same as above | Unexpected throw in Liquid render path. Fields: `event`, `reason` (error message, truncated to 200 chars), `subdomain`, `template`. Emitted at `composition-engine.tsx:628–633`. |
| `lb:liquid:block-error` structured warn | Same as above | Per-block crash within a section. Fields: `event`, `blockId`, `blockType`, `error` (error message truncated to 200 chars). Note: no `sectionId` field; correlation to a specific store requires joining on timestamp with surrounding `lb:canary:render` events. |
| `<!-- lb:section-error sectionId='...' type='...' -->` | `curl -s https://{store}.letbuyy.com/ \| grep lb:section-error` | A section failed to render server-side. Inserted in HTML at the failed section's position by the per-section C1 catch in `theme-renderer.ts`. |
| `X-Lb-Render-Engine` response header | `curl -I https://{store}.letbuyy.com/` | **WARNING: unreliable for per-store diagnosis.** This header is set in `proxy.ts:175–176` and reflects `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED === 'true'`. It shows `'react'` whenever the global default is `false`, regardless of whether the individual store is actually rendering Liquid via per-entity activation. It is only useful to confirm the global flag state (Stage 2), not to diagnose per-store Liquid adoption in Stage 1. |
| `release_manifest.renderer_engine` in DB | `SELECT release_manifest->>'renderer_engine' FROM theme_releases WHERE id = (SELECT current_theme_release_id FROM sites WHERE subdomain = '{store}')` | Whether this store's active release was published as a Liquid release. Values: `'liquid'` (Liquid active), `'json-contract'` or absent (React). Written at theme publish time. |

### 3.2 Live Signals (NOT-CONNECTED — require infrastructure not yet wired)

| Signal | Required infrastructure | Purpose |
|---|---|---|
| Live `lb:canary:render` ingestion, fallback rate over time, p95 latency | Cloudflare Analytics Engine with `OTEL_EXPORTER_OTLP_ENDPOINT` set, or Cloudflare Logpush to an external sink. No adapter wired in repository. | Dashboard-level rollback threshold monitoring |
| Live count of stores with `renderer_engine='liquid'` in production | Production Supabase service-role credentials. Query: `SELECT COUNT(*) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'` | Knowing the scope of Stage 1 activation before issuing batch rollback |
| Production CPU time / memory per Liquid render | Cloudflare Workers Analytics Engine | Latency-based rollback trigger; F9 benchmark gives local reference only (`theme-engine/test/liquid-render-benchmark.test.ts`: cold=24ms, steady=11ms) |
| `cache_hit` in `lb:canary:render` | Per-request render cache (field present in log as `null` — `composition-engine.tsx:676` — but always emitted as `null`; cache not implemented) | Cache effectiveness |

---

## 4. Stage 1 Procedure — Per-Store Canary Rollback

### 4.1 Detection

Observe one or more of the following:

1. `lb:canary:render` events for a store showing `fallback_reason:'renderer_returned_null'` at elevated frequency (PROPOSED threshold: >5% of that store's render events over a 5-minute window — NOT-CONNECTED until Logpush is wired).
2. `lb:canary:render:fallback` events for a store (any count) — this fires only on unexpected throws; even one or two per minute is significant.
3. `<!-- lb:section-error ... -->` comments detectable in the store's HTML responses via `curl` or a synthetic monitor.
4. Manual report from a merchant that their storefront is rendering incorrectly or has missing sections.
5. Visual regression in the QA checklist or synthetic monitoring for the affected store.

### 4.2 Decision

A rollback decision for a single store is at the discretion of the on-call engineer. No ARB approval is required for a per-store rollback — this is a data change on a single store's release manifest, not a platform topology change. Escalate to ARB only if rolling back more than 5 stores simultaneously or if the issue appears systemic (same error type across unrelated stores).

Rollback criteria (PROPOSED — adjust based on live data once ingestion is wired):

| Signal | PROPOSED trigger |
|---|---|
| `lb:canary:render` `fallback_reason:'renderer_returned_null'` rate | >5% of store's requests over 5 minutes |
| `lb:canary:render:fallback` events | Any occurrence of the same `reason` in 3 or more requests in 5 minutes |
| Merchant-reported storefront breakage | Immediate (no rate threshold) |
| `<!-- lb:section-error -->` in production HTML on critical sections (hero, product-grid, product-detail) | Immediate |

### 4.3 Action

**Automatic mitigations already active (no human action required):**

- L1–L5 layers described in Section 1 are active on every request. A Liquid rendering failure degrades to a full React page automatically. If the store is rendering incorrectly but serving content, the automatic fallback may already be active. Confirm via `lb:canary:render engine` field.

**Manual Lever A — Fastest (no deploy, DB update, ~2–7 min effect):**

Update `release_manifest.renderer_engine` in the store's current theme release to any non-`'liquid'` value:

```sql
-- Identify the store's current theme release:
SELECT s.id AS site_id, s.current_theme_release_id, tr.release_manifest->>'renderer_engine' AS engine
FROM sites s
JOIN theme_releases tr ON tr.id = s.current_theme_release_id
WHERE s.subdomain = '{target_store}';

-- Roll back the renderer engine for that release:
UPDATE theme_releases
SET release_manifest = release_manifest || '{"renderer_engine": "json-contract"}'::jsonb
WHERE id = '{current_theme_release_id}';
```

**Who can execute:** Operator with Supabase service-role access (production DB).
**Requires:** Production Supabase credentials (NOT-CONNECTED by default; operator must supply).
**Effect timing:** Gateway storefront cache TTL is 60 seconds (`STOREFRONT_CACHE_TTL_SECONDS = 60` at `services/api-gateway/src/lib/storefront-cache.ts:12`) with stale-while-revalidate of 300 seconds (`STOREFRONT_CACHE_SWR_SECONDS = 300`, same file line 13). After the gateway cache expires, Next.js ISR has a 60-second revalidation window (`export const revalidate = 60` at all storefront page routes: `page.tsx:10`, `products/page.tsx:11`, `[...path]/page.tsx:9`). **Total worst-case effect window: ~7 minutes (300s SWR + 60s ISR). Typical effect: ~2 minutes (60s gateway TTL + 60s ISR).**

**Manual Lever B — No deploy, canary flag (same timing as Lever A):**

Set any of the 11 canary aliases to a falsy value in the store's `release_manifest` or `template_config`. Falsy values accepted by `readBooleanDecision()` at `theme-governance.ts:130`: `'0'`, `'false'`, `'disabled'`, `'off'`, or boolean `false`.

```sql
-- Set liquid_rendering_canary to false in the release manifest for the store:
UPDATE theme_releases
SET release_manifest = release_manifest || '{"liquid_rendering_canary": false}'::jsonb
WHERE id = '{current_theme_release_id}';
```

This lever is appropriate when the store was activated via a canary alias rather than the `renderer_engine` field. If `renderer_engine` is already `'liquid'` (set by the theme publish pipeline), use Lever A instead — setting a canary alias to false does NOT override an explicit `renderer_engine='liquid'` signal; `resolveThemeLiquidRenderingEnabled()` checks the explicit engine signals first and returns immediately if any is `'liquid'` (`theme-governance.ts:160`).

**Manual Lever C — Emergency revert a published theme release (no deploy):**

If the Liquid activation was introduced by a specific theme publish (which set `renderer_engine='liquid'` in the `theme_releases` row), rolling back the store to a previous React release is an alternative:

```sql
-- Identify the previous React release for the store (most recent release where renderer_engine != 'liquid'):
SELECT id, release_version, release_manifest->>'renderer_engine' AS engine, published_at
FROM theme_releases
WHERE theme_id = '{theme_id}'
  AND (release_manifest->>'renderer_engine' IS NULL OR release_manifest->>'renderer_engine' != 'liquid')
ORDER BY published_at DESC
LIMIT 5;

-- Set the store's current release to the prior React release:
UPDATE sites
SET current_theme_release_id = '{previous_react_release_id}',
    updated_at = NOW()
WHERE id = '{site_id}';
```

**Effect timing:** Same as Lever A (gateway cache + ISR window).

### 4.4 Verification

After applying any lever, verify the rollback succeeded:

**Immediate (no live ingestion required):**

1. `curl -s https://{store}.letbuyy.com/ | grep lb:section-error` — should return no matches.
2. `curl -s https://{store}.letbuyy.com/ | grep 'data-theme-renderer="liquid"'` — should return no matches (this attribute is set by `buildLiquidThemeHeadAssets()` in `theme-renderer.ts:271` only on Liquid renders).
3. DB query to confirm the `renderer_engine` is no longer `'liquid'` for that store's release.

**With wrangler tail (requires deployed Worker access):**

```bash
wrangler tail storefront-runtime --format=json --env production | \
  grep '"event":"lb:canary:render"' | \
  jq 'select(.subdomain == "{target_store}") | .engine'
```

Expected output after rollback: `"react"` on every line. A `fallback_reason` of `'renderer_returned_null'` should also stop appearing once the DB change propagates through the cache window.

**X-Lb-Render-Engine header:** DO NOT use this header to verify per-store rollback. It reflects `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED` (the global env var), not per-store resolution. With the global default `false`, the header reads `'react'` for all stores regardless of whether an individual store is rendering Liquid. It cannot confirm per-store rollback success.

### 4.5 Time-to-Rollback Summary (Stage 1)

| Rollback path | Action required | Estimated effect (PROPOSED) |
|---|---|---|
| Automatic (L1–L5) | None | Instantaneous per-request; already active |
| Lever A — release_manifest DB update | 1 SQL UPDATE, production DB access | Typical: ~2 min (60s gateway TTL + 60s ISR); worst case: ~7 min (300s SWR + 60s ISR) |
| Lever B — canary alias falsy | 1 SQL UPDATE, production DB access; only valid if renderer_engine is not 'liquid' | Same |
| Lever C — revert to prior React release | 2 SQL queries + 1 UPDATE; requires identifying prior release ID | Same |

---

## 5. Stage 2 Procedure — Post-ARB Platform Flip Rollback

**This stage does not apply today** (2026-07-10). `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` is `false`. This section pre-positions the procedure for if and when the ARB authorises the platform flip.

### 5.1 Detection

Post-platform-flip, Liquid is the default for all stores. A rollback-triggering condition at this stage is systemic — affecting a large fraction of the fleet, not an isolated store.

Detection signals (NOT-CONNECTED until Logpush is wired):

1. Fleet-wide surge in `lb:canary:render:fallback` events across multiple unrelated subdomains simultaneously.
2. Fleet-wide `lb:canary:render` `fallback_reason:'renderer_returned_null'` rate exceeding PROPOSED threshold of >10% of all render events over a 5-minute window.
3. External reports of storefronts rendering incorrectly across multiple merchants simultaneously.
4. A newly deployed Liquid bundle carrying an unrecognized `schema_version` (G4 path): would manifest as a fleet-wide L1 fallback to React (all stores on that bundle fall through automatically — no blank pages, but Liquid is silently inactive).

### 5.2 Decision

Platform-wide rollback is ARB-AUTHORITY. The on-call engineer should:

1. Confirm the failure is systemic (multiple unrelated stores, same error type).
2. Page the ARB or designated on-call ARB member.
3. Confirm automatic fallbacks (L1–L5) are containing the impact — Liquid failures already degrade to React automatically. A platform-wide Liquid failure does not mean storefronts are down; it means they are serving React.
4. Initiate the rollback only if: (a) ARB authorises, or (b) storefronts are serving degraded React (missing content, broken fallback) and the on-call engineer determines immediate action is required to protect merchants.

### 5.3 Action

**Automatic mitigations (same L1–L5 layers as Stage 1, already active):**

No additional automatic lever exists at the platform level. The G4 version gate protects against bad bundle schema_versions automatically. The composition-engine fallback protects against Liquid render failures automatically.

**Manual Lever D — Platform-wide revert (requires code change + deploy):**

There is no hot-toggle for `THEME_LIQUID_RENDERING_DEFAULT_ENABLED`. It is a compiled TypeScript constant, not a runtime env var used by the rendering decision path. (`proxy.ts:175` reads it as `process.env.THEME_LIQUID_RENDERING_DEFAULT_ENABLED` for the response header, but `resolveThemeLiquidRenderingEnabled()` uses the compiled constant at `theme-governance.ts:14` and `template-resolver.ts:244`.) To revert:

1. Revert the code change in `packages/theme-engine/src/theme-governance.ts:14` from `true` back to `false`.
2. Rebuild and redeploy `apps/storefront-runtime` (Cloudflare Workers via the CI pipeline).
3. Deploy time is NOT-CONNECTED (depends on Cloudflare Workers deploy speed and CI queue). Typical Cloudflare Workers propagation after deploy: sub-minute globally.

**Note on `FEATURE_LIQUID` gateway flag:** This flag at `services/api-gateway/wrangler.toml:248` (`FEATURE_LIQUID='false'` in production) is dormant. `featureGate('FEATURE_LIQUID', ...)` is never called anywhere in the gateway routes as of stepup/main. Toggling it has zero effect on Liquid rendering. Do not use it as a rollback lever.

**Manual Lever E — Mass per-store DB update (no deploy, for stores with explicit Liquid releases):**

After a platform flip, stores that had published Liquid releases retain `renderer_engine='liquid'` in their `theme_releases` rows. Even if the global constant is reverted to `false`, those stores would continue rendering Liquid via per-entity activation. To fully disable Liquid for the fleet after a constant revert:

```sql
-- Find all stores with renderer_engine='liquid' in their current active release:
SELECT s.id AS site_id, s.subdomain, s.current_theme_release_id
FROM sites s
JOIN theme_releases tr ON tr.id = s.current_theme_release_id
WHERE tr.release_manifest->>'renderer_engine' = 'liquid';

-- Batch update (operator to verify count before executing):
UPDATE theme_releases
SET release_manifest = release_manifest || '{"renderer_engine": "json-contract"}'::jsonb
WHERE id IN (
  SELECT tr.id
  FROM sites s
  JOIN theme_releases tr ON tr.id = s.current_theme_release_id
  WHERE tr.release_manifest->>'renderer_engine' = 'liquid'
);
```

**Who can execute:** Operator with production Supabase service-role access (NOT-CONNECTED by default).
**Requires:** Production Supabase service-role credentials + ARB authorisation (this is a mass data mutation).
**Effect timing:** Same gateway cache + ISR window as Stage 1 (typical ~2 min, worst case ~7 min).

### 5.4 Verification (Stage 2)

After code revert + redeploy:

1. `curl -I https://{any_store}.letbuyy.com/` — `X-Lb-Render-Engine: react` should appear (this header IS reliable for confirming the global flag state, just not per-store state).
2. After Lever E (mass DB update): `SELECT COUNT(*) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'` should return 0.
3. `wrangler tail` (if available): `lb:canary:render` events should show `engine:'react'` for all subdomains; `lb:canary:render:fallback` events should cease.

### 5.5 Time-to-Rollback Summary (Stage 2)

| Rollback path | Action required | Estimated effect (PROPOSED) |
|---|---|---|
| Automatic (L1–L5) | None — already active, containing per-request failures | Instantaneous per-request |
| Lever D — code revert + redeploy | 1 file edit + CI pipeline + Cloudflare deploy | NOT-CONNECTED; typically sub-minute for Workers propagation after deploy completes; CI queue time variable |
| Lever E — mass DB update | Supabase service-role access + ARB authorisation; batch UPDATE | Typical: ~2 min after execution; must be combined with Lever D for full effect |

---

## 6. Automatic vs Manual — Classification Summary

| Mechanism | Stage | Human action required | Trigger | Source |
|---|---|---|---|---|
| G4 version gate → React fallback | 1 and 2 | None | Unknown `schema_version` in Liquid bundle | `theme-bundle.ts:14–29`, `theme-renderer.ts:488–499` |
| Per-section crash recovery (C1) | 1 and 2 | None | Any section throws during `renderLiquidTemplateSections()` | `theme-renderer.ts` (Phase C C1) |
| Per-region failure (C1) | 1 and 2 | None | Header/body/footer region throws | `theme-renderer.ts:527–598` |
| All-sections-failed → status:'error' | 1 and 2 | None | Every enabled main section fails | `theme-renderer.ts:588–598` |
| Composition-engine outer catch → React | 1 and 2 | None | Unexpected throw not caught by C1 | `composition-engine.tsx:623–635` |
| Chrome-fallback seam (F5) | 1 and 2 | None | `liquidHtml===null` on a Liquid plan | `composition-engine.tsx:705–735` |
| Lever A — release_manifest DB update | 1 | Yes (DB UPDATE + production DB access) | On-call engineer decision | `services/api-gateway/src/lib/storefront-cache.ts:12` |
| Lever B — canary alias falsy | 1 | Yes (DB UPDATE + production DB access) | On-call engineer decision | `theme-governance.ts:130` |
| Lever C — revert to prior React release | 1 | Yes (2 SQL queries + 1 UPDATE) | On-call engineer decision | `sites.current_theme_release_id` |
| Lever D — constant revert + redeploy | 2 | Yes (code edit + CI + deploy); ARB authorised | ARB decision | `theme-governance.ts:14` |
| Lever E — mass DB update | 2 | Yes (batch UPDATE); ARB authorised | ARB decision + Lever D complement | `theme_releases.release_manifest` |

---

## 7. Cache Window Detail

Understanding the cache window is essential for estimating rollback effect time. Two caches sit between a DB update and a store visitor seeing the change:

| Cache | TTL | SWR | Location | Source |
|---|---|---|---|---|
| Gateway storefront bootstrap cache | 60s (`STOREFRONT_CACHE_TTL_SECONDS`) | 300s (`STOREFRONT_CACHE_SWR_SECONDS`) | Cloudflare Workers Cache API (`caches.default`) | `services/api-gateway/src/lib/storefront-cache.ts:12–13` |
| Next.js ISR (storefront-runtime) | 60s (`revalidate = 60`) | N/A | Next.js cache (Cloudflare KV or in-process) | `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:10` and all other `[subdomain]/**/page.tsx` routes |

**Typical path after a DB update to `theme_releases.release_manifest`:**

```
DB commit
  → gateway cache TTL expires (~60s) → next gateway fetch picks up new release_manifest
  → Next.js ISR revalidation fires (~60s after first post-TTL request)
  → store visitors see React
  Total typical: ~2 minutes
```

**Worst-case path (SWR in effect):**

```
DB commit
  → gateway stale-while-revalidate window (up to 300s) → stale manifest served
  → Next.js ISR (60s after first fresh gateway response)
  → store visitors see React
  Total worst case: ~6–7 minutes
```

No manual cache purge mechanism for the gateway storefront cache is implemented in the repository at time of writing. The SWR window cannot be shortened without a gateway change or Cloudflare Cache API purge (NOT-CONNECTED — requires production Cloudflare account access and a purge-by-tag call against `store:{site_id}` cache tags set in `storefrontCacheTags()` at `public-routes.ts:42–44`).

---

## 8. Open Items Affecting This Runbook

Three items carried forward from Phases H and I remain open and affect rollback planning. None block the per-store canary procedures, but they must be resolved before the ARB platform flip.

### 8.1 I-F1 — DOMPurify name Attribute Clobber (HIGH — carry-forward, ARB judgement required)

**Issue:** DOMPurify strips `name` attributes from `<input name="name">` elements, breaking the no-JS customer registration form submission on Liquid-rendered pages. The HTML sanitizer in `theme-renderer.ts` uses DOMPurify's default `FORBID_ATTR` list which does not preserve `name` on non-form-field-specific elements.

**Rollback impact:** For the customer registration page on a Liquid-activated store, the no-JS path is broken regardless of rollback state. Rolling the store back to React (Lever A–C) immediately restores the no-JS registration path for that store.

**Status:** Open. Must be resolved (allowlist `name` in DOMPurify config, or provide a targeted fix) before the ARB authorises the platform flip. On-call team should note that a Liquid→React rollback also resolves this symptom for affected stores.

### 8.2 H-F2 — Path-Traversal Risk in Theme Artifact Exporter (CLOSED)

**Issue (was open in earlier phases):** `packages/theme-engine/src/theme-artifact-exporter.ts` constructs artifact paths from bundle-supplied keys.

**Resolution:** `assertSafeArtifactPath()` (lines 58–68 of `packages/theme-engine/src/theme-artifact-exporter.ts`) is called at every path composition point (lines 75, 82, 90, 116, 124). It throws `UnsafeThemeArtifactPathError` on absolute paths or any `..` segment. Previously listed as OPEN in Phase H/I; code evidence on `stepup/main` confirms the fix is in place.

**Rollback impact:** None — not on the hot rollback path.

**Status:** CLOSED.

### 8.3 H-F3 — `settings_data` Export Without BLOCKED_DROP_KEYS Filter (LOW)

**Issue:** Exported theme settings may include sensitive keys not filtered through the `BLOCKED_DROP_KEYS` list.

**Rollback impact:** None on render rollback procedures.

**Status:** Open. Low-priority for rollback planning.

### 8.4 Governance Validator Non-Blocker (Known)

The pre-existing `node scripts/validate-governance.mjs` FAIL on the tenant-table registry predates Phase B and is human-owned (unrelated to the Liquid transformation program). `theme-governance-validator.mjs` and `migration-safety-validator.mjs` both PASS. This FAIL is a non-blocker for rollback procedures and for the ARB package.

### 8.5 FEATURE_LIQUID Gateway Flag — ARB Decision Pending

`FEATURE_LIQUID='false'` in production `wrangler.toml:248` is dormant (`featureGate('FEATURE_LIQUID', ...)` is never called — confirmed in `services/api-gateway/src/index.ts` and all route files). An ARB decision is required before the platform flip on whether to wire `FEATURE_LIQUID` as a gateway-level kill switch for Liquid rendering. If wired, it would provide a hot env-var toggle at the gateway layer (no code deploy needed for a gateway kill). If not wired before the flip, the only hot rollback available remains the per-store DB lever (Lever A–C) or the constant revert + deploy (Lever D).

---

## 9. Escalation Chain

| Scenario | First contact | Escalate to |
|---|---|---|
| Single store Liquid fallback, automatic mitigation active, merchant not reporting breakage | On-call engineer monitors; no immediate action unless threshold exceeded | — |
| Single store, merchant reports visible breakage | On-call engineer applies Lever A (DB update, ~2 min) | Engineering lead if Lever A fails to resolve within 10 min |
| Multiple unrelated stores with same error type | On-call engineer applies Lever A per store; notifies engineering lead | ARB if >5 stores simultaneously |
| Fleet-wide fallback rate spike (post-platform-flip scenario) | On-call engineer confirms automatic fallbacks active; pages ARB | ARB — required for Lever D (platform-wide constant revert + deploy) |
| ARB platform flip rollback | ARB authorises Lever D + Lever E | Engineering lead executes under ARB direction |

---

## 10. Appendix — Key File and Line References

| Concept | File | Lines |
|---|---|---|
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` | `packages/theme-engine/src/theme-governance.ts` | 14 |
| `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` (docs-only) | `packages/theme-engine/src/theme-governance.ts` | 16–21 |
| `resolveThemeLiquidRenderingEnabled()` — explicit engine check | `packages/theme-engine/src/theme-governance.ts` | 154–160 |
| `resolveThemeLiquidRenderingEnabled()` — 11 canary aliases | `packages/theme-engine/src/theme-governance.ts` | 162–179 |
| `readBooleanDecision()` — truthy/falsy values | `packages/theme-engine/src/theme-governance.ts` | 125–142 |
| `buildReleaseArtifacts()` — sets `renderer_engine='liquid'` | `services/api-gateway/src/execution/theme-execution.adapter.ts` | 620–643 |
| `STOREFRONT_SITE_SELECT` — no themes join | `services/api-gateway/src/routes/storefront/public-routes.ts` | 23–24 |
| `cachedJson()` — gateway cache TTL/SWR | `services/api-gateway/src/lib/storefront-cache.ts` | 12–13 |
| `export const revalidate = 60` — index page ISR | `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx` | 10 |
| `resolveDevEngineOverride()` — dev-only, not production | `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts` | 228–233 |
| G4 version gate — `UnsupportedLiquidBundleSchemaVersionError` | `packages/theme-engine/src/theme-bundle.ts` | 14–29 |
| G4 catch → `status:'unsupported'` | `packages/theme-engine/src/theme-renderer.ts` | 488–499 |
| C1 per-region try/catch | `packages/theme-engine/src/theme-renderer.ts` | 523–598 |
| `lb:canary:render:fallback` emit | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` | 623–635 |
| `lb:canary:render` emit | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` | 663–677 |
| `fallback_reason:'renderer_returned_null'` field | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` | 675 |
| Chrome-fallback seam (F5) | `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx` | 705–735 |
| `X-Lb-Render-Engine` header — global flag only | `apps/storefront-runtime/src/proxy.ts` | 175–176 |
| `KNOWN_LIQUID_BUNDLE_SCHEMA_VERSIONS` | `packages/theme-engine/src/theme-bundle.ts` | 14–15 |
| Migration 180 — sets `rendererEngine='liquid'` on urban-kicks themes row | `database/supabase/migrations/180_urban_kicks_liquid_theme.sql` | 37 |
| Migration 188 — letbuyy-core theme row | `database/supabase/migrations/188_letbuyy_core_theme_row.sql` | — |
| `FEATURE_LIQUID` gateway flag (DORMANT) | `services/api-gateway/wrangler.toml` | 248 |
