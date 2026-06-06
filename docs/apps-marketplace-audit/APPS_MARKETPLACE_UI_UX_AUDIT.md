# Apps Marketplace UI/UX Audit (Phase 5)

Assessed from components, `globals.css` (2,428 lines), and the shared `@letbuyy/ui` design system (no build run). Rates layout, navigation, app cards, listings, detail pages, search, filters, categories, and developer surfaces. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## Page-by-page ratings (1–5)

| Page / surface | Rating | What Shopify does better |
|---|---|---|
| Home / directory (`app/page.tsx`) | 3.5 | Featured rails, recommendations, real collections; LetBuyy is a single filter form + grid |
| App card (`AppCard.tsx`) | 3.5 | Earned badges, recency, richer signals; LetBuyy card is clean but carries a meaningless "Built for LetBuyy" badge |
| App detail (`apps/[slug]/page.tsx`) | 3 | Pricing plan selector, review histogram + replies, data disclosure, working screenshots; LetBuyy has placeholders + partial pricing |
| Search (`search/page.tsx`) | 2 | Working facets + ranked relevance; LetBuyy's pricing/rating facets are dead, icon names render as text |
| Categories (`categories/*`) | 2.5 | Counts, curated category pages, working sort; LetBuyy sort is inert, icon bug present |
| Collections (`collections/[slug]`) | 2 | Genuine curation; LetBuyy collections are re-sorts |
| Developer portal (`developers/page.tsx`) | 3.5 | Comparable marketing page; copy says "6 extension types" (schema has 8) |
| Register (`developers/register`) | 3.5 | Solid 3-step wizard; but Step-1 "Continue" silently no-ops if fields empty (no inline error) |
| Submit app (`developers/apps/new`) | 2.5 | Decorative upload zones, no scopes/webhooks/redirects, icon bug in category select |
| Partner console (`developers/dashboard`) | 3.5 | Good payout/GST/collaborator detail; dead `Pencil` edit; aggregate-only analytics |
| My apps (`my-apps`) | 4 | Best surface: clean grid, confirm-dialog uninstall with data-loss warning |
| Install consent (`AppInstallConsentPanel`) | 3.5 | Clear scope modal; but bypasses real OAuth and omits billing terms |

## Strengths

1. **Design-token discipline on the store side.** Home, cards, and detail use CSS variables (`--lb-color-*`, `--lb-space-*`, `--lb-radius-*`) and shared `@letbuyy/ui` primitives (`Page`, `Card`, `Section`, `EmptyState`, `Modal`, `ConfirmDialog`). Dark mode is handled with a pre-paint script in `layout.tsx`.
2. **Accessibility intent.** `AppCard` has descriptive `aria-label`s (name, category, price, rating); icons are `aria-hidden`; the consent modal is a real `Modal`. StarRating renders accessible values.
3. **Honest states.** Retryable `MarketplaceUnavailable` and explicit empty states instead of fake content.
4. **Install/uninstall** are genuinely well-built (modal consent, success state with embedded launch, confirm-dialog uninstall).

## Weaknesses

1. **Two divergent UI idioms.** Store pages use the design system; developer pages (`dashboard`, `register`, `apps/new`, `developers`) are built with **inline `style={{…}}`** and ad-hoc classes (`dev-portal-cta`, `form-input`). This is inconsistent and harder to theme — dashboard even hardcodes `#16a34a`, `#dc2626`, `#fef2f2` that ignore dark-mode tokens.
2. **Dead controls.** Search pricing/rating facets and category sort do nothing. Controls that look interactive but aren't are a trust and usability failure.
3. **Non-semantic interactive elements.** Search facets are `<div onClick>` not `<button>`/`<a>` — not keyboard-focusable, no roles.
4. **Icon rendering bug** (Material icon name as literal text) on 3 surfaces.
5. **Meaningless badge.** "Built for LetBuyy" on every card dilutes the card's trust hierarchy.
6. **Detail page partial data.** Permanent screenshot placeholders, possible 1970 "Updated" date, reviews count off (first 10 only).
7. **No loading skeletons** on server-rendered pages (only the client search page has them).
8. **No pagination** UI; the grid silently caps at 20–24.

## Navigation

Header (`Header.tsx`): logo, nav (Home/Categories/Collections/Developers/Partner Console), search shortcut, theme toggle, My Apps, Build an app. Clear on desktop. **On mobile it collapses to almost nothing with no replacement** — see [Responsiveness](APPS_RESPONSIVENESS_REPORT.md). Footer is comprehensive (marketplace, developer, LetBuyy columns, docs links).

## Top UI fixes (ranked)

1. Wire or remove dead facets/sort (#9, #57 in master register).
2. Fix the category-icon rendering bug everywhere.
3. Replace the unconditional "Built for LetBuyy" badge with an earned program.
4. Add a mobile menu so navigation survives below 768px.
5. Unify developer pages onto the design system + tokens.
6. Add pagination, skeletons, and fix the reviews-count and 1970-date issues.
