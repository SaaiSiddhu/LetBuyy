# Theme Review System Audit (Phase 10)

Two distinct meanings of "review" matter here: **(A) customer star reviews** of a theme, and **(B) the approval/QA review** a submitted theme passes before listing. LetBuyy's marketplace has **neither** in any merchant- or developer-facing form.

## A. Customer reviews & ratings — absent

- A `ThemeReview` model is fully specified: `rating`, `title`, `content`, `is_verified_purchase`, `status: published|pending|rejected`, `user_name`, `user_avatar` (`packages/theme-engine/src/index.ts:1021-1033`).
- **No themes API lists or accepts reviews.** The themes resource exposes `listCatalog/get/schema/categories/industries/purchases/installations/install/purchase/verifyPurchase/uploadPackage/editor/saveDraft/deleteDraft/publish/previewSession/releases/rollbackRelease` (`api-client:1462-1495`) — there is no `reviews`/`createReview` for themes.
- **No UI** renders a reviews list or a "write a review" form. The detail page shows a "Marketplace proof" card with a bare `review_count` and `install_count` and a rating number — but no review content (`[slug]/page.tsx:515-543`).
- The only review-ish code, `ThemeService.getThemeReviews`, scans the **buyer's own purchase records** and returns reviews embedded on the purchased theme object (`theme-service.ts:91-100`) — meaning you could only ever "see reviews" for a theme you already bought, and only if the gateway happened to embed them. It is not a review system; it's a vestige.

**Consequence:** ratings shown on cards/detail are unanchored numbers. With the catalog unseeded they're 0.0 / (0). There is no verified-purchase trust signal, no moderation, no developer reply path.

## B. Theme approval / QA review — not surfaced

- Submission is a raw JSON upload (`theme-upload-panel.tsx` → `POST /themes/packages/upload`). The marketplace shows **no** approval status, queue position, QA result, or rejection reason to the uploader.
- The theme engine validates **structure and safety of the JSON** (schema conformance, disallowed keys like `__proto__`/`on*`/`script`, unsafe URL protocols, size/array/section caps) (`theme-engine/src/index.ts:248-299,463-545,695-732`). That is input sanitization, not a marketplace review.
- A genuine operations review queue exists but lives **outside** the marketplace: `MarketplaceReviewRecord`/`MarketplaceReviewStatus` and `/operations/marketplace-reviews` + `/operations/marketplace-reviews/{id}/decision` (`api-client:390-416,1179-1182`) — i.e., an internal platform-operations function, with no developer-facing submission/feedback loop in `apps/theme-marketplace`.

## How malicious / low-quality themes are prevented today
- **Prevented (partial):** structural/JS-injection vectors in the bundle JSON are blocked by `validateSafeThemeJson` and field validators (`theme-engine:248-299`). Unsafe URL schemes (`javascript:`, `data:text/html`) and event-handler keys are rejected.
- **Not prevented / not visible:** no human review surfaced, no malware/asset scanning beyond JSON shape, no performance/accessibility gating, no author identity/verification, no anti-piracy, no rate-limiting on the public upload route (`api/themes/route.ts:43-64`), and no developer agreement gate.

## Shopify contrast (verified)
- **5-stage manual review** by Shopify's theme review team; rejection or "changes requested" via email.
- Code-origin rules: must build on Shopify's **Skeleton** theme or be **fully original**; Dawn/Horizon-derived themes ineligible for new listings.
- Structured listing requirements (presets, `/listings` folder, industry + catalog-size tagging) and ongoing update/resubmission obligations.
- Customer **star ratings + written reviews** per listing as a first-class trust signal.

## Verdict
- Quality enforcement = JSON sanitization only. There is no marketplace-grade review (human QA, performance/a11y bars, malware/asset scanning, author vetting) and no customer-review trust layer.
- For a store that takes real payments, the absence of (a) verified-purchase reviews and (b) a transparent, developer-facing approval pipeline is disqualifying for "marketplace" status.

## Minimum to reach credibility
1. **Customer reviews:** add `themes.reviews` (list) + `createReview` (verified-purchase gated) endpoints, a moderation status, a detail-page reviews section, and a developer reply path.
2. **Approval pipeline:** a developer-facing submission with explicit states (submitted → in review → changes requested → approved/rejected), written feedback, and published acceptance criteria.
3. **Safety:** asset/malware scanning, rate-limiting + auth hardening on the upload route, a developer agreement gate, and author verification.
