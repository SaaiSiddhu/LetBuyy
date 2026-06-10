# Apps Marketplace UI/UX Audit (Phase 5)

**Parent:** [`../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md`](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md) · **Date:** 2026-06-07

Assessed from source (`apps/app-marketplace/src/**`, `globals.css`); no live render. Ratings are A–F for the *design and interaction quality of what exists*, independent of the empty-catalog problem (which is a content/data issue, covered in Phase 6/8).

## 1. Design system foundation

The app uses Tailwind v4 (`globals.css:1`) but is styled almost entirely with hand-rolled BEM-style semantic classes plus the shared `@letbuyy/ui` package (`@source` import, `globals.css:3`). Brand is purple-first (`--primary: rgb(139 92 246)`), with a full dark-mode override (`.dark`, `globals.css:68-103`) and a flash-prevention script (`layout.tsx:99-116`). Tokens are split: many `--lb-color-*`/`--lb-radius-*`/`--lb-space-*` are defined in the shared package, not locally — workable but a maintenance seam. Typography is **all hardcoded px with no `clamp()`** (no fluid type). **Grade: B−** (coherent and themable; token split + no fluid type are the weak points).

## 2. Per-page ratings

| Page | What's good | What's weak | Grade |
|---|---|---|---|
| **Home / directory** (`page.tsx`) | URL-backed search/category/sort; honest empty state; clean `Page`/`Section`/`Card` structure; `md:`/`xl:` responsive grid | Featured rail gated off; category pills capped at 12; pagination only when not searching (`:296`) | **B** |
| **App detail** (`apps/[slug]/page.tsx`) | Rich, well-organized: hero, preview, pricing, permission review, trust disclosures, reviews+histogram, sidebar consent, related; strong JSON-LD | Screenshot placeholders when empty; disabled "Report" actions; changelog/works-with read fields with no source | **B** |
| **Search** (`search/page.tsx`) | Debounced (300ms), skeletons, retry; faceted sidebar | **14/29 categories hidden**; **rating filter client-only over ≤20 rows**; no pagination | **C+** |
| **Categories index** (`categories/page.tsx`) | Simple grid via `CategoryGrid` | Always renders ≥29 hardcoded items even with empty catalog → every tile dead-ends | **C** |
| **Category detail** (`categories/[slug]`) | Breadcrumb, sort, count, empty state | `notFound()` unless slug is in hardcoded list — live-only categories 404 | **C** |
| **Collections** (`collections/[slug]`) | Breadcrumb, reuses cards | **Fake** (re-sorts catalog); self-incriminating copy; no `/collections` index; 2 of 3 orphaned | **D** |
| **My Apps** (`my-apps/page.tsx` + `InstalledAppsGrid`) | Real list, uninstall confirm with data-loss note, inline review | Extensions config stub; Settings often a disabled button; `🔑` emoji in sign-in state | **C+** |
| **Developer landing** (`developers/page.tsx`) | Clear "Build for LetBuyy", 4-step "How it works" | Static; benefit copy hedges ("pending platform support") | **B−** |
| **Register** (`developers/register/page.tsx`) | 3-step wizard, required consent checkboxes, India GST field | **Drops GSTIN + consent on submit**; weak step-1 validation (silent no-op) | **C−** |
| **Submit app** (`developers/apps/new/page.tsx`) | Real manifest validator, localStorage draft, live preview card | **Dead icon/screenshot upload**; no scope picker; stale `apps.letbuyy.store` slug hint; "Private … (contract-gated)" | **C** |
| **Partner Console** (`developers/dashboard/page.tsx`) | Real metrics (installs/earnings/GST/ratings), payout ledger, listings | "Released" always 0; "Edit unavailable" badge; dev-stores/managed-access mostly empty; no charts | **C+** |
| **Review requirements** (`developers/review-requirements`) | — | Explicit placeholder; `SKIPPED (HUMAN-APPROVAL)` banner; orphan | **D−** |
| **Partner directory** (`partners/page.tsx`) | — | Placeholder shell that prints a flag name; orphan | **F** |
| **Developer profile** (`developers/[slug]`) | — | Placeholder shell that prints a flag name; orphan | **F** |

## 3. Navigation & information architecture

Header (`Header.tsx`): brand, Home, Categories, **Collections→`/collections/staff-picks`** (deep-links one collection, not an index), Developers, Partner Console, center search, My Apps, "Build an app." Mobile nav drawer present. Footer (`Footer.tsx`): Marketplace + Developers + LetBuyy columns. **IA problems:** (1) "Collections" misleads (no index); (2) orphan pages reachable only by URL (`/partners`, `/developers/[slug]`, `/developers/review-requirements`, `trending`/`made-in-india` collections); (3) external doc links (`docs.letbuyy.store/*`) likely dead; (4) stale `letbuyy.store` across footer. **Grade: C.**

## 4. Component quality

- `AppCard` (135 LOC): solid — rating, installs, price, verified/recency badges, accessible labels. **B+**
- `AppInstallConsentPanel` (288 LOC): the best component — modal consent, scope labels+codes, target store, billing note, post-install launch. **A−** (minus the dead `embedUrl` and the OAuth-flag throw).
- `InstalledAppsGrid` (168 LOC): real uninstall with destructive confirm + data-loss copy. **B+**
- `ReviewComposer` (91 LOC): functional rating/title/body submit. **B**
- `ExtensionConfigPanel` (22 LOC): **stub** — toggles a paragraph saying it "requires an approved BFF route." **F**
- `ApiKeyPanel` (75 LOC): rotates key, honest "secret not returned by this backend" fallback. **B**
- `CollaboratorCodePanel` (72 LOC): displays a **dead** code (no persistence/redemption behind it). **D**
- `MarketplaceUnavailable`, `MarketplaceSkeleton`, `StarRating`, `CategoryGrid`: clean, reusable. **B+**

## 5. Interaction states

Loading (skeletons via `loading.tsx` + `MarketplaceSkeleton`), empty (honest, well-written), and error (`MarketplaceUnavailable`) states are **consistently present and a genuine strength** — but retry is wired only on the search page (others are static). Toasts/banners (`marketplace-toast`, `marketplace-banner--*`) are used for success/error across install/uninstall/review. **Grade: B.**

## 6. What Shopify does better / what creates friction / what reduces trust

- **Shopify does better:** discovery substance (real collections, "works with," alternatives), media-rich listings, charge/billing UI, app update flow, and a quality badge with teeth.
- **What creates friction here:** dead-end categories/collections; hidden categories in search; no pagination; stub extension config; dead upload boxes; dropped form fields.
- **What reduces trust:** placeholder pages that leak flag names to users; "Built for LetBuyy" badge with no backing; disabled Report buttons; stale domain; "contract-gated"/"pending approval" copy throughout.

## 7. Verdict

The *interaction design of what's actually built* is **B-grade** — the consent flow, honest states, and detail page are genuinely good. But the surface is dragged to a **C overall** by stub/placeholder components, dead UI, dead-end discovery, and trust-eroding "theater" copy. The fastest UI/UX wins: delete or build the placeholder pages, render all categories, fix the upload boxes and dropped fields, and make "Collections" point at a real index. See [`APP_DISCOVERY_AUDIT.md`](APP_DISCOVERY_AUDIT.md) and [`APPS_CONTENT_GAP_ANALYSIS.md`](APPS_CONTENT_GAP_ANALYSIS.md).
