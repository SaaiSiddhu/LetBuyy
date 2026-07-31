# 01 — Products

**Readiness (merchant UI): ~72%.** Backend/gateway + proxy fully wired; the core catalog flow is real.

## Real (evidence)
Create/edit (full payload), variants matrix (3 axes), media upload, SEO fields, status toggle (active/draft), list with tabs/search/sort, bulk publish/draft, CSV import. Gateway GET/POST/PATCH/DELETE + bulk all present; proxy DELETE present.

## Gaps (documented — UI work, needs visual verification)
- **Delete product: no UI button** (backend + proxy DELETE exist + `products.remove()` wired — only the button is missing). HIGH.
- "Archived" not settable from the product form (only from the list row). MEDIUM.
- Bulk delete not exposed in the UI. MEDIUM.
- Per-variant images, single-variant add/remove, product duplication, status-change confirm. LOW (V1-deferrable).

**Verdict:** launch-capable for a V1 catalog; the delete-product button is the notable pre-public gap (pure UI — backend ready).
