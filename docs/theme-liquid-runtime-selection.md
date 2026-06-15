# Liquid Theme Runtime Selection — Phase 1

> Mission Phase 1 deliverable. **Evidence-only**: every claim cites `file:line`. No code was changed. Reuses existing architecture (`packages/theme-engine` + `apps/storefront-runtime/src/lib/theme-engine`); no new engine described.

## TL;DR

Storefront rendering chooses between the **React section registry** and the **Liquid renderer** via a **two-stage gate that already exists in production code**:

1. **Resolve** — `resolveStorefrontTemplate()` marks the render plan `rendererEngine: 'liquid'` only when a per-theme canary flag is ON **and** a schema-valid Liquid bundle **and** a coercible template exist.
2. **Render** — `StorefrontCompositionEngine` attempts the Liquid render and **silently falls back to React** on any failure.

**Governance** says Liquid is OFF by default (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`) and a platform-wide flip is **deferred to ARB** until parity/security/perf evidence is green. **But the effective runtime default is currently `true`** — see the Critical Correction below. Selection inputs come from the **published release manifest** (`release.release_manifest` JSON) plus an in-code fixture fallback, **not** from the `theme_renderer_manifests` table (which the runtime never reads).

> ## ⚠️ Critical correction — Liquid is effectively ON by default (uncommitted working-tree change)
>
> `apps/storefront-runtime/src/lib/store-service.ts:674-676` sets `liquidRenderingCanary = (typeof … === 'boolean') ? value : true`, and `:671-673` falls the bundle back to `createUrbanKicksLiquidThemeBundleFixture()`. Because `resolveThemeLiquidRenderingEnabled` reads `templateConfig.liquidRenderingCanary` **first** (`theme-governance.ts:149`), **every store loaded via `mapSupabaseToStore` resolves `liquidEnabled = true` with a valid bundle → renders via Liquid**, and the governance `false` default at `theme-governance.ts:167` is never reached.
>
> `git blame` shows lines 671-673 and 676 are **"Not Committed Yet" (2026-06-15)** — an uncommitted working-tree change. The prior committed behavior was `: undefined` (→ React). **This is a de-facto platform-wide Liquid flip that bypasses the ARB-gated, per-theme canary posture** and conflicts with this mission's Phase 9 "per-theme selection" requirement. The rest of the mission's verification (parity/security/perf) is what should gate this flip.

---

## 1. Selection source — the canary flag

`resolveThemeLiquidRenderingEnabled(input)` — `packages/theme-engine/src/theme-governance.ts:144`

Returns the first explicit boolean among these candidates, in precedence order (`theme-governance.ts:148-160`):

| # | Candidate | Origin |
|---|-----------|--------|
| 1 | `templateConfig.liquidRenderingCanary` | store templateConfig |
| 2-3 | `themeSettings.liquidRenderingCanary` / `liquid_rendering_canary` | theme settings |
| 4-7 | `releaseManifest.{liquidRenderingCanary, liquid_rendering_canary, liquidCanary, liquid_canary}` | release manifest |
| 8-11 | `rendererManifest.{liquidRenderingCanary, liquid_rendering_canary, liquidCanary, liquid_canary}` | `releaseManifest.renderer ‖ releaseManifest.renderer_manifest` (`:146`) |

Decoded by `readBooleanDecision()` (`:125`): accepts a boolean; strings `1/true/enabled/on/canary` → `true`, `0/false/disabled/off` → `false`; or a nested object with key `enabled|liquid_enabled|liquidEnabled|canary|value`. If no candidate is explicit → `input.defaultEnabled ?? THEME_LIQUID_RENDERING_DEFAULT_ENABLED` = **`false`** (`:167`, `:14`).

> The `renderer` / `renderer_manifest` slot inside the release manifest (`:146`) is the **existing per-theme renderer-engine switch**. Phase 9's `renderer.engine: REACT|LIQUID` should formalize this, not replace it.

## 2. Stage A — Resolve (`apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts`)

`resolveStorefrontTemplate(store, route, options)` — `:223`

- `liquidEnabled = options.liquidEnabled ?? resolveThemeLiquidRenderingEnabled({ templateConfig, defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED })` — `:229-232`
- `liquidBundle = liquidEnabled ? resolveLiquidBundle(store) : undefined` — `:233`. `resolveLiquidBundle()` (`:110`) tries `templateConfig.liquidBundle`, then `releaseManifest.{liquidBundle, themeBundle, bundle}`, each validated by `LiquidThemePackageBundleSchema.safeParse` (`:120`).
- If a bundle parses **and** `coerceLiquidTemplate()` yields a template → returns plan with `rendererEngine: 'liquid'`, `liquidBundle`, `liquidTemplateKey`, liquid section groups — `:238-256`.
- Otherwise → React plan: assigned/`templateKey`/`index`/fallback/legacy template, **no** `rendererEngine` field — `:260-294`.

**A Liquid plan requires all three: canary ON + schema-valid bundle + coercible route template. Any miss → React.**

## 3. Stage B — Render (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx`)

`StorefrontCompositionEngine` (default export) — `:371`

- `liquidHtml = await renderLiquidPlan({ store, plan, sectionData, editorMode })` — `:383`
- `renderLiquidPlan()` (`:327`): guard `if (plan.rendererEngine !== 'liquid' || !plan.liquidBundle) return null` (`:338`); else `createThemeRenderer('liquid').render({...})` with full liquid context; if `result.status !== 'rendered' || !result.liquid` → `return null` (`:366`); success → `result.liquid.layoutHtml` (`:368`).
- `engine = liquidHtml ? 'liquid' : 'react'` — `:384`.
- `liquidHtml` truthy → `<LiquidRenderedHtml>` (`dangerouslySetInnerHTML`) + `<LiquidHydrationIslands>` — `:396-405`. Else → `<RenderSectionList>` → `renderRegisteredSection()` (React registry) — `:407-415`.

## 4. Where the selection data comes from (`apps/storefront-runtime/src/lib/store-service.ts`)

The store loader denormalizes the published release manifest into `templateConfig`:

- `releaseManifest = asRecord(release?.release_manifest)` — `:549`
- `liquidBundle = LiquidThemePackageBundleSchema.safeParse(templateConfig.liquidBundle)` — `:670-673`
- `liquidRenderingCanary = typeof templateConfig.liquidRenderingCanary === 'boolean' ? … ` — `:674-675`
- Returned `templateConfig` carries `liquidBundle` (`:727`), `releaseManifest` (`:729`), `engineVersion`, `releaseId/Version`.

**Runtime selection inputs originate from the published `release.release_manifest`**, read once at store load and passed to the resolver.

> **Effective defaults (working tree, uncommitted 2026-06-15):** if `templateConfig.liquidBundle` fails schema-parse, `liquidBundle` falls back to the in-code `createUrbanKicksLiquidThemeBundleFixture()` (`:671-673`) — so a bundle is *always* present; and `liquidRenderingCanary` defaults to **`true`** (`:674-676`). Net: Liquid renders for every store unless a route's template fails to coerce. The loaders `getStoreBySubdomain` / `getStoreBySubdomainAnyStatus` / `getPreviewStoreBySubdomain` all route through `mapSupabaseToStore` (`:64, :80, :100`), so this applies to every live store load. See the Critical Correction (§TL;DR).

## 5. `theme_renderer_manifests` — NOT in the runtime path

- Defined in `database/supabase/migrations/000_baseline.sql`.
- LCIS (`graph:intel table`): 8 columns, RLS on (`force=false`), policy `theme_renderer_manifests_public_read`, trigger `update_theme_renderer_manifests_updated_at`, **0 indexes**, `reachedByRoutes: []`, `touchedByRpcs: []`.
- Only code references: `services/api-gateway/src/execution/schema-registry-execution.adapter.ts` (`:79, :391, :448, :585`) — the gateway schema-registry adapter.
- **No `storefront-runtime` or `theme-engine` code reads this table.** Render-time selection uses the release-manifest JSON (§4), not this table.

> **Phase 7 question:** is `theme_renderer_manifests` intended to be the source of truth for renderer selection? Today it is disconnected from the render path.

## 6. Fallback behavior (graceful, two points)

- **Resolve-time** — no canary / unparseable bundle / no liquid template → React plan (§2).
- **Render-time** — Liquid renderer returns non-`rendered` status or empty → `renderLiquidPlan` returns `null` → React registry (§3, `:366`).

Net: a broken Liquid bundle never breaks the store; it degrades to React. The degradation is **silent** except for the telemetry log (§7).

## 7. Canary telemetry

`composition-engine.tsx:386` emits a structured `console.log` JSON event `lb:canary:render` with `{ engine, subdomain, template, route_type, latency_ms, editor_mode }` (code comment: "Document 6 §4 — consumed by monitoring pipeline"). This is the only runtime signal distinguishing Liquid vs React renders. Whether a pipeline ingests it is a Phase 8 monitoring item — **NOT verified here**.

## 8. Route entry points (the selection surface)

All call `resolveStorefrontTemplate()` then render `<StorefrontCompositionEngine>` (or `StorefrontSectionGroupRenderer`):

| Route | File |
|-------|------|
| store shell (header/footer/nav) | `app/store/[subdomain]/layout.tsx` |
| index / homepage ✓ wiring confirmed | `app/store/[subdomain]/page.tsx` |
| product | `app/store/[subdomain]/product/[productId]/page.tsx` |
| collection | `app/store/[subdomain]/collections/[slug]/page.tsx` |
| products | `app/store/[subdomain]/products/page.tsx` |
| shop | `app/store/[subdomain]/shop/page.tsx` |
| editor preview | `app/preview/page.tsx` |
| content pages | `components/content/content-resource-renderer.tsx` |

**Cart is not in this set** — no themed cart route calls the resolver. Cart is client-hydrated (`LiquidHydrationIslands`) against `/api/storefront/{subdomain}/cart` (`composition-engine.tsx:286`). Consequence for Phase 6: cart "parity" is hydration-island behavior, not a server-HTML diff.

> **Open item for Phase 2:** `layout.tsx` renders header/footer section groups, while a Liquid plan returns a full `layoutHtml`. Confirm header/footer are not double-rendered in Liquid mode.

## 9. Exact runtime path (end-to-end)

```
Request /store/{subdomain}[/...]
  → StoreService.getStoreBySubdomainAnyStatus()      store-service.ts  (release_manifest → templateConfig)
  → resolveStorefrontTemplate(store, route)          template-resolver.ts:223
       ├─ resolveThemeLiquidRenderingEnabled()        theme-governance.ts:144   (canary? default false)
       ├─ resolveLiquidBundle() + schema parse        template-resolver.ts:110
       └─ rendererEngine: 'liquid'  | (React plan)    template-resolver.ts:238 / 285
  → buildSectionDataPlan({store, sections, route})   data-binding-engine.ts    (→ Phase 4)
  → <StorefrontCompositionEngine>                    composition-engine.tsx:371
       ├─ renderLiquidPlan() → createThemeRenderer('liquid').render()   :327 → LiquidRenderer (theme-renderer.ts:321)
       │     status 'rendered' → <LiquidRenderedHtml> + <LiquidHydrationIslands>   :396
       │     null / non-'rendered' → fall through
       └─ <RenderSectionList> → renderRegisteredSection()   renderer-registry.tsx   (React)
  → emit lb:canary:render telemetry                  :386
```

## 10. Governance constants (`packages/theme-engine/src/theme-governance.ts`)

- `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false` — `:14`
- `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION` = `{ status: 'deferred', authority: 'ARB', reason: "Liquid remains per-theme canary only until render-parity, security, SSTI/XSS, and performance evidence is green." }` — `:16-21`
- `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT = 20` — `:15`
- `THEME_LIQUID_PORTABLE_SECTION_PARITY` — 20 `reactFile → rendererKey → liquidSectionType` mappings — `:23-44`; `collectLiquidPortableSectionParityGaps()` reports missing Liquid sections — `:170`.

## 11. Implications for later phases

- **Phase 9 (renderer.engine):** the per-theme switch already exists as `liquidRenderingCanary`, resolved from `release_manifest.renderer / renderer_manifest`. Formalize `renderer.engine: REACT|LIQUID` as a typed alias over this slot — **do not add a parallel mechanism**. Rollback = flip the boolean in the release manifest (no deploy, no schema change).
- **Phase 6 (parity):** the 20-section parity matrix + `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT = 20` are the pass bar.
- **Phase 7:** decide whether `theme_renderer_manifests` (table) should feed runtime selection or remain gateway-only; today it is disconnected from render.
- **Phase 8:** ARB flip is gated on parity + security + perf evidence; default stays `false`.

---

### Verification method
LCIS (graphify) located every symbol/file; the pinpointed files were then read to extract exact control flow. Queries used: `/api/search`, `/api/blast`, `/api/owner`, `/api/table`, `graph:intel consumers`, `graph:intel table`. Files read: `composition-engine.tsx`, `execution-runtime.ts`, `template-resolver.ts`, `theme-governance.ts`, `store-service.ts` (grep), `app/store/[subdomain]/page.tsx`.
