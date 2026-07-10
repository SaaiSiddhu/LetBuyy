# Phase J — Liquid Rollout Plan: Phased Canary Ramp

> **PLANNING ONLY — no flag flipped, no deploy performed.**
> Platform-wide Liquid activation is ARB-AUTHORITY.
> `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` at
> `packages/theme-engine/src/theme-governance.ts:14` — unchanged.
> `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` (same file, lines 16–21).
> This document is read-only evidence for the ARB. No automation in this
> repository activates Liquid for any store or environment.

**Document ID:** PHASE-J-ROLLOUT-PLAN-2026-07-10  
**Date:** 2026-07-10  
**Branch:** stepup/main  
**Status:** PLANNING ONLY  
**Related documents:** ROLLOUT_READINESS_PACKAGE.md · ARB_APPROVAL_PACKAGE.md · ROLLBACK_RUNBOOK.md · OBSERVABILITY_AND_ALERTING.md

---

## 1. Critical Architecture Constraint — No %-of-Stores Rollout Mechanism

**There is no percentage-of-stores gradual rollout mechanism in this codebase.**

`resolveThemeLiquidRenderingEnabled()` (`packages/theme-engine/src/theme-governance.ts:144–182`) is a per-entity decision function. It evaluates in order:

1. Explicit `templateConfig.rendererEngine` / `releaseManifest.renderer_engine` field
2. Eleven canary alias flags (truthy value on any → Liquid ON for that entity)
3. Global default: `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` (currently `false`)

There is no A/B percentage split, no traffic weight, no feature-flag system that can route "50% of requests to Liquid." The only staged activation path is **per-store**: publishing a theme release whose bundle produces `release_manifest.renderer_engine = 'liquid'` in `theme_releases` (written by `services/api-gateway/src/execution/theme-execution.adapter.ts:643` when a `liquidBundle` is present).

The global platform flip (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true`) is the only mechanism that activates Liquid for all stores simultaneously and is the final, ARB-authorized stage.

**Consequence for this plan:** every stage is defined by the number of named stores explicitly activated on Liquid, not by a traffic percentage.

---

## 2. Why This Rollout Is Inherently Low-Risk

The rollout is safe at every stage because Liquid failure at any level degrades automatically to a full React page with no blank-page or HTTP 500 outcome. The safety net is structural (committed, tested, not a deployment artifact):

| Layer | Trigger | Effect | Evidence |
|---|---|---|---|
| L1 — G4 version gate | Liquid bundle carries unrecognized `schema_version` | `UnsupportedLiquidBundleSchemaVersionError` thrown at `theme-bundle.ts:1362` → caught at `theme-renderer.ts:491` → `status:'unsupported'` → React fallback | `theme-bundle.ts:14–29`, `theme-renderer.ts:488–499` |
| L2 — Per-section crash recovery (C1) | A single Liquid section throws | Section skipped; `<!-- lb:section-error sectionId="..." -->` HTML comment inserted; remaining sections continue | `theme-renderer.ts` (Phase C C1 parallel section catch) |
| L3 — Per-region failure (C1) | Header / body / footer region throws | Failed region degrades to empty string; if all main sections fail → `status:'error'` → React fallback | `theme-renderer.ts` (Phase C C1 region catch) |
| L4 — Composition-engine outer catch | Unexpected throw from `renderLiquidPlan()` (OOM, JSDOM crash) | `composition-engine.tsx:623–635` catches, logs `lb:canary:render:fallback`, returns `null` → React renders | `composition-engine.tsx:623–635` |
| L5 — Chrome-fallback seam (F5) | `liquidHtml === null` (any of L1–L4 fired) | React body sections rendered, wrapped with React header/footer from `plan.sectionGroups`. No headerless/footerless page. | `composition-engine.tsx:705–735` |

**No Liquid failure mode produces a blank page or hard HTTP 500** as long as the React rendering path is healthy. A misconfigured Liquid store silently degrades to its full React experience on the next ISR revalidation cycle (≤ 60 seconds, see §4.2).

---

## 3. Cohort Selection and Activation Mechanics

### 3.1 How a Store Is Moved to Liquid

The only supported activation path is publishing a theme release that carries a `liquidBundle`. The gateway `buildReleaseArtifacts()` in `services/api-gateway/src/execution/theme-execution.adapter.ts:620–643` sets `release_manifest.renderer_engine = 'liquid'` when a `liquidBundle` is present. Storefront-runtime reads this via `mapSupabaseToStore()` → `templateConfig.releaseManifest` → `resolveThemeLiquidRenderingEnabled()` on every SSR request.

**Activation checklist for a cohort store:**

1. Confirm the store has a theme release published with a `liquidBundle` (or manually set `renderer_engine = 'liquid'` in `theme_releases.release_manifest` for the store's current release via a direct DB update, using the SQL at §4.3).
2. Verify `liquid_ready = true` in the same `release_manifest` row (`theme-execution.adapter.ts:644`).
3. Wait up to 60 seconds for ISR revalidation (`export const revalidate = 60` at `apps/storefront-runtime/src/app/store/[subdomain]/page.tsx:10`) plus up to 300 seconds for gateway SWR cache expiry (`storefront-cache.ts:12–13`). Worst-case propagation: ~7 minutes.
4. Observe `lb:canary:render` log events for the store's subdomain with `engine='liquid'` to confirm activation.

### 3.2 The Urban-Kicks Cascade (Migration 180)

Migration 180 (`database/supabase/migrations/180_urban_kicks_liquid_theme.sql:37`) set `themes.default_template.rendererEngine = 'liquid'` on the urban-kicks theme row. **This does not automatically activate any live store.** The gateway `STOREFRONT_SITE_SELECT` query (`public-routes.ts:23`) does not join the `themes` table, so `themes.default_template` never reaches the store payload directly. Activation only occurs when a merchant publishes a release (triggering `buildReleaseArtifacts()` which detects the `liquidBundle`) OR when `release_manifest.renderer_engine` is set directly in `theme_releases`.

### 3.3 Canary Alias Alternative

Any of the 11 canary aliases (`liquidRenderingCanary`, `liquid_rendering_canary`, `liquidCanary`, `liquid_canary`) set to a truthy value (`'true'`, `'1'`, `'enabled'`, `'on'`, `'canary'`) in `sites.template_config` or `theme_releases.release_manifest` also activates Liquid for that store. This path bypasses `buildReleaseArtifacts()` and can be used for rapid internal testing without a theme publish.

### 3.4 ISR Propagation Delay

The effect of any `theme_releases.release_manifest` DB change propagates as follows:

- Gateway TTL (`storefront-cache.ts:12–13`): up to 60 seconds
- Gateway SWR (`storefront-cache.ts`): up to 300 additional seconds (background revalidation)
- Next.js ISR (`page.tsx:10`, `export const revalidate = 60`): up to 60 seconds after cache miss

**Worst-case propagation: ~7 minutes. Typical: ~60–90 seconds.**

---

## 4. Phased Ramp — 7-Stage Plan

All duration values below are labeled **PROPOSED**. All live metrics are labeled CONNECTED (cite emission point) or NOT-CONNECTED (cite required source). No thresholds are binding until the ARB ratifies them.

### Stage Summary Table

| Stage | Name | Stores (approx.) | Activation Lever | PROPOSED Soak | Abort Trigger |
|---|---|---|---|---|---|
| 0 | Internal | 0 → 1 (internal test store) | Per-store `release_manifest.renderer_engine = 'liquid'` or canary alias in `template_config` | 2 days | Any unexpected `lb:canary:render:fallback` event |
| 1 | Demo (urban-kicks-demo) | 1 → 1 named demo store | Per-store `release_manifest.renderer_engine = 'liquid'` (the only Liquid store today) | 7 days | Fallback rate > 1% (PROPOSED) |
| 2 | Urban Kicks first-party | 1 → ~1–3 first-party stores | Per-store `release_manifest.renderer_engine = 'liquid'` via publish | 14 days | Fallback rate > 0.5% (PROPOSED) over 7 days |
| 3 | 10 stores | ~3 → 10 | Per-store activation, same lever | 14 days | Fallback rate > 0.5% or p95 latency > 400 ms (PROPOSED) |
| 4 | 100 stores | 10 → 100 | Per-store activation, same lever | 30 days | Fallback rate > 0.5% or HTTP 500 rate increase (PROPOSED) |
| 5 | 1 000 stores | 100 → 1 000 | Per-store activation, same lever | 30 days | Same thresholds as Stage 4 |
| 6 | Platform default (ARB flip) | All stores | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true` + storefront-runtime redeploy | Ongoing monitoring | ARB-authorized rollback only |

---

### Stage 0 — Internal Validation (0 → 1 internal test store)

**Purpose:** Confirm that the activation path works end-to-end on a live store under real Cloudflare Workers runtime before touching any user-facing store.

| Property | Value |
|---|---|
| **Activation lever** | Set canary alias in `sites.template_config` for the internal test store: `{ "liquidRenderingCanary": "true" }` — or publish a Liquid release for that store. |
| **Entry criteria** | All Gate 0 pre-conditions in ARB_APPROVAL_PACKAGE.md §6 are met: I-F1 CLOSED (done, commit 4eaf3e84); migration 188 applied to production DB; `wrangler tail` log capture configured. |
| **PROPOSED soak duration** | 2 days minimum. |
| **Success metrics** | (1) `lb:canary:render` events observed for the test store with `engine='liquid'` — CONNECTED: emission at `composition-engine.tsx:663–677`. (2) Zero `lb:canary:render:fallback` events — CONNECTED: emission at `composition-engine.tsx:628–633`. (3) No `lb:liquid:block-error` events — CONNECTED: emission at `theme-renderer.ts:777`. (4) Page renders visually correct (manual verification or synthetic check for `<!-- lb:section-error -->` in HTML). |
| **Live metric status** | `lb:canary:render` log: CONNECTED (emission point committed); live ingestion pipeline: NOT-CONNECTED (requires Cloudflare Logpush or `wrangler tail --format=json`, see OBSERVABILITY_AND_ALERTING.md §5.1). |
| **Abort trigger (PROPOSED)** | Any `lb:canary:render:fallback` event (unexpected throw — should be zero). Any `lb:section-error` comment in rendered HTML. Any HTTP 500 response from the Liquid store. |
| **Blast radius** | Single internal store. Zero merchant traffic. Zero revenue impact. |
| **Rollback** | Remove canary alias from `sites.template_config` (takes effect on next ISR revalidation, ≤ 60 seconds). Or: set `release_manifest.renderer_engine = 'json-contract'` in `theme_releases` for that store. |

---

### Stage 1 — Demo Store (urban-kicks-demo subdomain)

**Purpose:** The `urban-kicks-demo` subdomain is the only Liquid store today (migration 180 set `rendererEngine='liquid'` on the urban-kicks theme). Treat it as the first formal canary soak against the live Liquid code path.

| Property | Value |
|---|---|
| **Activation lever** | Confirm `release_manifest.renderer_engine = 'liquid'` is set for the urban-kicks-demo store's current release in `theme_releases`. If not set (store has never published a release with a liquidBundle), publish a Liquid release or set via DB update: `UPDATE theme_releases SET release_manifest = release_manifest \|\| '{"renderer_engine": "liquid"}'::jsonb WHERE id = (SELECT current_theme_release_id FROM sites WHERE subdomain = 'urban-kicks-demo')`. |
| **Entry criteria** | Stage 0 completed with zero abort triggers. Logpush or `wrangler tail` session capturing `lb:canary:render` events is active. |
| **PROPOSED soak duration** | 7 days. |
| **Success metrics** | (1) Fallback rate (`fallback_reason IS NOT NULL / total Liquid-intended renders`) < 1% over 7 days — NOT-CONNECTED (requires log pipeline). (2) Zero `lb:canary:render:fallback` (unexpected throw) events — CONNECTED: emission point committed. (3) Median `latency_ms` for Liquid renders within 3× F9 local steady-state baseline (11 ms × 3 = 33 ms PROPOSED, but production Workers runtime will be higher; calibrate against first 100 renders) — NOT-CONNECTED (requires log pipeline). (4) Zero HTTP 500 responses attributed to the Liquid render path. (5) No `<!-- lb:section-error -->` comments in page HTML (synthetic scrape or manual check). |
| **Live metric status** | Fallback rate: NOT-CONNECTED (requires Cloudflare Logpush, see OBSERVABILITY_AND_ALERTING.md §2.1). Render latency: NOT-CONNECTED. Unexpected throw count: CONNECTED (log emission exists, visible via `wrangler tail`). HTTP 500 rate: NOT-CONNECTED (requires Cloudflare error rate dashboard or Vercel function error panel). |
| **Abort trigger (PROPOSED)** | Fallback rate > 1% over any 30-minute window. Any `lb:canary:render:fallback` event in the first 24 hours. HTTP 500 rate increase > 0% vs React baseline. |
| **Blast radius** | Single demo store. Merchant-facing traffic limited to demo/internal users. Zero revenue transactions on demo store. |
| **Rollback** | Same as Stage 0. DB update to set `renderer_engine = 'json-contract'`. Effect in ≤ 7 minutes (TTL + SWR + ISR). |

---

### Stage 2 — Urban Kicks First-Party (1 → ~3 stores)

**Purpose:** Expand to 1–3 known first-party Urban Kicks stores that are operated by the LetBuyy team (not external merchants). These stores have known content and known traffic patterns.

| Property | Value |
|---|---|
| **Activation lever** | For each store: publish a Liquid theme release (merchant-control-plane publish flow triggers `buildReleaseArtifacts()` → `release_manifest.renderer_engine = 'liquid'`). Alternatively, DB update for direct activation if publish is not yet merchant-facing on these stores. |
| **Entry criteria** | Stage 1 completed with zero abort triggers. Live log ingestion (Logpush or Analytics Engine) wired and confirmed for Stage 1 data. Fallback rate from Stage 1 is below the Stage 1 PROPOSED threshold. |
| **PROPOSED soak duration** | 14 days. |
| **Success metrics** | (1) Fallback rate < 0.5% over 7 days per activated store — NOT-CONNECTED. (2) `lb:canary:render:fallback` event rate < 0.1% of Liquid renders — CONNECTED (emission point); NOT-CONNECTED (aggregation). (3) p95 `latency_ms` for Liquid renders < 400 ms — NOT-CONNECTED. (4) No SEV-1 incidents (blank page, checkout failure, login failure, registration failure) attributed to Liquid renderer. (5) Memory: no Worker OOM signals in Cloudflare error logs — NOT-CONNECTED. |
| **Live metric status** | All rate/latency metrics: NOT-CONNECTED (requires Cloudflare Logpush sink + aggregation layer, see OBSERVABILITY_AND_ALERTING.md §5.2). `lb:canary:render:fallback` raw events: CONNECTED via `wrangler tail`. |
| **Abort trigger (PROPOSED)** | Fallback rate > 0.5% over any 1-hour window for any activated store. Any `lb:canary:render:fallback` event in the first 48 hours. Any SEV-1 incident on a Liquid store. |
| **Blast radius** | ~3 first-party stores. Internal merchant traffic only. Revenue transactions on these stores are LetBuyy-team transactions — rollback is immediate and low-impact. |
| **Rollback** | DB update per store (same as Stage 1). Canary alias to `'false'` as instant kill within a store's `template_config`. |

---

### Stage 3 — 10 Stores

**Purpose:** First cohort of external or semi-external merchant stores. Validates that Liquid rendering is stable across diverse merchant content and settings configurations (not just Urban Kicks fixtures).

| Property | Value |
|---|---|
| **Cohort selection** | Select 7–10 stores from early-access merchants who have consented to the canary program, or stores with simple theme configurations (single experience preset, limited section variety). Avoid stores with active high-revenue checkout flows in this cohort. |
| **Activation lever** | Per-store: publish Liquid theme release via merchant-control-plane. `buildReleaseArtifacts()` in `theme-execution.adapter.ts:620–643` sets `release_manifest.renderer_engine = 'liquid'`. Confirm `liquid_ready = true` for each store. |
| **Entry criteria** | Stage 2 completed with zero abort triggers. Live Logpush pipeline confirmed delivering `lb:canary:render` events. Alert thresholds from OBSERVABILITY_AND_ALERTING.md §3.1 are wired in the alerting platform. Fallback rate from Stage 2 stores remains below PROPOSED threshold. |
| **PROPOSED soak duration** | 14 days. |
| **Success metrics** | (1) Fallback rate < 0.5% over 7 days across all activated stores — NOT-CONNECTED. (2) `lb:canary:render:fallback` rate < 0.1% — NOT-CONNECTED (rate; individual events CONNECTED). (3) p95 `latency_ms` < 400 ms for Liquid stores — NOT-CONNECTED. (4) p95 TTFB (full request) < 500 ms at baseline VU — NOT-CONNECTED (requires load harness). (5) No SEV-1 incidents. (6) DAST scan against at least one Liquid-activated staging URL — NOT-CONNECTED (requires OWASP ZAP or Burp Suite + deployed URL). |
| **Live metric status** | All metrics: NOT-CONNECTED until Logpush pipeline + aggregation from OBSERVABILITY_AND_ALERTING.md §5 is operational. Individual `lb:canary:render:fallback` events: CONNECTED via `wrangler tail`. Store-level activation count: NOT-CONNECTED (requires Supabase query `SELECT COUNT(DISTINCT s.id) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'` — production credentials required). |
| **Abort trigger (PROPOSED)** | Fallback rate > 0.5% for any single store over a 1-hour window. More than 2 `lb:canary:render:fallback` events per store per day. p95 latency > 800 ms (CRITICAL threshold from OBSERVABILITY_AND_ALERTING.md §3.1). Any SEV-1. |
| **Blast radius** | ~10 stores. External merchant traffic. Revenue transactions potentially in flight. Rollback per-store via DB update (no deploy). |
| **Rollback** | DB update: `UPDATE theme_releases SET release_manifest = release_manifest || '{"renderer_engine": "json-contract"}'::jsonb WHERE id = (SELECT current_theme_release_id FROM sites WHERE subdomain = '<store>')`. Takes effect within ≤ 7 minutes. See ROLLBACK_RUNBOOK.md Lever A. |

---

### Stage 4 — 100 Stores

**Purpose:** First significant scale validation. Reveals concurrency patterns, edge-case template configs, and per-section crash rates that are invisible at 10-store scale.

| Property | Value |
|---|---|
| **Cohort selection** | Expand from Stage 3 cohort. Include a mix of experience presets (Aura, Craft, Dawn, Sense, Urban Kicks, Refresh) and content varieties (high section count, custom rich-content, blog-heavy). Avoid stores that are in active high-revenue promotion periods. |
| **Activation lever** | Per-store: publish Liquid theme release. Same `buildReleaseArtifacts()` path as Stage 3. |
| **Entry criteria** | Stage 3 completed with zero abort triggers. All Stage 3 success metrics met for the full 14-day soak. Production p95 latency baseline established from Stage 3 Logpush data. Memory profiling run completed (no sustained heap growth observed). H-F2 path-traversal risk formally accepted (ARB_APPROVAL_PACKAGE.md §7 H-F2 is CLOSED). |
| **PROPOSED soak duration** | 30 days. |
| **Success metrics** | (1) Fallback rate < 0.5% over 30 days across all activated stores — NOT-CONNECTED. (2) `lb:canary:render:fallback` rate < 0.1% — NOT-CONNECTED. (3) p95 `latency_ms` < 400 ms (calibrated against Stage 3 baseline) — NOT-CONNECTED. (4) No sustained heap growth above React baseline observed in Worker memory profiling — NOT-CONNECTED (requires Cloudflare Analytics Engine or Workers memory snapshots). (5) Visual diff: < 1% pixel difference vs React render for same merchant content on at least 10 store templates — NOT-CONNECTED (requires screenshot diffing tool). (6) No SEV-1 incidents across the cohort. |
| **Live metric status** | All metrics: NOT-CONNECTED until Logpush + Analytics Engine pipeline from Stage 3 is fully operational. |
| **Abort trigger (PROPOSED)** | Cohort-wide fallback rate > 0.5% for more than 2 consecutive hours. More than 10 `lb:canary:render:fallback` events across the cohort per hour. Any evidence of memory leak (sustained heap growth in Worker profiling). Any SEV-1. |
| **Blast radius** | ~100 stores. Real merchant traffic and revenue transactions. Rollback still per-store (no deploy required); a batch DB update script can revert 100 stores simultaneously. |
| **Rollback (batch)** | `UPDATE theme_releases SET release_manifest = release_manifest || '{"renderer_engine": "json-contract"}'::jsonb WHERE id IN (SELECT current_theme_release_id FROM sites WHERE subdomain IN (<cohort-list>))`. |

---

### Stage 5 — 1 000 Stores

**Purpose:** Pre-platform-flip scale validation. Validates that the Liquid rendering path is stable at production load for the majority of the merchant base.

| Property | Value |
|---|---|
| **Cohort selection** | Expand from Stage 4 cohort to ~1 000 stores. Include stores across all plan tiers and traffic levels. |
| **Activation lever** | Per-store: publish Liquid theme release. Same `buildReleaseArtifacts()` path. |
| **Entry criteria** | Stage 4 completed with zero abort triggers. All Stage 4 success metrics met for the full 30-day soak. Memory profiling from Stage 4 shows no heap growth regression. ARB has reviewed Stage 3 and Stage 4 data and formally acknowledged it. |
| **PROPOSED soak duration** | 30 days. |
| **Success metrics** | Same as Stage 4, applied to the 1 000-store cohort. Additionally: (1) Load test against a Liquid-activated staging stack at 50 VUs produces p95 TTFB < 500 ms — NOT-CONNECTED (requires k6 or Artillery + staging stack, see ARB_APPROVAL_PACKAGE.md §5.3). (2) No SEV-1 incidents across the cohort. (3) ARB formally reviews Stage 5 soak data and approves proceeding to Stage 6. |
| **Live metric status** | All metrics: NOT-CONNECTED until pipeline from Stage 3 is operational. At 1 000 stores, Cloudflare Analytics Engine (real-time, sub-minute) is strongly recommended over Logpush alone. |
| **Abort trigger (PROPOSED)** | Same thresholds as Stage 4. Additionally: cohort-wide HTTP 500 rate increase > 0.01% vs React baseline. |
| **Blast radius** | ~1 000 stores. Significant merchant traffic and revenue. Per-store rollback still possible via batch DB update; platform-level rollback (Stage 6 revert) requires a storefront-runtime redeploy. |
| **Rollback (batch)** | Same batch SQL as Stage 4, scoped to the 1 000-store cohort subdomain list. Takes effect within ≤ 7 minutes per store (ISR + cache). |

---

### Stage 6 — Platform Default (ARB Flip) — NOT PERFORMED HERE

**This stage is ARB-AUTHORITY. It is NOT performed by this document, any automated script, or any Phase J deliverable.**

| Property | Value |
|---|---|
| **Activation lever** | A human-authored commit changing `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = true` in `packages/theme-engine/src/theme-governance.ts:14`, followed by a supervised storefront-runtime redeploy to Vercel/Cloudflare. |
| **What this changes** | `resolveThemeLiquidRenderingEnabled()` falls through to `true` when no per-entity explicit engine is set. All stores without an explicit `renderer_engine` in `theme_releases.release_manifest` attempt Liquid rendering, falling back to React per the safety net if the bundle is absent or invalid. |
| **Entry criteria** | Stages 1–5 completed with zero abort triggers. All Stage 5 success metrics met. ARB convenes with Stage 5 data. ARB records a formal decision authorizing the flip. Open items UC-19 (`FEATURE_LIQUID` kill switch decision) resolved. |
| **PROPOSED soak duration** | Ongoing monitoring with the same alert thresholds as Stage 5. |
| **Success metrics** | Same metrics as Stage 5, applied to the full platform. |
| **Abort trigger (PROPOSED)** | Any of the Stage 5 abort triggers, applied platform-wide. |
| **Blast radius** | All stores on the platform. This is the only irreversible-without-a-deploy stage. |
| **Rollback** | Revert `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` to `false` in `packages/theme-engine/src/theme-governance.ts:14` and redeploy storefront-runtime. This is the current value — the "reset state" requires no code change today. After any flip, a revert to `false` and a redeploy is the authoritative platform-wide kill. See ROLLBACK_RUNBOOK.md Lever D. |
| **Additional documentation** | Update `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status` from `'deferred'` to `'approved'` in the same file (documentation only; does not gate anything at runtime). |

---

## 5. Metric Summary — CONNECTED vs NOT-CONNECTED

| Metric | Status | Source / Emission Point |
|---|---|---|
| `lb:canary:render` log event (engine, subdomain, latency_ms, fallback_reason) | CONNECTED — emission point committed | `composition-engine.tsx:663–677` |
| `lb:canary:render:fallback` log event (unexpected throw) | CONNECTED — emission point committed | `composition-engine.tsx:628–633` |
| `lb:liquid:block-error` log event (per-block crash) | CONNECTED — emission point committed | `theme-renderer.ts:777` |
| `<!-- lb:section-error -->` HTML comment (per-section crash) | CONNECTED — emitted in rendered HTML | `theme-renderer.ts:417` |
| `renderer_engine` field in `theme_releases.release_manifest` | CONNECTED (DB write) | `theme-execution.adapter.ts:643` |
| Fallback rate (% of Liquid-intended renders that fell back) | NOT-CONNECTED | Requires Cloudflare Logpush → log aggregation; env var: `OTEL_EXPORTER_OTLP_ENDPOINT` or `wrangler tail` |
| p50 / p95 render latency (`latency_ms`) | NOT-CONNECTED | Same pipeline as fallback rate |
| `lb:canary:render:fallback` rate (unexpected throws per unit time) | NOT-CONNECTED (rate; individual events CONNECTED via `wrangler tail`) | Logpush + aggregation |
| Production Worker CPU time / memory per render | NOT-CONNECTED | Cloudflare Analytics Engine (`OTEL_EXPORTER_OTLP_ENDPOINT` or Workers Analytics Engine binding) |
| Live count of stores with `renderer_engine='liquid'` | NOT-CONNECTED | Production Supabase service-role credentials; query: `SELECT COUNT(DISTINCT s.id) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'` |
| HTTP 500 rate by engine | NOT-CONNECTED | Cloudflare error rate dashboard or Vercel function error panel |
| p95 TTFB at 50 VUs | NOT-CONNECTED | k6 or Artillery + staging stack; see ARB_APPROVAL_PACKAGE.md §5.3 |
| Visual diff vs React baseline | NOT-CONNECTED | Screenshot diffing tool (Playwright + pixelmatch or equivalent) |

**Minimum viable observability before Stage 1:** `wrangler tail --format=json` piped to a local log sink capable of filtering `lb:canary:render` and `lb:canary:render:fallback` events. This is the manual alternative for Stages 0–1 before Logpush is wired.

**Full observability (required before Stage 3):** Cloudflare Logpush → aggregation sink → dashboards + alerts as specified in OBSERVABILITY_AND_ALERTING.md.

---

## 6. Pre-Activation Checklist (Gate 0)

The following must be satisfied before any store is activated (Stage 0 entry):

| Item | Status | Owner |
|---|---|---|
| I-F1 DOMPurify clobbering fix: `name="fullName"` in `theme-bundle.ts:2433` | **CLOSED** (commit 4eaf3e84; A11Y-5 green) | Engineering — done |
| Migration 188 (`188_letbuyy_core_theme_row.sql`) applied to production DB | Required for B-6 CLOSED in production | Operations |
| `wrangler tail` log capture confirmed working against production Worker | Minimum viable observability | Operations |
| UC-19: ARB decision on `FEATURE_LIQUID` gateway flag (wire as kill switch or document as dormant) | OPEN — ARB decision required | ARB + Engineering |
| Baseline React store count query run against production: `SELECT renderer_engine, COUNT(*) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id GROUP BY 1` | Establishes baseline before any activation | Operations |
| Rollback runbook (ROLLBACK_RUNBOOK.md) reviewed by on-call team | Confirms readiness to execute manual revert | Engineering + Operations |

---

## 7. Abort and Rollback Procedures

### 7.1 Per-Store Abort (Stages 0–5)

The fastest per-store rollback requires no code deploy:

```sql
-- Lever A: Set renderer_engine to non-liquid for a specific store
UPDATE theme_releases
SET release_manifest = release_manifest || '{"renderer_engine": "json-contract"}'::jsonb
WHERE id = (
  SELECT current_theme_release_id FROM sites WHERE subdomain = '<store-subdomain>'
);
```

Effect timing: gateway TTL (60 s) + SWR (up to 300 s) + ISR (60 s) = ≤ 7 minutes.

Alternatively (Lever B): set a canary alias to falsy in `sites.template_config`:

```json
{ "liquidRenderingCanary": "false" }
```

### 7.2 Batch Cohort Abort (Stages 3–5)

```sql
-- Revert all stores in a named cohort
UPDATE theme_releases
SET release_manifest = release_manifest || '{"renderer_engine": "json-contract"}'::jsonb
WHERE id IN (
  SELECT current_theme_release_id FROM sites
  WHERE subdomain = ANY(ARRAY[<subdomain_list>])
);
```

### 7.3 Platform Abort (Stage 6 only)

Revert `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` in `packages/theme-engine/src/theme-governance.ts:14` and redeploy storefront-runtime. This is the current value. No code change is needed; the constant is already `false`.

Full rollback procedures including cache window detail and escalation chain are in ROLLBACK_RUNBOOK.md.

---

*Phase J Rollout Plan — Storefront Liquid Platform | 2026-07-10 | Branch: stepup/main | PLANNING ONLY — no flag flipped, no deploy. ARB authority required for any store activation and for the platform-wide flip (Stage 6).*
