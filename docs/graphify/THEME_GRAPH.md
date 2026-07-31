# Phase 10 — Theme Engine Graph

**From `graph.json`: theme-engine package + storefront runtime theme layer.**

## Footprint
| Component | Graph nodes |
|---|---|
| `packages/theme-engine` | 464 |
| `apps/storefront-runtime/src/lib/theme-engine` | 114 |
| `apps/storefront-runtime` total | 910 |
| Cross-runtime edges `storefront-runtime → theme-engine` | **102** |
| Cross-runtime edges `api-gateway → theme-engine` | 77 |

## Structure (graph + code)
- **`packages/theme-engine` (464 nodes)** is the shared renderer: Liquid + JSON composition (`theme-renderer.ts`, `composition-engine.tsx`, `template-resolver.ts`, `theme-bundle.ts`, `theme-governance.ts`), the locked sanitizer, and `theme-registry.ts`.
- **`storefront-runtime` consumes it via 102 edges** — the storefront imports the renderer + section components (`renderer-registry.tsx`). This is the React fast-path renderer (V1 default; `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`).
- **`api-gateway → theme-engine` (77 edges)** — the gateway resolves/persists theme bundles (Liquid bundle persistence migrations 171/172) and serves theme data to the storefront.
- `index.ts` of theme-engine has degree 119 — a well-consumed package entry.

## Renderer / sections / templates / publishing / runtime
- **Renderer:** `renderer-registry.tsx` maps section `type` → component. **Graph-relevant defect (cert LB-8):** there is **no `announcementBar` renderer** though `theme-registry.ts:627–628` injects an `announcementBar` section into the default theme → `UnknownSectionFallback` renders a broken box. The graph shows the registry node and the section injector as separate nodes with no connecting render edge — a *findable* gap if you query `path "announcementBar" "renderer-registry"`.
- **Composition/templates:** `composition-engine.tsx` + `template-resolver.ts` resolve JSON templates → section tree.
- **Publishing/runtime:** theme bundle persistence is SQL (migrations 171/172) → ungraphed; the publish flow's DB tail is invisible (SQL gap again).

## Verdict
The theme engine is a real, well-consumed 464-node package with a 102-edge storefront coupling — a coherent renderer subsystem. The one concrete defect (LB-8 announcement bar) is a **missing edge** in the renderer registry, exactly the kind of gap a `graphify path` query surfaces. Liquid is present but default-off (React is V1) — consistent with ART-17. Theme *publishing* persistence is SQL and therefore outside the graph.
