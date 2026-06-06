# Apps Content Gap Analysis (Phase 6)

Audits every user-facing string surface — titles, taglines, cards, detail pages, help text, onboarding, empty/error states — for accuracy, professionalism, and usefulness, and flags placeholder/filler/misleading content. Parent: [Master Audit](../LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md).

## 1. What's genuinely good

- **Honest outage/empty copy.** `MarketplaceUnavailable` says "We could not reach the app catalog service right now… please try again," and the home empty state says "The marketplace shell is ready, but the app catalog API returned no rows in this environment." This is rare and commendable honesty — no fake apps.
- **Uninstall data-loss warning** is specific and correct: "this removes app access, embedded surfaces, webhooks, and app-managed configuration… App-owned data may stop syncing or become unavailable" (`InstalledAppsGrid.tsx`).
- **Permission consent copy** names exact scope codes alongside human labels (`AppInstallConsentPanel.tsx`), which is good security UX.
- **Billing-approval banner** correctly states paid charges aren't activated until merchant approval.

## 2. Misleading or inaccurate content (fix before launch)

| Surface | Problem | Evidence |
|---|---|---|
| Every app card + detail | **"Built for LetBuyy"** shown unconditionally — implies an earned quality bar that doesn't exist | `AppCard.tsx`, `apps/[slug]/page.tsx` |
| Developer register Step 3 | "LetBuyy takes a **15% commission** (net-85 revenue share)" — contradicts backend default 20% | `developers/register/page.tsx` vs `queue-execution.adapter.ts:449` |
| Submit form pricing hint | "In INR. LetBuyy takes a **15% commission**." — same contradiction | `apps/new/page.tsx` |
| "Made in India" collection | "Apps built by Indian developers, optimized for Indian merchants" — **no country filter applied**; just sorts by recent | `collections/[slug]/page.tsx` |
| "Staff Picks" / "Trending This Week" | Copy implies curation/real-time popularity; both are plain re-sorts of the same query | `collections/[slug]/page.tsx` |
| Layout metadata | "Browse **thousands of apps**…" while catalog is empty | `app/layout.tsx`, `Footer.tsx` |
| Marketing keyword | `keywords: ["… shopify alternatives …"]` ships in production metadata | `app/layout.tsx` |
| Developer portal | "6 Extension Types" but schema defines **8** (`app_extensions_type_check`) | `developers/page.tsx` vs `000_baseline.sql:8342` |

## 3. Placeholder / unfinished content

| Surface | Problem |
|---|---|
| App detail screenshots | Defaults to 3 placeholders: "Awaiting approved media from the app partner" — fine as fallback, but submission can't upload media anyway, so it's the *permanent* state |
| Detail "Updated" date | Falls back to `1970-01-01` epoch when timestamps are missing (`formatIndiaDate(... || '1970-01-01...')`) — would display a 1970 date |
| Category pages | Sort `<select>` is inert (no handler); options render but do nothing |
| Search sidebar | Pricing (Free/Freemium/Paid) and Rating (4+/3+) options are static text with no behavior |
| Country select | US/GB show flag emoji, India doesn't; payout copy is India-only — cosmetic mismatch |

## 4. Visible rendering bug (content correctness)

`APP_CATEGORIES[].icon` holds a **Material icon name string** (e.g., `'inventory_2'`, `'local_shipping'`). `CategoryGrid.tsx` and the home pills correctly pass it to `<MaterialIcon name=…>`. But three surfaces render it as raw text:

- Search sidebar: `{cat.icon} {cat.name}` → "inventory_2 Product Sourcing" (`search/page.tsx`)
- Category header: `<span style={{fontSize:32}}>{category.icon}</span>` → "inventory_2" at 32px (`categories/[slug]/page.tsx`)
- Submit dropdown: `{cat.icon} {cat.name}` (`apps/new/page.tsx`)

## 5. Missing content that merchants/developers need

- **No data-handling/privacy disclosure** on listings (what the app collects, where data goes).
- **No review policy / submission rubric** published anywhere in the product.
- **No changelog/release notes**, no "what's new."
- **No support expectations** (response time, channels) beyond a raw `support_email`.
- **No compatibility statements** ("works with theme/app X").
- **Empty-search has no guidance** beyond "Try different keywords."

## 6. Tone & professionalism

Copy is generally clean, professional, and India-aware (₹, GST, UPI). The problems are not grammar — they're **truthfulness** (badges, commission, collections) and **completeness** (placeholders that are permanent because the pipeline to replace them doesn't exist). Fixing §2 and §4 is mandatory before any merchant sees this; §3 and §5 are launch-quality work.
