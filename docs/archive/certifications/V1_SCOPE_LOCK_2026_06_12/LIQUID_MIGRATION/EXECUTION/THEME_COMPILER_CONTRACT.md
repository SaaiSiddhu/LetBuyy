# THEME_COMPILER_CONTRACT.md

**Status:** FROZEN CONTRACT · **Program:** Full Liquid V1 (Phase L3) · **HEAD:** `140a73db` · code-cited. Freezes the scope of the portable→Liquid compiler so it can never grow into a runtime.

## Decision (frozen)

> The Theme Compiler is a **pure, build-time, in-process function** that transforms a **portable theme template (JSON)** into a **`LiquidThemePackageBundle`**. It is a *translator*, not a *runtime*. Its output MUST pass `LiquidThemePackageBundleSchema` (strict) and `ThemeLiquidSourceSchema` (forbidden-fragment guard). It MUST NOT execute, fetch, or embed anything.

```
Portable Theme (template_config JSON)
        ↓   compilePortableToLiquidBundle()   [pure, build/publish-time, in-process]
Liquid Bundle (layout + sections/*.liquid + {% schema %} + templates map)
        ↓   LiquidThemePackageBundleSchema (strict) + ThemeLiquidSourceSchema (forbidden fragments)
Persisted to themes.default_template / sites.template_config (existing adapters)
```

## Inputs

- A single store's **portable `templateConfig`** (the editor's existing `buildDraftConfig` output: `templates[key].sections`, `order`, `settings_data.current`) — `editor/page.tsx:581-618`.
- The built-in section catalog + schemas (`theme-registry.ts`, `built-in-section-schemas.ts`) as the translation source of truth.
- The CSS class contract (the `lb-*` classes from L2) the emitted sections reference.

## Outputs

- A `LiquidThemePackageBundle`: `{ layout: 'layout/theme.liquid', templates: {...}, sections: {type → .liquid source with {% schema %}}, blocks, renderer.engine:'liquid', renderer.assets }` satisfying `LiquidThemePackageBundleSchema` (`theme-bundle.ts:429-502`).
- Deterministic: identical input → byte-identical bundle (for caching/parity diffing).

## Compilation pipeline

1. Map each portable section `type` → a Liquid section file (`sections/<type>.liquid`) with a `{% schema %}` JSON block derived from the registry schema.
2. Translate settings/blocks into Liquid `section.settings`/`block.settings` references (escaped via setting types, never raw).
3. Emit the `templates` map (index/product/collection/cart/customers/order/page/search/404) referencing the sections.
4. Emit the `layout/theme.liquid` (with the L2 `:root` token block + stylesheet `<link>`).
5. Validate the whole bundle against `LiquidThemePackageBundleSchema`; reject on any violation.

## Allowed capabilities

- Pure data transformation (JSON → Liquid strings).
- Reading the static registry/schema catalog.
- Emitting Liquid control flow already supported by the renderer (`{% for %}`, `{% if %}`, `{{ ... | filter }}`, `{% schema %}`).
- Running at **build/publish time** only (editor publish, seed build) — never at storefront request time.

## Forbidden capabilities (the structural guard)

The compiler's OUTPUT is gated by `ThemeLiquidSourceSchema` (`theme-bundle.ts:96-119`), which rejects the fragments `<script`, `</script`, `javascript:`, `data:text/html`, `{% include`, `{% layout`, `{% render` and caps bytes (`MAX_LIQUID_TEMPLATE_BYTES`). Therefore the compiler **cannot** emit, and is **forbidden** to become:

- ⛔ a **plugin runtime** — no executable code emission (`<script>` forbidden).
- ⛔ an **extension / app runtime** — no `{% render %}`/`{% include %}` of arbitrary/remote partials.
- ⛔ a **second rendering engine** — output is consumed only by the existing `LiquidRenderer`; the compiler does not render.
- ⛔ a **remote execution / fetch platform** — no network calls; no `javascript:`/`data:` URIs; build-time pure function.
- ⛔ a request-time component — never invoked on the storefront hot path.

## Success criteria

- Round-trip: portable template → compiled bundle → renders the **same sections + settings** as the portable source (golden test per section).
- Output passes `LiquidThemePackageBundleSchema` + `ThemeLiquidSourceSchema` for every section.
- Deterministic + within byte/parse limits.

## Failure criteria (must reject, never silently pass)

- Any forbidden fragment in output → hard reject.
- Any section without a valid `{% schema %}` → reject.
- Non-deterministic output → reject.
- Exceeds `MAX_LIQUID_TEMPLATE_BYTES`/`parseLimit 300000`/`memoryLimit 2_000_000` → reject.

## Security constraints

Output sanitization is double-gated: `ThemeLiquidSourceSchema` at compile/persist time + DOMPurify at render time (`theme-renderer.ts:108-163`, `outputEscape:'escape'`). Merchant-authored strings flow only through `{% schema %}` setting types (escaped), never raw-injected. No compiler input is `eval`'d.

## Performance constraints

Build/publish-time only → zero storefront-request latency. Compile bounded (cap time + output size). The compiled bundle adds to `template_config` read (ISR `revalidate=60`) — must stay within renderer limits.

## Tenancy constraints

Operates on exactly one store's `template_config`; output written via the existing tenant-scoped publish adapter (`theme-execution.adapter.ts`) to `themes`/`theme_releases`/`sites` (all RLS ENABLE). No cross-tenant read/write.

## Identity constraints

Invoked behind the **merchant** session (ES256, `identity-platform` sole issuer) in the editor publish path; no customer involvement; adds no issuer.

## Money constraints

N/A — the compiler never touches the ledger, checkout, or payment. It cannot emit a payment form (forbidden fragments) and cannot alter the §234 checkout handoff.

## Frozen statement

The Theme Compiler is a **bounded translator**. Any proposal to give it execution, fetch, plugin, extension, app, or second-renderer capability is a **constitutional conflict** (ART-04 one-system-per-domain; the frozen Wasm/extension seams) and must STOP for ARB. This contract is frozen for the Liquid Completion Era.
