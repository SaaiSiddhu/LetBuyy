# LetBuyy_Store — Deep Architecture Audit & "Shopify for India" Blueprint

_Prepared: 31 May 2026. Every claim below was verified directly against the code in this repo, not assumed._

---

## 0. The one-paragraph verdict

LetBuyy is **not** suffering from a lack of code — it is suffering from **too much of the wrong code in too many places, with no single source of truth.** You have a beautifully layered set of `*-core` domain libraries, a dedicated API gateway, an event bus, a theme engine, 130+ governance validators and 380+ design docs. But the apps that users actually touch **ignore almost all of it** and re-implement commerce logic inside their own Next.js API routes. The result is three parallel backends, a theme system that physically cannot support a marketplace, and a foundation that has spent its energy on CI/CD ceremony instead of the product. The good news: the bones (multi-tenant DB, SSO hub, storefront-as-separate-app, Razorpay already wired) are the _right_ bones. The fix is **consolidation and one correct theme architecture**, not a rewrite.

---

## 1. What is actually in the repo (verified topology)

A pnpm + turbo monorepo. TypeScript/Next.js on the web, Flutter (Dart) on mobile, Supabase (Postgres) + Cloudflare Workers on the backend.

**Apps (11 packages):**

- 8 Next.js web apps: `storefront-runtime`, `merchant-control-plane` (admin), `identity-platform` (accounts/SSO), `app-marketplace`, `theme-marketplace`, `marketing-site`, `platform-console`, `platform-operations-portal`.
- 3 Flutter mobile apps: `mobile/shopper-app`, `mobile/merchant-app`, `mobile/operator-app` (~295 Dart files).

**Services (9 directories — only 3 are real):**

- Real, with code: `api-gateway` (Hono worker), `webhook-service` (Hono worker), `queue-workers`.
- **Empty stubs** containing only an `AGENTS.md` + `runtime.manifest.json` and zero code: `analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`.

**Packages (~35 directories):**

- ~19 real domain/runtime libraries in the workspace: `commerce-core`, `checkout-core`, `auth-core`, `tenant-core`, `event-core`, `theme-engine`, `cms-core`, `notification-core`, `search-core`, `billing-core`, `app-engine`, `application-services`, `distributed-runtime`, `projection-runtime`, `orchestration`, `runtime-composition`, `infrastructure`, `shared-types`, plus `typescript/{api-types,ui,utils}`.
- **16 orphaned directories** with no `package.json`, not in `pnpm-workspace.yaml`, not in the build: `analytics`, `analytics-core`, `api`, `auth`, `config`, `db`, `payments`, `shared`, `shared-utils`, `ui`, `ui-system`, `mobile-core`, `mobile-models`, `mobile-services`, `mobile-ui-kit`, `dart`.

Right away two facts matter for your goals:

1. `packages/payments` — which you need for India-native gateways — **is an empty shell** (just an `AGENTS.md`). The actual payment code lives elsewhere (and in more than one place; see Issue 6).
2. There are **three different UI packages** (`packages/ui`, `packages/ui-system`, `packages/typescript/ui`), two of which are dead. This is the visual-inconsistency you feel as a user.

---

## 2. The core issues, ranked

### Issue 1 — Three parallel backends, no single source of truth _(this is the "poor communication" you described)_

There is no single place where "what is an Order" or "how do I charge a card" is defined. There are three:

| Backend | What it is | Reality |
|---|---|---|
| **A. The `*-core` libraries** | `commerce-core`, `checkout-core`, etc. Clean, layered, `zod`-validated. | Well-designed — and **almost unused by the apps.** |
| **B. The Hono `api-gateway` worker** | Routes, schemas, RBAC, durable objects, execution adapters for products/orders/payments/themes. | A second backend. Only **9 files across all apps reference it.** Largely bypassed. |
| **C. ~122 Next.js API routes inside the apps** | `merchant-control-plane` alone has **62** route handlers; `storefront-runtime` has **28**; `identity-platform` 18; others ~14. | This is where the real work happens — each app hits Supabase directly with its own logic. |

So the same domain (orders, customers, themes, payments) is implemented two or three times, in three styles, with three sets of types. **Nothing forces them to agree.** That is the literal mechanism of "the apps are inconsistent and communicate poorly."

> Shopify's equivalent: **one** GraphQL Admin API is the single front door for every app, every channel, and every integration. There is exactly one definition of an Order.

### Issue 2 — The shared contract exists but **zero apps use it**

`packages/shared-types/src/index.ts` is a single 243-line file meant to be the shared domain model. The number of app files that import `@letbuyy/shared-types` is **0**. Every app therefore re-declares `Product`, `Order`, `Customer`, `Theme` locally. When two apps disagree about a field, you get exactly the runtime drift and "half-built" feeling you're describing. A shared contract that nobody imports is not a contract — it's a suggestion.

### Issue 3 — The theme system is the **wrong architecture for a marketplace** _(your explicit pain point)_

This is the most important finding for the "exactly like Shopify" goal.

**How LetBuyy renders a store today:** `apps/storefront-runtime/src/lib/theme-engine/` resolves a "render plan" of sections, then `composition-engine.tsx` maps each `section.rendererKey` to a **React component** via a hardcoded `renderer-registry.tsx` (111 lines, ~47 registered keys). A "theme" is a database row that points at renderer keys that **must already exist as compiled React code inside the storefront app.**

**Why this kills your business model:** a third-party designer **cannot ship a new theme** without you editing `renderer-registry.tsx` and redeploying the storefront binary. So your "theme marketplace" can only ever sell themes your own engineers pre-compiled. The repo proves this is already a wall: migrations `055_only_urban_kicks_theme_catalog`, `058_deactivate_non_urban_kicks_themes`, and `066_lock_urban_kicks_production` **deliberately reduce the entire catalog to one demo theme** "while the enterprise theme engine is completed and verified" (their words). The multi-theme system does not work end-to-end, so it was switched off.

**This is exactly what you meant by "I want the theme config like Shopify, not the whole React app for theme config."** You're right. (Section 4 and 6 below give the correct architecture.)

> Shopify's equivalent: a theme is a **portable bundle of data files** — `templates/*.json`, `sections/*.liquid`, `blocks/*.liquid`, `config/settings_schema.json`, `layout/theme.liquid`. Anyone can author one in a text editor, zip it, and sell it. Shopify's renderer reads the data; it does not compile a React app per theme.

### Issue 4 — Governance/infrastructure ceremony vastly outweighs product

- **130+ validator scripts** in `scripts/validators/` (e.g. `crdt-convergence-validator`, `split-brain-validator`, `fencing-token-validator`, `convergence-proof-validator`, `distributed-clock-validator`). The `validate:runtime` script chains ~60 of them.
- **383 markdown docs** under `docs/`, plus root state files totalling >140 KB (`LETBUYY_STATE.md` is 76 KB).
- The most recent big effort (`FOUNDATION_STATUS.md`) was a "Foundation Mission" that delivered **CI/CD, wrangler configs, branch protection, and 128 passing validators** — and **not one line of commerce product.**

For a pre-revenue platform whose multi-theme catalog is switched off, this is energy spent proving distributed-systems properties of a system that doesn't yet sell a single theme. It also actively slows you down: every change must pass a wall of validators written for a far more mature system.

### Issue 5 — Ghost topology: dead code masquerading as architecture

16 orphan package directories and 6 empty service stubs sit in the tree looking like real components. `CLAUDE.md` even maintains a "Deprecated Runtime Policy" listing aliases (`apps/admin`, `apps/checkout`, `apps/storefront`…) you must not recreate. New contributors (and AI agents) cannot tell what's alive. This is a large part of why "none of the apps feel consistent": half of what they see is a corpse.

### Issue 6 — Payments (and other domains) are duplicated and forked

Payments exist in **both** places at once:

- `services/api-gateway/src/routes/payments.ts` + `execution/payment-execution.adapter.ts` + tests.
- `apps/storefront-runtime/src/app/api/payments/{razorpay,stripe,paypal}/...` — 7 separate Next route handlers (create / verify / capture / webhook).

Two implementations of "take money" with different code paths, error handling, and webhook verification is how you get reconciliation bugs and double-charges at scale. The same fork pattern repeats for orders, customers, and themes.

### Issue 7 — Auth is healthier than the rest, but has a drift/loop risk

This is the one part with a coherent design: a shared `lb_session` cookie is used by `identity-platform`, `merchant-control-plane`, `app-marketplace`, and `theme-marketplace`, with `accounts.letbuyy.store` acting as the SSO hub (18 redirect references). The storefront correctly uses a **separate** customer session (`lb_customer_session`) — shoppers and merchants are different identities, which is right.

The risk: each app **validates `lb_session` with its own code** rather than calling one shared verifier. If the secret, expiry, or claim logic drifts between apps, you get redirect loops between `accounts.` and `admin.` (likely what you meant by "loops") and silent session mismatches. The mechanism for loops is present even though I did not find a confirmed live loop.

---

## 3. How Shopify actually works, end-to-end (the model to copy)

I researched Shopify's current architecture so the target is concrete, not vibes.

### 3.1 Themes — Online Store 2.0 (the part you most want to copy)

A Shopify theme is a **folder of data files**, not an application:

- `layout/theme.liquid` — the outer HTML shell.
- `templates/*.json` — one JSON file per page type (product, collection, index…). Each lists which **sections** appear and stores their settings. Merchants reorder/add/remove sections here, in the editor, with no developer.
- `sections/*.liquid` — reusable modules (hero, product grid, footer). Each section ends with a `{% schema %}` block: a JSON description of its settings and which blocks it accepts.
- `blocks/*.liquid` — smaller reusable pieces inside sections. Three kinds: **theme blocks** (in `/blocks`, reusable), **section blocks** (defined inline), and crucially **app blocks** (injected by installed apps — this is how the app marketplace plugs into themes).
- `config/settings_schema.json` — global theme settings (colors, fonts, logo). The theme editor is **generated from this schema** — Shopify did not hand-build a React editor per theme; the editor is a generic form driven by the schema.
- `locales/*.json` — translations (directly relevant to your multi-language India goal).

The renderer loads data + the theme files, executes Liquid, and returns HTML. Because the theme is pure data, **anyone can build and sell one**, and the editor is automatically correct for every theme. That is the whole trick.

### 3.2 Storefront rendering is a separate, read-optimized system

Shopify deliberately split storefront rendering out of the admin monolith: it's a read-only, very-high-throughput job (load data → render Liquid → return HTML). **LetBuyy already did the right thing here** by making `storefront-runtime` a separate app — the instinct is correct; only the rendering mechanism (React registry vs. portable templates) is wrong.

### 3.3 Apps & the app marketplace

- Apps are **embedded** in the admin via **App Bridge** (an iframe + JS SDK), so a third-party app looks native inside the dashboard.
- Apps read/write everything through the **single GraphQL Admin API** (products, orders, customers, inventory, metafields, billing). One contract, one front door.
- Apps extend the merchant surface through **extensions**: app blocks (into themes), checkout UI extensions, admin actions, functions (custom discount/shipping logic).
- Apps charge money through the **Billing API** (recurring, one-time, usage-based), approved by the merchant inside the admin and reconciled by Shopify.
- Security: short-lived **session tokens** verified on every request.

### 3.4 The backend shape

Shopify Core is a **modular monolith** — one large Rails app (~2.8M LOC) internally split into domain components whose boundaries are enforced by a tool called **Packwerk**. Scale comes from **pods** (isolated full copies of the stack per shard) with a router ("Sorting Hat") sending each shop to its pod, on a sharded MySQL.

**The lesson for LetBuyy:** Shopify is _one well-modularised system with enforced internal boundaries and one API_. LetBuyy is the opposite — many fragmented backends with clean libraries that nobody is forced to use. You don't need microservices; you need **one commerce core that every app is forced to go through.**

---

## 4. The gap, mapped concept-by-concept

| Shopify concept | LetBuyy today | The fix |
|---|---|---|
| One GraphQL Admin API, single contract | 3 backends (core libs / gateway / 122 app routes), barely connected | Collapse to **one Commerce API** the apps must call |
| `shared-types` as enforced schema | `shared-types` imported by **0 apps** | Generate types from the API; ban local domain types via lint |
| Theme = portable data bundle (Liquid + JSON) | Theme = hardcoded React renderer registry; catalog locked to 1 demo | **Themes-as-data renderer** (Section 6.2) |
| Schema-generated theme editor | 535-line bespoke React editor page | Generic editor driven by `settings_schema` |
| App blocks / extensions inject into themes | No extension surface; apps can't touch storefront | Add an **app-block contract** to the theme renderer |
| Billing API (recurring/usage) | `billing-core` exists; Razorpay plan IDs in DB; logic forked | One billing service over the Commerce API |
| Storefront split out for read scale | Already split (`storefront-runtime`) ✅ | Keep — just change how it renders |
| Packwerk-enforced module boundaries | 130+ exotic validators, none enforce "apps must use the core" | Replace with **a few boundary rules that matter** |

---

## 5. Target architecture — "Shopify for India," concretely

### 5.1 Collapse to ONE Commerce API

Pick the `api-gateway` worker as the single front door. Move the real logic out of the 122 Next.js routes and into the `*-core` libraries behind that gateway. Every app — web and Flutter — becomes a **thin client** that calls the gateway and never touches Supabase directly. One definition of Order, Product, Customer, Payment. This single change removes Issues 1, 2, and 6 at once.

Rule to enforce (one lint rule, replacing dozens of validators): _no file under `apps/**` may import `@supabase/*` or define a domain type; it must call the API client and use generated types._

### 5.2 The correct theme architecture (your headline request)

Make a theme a **portable, data-only artifact** stored in `theme_packages` (the table already exists), shaped like this:

```
theme/
  config/settings_schema.json     # global settings -> generates the editor UI
  config/settings_data.json       # merchant's saved values
  templates/index.json            # which sections + their settings, per page
  templates/product.json
  sections/<name>.liquid          # markup + {% schema %} for each section
  blocks/<name>.liquid            # reusable + app-block slots
  locales/en.json, hi.json, ...   # India multi-language
```

Then the storefront renderer changes from "map key → compiled React component" to **"interpret theme data."** Two viable engines:

- **Option A — Liquid (recommended for true Shopify parity & marketplace portability).** Use a Liquid engine (e.g. LiquidJS) server-side in `storefront-runtime`. Themes become 100% portable, designers can author them in any editor, and you could even import Shopify-style themes. This is "exactly like Shopify."
- **Option B — JSON-contract sections (faster interim).** Keep React section components, but make sections **data-described** with a published JSON schema, and let theme authors compose/skin them purely through `templates/*.json` + `settings_schema.json` — no code, no redeploy. Less portable than Liquid, but ships sooner and reuses your 47 existing renderers.

Either way: **the editor becomes a generic form generated from `settings_schema.json`** (kill the bespoke 535-line editor), and **adding a theme becomes uploading a bundle**, not a code deploy. That alone turns the theme marketplace from decorative into real.

### 5.3 App platform & marketplace

Give `app-marketplace` real teeth by adding to the Commerce API: an **app-block extension contract** (so installed apps can render into themes, like Shopify app blocks), OAuth + scoped tokens per app, a **billing API** (recurring/usage over Razorpay), and webhooks via the existing `webhook-service`. Embed third-party apps in the admin via an iframe + a small JS bridge (your own "App Bridge").

### 5.4 India-native & affordable (your differentiator)

- **Payments:** one `payments` provider abstraction (resurrect the empty `packages/payments`) with **Razorpay, Cashfree, PhonePe** + **UPI** (incl. UPI AutoPay for subscriptions), **RuPay**, netbanking, wallets, and **COD with verification** — COD is non-negotiable for Indian e-commerce. One charge code path, not the current fork.
- **Compliance:** **GST-compliant invoicing** (GSTIN, HSN codes, CGST/SGST/IGST split, e-invoice for large merchants), TCS handling, INR-first money handling everywhere.
- **Logistics:** native **Shiprocket / Delhivery / Pickrr** integrations for label + tracking (Indian sellers expect this built-in).
- **Localization:** Hindi + major regional languages via theme `locales/` and admin i18n.
- **Pricing:** undercut Shopify with INR plans (think ₹0 start / ₹399 / ₹999 tiers) + low transaction fees, which your low-cost Cloudflare+Supabase stack can sustain.

---

## 6. Prioritized roadmap (sequence matters)

**Phase 0 — Stop the bleeding (1–2 weeks).** Delete the 16 orphan package dirs and 6 empty service stubs (move to `docs/archive/` if you must). Freeze new Next.js API routes. Pick `api-gateway` as the one backend. Outcome: the tree finally tells the truth.

**Phase 1 — One contract (3–4 weeks).** Make `shared-types` (or generated-from-gateway types) the only domain model; add the lint rule banning local types + direct Supabase in apps. Migrate `merchant-control-plane`'s 62 routes to call the gateway, starting with products/orders.

**Phase 2 — Unify payments (2–3 weeks).** Single `payments` package with the India provider set; delete the storefront's forked payment routes; all charges flow through one adapter with one webhook verifier.

**Phase 3 — Real theme engine (4–6 weeks).** Implement themes-as-data (Option A Liquid, or B as interim). Generate the editor from `settings_schema.json`. Make "install theme" = "upload bundle." Re-enable a multi-theme catalog (undo the urban-kicks lock).

**Phase 4 — App platform (4–6 weeks).** App-block extension contract + per-app OAuth/tokens + billing API. Now both marketplaces are genuinely open.

**Phase 5 — India-native polish + scale.** GST invoicing, Shiprocket/Delhivery, regional languages, pricing tiers. _Then_ — and only then — bring back the distributed-systems validators that actually matter (replace the 130 with ~10).

---

## 7. The single most important sentence

You do not have a code shortage; you have a **"single source of truth" shortage.** Force every app through one Commerce API and make every theme a piece of portable data — do those two things and 80% of the inconsistency, the "loops," and the "half-built" feeling disappear, because there will finally be only one place where each truth lives.

---

## Sources (Shopify research)

- [Shopify — Theme architecture](https://shopify.dev/docs/storefronts/themes/architecture)
- [Shopify — Online Store 2.0](https://shopify.dev/docs/storefronts/themes/os20)
- [Shopify — Building with sections and blocks](https://shopify.dev/docs/storefronts/themes/best-practices/templates-sections-blocks)
- [Shopify — Blocks (theme/section/app blocks)](https://shopify.dev/docs/storefronts/themes/architecture/blocks)
- [Shopify — App Bridge](https://shopify.dev/docs/api/app-bridge-library)
- [Shopify — API index (Admin GraphQL, Storefront, Billing)](https://shopify.dev/docs/api/index)
- [Shopify Engineering — Under Deconstruction: The State of Shopify's Monolith](https://shopify.engineering/shopify-monolith)
- [Shopify Engineering — Deconstructing the Monolith](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity)
- [InfoQ — How Shopify Migrated to a Modular Monolith](https://www.infoq.com/news/2019/07/shopify-modular-monolith/)

