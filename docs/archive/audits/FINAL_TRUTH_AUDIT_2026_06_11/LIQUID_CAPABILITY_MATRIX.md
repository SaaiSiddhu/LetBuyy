# Liquid Capability Matrix

Date: 2026-06-11

Scope: Phase C repository-side implementation. This matrix does not certify production canary rollout or React deletion.

| Capability | React renderer state | Liquid repository state | Status |
|---|---|---|---|
| Layout document render | React app chrome wraps section output. | `composition-engine.tsx` now consumes `result.liquid.layoutHtml` from the Liquid renderer instead of section-only `contentForLayout`. | DONE repo-side |
| Header/footer chrome | React section groups can render header/footer sections. | Liquid resolver now reads `header` and `footer` templates from the bundle and the Urban Kicks bundle includes those templates and section files. | DONE repo-side |
| Section CSS | React sections use component CSS/Tailwind. | `globals.css` now defines first-party `lb-*` layout, product, form, header, footer, and chrome classes because inline styles are sanitized. | DONE repo-side |
| First-party section corpus | React registry remains frozen. | Portable Liquid section files now include the promoted first-party commerce/chrome sections plus parity sections. | DONE repo-side |
| Section settings fidelity | React sections consume local settings. | Existing Liquid parity sections now consume gallery, autoplay, image, and level settings where previously stubbed. | DONE repo-side |
| Product/collection data binding | React data planner fetches product data for product grids. | Data planner recognizes Liquid product-grid, featured-products, and product-detail section keys and supplies collection/product drops. | DONE repo-side |
| Cart drop | React cart is browser/runtime integrated. | Liquid receives supplied cart projection when present and otherwise exposes an honest `browser_hydrated` empty drop for hydration islands; no server cart is fabricated without a request token. | DONE repo-side |
| App blocks | React app-block slot remains frozen. | Liquid app-block injection remains explicit through first-party app block slots; no third-party snippet runtime was added. | DONE repo-side |
| `t` filter | React copy is component-owned. | Liquid renderer now provides locale dictionary lookup through the `t` filter. | DONE repo-side |
| Snippets `{% render %}` | Not applicable to React sections. | `{% render %}` remains forbidden by `ThemeLiquidSourceSchema`; Phase C records first-party-only scope instead of adding a snippet/runtime surface. | DONE repo-side |
| Web editor draft write | React editor saves template config. | Merchant editor draft route can merge `liquidBundle` and `liquidRenderingCanary` into canonical `template_config`. | DONE repo-side |
| Mobile editor draft write | Mobile editor saves template config. | Mobile `ThemeService.saveLiquidDraft` writes the same `liquidBundle` and `liquidRenderingCanary` fields. | DONE repo-side |
| Preview parity | Preview consumes draft template config. | Existing preview path can now render Liquid when draft config carries `liquidBundle` and `liquidRenderingCanary`. | DONE repo-side |
| Snapshot parity corpus | React snapshots are the reference. | Full React-vs-Liquid snapshot corpus is still required before any React deletion. | BLOCKED: parity proof |
| Production canary | React is default fallback. | Per-theme Liquid canary rollout remains human/live production evidence. | SKIPPED-HUMAN |
| Platform-wide Liquid flip | React default remains frozen. | ARB amendment to the default-OFF validator remains required after 100% parity proof. | SKIPPED-HUMAN |
| React deletion | React section renderer remains frozen. | Forbidden until capability, rendering, snapshot, and editor parity are independently proven at 100%. | BLOCKED: parity proof |

Repository-side parity estimate after this unit: Liquid is locally reachable for first-party bundle rendering, chrome, data binding, and editor draft state. It is not certified as 100% parity because the full snapshot corpus and production canary evidence are intentionally not fabricated.
