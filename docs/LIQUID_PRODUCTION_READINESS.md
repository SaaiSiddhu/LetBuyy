# Liquid Production Readiness — Phase 8

> Mission Phase 8. Synthesizes Phases 1–7. **Evidence-only.** Verdict drives Phase 10 certification.

## The 7 questions

### 1. Can Urban Kicks run entirely on Liquid?
**No — not correctly yet.** The bundle *covers* the live routes (index/product/collection templates + 33 sections, schema-valid, 56/56 unit tests green), but end-to-end rendering is broken by the **chrome composition defect** (Phase 2 §3.1: a full Liquid `<!doctype html>` document injected into the React shell → discarded `<head>` + duplicate footer), and key commerce interactions are unwired (variant switching, grid add-to-cart — Phase 5). Body content renders; chrome and several interactions do not.

### 2. What routes still depend on React?
- **All chrome** — `layout.tsx` renders header/footer via the React registry **unconditionally** (no engine check), even in Liquid mode (Phase 2 §3.1).
- **Cart** — React `CartProvider` + client island; no themed cart route (Phase 2).
- **Customer / auth / account** — React; the bundle's `customers/*` + `search` + `cart` templates (9 of 12) have **no themed route** (Phase 2 §3.2).
- Net: React remains authoritative for chrome, cart, auth, and every surface except the index/product/collection **bodies**.

### 3. What blocks full activation?
1. Chrome composition defect (§3.1) — **HIGH**.
2. Hydration coverage: variant picker + grid add-to-cart not emitted; wishlist/filters/in-cart-qty absent (Phase 5) — **HIGH** for commerce.
3. Collection metadata binding degraded in Liquid (Phase 4) — **MED**.
4. 9/12 bundle templates unreachable (Phase 2 §3.2) — **MED**.
5. Parity never run (Phase 6) — **gate**.
6. `theme_renderer_manifests` vs `release_manifest` source-of-truth duplication (Phase 7) — **MED** (desync risk).

### 4. What must be fixed before canary?
- Fix §3.1 chrome composition (branch `layout.tsx` on `rendererEngine`, or render body-only when embedded).
- Emit `lb-variant-picker` + grid `lb-add-to-cart`; wire the header cart toggle (Phase 5).
- Fix collection metadata binding (`buildLiquidCommerceContext` should read `SectionRenderData.collection`).
- Then run Phase 6 parity green for index/product/collection on staging.

### 5. What must be fixed before production?
Everything in #4, **plus**: performance-budget evidence (**not measured**); full SSTI/XSS security sign-off by ARB (unit sanitizer tests pass — DOMPurify preserves hydration, merchant settings auto-escaped — but the platform-wide flip is ARB-gated); monitoring ingestion of `lb:canary:render` (emitted, ingestion **unverified**); a decision on wishlist/filters and on the unreachable `cart`/`search`/`customers` templates; resolve the manifest source-of-truth.

### 6. What rollback path exists?
- **Config flip, no deploy:** set `liquidRenderingCanary` false/absent in the store/theme release manifest → instant React (Phase 1/7).
- **Automatic render-time fallback:** any Liquid render failure (`status !== 'rendered'`) silently falls back to the React registry (`composition-engine.tsx:366`).
Both are real and already in place.

### 7. What monitoring exists?
- `lb:canary:render` structured log per render — `{ engine, subdomain, template, route_type, latency_ms, editor_mode }` (`composition-engine.tsx:386`). **Whether a pipeline ingests it is NOT verified.**
- `performance_budget` jsonb exists on `theme_renderer_manifests` but is **not enforced** by the runtime (Phase 7).
- No other Liquid-specific telemetry.

## Readiness summary

| Dimension | State |
|-----------|-------|
| Engine / compiler / sanitizer (unit) | ✅ green (56/56) |
| Bundle validity + breadth | ✅ valid, 12 templates / 33 sections |
| Runtime render integration | 🔴 defective (chrome §3.1) |
| Hydration coverage | 🟡 partial (search/PDP add-to-cart only) |
| Data binding | 🟡 products ✅, collection-meta 🔴, cart/customer client-only |
| Route coverage | 🟡 3/12 templates reachable |
| Parity evidence | ⛔ NOT RUN (env-bound) |
| Perf evidence | ⛔ NOT MEASURED |
| Security (SSTI/XSS) | 🟡 unit-green; ARB sign-off pending |
| Rollback | ✅ config-flip + auto-fallback |
| Monitoring | 🟡 log emitted; ingestion unverified |

**Verdict feeding Phase 10: NOT READY.** Foundation is strong; integration + verification are incomplete.

> **Update 2026-06-15:** blockers #1 (chrome composition), part of #2 (variant + grid add-to-cart hydration), and #3 (collection metadata) are now **fixed and verified** (tests + typechecks green; bundle regenerated). Remaining before canary: a green env-bound Phase 6 parity run, perf-budget evidence, ARB SSTI/XSS sign-off, and the still-open items (wishlist/filters, route coverage for cart/search/customers, manifest source-of-truth).
