<!-- CODEX MISSION PROMPT. Paste this entire file to Codex as the task brief, or point Codex at this path. Single-go, autonomous execution. Scope: rebuild the LetBuyy Apps Marketplace UI/UX to Shopify App Store parity, on top of the V2 foundation. Spec source: docs/apps-marketplace-audit/SHOPIFY_APP_STORE_UIUX_TEARDOWN.md. -->

# CODEX MISSION — LetBuyy Apps Marketplace UI/UX Parity (single-go)

> **You are Codex.** Rebuild **every page and surface** of the LetBuyy Apps Marketplace (`apps/app-marketplace`) to match the **Shopify App Store** structure, information architecture, component anatomy, states, responsiveness, and interaction quality — **branded as LetBuyy** — in a **single autonomous run**. Your blueprint is `docs/apps-marketplace-audit/SHOPIFY_APP_STORE_UIUX_TEARDOWN.md` (the "SPEC"); follow it section-by-section. Build on the already-shipped V2 foundation (real catalog, billing, OAuth, extensions, reviews). Commit as you go, keep the governance validators green, and **never stop for a human**: when a step needs editorial content, design assets, a business decision, a secret, or a production migration apply, do every part you *can* in code, log it `SKIPPED (HUMAN-APPROVAL)` with a precise unblock note, and continue. Read this entire file before writing any code.

This is **the UI/UX foundation phase** — the surface a merchant and developer actually see. Structural parity + LetBuyy brand + truth (no fake data, no dead controls) is the bar.

---

## 0. Non-negotiables (read first)

1. **STRUCTURAL PARITY, LETBUYY BRAND.** Match Shopify **exactly** on layout, grid, IA, page section order, component composition, states, responsive behavior, and motion (SPEC §2–§9). Apply **LetBuyy's own** brand: purple primary (`--lb-color-primary`, not Shopify black/green), LetBuyy logo, **original copy**, LetBuyy imagery, and **"Built for LetBuyy"** (never the literal "Built for Shopify" mark). **IP guardrail:** do **not** paste Shopify's marketing sentences verbatim, and do not reproduce Shopify icons/screenshots/logos — build LetBuyy equivalents with the same UX role. Reusable brand-neutral labels are listed in SPEC §Appendix.
2. **BUILD ON V2, DON'T REDO IT.** The V2 foundation (catalog seed, pricing plans, payouts, OAuth install, extension config, reviews, versions, analytics) is already implemented. Read `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_STATUS.md` first. **Extend** existing pages/components; only **create** what's genuinely missing (see §6 file map — most pages already exist).
3. **TRUTH OVER THEATER.** No fake data, fake metrics, fake reviews, fake editorial, or unconditional badges; no copy that leaks internal state. **Gate every rail/section on real data depth** — if there aren't enough apps for a "Popular" rail or a category subsection, hide it or show an honest empty state. Editorial content you don't have → render the slot with an honest empty/fallback and `SKIPPED` the content, never lorem/fake.
4. **GOVERNANCE IS LAW.** Run `node scripts/validate-governance.mjs` after every wave; it must pass (ignore only the pre-existing, unrelated `apps/theme-marketplace` hardcoded-domain failure documented in V2 status). Obey root + local `AGENTS.md`, single-writer table ownership, route line-count ≤1500 (split modules), single-source helpers, and topology honesty.
5. **NO NEW NEXT API ROUTE FILES.** The marketplace lint rule forbids adding `src/app/api/**/route.ts` files. Wire new data through the **existing BFF multiplexers** by adding `action:` branches: `api/apps/route.ts`, `api/apps/search/route.ts`, `api/apps/[id]/route.ts`, `api/apps/[id]/install/route.ts`, `api/apps/[id]/reviews/route.ts`, `api/developers/route.ts`, `api/developers/apps/route.ts`, `api/developers/register/route.ts`. (This is the exact rule V2 hit repeatedly — honor it from the start.)
6. **USE THE DESIGN SYSTEM, NOT RAW HTML.** Compose from `@letbuyy/ui` primitives (`Button`, `Input`, `Checkbox`, `Modal`, `Drawer`, `Accordion`, `Card`, `Badge`, `Banner`, `FilterBar`, `FilterChips`, `Chart`, `Breadcrumbs`, `MaterialIcon`, `EmptyState`, `Grid`, `Page`, `Navigation`) and `next/image`. **No raw `<input>`/`<img>`/unstyled `<button>`** (lint blocks them). Reuse `@letbuyy/ui/formatting` for INR/date. Shared-package changes are **additive & backwards-compatible**.
7. **GREEN BEFORE DONE.** Every wave ends with `typecheck`, `lint`, `test`, and `build` green for every touched workspace + `validate-governance.mjs`. The Next/Turbopack build may need to run outside the sandbox (V2 documented this) — that's fine; record it.
8. **EVIDENCE OR IT DIDN'T HAPPEN.** Every wave/issue gets a ledger row: files changed, how verified, validator/test result (§5).
9. **NO SCOPE INVENTION.** Implement exactly the SPEC surfaces (SPEC §3–§5) and the component kit (SPEC §4). New in-scope UI defects you find → log `FOUND-###` and fix. Don't refactor unrelated domains.
10. **MIGRATIONS FORWARD-ONLY.** Any new data (feature facets, story bodies, awards, review provenance) = new `database/supabase/migrations/NNN_*.sql` with real RLS, single declared writer; apply **locally**, `SKIPPED` prod apply. Never edit applied migrations.

---

## 1. Mission context — what you are building

The LetBuyy Apps Marketplace is a **Next.js 16 / React 19** app (`apps/app-marketplace`) on a Hono gateway + Supabase, with shared UI in `@letbuyy/ui` and data via `@letbuyy/api-client` `appStore`. Today (post-V2) it is functionally real but visually a thin shell. Shopify's App Store is a **marketing-grade storefront**: curated editorial rails, a rich app card, a deep app-detail page, a faceted browse, and a category mega-menu. Your job is to bring LetBuyy to that bar.

**Authoritative sources you MUST read before writing code:**
- **`docs/apps-marketplace-audit/SHOPIFY_APP_STORE_UIUX_TEARDOWN.md` — THE SPEC.** Every token (§2), global chrome (§3), component (§4), page anatomy (§5), interaction (§6), responsive (§7), a11y (§8), SEO (§9), the LetBuyy gap-map (§10), and the build order + component checklist (§11). **This mission's waves follow SPEC §11.**
- `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_STATUS.md` + `_LEDGER.md` — what V2 already shipped (don't redo).
- `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` — issue numbers referenced in the SPEC gap-map.
- Root `AGENTS.md`, `apps/app-marketplace/AGENTS.md`, `docs/governance/`.

**Current tree (post-V2) — so you EXTEND, not recreate:**
- Pages that already exist: `app/page.tsx`, `(store)/apps/[slug]`, `(store)/categories`, `(store)/categories/[slug]`, `(store)/collections`, `(store)/collections/[slug]`, `(store)/partners`, `(store)/search`, `(auth)/developers/*` (incl. `[slug]`, `docs`, `dashboard`, `register`, `apps/new`, `review-requirements`), `(auth)/my-apps`, `(auth)/moderation/reviews`. **Missing → create:** `(store)/stories` + `(store)/stories/[slug]`, and the faceted `(store)/categories/[slug]/all` server page.
- Components that exist (extend): `AppCard`, `StarRating`, `MarketplaceBreadcrumbs`, `ScreenshotGallery`, `MarketplaceSkeleton`, `MarketplaceUnavailable`, `Header`, `Footer`, `CategoryGrid`, `InstalledAppsGrid`, `AppInstallConsentPanel`, `ReviewComposer`, plus V2 developer/merchant panels.
- `@letbuyy/ui` already exports usable primitives: `FilterBar`, `FilterChips`, `Chart`, `Accordion`, `Drawer`, `Modal`, `Breadcrumbs`, `MaterialIcon`, `Badge`, `Banner`, `Card`, `EmptyState`, `Grid`, `Page`, `Navigation`, `Button`, `Input`, `Checkbox`. Compose from these.

---

## 2. Ownership & lane

Primary surface: **`apps/app-marketplace/**`** (pages, components, `globals.css`, BFF route multiplexers). Plus, **additively**:
- **`packages/typescript/ui/**`** — new shared primitives the SPEC needs that don't exist yet (fluid-type tokens, `Lightbox`, `VideoHero`, `MegaMenu`, `Pagination`, `SectionHeader`, `RatingHistogram`, `StoryCard`, `Testimonial`, `ValueProp`, `PricingTag`, `QualityBadge`) — additive exports only; reuse existing primitives where present.
- **`packages/typescript/api-client` + `shared-types`** — additive methods/DTOs for new UI data (feature facets, story/collection bodies, awards, review provenance, sponsored placements).
- **`services/api-gateway/src/routes/app-store/**`** — additive read endpoints/filters for the above (stay ≤1500 lines/module; split if needed).
- **`database/supabase/migrations/**`** — new forward migrations for new UI-backing data, with real RLS.

Stay in the marketplace lane. Don't touch unrelated domains (storefront/themes/checkout/identity) except minimally where a shared-`@letbuyy/ui` change is genuinely shared, and then additive + backwards-compatible only.

---

## 3. Execution model (single-go, wave-based — follows SPEC §11)

Work top-to-bottom Waves 0→8. Each wave: build per SPEC, run §8 gates, commit per component/page, update the ledger/status. Don't reorder; don't stop between waves.

- **Wave 0** — Tokens & foundations (SPEC §2): fluid type, color/spacing/radius/shadow/motion tokens, breakpoints; baseline green; ledger/status.
- **Wave 1** — Core component kit (SPEC §4): the reusable primitives every page uses.
- **Wave 2** — Home rebuild (SPEC §5.1): curated rails + editorial blocks, gated on real depth.
- **Wave 3** — Category landing (SPEC §5.2): editorial layout, hero, subcategory sections, testimonial, how-tos, sponsored.
- **Wave 4** — Faceted browse + search (SPEC §5.3–5.4): filter rail (programs + feature facets), sort, numbered pagination, row cards, server-side rating filter.
- **Wave 5** — App detail parity (SPEC §5.5): meta-strip, awards, gallery+lightbox, works-with, feature-tag chips, plan cards, rating histogram, "What merchants think", review provenance, demo store, changelog, featured-in, more-like-this.
- **Wave 6** — Stories/collections + partner profile + stories index (SPEC §5.6–5.8).
- **Wave 7** — Responsive + a11y + SEO parity (SPEC §6–§9): mobile-first, fluid type applied, mega-menu/lightbox a11y, title/breadcrumb/structured-data templates.
- **Wave 8** — Verify: full gates, governance, regenerate intelligence, status rollup.

**Commit discipline:** one commit per component/page or tight group; `feat(marketplace-ui): <thing> [waveN]` / `fix(marketplace-ui): …`. After route/page/export/schema changes, regenerate repository intelligence and commit only the generated diffs.

---

## 4. Skip protocol & pre-identified human-approval catalog

```
- <thing> — SKIPPED (HUMAN-APPROVAL)
  Reason: <editorial content / design asset / business decision / secret / prod migration>
  Unblock: <exactly what a human must provide>
  Done anyway: <the slot/structure/fallback you built + how it degrades honestly>
```

**Pre-identified skips (build the structure, skip the human bit):**

| Area | Build now | SKIP (needs human) |
|---|---|---|
| Editorial stories/collections copy & imagery | The story/collection **content type**, pages, index, and admin-fillable slots; honest empty state when none | The actual editorial **content** (marketing/curation team) |
| Category hero video/illustration | The hero **slot** + graceful image/gradient fallback | Final **design assets** (video/illustration) |
| "Built for LetBuyy" program | Render badge **from real award data**; program criteria scaffold | Final program **criteria & sign-off** (already a V2 skip) |
| Sponsored/featured placements | Labeled **slot** + data-driven rendering (reuse V2 featured model) | Sold **inventory/pricing/business rules** |
| "What merchants think" summary | The **slot** + generation hook + honest "no summary yet" | The AI **provider/keys** (or approval to use existing inference) |
| Locale switcher / i18n | The **switcher UI** + i18n scaffold/keys | **Translations** |
| Final brand palette | Keep LetBuyy purple system; map all tokens | Design **sign-off** on exact hex |
| New migrations | Write + **apply locally** | **Prod** apply |
| Real app screenshots/icons for seed apps | Use honest placeholders/first-party assets; label demo | Real partner **media** |

Anything that would break a shared-package API, apply a prod migration, touch secrets, or paste Shopify proprietary content → `SKIPPED`, with the in-code part done.

---

## 5. Ledger & status (create & maintain at repo root)

- `CODEX_APPS_MARKETPLACE_UIUX_LEDGER.md` — one row per component/page:
  `| item | wave | spec § | layers (ui-pkg/app/bff/gw/db) | status (DONE/PARTIAL/SKIPPED) | files | verification |`
- `CODEX_APPS_MARKETPLACE_UIUX_STATUS.md` — rollup after every wave: counts by status, components/pages done vs SPEC §4/§5, open SKIPPED items + unblock notes, new migrations, and the exact gate commands last run + result.

---

## 6. The work, wave by wave

Key: **[extend]** = file exists, modify to spec · **[create]** = new file · **[ui-pkg]** = add to `@letbuyy/ui` (additive). Verify each against SPEC anatomy + states + responsive + a11y.

### Wave 0 — Tokens & foundations (SPEC §2)

First: create the §5 ledger/status; run the §8 baseline; record it.

| Item | Action | Acceptance |
|---|---|---|
| Fluid type scale | [ui-pkg]+[extend `globals.css`] add `clamp()` `display`/`h1`/`h2` tokens (SPEC §2.2) | Hero/section type scales between breakpoints; no fixed-px headings on hero/section titles |
| Color/spacing/radius/shadow tokens | [extend `globals.css`/ui] confirm the SPEC §2.1/§2.3 set exists as `--lb-*`; fill gaps; **keep purple primary** | All marketplace surfaces read tokens; no raw hex in new code |
| Motion + reduced-motion | [extend] standardize 120–160ms hover, 150ms menu, 300ms carousel; honor `prefers-reduced-motion` | Transitions consistent; reduced-motion disables carousel/large motion |
| Breakpoints | [extend] confirm 1280/1024/768/480/360 set (SPEC §7) | One source of breakpoints |
| Token consolidation | [extend] resolve the split `--lb-*` source flagged in audit #70 | One token source of truth documented |

### Wave 1 — Core component kit (SPEC §4)

Build/compose from `@letbuyy/ui`. Each: rest/hover/focus/loading states, responsive, a11y (SPEC §4, §6, §8).

| Component | Action | Notes / acceptance |
|---|---|---|
| `AppCard` grid (variant A) | [extend `components/AppCard.tsx`] | icon, name, star+count, pricing tag, pitch, Built-for badge; hover lift; skeleton (SPEC §4.1) |
| `AppCardRow` (variant B) | [create] or variant prop on AppCard | full-width row: icon left, content right — for `/all` + search (SPEC §4.2) |
| `StarRating` | [extend `components/StarRating.tsx`] | single star + "{r} out of 5 stars ({count})", SR-only count; never stars w/o count (SPEC §4.3) |
| `PricingTag` | [create] | the 6 variants incl. usage; "•"-prefixed caption; reconcile to LetBuyy pricing enum (SPEC §4.4) |
| `QualityBadge` ("Built for LetBuyy") | [create] | shield/check + sentence + "Learn more"; renders only when award data present (SPEC §4.5) |
| `Pill` / `Chip` | [ui-pkg or extend] reuse `FilterChips` | subcategory pills + feature chips → link to filtered `/all` (SPEC §4.6) |
| `Pagination` | [ui-pkg create] | numbered `1 2 3 4 … N` + Next/Prev; `?page=N` (SPEC §4.7) |
| `SectionHeader` | [create] | eyebrow + H2 + optional action link |
| `StoryCard` | [create] | image + eyebrow + title + CTA (editorial) |
| `Testimonial` | [create] | quote + person/company + referenced app |
| `ValueProp` | [create] | icon + title + sentence |
| `Gallery` + `Lightbox` | [extend `components/ScreenshotGallery.tsx`] + [ui-pkg `Lightbox` via `Modal`] | carousel + prev/next + click→focus-trapped lightbox (SPEC §5.5B, §6) |
| `VideoHero` | [ui-pkg create] | looping muted bg video + poster fallback; honors reduced-motion |
| `MegaMenu` | [ui-pkg create] + [extend `Header.tsx`] | 2-panel "Browse apps" (categories+descriptions / stories); keyboard + Esc (SPEC §3.1) |
| `MobileNavDrawer` | [extend `Header.tsx`] reuse `Drawer` | search + 7 groups accordion + stories + CTAs (SPEC §3.1) |
| `Footer` | [extend `components/Footer.tsx`] | 4 groups + legal row + locale switcher; fix `letbuyy.store`→`letbuyy.com` (SPEC §3.3, audit #28) |

### Wave 2 — Home rebuild (SPEC §5.1)

[extend `src/app/page.tsx`] Replace the single directory grid with the editorial rail sequence, **each rail gated on real catalog depth** (hide if insufficient real apps):

1. Hero — "Get the best apps … Built for LetBuyy" + CTA → BFS story.
2. "Built for LetBuyy" recommended rail (6 cards, badge).
3. "Popular with merchants across LetBuyy" (6 cards, popularity from real install/rating data).
4. Story card — first editorial slot (e.g. "Sell B2B"); SKIP content, render slot honestly.
5. "In the spotlight" (4 newer apps).
6. "Featured app" large editorial card (slot).
7. "Get that tech stack" — 3 merchant story callouts (slot).
8. "Made by LetBuyy" — first-party apps rail.
9. "The LetBuyy app advantage" — 3 value props with **real** numbers (or omit the number until real — no "16,000").
10. "Want to add an app?" closing CTA band.

**Acceptance:** rails render real data; empty/insufficient rails hidden or honest; 3-up desktop / 2 tablet / 1 mobile; section headers consistent; no fabricated counts.

### Wave 3 — Category landing (SPEC §5.2)

[extend `src/app/(store)/categories/[slug]/page.tsx`] Rebuild to editorial layout:
1. Hero: H1 "{Category} apps" + subtitle + subcategory pills + `VideoHero` slot (image/gradient fallback; SKIP asset).
2. "Sponsored apps" — labeled, data-driven from featured/sponsored model (reuse V2 #56); SKIP sold inventory.
3. "Recommended {category} apps" — grid with badges.
4. Per-subcategory sections — H2 + description + CTA + card grid, **only for subcategories with real apps**.
5. Merchant tech-stack story slot.
6. Testimonial slot.
7. Editorial how-tos — 3 Guide/Blog/Video cards (slots → stories).
8. Closing CTA.

**Acceptance:** title "Best {Category} Apps For 2026"; sections gate on real data; sponsored clearly labeled; matches SPEC order.

### Wave 4 — Faceted browse + search (SPEC §5.3–5.4)

[create `src/app/(store)/categories/[slug]/all/page.tsx` as a **server page** (not an api route); extend `src/app/(store)/search/page.tsx`] and the gateway list endpoint.

- **Breadcrumb** (reuse `MarketplaceBreadcrumbs`/`@letbuyy/ui Breadcrumbs`) → H1 + subtitle → **real result count** ("N apps").
- **FilterRail** [create, reuse `FilterBar`/`FilterChips`/`Drawer`]: **Programs** ("Built for LetBuyy") + **feature facets** grouped by the category's feature taxonomy (SPEC §5.3); each facet updates URL `?feature_handles[]=` + results. Needs the feature-facet data (see §7) — if facet data absent for a category, hide the facet group (honest).
- **SortControl** [create]: relevance/popularity/rating/recent → **server-side** (push rating filter server-side too — audit #39).
- **Result list**: `AppCardRow` (variant B), ~20/page.
- **Pagination**: numbered, `?page=N` (audit #48); repeated below list.
- **Search** (`/search?q=`): same filter rail + sort + row list + pagination; title "Search results for "{q}""; keep debounce + `AbortController`; states: skeleton / honest error / no-results (query echo + suggested categories).
- **Show ALL categories** in filters (remove the `slice(0,15)` cap — audit #15).

**Acceptance:** filters+sort+pagination update URL and results server-side; all categories selectable; row cards match SPEC §4.2; honest empty/error states; no client-only rating filter.

### Wave 5 — App detail parity (SPEC §5.5)

[extend `src/app/(store)/apps/[slug]/page.tsx`] Keep LetBuyy's strong consent/permission UX; add the missing blocks to reach Shopify-detail parity, in SPEC order:

| Block | Action | Acceptance |
|---|---|---|
| Header: icon + H1 + QualityBadge + **awards** | [extend] awards from data (§7) | Badge only if awarded; awards only if present |
| **MetaStrip** (Pricing / Popularity+country / Rating→#reviews / Developer) | [create `MetaStrip`] | definition-list layout matching SPEC §5.5A |
| Install CTA + **View demo store** | [extend] demo link when `app_url`/demo present | secondary button; hidden if none |
| **Gallery + Lightbox** | [extend `ScreenshotGallery`] | carousel + prev/next + lightbox; real media or honest empty (no fake tiles) |
| Long description + "more" + highlights | [extend] | expander; 5 highlight bullets |
| **WorksWithChips** + Languages + Categories | [create `WorksWithChips`] | integration chips (link where real), category chips |
| **FeatureTagGroups** ("Show features") | [create] | accordion groups of feature chips → `/all?feature_handles[]=` (§7) |
| **PlanCards** (merchant-facing) | [create `PlanCards`] | side-by-side plans from V2 pricing-plans; trial note; USD/30-day microcopy; "See all pricing options" |
| **RatingHistogram** | [create or extend] | 5→1 rows, "% of ratings are N stars" + count link `?ratings[]=N` |
| **WhatMerchantsThink** | [create] | AI-summary slot + Helpful/Not helpful + honest "no summary yet"; provider SKIP (§7) |
| Reviews list + **provenance** | [extend] add merchant **country** + **duration using the app** + date; Write review + All reviews | provenance from real install data (§7) |
| Support / Resources / Developer / **Launched + Changelog** | [extend] changelog from `app_versions` (V2) | real version history |
| **Featured in** + **More apps like this** | [extend] | stories the app appears in; 3 related cards |

### Wave 6 — Stories/collections, partner, stories index (SPEC §5.6–5.8)

- **Story/collection content type** [db+gw+app] — extend the V2 `app_collections` with an editorial **body** (sections/rich text/app callouts); build `src/app/(store)/stories/[slug]/page.tsx` [create] + `src/app/(store)/stories/page.tsx` [create] (index grid of `StoryCard`). Real Collections replace the V2 fakes (audit #14). **Content = SKIP**, render slots honestly.
- **Collections index** [extend `src/app/(store)/collections/page.tsx`] + detail [extend `collections/[slug]/page.tsx`] — curated sets, gated on real membership.
- **Partner profile** [extend `src/app/(auth)/developers/[slug]/page.tsx`] — "Apps by {Partner}" + count + `AppCard` grid from `GET /developers/:id` (V2-wired).

### Wave 7 — Responsive + a11y + SEO parity (SPEC §6–§9)

- **Responsive** [extend `globals.css` + components]: mobile-first; apply fluid type; per SPEC §7 table (nav→drawer, grids 3→2→1, filter rail→drawer, detail 2-col→1-col, gallery swipe). Verify 320/375/768/1024/1440.
- **a11y** [extend]: mega-menu + lightbox keyboard/focus-trap/Esc/`aria-*`; star `aria-label`; cards real links w/ accessible names; AA contrast; focus rings; ≥44px targets (SPEC §8; audit #98).
- **SEO/structured data** [extend]: title templates (Home / Category "Best {X} Apps For 2026" / Leaf / Detail / Search), meta, OG/Twitter, BreadcrumbList JSON-LD, keep `SoftwareApplication`+`AggregateRating`+`Offer`, sitemap incl. categories+apps+stories, canonical (SPEC §9).

### Wave 8 — Verify & finalize

Full §8 gates across touched workspaces; `validate-governance.mjs` green (minus known theme-marketplace failure); regenerate repository intelligence; finalize ledger/status rollup; confirm every SPEC §4 component and §5 page is DONE/PARTIAL-with-skip.

---

## 7. Back-end additions for UI parity (additive; data the new UI needs)

Build these additively so the UI has **real** data (no theater). Each: migration (RLS, single writer, local apply, prod SKIP) + gateway read + api-client method + shared-types DTO.

| Data | Why (UI) | Notes / SKIP |
|---|---|---|
| **Feature-facet taxonomy** | FilterRail facets (§5.3) + FeatureTagGroups (§5.5E) + chip→`/all` filtering | Define category→feature groups + per-app feature tags; gateway filter by `feature_handles[]`; if a category has no taxonomy yet, hide its facets (honest) |
| **Story/collection editorial body** | Stories/collections (§5.6) | Extend `app_collections`; content authoring = SKIP |
| **App awards** | Detail awards + badges (§5.5A) | `app_awards` table; awarding/criteria = SKIP (business) |
| **Review provenance** | Country + duration on reviews (§5.5G) | country from store profile; duration computed from install date; additive/derived |
| **"What merchants think" summary** | Detail AI summary (§5.5G) | summary field + generation hook; AI provider/keys = SKIP; render only when present |
| **Sponsored/featured placements** | Sponsored rail (§5.2), home featured | reuse V2 featured model; labeled; sold inventory = SKIP |
| **Popularity/recommendation signals** | "Popular", "More like this", "Recommended" | derive from real installs/ratings/category; no fabricated ordering |

Keep all of these **gated on real data**: if the data isn't there, the UI hides the surface or shows an honest empty state — never fake it.

---

## 8. Green gates & Definition of Done

Per touched workspace (examples):
```bash
pnpm --filter @letbuyy/app-marketplace typecheck && pnpm --filter @letbuyy/app-marketplace lint && pnpm --filter @letbuyy/app-marketplace test && pnpm --filter @letbuyy/app-marketplace build
pnpm --filter @letbuyy/ui typecheck && pnpm --filter @letbuyy/ui build
pnpm --filter @letbuyy/api-client typecheck && pnpm --filter @letbuyy/api-client build
pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway build && pnpm --filter @letbuyy/api-gateway test
# migrations: apply LOCALLY and verify; prod apply is SKIPPED
node scripts/validate-governance.mjs           # must pass except the known unrelated theme-marketplace failure
node scripts/generate-repository-intelligence.mjs   # after route/page/export/schema changes; commit only generated diffs
```
The Next build may require running outside the sandbox (Turbopack) — that's acceptable; record it. A component/page is **DONE** only when it matches the SPEC anatomy + all states + responsive + a11y, degrades honestly if a SKIP dependency is unmet, the ledger row is filled, and all gates are green.

**Mission complete when:** every SPEC §4 component and every SPEC §5 page is DONE or PARTIAL-with-precise-SKIP; no fake data/dead controls/leaked copy; ledger/status current; all touched-workspace gates + governance green; intelligence regenerated.

---

## 9. Coverage matrix (SPEC → wave)

**Components (SPEC §4 / §11 checklist):** AppCard A `W1` · AppCardRow `W1` · StarRating `W1` · PricingTag `W1` · QualityBadge `W1` · Button/Pill/Chip `W1` · Breadcrumbs `W1/W4` · Pagination `W1/W4` · SectionHeader `W1` · MegaMenu `W1` · MobileNavDrawer `W1` · Footer `W1` · StoryCard `W1/W6` · Testimonial `W1/W3` · ValueProp `W1/W2` · Gallery `W1/W5` · Lightbox `W1/W5` · VideoHero `W1/W3` · FilterRail `W4` · SortControl `W4` · RatingHistogram `W5` · PlanCards `W5` · ReviewItem(+provenance) `W5` · WhatMerchantsThink `W5` · MetaStrip `W5` · WorksWithChips `W5` · FeatureTagGroups `W5`.

**Pages (SPEC §5):** Home `W2` · Category landing `W3` · Faceted `/all` `W4` · Search `W4` · App detail `W5` · Collection/Story + index `W6` · Partner profile `W6` · Global nav/footer/modals `W1` · Responsive/a11y/SEO `W7`.

All SPEC components and pages are assigned. New in-scope defects → `FOUND-###`, fix in the right wave.

---

## 10. First actions (now, in order)

1. **Read** the SPEC (`docs/apps-marketplace-audit/SHOPIFY_APP_STORE_UIUX_TEARDOWN.md`) end-to-end, `CODEX_APPS_MARKETPLACE_FOUNDATION_V2_STATUS.md`, `apps/app-marketplace/AGENTS.md`, root `AGENTS.md`.
2. **Create** `CODEX_APPS_MARKETPLACE_UIUX_LEDGER.md` + `CODEX_APPS_MARKETPLACE_UIUX_STATUS.md` (repo root).
3. **Baseline** the §8 gates once; record clean baseline in STATUS.
4. **Execute Wave 0** (tokens), commit, update ledger/status, re-run gates + governance.
5. **Proceed Waves 1→8 without stopping.** For each item: ui-pkg primitive → app composition → BFF action (no new route files) → gateway/db (additive) where §7 requires; gate every rail/section on real data; `SKIPPED` content/assets/business; keep validators green; leave no fake data, dead control, or Shopify-verbatim copy behind.

> The bar: a merchant lands on a LetBuyy marketplace that **looks and behaves like the Shopify App Store** — curated rails, rich cards, a mega-menu, a faceted browse, and a deep app-detail page — rendered in **LetBuyy's purple brand with original copy and real data**. Structural parity, brand-true, theater-free. Build toward the SPEC. Decide the default, flag the sign-off, and do not block.
