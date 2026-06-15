# Liquid Compiler Validation — Phase 3

> Mission Phase 3. Verifies `compilePortableToLiquidBundle()` (portable JSON → Liquid bundle). **Evidence-only**; no compiler redesign. Reuses the existing compiler.

## Verdict: PASS

The compiler is a sound, correctly-scoped **translator**. No defects. The `0 snippets / 0 assets` observed in Phase 2 is **by design**, not a compiler failure.

## What `compilePortableToLiquidBundle()` does (`packages/theme-engine/src/portable-to-liquid.ts:92`)

- **Translator only** — explicit contract (`:1-8`): no second renderer, no plugin/remote runtime, no new format.
- `base = createUrbanKicksLiquidThemeBundleFixture()` (`:96`) — reuses the canonical first-party section/block/layout `.liquid` files; the compiler only rewrites `package`, `config.settings_data`, and `templates` (index/header/footer).
- Maps portable section instances → Liquid section types: `resolveLiquidSectionType` (`:62`) via `PORTABLE_TO_LIQUID_TYPE_OVERRIDES` + kebab-case + identity; unmappable types → `warnings` + skip (`:108-112`).
- Sanitizes merchant settings: `plainSettings` (`:73`) drops non-identifier keys (`/^[A-Za-z_][A-Za-z0-9_]*$/`) and non-serializable values; strings stay as `{% schema %}` values, escaped at render (`outputEscape:'escape'`).
- **Re-validates output:** `parseLiquidThemePackageBundle(draft)` (`:165`) — cannot persist an invalid bundle.

## Per-aspect check (the Phase 3 ask)

| Aspect | Result | Evidence |
|--------|--------|----------|
| sections | ✅ mapped; unmappable → warn + skip | `:105-121` |
| snippets | ✅ none — **by design** (base carries none; sections self-contained) | bundle `snippets: none` |
| assets | ✅ none — **by design** (`renderer.assets: {}`; styling via storefront CSS/`--lb-*` tokens injected by `layout.tsx:126`) | bundle `assets: none` |
| schema | ✅ re-validated; can't emit invalid | `:165` |
| settings | ✅ key-sanitized + serialization-safe; escaped at render | `:73-86` |
| dynamic bindings | ⛔ **not the compiler's job** — injected at render via `liquidContext` / `buildSectionDataPlan` (Phase 4) | `composition-engine.tsx:290-325` |

## Notes (non-failures)

- All compiled themes share the **one** canonical first-party Liquid section set (ART-17: no new per-merchant sections); merchants supply settings/templates only. Intentional.
- Editor integration exists: `compilePortableConfigForPublish` → `{ rendererEngine: 'liquid', liquidBundle, layout, schema_version }` patch (`:187`); `liquidBundlePublishWouldDesync` is the L13 guard preventing a portable-only publish from stripping a Liquid bundle (`:177`).
- Test evidence: `liquid-l3-compiler.test.ts` green (part of 56/56 in `pnpm --filter @letbuyy/theme-engine test`).

## Broken integrations to fix

**None in the compiler.** The only cross-cutting defect remains Phase 2 §3.1 (chrome composition) — unrelated to compilation.
