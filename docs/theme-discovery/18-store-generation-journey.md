# Store Generation Journey Analysis

**Date:** 2026-06-18
**Sources:** identity-platform onboarding/page.tsx, select/page.tsx, api/auth/create-store/route.ts, services/api-gateway/src/routes/onboarding.ts, services/api-gateway/src/routes/stores.ts, packages/tenant-core/src/index.ts

---

## 1. Current Merchant Journey (Evidence-Based)

### Step-by-Step Current Flow

The web onboarding wizard is a **3-step flow** in `apps/identity-platform/src/app/onboarding/page.tsx`. It is a separate, lighter path from the gateway's 6-step wizard (which exists for the mobile app). Both paths converge at `POST /stores` in the gateway.

**Prerequisites**

- The merchant must already have an authenticated session (ES256 JWT from identity-platform).
- The `select/page.tsx` checks `/api/auth/stores` on load. If the user has 0 stores → auto-redirect to `/onboarding`. If 1 store → auto-redirect to that store's dashboard. If 2+ stores → show store picker.

**Step 1 — Choose site type** (`page.tsx:398`, `TOTAL_STEPS = 3`)
- UI shows a bento grid of site type cards: `Online Store` (available), `Landing Page` (launch-disabled), `Blog` (launch-disabled).
- `portfolio` and `resume` are legacy-gated behind `NEXT_PUBLIC_LETBUYY_ENABLE_LEGACY_SITE_TYPES=true` (`page.tsx:194`).
- Selecting a type immediately advances to step 2.
- **DB created:** nothing yet.

**Step 2 — Name & subdomain** (`page.tsx:442`)
- Merchant enters a Display Name (optional) and a Subdomain (required, min 4 chars, alphanumeric + hyphens).
- Subdomain is validated via debounced `GET /api/auth/validate-subdomain?subdomain=` (400 ms delay).
- **DB created:** nothing yet (validation only).

**Step 3 — Review & Create** (`page.tsx:498`)
- Merchant sees a review summary: site type, display name, URL.
- On confirm, calls `POST /api/auth/create-store` with payload `{ siteType, storeName, subdomain, templateId: 'modern', survey: null }` (`page.tsx:296`).
- `templateId` is hardcoded to the string `'modern'` — it is **not user-selectable** in this web wizard.
- `survey` is always `null` in the web path.

**Identity Platform API Handler** (`apps/identity-platform/src/app/api/auth/create-store/route.ts`)
- Validates session + CSRF (`route.ts:34-46`).
- Validates site type against `ACTIVE_SITE_TYPES = ['store']` and `COMING_SOON_SITE_TYPES = ['landing', 'blog']` (`route.ts:8-9`).
- Proxies to `POST /stores` on the api-gateway with body: `{ name, subdomain, site_type, theme_id: templateId || 'modern', template_config: { templateId, survey } }` (`route.ts:83-96`).
- Fire-and-forgets a welcome email to `/api/email/store-creation-success` (`route.ts:124-138`).
- On success, returns `{ success: true, store }`.

**API Gateway Store Creation** (`services/api-gateway/src/routes/stores.ts:625`)
- Validates body via `CreateStoreSchema` (Zod).
- Checks subdomain uniqueness against `sites` table (`stores.ts:647`).
- Inserts a `sites` row with:
  - `status: 'draft'`
  - `locale: body.locale || 'en-IN'`
  - `theme_id: body.theme_id` (receives `'modern'` from the web path)
  - `template_config: body.template_config`
  - No `trial_status`, no `trial_started_at`, no `trial_ends_at` set here (these are set only by the mobile-path `/:attemptId/complete` handler).
- Emits a `store.created` domain event (`stores.ts:678`).
- Returns the created `sites` row with HTTP 201.

**Post-creation redirect** (`page.tsx:305`)
- Web UI redirects to `getAdminSelectPlanUrl(subdomain)` — the plan-selection screen — after a 1.5 second success animation.
- The merchant's first authenticated experience is the **plan selection screen**, not the storefront or dashboard.

**What is created in DB at the end of onboarding:**
| Table | Columns set | Columns NOT set |
|---|---|---|
| `sites` | `custom_user_id`, `name`, `store_name`, `subdomain`, `site_type`, `status='draft'`, `locale='en-IN'`, `theme_id='modern'`, `template_config` | `tagline`, `description`, `logo_url`, `custom_domain`, `currency`, `timezone`, `seo_title`, `seo_description`, `gstin`, `business_profile`, `trial_status`, `published_at` |
| `store_surveys` | not inserted (survey=null on web path) | all fields |

### Current Journey Pain Points (Evidence)

1. **No industry/niche collection.** `page.tsx` has zero fields for `business_type`, `industry`, `category`, or `store_type`. These are collected only in the mobile wizard's `MobileOnboardingProgressSchema` (`onboarding.ts:22-28`).
2. **Template is hardcoded.** The web wizard sends `templateId: 'modern'` unconditionally (`page.tsx:296`). No visual template picker exists in the web flow. The 6-step mobile wizard has a `pick_template` step (step 3) but it is absent from the web path.
3. **Theme is a string, not a resolved entity.** The `theme_id` field receives the literal string `'modern'`, not a UUID from the `themes` table. The gateway's `/onboarding/templates` endpoint queries `themes` by `is_active=true`, but this endpoint is never called during web onboarding.
4. **Store is created in `draft` status.** The merchant must separately publish. No auto-publish option exists in web onboarding.
5. **Plan selection is mandatory before the dashboard.** Post-creation redirect goes to plan selection, not to a usable admin dashboard. If a merchant skips plan selection, they land in trial territory.
6. **No brand setup during onboarding.** Logo, tagline, brand color (all available in `Step5Schema` from `tenant-core`) are not collected in the web wizard.

### What Currently Cannot Be Configured During Onboarding

Evidence from `route.ts` and `stores.ts`:

- Theme visual settings (`theme_settings` JSONB column — only settable via `PATCH /stores/:id`).
- Navigation menus — no onboarding endpoint for nav creation.
- Collections — no collection creation during onboarding.
- Pages (About, Contact) — not created automatically.
- Products — none added during onboarding.
- Payment configuration — added post-creation via `POST /stores/:id/payment-config`.
- GST/business details (`gstin`, `gst_state_code`, `legal_name`) — requires merchant to fill `Settings > Business` post-creation.
- Custom domain — post-creation via `Settings > Domains`.
- Logo and branding — post-creation.
- Currency — defaults to none (no default set in the insert); must be set later.

---

## 2. Future AI Journey

### Target State

Merchant types: "I want to open an electronics store in Mumbai selling smartphones and accessories."

System outputs: a `draft` store with:
- A theme pre-selected from `themes` table matching the vertical (electronics/tech).
- `theme_settings` pre-populated with a color palette and font choice appropriate to tech retail.
- Sample navigation structure (Home, Products, About, Contact).
- Placeholder collection "Smartphones" and "Accessories".
- `tagline`, `seo_title`, `seo_description` auto-generated.
- `gstin` capture prompt shown inline (Mumbai = Maharashtra, GST state code 27).
- Storefront publicly previewable (still `draft`, not published) within 5 minutes of signup.

### Journey Steps to Automate

| Current Step | Future Automation | Systems Involved | API Available? |
|---|---|---|---|
| Step 1 — Choose site type | Auto-select `store` from intent prompt | AI intent classifier + identity-platform onboarding | Partially (type field exists) |
| Step 2 — Name & subdomain | AI-suggest subdomain from store description | identity-platform validate-subdomain API | Yes (`GET /api/auth/validate-subdomain`) |
| Template selection (currently hardcoded `'modern'`) | AI selects theme UUID from `/onboarding/templates?site_type=store` based on industry | api-gateway `GET /onboarding/templates` | Yes (endpoint exists) |
| Industry/niche capture (missing in web wizard) | Extracted from natural language prompt → mapped to `Step4Schema.industry` | AI NL extraction + `Step4Schema` in tenant-core | Schema exists; no web UI |
| Brand color / tagline (Step 5, mobile only) | Generated from industry + store name | AI generation + `Step5Schema` | Schema exists; no web UI |
| Business location / GST | Detected from city/state mention → GST state code lookup | New endpoint needed | No |
| Navigation creation | Generate standard nav for vertical | New endpoint needed | No |
| Collection scaffold | Create 2-3 starter collections | `POST /collections` (existing gateway route) | Needs verification |
| Page creation (About, Contact) | Generate placeholder pages | `POST /pages` (existing gateway route) | Needs verification |
| `seo_title` / `seo_description` | AI-generated from store name + vertical | `PATCH /stores/:id` (fields: `seo_title`, `seo_description`) | Yes |
| `tagline` | AI-generated | `PATCH /stores/:id` (field: `tagline`) | Yes |
| Payment setup | Prompt for COD (default ON) + Razorpay onboarding link | `POST /stores/:id/payment-config` | Yes (Razorpay only) |

### Data Collection Requirements

Minimum viable info set for each vertical:

**Common (all verticals):**
- Store name (free text, 2-100 chars)
- Subdomain preference (AI-suggested, merchant confirms)
- City / state (for GST state code auto-populate)
- Business type: new vs existing (`MobileOnboardingProgressSchema.business_type`)

**Electronics / Tech retail:**
- Primary product category (e.g. smartphones, laptops, accessories)
- Price range (budget / mid / premium → theme tone)

**Fashion / Apparel:**
- Gender focus (men / women / kids / unisex)
- Style (casual / formal / ethnic / sportswear)

**Food & Grocery:**
- Delivery model (hyperlocal / pan-India)
- Product type (packaged / fresh / both)

**General minimum for AI theme selection:** industry + brand tone (can be inferred from vertical). The `Step4Schema` (`tenant-core:274`) already has `industry`, `target_audience`, `business_goal`, `brand_tone` — these are the correct fields to collect.

---

## 3. Onboarding Hook Points

Where AI generation can be injected into the current onboarding flow:

**Hook A — After step 2 (subdomain validated), before step 3 review**
- File: `apps/identity-platform/src/app/onboarding/page.tsx:287` (`handleSubmit`)
- Inject: AI prompt collection widget between step 2 and the review step. Collect industry + brand tone.
- Replace hardcoded `templateId: 'modern'` with AI-selected theme UUID from `/onboarding/templates`.

**Hook B — In `POST /api/auth/create-store/route.ts:83` before the gateway call**
- File: `apps/identity-platform/src/app/api/auth/create-store/route.ts`
- Inject: AI-generated fields (`tagline`, `seo_title`, `seo_description`, `brand_color`) appended to the gateway request body.
- These fields are accepted by `PATCH /stores/:id` (`stores.ts:702`) and can be set in the same create call by adding them to `CreateStoreSchema`.

**Hook C — In api-gateway `POST /stores` handler (`stores.ts:657-684`)**
- After store insert, call an async AI scaffold job (queue worker) to: create starter collections, generate nav, create pages.
- This is fire-and-forget (same pattern as the welcome email at `route.ts:124`).

**Hook D — New endpoint `POST /onboarding/ai-generate`**
- Accepts: `{ industry, brand_tone, store_name, city }` → returns `{ suggested_theme_id, tagline, seo_title, seo_description, brand_color, starter_collections[] }`.
- Called client-side after industry capture, before review step.
- No DB mutation — pure generation, passed through to `POST /stores`.

---

## 4. Current Theme Assignment During Onboarding

**What is assigned:**

In the web path (`apps/identity-platform/src/app/api/auth/create-store/route.ts:91`):
```
theme_id: templateId || 'modern'
```
`templateId` is always `'modern'` (hardcoded in `onboarding/page.tsx:296`). Therefore every web-created store gets `theme_id = 'modern'`.

**What `'modern'` resolves to:**
The string `'modern'` is stored directly in `sites.theme_id`. It is not a UUID from the `themes` table. The `/onboarding/templates` endpoint queries `themes` by `is_active=true` and returns UUIDs, but this endpoint is never called during the web onboarding flow. Whether `'modern'` is a valid `themes.id` or simply a slug fallback is not determinable from these source files alone — it is likely a slug used by the theme-engine renderer rather than a DB row primary key.

**What configuration it receives:**
```json
{
  "template_config": {
    "templateId": "modern",
    "survey": null
  }
}
```
No `theme_settings` JSONB is set at creation time. No color palette, fonts, or section configuration is applied. The storefront renders with theme-engine defaults for the `'modern'` theme.

**Mobile path difference:**
The mobile 6-step wizard (`/onboarding/:attemptId/complete`) creates the `sites` row without a `theme_id` field at all (`onboarding.ts:401-413`) — theme is not set in the complete handler. The mobile `Step3Schema` collects a `template_id` UUID (`tenant-core:270`), which is stored in `onboarding_attempts.template_id` (`onboarding.ts:346`), but this value is **never transferred to the `sites` row** during completion.

---

## 5. Journey Comparison Table

| Journey Step | Current (Web) | AI Future | Owner System | Missing Capability |
|---|---|---|---|---|
| Authentication / session | OAuth/magic-link via identity-platform | Same | identity-platform | None |
| Store count check / redirect | `select/page.tsx` — auto-redirect | Same | identity-platform | None |
| Site type selection | 3-card bento (only `store` enabled) | Inferred from NL prompt | identity-platform onboarding | NL → site_type mapping |
| Industry / vertical capture | NOT PRESENT in web wizard | AI NL extraction UI | identity-platform onboarding | UI + Step4Schema wiring |
| Name entry | Free text, required | AI-suggested from description | identity-platform onboarding | None (field exists) |
| Subdomain selection | Merchant types, debounced validation | AI-suggested, merchant confirms | identity-platform validate-subdomain | None (API exists) |
| Template / theme selection | Hardcoded `'modern'` | AI picks theme UUID from `/onboarding/templates` | api-gateway | Theme picker UI + AI selection |
| Brand setup (color, logo, tagline) | NOT PRESENT | AI-generated tagline + color | identity-platform onboarding | Step5Schema not wired in web wizard |
| GST / business details | NOT PRESENT | City → auto-fill state code | api-gateway stores PATCH | New GST-lookup utility |
| Store row creation | `POST /stores` — `status='draft'`, `theme_id='modern'` | Same + AI-enriched fields | api-gateway | `CreateStoreSchema` needs extra fields |
| Domain event emission | `store.created` | Same | queue-workers | None |
| Welcome email | Fire-and-forget | Same | identity-platform | None |
| Plan selection redirect | Immediate (1.5s after creation) | After preview confirmation | identity-platform | Preview before plan gate |
| Navigation scaffold | NOT CREATED | AI-generated for vertical | api-gateway + new endpoint | Nav creation endpoint |
| Starter collections | NOT CREATED | AI-generated (2-3 for vertical) | api-gateway collections route | Async scaffold worker |
| Placeholder pages | NOT CREATED | About + Contact generated | api-gateway pages route | Async scaffold worker |
| SEO metadata | NOT SET | AI-generated | api-gateway `PATCH /stores/:id` | Hook in create flow |
| Payment configuration | Post-creation manual | COD default ON; Razorpay wizard | api-gateway payment-config | None (API exists) |
| First product visible on storefront | Manual product creation | Sample product scaffold (optional) | merchant-control-plane | Sample product API |

---

## 6. The "5-Minute Store" Feasibility

**Assessment: Achievable for a demo-quality preview in 5 minutes; not achievable for a transaction-ready store.**

A "5-minute store" is feasible if the definition is: merchant can see a live preview URL with their store name, a matching theme, 2 placeholder collections, and auto-generated SEO text — all within 5 minutes of registration.

It is not feasible within 5 minutes for production readiness because payment configuration (Razorpay credential verification) requires external account access and cannot be automated.

### What Specifically Blocks It

1. **No industry/vertical capture in the web wizard.** The `Step4Schema` (`industry`, `brand_tone`, `business_goal`) exists in `tenant-core` but is not wired into the 3-step web wizard. Without this data there is no input for AI theme selection or content generation. Adding a Step 2.5 (AI prompt or vertical selector) is required.

2. **`theme_id = 'modern'` is hardcoded — no AI theme selection path exists.** The `/onboarding/templates` endpoint exists and returns active themes from the DB (`onboarding.ts:472-493`), but the web wizard never calls it. Even if a merchant selects a vertical, there is no code path to translate that into a non-`'modern'` theme. The mobile path collects a `template_id` UUID but never applies it to the `sites` row (it is stranded in `onboarding_attempts`).

3. **No async scaffold worker for collections, nav, or pages.** After `store.created` is emitted, no worker listens to it to generate starter content. The queue-workers service (`services/queue-workers`) would need a new `store.created` handler that calls collection, nav, and page creation APIs with AI-generated content for the detected vertical.

---

## 7. Recommended Journey Architecture

### Data Model Needed

**New table: `store_ai_generation_intents`**

```sql
CREATE TABLE store_ai_generation_intents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid REFERENCES sites(id) ON DELETE CASCADE,
  user_id      uuid,
  raw_prompt   text,                         -- merchant's free-text input
  industry     text,                         -- extracted/normalized vertical
  city         text,                         -- for GST state code
  brand_tone   text,                         -- professional/casual/luxury/playful/formal
  generated_theme_id  uuid,                  -- UUID from themes table
  generated_tagline   text,
  generated_seo_title text,
  generated_seo_description text,
  generated_brand_color text,                -- #rrggbb
  generated_collections jsonb,               -- [{name, description}]
  generation_status text DEFAULT 'pending',  -- pending/complete/failed
  created_at   timestamptz DEFAULT now()
);
```

**Extend `sites` insert payload** to accept `tagline`, `seo_title`, `seo_description` at creation time (currently only writable via `PATCH /stores/:id`). `CreateStoreSchema` in `packages/tenant-core/src/index.ts` needs these optional fields added.

### New API Endpoints Needed

1. **`POST /onboarding/ai-intent`** (api-gateway, no DB mutation)
   - Input: `{ store_name, raw_prompt, city? }`
   - Calls AI inference (Anthropic API or internal model).
   - Returns: `{ industry, brand_tone, suggested_theme_id, tagline, seo_title, seo_description, brand_color, starter_collections[] }`
   - Called client-side before the review step. Fast path: < 3 seconds.

2. **`POST /onboarding/scaffold` (queue-enqueue)** (api-gateway, called after store creation)
   - Input: `{ site_id, industry, starter_collections, nav_labels }`
   - Enqueues async jobs: create collections, create default nav, create About/Contact pages.
   - Worker runs within 30 seconds post-creation.

### Integration with Existing Flow

```
[onboarding/page.tsx step 1 — choose type]
         ↓
[NEW: step 1.5 — AI prompt: "describe your store" or vertical picker]
   → POST /onboarding/ai-intent → get { theme_id, tagline, seo_title, ... }
         ↓
[step 2 — name & subdomain (AI-suggested subdomain pre-filled)]
         ↓
[step 3 — review (show AI-selected theme preview thumbnail)]
   → POST /api/auth/create-store with enriched payload
       { siteType, storeName, subdomain,
         templateId: <AI UUID from themes table>,
         tagline, seo_title, seo_description, brand_color,
         survey: { industry, brand_tone, city } }
         ↓
[api-gateway POST /stores inserts enriched sites row]
   → emits store.created
   → POST /onboarding/scaffold (async, fire-and-forget)
         ↓
[queue-worker picks up scaffold job → creates collections, nav, pages]
         ↓
[redirect: /preview/{subdomain} before plan-selection gate]
```

### Fallback If AI Generation Fails

- If `POST /onboarding/ai-intent` times out or errors: skip AI enrichment, fall back to current behavior (`templateId: 'modern'`, no tagline/SEO, no scaffold).
- The fallback is already the current production state — zero regression.
- Display a non-blocking warning: "We couldn't auto-configure your store. You can customize it from the dashboard."
- Scaffold job failure (collections/nav/pages) is silent — empty store, merchant adds content manually. This is identical to today's behavior.
- The `store_ai_generation_intents` row records `generation_status = 'failed'` for observability.
