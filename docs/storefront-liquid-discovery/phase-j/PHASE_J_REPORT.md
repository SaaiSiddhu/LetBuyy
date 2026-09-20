# Phase J Report — Production Rollout Readiness

**Document ID:** PHASE-J-REPORT-2026-07-10  
**Date:** 2026-07-10  
**Branch:** stepup/main  
**Author role:** Subagent — Phase J finalizer  
**Scope:** Documentation and evidence consolidation only. Zero product source changes. Zero test changes. Zero migration changes. Zero flag changes.

---

## 1. What Phase J Produced

Phase J is a documentation-only phase. It produced five planning and evidence documents in `docs/storefront-liquid-discovery/phase-j/` and one amendment to `docs/storefront-liquid-discovery/certification/RISK_CLOSURE_REPORT.md`. No source files, test files, migration files, or governance constants were modified.

| Output | File | What It Is |
|---|---|---|
| ARB evidence package | `ARB_APPROVAL_PACKAGE.md` | Complete GO/NO-GO decision package for the ARB: 7-blocker reconciliation, 16-category QA scorecard, GO/NO-GO criteria across render parity, security, performance, and canary soak, a 3-gate phased ramp, and a complete open-risk register. |
| Rollout readiness | `ROLLOUT_READINESS_PACKAGE.md` | Engineering-layer readiness: all activation levers, telemetry point map, blocker reconciliation with code evidence, open items, and QA posture. |
| Rollback runbook | `ROLLBACK_RUNBOOK.md` | On-call rollback procedures for Stage 1 (per-store canary) and Stage 2 (post-flip platform-wide). Three per-store manual levers and two platform levers. Cache window detail and escalation chain. |
| Observability design | `OBSERVABILITY_AND_ALERTING.md` | Signal catalog (10 signals, CONNECTED/NOT-CONNECTED), proposed alert threshold table (9 alerts), 4-row dashboard layout design, and the exact wiring steps to go live. |
| Release notes | `RELEASE_NOTES.md` | Phase B–I narrative for merchant, developer, and operator audiences. Includes ARB-gate blocker reconciliation, what is behind the ARB flag, and telemetry reference. |
| Risk closure amendment | `certification/RISK_CLOSURE_REPORT.md §13` | Phase J amendment adding summary counts, a review-issue disposition table (H-F1, H-F2 confirmed CLOSED; I-F1 CLOSED in commit dbcf173a via `name="fullName"`, A11Y-5 asserts), and the honest readiness verdict. |

---

## 2. CONNECTED vs NOT-CONNECTED Honesty Summary

Every claim in the Phase J package is classified as CONNECTED (verifiable from committed source on `stepup/main`) or NOT-CONNECTED (requires live infrastructure not in this repository). This section is the authoritative summary.

### CONNECTED — Verifiable from committed source

| Claim | Source |
|---|---|
| `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` (global default OFF) | `packages/theme-engine/src/theme-governance.ts:14` |
| `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` (ARB-authority docs-only constant) | `packages/theme-engine/src/theme-governance.ts:16–21` |
| 5-layer crash-recovery safety net (per-block, per-section, per-region, layout, composition-engine outer catch) | `theme-renderer.ts` (Phase C C1) + `composition-engine.tsx:623–635` |
| Chrome-fallback seam (F5): React body + header/footer when Liquid returns null | `composition-engine.tsx:705–735` |
| G4 version gate: unknown `schema_version` → `status:'unsupported'` → React fallback | `theme-bundle.ts:14–29`, `theme-renderer.ts:488–499` |
| `lb:canary:render` structured log emission (fields: `event`, `engine`, `subdomain`, `template`, `route_type`, `latency_ms`, `editor_mode`, `fallback_reason`, `cache_hit: null`) | `composition-engine.tsx:663–677` |
| `lb:canary:render:fallback` structured warn emission (fields: `event`, `reason`, `subdomain`, `template`) | `composition-engine.tsx:628–633` |
| `lb:liquid:block-error` structured warn emission (fields: `event`, `blockId`, `blockType`, `error`) — no `sectionId` field | `theme-renderer.ts:777` |
| `renderer_engine` and `liquid_ready` written to `theme_releases.release_manifest` at publish time | `theme-execution.adapter.ts:643–644` |
| `X-Lb-Render-Engine` header reflects global env var only — NOT per-store resolution | `proxy.ts:175–176` |
| Per-store rollback via `release_manifest.renderer_engine` DB update — 60 s gateway TTL + 300 s SWR + 60 s ISR effect window | `storefront-cache.ts:12–13`, `page.tsx:10` |
| B-1 CLOSED: `StorefrontPreviewBridge` re-posts legacy postMessage as namespaced event | `storefront-preview-bridge.tsx:83`, `editor-bridge-protocol.ts:6` |
| B-2 CLOSED: `newsletter → newsletter-signup` at compile time and render time | `portable-to-liquid.ts:50`, `theme-renderer.ts:280–284` |
| B-3 CLOSED: `buildGoogleFontsHref()` wired; 4 font families added; `--font-playfair` corrected; CSP updated | `layout.tsx:138`, `globals.css:28`, `next-security-headers.ts:66–67` |
| B-4 CLOSED: `navToLinklists()` at `composition-engine.tsx:335–355`; linklists enter `buildLiquidScope()` (defined `theme-renderer.ts:792`, called at `theme-renderer.ts:568`) | `composition-engine.tsx:335–355`, `theme-renderer.ts:792, 568` |
| B-6 CLOSED (conditional on migration run): migration 188 committed, idempotent | `database/supabase/migrations/188_letbuyy_core_theme_row.sql` |
| B-5 MITIGATED: section-schema migration registry implemented; empty (correct — no breaking schema change shipped) | `section-schema-migrations.ts` |
| B-7 MITIGATED: lossless canonicalization utility; G3-consume explicitly deferred | `settings-schema-canonical.ts` |
| H-F1 CLOSED: `for (const attr of forbidAttrs)` at `theme-linter.ts:101` iterates FORBID_ATTR; rule name `forbidden-attr` | `theme-linter.ts:101` |
| H-F2 CLOSED: `assertSafeArtifactPath()` at `theme-artifact-exporter.ts:58–68` guards all path composition points (lines 75, 82, 90, 116, 124) | `theme-artifact-exporter.ts:58–68, 75, 82, 90, 116, 124` |
| Test gate: 221/221 theme-engine, 78/78 storefront-runtime, 15/15 merchant-control-plane PASS | `pnpm typecheck test --filter=@letbuyy/theme-engine` and `.../storefront-runtime` and `.../merchant-control-plane` |
| Governance validators: `theme-governance-validator.mjs` PASS; `migration-safety-validator.mjs` PASS | `scripts/validators/` |
| Governance validators: `validate-governance.mjs` FAIL (pre-existing, non-blocker, human-owned) | `scripts/validate-governance.mjs` |
| F9 benchmark: cold=24 ms, steady=11 ms, p95=17 ms, total=288 ms, N=25 (local only) | `packages/theme-engine/test/liquid-render-benchmark.test.ts` |
| `FEATURE_LIQUID` gateway flag is dormant (`featureGate()` never called for it) | `services/api-gateway/src/middleware/featureFlags.ts:4`, `wrangler.toml:248` |
| No percentage-of-stores rollout mechanism exists | Static analysis of activation path in `theme-governance.ts` and `resolveThemeLiquidRenderingEnabled()` |

### NOT-CONNECTED — Requires live infrastructure

| Claim | What is needed | Exact source / credential |
|---|---|---|
| Live `lb:canary:render` ingestion, fallback rate, p95 latency | Cloudflare Analytics Engine or Cloudflare Logpush | `OTEL_EXPORTER_OTLP_ENDPOINT` (OTLP) or `wrangler tail --format=json` for ad-hoc |
| Fallback rate (% of Liquid plans that fell back to React) | Aggregation on `lb:canary:render.fallback_reason` | Log pipeline on deployed Worker |
| Production CPU time / memory per Liquid render | Cloudflare Workers Analytics Engine | Workers Analytics Engine binding + Cloudflare account |
| Live count of stores with `renderer_engine='liquid'` | Production Supabase service-role credentials | `SELECT COUNT(*) FROM theme_releases tr JOIN sites s ON s.current_theme_release_id = tr.id WHERE tr.release_manifest->>'renderer_engine' = 'liquid'` |
| Production p95 TTFB at 50 VUs | k6 / Artillery or Playwright load harness + staging stack | None in repo |
| Live dashboards, alert wiring | Logpush sink + alerting platform (§3.1 of OBSERVABILITY_AND_ALERTING.md) | None in repo |
| DAST scan (XSS/CSP against live URL) | OWASP ZAP / Burp Suite + deployed staging URL | None in repo |
| DOMPurify JSDOM heap growth under load | Node.js heap profiling on Worker under sustained concurrency | None in repo |
| Per-store canary soak data (fallback rate, latency, error rate in production) | Live stores on Liquid path + wired Logpush | Zero production Liquid renders observed as of 2026-07-10 |

### Open Items Requiring Action Before GO

| ID | Severity | Finding | Status |
|---|---|---|---|
| I-F1 | ~~HIGH~~ **CLOSED** | DOMPurify 3.x clobbering bug on customer-register form — **FIXED** in commit dbcf173a. Field renamed from `name="name"` to `name="fullName"` in `theme-bundle.ts:2433`. Register route reads `form.get('fullName') ?? form.get('name')`. A11Y-5 asserts `name="fullName"` survives DOMPurify and `name="name"` is absent (221/221 PASS). | **CLOSED — not a GO gate** |
| H-F3 | LOW | `settings_data` exported verbatim in `theme-artifact-exporter.ts` without BLOCKED_DROP_KEYS filter. Code comment (lines 101–107) documents as intentional. | OPEN — acknowledged design choice; risk low if settings_data holds only design tokens |
| UC-19 | LOW | `FEATURE_LIQUID` gateway flag declared but `featureGate()` never called. Zero runtime effect. | OPEN — ARB decision needed: wire as kill switch or document as intentionally dormant |

---

## 3. Blocker Reconciliation Table

Seven original ARB-gate blockers from `docs/storefront-liquid-discovery/11_GAP_ANALYSIS.md` and `certification/ARCHITECTURE_CERTIFICATION.md`, reconciled against committed source on `stepup/main` as of 2026-07-10.

| # | Blocker | Phase Closed | State | Code Evidence |
|---|---|---|---|---|
| B-1 | postMessage key mismatch: `CenterPanel` sends `LETBUYY_THEME_EDITOR_SELECTION`; `EditorPreviewSectionFrame` listens for `letbuyy:theme-editor:section-selected`. Editor section-selection broken. | Phase C (C-04, C5) | **CLOSED** | `StorefrontPreviewBridge` at `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx`. `EDITOR_LEGACY_SELECTION_MESSAGE='LETBUYY_THEME_EDITOR_SELECTION'` from `editor-bridge-protocol.ts:6`. Line 83 listens; line 89 re-posts as `letbuyy:theme-editor:section-selected`. |
| B-2 | `newsletter` / `newsletter-signup` type split: silent render-time lookup miss. | Phase C (C4) + Phase D (compile-time) | **CLOSED** | Layer 1: `PORTABLE_TO_LIQUID_TYPE_OVERRIDES` at `portable-to-liquid.ts:50`. Layer 2: `LIQUID_SECTION_TYPE_ALIASES` at `theme-renderer.ts:280–284`. Residual LOW (not a blocker): Zod parse-time guard for DB-written bundles not added. |
| B-3 | Fonts not wired; four families missing; `--font-playfair` pointed at wrong typeface. | Phase D (D7) | **CLOSED** | `buildGoogleFontsHref()` at `layout.tsx:138`. FONT_MAP extended. `globals.css:28` corrected. CSP at `next-security-headers.ts:66–67`. R-09 in `RISK_CLOSURE_REPORT.md`. |
| B-4 | `linklists` absent from Liquid scope; `{{ linklists.main_menu }}` always nil. | Phase D (D1) | **CLOSED** | `navToLinklists()` at `composition-engine.tsx:335–355`. Linklists enter `buildLiquidScope()` (defined `theme-renderer.ts:792`, called at `theme-renderer.ts:568`) via `input.liquidContext.linklists`. Tests D1-A, D1-B. |
| B-5 | Schema migration engine built; zero concrete migrations registered; no forward-migration path for future breaking changes. | Phase G (G1) | **MITIGATED** | `section-schema-migrations.ts`: registry + `migrateThemeTemplateSchemas()` implemented. Empty (correct — no breaking schema change shipped). G3-consume deferred pending coordinated editor-side migration. |
| B-6 | `letbuyy-core` DB row missing; slug queries return 0 rows. | Phase G (G5) | **CLOSED** (conditional on migration run against production DB) | `database/supabase/migrations/188_letbuyy_core_theme_row.sql`: idempotent clone of `urban-kicks` row with `slug='letbuyy-core'` via `ON CONFLICT (slug) DO NOTHING`. |
| B-7 | Settings divergence: DB flat `appearance` group; TypeScript 5-group `THEME_SETTINGS_SCHEMA`; dual shapes incompatible. | Phase G (G3) | **MITIGATED** | `settings-schema-canonical.ts`: lossless round-trip functions. Render path tolerates both shapes (Phase D D2). G3-consume deferred (no breaking change). |

**Summary: 5 of 7 CLOSED, 2 MITIGATED, 0 still OPEN as blockers.**

---

## 4. Rollback-Safety Story

The platform's rollback-safety story is fully structural — no human action is required for the most common degradation scenarios.

### Automatic degradation (zero human action, per-request)

Every failure mode degrades to a full React page. No failure mode produces a blank page or HTTP 500, provided the React rendering path is healthy. The five automatic layers, in order of trigger specificity:

| Layer | Trigger | Effect |
|---|---|---|
| L1 — G4 version gate | Liquid bundle carries unrecognized `schema_version` | `parseLiquidThemePackageBundle()` throws `UnsupportedLiquidBundleSchemaVersionError`; caught at `theme-renderer.ts:491` → `status:'unsupported'` → React fallback. No merchant data modified. |
| L2 — Per-section crash recovery (C1) | Single Liquid section throws | Section skipped; HTML comment `<!-- lb:section-error ... -->` inserted; remaining sections continue rendering. |
| L3 — Per-region failure (C1) | Header / body / footer region throws | Failed region degrades to empty string; other regions continue. If all main sections fail → `status:'error'` → React fallback. |
| L4 — Composition-engine outer catch | Unexpected throw from inside `renderLiquidPlan()` (OOM, JSDOM failure) | `composition-engine.tsx:623–635` catches, logs `lb:canary:render:fallback`, returns `null` → React renders. |
| L5 — Chrome-fallback seam (F5) | `liquidHtml === null` (any of L1–L4 fired) | React body sections rendered, wrapped with React header/footer from `plan.sectionGroups`. No headerless/footerless fallback page. |

### Manual rollback (fastest per-store, no deploy)

**DB update — ~2 min typical, ~7 min worst case:**
```sql
UPDATE theme_releases
SET release_manifest = release_manifest || '{"renderer_engine": "json-contract"}'::jsonb
WHERE id = (SELECT current_theme_release_id FROM sites WHERE subdomain = '<store>');
```
Effect timing is bounded by: gateway cache TTL (60 s) + gateway SWR (up to 300 s) + Next.js ISR (60 s). Sources: `storefront-cache.ts:12–13`, `page.tsx:10`.

**Platform-wide rollback (requires ARB authority + code change + redeploy):**
Revert `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` at `packages/theme-engine/src/theme-governance.ts:14` from `true` back to `false`. Redeploy `apps/storefront-runtime`. This is the current value — the "reset state" requires no code change today. After any platform flip, a revert to `false` and a redeploy is the authoritative platform-wide kill.

**`FEATURE_LIQUID` gateway flag:** Declared at `wrangler.toml:248` and `featureFlags.ts:4` but `featureGate()` is never called. Has zero runtime effect. Do not rely on this flag for rollback until the ARB wires it.

---

## 5. Date and Test Gate

**Date:** 2026-07-10  
**Branch:** stepup/main  
**Last test gate (unchanged from Phase I):**

| Suite | Result |
|---|---|
| `pnpm typecheck test --filter=@letbuyy/theme-engine` | **221/221 PASS** |
| `pnpm typecheck test --filter=@letbuyy/storefront-runtime` | **78/78 PASS** |
| `pnpm typecheck test --filter=@letbuyy/merchant-control-plane` | **15/15 PASS** |
| `pnpm typecheck --filter=@letbuyy/api-gateway` | **32 turbo tasks, exit 0** |
| `node scripts/validators/theme-governance-validator.mjs` | **PASS** |
| `node scripts/validators/migration-safety-validator.mjs` | **PASS** |
| `node scripts/validate-governance.mjs` | **FAIL (pre-existing non-blocker, human-owned)** |

Phase J changed no source files, test files, or migration files. The test gate is unchanged from Phase I.

---

*Phase J Report — Storefront Liquid Platform | 2026-07-10 | Branch: stepup/main | Author: Subagent (Phase J finalizer role) | Scope: Documentation and evidence consolidation only. No source, test, migration, or flag changes.*
