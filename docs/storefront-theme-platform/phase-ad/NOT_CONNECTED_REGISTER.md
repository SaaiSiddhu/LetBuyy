# NOT-CONNECTED Register — LetBuyy Theme Platform (B→AC)

**Document class:** Anti-green-washing certification artifact  
**Program window covered:** B→L (baseline Liquid/storefront foundations) + M→AC (Shopify-class merchant editor)  
**Certification date:** 2026-07-11  
**Branch:** `stepup/main`  
**HEAD at issue:** `83d61e0a` (Phase AC — AI-assisted customization)  
**Program baseline (Phase M):** `9186188e`  
**B→L baseline (Phase L):** `29f87115`  
**Author:** AD certification sub-agent (read-only; no source edits; no git)  
**Companion document:** `docs/storefront-theme-platform/phase-ad/PHASE_AD_CERTIFICATION.md`

---

## 1. Purpose

This register is the canonical, durable record of every seam across the full B→AC theme platform
program that is **honestly NOT-CONNECTED** at HEAD — meaning the structural plumbing exists but
a runtime dependency (env var, gateway route, external service, DB row, or per-store flag flip)
is absent and the code path therefore does not produce live output.

The document exists to prevent green-washing: no seam listed here may be described as
"connected", "live", or "integrated" in any ARB brief, merchant-facing copy, release note,
or external communication until the corresponding closure criteria are satisfied and a new
certification artifact supersedes this register.

Every entry includes:
- the owning phase that introduced the seam
- the exact source location(s) of the honesty mechanism
- the precise missing piece (env var / route / service / migration / flag)
- the technical reason it is disconnected by design, not by accident

---

## 2. Scope

The program window covers **23 phases** (B through AC, inclusive of B→L foundations and the
M→AC merchant editor program). The register catalogs **7 primary NOT-CONNECTED seams** and
**2 structural-only states** that are partially connected.

| ID | Seam | Owning Phase(s) | Category | Status |
|----|------|-----------------|----------|--------|
| NC-01 | Liquid canary flag (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED`) | M → AC (ARB-gated) | Feature flag | NOT-CONNECTED (global default) |
| NC-02 | Metafield render resolution | W | Storefront hydration | NOT-CONNECTED |
| NC-03 | Live FX rate feed for currency display | W / Z | Commerce data | NOT-CONNECTED |
| NC-04 | Live app-block content runtime | Y | App extensions | NOT-CONNECTED |
| NC-05 | Custom CSS render-path call site | AA | Render pipeline | NOT-CONNECTED |
| NC-06 | AI model boundary — NL free-text parsing | L / AC | AI / LLM | NOT-CONNECTED |
| NC-07 | Theme analytics event emission and metrics | K / M → AC | Observability | NOT-CONNECTED |
| SO-01 | Settings dual-shape (flat → grouped canonicalization) | G / B-7 | Data model | STRUCTURAL-ONLY (mitigated) |
| SO-02 | Schema migration concrete entries registry | G / B-5 | Governance | STRUCTURAL-ONLY (mitigated) |

**Key:** NOT-CONNECTED = code path is structurally present but returns a documented seam result
for every live call. STRUCTURAL-ONLY = schema and validation code exist; one specific wiring or
enforcement step is absent.

---

## 3. Anti-fabrication honesty mechanisms

Four compile-time and runtime mechanisms prevent silent fabrication across the program. These
are not aspirational — they are verified by the AD certification gate:

| Mechanism | Location | Verification |
|-----------|----------|-------------|
| `MODEL_BOUNDARY.status = 'NOT_CONNECTED' as const` | `packages/theme-engine/src/theme-ai-sdk.ts:919-920` | TypeScript literal type; dead `if(boundary.status === 'CONNECTED')` branch detectable by compiler |
| `AINotConnectedResult` type + explicit return at free-text branch | `packages/theme-engine/src/ai-intent-parser.ts:156-160, 595-602` | `proposeThemeCustomization` returns this union member for every free-text call; no heuristic NLU executed |
| `APP_BLOCK_NOT_CONNECTED_REASON` constant, never empty | `packages/theme-engine/src/app-block-model.ts:309-310` | Constant is `'NOT-CONNECTED: no live app runtime produces app-block HTML.'`; surfaced to the merchant editor `APP_BLOCK_NOT_CONNECTED_REASON` field |
| `fxConnected: false` as a **literal type**, not `boolean` | `packages/theme-engine/src/theme-locale.ts:270` | The type of `fxConnected` in `ThemeCurrencyDisplayResult` is `false` (not `boolean`); any `if(result.fxConnected)` branch is statically unreachable; TypeScript emits no code for it |

Additionally, `packages/theme-engine/src/theme-analytics.ts` returns `connected: false` and
`implemented: false` for every metric field and every event emission point respectively
(lines 174–255). These are not mutable booleans — they are typed `false` at the interface level.

Fabrication check (from AD certification): grep of `packages/theme-engine/src/` for LLM
provider imports (`openai`, `anthropic`, `@ai-sdk`, `langchain`, `ChatCompletion`,
`generateText`, `streamText`) returns **zero hits** in production code. The `packages/theme-engine/package.json`
carries no LLM provider dependency.

---

## 4. Detailed seam entries

---

### NC-01 — Liquid canary flag (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED`)

**Owning phases:** All phases M → AC (ARB-gated; introduced in the B→L program)  
**Category:** Feature flag / canary gate  
**Status:** NOT-CONNECTED (global default OFF)

#### 4.1.1 What the flag controls

`THEME_LIQUID_RENDERING_DEFAULT_ENABLED` governs whether the Liquid render path is active
by default for all stores. When `false`, `resolveThemeLiquidRenderingEnabled` returns `false`
for any store that has not opted in via the per-store canary mechanism. Liquid template
rendering therefore falls back to the React composition engine for every store that has not
explicitly been enrolled.

The per-store canary opt-in path (`resolveThemeLiquidRenderingEnabled` with a store-specific
override) is wired and functional. The global default is the only NOT-CONNECTED element.

#### 4.1.2 Exact source location

```
packages/theme-engine/src/theme-governance.ts:14
export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;
```

Confirmed by:
- `node scripts/validators/theme-governance-validator.mjs` output: `Liquid default OFF`
- `git diff 9186188e..83d61e0a -- packages/theme-engine/src/theme-governance.ts` returns
  **0 lines changed** on this constant across the entire M→AC program window

#### 4.1.3 What is missing

No missing piece in code — the flag is set to `false` by explicit design. The missing piece is
an **ARB approval** to flip the value to `true`, which would be a non-additive configuration
change affecting all stores not individually overridden.

| Missing piece | Exact location |
|---------------|---------------|
| ARB approval + commit changing line 14 to `true` | `packages/theme-engine/src/theme-governance.ts:14` |

#### 4.1.4 Why disconnected by design

The B→L discovery program (commit `29f87115`) confirmed that Liquid rendering was approximately
55% merchant-ready with 7 ARB-gate blockers outstanding. The canary flag preserves the React
fallback as the safe default while the Liquid path matures. Per `PROGRAM_STATE.md` baseline:
`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false (theme-governance.ts:14). Frozen apps confirmed
frozen.` This certification does not flip the flag and does not authorize anyone else to do so
without ARB sign-off.

#### 4.1.5 Closure criteria for AE

1. All 7 ARB-gate blockers (documented in `docs/storefront-liquid-discovery/`) resolved with
   evidence.
2. ARB formal approval recorded in the program ADR.
3. A single-line commit changing `THEME_LIQUID_RENDERING_DEFAULT_ENABLED` from `false` to
   `true` in `packages/theme-engine/src/theme-governance.ts:14`.
4. All 1695 theme-engine tests and 915 storefront-runtime tests continue to pass after the flip.
5. `theme-governance-validator.mjs` reports `Liquid default ON`.

---

### NC-02 — Metafield render resolution

**Owning phase:** W (Dynamic sources + custom data)  
**Category:** Storefront render pipeline / data hydration  
**Status:** NOT-CONNECTED

#### 4.2.1 What the seam controls

Merchants can bind section fields to `metafield` dynamic sources in the theme editor. When a
storefront page renders and a section field carries a `MetafieldBinding` descriptor, the
renderer must resolve the live metafield value from the store's `store_metafield_definitions`
and `store_metafield_values` tables via a hydration service and inject the resolved value into
the `SiteDrops` context before Liquid rendering begins.

Resource bindings (product, collection, page, blog, menu) **are** connected via
`GET /v1/themes/resource-search` (authenticated, `verifySiteOwnership` at line 292 of
`services/api-gateway/src/routes/themes.ts`). Metafield bindings are the only
`DynamicSourceDescriptor` type that falls back unconditionally.

#### 4.2.2 Exact source location

```
packages/theme-engine/src/dynamic-source-binding.ts:81-99
  // NOT-CONNECTED in Phase W. ...
  // Exact missing piece: apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts

packages/theme-engine/src/dynamic-source-binding.ts:242-247
  case 'metafield':
    // NOT-CONNECTED in Phase W.
    // Exact missing piece: apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts
    return descriptor.fallback ?? null;
```

Confirmed: `ls apps/storefront-runtime/src/lib/theme-engine/` returns no `metafield-service.ts`
entry. Present files are: `composition-engine.tsx`, `content-route.ts`, `data-binding-engine.ts`,
`editor-preview-section-frame.tsx`, `liquid-hydration-islands.tsx`, `product-route.ts`,
`renderer-registry.tsx`, `template-resolver.ts`, `types.ts`.

#### 4.2.3 What is missing

| Missing piece | Target path |
|---------------|-------------|
| Metafield hydration service | `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` |
| `SiteDrops.metafieldsById` injection | Caller in storefront-runtime render path |
| Gateway route (already exists) | `GET /v1/stores/:storeId/metafields` (confirm tenancy guard) |

The metafield API routes and tables exist in the gateway (`store_metafield_definitions` +
`store_metafield_values`, all tenant-safe). The missing piece is the storefront-side hydration
service that fetches values at render time and injects them into `SiteDrops` so that the
`resolveDynamicSourceDescriptors` case at line 242 can read `SiteDrops.metafieldsById[key]`
instead of returning the fallback.

#### 4.2.4 Why disconnected by design

Phase W was scoped to the dynamic-source binding model and the resource-search gateway route.
The metafield hydration service was explicitly deferred to prevent Phase W from taking on
storefront-runtime render-path work (a separate lane requiring different testing guarantees).
The fallback mechanism ensures no fabrication: merchants see a placeholder value, not a
silently wrong value or a crash.

#### 4.2.5 Closure criteria for AE

1. `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` created with
   tenant-scoped fetch via `GET /v1/stores/:storeId/metafields`, RLS-enforced.
2. `ThemeRendererInput` or `SiteDrops` extended to carry `metafieldsById: Record<string, unknown>`.
3. `resolveDynamicSourceDescriptors` case `'metafield'` updated to read from the hydration bag.
4. Cross-tenant isolation test: store A metafields must never appear in store B render.
5. All existing 1695 theme-engine tests continue to pass; new metafield hydration tests added.

---

### NC-03 — Live FX rate feed for currency display

**Owning phases:** W (introduced) / Z (confirmed, formalized)  
**Category:** Commerce data — currency conversion  
**Status:** NOT-CONNECTED

#### 4.3.1 What the seam controls

`formatThemeCurrencyDisplay` in `packages/theme-engine/src/theme-locale.ts` formats a monetary
amount for display in the storefront. For INR (`currency === 'INR'`) with `en-IN` locale, the
output is byte-identical to `formatLiquidMoney` (the canonical ledger formatter). For all
non-INR currencies, the function returns a display-only formatted string with
`fxConnected: false` and a non-empty `fxNotConnectedReason`, making no attempt at currency
conversion because no live FX rate source is wired.

This is a display-layer function only. It does not touch the canonical money ledger or any
payment RPC. The INR path is production-correct; the non-INR path is presentational only
and is clearly documented as NOT-CONNECTED.

#### 4.3.2 Exact source location

```
packages/theme-engine/src/theme-locale.ts:256-270
  const FX_NOT_CONNECTED_REASON = '...';
  export interface ThemeCurrencyDisplayResult {
    ...
    fxConnected: false;   // literal type — statically unreachable if-branch on true
    fxNotConnectedReason?: string;
  }

packages/theme-engine/src/theme-locale.ts:321-334
  // Non-INR: display-only, NOT-CONNECTED (no FX conversion applied).
  return {
    ...
    fxConnected: false,
    fxNotConnectedReason: FX_NOT_CONNECTED_REASON,
  };
```

Fabrication cross-check: `docs/storefront-theme-platform/phase-z/PHASE_Z_REPORT.md §4.2`
records zero occurrences of `exchangeRate`, `exchange_rate`, or `convertCurrency` in any
non-LCIS source file. No mock exchange rate is hard-coded anywhere in the theme-engine source.

#### 4.3.3 What is missing

| Missing piece | Notes |
|---------------|-------|
| Server-side FX rate source | Options: `sites.currency` + a rates table; Razorpay FX endpoint; or a third-party feed |
| Display-only conversion helper | Must never use converted amounts in the canonical ledger; display only |
| Env var / credentials | None defined; no `FX_API_KEY` or similar anywhere in the codebase |

#### 4.3.4 Why disconnected by design

LetBuyy is India-first. All canonical money amounts are stored and processed in INR (minor
units, `bigint`). The canonical ledger RPCs (`create_checkout_order`,
`confirm_order_payment_with_ledger`, etc.) do not accept or emit non-INR amounts. Currency
display in non-INR is a storefront presentation concern only and was explicitly deferred until
a multi-currency business requirement is approved. Using a live FX rate for display-only
output without ARB review risks implying price accuracy the platform does not guarantee.

#### 4.3.5 Closure criteria for AE

1. ARB approval for multi-currency display (not ledger conversion).
2. FX rate source selected (rate table in DB or third-party API).
3. `formatThemeCurrencyDisplay` updated to read from the rate source and return
   `fxConnected: true` for supported non-INR currencies.
4. The field type for `fxConnected` widened from literal `false` to `boolean` only after
   a connected path exists.
5. INR + en-IN byte-identity invariant preserved (Phase Z tests Z-C01..Z-C04).

---

### NC-04 — Live app-block content runtime

**Owning phase:** Y (Theme app extensions)  
**Category:** App extensions / marketplace integration  
**Status:** NOT-CONNECTED

#### 4.4.1 What the seam controls

App blocks allow third-party marketplace apps to inject dynamic content sections into a
merchant's theme. The structural model is complete: `AppBlockDefinition`, `AppBlockInstance`,
settings schema, `AppBlockEntry` type, and `buildLiquidAppBlocks` exist in
`packages/theme-engine/src/app-block-model.ts`. However, `buildLiquidAppBlocks` returns
placeholder HTML for every block because no live app registry, sandboxed iframe host, or
app-block content gateway endpoint exists.

#### 4.4.2 Exact source location

```
packages/theme-engine/src/app-block-model.ts:77
  // NOT-CONNECTED (see APP_BLOCK_NOT_CONNECTED_REASON)
  // When the runtime is absent the function returns placeholder HTML.

packages/theme-engine/src/app-block-model.ts:309-310
  export const APP_BLOCK_NOT_CONNECTED_REASON =
    'NOT-CONNECTED: no live app runtime produces app-block HTML. '
    + 'apps/app-marketplace is FROZEN (CLAUDE.md). '
    + 'Missing: live app registry API + sandboxed iframe host + gateway endpoint.';
```

`CLAUDE.md` (canonical source of truth, supreme authority): `apps/app-marketplace` is
identified as frozen / pending consolidation, not a production deploy target. The freeze
was in effect before Phase Y and was not changed by Phase Y.

#### 4.4.3 What is missing

| Missing piece | Scope |
|---------------|-------|
| Live app registry API | A new service or gateway domain exposing approved app manifests |
| Sandboxed iframe host | Isolated render host for third-party app-block HTML (CSP + postMessage protocol) |
| Gateway endpoint | `GET /v1/apps/blocks/:appId/render` or equivalent, tenant-scoped |
| `apps/app-marketplace` unfreeze | Requires human-approved scope change per `CLAUDE.md` |

#### 4.4.4 Why disconnected by design

`apps/app-marketplace` is explicitly frozen by `CLAUDE.md` as "frozen or pending consolidation,
not a production deploy target". Phase Y was scoped to the structural model and the merchant
editor surface (so app blocks can be placed in the editor schema and visually represented) while
being honest that no live runtime exists. Providing placeholder HTML is preferable to either
crashing or fabricating app content.

#### 4.4.5 Closure criteria for AE

1. `apps/app-marketplace` unfreeze formally approved and recorded (CLAUDE.md update + ARB).
2. App registry gateway route implemented, tenant-scoped, with RLS.
3. Sandboxed iframe host deployed with CSP `frame-src` restricted to the host origin.
4. `buildLiquidAppBlocks` updated to call the registry endpoint and return real HTML.
5. `APP_BLOCK_NOT_CONNECTED_REASON` constant removed or updated to `CONNECTED`.
6. Cross-tenant isolation test: store A app blocks must not appear in store B render.

---

### NC-05 — Custom CSS render-path call site

**Owning phase:** AA (Custom CSS + code workspace); confirmed open in AB  
**Category:** Render pipeline — CSS injection  
**Status:** NOT-CONNECTED

#### 4.5.1 What the seam controls

Phase AA delivered three layers of merchant CSS handling:
1. **Validation and scoping** (`validateAndScopeCustomCss` in `packages/theme-engine/src/custom-css-sanitizer.ts`) — CONNECTED; blocks 22 injection vector classes.
2. **Merchant editor UI** (`CustomCssWorkspace.tsx`) — CONNECTED; inline validation before save.
3. **Server-side proxy guard** (`apps/merchant-control-plane/src/app/api/stores/[store]/settings/route.ts`) — CONNECTED; PATCH returns HTTP 422 with `violations[]` on invalid CSS.
4. **Render-path injection** — NOT-CONNECTED.

The `buildLiquidThemeHeadAssets` function in `packages/theme-engine/src/theme-renderer.ts` was
extended in Phase AA to accept an optional second parameter `rawCustomCss?: string`.
The call site at line 585 of the same file was **not updated** — it passes only `bundle`,
leaving the `rawCustomCss` parameter absent. Additionally, `ThemeRendererInput` has no
`rawCustomCss?: string` field, so the composition layer has no mechanism to pass the
DB-fetched `site_settings.custom_css` value to the renderer even if wired.

#### 4.5.2 Exact source location

```
packages/theme-engine/src/theme-renderer.ts:585
  const themeHeadAssets = buildLiquidThemeHeadAssets(bundle);
  //                                                         ^^^
  //   rawCustomCss second parameter is absent.
  //   This call is NOT updated in Phase AA or AB.

packages/theme-engine/src/theme-renderer.ts:128-136
  export interface ThemeRendererInput extends StorefrontCompositionInput {
    orchestrator?: ...;
    injections?: ...;
    liquidBundle?: ...;
    liquidTemplateKey?: ...;
    liquidContext?: ...;
    liquidAppBlocks?: ...;
    liquidAppEmbeds?: ...;
    // rawCustomCss?: string — ABSENT
  }
```

Phase AB `PROGRAM_STATE.md` line 57 explicitly states: `custom_css render path NOT-CONNECTED
(layout.tsx line 585 not wired; Phase AC/AD). THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false
unchanged.`

Phase AB report confirms: `Call site at line 585 is NOT changed in Phase AB — render path
NOT-CONNECTED until Phase AB wires the DB value` and `custom_css render wiring NOT-CONNECTED,
Phase AB did not wire it — out of scope`.

#### 4.5.3 What is missing

Three co-located changes are required as a single atomic unit:

| Step | Change | Location |
|------|--------|----------|
| 1 | Add `rawCustomCss?: string` to `ThemeRendererInput` | `packages/theme-engine/src/theme-renderer.ts:136` (after `liquidAppEmbeds`) |
| 2 | Fetch `site_settings.custom_css` and inject into input | Composition layer in `apps/storefront-runtime`; no env var needed — value is in the DB |
| 3 | Update call site to pass `input.rawCustomCss` | `packages/theme-engine/src/theme-renderer.ts:585` → `buildLiquidThemeHeadAssets(bundle, input.rawCustomCss)` |

#### 4.5.4 Why disconnected by design

Phase AA was explicitly scoped to the sanitizer engine, merchant editor UI, and server-side
guard. Wiring the render-path call site required touching `ThemeRendererInput` (a shared
interface with broad impact) and the storefront-runtime composition layer (a different runtime
boundary). These were deferred to Phase AB/AE to avoid scope creep in the AA change set.
The Phase AA change is fail-closed: an absent second argument produces output byte-identical
to the no-custom-CSS baseline (no regression, no crash).

#### 4.5.5 Closure criteria for AE

1. `rawCustomCss?: string` added to `ThemeRendererInput` interface.
2. Storefront-runtime composition layer fetches `site_settings.custom_css` from the DB
   (tenant-scoped) and injects into `ThemeRendererInput.rawCustomCss`.
3. Call site at `theme-renderer.ts:585` updated to pass `input.rawCustomCss`.
4. Test: storefront render for a store with custom CSS produces `<style>.lb-theme{...}</style>`
   in the `<head>` output.
5. Test: storefront render for a store with no custom CSS remains byte-identical to baseline.
6. CSS injection safety regression test: confirm `validateAndScopeCustomCss` is still called
   (fail-closed behavior preserved).

---

### NC-06 — AI model boundary — NL free-text parsing

**Owning phases:** L (Phase L AI SDK foundations) / AC (AI-assisted customization)  
**Category:** AI / LLM integration  
**Status:** NOT-CONNECTED

#### 4.6.1 What the seam controls

Phase AC delivered a complete deterministic AI theme customization system with no LLM
dependency:

**CONNECTED (deterministic, no LLM required):**
- WCAG 2.1 AA contrast math and color palette generation (`packages/theme-engine/src/ai-color-system.ts`)
- Parametric typography pairing with tone classification (`packages/theme-engine/src/ai-typography.ts`)
- Section ordering heuristics (`packages/theme-engine/src/ai-layout.ts`)
- Accessibility analyzer (WCAG contrast, font size, touch target, motion)
- Bundle optimizer
- All of the above accept a **structured** `ThemeBrief` input (industry enum, primary color hex,
  mood enum, etc.) and emit validated `ThemeDocument` proposals

**NOT-CONNECTED (requires LLM + gateway route):**
- Parsing a merchant's free-text natural-language brief ("make it feel warm and earthy, like
  a farmers' market") into a structured `ThemeBrief` — this is the only step that requires
  a real language model

`proposeThemeCustomization` accepts either a `ThemeBrief` (structured, CONNECTED) or a raw
string (free-text, NOT-CONNECTED). For free-text input it returns `AINotConnectedResult`
unconditionally without any heuristic or keyword NLU attempt.

Sub-seams within this boundary (also NOT-CONNECTED):
- Mapping a merchant's NL mood description ("earthy and warm") to a seed hex color
  (`packages/theme-engine/src/ai-theme-generator.ts:69`)
- Mapping a free-text tone description to a typography tone keyword
  (`packages/theme-engine/src/ai-typography.ts:148`)

#### 4.6.2 Exact source location

```
packages/theme-engine/src/ai-intent-parser.ts:595-602
  // FREE-TEXT — NOT-CONNECTED
  return {
    status: 'NOT_CONNECTED',
    seamDescription: MODEL_BOUNDARY,
    message:
      '[NOT_CONNECTED] Free-text intent understanding requires a real language model ' +
      '(THEME_AI_PROVIDER_API_KEY) and the gateway route POST /v1/theme-ai/parse-brief, ' +
      'neither of which is present. ...',
  };

packages/theme-engine/src/theme-ai-sdk.ts:919-920
  export const MODEL_BOUNDARY = Object.freeze({
    status: 'NOT_CONNECTED' as const,
    ...
  });
```

Gateway confirmation: `ls services/api-gateway/src/routes/themes/` returns `media-library.ts`
and `theme-update-route.ts`. `theme-ai-customization-route.ts` is **absent**.

Merchant proxy confirmation:
`apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/ai-customization/route.ts:85-87`
returns a structured `NOT_CONNECTED` envelope (HTTP 503) with `envVar` and `gatewayRoute`
fields when the gateway route is absent.

#### 4.6.3 What is missing

| Missing piece | Exact location / value |
|---------------|------------------------|
| Gateway route | `POST /v1/theme-ai/parse-brief` (absent from `services/api-gateway/src/routes/themes/`) |
| Env var | `THEME_AI_PROVIDER_API_KEY` (unset; no default; no reference in `.env.example`) |
| LLM provider dependency | Not in `packages/theme-engine/package.json` (confirmed — grep returns 0 hits for `openai`, `anthropic`, `@ai-sdk`, `langchain`) |
| Model selection / provider config | Not defined anywhere in the program |

#### 4.6.4 Why disconnected by design

Phase L established the model boundary explicitly: the deterministic primitives (color,
typography, layout) were designed to deliver merchant value without any LLM dependency, and
the NL→structured-input translation was declared NOT-CONNECTED pending ARB approval of a
specific model provider. This architectural decision:

1. Avoids accidental LLM spend before a provider contract is approved.
2. Ensures the deterministic path is independently testable and auditable.
3. Keeps the latency budget for the deterministic path (no round-trip to an external model).
4. Preserves the fabrication-free invariant: no fake AI responses are generated when the
   model is absent.

Phase AC honored the Phase L boundary. The 61 new AI tests in Phase AC (1695 total) test the
deterministic path only.

#### 4.6.5 Closure criteria for AE

1. ARB approval for a specific LLM provider (provider name, model ID, cost envelope).
2. `THEME_AI_PROVIDER_API_KEY` added to `.env.example` and deployment secret registry.
3. `services/api-gateway/src/routes/themes/theme-ai-customization-route.ts` created;
   mounts at `POST /v1/theme-ai/parse-brief`; calls the approved provider; returns a
   `ThemeBrief` JSON on success.
4. `proposeThemeCustomization` free-text branch updated to call the gateway route instead of
   returning `AINotConnectedResult`.
5. `MODEL_BOUNDARY.status` updated from `'NOT_CONNECTED'` to `'CONNECTED'`.
6. Test: free-text "make it warm and earthy" returns a valid `ThemeBrief` (not an error).
7. Test: provider absent (env var unset) still returns a structured error, never crashes.

---

### NC-07 — Theme analytics event emission and metrics

**Owning phases:** K (versioning / analytics contract) / M → AC (all phases)  
**Category:** Observability / business intelligence  
**Status:** NOT-CONNECTED

#### 4.7.1 What the seam controls

`packages/theme-engine/src/theme-analytics.ts` defines the complete schema and emission-point
registry for 5 theme analytics event types and 4 metric fields. The schema is authoritative
and correct. No emission point is wired.

**Event types (all `implemented: false`):**

| Event | Defined emission point | Implemented |
|-------|------------------------|-------------|
| `theme.installed` | `theme-execution.adapter.ts` — after `theme_releases` upsert | false |
| `theme.updated` | `theme-execution.adapter.ts` — when prior release superseded | false |
| `theme.published` | `marketplace-reviews.ts` — on `release_status → published` | false |
| `theme.uninstalled` | `theme-execution.adapter.ts` — future remove operation (not yet implemented) | false |
| `theme.preview.opened` | `apps/storefront-runtime/src/proxy.ts` — preview render path | false |

**Metric fields (all `connected: false`):**

| Field | Source query | Connected |
|-------|-------------|-----------|
| `installCount` | `SELECT COUNT(*) FROM theme_releases WHERE theme_id = $slug AND is_current = true` | false |
| `activeStores` | `SELECT COUNT(DISTINCT store_id) FROM theme_releases WHERE is_current = true` | false |
| `versionDistribution` | `SELECT release_manifest->>'schema_version', COUNT(*) FROM theme_releases GROUP BY 1` | false |
| `renderEngineMix` | `release_manifest->>'renderer_engine'` cross-referenced with `lb:canary:render` Cloudflare Analytics Engine signal | false |

Source: `packages/theme-engine/src/theme-analytics.ts:174-255`. The `connected: false` and
`implemented: false` fields are typed as literal `false` at the TypeScript interface level
(lines 151, 161, 213), making their NOT-CONNECTED status statically enforced.

#### 4.7.2 Why disconnected by design

Phase K was a planning and contract-definition phase: it established the analytics schema and
pinned the exact emission points so future implementation would have a precise target. The
deliberate choice to not wire emissions in Phase K (or in any subsequent phase through Phase AC)
reflects a conscious sequencing decision: ship the structural platform first, add analytics
instrumentation as a dedicated observability phase. Wiring analytics at each individual phase
would have required touching the gateway adapter in every phase, increasing the blast radius and
merge complexity.

No analytics pipeline, Cloudflare Analytics Engine integration, or DB event table for theme
events exists anywhere in the current codebase.

#### 4.7.3 Closure criteria for AE

1. Analytics sink selected: Cloudflare Analytics Engine (preferred, existing infra) or a DB
   event table.
2. `ThemeAnalyticsEmitter` class or function created in the gateway layer.
3. Each emission point listed in `describeThemeEventEmissionPoints()` wired with a call to the
   emitter.
4. `describeThemeEventEmissionPoints()` updated to return `implemented: true` for each wired
   event.
5. `describeThemeMetrics()` updated to return `connected: true` for each queryable metric.
6. Integration test: install → event emitted → metric query returns count ≥ 1.

---

### SO-01 — Settings dual-shape (flat → grouped canonicalization)

**Owning phase:** G / ARB blocker B-7  
**Category:** Data model / schema  
**Status:** STRUCTURAL-ONLY (mitigated)

#### 4.8.1 What is mitigated and what remains

Phase G shipped `settings-schema-canonical.ts` with `settingsCanonicalizeFlat` and
`settingsCanonicalizeGrouped` utilities. These convert between the DB's flat
`settings_data.current` shape and the editor's 5-group structure.

What is **mitigated**: the shape mismatch is documented, utilities exist, and the publish
path calls canonicalization.

What **remains**: full end-to-end consumption of the canonical utilities across all gateway
handlers and editor paths has not been enforced by a type-level or test-level gate. Ad-hoc
shape assumptions in gateway and editor code that pre-date Phase G have not all been updated.
No migration or validator enforces that every settings read/write uses the canonical path.

#### 4.8.2 Closure criteria for AE

1. All gateway routes reading `settings_data.current` must call `settingsCanonicalizeFlat`
   before using the value.
2. All editor saves must call `settingsCanonicalizeGrouped` before writing to the DB.
3. A linting rule or test verifying no direct `settings_data.current` access bypasses the
   canonical utilities.

---

### SO-02 — Schema migration concrete entries registry

**Owning phase:** G / ARB blocker B-5  
**Category:** Governance / schema migrations  
**Status:** STRUCTURAL-ONLY (mitigated)

#### 4.9.1 What is mitigated and what remains

`applySectionSchemaMigrations` is wired in the gateway publish path
(`theme-execution.adapter.ts`). The migration runner executes correctly.

The migration registry itself is **empty** — no concrete `SchemaMigration` entry has been
authored. This is correct for the current bundle version (no section type has been renamed or
restructured since the migration engine was wired in Phase G). An empty registry means the
runner is a no-op, which is safe.

This becomes a live NOT-CONNECTED concern the moment any section type is renamed, field
restructured, or block type retired: the first concrete migration entry must be authored,
registered, and tested before the bundle version that triggers it is published.

#### 4.9.2 Closure criteria for AE / first structural change

1. When a section type rename or schema break is planned, a `SchemaMigration` entry must be
   authored and registered before the bundle version that includes the breaking change.
2. Migration test: a document using the old type/field must produce the expected new type/field
   after `applySectionSchemaMigrations` runs.

---

## 5. NOT-CONNECTED seam summary (machine-readable table)

The following table is the authoritative flat list for tooling and audit consumers.

| ID | Seam label | Phase introduced | Source file | Source line(s) | Missing env var | Missing route | Missing service/file | Closure target |
|----|-----------|------------------|-------------|-----------------|-----------------|---------------|---------------------|----------------|
| NC-01 | Liquid canary flag | M (B→L) | `packages/theme-engine/src/theme-governance.ts` | 14 | — | — | ARB approval | AE + ARB |
| NC-02 | Metafield render resolution | W | `packages/theme-engine/src/dynamic-source-binding.ts` | 81-99, 242-247 | — | — | `apps/storefront-runtime/src/lib/theme-engine/metafield-service.ts` | AE |
| NC-03 | Live FX rate feed | W / Z | `packages/theme-engine/src/theme-locale.ts` | 256-270, 321-334 | FX_API_KEY (not defined) | — | FX rate source | AE + ARB |
| NC-04 | App-block live content runtime | Y | `packages/theme-engine/src/app-block-model.ts` | 77, 309-310 | — | — | App registry API + iframe host; `apps/app-marketplace` unfreeze | AE + CLAUDE.md update |
| NC-05 | Custom CSS render-path call site | AA / AB | `packages/theme-engine/src/theme-renderer.ts` | 128-136 (field absent), 585 (call site) | — | — | 3-step wiring in ThemeRendererInput + storefront fetch + call-site update | AE |
| NC-06 | AI model boundary — NL free-text | L / AC | `packages/theme-engine/src/ai-intent-parser.ts` + `theme-ai-sdk.ts` | 595-602, 919-920 | `THEME_AI_PROVIDER_API_KEY` | `POST /v1/theme-ai/parse-brief` | LLM provider dependency | AE + ARB |
| NC-07 | Theme analytics event emission | K / M→AC | `packages/theme-engine/src/theme-analytics.ts` | 174-255 | — | — | Analytics sink (Cloudflare Analytics Engine or DB table) + emitter wiring | AE |

---

## 6. Seams confirmed NOT present at HEAD

The following items were investigated during the Phase AD certification but found to be
resolved or not applicable:

| Item | Resolution | Evidence |
|------|-----------|---------|
| B-1 (postMessage key mismatch) | RESOLVED in Phase C (`70a40c2a`) | `StorefrontPreviewBridge` in `apps/storefront-runtime/src/app/preview/storefront-preview-bridge.tsx` bridges `LETBUYY_THEME_EDITOR_SELECTION` via same-origin postMessage. Phase B certification R-10 REFUTED. |
| B-2 (newsletter vs newsletter-signup type split) | RESOLVED in Phases C+D | `PORTABLE_TO_LIQUID_TYPE_OVERRIDES` in `portable-to-liquid.ts:46` maps `newsletter → newsletter-signup` at compile time. |
| B-3 (fonts not wired) | RESOLVED in Phase D (`def512cb`) | `buildGoogleFontsHref` wired in `storefront-runtime` layout; CSP extended. |
| B-4 (linklists absent) | RESOLVED in Phase D (`def512cb`) | `navToLinklists()` converts `StoreModel.navigation` to Shopify-convention `linklists`; wired in `buildLiquidScope`. |
| B-6 (letbuyy-core DB row) | COMMITTED, conditionally resolved | Migration `188_letbuyy_core_theme_row.sql` committed in `40741cb8` (idempotent `INSERT … ON CONFLICT DO NOTHING`). Row absent until migration 188 applied to production DB (`RISK-DATA-001`). |
| Money ledger contact (canonical RPCs) | UNTOUCHED by M→AC | `git diff 9186188e..HEAD` on payments, orders, checkout routes returns 0 lines changed. No theme-engine source calls canonical money RPCs except in test comments. |
| DOMPurify sanitizer config | UNTOUCHED by M→AC | `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` block at `theme-renderer.ts:170-231` byte-identical to Phase M baseline. No `FORBID_ATTR`, `FORBID_TAGS`, `ADD_ATTR`, or `CUSTOM_ELEMENT_HANDLING` lines changed. |
| `publish_theme_release` RPC signature | UNTOUCHED by M→AC | Call at `theme-execution.adapter.ts:699-710` signature (10 parameters) unchanged since Phase P. `p_expected_current_release_version` (ARB-gated follow-up from Phase AB) is NOT present. |

---

## 7. Governance failures that are NOT program regressions

Two gate failures exist at HEAD. Neither was introduced by the M→AC program. Both are
documented here to prevent any future reviewer from interpreting them as program regressions.

| Gate | Failure | Pre-dates program | Evidence |
|------|---------|-------------------|---------|
| `node scripts/validate-governance.mjs` EXIT=1 | Tenant-tables registry drift: `services/api-gateway/src/tenant/tenant-tables.registry.ts` out of sync with schema-derived registry | Yes — present before Phase M baseline (`9186188e`) | `git log 9186188e..HEAD -- services/api-gateway/src/tenant/tenant-tables.registry.ts` returns no commits; no M→AC commit touches this file. Fix: `node scripts/generators/generate-tenant-table-registry.mjs`. Risk: `RISK-GOV-001`. |
| `node scripts/validators/sequential-migration-validator.mjs` EXIT=1 | Migrations 186 (`186_v1_scale_commerce_os_coming_soon.sql`) and 187 (`187_v1_sites_site_settings.sql`) on disk but not committed | Yes — explicitly listed as FOREIGN WIP in `PROGRAM_STATE.md` | `git log -- database/supabase/migrations/186_*.sql` and `187_*.sql` return empty. No M→AC commit added or modified either file. |

The anti-fabrication sub-gate within `validate-governance.mjs` **passes** (1319 active source
files, 0 temporary entries).

---

## 8. How this register relates to other documents

| Document | Relationship |
|----------|-------------|
| `docs/storefront-theme-platform/phase-ad/PHASE_AD_CERTIFICATION.md` | Parent certification document; references this register in §4 (honesty seams) |
| `docs/storefront-theme-platform/RISK_REGISTER.md` | Records open technical risks (TOCTOU gaps, RLS gaps, non-atomic plan limits); NOT-CONNECTED seams above are distinct from risks — a seam is a documented absence, not a vulnerability |
| `docs/storefront-theme-platform/PROGRAM_STATE.md` | Program scoreboard; confirms phase gate baselines; `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false` entry at line 32 |
| `docs/storefront-liquid-discovery/` | 12 documents from the 2026-07-04 Liquid discovery; records the 7 ARB-gate blockers that explain why NC-01 (canary flag) remains off |
| `CLAUDE.md` (supreme law) | Confirms `apps/app-marketplace` is frozen (NC-04); confirms canonical money RPCs are the only permitted ledger mutation path (unchanged by M→AC) |

---

## 9. Certification attestation

This register was produced by the Phase AD certification sub-agent (read-only; no source edits;
no git operations) from direct file reads of the repository at HEAD `83d61e0a` on 2026-07-11.

Every NOT-CONNECTED claim is grounded in at least one of:
- A direct `Read` tool inspection of the cited source file and line
- A Bash `grep` or `ls` command confirming presence/absence of a file, route, or constant
- A `git diff` or `git log` command confirming that no M→AC commit touched the cited location
- A validator execution result recorded in the certification input data

No seam has been invented. No connected seam has been misclassified as disconnected.
The register is complete to the best of the certification agent's knowledge at the time of
issue; any seam introduced in a subsequent phase (AE and beyond) must be appended or
superseded by a new version of this document.

**Anti-green-washing enforcement:** any team member, automation, or external communication
that describes an item from section 2 of this register as "connected", "live", "integrated",
or "functional" before its closure criteria are satisfied is in violation of the LetBuyy honesty
contract (`CLAUDE.md` — "Every live value is real-source or NOT-CONNECTED + exact source,
never fabricated").
