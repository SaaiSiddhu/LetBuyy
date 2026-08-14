# AGENT J — CMS, Blog, Policy Pages, Navigation, Domains, Themes

Run: `docs/merchant-system-discovery/2026-08-04T225330+0530-ee371182`
Branch `stepup/main` @ `ee371182`. Read-only discovery. No file outside this note was modified.

Local `AGENTS.md` read before inspection: `apps/merchant-control-plane/AGENTS.md`,
`apps/storefront-runtime/AGENTS.md`, `packages/theme-engine/AGENTS.md`, `packages/cms-core/AGENTS.md`,
`apps/theme-marketplace/AGENTS.md`. All four are the same hand-authored boundary template (ownership,
forbidden imports, "reserved roots stay manifest-only, frozen roots de-deployed"). None of them adds a
CMS/blog/theme-specific rule beyond the root chain, so the root `AGENTS.md` + Constitution govern
everything below.

**Everything here is static code + schema reading. NOTHING in this note is `VERIFIED_E2E`.** I did not
start a dev server, did not hit a database, and did not run a build. Max attainable status is
`IMPLEMENTED_NOT_RUNTIME_VERIFIED`.

---

## 0. Executive summary (what a merchant can actually do today)

| Capability | Status | One-line verdict |
|---|---|---|
| Blog post create / edit / archive (web) | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Works end to end at the data layer; editor is title/slug/excerpt/plain-textarea/status only. |
| Blog post **visible on storefront listing** | **BROKEN** | On the DEFAULT React renderer, `/blog` renders the store's **home-page sections**, not the article list. The article drop is only consumed by the Liquid branch. |
| Blog post detail page `/blog/<slug>` | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Renders via the content fallback section on both engines. |
| Scheduled publication | **DORMANT_FLAGGED** | `scheduled_at` column + `'scheduled'` status exist and validate; the gateway never writes `scheduled_at`, PATCH does not allow it, and **no worker publishes scheduled posts**. Silently never publishes. |
| Blog comments moderation | **BACKEND_ONLY / dead-end** | Merchant moderation UI + gateway GET/PATCH/DELETE exist. There is **no POST anywhere and no storefront comment form**, so the queue is structurally always empty. |
| Blog categories / tags | PARTIAL | Gateway CRUD exists; **no web merchant UI**. Flutter exposes a raw `category_id` text field. |
| Custom pages (`storefront_pages`) | IMPLEMENTED_NOT_RUNTIME_VERIFIED | Create/edit/archive + revisions + nav sync. Two competing merchant UIs. |
| Required policy pages | **CONTRADICTORY_EVIDENCE / P0 for India launch** | Two entirely separate policy systems. The discoverable one (Settings → Policies) writes `sites.*_policy` columns that **nothing on the storefront reads**. Merchants who use it get 404s on `/privacy`, `/terms`, `/shipping`, `/returns`. |
| Default policy pages at onboarding | **NOT_IMPLEMENTED** | No seeding anywhere. A brand-new Indian store launches with zero policy pages. |
| Navigation / menus | PARTIAL | Only `location=main` is editable; hierarchy is destroyed on every save; the `policies` footer menu is never created. |
| Subdomain routing | IMPLEMENTED_NOT_RUNTIME_VERIFIED | `proxy.ts` → `/v1/internal/store-access/resolve`. Custom-domain routing correctly requires `status='active'`. |
| Custom domain add + TXT/CNAME verify + SSL | IMPLEMENTED_NOT_RUNTIME_VERIFIED (provider = BLOCKED_EXTERNAL) | Real TXT challenge + Vercel attach. Domain is **claimed in `sites.custom_domain` before ownership is proven** → squatting/DoS. |
| "Buy a new domain" | **UI_ONLY** | UI promises "pay securely, LetBuyy registers and auto-connects". There is **no buy button and no purchase proxy**. Gateway `POST /v1/domains/purchase` exists but accepts an **unverified client-supplied `payment_reference`**. |
| Theme selection + editor + publish (web) | IMPLEMENTED_NOT_RUNTIME_VERIFIED | 1810-line editor: autosave draft, preview session, publish, releases, rollback, conflict dialog. |
| Live renderer default | React (Liquid OFF) — CONFIRMED in code | `THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false`. |
| ART-17 "no new React sections" CI ban | IMPLEMENTED_NOT_RUNTIME_VERIFIED | `scripts/validators/no-new-react-sections-validator.mjs` allowlists exactly the 20 frozen files; 20 files exist. |
| Liquid canary gate integrity | **VIOLATION CANDIDATE [HIGH-STAKES]** | Any merchant can set `liquidRenderingCanary: true` and ship an arbitrary `liquidBundle` through the editor-draft proxy; publish then stamps `renderer_engine: 'liquid'` automatically. The ARB-deferred gate is merchant-settable. |
| One draft system | **VIOLATION** | `theme_editor_drafts` **and** `theme_instance_drafts` are both written on every save, plus `theme_draft_patches`. |
| Theme marketplace frozen | CONFIRMED | Not in `production-deploy.yml`/`staging-deploy.yml`; zero references from merchant-control-plane source. |
| Stored-XSS on merchant HTML | **SAFE on both paths** (with caveats) | Liquid path: `{{ … | raw }}` → `sanitizeRenderedHtml` (DOMPurify allowlist). React path: `stripHtml` + React escaping. |

---

## 1. Scope A — BLOG

### 1.1 Inventory

| Layer | Path | Notes |
|---|---|---|
| Merchant page (web) | `apps/merchant-control-plane/src/app/[store]/posts/page.tsx` (578 L) | UI_CODE |
| Merchant page (comments) | `apps/merchant-control-plane/src/app/[store]/comments/page.tsx` | UI_CODE |
| Merchant page (categories) | `apps/merchant-control-plane/src/app/[store]/categories/page.tsx` | Calls `/api/stores/:store/categories` (product categories, **not** `blog_categories`) — `apps/merchant-control-plane/src/app/[store]/categories/page.tsx:96` |
| App proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/posts/route.ts` (73 L) | PROXY_CODE |
| App proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/posts/[postId]/route.ts` (47 L) | PROXY_CODE |
| App proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/blog-comments/route.ts` + `[commentId]/route.ts` | PROXY_CODE |
| Gateway | `services/api-gateway/src/routes/blog.ts` (605 L) | GATEWAY_CODE |
| Schemas | `packages/cms-core/src/index.ts:655-712` (`CreateBlogPostSchema`, `UpdateBlogPostSchema`, `ListBlogPostsQuery`, `ListBlogCommentsQuery`) | SERVICE_CODE |
| Public read | `services/api-gateway/src/routes/storefront/public-routes.ts:1226-1305` | GATEWAY_CODE |
| Storefront listing | `apps/storefront-runtime/src/app/store/[subdomain]/blog/page.tsx` (102 L) | UI_CODE |
| Storefront detail | `apps/storefront-runtime/src/app/store/[subdomain]/blog/[slug]/page.tsx` (52 L) | UI_CODE |
| Storefront data svc | `apps/storefront-runtime/src/lib/content-service.ts:110-126` | SERVICE_CODE |
| Flutter list | `apps/mobile/merchant-app/lib/screens/content/blog_screen.dart` (765 L) | UI_CODE |
| Flutter editor | `apps/mobile/merchant-app/lib/screens/content/post_editor_screen.dart` (457 L) | UI_CODE |
| Flutter service | `apps/mobile/merchant-app/lib/services/cms_service.dart:113-170, 414-470` | API_CLIENT_CODE |
| DB | `database/supabase/migrations/000_baseline.sql:8544-8577` (`blog_posts`) | DB_SCHEMA |
| Liquid section | `packages/theme-engine/examples/letbuyy-core-liquid/files/sections/blog-listing.liquid`, `article-content.liquid` | UI_CODE |
| Tests | `packages/theme-engine/test/liquid-l14-blog.test.ts` (Liquid article render + XSS) | UNIT_TEST |

### 1.2 Full vertical trace — create → draft → publish → storefront

| # | Link | Evidence | Status |
|---|---|---|---|
| 1 | Merchant entry: Content → Blog posts | `apps/merchant-control-plane/src/components/merchantNavigation.ts:147-157` (`{path:'pages', label:'Content', children:[{path:'posts'}, {path:'comments'}]}`) | UI_CODE OK |
| 2 | Page/action | `apps/merchant-control-plane/src/app/[store]/posts/page.tsx:196-255` `handleSave()` POST/PATCH | UI_CODE OK |
| 3 | Same-origin proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/posts/route.ts:48-72` (POST), `.../[postId]/route.ts` (PATCH/DELETE) | PROXY_CODE OK |
| 4 | Ownership at proxy | `resolveOwnedStoreId(...)` — `apps/merchant-control-plane/src/app/api/stores/[store]/posts/route.ts:18,55` | PROXY_CODE OK |
| 5 | Typed API client | `createMerchantApiClient().blog.posts.create(...)` — same file line 59 | API_CLIENT_CODE OK |
| 6 | Gateway route | `services/api-gateway/src/routes/blog.ts:130` `POST /blog/posts` with `validate('json', CreateBlogPostSchema)` | GATEWAY_CODE OK |
| 7 | Auth issuer + authz | `c.get('auth')` → `resolveCustomUser` → `verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId)` — `blog.ts:134-141` | GATEWAY_CODE OK |
| 8 | Server-authoritative fields | `author_id = customUser.id`, `published_at = status==='published' ? now : null` — `blog.ts:149,158` | GATEWAY_CODE OK |
| 9 | DB write | `db.from('blog_posts').insert({...})` — `blog.ts:145-166`. Service-role client (`getSupabaseAdmin`) behind `verifySiteOwnership`. | DB_SCHEMA OK |
| 10 | RLS | `blog_posts` `ENABLE ROW LEVEL SECURITY` at `000_baseline.sql:24424`; policies `"Public can view published blog posts"` (`:23914`) and `"Store owners manage blog posts"` (`:24045`). **No `FORCE ROW LEVEL SECURITY`** anywhere for this table. | RLS_POLICY — see G-J-14 |
| 11 | Tags | `db.from('blog_post_tags').insert(...)` — `blog.ts:173-176`. **Tag rows are inserted with no ownership check on `tag_id`** (see G-J-13). | GATEWAY_CODE PARTIAL |
| 12 | Public gateway read (list) | `public-routes.ts:1226-1246` — `select(... )` `.eq('store_id', store.id).eq('status','published')` | GATEWAY_CODE OK |
| 13 | Public gateway read (detail) | `public-routes.ts:1249-1305` — same tenant + `status='published'` + `slug` filters; returns `content: {body, html, image, excerpt}` and `seo{}` | GATEWAY_CODE OK |
| 14 | Storefront data | `ContentService.listBlogPosts` / `getBlogPostBySlug` — `apps/storefront-runtime/src/lib/content-service.ts:110-126`, 60 s Next fetch revalidate + tags | SERVICE_CODE OK |
| 15a | **Storefront LISTING render** | `apps/storefront-runtime/src/app/store/[subdomain]/blog/page.tsx:79-101` builds `liquidPage._blog` and hands it to `StorefrontCompositionEngine`. **The React branch never reads `liquidPage`** (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:568` returns `null` unless `plan.rendererEngine === 'liquid'`). With Liquid OFF the plan falls to `resolveLegacyTemplate(store,'blog')` (`template-resolver.ts:284-288, 86-96`) = the store's home-page sections. **MISSING** | **BROKEN — G-J-01** |
| 15b | Storefront DETAIL render | `blog/[slug]/page.tsx:44-51` → `ContentResourceRenderer` with `fallbackSections:[createContentFallbackSection(resource)]` (`content-resource-renderer.tsx:29`, `theme-engine/content-route.ts:4-18`) → `core.rich-content` → `RichContentSection` → `RichContent`. Works on both engines. | OK |
| 16 | Cache invalidation on publish | **MISSING.** `bumpStorefrontCacheVersion` / `purgeStorefrontCache` are referenced from exactly one place — `services/api-gateway/src/routes/themes.ts:154-155` (theme publish). No blog/page/policy/navigation write bumps it. No `revalidateTag`/`revalidatePath` exists anywhere in `apps/storefront-runtime`, `apps/merchant-control-plane`, or `services/api-gateway`. | **G-J-02** |
| 17 | Tests | Liquid-only: `packages/theme-engine/test/liquid-l14-blog.test.ts`. **No test covers the React blog listing, the merchant blog CRUD, or the gateway blog route.** | MISSING |
| 18 | Runtime observation | Not performed. | UNVERIFIED_RUNTIME |

### 1.3 Scheduled publication — proof that it is dormant

1. `packages/cms-core/src/index.ts:663-664` — `status: z.enum(['draft','published','scheduled'])`, `scheduled_at: z.coerce.date().optional().nullable()`. Validation **accepts** it.
2. `database/supabase/migrations/000_baseline.sql:8556` — `scheduled_at timestamp with time zone` and `:8575` `CHECK (status = ANY (ARRAY['draft','published','archived','scheduled']))`. Column exists.
3. `services/api-gateway/src/routes/blog.ts:145-166` — the INSERT payload has **no `scheduled_at`** key. The value is dropped.
4. `services/api-gateway/src/routes/blog.ts:202-206` — the PATCH `allowed` array is
   `['title','slug','excerpt','content','content_html','featured_image','category_id','status','seo_title','seo_description','og_image_url','allow_comments','is_featured','is_pinned','reading_time_min']`.
   **`scheduled_at` is not in it** — it can never be set after creation either.
5. No worker publishes it: `services/queue-workers/src` contains `compliance.ts`, `executive-analytics.ts`, `incident-command.ts`, `index.ts`, `inventory-reservations.ts`, `money-ledger-reconciliation.ts`, `platform-queue-consumer.ts`, `push-dispatcher.ts`, `review-checks.ts`, `risk-scoring.ts`, `support-automation.ts`. The only `scheduled:` cron string is `services/queue-workers/src/index.ts:671` (incident postmortem reminder).
6. The public read filters `status='published'` (`public-routes.ts:1240, 1269`), so a `scheduled` row is invisible forever.
7. Neither merchant UI offers it: web `statusOptions` = draft/published/archived (`posts/page.tsx:62-66`); Flutter chips = draft/published (`post_editor_screen.dart:270-271`).

→ Reachable only by a direct API call, and then the post is written but never published. **DORMANT_FLAGGED.**

### 1.4 Slug uniqueness (PER SITE — correct)

DDL proof, `database/supabase/migrations/000_baseline.sql`:
- `:13583-13587` `ADD CONSTRAINT blog_posts_store_id_slug_key UNIQUE (store_id, slug)`
- `:13551-13555` `blog_categories_store_id_slug_key UNIQUE (store_id, slug)`
- `:13599-13603` `blog_tags_store_id_slug_key UNIQUE (store_id, slug)`
- `:15908-15912` `storefront_pages_store_id_slug_key UNIQUE (store_id, slug)`
- `:15924-15928` `storefront_policies_store_id_policy_type_key UNIQUE (store_id, policy_type)` — matches the `upsert(..., {onConflict:'store_id,policy_type'})` at `services/api-gateway/src/routes/pages.ts:452`
- `:14431-14435` `navigation_menus_store_id_handle_key UNIQUE (store_id, handle)`

**No global unique slug exists.** Tenancy is correct here.

Caveat (G-J-12): none of these uniques is a partial index on `deleted_at IS NULL`, and delete is a soft
delete (`storefront_pages` → `deleted_at` + `status='archived'`, `pages.ts:755-759`; `blog_posts` → only
`status='archived'`, `blog.ts:262-265`). A slug is therefore **permanently burned** after archive, and the
retry surfaces as a raw `500 DB_ERROR` with the Postgres constraint text (`blog.ts:168-170`,
`pages.ts:398-400`).

### 1.5 Blog comments — structurally dead

- Merchant read/moderate: `services/api-gateway/src/routes/blog.ts:454-578` (`GET /comments`, `PATCH /comments/:id`, `DELETE /comments/:id`).
- Merchant UI: `apps/merchant-control-plane/src/app/[store]/comments/page.tsx`; Flutter `blog_screen.dart:73, 140-155`.
- **There is no `POST` comment route** — not in `blog.ts`, not in `services/api-gateway/src/routes/storefront/public-routes.ts` (the only public POST there is `/:subdomain/contact`, `:1308-1318`).
- **There is no storefront comment form** — `grep -rn "comment" apps/storefront-runtime/src --include=*.tsx -l` returns nothing.
- `blog_posts.allow_comments` and `comment_count` columns exist (`000_baseline.sql:8567,8564`); `blog_comments` RLS has an `"Authenticated users create comments"` INSERT policy (`:23860`) with no client.

→ **G-J-03.**

---

## 2. Scope B — PAGES AND POLICY PAGES

### 2.1 Two competing page tables (duplicate authority)

`services/api-gateway/src/routes/pages.ts` writes **`storefront_pages` first** and falls back to a legacy
**`pages`** table on `isMissingTableError`/`isSchemaMismatchError`:
- list: `:283-333` (new) → `:308-333` (legacy)
- create: `:347-402`
- patch: `:631-734`
- delete: `:742-809`

Both tables exist in the baseline (`storefront_pages` at `000_baseline.sql:12284`; `pages` RLS enabled at
`:25347`). Read side: `services/api-gateway/src/routes/storefront.ts:1161-1182` also falls back
(`listLegacyStorefrontPages`). This is a live dual-write/dual-read authority split. **G-J-11.**

### 2.2 Page trace (custom page)

| Link | Evidence | Status |
|---|---|---|
| Entry (store type) | Online Store → Store pages — `merchantNavigation.ts:167` | OK |
| Entry (portfolio/landing/blog types) | Content → Pages — `merchantNavigation.ts:185, 222, 239` | OK |
| UI (A) | `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx` (830 L) — tabs Pages / Policies / Navigation | UI_CODE |
| UI (B) | `apps/merchant-control-plane/src/app/[store]/pages/page.tsx` (526 L) — a **second, simpler** page editor (title/slug/body only, `PageFormData` at `:38-45`) hitting the same proxy | **duplicate — G-J-11** |
| Proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/pages/route.ts`, `.../pages/[pageId]/route.ts` | PROXY_CODE |
| Gateway | `services/api-gateway/src/routes/pages.ts:336` POST, `:624` PATCH, `:736` DELETE | GATEWAY_CODE |
| Authz | `requireOwnedStore` → `resolveCustomUser` + `verifySiteOwnership` — `pages.ts:131-153` | OK |
| Revisions | `ensurePageRevision` → `storefront_page_revisions` with monotonic `revision_number`; `published_revision_id` set only when status is published — `pages.ts:155-190, 366-369, 680-683` | OK |
| Nav sync | `syncPageNavigationItem` — creates/updates/soft-deletes a `navigation_menu_items` row in the `main` menu — `pages.ts:228-274` | OK, but see G-J-08 |
| Public read | `GET /storefront/:subdomain/pages/:slug` — `public-routes.ts:1159-1197` → `loadStorefrontPageBySlug` (`storefront.ts:1184-1221`), tenant + `status='published'` + `deleted_at IS NULL`, resolves the published revision | OK |
| Storefront route | `apps/storefront-runtime/src/app/store/[subdomain]/[...path]/page.tsx` (single-segment slug only, `:44`) | OK |
| Render | `ContentResourceRenderer` → fallback `core.rich-content` → `RichContent` | OK |
| Cache invalidation | **MISSING** (see G-J-02) | MISSING |
| Tests | `services/api-gateway/src/__tests__/tenant-isolation.test.ts:153-156` asserts the tenant filters exist in the route **source text**. No functional page test. | PARTIAL |

### 2.3 Policy pages — the contradiction (P0 for an India launch)

There are **two independent policy systems** and the discoverable one is not the one the storefront reads.

**System 1 — `storefront_policies` (the one the storefront reads).**
- Write: `services/api-gateway/src/routes/pages.ts:431-461` (`POST /pages/policies`, upsert on `store_id,policy_type`), `:463-515` (PATCH), `:517-545` (soft DELETE).
- Types allowed: `privacy | refund | shipping | terms | contact | custom` — `packages/cms-core/src/index.ts:36` and DB CHECK `000_baseline.sql:12324`.
- Merchant UI: **Online Store → Store pages → Policies tab** — `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:62-83, 325-373`.
- Proxy: `apps/merchant-control-plane/src/app/api/stores/[store]/policies/route.ts` + `[policyId]/route.ts`.
- Public read: `GET /storefront/:subdomain/policies/:policyType` — `public-routes.ts:1117-1156` → `loadStorefrontPolicy` (`storefront.ts:1238-1241`), `status='published'`.
- Storefront routes: `/privacy`, `/terms`, `/shipping`, `/returns` — each calls
  `ContentService.getPolicy(subdomain, '<type>')` then falls back to `getPageBySlug`, else `notFound()`:
  `apps/storefront-runtime/src/app/store/[subdomain]/privacy/page.tsx:44-46`,
  `.../terms/page.tsx:44-46`, `.../shipping/page.tsx:44-46`,
  `.../returns/page.tsx:44-47` (tries `refund` then `returns` then the `returns` page slug).

**System 2 — `sites.*_policy` columns (a dead end).**
- Merchant UI: **Settings → Policies** — `apps/merchant-control-plane/src/app/[store]/settings/policies/page.tsx`.
  Fields `refund_policy`, `privacy_policy`, `terms_of_service`, `shipping_policy` (`:36-69`).
  It PATCHes `/api/stores/:store/settings` (`:165-169`).
- Gateway: `services/api-gateway/src/routes/stores.ts:720-732` — those four keys are in the `allowed`
  update list and are written straight onto `sites`.
- **Nothing reads them.** `grep -rn "refund_policy|privacy_policy|terms_of_service|shipping_policy"` across
  `apps services packages database tests` returns only: this merchant UI, `stores.ts:723`, and unrelated
  app-marketplace `privacy_policy_url` fields. `apps/storefront-runtime` has **zero** hits.
- The UI actively claims otherwise: `settings/policies/page.tsx:226-229` —
  *"Policies appear on your storefront … These policies appear on storefront policy pages and during checkout."*

→ A merchant who completes Settings → Policies (reachable from the settings index,
`apps/merchant-control-plane/src/app/[store]/settings/page.tsx:51` `itemHrefs: ['domains','notifications','policies']`)
believes their store is compliant, and every policy URL 404s. **G-J-04 [HIGH-STAKES].**

### 2.4 Are default policy pages seeded at onboarding? NO.

- `services/api-gateway/src/routes/onboarding.ts` endpoints: `/start` (`:103`), `/status` (`:171`),
  `/mobile-progress` (`:199`), `/:attemptId/step/:step` (`:276`), `/:attemptId/complete` (`:369`),
  `/check-subdomain` (`:483`), `/templates` (`:508`). **No `storefront_policies` / `storefront_pages`
  reference in the file** (grep for `policy|policies|privacy|terms|shipping|refund|page` returns nothing).
- `services/api-gateway/src/routes/stores.ts` — no `storefront_policies` / `storefront_pages` /
  `seedDefault` reference.
- Migrations — the only `storefront_policies` / `storefront_pages` statements besides DDL are the
  `update_updated_at` triggers (`000_baseline.sql:20445-20455`). **No seed INSERT, no seed function.**
- Repo-wide: `grep -rn "policy_type" … | grep -iE "insert|seed|default"` → **no matches.**

→ Every new store starts with 0 policy pages, and the footer policy links are empty because the
`policies` navigation menu is never created either (see §3). **G-J-05.**

### 2.5 Preview / SEO / templates for pages and posts

- **Preview:** there is no page/post preview route. The only preview machinery is theme preview
  (`apps/merchant-control-plane/src/app/api/themes/[themeId]/preview-session/route.ts`,
  `apps/storefront-runtime/src/lib/theme-preview-server.ts`, `?theme_preview_token=` handled on
  `privacy/terms/shipping/returns/[...path]`). Drafts are simply unreachable on the storefront
  (`status='published'` filters). **MISSING** → G-J-09.
- **SEO fields:** `seo_title` / `seo_description` are in `CreatePageSchema`/`UpdatePageSchema`
  (`packages/cms-core/src/index.ts:19-20, 30-31`), in `CreatePolicySchema` (`:49-50`), in the blog schemas
  (`SeoSchema.shape` spread, `:672, 692`), stored in `storefront_pages.seo` / `storefront_policies.seo`
  jsonb, and consumed by `generateMetadata` on every storefront route. **No web merchant UI exposes them**
  — `grep -n "seo_title|seo_description|featured_image|category_id|tag"` across the three web CMS pages
  returns only `posts/page.tsx:41` (a type field, never rendered). The Flutter post editor **does** expose
  them (`post_editor_screen.dart:27-28, 56-59, 99`). **G-J-10.**
- **Templates:** `assigned_template_key` exists on `storefront_pages` and is honoured by
  `resolveStorefrontTemplate` (`content-resource-renderer.tsx:28`), but no merchant UI sets it and no
  gateway route accepts it in `CreatePageSchema`/`UpdatePageSchema`. **NOT_IMPLEMENTED at the merchant level.**

---

## 3. Scope C — NAVIGATION / MENUS, DOMAINS, STOREFRONT SETTINGS

### 3.1 Navigation

| Link | Evidence |
|---|---|
| Merchant UI | `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:375-395` (Navigation tab) — hard-codes `location = 'main'` and `name: 'Main menu'` |
| Proxy | `apps/merchant-control-plane/src/app/api/stores/[store]/navigation/[location]/route.ts` (PUT) and `.../navigation/route.ts` (GET) |
| Gateway | `services/api-gateway/src/routes/pages.ts:547-572` (GET), `:574-622` (PUT replace) |
| Menu autocreate | `ensureNavigationMenu` — `pages.ts:192-226` |
| Public read | `GET /storefront/:subdomain/navigation?location=` — `public-routes.ts:1022-1055` → `loadNavigationMenu` (`storefront.ts:1243-1288`), falls back to `show_in_nav` legacy pages |
| Storefront consumption | `apps/storefront-runtime/src/lib/store-service.ts:486-492` fetches `main`, `footer`, **and `policies`**; footer renders `store.navigation?.policies` (`apps/storefront-runtime/src/components/layout/dynamic-footer.tsx:68`) |
| DB | `navigation_menus` (`000_baseline.sql:9855`), `navigation_menu_items`; RLS enabled `:25122, :25148` with owner-manage + public-read policies |

Confirmed defects:

1. **Hierarchy is destroyed on every save (G-J-06).** `pages.ts:588-614` soft-deletes every existing item
   (`update({deleted_at, is_visible:false})`) and then **inserts fresh rows with new UUIDs**, while copying
   the client's `parent_item_id` verbatim (`:605`). Those parent ids refer to the rows that were just
   soft-deleted. `buildPublicNavigationTree` (`packages/cms-core/src/index.ts:723-751`) only links a child
   when `nodes.has(item.parent_item_id)`, and the public loader filters `deleted_at IS NULL`
   (`storefront.ts:1264`) — so orphaned children are silently promoted to root. Sub-menus flatten on every
   save. The merchant UI does not currently emit `parent_item_id` (its `NavigationItem` type has no parent
   field, `online-store/pages/page.tsx:34-42`), so the bug is latent today but the API is broken.
2. **Only `main` is editable (G-J-07).** The storefront reads `footer` and `policies` menus
   (`store-service.ts:486-492`) but no merchant surface can create them, and nothing seeds them. Footer
   policy links are therefore permanently empty.
3. **`show_in_nav` is not persisted on `storefront_pages`.** The column is not in the table DDL
   (`000_baseline.sql:12284-12302`) nor in any `select` in `pages.ts`. `normalizeStorefrontPageRecord`
   derives `show_in_nav: Boolean(row.show_in_nav)` → always `false` on read
   (`packages/cms-core/src/index.ts:528`). PATCH uses `body.show_in_nav ?? previous.show_in_nav`
   (`pages.ts:678`) where `previous.show_in_nav` is always `false`. **Any client that PATCHes a page without
   re-sending `show_in_nav: true` silently removes it from the main menu** (`syncPageNavigationItem`
   soft-deletes at `pages.ts:249-257`). The `online-store/pages` UI happens to spread the whole draft
   (`:259-263`) so it survives; the second editor at `[store]/pages/page.tsx` sends only title/slug/body →
   it will silently unlink the page from navigation. **G-J-08.**
4. `navigation_menus.status` must be `'active'` for the public read (`storefront.ts:1250`) and
   `ensureNavigationMenu` inserts `status:'active'` (`pages.ts:219`) — consistent. OK.

### 3.2 Subdomain routing `{store}.letbuyy.com`

| Link | Evidence | Status |
|---|---|---|
| Middleware | `apps/storefront-runtime/src/proxy.ts` (379 L), matcher `:54-56` | OK |
| Host resolution | `resolveAccess(host)` → `GET {gateway}/v1/internal/store-access/resolve?host=` with `x-internal-api-secret` — `proxy.ts:99-120` | OK |
| Fail-closed | `backendConfig()` returns `null` when `LETBUYY_API_BASE_URL`/`INTERNAL_API_SECRET` is unset and every caller denies (`proxy.ts:58-85`) | GOOD (SEC-R1) |
| Gateway resolver | `services/api-gateway/src/routes/internal-store-access.ts:30-57`; internal auth via `timingSafeEqualText` on `INTERNAL_API_SECRET` or `verifyInternalAppRequest(c,'storefront')` (`:17-28`) | OK |
| Tenant lookup | `resolveStorefrontSiteByHost` — `services/api-gateway/src/middleware/store-context.ts:201-258` | OK |
| Custom-domain gate | `.eq('custom_domain', parsed.domain).eq('custom_domain_status','active')` — `store-context.ts:223-224`; secondary/redirect via `site_domains` `.eq('status','active')` `:236` | **GOOD — unverified domains do not route** |
| Rewrite | `rewriteToStore` → `/store/<subdomain>/…` — `proxy.ts:191-198` | OK |
| Canonical redirect | subdomain → custom domain only when `custom_domain_status === 'active'` — `proxy.ts:329-338` | OK |
| Direct `/store/<subdomain>` access | Denied in the middleware (`proxy.ts:285` comment + guard) | OK |

### 3.3 Custom domains

| Link | Evidence |
|---|---|
| Merchant UI | `apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx` (280 L) |
| Proxies | `apps/merchant-control-plane/src/app/api/stores/[store]/domains/route.ts` (GET list / GET search / POST connect), `.../domains/[domain]/route.ts`, `.../domains/[domain]/[action]/route.ts` (POST verify / POST primary, GET history) |
| Gateway | `services/api-gateway/src/routes/custom-domains.ts` (689 L): `POST /domains` `:150`, `POST /domains/verify` `:260`, `GET /domains/:domain/status` `:352`, `POST /domain-reviews/:reviewId/decision` `:411`, `DELETE /domains/:domain` `:443`, `GET /domains` `:483`, `POST /domains/:domain/primary` `:540`, `PATCH /domains/:domain` `:562`, `GET /domains/:domain/history` `:590` |
| Ownership challenge | TXT `_letbuyy-challenge.<domain>` = random token — issued `custom-domains.ts:177, 246`; verified `:282-287` requiring **≥ 2 matching TXT answers** (`txtMatches.length < 2`) |
| CNAME check | `resolveDoh(domain,'CNAME')` + `dnsAnswerMatchesTarget(answer, cnameTarget)` — `:294-295`; target from `CUSTOM_DOMAIN_CNAME_TARGET` / `NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET` (`services/api-gateway/src/lib/custom-domain-config.ts:16-22`, throws when unset) |
| SSL / provider | `attachVercelProjectDomain` + `readVercelDomainStatus` — `:307-321` (`services/api-gateway/src/lib/vercel-domains.ts`) |
| Abuse screening | `screenCustomDomainClaim` — `services/api-gateway/src/lib/custom-domain-abuse.ts`; protected-brand list `:20-35`, phishing fragments `:38-47`, homoglyph skeleton `:49-57`. `reject` → 422 + `site_domain_reviews` row; `review` → status `review` + human decision route gated by `X-Platform-Console-Token` (`custom-domains.ts:411-414`) |
| Multi-domain mirror | `upsertSiteDomain` / `patchSiteDomainStatus` / `recordDomainVerification` — `services/api-gateway/src/lib/site-domains.ts` |
| Reconciler | `services/api-gateway/src/routes/internal-custom-domain-reconcile.ts`; test `tests/contracts/custom-domain-reconciler.test.ts` |
| Tests | `tests/contracts/custom-domains.test.ts`, `custom-domain-abuse-screening.test.ts`, `vercel-domain-attach.test.ts`, `apex-mx-warning.test.ts`, `reserved-subdomain.test.ts`, `tests/migrations/custom-domains-store-access.test.mjs` |

**Domain-takeover risk assessment:** routing is safe — `custom_domain_status='active'` is required
(`store-context.ts:224`) and `active` is only reachable through the TXT+CNAME+Vercel path. However:

- **Pre-claim squatting (G-J-15).** `POST /domains` writes `sites.custom_domain = domain` with status
  `pending` **before any ownership proof** (`custom-domains.ts:192-200`), and a later claim by another site
  returns `409 DOMAIN_TAKEN` (`:173-175`). Merchant A can therefore permanently block Merchant B from ever
  connecting a domain B actually owns, with no expiry on the pending claim and no self-service release.
- **Silent replacement of a live domain.** The same `update` overwrites an existing `custom_domain` and
  resets `custom_domain_status` to `pending` with no guard for a currently-`active` value. The subdomain →
  custom-domain canonical redirect (`proxy.ts:329-338`) stops firing immediately.
- Provider credentials (`REGISTRAR_*`, Vercel token/project, `CUSTOM_DOMAIN_CNAME_TARGET`) are **not** in
  `services/api-gateway/wrangler.toml` — deploy-time only. **BLOCKED_EXTERNAL** for runtime verification.

### 3.4 "Buy a new domain" — UI_ONLY

- UI copy: *"Search for a new domain, pay securely, and LetBuyy registers and auto-connects it."* and
  *"Buying registers the domain and connects DNS automatically — no records to copy."* —
  `apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx:226-247`.
- The panel renders **a search box, a price quote and a badge. There is no purchase button**
  (`:229-249`) and **no purchase proxy** — `apps/merchant-control-plane/src/app/api/stores/[store]/domains/`
  contains only list/search/connect/verify/primary/history.
- Gateway `POST /v1/domains/purchase` exists (`services/api-gateway/src/routes/domains.ts:84-206`) and:
  - takes `payment_reference` as a **client-supplied string** (`:27`) and records it on `domain_orders`
    with `payment_provider: 'razorpay'` (`:130-131`) **without verifying any Razorpay payment**;
  - in `external_reference` mode the "checkout status" is literally `'reference_recorded'` (`:118`).
  - The contract test only asserts the *string* `payment_provider: 'razorpay'` is present in the source
    (`tests/contracts/buy-a-domain.test.ts:43`) — it does not test payment verification.
- `createDomainRegistrarProvider` defaults to `resellerclub` and throws without credentials
  (`services/api-gateway/src/lib/registrar/index.ts:298-315`), so `GET /domains/search` returns
  `503` unless `REGISTRAR_*` is configured (`domains.ts:79-81`).

→ **G-J-16** (UI promise with no path) and **G-J-17 [HIGH-STAKES]** (unverified payment reference).

---

## 4. Scope D — THEMES

### 4.1 Current live renderer default — React. PROVEN.

- `packages/theme-engine/src/theme-governance.ts:14` — `export const THEME_LIQUID_RENDERING_DEFAULT_ENABLED = false;`
- `:16-21` — `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION = { status: 'deferred', authority: 'ARB', reason: 'Liquid remains per-theme canary only until render-parity, security, SSTI/XSS, and performance evidence is green.' }`
- `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:241-246` — `liquidEnabled = options.liquidEnabled ?? resolveThemeLiquidRenderingEnabled({templateConfig, defaultEnabled: THEME_LIQUID_RENDERING_DEFAULT_ENABLED})`.
- Dev-only override `?engine=liquid|react` is hard-disabled in production (`template-resolver.ts:228-233`).
- `apps/storefront-runtime/src/lib/store-service.ts:676-683` — safe default `undefined`, not `false`.

### 4.2 The switch — and how the gate can be bypassed [HIGH-STAKES]

`resolveThemeLiquidRenderingEnabled` (`packages/theme-engine/src/theme-governance.ts:144-182`) resolves in
this order:

1. **`explicitEngine` — returns `true` immediately** if any of
   `templateConfig.rendererEngine`, `releaseManifest.renderer_engine`, `releaseManifest.rendererEngine`,
   `rendererManifest.engine` equals `'liquid'` (`:154-160`). **This is checked before the canary flags.**
2. Canary candidates: `templateConfig.liquidRenderingCanary`, `themeSettings.liquidRenderingCanary` /
   `liquid_rendering_canary`, and the same keys on the release manifest (`:162-179`).
3. Default `false`.

Two ways the ARB-deferred gate opens without ARB:

- **(a) Publish auto-stamps Liquid.** `services/api-gateway/src/execution/theme-execution.adapter.ts:643-648`:
  ```
  const liquidBundle = resolveLiquidBundleArtifact(input.releaseConfig);
  const rendererEngine = liquidBundle ? 'liquid' : (rendererManifest.engine ?? 'json-contract');
  ```
  and `:669` writes `renderer_engine: rendererEngine` into `release_manifest`. **Any release whose config
  carries a `liquidBundle` flips that store to Liquid on publish** — no canary check, no ARB check.
- **(b) The merchant supplies both.** The merchant-control-plane editor proxies explicitly read
  `liquidBundle` and `liquidRenderingCanary` **from the client request body** and merge them into the draft
  `template_config`:
  `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/draft/route.ts:23-35` and
  `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/route.ts:29-40`.
  The gateway accepts an **open record**: `template_config: z.record(z.string(), z.unknown())` —
  `packages/theme-engine/src/index.ts:985-991` (`SaveThemeDraftSchema`), same for `PublishThemeSchema`
  (`:992-1001`). No allowlist, no schema for the bundle at write time.

  → Any authenticated store owner can `POST /api/themes/<id>/editor/draft` with
  `{"liquidRenderingCanary": true, "liquidBundle": {…arbitrary Liquid templates…}}`, publish, and have the
  storefront execute merchant-authored Liquid.

**Mitigations that are genuinely present** (so this is a governance/control failure, not a proven RCE):
`LiquidThemePackageBundleSchema.safeParse` gates the read side
(`apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:110-125`); the Liquid engine is
sandboxed — `ownPropertyOnly: true`, `strictFilters: true`, `jsTruthy: false`, `outputEscape: 'escape'`,
`parseLimit: 300_000`, `renderLimit: 250`, `memoryLimit: 2_000_000`
(`packages/theme-engine/src/theme-renderer.ts:1371-1385`); and every rendered fragment goes through
`sanitizeRenderedHtml` (`:477, 611, 647, 911, 1351-1370`).

**G-J-18.**

### 4.3 Gates that governance requires before a Liquid flip — status

| Gate | Evidence | Verdict |
|---|---|---|
| Sanitizer | `packages/theme-engine/src/theme-renderer.ts:170-231` `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` — `USE_PROFILES:{html:true}` (allowlist profile), explicit `ADD_TAGS`/`ADD_ATTR`, `CUSTOM_ELEMENT_HANDLING.tagNameCheck` regex, `FORBID_ATTR:['style']`, `FORBID_TAGS:['base','embed','object','script']`; WHOLE_DOCUMENT variant `:233-237`; `outputEscape:'escape'` `:1379` | **GREEN — allowlist, not regex** |
| ~20 section ports | `THEME_LIQUID_PARITY_REQUIRED_SECTION_COUNT = 20` (`theme-governance.ts:15`) and `THEME_LIQUID_PORTABLE_SECTION_PARITY` lists exactly 20 pairs (`:23-44`). All 20 `liquidSectionType` values exist as files in `packages/theme-engine/examples/letbuyy-core-liquid/files/sections/` (42 files total, verified by listing). | **GREEN for the bundled example themes** |
| Parity/security/perf harness | `packages/theme-engine/test/liquid-l14-blog.test.ts`, `liquid-l15-page.test.ts`, `tests/theme-engine/storefront-liquid-runtime.test.mjs`, `tests/launch/lb-e9-template-resolution.test.mjs`, `tests/performance/storefront-cache.test.mjs` exist. I did **not** run them. | **UNVERIFIED_RUNTIME** |
| ARB decision | `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` (`theme-governance.ts:17`) | **Still deferred — do NOT recommend flipping** |

I am explicitly **not** recommending enabling Liquid. The code existing is not the gate.

### 4.4 ART-17 — CI ban on new React sections

- Validator: `scripts/validators/no-new-react-sections-validator.mjs`. It enumerates exactly 20 allowed
  paths under `apps/storefront-runtime/src/components/sections/` and flags **any other `.tsx`** in that
  directory as an offender ("React section registry is frozen; add Liquid sections instead").
- Reality check: `ls apps/storefront-runtime/src/components/sections/` → exactly **20 `.tsx` files**,
  matching the allowlist 1:1. **Compliant.**
- Registered renderer keys: `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` declares
  **21** `rendererKey` entries (`:59, 71, 83, 93, 99, 107, 123, 131, 137, 143, 149, 155, 161, 167, 173, 179, 185, 191, 197, 203, 209`) — 20 section components plus `core.header`/`core.footer`/`core.announcement-bar` mapping onto shared components.
- **Parity gap is inverted from the usual assumption:** Liquid has **42** section templates vs React's
  **20**. Liquid additionally covers `404-page`, `blog-listing`, `article-content`, `page-content`,
  `policy-content`, `collection-banner`, `collection-product-list`, `cart-summary`, `password-gate`,
  `search-box`, `spotlight`, and the full `customer-*` account set (account/addresses/login/orders/
  order-detail/register/settings/wishlist). **The React path has no blog-listing, no article-content, no
  page-content and no policy-content section at all** — that is the root cause of G-J-01 and the reason
  content routes depend on the generic `core.rich-content` fallback.

### 4.5 Theme editor — what a merchant can do

**Web** — `apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx` (1810 L):

| Capability | Evidence |
|---|---|
| Debounced autosave draft | `:784` comment + `saveDraft` `:954`; `POST /api/themes/[themeId]/editor/draft` |
| Live preview via signed session | `:1009` `POST /api/themes/[themeId]/preview-session`; token at `:1025`; storefront verifies at `apps/storefront-runtime/src/lib/theme-preview-server.ts` |
| Device preview | `PREVIEW_DEVICES` / `previewDevice` `:705, 765` |
| Publish (requires a clean saved draft) | `handlePublish` `:1079-1127`; refuses when dirty `:1081-1088` |
| Optimistic-concurrency conflict handling | 409 → `ConflictDialog`, autosave paused — `:998-1002`, `components/theme-editor/ConflictDialog.tsx` |
| Discard | `:1143-1150` |
| Per-template drafts | `:1131-1140` ("Template drafts are saved separately") |
| Releases + rollback | `apps/merchant-control-plane/src/app/api/themes/[themeId]/releases/route.ts`, `.../releases/[releaseId]/rollback/route.ts` |
| Duplicate / rename / archive / update | `api/themes/[themeId]/{duplicate,rename,archive,update,update-preview}/route.ts`; `online-store/themes/update/UpdatePageClient.tsx` |
| Section tree, schema form, app blocks, AI customization, translations | `components/theme-editor/{SectionTreePanel,SchemaFormRenderer,AppBlockSlotPanel,AICustomizationPanel,TemplateSwitcherPanel,ThemeUpdatePanel,ExperiencePicker,PreviewInspectorOverlay,CenterPanel,BlockChildRow}.tsx`; `online-store/themes/[themeId]/editor/translations/` |
| Theme install / library | `online-store/themes/page.tsx:146` (`GET /api/themes`), `:174, :227` (`POST /api/themes/install`), `:276` (`POST /api/themes/publish`) |

**Flutter** — `apps/mobile/merchant-app/lib/screens/customize/theme_screen.dart` (634 L),
`theme_versions_screen.dart`, `screens/editor/section_editor_screen.dart` (1200 L),
`services/theme_service.dart`, `theme_provider.dart`, `models/theme_editor_models.dart`. The gateway's
`SaveThemeDraftSchema.client` enum includes `'flutter-builder'`
(`packages/theme-engine/src/index.ts:990`), so the mobile editor is a first-class draft writer.
I did not trace the Flutter editor's full capability matrix — **UNKNOWN** whether it reaches feature parity
with the web editor.

### 4.6 ONE draft system? NO — governance violation

Three tables, all live:

| Table | DDL | Written by | Read by |
|---|---|---|---|
| `theme_editor_drafts` | `000_baseline.sql:12618`; UNIQUE `(store_id, theme_id)` `:16084-16088`; index `:18865-18868` | `services/api-gateway/src/execution/theme-execution.adapter.ts:979, 991, 1007, 1020, 1053, 1066, 1094, 1328, 1337, 1899` | same |
| `theme_instance_drafts` | `000_baseline.sql:12637` | `theme-execution.adapter.ts:454, 480, 487, 558, 613` | `theme-execution.adapter.ts:558`, `services/api-gateway/src/routes/storefront/public-routes.ts:477-483` |
| `theme_draft_patches` | `000_baseline.sql:12594` | `theme-execution.adapter.ts:504` — inserted on every instance-draft save with `operation.source = 'theme_editor_drafts.compat'` and `metadata.compatibility_snapshot = true` | **nothing** (documented as write-only: `docs/governance/theme-engine-governance.md:45`) |

The repo's own docs already record this as unresolved:
`docs/storefront-liquid-discovery/01_REPOSITORY_DISCOVERY.md:377` and `03_STOREFRONT_DISCOVERY.md:362`
("Two draft tables exist with unclear migration path … no deprecation path evident").
**G-J-19.**

### 4.7 Theme marketplace is frozen — CONFIRMED

- Not a deploy target: `grep -rn "theme-marketplace" .github/workflows/production-deploy.yml .github/workflows/staging-deploy.yml` → **no matches** (the same grep matches `marketing-site` at `production-deploy.yml:400`/`staging-deploy.yml:180` and `merchant-control-plane` at `:404`/`:186`).
- Not reachable from merchant nav: `grep -rn "theme-marketplace|theme_marketplace|themeMarketplace" apps/merchant-control-plane/src` → **no matches**.
- The merchant themes page talks only to `/api/themes*` → gateway `/v1/themes` (`online-store/themes/page.tsx:146, 174, 227, 276`).
- `apps/theme-marketplace/package.json:4` → `"private": true`.
- `apps/theme-marketplace/AGENTS.md` carries the standard "frozen roots are source-kept and de-deployed" clause.

### 4.8 Reserved roots (spot check within my scope)

`services/{checkout-runtime,event-bus,media-service,notification-service,analytics-pipeline,search-service}`
and `apps/mobile/{shopper-app,operator-app}` each contain **exactly** `AGENTS.md` + `runtime.manifest.json`.
**No constitutional violation observed.**

---

## 5. SECURITY — merchant-authored HTML on a public storefront [HIGH-STAKES]

### 5.1 Where merchant HTML enters

| Field | Written at | Max size |
|---|---|---|
| `blog_posts.content_html` | `services/api-gateway/src/routes/blog.ts:154` (create), `:203` (PATCH allowlist) | 150 000 (`packages/cms-core/src/index.ts:662`) — **no sanitization, no validation at write time** |
| `blog_posts.content` | `blog.ts:153` | 100 000 |
| `storefront_pages.content` (`{body}`) | `services/api-gateway/src/routes/pages.ts:344, 353` via `pageBodyToContent` | 200 000 (`cms-core:12`) |
| `storefront_policies.body` (`{body}`) | `pages.ts:446` | 200 000 |

Write-time posture: **store-raw**. `pageBodyToContent` is `{ body: body || '' }`
(`packages/cms-core/src/index.ts:503-505`) — no stripping. That is acceptable only if the render path
sanitizes, so I traced both render paths.

### 5.2 Render path 1 — Liquid (canary; sanitized)

1. Sections that emit merchant HTML use the `raw` filter (deliberately, because `outputEscape:'escape'`):
   - `packages/theme-engine/examples/letbuyy-core-liquid/files/sections/page-content.liquid:4` — `{{ page.body_html | raw }}`
   - `.../policy-content.liquid:4-5` — `{{ page.body_html | raw }}` / `{{ page.content | raw }}`
   - `.../article-content.liquid:6` — `{{ article.body_html | raw }}`
   - Same three files in `packages/theme-engine/examples/urban-kicks-liquid/files/sections/`.
2. Every rendered fragment is then sanitized: `packages/theme-engine/src/theme-renderer.ts:477`
   (`html: await sanitizeRenderedHtml(String(sectionHtml))`), `:611-647` (layout / chrome, WHOLE_DOCUMENT),
   `:911` (blocks), `:1113` (app embeds), `:1212-1213` (configured HTML).
3. `sanitizeRenderedHtml` (`:1351-1370`) uses DOMPurify over JSDOM with
   `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` (`:170-231`).
4. Only then does the sanitized string reach `dangerouslySetInnerHTML`
   (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:88-98`, the **only**
   `dangerouslySetInnerHTML` on a content path in the storefront).
5. Regression tests exist: `packages/theme-engine/test/liquid-l15-page.test.ts:54-58`
   ("page body_html is sanitized — XSS removed") and `liquid-l14-blog.test.ts:100-104` (article).

**Verdict: allowlist-based (DOMPurify `USE_PROFILES:{html:true}` + explicit ADD/FORBID lists + custom-element
tagNameCheck), NOT a regex. SEC-R11 / THEME-R4 satisfied on this path.** Residual observations:
`ADD_TAGS` includes `'iframe'` and `'meta'`, and `ADD_ATTR` includes `src`/`sandbox`/`content`
(`theme-renderer.ts:172-176, 200-218`). DOMPurify's default URI allowlist still applies, but a
merchant-authored `<iframe src="https://…">` is renderable. That is a product decision to confirm, not a
proven hole — recorded as **G-J-20 (LOW)**.

### 5.3 Render path 2 — React (the LIVE default; safe by over-stripping)

`ContentResourceRenderer` → `createContentFallbackSection` → `core.rich-content` →
`apps/storefront-runtime/src/components/sections/rich-content-section.tsx` →
`apps/storefront-runtime/src/components/content/rich-content.tsx`:

- `content.blocks` → typed React nodes, all values interpolated as JSX children (auto-escaped) `:43-76`;
  `image` blocks require `^https?://` `:66`.
- `content.body` → `paragraphNodes(body)` — split on blank lines, rendered as `<p>{paragraph}</p>` `:31-41, 88`.
- `content.html` → `paragraphNodes(stripHtml(html))` `:91`, where `stripHtml` `:23-29` removes
  `<script>`/`<style>` blocks and then **all tags**.
- **No `dangerouslySetInnerHTML` anywhere in this path** (the only three in the storefront are two
  JSON-LD blocks with `</` escaped — `product/[productId]/page.tsx:75`,
  `collections/[slug]/page.tsx:125` — and the Liquid one).

**Verdict: no stored-XSS on the live React path.** The trade-off is a UX defect: a merchant who writes any
HTML sees it flattened to plain text, and `content.body` HTML is rendered as literal escaped text. There is
also no rich-text editor anywhere — every web CMS body field is a bare `<Textarea>`
(`posts/page.tsx:501-508`, `online-store/pages/page.tsx`, `settings/policies/page.tsx:272-279`).
**G-J-21 (P2, UX/expectation).**

### 5.4 Cross-tenant content leakage — none found

Every read path is tenant-scoped:

| Read | Tenant filter |
|---|---|
| Blog list (merchant) | `.in('store_id', ownedStoreIds)` where `ownedStoreIds` comes from `listOwnedStoreIds` (`blog.ts:80, 89, 580-603`) |
| Blog detail (merchant) | `verifySiteOwnership(db, data.store_id, …)` after fetch (`blog.ts:122`) |
| Blog PATCH/DELETE | ownership re-checked from the row's `store_id` (`blog.ts:198, 258`) |
| Comments | `.eq('store_id', q.store_id)` + `verifySiteOwnership` (`blog.ts:464, 472`) |
| Pages/policies/navigation (merchant) | `requireOwnedStore(c, store_id)` then `.eq('store_id', …)` (`pages.ts:131-153` and every query) |
| Public blog | `.eq('store_id', store.id)` where `store` came from `loadPublishedStore(subdomain)` (`public-routes.ts:1240, 1268`) |
| Public pages/policies/navigation | `listStorefrontPages/Policies`, `loadNavigationMenu` all take `store.id` (`storefront.ts:1166, 1189, 1228, 1248, 1262`) |
| Storefront cache keys | namespaced by handle + a per-handle version (`services/api-gateway/src/lib/storefront-cache.ts:92-101`) |
| Liquid template LRU | per-render engine instance, keyed on source strings (`theme-renderer.ts:1348-1368` comment block) |

No `USING (true)` policy was found on any CMS table. Public-read RLS policies are all
`status='published' AND deleted_at IS NULL AND EXISTS(site…)` (`000_baseline.sql:23914, 25139, 25165, 27364, 27390`).

**However** — the gateway reaches all of these via `getSupabaseAdmin` (service-role), so RLS is a
defence-in-depth layer, not the enforcing layer, and **none of the CMS tables has
`FORCE ROW LEVEL SECURITY`**: 56 `FORCE ROW LEVEL SECURITY` statements exist across the migrations, and
none of them names `blog_*`, `storefront_page*`, `storefront_policies`, `navigation_menu*`, or `pages`.
`blog_posts`, `storefront_pages`, `storefront_policies`, `navigation_menus` **are** registered as tenant
tables (`services/api-gateway/src/tenant/tenant-tables.registry.ts:444, 2614, 2625, 1287`), so the registry
and the DDL disagree. **G-J-14.**

One tenant hole candidate: `POST /blog/posts` inserts `blog_post_tags` rows from client-supplied `tag_ids`
(`blog.ts:173-176`) and PATCH does the same (`:233-239`) with **no verification that each `tag_id` belongs
to the same store**. `blog_tags` is store-scoped (`blog_tags_store_id_slug_key`), so a merchant could
attach another tenant's tag id to their own post. Impact is limited (tag name/slug disclosure via the
`blog_post_tags(tag_id, blog_tags(...))` join at `blog.ts:118`). **G-J-13 [HIGH-STAKES] P2.**

---

## 6. Caching and invalidation (cross-cutting)

Two independent caches, **neither invalidated on content publish**:

1. **Gateway edge cache** — `services/api-gateway/src/lib/storefront-cache.ts`.
   `STOREFRONT_CACHE_TTL_SECONDS = 60`, `STOREFRONT_CACHE_SWR_SECONDS = 300` (`:12-13`);
   `Cache-Control: public, max-age=60, stale-while-revalidate=300` (`:24-26`);
   key includes a per-handle version fetched from KV (`:92-101`).
   `bumpStorefrontCacheVersion` (`:83-90`) is called from **exactly one** call site in the whole repo:
   `services/api-gateway/src/routes/themes.ts:154-155` (theme publish).
2. **Next.js data cache** — `storefrontReadInit(60, ['storefront:content', 'storefront:<sub>:<tag>'])`
   (`apps/storefront-runtime/src/lib/content-service.ts:80-87`) and `export const revalidate = 60` on
   `blog/page.tsx:20` and `[...path]/page.tsx:9`. `revalidateTag` / `revalidatePath` appear **nowhere** in
   `apps/storefront-runtime`, `apps/merchant-control-plane`, or `services/api-gateway`.

→ Publishing a post/page/policy or saving navigation is visible only after TTL expiry (60 s, up to ~360 s
with SWR, plus the Next 60 s layer). The tags are emitted (`Cache-Tag` header, `storefront-cache.ts:45`)
but never purged. **G-J-02.**

---

## 7. GAP LIST

Provisional IDs `G-J-nn`. Commander to renumber to `MCP-DISC-NNN`.

---

### G-J-01 — Blog listing renders the home page on the default React renderer
- **Domain:** Blog / storefront rendering
- **Status:** BROKEN
- **Impact:** A merchant publishes posts, the merchant UI shows "Published", and `/blog` on the live
  storefront shows the store's home-page sections. The blog is effectively unshippable on the default
  renderer. Blog is one of five first-class site types (`merchantNavigation.ts:251`).
- **Evidence:**
  - `apps/storefront-runtime/src/app/store/[subdomain]/blog/page.tsx:79-101` — builds `blogDrop` and passes it as `liquidPage._blog`; passes **no** `fallbackSections`.
  - `apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:568` — `if (plan.rendererEngine !== 'liquid' || !plan.liquidBundle) return null;` → `liquidPage` is unused in React mode.
  - `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:284-288` — with no `templateKey`, no `templates.blog`, no `fallbackTemplate`, the plan falls through to `resolveLegacyTemplate`.
  - `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:86-96` — `resolveLegacyTemplate` returns `store.templateConfig.sections` minus header/footer, i.e. the home page.
  - `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` — 21 renderer keys, **none** is a blog/article listing.
  - `packages/theme-engine/src/theme-governance.ts:14` — Liquid default OFF.
- **Expected:** `/blog` lists published posts on the default renderer.
- **Missing link / root cause:** no React `blog-listing` section renderer, and the blog route supplies no `fallbackSections` for the React plan. (`blog-listing.liquid` exists; the React twin does not.)
- **Blast radius:** every store whose site type is `blog` and every store storefront exposing `/blog`.
- **Invariant tag:** none
- **Severity:** P1 · **Likelihood:** HIGH
- **Dependencies:** ART-17 forbids adding a new React section file, so the fix must be either a Liquid canary for the blog template or a data-bound fallback section built from the existing frozen renderers.
- **Remediation approach:** decide the ownership question first (ARB): either (a) supply `fallbackSections` on the blog route composed from already-frozen renderer keys and bind the article list through `buildSectionDataPlan`, or (b) gate `/blog` behind a per-theme Liquid canary and return an honest empty state on React. Do not add a new file under `apps/storefront-runtime/src/components/sections/`.
- **Acceptance criteria:** with `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`, a published post appears at `/blog` with title, excerpt, image and a link to `/blog/<slug>`; a store with zero posts renders an empty state, not the home page.
- **Required tests:** E2E — publish post → GET `/blog` asserts the slug is present and home-page section markers are absent; unit — `resolveStorefrontTemplate({type:'blog'})` in React mode does not return the legacy home template.
- **Owner:** lead engineer + ARB (ART-17 interpretation)
- **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-02 — No cache invalidation on any content publish
- **Domain:** Blog / Pages / Policies / Navigation
- **Status:** PARTIAL
- **Impact:** Publishing or correcting content (including a legally required policy) is not visible for up to ~60 s at the gateway edge, up to ~360 s under stale-while-revalidate, plus a 60 s Next.js data-cache layer. A merchant who fixes a wrong price or a wrong policy cannot make it live on demand.
- **Evidence:**
  - `services/api-gateway/src/lib/storefront-cache.ts:12-13` TTL 60 / SWR 300; `:24-26` `Cache-Control`; `:83-90` `bumpStorefrontCacheVersion`.
  - Only call site repo-wide: `services/api-gateway/src/routes/themes.ts:154-155`.
  - `services/api-gateway/src/routes/blog.ts` (create `:145`, patch `:221`, delete `:262`), `services/api-gateway/src/routes/pages.ts` (create `:347`, patch `:665`, delete `:756`, policies `:439/:503/:538`, navigation `:600`) — **no cache call in any of them**.
  - `grep -rn "revalidateTag|revalidatePath" apps/storefront-runtime/src apps/merchant-control-plane/src services/api-gateway/src` → no matches.
  - Cache tags are emitted but never purged: `storefront-cache.ts:45`, `public-routes.ts:1073, 1103, 1144, 1185, 1243, 1302`.
- **Expected:** every mutation of published content bumps the tenant's storefront cache version (the mechanism already exists).
- **Missing link:** `bumpStorefrontCacheVersion(c, [handle])` is not called from the blog/pages/policies/navigation writers.
- **Blast radius:** all tenants; every content surface.
- **Invariant tag:** none
- **Severity:** P2 · **Likelihood:** HIGH
- **Dependencies:** requires the store handle in the write path (available via `verifySiteOwnership`'s site lookup).
- **Remediation approach:** call the existing `bumpStorefrontCacheVersion` after each successful content mutation; separately decide whether the Next.js layer needs a tag-purge webhook or should simply shorten `revalidate` for content routes.
- **Acceptance criteria:** a publish is reflected on the storefront on the next request (cache header shows MISS), verified for post, page, policy and navigation.
- **Required tests:** integration — mutate → assert `X-Storefront-Cache: MISS` and new body on the next read; extend `tests/performance/storefront-cache.test.mjs`.
- **Owner:** lead engineer · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-03 — Blog comment moderation has no submission path
- **Domain:** Blog
- **Status:** BACKEND_ONLY
- **Impact:** Merchant nav ships a "Comments" destination and a Flutter moderation tab that can never contain a row. Wasted merchant attention; `allow_comments`/`comment_count` are decorative.
- **Evidence:** gateway has only `GET/PATCH/DELETE /blog/comments*` (`services/api-gateway/src/routes/blog.ts:454, 499, 541`); no POST in `blog.ts` nor in `services/api-gateway/src/routes/storefront/public-routes.ts` (whose only public POST is `/:subdomain/contact` at `:1308`); `grep -rn "comment" apps/storefront-runtime/src --include=*.tsx -l` returns nothing; nav entries at `apps/merchant-control-plane/src/components/merchantNavigation.ts:155, 238`; RLS INSERT policy with no client at `database/supabase/migrations/000_baseline.sql:23860`.
- **Expected:** either a storefront comment form + rate-limited/Turnstile-gated public POST, or the moderation surface is hidden.
- **Missing link:** public comment creation endpoint and storefront form.
- **Blast radius:** blog site type.
- **Invariant tag:** none (becomes [HIGH-STAKES] the moment a public write is added — it needs Turnstile + rate limiting like `/contact`, `public-routes.ts:1311-1312`)
- **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** decide scope (founder). If out of scope, hide the nav entries. If in scope, model the public POST on the existing `/:subdomain/contact` handler including `requireValidTurnstile` and `sensitiveRateLimit`, defaulting to `status='pending'`.
- **Acceptance criteria:** either the Comments entry is absent for all site types, or a storefront submission lands as `pending` and appears in moderation.
- **Required tests:** E2E submit → moderate → appears/disappears on the storefront; abuse test for rate limit + Turnstile.
- **Owner:** founder (scope) then lead engineer · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-04 — Two policy systems; the discoverable one is a dead end
- **Domain:** Policies / Compliance
- **Status:** CONTRADICTORY_EVIDENCE
- **Impact:** [HIGH-STAKES] A merchant fills in Settings → Policies (refund/privacy/terms/shipping), sees "Policies saved" and copy asserting they appear on the storefront and at checkout, and `/privacy`, `/terms`, `/shipping`, `/returns` all return 404. For an India-first storefront this is a payment-gateway-onboarding and consumer-law exposure, not just a UX bug.
- **Evidence:**
  - Writer: `apps/merchant-control-plane/src/app/[store]/settings/policies/page.tsx:36-69` (keys), `:165-169` (PATCH `/api/stores/:store/settings`), `:226-229` (the false claim).
  - Gateway persists to `sites`: `services/api-gateway/src/routes/stores.ts:720-732` (`'refund_policy','privacy_policy','terms_of_service','shipping_policy'` in the `allowed` list) → `.from('sites').update(updates)` `:743-751`.
  - No reader: `grep -rn "refund_policy|privacy_policy|terms_of_service|shipping_policy" apps services packages database tests` → zero hits in `apps/storefront-runtime`.
  - Actual storefront source: `apps/storefront-runtime/src/app/store/[subdomain]/privacy/page.tsx:44-46` (and `terms`, `shipping`, `returns` equivalents) read `ContentService.getPolicy` → `GET /storefront/:sub/policies/:type` → `storefront_policies` (`services/api-gateway/src/routes/storefront.ts:1223-1241`), else `notFound()`.
  - The working writer lives elsewhere: Online Store → Store pages → Policies tab (`apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:325-373` → `POST/PATCH /v1/pages/policies`, `services/api-gateway/src/routes/pages.ts:431, 463`).
- **Expected:** one policy authority; the settings surface either writes it or does not exist.
- **Missing link / root cause:** `sites.*_policy` is a legacy field set that survived the `storefront_policies` migration; nothing bridges them.
- **Blast radius:** every merchant; all four required policy URLs; storefront footer.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P0 · **Likelihood:** HIGH
- **Dependencies:** G-J-05 (seeding), G-J-11 (duplicate page UIs).
- **Remediation approach:** pick `storefront_policies` as the single authority (it is the one the storefront reads and the one with revisions/status/SEO). Repoint Settings → Policies at `/v1/pages/policies`, backfill existing `sites.*_policy` text into `storefront_policies` under a reviewed migration, then retire the four `sites` columns from the `allowed` list. Do not add a second reader on the storefront.
- **Acceptance criteria:** saving in Settings → Policies makes `/privacy`, `/terms`, `/shipping`, `/returns` return 200 with that text; a single-writer validator forbids new writers of `sites.*_policy`.
- **Required tests:** E2E per policy type; contract test asserting `sites.*_policy` has no reader; migration test for the backfill.
- **Owner:** founder + lead engineer + CA-tax/legal review of the resulting default text
- **Reversibility:** reversible (backfill is additive; column retirement is the irreversible step and must be staged)
- **Confidence:** HIGH

---

### G-J-05 — No default policy pages are seeded at onboarding
- **Domain:** Policies / Onboarding / Compliance
- **Status:** NOT_IMPLEMENTED
- **Impact:** [HIGH-STAKES] Every new Indian storefront goes live with zero policy pages; the footer policy menu is also never created, so there is not even a broken link to signal the gap. Merchants must author privacy/terms/shipping/returns from scratch with no template.
- **Evidence:**
  - `services/api-gateway/src/routes/onboarding.ts` — endpoints at `:103, 171, 199, 276, 369, 483, 508`; no policy/page reference in the file.
  - `services/api-gateway/src/routes/stores.ts` — no `storefront_policies` / `storefront_pages` / seed reference.
  - Migrations — only `update_updated_at` triggers touch these tables (`database/supabase/migrations/000_baseline.sql:20445-20455`); `grep -rn "policy_type" … | grep -iE "insert|seed|default"` → no matches.
  - Storefront 404s when absent: `apps/storefront-runtime/src/app/store/[subdomain]/privacy/page.tsx:47` `if (!store || !resource) return notFound();`
  - Footer policy menu source is `navigation` location `policies` (`apps/storefront-runtime/src/lib/store-service.ts:489`, `components/layout/dynamic-footer.tsx:68`) — never created (see G-J-07).
- **Expected:** store creation seeds draft policy pages from India-appropriate templates (with merchant/GSTIN placeholders) plus a `policies` navigation menu.
- **Missing link:** a seeding step in store creation / onboarding completion.
- **Blast radius:** 100 % of new merchants.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P0 · **Likelihood:** HIGH
- **Dependencies:** G-J-04 (must resolve the authority first).
- **Remediation approach:** seed `storefront_policies` rows (status `draft`) for `privacy`, `terms`, `shipping`, `refund`, `contact` at store creation, from legally reviewed India-first templates, and create the `policies` navigation menu. Surface an onboarding checklist item until each is published. Templates must be reviewed by counsel/CA-tax, not drafted by engineering.
- **Acceptance criteria:** a freshly created store has five draft policies and a `policies` menu; publishing each makes the corresponding URL return 200; an unpublished policy shows a merchant-facing warning rather than a silent 404.
- **Required tests:** integration on store creation asserting the five rows and the menu; E2E publish → 200.
- **Owner:** founder + CA-tax / legal counsel (template text), lead engineer (mechanism)
- **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-06 — Navigation replace destroys menu hierarchy
- **Domain:** Navigation
- **Status:** BROKEN (latent — no UI emits parents today)
- **Impact:** Any client that saves a nested menu gets a flat menu back. Sub-menus are impossible via the API.
- **Evidence:** `services/api-gateway/src/routes/pages.ts:588-614` — soft-delete all items, then insert new rows with new UUIDs while copying the client's `parent_item_id` (`:605`) which points at the soft-deleted rows. Public loader filters `deleted_at IS NULL` (`services/api-gateway/src/routes/storefront.ts:1264`); `buildPublicNavigationTree` only nests when the parent is in the visible set (`packages/cms-core/src/index.ts:735-747`) — orphans are promoted to root (`:745`). The merchant UI currently has no parent field (`apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:34-42`), which is why this is not yet visible.
- **Expected:** hierarchy survives a replace.
- **Missing link:** no old-id → new-id remap (or no stable client-supplied keys) in the replace transaction.
- **Blast radius:** all menus once nesting is exposed.
- **Invariant tag:** none · **Severity:** P2 · **Likelihood:** MEDIUM (HIGH the day nesting ships)
- **Remediation approach:** make the replace order-aware — insert roots first, build an old→new id map from the client's provided ids, then insert children with remapped parents inside one transaction (or move the whole replace into a `SECURITY DEFINER` RPC).
- **Acceptance criteria:** PUT a two-level menu, GET it back with the hierarchy intact; the public navigation endpoint returns nested `children`.
- **Required tests:** gateway integration test for a nested replace round-trip.
- **Owner:** lead engineer · **Reversibility:** reversible · **Confidence:** MEDIUM (parent emission is not currently exercised)

---

### G-J-07 — Only the `main` menu is editable; `footer` and `policies` menus are unreachable
- **Domain:** Navigation
- **Status:** PARTIAL
- **Impact:** The storefront footer renders `store.navigation.footer` and `store.navigation.policies`; both are permanently empty because no merchant surface can create them and nothing seeds them.
- **Evidence:** reader `apps/storefront-runtime/src/lib/store-service.ts:486-492` (fetches `main`, `footer`, `policies`); footer consumption `apps/storefront-runtime/src/components/layout/dynamic-footer.tsx:64-68`; merchant UI hard-codes `main` (`apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx:213, 379-383`); gateway supports arbitrary locations (`services/api-gateway/src/routes/pages.ts:574`, `NavigationLocationSchema` `packages/cms-core/src/index.ts:66`).
- **Expected:** merchant can edit footer and policy menus.
- **Missing link:** location selector in the merchant UI + seeding.
- **Blast radius:** every storefront footer.
- **Invariant tag:** none · **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** add location tabs to the existing navigation editor (the gateway already accepts any location) and seed `footer`/`policies` alongside G-J-05.
- **Acceptance criteria:** merchant can add a footer link and a policy link and both render on the storefront.
- **Required tests:** E2E footer link round-trip.
- **Owner:** lead engineer · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-08 — `show_in_nav` is not persisted for `storefront_pages`; editing a page can silently unlink it from the menu
- **Domain:** Pages / Navigation
- **Status:** BROKEN
- **Impact:** A merchant marks a page "show in navigation", later edits it from the other page editor, and the page silently disappears from the main menu.
- **Evidence:** column absent from DDL `database/supabase/migrations/000_baseline.sql:12284-12302` and from every `select` in `services/api-gateway/src/routes/pages.ts` (`:285, 361, 633, 669`); `normalizeStorefrontPageRecord` computes `show_in_nav: Boolean(row.show_in_nav)` → always `false` (`packages/cms-core/src/index.ts:528`); PATCH resolves `body.show_in_nav ?? previous.show_in_nav` where `previous` is that always-false value (`pages.ts:678`); `syncPageNavigationItem` soft-deletes the nav item when `!page.show_in_nav` (`pages.ts:249-257`); the second page editor sends only `{title, slug, body}` (`apps/merchant-control-plane/src/app/[store]/pages/page.tsx:38-45`).
- **Expected:** the flag is stored and survives partial updates.
- **Missing link:** either a `show_in_nav` column on `storefront_pages`, or the nav item's existence should be the source of truth (do not delete when the field is absent from the patch).
- **Blast radius:** every page with `show_in_nav` on the new table.
- **Invariant tag:** none · **Severity:** P2 · **Likelihood:** MEDIUM
- **Remediation approach:** decide the authority (column vs nav-item presence). If a column, add it with a migration + rollback and include it in every select. If nav-item presence, make `syncPageNavigationItem` a no-op when `show_in_nav` is absent from the request rather than treating `undefined` as `false`.
- **Acceptance criteria:** set show-in-nav, PATCH only the title from the simple editor, and the nav item is still present.
- **Required tests:** gateway integration test for partial PATCH preserving nav membership.
- **Owner:** lead engineer · **Reversibility:** reversible · **Confidence:** MEDIUM-HIGH

---

### G-J-09 — No preview for pages, policies or posts
- **Domain:** CMS
- **Status:** NOT_IMPLEMENTED
- **Impact:** Merchants must publish to see how content looks. Combined with G-J-02 there is no safe way to check a policy before it goes public.
- **Evidence:** every public content read filters `status='published'` (`services/api-gateway/src/routes/storefront.ts:1167, 1191, 1229`; `public-routes.ts:1240, 1269`); no draft preview route exists under `apps/storefront-runtime/src/app`; the only preview machinery is theme preview (`apps/merchant-control-plane/src/app/api/themes/[themeId]/preview-session/route.ts`, `apps/storefront-runtime/src/lib/theme-preview-server.ts`) and it carries a theme token, not a content id.
- **Expected:** signed, short-lived draft preview per content resource.
- **Missing link:** preview token scope for content + a draft-aware read path.
- **Blast radius:** all CMS content.
- **Invariant tag:** none · **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** reuse the existing signed-preview primitive (`createStorefrontPreviewToken`, `packages/auth-core`) with a content scope; the storefront route reads the draft only when the token validates. Never relax the `status='published'` filter on the unauthenticated path.
- **Acceptance criteria:** a draft page is viewable only with a valid, expiring token and 404s without it.
- **Required tests:** contract test — draft URL without a token 404s; with a valid token 200s; expired token 404s.
- **Owner:** lead engineer + security review of the token scope · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-10 — SEO fields, cover image, categories and tags exist in the API but have no web merchant UI
- **Domain:** Blog / Pages / SEO
- **Status:** PARTIAL (web UI_ONLY gap; Flutter is ahead)
- **Impact:** Merchants cannot set the page/post title or description that actually drives search results, cannot attach a cover image, and cannot categorise posts from the web console.
- **Evidence:** schemas support them (`packages/cms-core/src/index.ts:19-20, 30-31, 49-50, 662-671`); `generateMetadata` consumes them (`apps/storefront-runtime/src/app/store/[subdomain]/blog/[slug]/page.tsx:27-30`, `[...path]/page.tsx:33-37`); gateway persists them (`services/api-gateway/src/routes/blog.ts:159-160`, `pages.ts:345, 646-652`); `grep -n "seo_title|seo_description|featured_image|category_id|tag"` across `apps/merchant-control-plane/src/app/[store]/{posts,pages}/page.tsx` and `[store]/online-store/pages/page.tsx` → only `posts/page.tsx:41` (an unrendered type field). Flutter **does** expose excerpt/featured image/category id/SEO title/SEO description (`apps/mobile/merchant-app/lib/screens/content/post_editor_screen.dart:22-28, 43-59, 90-99`).
- **Expected:** channel parity; SEO fields editable where the merchant works.
- **Missing link:** form fields in the three web CMS surfaces.
- **Blast radius:** organic discovery for every merchant on web-only workflows.
- **Invariant tag:** none · **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** add the fields to the single consolidated CMS editor produced by G-J-11 (not to both duplicates), with a media picker reusing `api/stores/[store]/themes/media-library`.
- **Acceptance criteria:** setting SEO title/description in the web console changes the rendered `<title>`/meta description on the storefront.
- **Owner:** lead engineer · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-11 — Duplicate authority: two page editors and two page tables
- **Domain:** Pages
- **Status:** CONTRADICTORY_EVIDENCE
- **Impact:** Two merchant surfaces edit the same resource with different field sets (one of which triggers G-J-08), and the gateway silently dual-paths between `storefront_pages` and a legacy `pages` table, so behaviour depends on which table exists in the deployed schema.
- **Evidence:**
  - UI A `apps/merchant-control-plane/src/app/[store]/online-store/pages/page.tsx` (830 L, pages+policies+navigation, sends `show_in_nav`/`page_type`).
  - UI B `apps/merchant-control-plane/src/app/[store]/pages/page.tsx` (526 L, title/slug/body only, `PageFormData` `:38-45`). Both are reachable: `merchantNavigation.ts:149` (Content → Pages) and `:167` (Online Store → Store pages).
  - Gateway dual-path: `services/api-gateway/src/routes/pages.ts:283-333` (list), `:347-402` (create), `:631-734` (patch), `:742-809` (delete); read side `services/api-gateway/src/routes/storefront.ts:1161-1182, 1215-1221`.
  - Both tables live: `storefront_pages` `database/supabase/migrations/000_baseline.sql:12284`; `pages` RLS `:25347`.
  - Root `AGENTS.md`/local `AGENTS.md` rule: *"Prefer completing the canonical owner over adding a parallel implementation."*
- **Expected:** one page editor, one page table.
- **Missing link:** a decision + migration retiring `pages` and one of the two editors.
- **Blast radius:** all page content; the nav-sync bug rides on it.
- **Invariant tag:** none · **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** declare `storefront_pages` canonical (it has revisions, SEO jsonb, template assignment), migrate any residual `pages` rows under a reviewed migration + rollback, delete the fallback branches, and keep exactly one merchant editor. Archive the removed UI under `docs/archive/dead-code/` per the existing dead-shell convention.
- **Acceptance criteria:** one route in the nav; zero `from('pages')` references in the gateway; a validator forbids reintroducing the legacy path.
- **Required tests:** migration test for the row move; contract test asserting the single writer.
- **Owner:** ARB (deletion law) + lead engineer · **Reversibility:** the table retirement is [IRREVERSIBLE] and must be staged behind a backup + rollback script · **Confidence:** HIGH

---

### G-J-12 — Soft delete permanently burns a slug and surfaces a raw DB error
- **Domain:** Blog / Pages
- **Status:** BROKEN
- **Impact:** A merchant archives "summer-sale", tries to recreate it next year, and gets a 500 with a Postgres constraint string.
- **Evidence:** non-partial uniques `database/supabase/migrations/000_baseline.sql:13583-13587` (`blog_posts`), `:15908-15912` (`storefront_pages`); soft delete only `services/api-gateway/src/routes/blog.ts:262-265` (`status='archived'`, `deleted_at` untouched) and `services/api-gateway/src/routes/pages.ts:755-759`; error passthrough `blog.ts:168-170` and `pages.ts:398-400` return `error.message` verbatim as a 500.
- **Expected:** a friendly 409 with a suggested slug, or a partial unique index scoped to live rows.
- **Missing link:** partial unique index (`WHERE deleted_at IS NULL`) and/or a pre-insert slug-conflict check.
- **Blast radius:** any merchant reusing a slug.
- **Invariant tag:** none · **Severity:** P3 · **Likelihood:** MEDIUM
- **Remediation approach:** decide whether archived slugs should be reclaimable. If yes, migrate the uniques to partial indexes (with `storefront_slug_redirects`, `000_baseline.sql:12331`, handling the old URL) and map `23505` to a 409 with a merchant-readable message.
- **Acceptance criteria:** recreating an archived slug either succeeds or returns 409 with guidance — never a 500 with SQL text.
- **Owner:** lead engineer · **Reversibility:** index change is reversible · **Confidence:** HIGH

---

### G-J-13 — Blog tag attach does not verify tag tenancy
- **Domain:** Blog / Tenancy
- **Status:** BROKEN
- **Impact:** [HIGH-STAKES] A merchant can attach another tenant's `blog_tags.id` to their own post; the merchant read joins `blog_tags(id, name, slug)` (`blog.ts:118`), disclosing the other tenant's tag name/slug.
- **Evidence:** `services/api-gateway/src/routes/blog.ts:173-176` (create) and `:233-239` (patch) insert `blog_post_tags` from client-supplied `tag_ids` with no `store_id` check. `CreateBlogPostSchema.tag_ids` is `z.array(UuidSchema).max(20)` (`packages/cms-core/src/index.ts:667`) — format only. `blog_tags` is store-scoped (`000_baseline.sql:13599-13603`). RLS is `ENABLE` only, and the gateway uses the service-role client, so RLS does not stop it.
- **Expected:** tag ids are validated to belong to `body.store_id`.
- **Missing link:** a tenant filter on the tag ids before insert.
- **Blast radius:** cross-tenant metadata disclosure; low volume, real principle violation.
- **Invariant tag:** [HIGH-STAKES] (tenancy)
- **Severity:** P2 · **Likelihood:** LOW (requires guessing a UUID) · but the invariant is unconditional
- **Remediation approach:** select the tag ids scoped to the store and reject any id not returned; alternatively push the attach into a `SECURITY DEFINER` RPC that enforces tenancy. Add `blog_post_tags` to the tenant-table registry checks.
- **Acceptance criteria:** attaching a foreign tag id returns 403/422 and writes nothing.
- **Required tests:** red-team test in `tests/security` / `tests/governance/d2-rls-red-team.test.mjs` style.
- **Owner:** security + lead engineer · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-14 — CMS tenant tables have RLS ENABLE but not FORCE
- **Domain:** Tenancy / RLS
- **Status:** PARTIAL (governance drift)
- **Impact:** [HIGH-STAKES] The Constitution's tenancy article requires ENABLE **+ FORCE** on tenant tables. Table owners and any future non-service-role path bypass RLS on these tables. Today the gateway uses the service-role client behind `verifySiteOwnership`, so RLS is defence-in-depth only — which is exactly why FORCE matters.
- **Evidence:** `ENABLE` present — `database/supabase/migrations/000_baseline.sql:24406` (blog_categories), `:24412` (blog_comments), `:24424` (blog_posts), `:24430` (blog_tags), `:25122` (navigation_menu_items), `:25148` (navigation_menus), `:25347` (pages), `:27332` (storefront_page_revisions), `:27347` (storefront_pages), `:27373` (storefront_policies). `FORCE ROW LEVEL SECURITY` appears **56 times** across the migrations and **none** of them names any of the above. Registry disagrees: `services/api-gateway/src/tenant/tenant-tables.registry.ts:444` (blog_posts), `:430` (blog_comments), `:1287` (navigation_menus), `:2614` (storefront_pages), `:2625` (storefront_policies) all declare `tenantColumn: "store_id"`.
- **Expected:** ENABLE + FORCE on every registered tenant table.
- **Missing link:** a FORCE migration for the CMS tables (a FORCE rollout clearly exists for other domains).
- **Blast radius:** all CMS tenant data.
- **Invariant tag:** [HIGH-STAKES] (tenancy)
- **Severity:** P1 · **Likelihood:** MEDIUM
- **Dependencies:** must not break the service-role gateway path — verify each table's owner-manage policy admits the gateway's role, or the gateway must switch to per-transaction tenant GUC for these tables.
- **Remediation approach:** ARB-reviewed migration adding `FORCE ROW LEVEL SECURITY` to the ten tables above with a matching rollback, plus a validator asserting registry ⊆ FORCE.
- **Acceptance criteria:** a red-team test proves zero rows are returned for these tables when the tenant GUC is unset; the 107-validator gate stays green.
- **Required tests:** extend `tests/executable/tenant-redteam-postgres.test.mjs` and `tests/governance/d2-rls-red-team.test.mjs`.
- **Owner:** security + ARB · **Reversibility:** reversible (rollback provided) · **Confidence:** HIGH

---

### G-J-15 — A custom domain is claimed before ownership is proven (squatting / self-DoS)
- **Domain:** Domains
- **Status:** BROKEN
- **Impact:** [HIGH-STAKES] (a) Merchant A submits `competitorbrand.in`; `sites.custom_domain` is written immediately, and the real owner's later attempt returns `409 DOMAIN_TAKEN` — a self-service denial of service with no expiry and no release path. (b) A merchant with a live custom domain who submits a second domain silently resets `custom_domain_status` to `pending`, killing the subdomain→domain canonical redirect.
- **Evidence:** `services/api-gateway/src/routes/custom-domains.ts:192-200` — `.update({custom_domain: domain, custom_domain_status: 'pending', custom_domain_verification_token})` executes **before** any TXT check (verification lives in a separate endpoint at `:260`). Uniqueness collision → `:166-175` returns `409 DOMAIN_TAKEN`. Redirect gate: `apps/storefront-runtime/src/proxy.ts:329-338` requires `custom_domain_status === 'active'`.
  Mitigating: routing itself is safe (`services/api-gateway/src/middleware/store-context.ts:223-224` requires `active`), and brand/phishing screening exists (`services/api-gateway/src/lib/custom-domain-abuse.ts:20-47`) but the protected-brand list is small and does not cover arbitrary third-party domains.
- **Expected:** an unverified claim must not consume the global namespace, and must not disturb an existing active domain.
- **Missing link:** claims should be recorded per-site as pending intents (the `site_domains` table already supports this) with the `sites.custom_domain` promotion happening only on successful verification; pending claims need a TTL.
- **Blast radius:** platform-wide domain namespace.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** MEDIUM
- **Remediation approach:** move the pending claim entirely into `site_domains` (status `pending`), keep `sites.custom_domain` for the verified primary only, allow multiple pending claims for the same domain across sites, and let verification decide the winner. Add a TTL/expiry sweep for stale pending claims and a support release path.
- **Acceptance criteria:** two sites can hold a pending claim on the same domain; only the site that proves TXT ownership is promoted; an existing active domain is untouched while a new claim is pending.
- **Required tests:** contract tests extending `tests/contracts/custom-domains.test.ts` for concurrent claims and for active-domain preservation.
- **Owner:** security + lead engineer · **Reversibility:** reversible · **Confidence:** MEDIUM-HIGH (routing safety verified; squatting inferred from the write order + 409 path)

---

### G-J-16 — "Buy a new domain" promises a purchase flow that does not exist
- **Domain:** Domains
- **Status:** UI_ONLY
- **Impact:** The domains settings page tells merchants they can pay and have LetBuyy register and auto-connect a domain. There is no buy button and no proxy. Merchants search, see a price, and hit a dead end.
- **Evidence:** copy `apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx:226-247`; the expanded panel renders only search + quote + badge (`:229-249`); `apps/merchant-control-plane/src/app/api/stores/[store]/domains/` has no purchase route; the gateway endpoint exists unreferenced (`services/api-gateway/src/routes/domains.ts:84`); search itself 503s without registrar credentials (`domains.ts:79-81` + `services/api-gateway/src/lib/registrar/index.ts:298-315`), and no `REGISTRAR_*` var appears in `services/api-gateway/wrangler.toml`.
- **Expected:** either a working purchase flow or honest copy.
- **Missing link:** the merchant purchase proxy + button, and registrar credentials.
- **Blast radius:** merchant trust; onboarding conversion.
- **Invariant tag:** none (becomes [HIGH-STAKES] on completion — see G-J-17)
- **Severity:** P2 · **Likelihood:** HIGH
- **Dependencies:** G-J-17 must be fixed before any purchase button ships.
- **Remediation approach:** founder decides scope. If deferred, change the copy to describe search-only and remove the pay claim. If shipped, wire the proxy **after** payment verification is real.
- **Acceptance criteria:** the UI describes only what the system does; no unreachable promise remains.
- **Owner:** founder (scope) · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-17 — Domain purchase records an unverified client-supplied payment reference
- **Domain:** Domains / Money-adjacent
- **Status:** BROKEN (currently unreachable from the UI, which caps the exposure)
- **Impact:** [HIGH-STAKES] `POST /v1/domains/purchase` accepts an arbitrary `payment_reference` string from the client, writes a `domain_orders` row stamped `payment_provider: 'razorpay'`, and then calls the registrar to actually buy a domain. No Razorpay signature or order lookup is performed. If this endpoint is ever exposed, a caller can trigger a real, paid registrar purchase with a fabricated payment reference.
- **Evidence:** `services/api-gateway/src/routes/domains.ts:27` (`payment_reference: z.string().min(3).max(180)`), `:118` (`checkoutStatus = 'reference_recorded'` for the non-sandbox mode), `:120-137` (upsert with `payment_provider:'razorpay'`), `:142-151` (registrar purchase + DNS + Vercel attach), `:153-161` (writes `sites.custom_domain` on success). The contract test only asserts the literal string `payment_provider: 'razorpay'` exists in the source (`tests/contracts/buy-a-domain.test.ts:43`).
  Compare with the money law in root `AGENTS.md`/CLAUDE.md: Razorpay signatures are verified server-side (HMAC-SHA256, `timingSafeEqualHex`) elsewhere in the codebase — that pattern is absent here.
- **Expected:** the server verifies the payment with the provider (or the whole purchase runs through the canonical order/ledger path) before spending money.
- **Missing link:** server-side payment verification.
- **Blast radius:** platform funds at the registrar; `domain_orders` integrity.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 (P0 the moment the UI wires it) · **Likelihood:** LOW today (no caller) / HIGH once exposed
- **Remediation approach:** payments-provider + ARB decision. The purchase must be preceded by a server-verified Razorpay payment (signature verification against the merchant-of-record account, or a platform order confirmed via webhook) and the domain fee must be modelled as a real order on the canonical ledger, not a free-text reference. **Never** recommend a direct money-table write. Until then, keep the route unexposed and consider gating it behind an internal token.
- **Acceptance criteria:** a purchase request with an unverifiable reference is rejected before any registrar call; a verified payment produces exactly one `domain_orders` row (idempotency key honoured) and one registrar order.
- **Required tests:** contract test asserting rejection on an unverified reference; idempotency test for duplicate submissions.
- **Owner:** payments-provider + ARB + security · **Reversibility:** reversible in code; a registrar purchase itself is [IRREVERSIBLE] · **Confidence:** HIGH

---

### G-J-18 — The Liquid canary gate is merchant-settable and auto-flips on publish
- **Domain:** Themes / ART-17 governance
- **Status:** BROKEN (governance control)
- **Impact:** [HIGH-STAKES] `THEME_LIQUID_PLATFORM_WIDE_FLIP_DECISION.status = 'deferred'` with `authority: 'ARB'`, yet the flip is reachable without ARB: (a) any published release whose config carries a `liquidBundle` is stamped `renderer_engine: 'liquid'`, which short-circuits the canary check; (b) the merchant-control-plane editor proxies read `liquidRenderingCanary` and `liquidBundle` straight from the client body and merge them into an unvalidated open-record `template_config`. A merchant can therefore ship arbitrary Liquid templates onto their live storefront.
- **Evidence:**
  - `packages/theme-engine/src/theme-governance.ts:14` (default false), `:16-21` (ARB deferred), `:154-160` (`explicitEngine.includes('liquid')` returns true **before** the canary candidates), `:162-179` (canary keys incl. `templateConfig.liquidRenderingCanary`).
  - `services/api-gateway/src/execution/theme-execution.adapter.ts:643-648` (`rendererEngine = liquidBundle ? 'liquid' : …`), `:669` (written into `release_manifest.renderer_engine`), `:672-675` (bundle embedded).
  - `apps/merchant-control-plane/src/app/api/themes/[themeId]/editor/draft/route.ts:23-35` and `.../editor/route.ts:29-40` — `mergeLiquidDraftConfig` lifts both keys from the request body.
  - `packages/theme-engine/src/index.ts:985-991` — `template_config: z.record(z.string(), z.unknown())`; same for `PublishThemeSchema` `:992-1001`. No allowlist.
  - Read-side flip: `apps/storefront-runtime/src/lib/theme-engine/template-resolver.ts:241-271`.
  - Mitigations (real, and why this is a control failure rather than a proven RCE): bundle shape validated at read time (`template-resolver.ts:110-125`); LiquidJS sandboxed with `ownPropertyOnly`, `strictFilters`, `jsTruthy:false`, `outputEscape:'escape'`, parse/render/memory limits (`packages/theme-engine/src/theme-renderer.ts:1371-1385`); all output sanitized (`:1351-1370`).
- **Expected:** the renderer engine is a platform-controlled, ARB-gated, per-theme decision. Merchant input must not be able to set it.
- **Missing link:** an allowlist on `template_config` keys (or explicit stripping of `liquidBundle`/`liquidRenderingCanary`/`rendererEngine` from merchant-supplied config), and a policy check before `buildReleaseArtifacts` stamps `renderer_engine: 'liquid'`.
- **Blast radius:** the storefront render engine for any store; the entire Liquid rollout plan.
- **Invariant tag:** [HIGH-STAKES]
- **Severity:** P1 · **Likelihood:** MEDIUM
- **Dependencies:** must not break the intended per-theme canary mechanism for platform-published Liquid themes.
- **Remediation approach:** ARB decision on who may set the engine. Strip renderer-control keys from any merchant-originated `template_config` at the gateway boundary; source `liquidBundle` only from a platform-verified theme package version; make `buildReleaseArtifacts` consult an explicit canary allowlist rather than inferring the engine from bundle presence. Do **not** relax the sanitizer to compensate.
- **Acceptance criteria:** a draft/publish request containing `liquidRenderingCanary` or `liquidBundle` from a merchant client is rejected or stripped; the storefront engine for that store stays React; a platform-flagged canary theme still flips.
- **Required tests:** contract test posting the two keys and asserting the stored config and the resolved engine; a governance validator forbidding renderer keys in merchant-writable config.
- **Owner:** ARB + security · **Reversibility:** reversible · **Confidence:** MEDIUM-HIGH (code paths verified statically; not exercised at runtime)

---

### G-J-19 — Three theme draft stores instead of one
- **Domain:** Themes
- **Status:** BROKEN (governance)
- **Impact:** Governance requires a single draft system (`theme_editor_drafts`). Every editor save writes `theme_editor_drafts`, mirrors into `theme_instance_drafts`, and appends a full-config snapshot to a write-only `theme_draft_patches` table. Divergence between the two draft stores is possible and there is no documented deprecation path.
- **Evidence:** `theme_editor_drafts` DDL `database/supabase/migrations/000_baseline.sql:12618` (+ UNIQUE `:16084-16088`), written at `services/api-gateway/src/execution/theme-execution.adapter.ts:979, 991, 1007, 1020, 1053, 1066, 1094, 1328, 1337, 1899`; `theme_instance_drafts` DDL `:12637`, written at `theme-execution.adapter.ts:454, 480, 487, 558, 613` and read at `services/api-gateway/src/routes/storefront/public-routes.ts:477-483`; `theme_draft_patches` DDL `:12594`, written at `theme-execution.adapter.ts:504` with `operation.source = 'theme_editor_drafts.compat'`, and documented as having no reader (`docs/governance/theme-engine-governance.md:45`). Prior discovery already flagged it: `docs/storefront-liquid-discovery/01_REPOSITORY_DISCOVERY.md:377`, `03_STOREFRONT_DISCOVERY.md:362`.
- **Expected:** one draft authority.
- **Missing link:** an ARB decision plus a migration path.
- **Blast radius:** theme editing for all merchants; preview correctness.
- **Invariant tag:** none · **Severity:** P2 · **Likelihood:** MEDIUM
- **Remediation approach:** ARB picks the authority; converge readers and writers onto it; either give `theme_draft_patches` a real reader (undo/replay) or retire it. Do not delete a table without a staged migration + rollback.
- **Acceptance criteria:** exactly one table is written on an editor save; the storefront preview reads that same table; a validator enforces it.
- **Owner:** ARB + lead engineer · **Reversibility:** table retirement is [IRREVERSIBLE] and must be staged · **Confidence:** HIGH

---

### G-J-20 — Sanitizer allows merchant-authored `<iframe>` and `<meta>` in Liquid output
- **Domain:** Themes / Security
- **Status:** PARTIAL (observation, not a proven hole)
- **Impact:** [HIGH-STAKES] Merchant-authored HTML that reaches the Liquid path can render an `<iframe src="https://…" sandbox=…>` and `<meta>` tags. DOMPurify's default URI allowlist still blocks `javascript:`, and `sandbox` is in `ADD_ATTR`, but an iframe is a clickjacking/consent-UI surface on a page that also hosts checkout links.
- **Evidence:** `packages/theme-engine/src/theme-renderer.ts:172-176` (`ADD_TAGS: [...LIQUID_HYDRATION_CUSTOM_ELEMENTS, 'iframe', 'meta']`), `:200-218` (`ADD_ATTR` includes `content`, `sandbox`, `src`, `href`, `name`, `type`), `:229-230` (`FORBID_ATTR:['style']`, `FORBID_TAGS:['base','embed','object','script']`). The first-party app-block renderer does emit a sandboxed iframe deliberately (`apps/storefront-runtime/src/lib/theme-engine/composition-engine.tsx:115-121`), which is presumably why the tag is allowed.
- **Expected:** confirmed product decision that merchant content may embed iframes, or the allowance is narrowed to the app-block path.
- **Missing link:** a stated policy separating platform-emitted markup from merchant-authored markup in the sanitizer config.
- **Severity:** P3 · **Likelihood:** LOW
- **Remediation approach:** security review. If iframes are only needed for app blocks, sanitize merchant content with a stricter config and keep the permissive config for platform-generated fragments.
- **Acceptance criteria:** a documented decision plus a test asserting the chosen behaviour for merchant-authored HTML.
- **Owner:** security · **Reversibility:** reversible · **Confidence:** MEDIUM (this is a policy question, not a demonstrated exploit)

---

### G-J-21 — No rich-text editing anywhere; HTML written by merchants is flattened on the live renderer
- **Domain:** CMS / UX
- **Status:** PARTIAL
- **Impact:** Every body field in the web console is a bare textarea. On the live React renderer, `content.html` is passed through `stripHtml` (all tags removed) and `content.body` is split into paragraphs and escaped by React — so a merchant who pastes formatted HTML gets plain text, and one who types HTML into the body sees the tags as literal text. Formatting is impossible for the majority of merchants.
- **Evidence:** editors — `apps/merchant-control-plane/src/app/[store]/posts/page.tsx:501-508`, `[store]/online-store/pages/page.tsx`, `[store]/settings/policies/page.tsx:272-279` (all `<Textarea>`); renderer — `apps/storefront-runtime/src/components/content/rich-content.tsx:23-29` (`stripHtml`), `:88` (`paragraphNodes(body)`), `:91` (`paragraphNodes(stripHtml(html))`); the `content_html` column is written (`services/api-gateway/src/routes/blog.ts:154`) but only the Liquid path can render it (`article-content.liquid:6`).
- **Expected:** either a structured editor producing `content.blocks` (which the renderer already supports, `rich-content.tsx:43-76`), or an explicitly supported subset of HTML on the React path.
- **Missing link:** an editor, and a decision on the React path's HTML policy.
- **Severity:** P2 · **Likelihood:** HIGH
- **Remediation approach:** target the existing `content.blocks` shape (heading/paragraph/list/quote/image) — it is already renderable and inherently XSS-safe — rather than loosening `stripHtml`. Any decision to render merchant HTML on the React path requires the same allowlist sanitizer the Liquid path uses and a security sign-off.
- **Acceptance criteria:** a merchant can produce headings, lists and images that render identically on both engines.
- **Owner:** lead engineer + security (if HTML is chosen) · **Reversibility:** reversible · **Confidence:** HIGH

---

### G-J-22 — Documentation drift: migration count
- **Domain:** Governance
- **Status:** PARTIAL
- **Impact:** Root `AGENTS.md` states the current max migration is 161; the tree holds 187 `.sql` files with the highest numbered 195 (commander-verified fact, reused here). Agents and humans reasoning from the doc will mis-scope schema work.
- **Evidence:** commander-supplied repo fact + `database/supabase/migrations/`.
- **Severity:** P3 · **Likelihood:** HIGH
- **Remediation approach:** update root `AGENTS.md` (documentation-only change; out of scope for this read-only pass).
- **Owner:** lead engineer · **Reversibility:** reversible · **Confidence:** HIGH

---

## 8. Contradictions

1. **Policies.** `apps/merchant-control-plane/src/app/[store]/settings/policies/page.tsx:226-229` asserts the
   settings policies appear on storefront policy pages and at checkout. The storefront reads only
   `storefront_policies` (`apps/storefront-runtime/src/app/store/[subdomain]/privacy/page.tsx:44-46` etc.).
   The settings values land on `sites.*_policy` (`services/api-gateway/src/routes/stores.ts:723`) and have
   zero readers. → G-J-04.
2. **Domains.** `apps/merchant-control-plane/src/app/[store]/settings/domains/page.tsx:233, 245` says
   merchants can pay and have the domain registered and auto-connected. No purchase control or proxy
   exists. → G-J-16.
3. **Liquid canary.** `packages/theme-engine/src/theme-governance.ts:16-21` records the platform-wide flip
   as ARB-deferred, while `services/api-gateway/src/execution/theme-execution.adapter.ts:643-648`
   auto-stamps `renderer_engine: 'liquid'` whenever a bundle is present and the merchant proxies accept the
   canary flag from the client. → G-J-18.
4. **Draft system.** Governance requires one; three tables are in play, and the repo's own discovery docs
   (`docs/storefront-liquid-discovery/01_REPOSITORY_DISCOVERY.md:377`) already record it as unresolved. → G-J-19.
5. **Tenant registry vs DDL.** `services/api-gateway/src/tenant/tenant-tables.registry.ts` registers the CMS
   tables as tenant tables, but no `FORCE ROW LEVEL SECURITY` exists for any of them. → G-J-14.
6. **Blog scheduling.** `packages/cms-core/src/index.ts:663-664` and the DB CHECK
   (`database/supabase/migrations/000_baseline.sql:8575`) advertise scheduled publication; no code path
   stores `scheduled_at` and no worker publishes. → §1.3.
7. **ART-17 parity direction.** The freeze narrative implies React is ahead and Liquid is catching up; the
   files say the opposite — 42 Liquid sections vs 20 React, with React missing blog-listing,
   article-content, page-content and policy-content entirely. → §4.4, G-J-01.

---

## 9. Unknowns / not verified

- **No runtime observation at all.** Nothing here is `VERIFIED_E2E`. No server started, no DB queried, no
  build run.
- **Provider configuration is BLOCKED_EXTERNAL.** `REGISTRAR_PROVIDER` / `REGISTRAR_API_KEY` /
  `REGISTRAR_USERNAME` / `REGISTRAR_PASSWORD` / `REGISTRAR_SANDBOX_ENABLED`, the Vercel domain
  token/project vars, `CUSTOM_DOMAIN_CNAME_TARGET` / `NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET`,
  `PREVIEW_SIGNING_KEY`, `STORE_ACCESS_SIGNING_KEY`, `INTERNAL_API_SECRET`, `ABUSE_REPUTATION_API_URL` /
  `ABUSE_REPUTATION_API_KEY`, `STOREFRONT_CACHE` — **names only**; none appears in
  `services/api-gateway/wrangler.toml`, so presence is deploy-time and unknown to me. I did not read any
  `.env`.
- **Deployed schema shape.** Every gateway CMS route has a "missing table / schema mismatch" fallback
  (`isMissingTableError`, `isSchemaMismatchError`). I cannot tell from the repo whether production runs the
  `storefront_pages` path or the legacy `pages` path. G-J-11's impact depends on that.
- **Flutter theme editor capability matrix.** `screens/customize/theme_screen.dart` (634 L),
  `screens/editor/section_editor_screen.dart` (1200 L) and `theme_versions_screen.dart` were inventoried but
  not traced field-by-field. Web/mobile parity for theme editing is **UNKNOWN**.
- **Flutter pages/policies screens.** `screens/content/pages_screen.dart` (554 L) and
  `page_editor_screen.dart` (422 L) were not traced; whether the mobile app writes `storefront_policies` or
  the legacy `sites.*_policy` fields is **UNKNOWN** and directly affects G-J-04's blast radius.
- **`urban-kicks-liquid` parity.** I verified all 20 required Liquid section types exist in
  `letbuyy-core-liquid` (42 files). `urban-kicks-liquid` also has 42 files but I did not diff the names.
- **Test suite state.** `packages/theme-engine/test/liquid-l14-blog.test.ts`, `liquid-l15-page.test.ts`,
  `tests/theme-engine/storefront-liquid-runtime.test.mjs`, `tests/contracts/custom-domain*.test.ts`,
  `tests/contracts/buy-a-domain.test.ts` exist; **I did not run any of them**, so "green" is unproven.
- **`theme_editor_drafts` vs `theme_instance_drafts` divergence.** I proved both are written; I did not
  determine which one the merchant editor's *read* path and the *preview* path each consult in all cases.
- **Whether `storefront_slug_redirects` is wired.** The table exists
  (`database/supabase/migrations/000_baseline.sql:12331`); I did not trace a reader. Relevant to G-J-12.
- **`resource-search`** (`services/api-gateway/src/routes/resource-search.ts`) indexes pages/blog for the
  theme-editor resource picker; I confirmed the `storefront_pages` → `pages` fallback exists
  (`:131-153`) but did not audit its tenancy.

---

## 10. Blockers

- Runtime verification of every trace in this note requires a dev environment and a database
  (**BLOCKED_EXTERNAL** for a read-only discovery pass).
- Confirming provider wiring (registrar, Vercel domains, CNAME target, cache KV) requires access to
  deploy-time secrets (**BLOCKED_EXTERNAL** — and out of bounds by mission rule 3).
- G-J-04, G-J-05, G-J-11, G-J-17, G-J-18, G-J-19 all require a **decision by an authority I do not hold**
  (founder / ARB / counsel / payments-provider) before any remediation can be specified further.
