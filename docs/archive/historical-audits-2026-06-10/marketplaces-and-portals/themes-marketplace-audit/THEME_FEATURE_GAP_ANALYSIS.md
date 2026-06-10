# Theme Ecosystem Feature Gap Analysis (Phase 7)

Classification vs. Shopify Theme Store. **CRITICAL** = a real marketplace cannot function/earn trust without it; **IMPORTANT** = expected by serious merchants/developers; **NICE TO HAVE** = competitive polish.

## CRITICAL MISSING

| Feature | Status in `apps/theme-marketplace` | Evidence |
|---|---|---|
| A populated catalog | 1 theme seeded | `seeds/urban-kicks-theme.sql`, `055_only_urban_kicks_theme_catalog.sql` |
| Theme reviews | Type only; no API/UI/submission | `theme-engine:1021-1033`; `theme-service.ts:91-100` |
| Theme ratings (real) | Bare number; unseeded | `theme-card.tsx:108-112`; `[slug]:515-543` |
| Live demo / preview | Disabled; API exists unused | `[slug]:470-512`; `api-client:1490` |
| Working search/filtering | Search + 3 filters inert | `themes/page.tsx:516-521,448-450,364-366`; `navbar.tsx:124-201` |
| Developer submission portal | Upload one JSON file | `theme-upload-panel.tsx` |
| Developer revenue / payouts | None | absent (price fields exist, no UI) |
| Theme review/approval pipeline | Not surfaced | ops queue only `api-client:1179-1182` |
| Legal (Terms/Privacy/Refund/License) | All `#` | `footer.tsx:23-28` |
| Trustworthy receipts/licenses | Placeholder text | `success/page.tsx:36-65` |
| Refund workflow | None; promised in copy | `pricing.tsx:75-77`; `orders.refund` unused |

## IMPORTANT MISSING

| Feature | Status | Evidence |
|---|---|---|
| Theme changelog / release notes | None | absent |
| Version history for merchants | None | absent |
| Theme update action | Badge only, no action | `installations:11-14,54` |
| Rollback after install (in flow) | API exists, unwired here | `api-client:1492-1495` |
| Preview before install (draft) | None; destructive apply | `install:145-147` |
| Developer profiles / portfolios | Plain text author | `theme-card.tsx:122` |
| Theme documentation / setup guides | `#` | `footer.tsx:11-16` |
| Theme support channels | None; "24/7" claimed | `page.tsx:33` |
| Performance metrics (Lighthouse/CWV) | None | absent |
| Accessibility reports | None | absent |
| Compatibility matrix | Text only | `supported_platforms` |
| License tiers UI (single/multi/unlimited) | Modeled only | `theme-engine:1003` |
| Tax / invoicing | "Calculated by provider" | `checkout:472` |
| Email notifications (receipts/updates) | Toggles fake | `settings:86-110` |
| Collections / curation | None | absent |
| Trending / new / popular rows | "Trending"→`/themes` | `navbar.tsx:642` |
| Wishlist / favorites | Decorative | `theme-card.tsx:50-53` |
| Pagination | limit 30, no next | `themes/page.tsx:284` |
| Subscription management | Badge hardcoded "Free" | `dashboard/layout.tsx:54-63` |
| Developer analytics (views→install funnel) | None | absent |
| Anti-abuse / malware scan on uploads | JSON-shape validation only | `theme-engine` validators |
| Author verification / trust badges | None | absent |

## NICE TO HAVE

| Feature | Status |
|---|---|
| Theme bundles / multi-theme purchase | None |
| Gift / transfer license | None |
| Saved searches / alerts | None |
| Cross-platform "buy here vs elsewhere" merchandising | Data exists; shown only if seeded (`[slug]:154-161`) |
| Localization / i18n | Mixed en-US/en-IN |
| "Report a problem" on a theme | None |
| Compare view (side-by-side) | None |
| Editor's picks / staff curation | None |
| Theme preset variants (color/industry presets) | `color_presets` shown if present (`[slug]:421-443`) |

## Capability already in the platform but NOT surfaced by the marketplace
These exist in `@letbuyy/api-client` / theme-engine and would close several gaps quickly:
- `previewSession` → live preview/try-before-buy (`api-client:1490`).
- `editor`, `saveDraft`, `deleteDraft`, `publish` → customize/publish (`api-client:1482-1489`).
- `releases`, `rollbackRelease` → version history + safe rollback (`api-client:1492-1495`).
- `schema` → editable section/settings schema (`api-client:1464`).
- `orders.refund` → refunds (`api-client:1290-1291`).
- `ThemeReview` model → reviews (`theme-engine:1021-1033`) — needs list/create endpoints + UI.

**Implication:** a meaningful share of the CRITICAL/IMPORTANT gaps are *integration* work (wire existing APIs), not greenfield. The two true greenfield builds are (1) the **developer program** (submission/listing/review/payouts/analytics) and (2) the **reviews/ratings** system end-to-end.
