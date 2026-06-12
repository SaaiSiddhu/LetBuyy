# Liquid Parity Matrix — Phase E.0 Evidence

**Program:** Document 6 (LIQUID_ACTIVATION_PROGRAM.md) §2
**Status:** SCAFFOLD — all cells PENDING until Phase E.0 staging runs complete
**Corpus rule:** Every cell must pass before a canary stage advances. Any red cell blocks canary.

Rendering snapshots are produced by `scripts/liquid-parity/run-parity-matrix.mjs` against a test merchant fixture on staging.

---

## Matrix

> **Legend:** ✅ PASS | ❌ FAIL | ⏳ PENDING | 🚫 BLOCKED (dependency unresolved)

| Section | Rendering | Data bindings | Editor round-trip | Preview | Checkout handoff | SEO/meta | Performance | Accessibility | Empty/error states | Mobile editor |
|---------|-----------|---------------|-------------------|---------|------------------|----------|-------------|---------------|-------------------|---------------|
| about-section | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| app-block-slot | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| banner-carousel | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| brand-marquee | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| category-grid | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| contact-form | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| cta-section | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| experience-timeline | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| featured-products | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| hero | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| marquee | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| newsletter | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| portfolio-grid | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| product-detail-section | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| product-grid | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| rich-content-section | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| services-grid | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| skills-section | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| testimonials | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |
| trust-badges | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING | ⏳ PENDING |

---

## Dimension Parity Bars

| Dimension | Requirement | Measurement |
|-----------|-------------|-------------|
| **Rendering** | Pixel-tolerant snapshot match on corpus (desktop + mobile viewports) | `compare-snapshots.mjs` HTML structural diff |
| **Data bindings** | Product/collection/cart/customer data surfaces resolve identically | Fixture assertion in `run-parity-matrix.mjs` |
| **Editor round-trip** | Edit → preview → publish → render identical to committed config (CAP-C12) | Manual staging run; output logged to evidence/ |
| **Preview** | Draft preview = published render for same config | Manual staging run |
| **Checkout handoff** | Liquid storefront → checkout session identical params/signing (post-`e2e2d47e`) | Manual staging run; compare session tokens |
| **SEO/meta** | Equivalent `<head>` output (title, og:*, structured data) | `capture-snapshot.mjs --mode head` |
| **Performance** | Liquid p95 render ≤ React p95 × 1.25 | Document 4 monitoring dashboard; `X-Lb-Render-Engine` header buckets |
| **Accessibility** | No regression on existing a11y checks | Staging axe-core run output |
| **Empty/error states** | Section-level fallbacks present for empty product list, missing data | Fixture with empty collections |
| **Mobile editor output** | Renders identically (mobile viewports, theme-editor context) | `capture-snapshot.mjs --viewport mobile` |

---

## Snapshot Corpus

Captured by `scripts/liquid-parity/run-parity-matrix.mjs`. Evidence files written to:

```
LAUNCH_READINESS_2026_06_12/evidence/e-liquid-parity/snapshots/
  react/
    desktop/
      <section-type>.html
    mobile/
      <section-type>.html
  liquid/
    desktop/
      <section-type>.html
    mobile/
      <section-type>.html
  diff/
    <section-type>-desktop.diff
    <section-type>-mobile.diff
```

---

## Canary Stage Gate Summary

| Stage | Traffic scope | Duration | Matrix requirement |
|-------|---------------|----------|--------------------|
| C1 | 1 internal store | 3 days | 0 red cells (all 200 PASS) |
| C2 | 5% sessions on Liquid-opted stores | 4 days | C1 clean + p95/error-rate metrics green |
| C3 | 50% opted stores | 4 days | C2 clean + conversion-proxy within 2% |
| C4 | 100% + default-ON (post-ARB) | 7-day soak | C3 clean + ARB approval row |

ARB default-flip approval is a HUMAN seam (see `SKIPPED_HUMAN_DECISIONS.md`).

---

## Exit Gate G-E1

All 200 matrix cells must be ✅ PASS and snapshot diffs must be clean before promoting to canary C2.
Evidence row is appended to `EXECUTION_LEDGER.md` by the human running Phase E.0.
