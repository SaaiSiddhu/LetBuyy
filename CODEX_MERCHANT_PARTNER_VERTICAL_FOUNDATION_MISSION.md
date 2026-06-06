# CODEX MISSION — LetBuyy Merchant / Shopper / Partner Vertical Foundation (Task B, single-pass, scope-locked)

> Paste everything below into Codex as **one task**. This is the **sibling task to the Internal Operating System mission** (`CODEX_INTERNAL_OPERATING_SYSTEM_FOUNDATION_MISSION.md`, "Task A"). The two are designed to run **concurrently without collisions**. This task (B) owns the **merchant-, shopper-, and partner-facing vertical**; Task A owns the internal/operator vertical. Stay strictly inside your fence.

---

## 0) ROLE & PRIME DIRECTIVE

You are a senior platform engineer hardening **LetBuyy's customer-facing surfaces** to a Shopify-class standard: the storefront, the merchant control plane, identity/onboarding, the marketing site, and the partner ecosystem (app marketplace, theme marketplace, developer portal). Make them coherent, styled, honest, wired end-to-end to the gateway, and trustworthy.

**Definition of success:** a shopper can browse → cart → checkout; a merchant can sign up → onboard → build a store → manage products/orders/themes; a partner can register → submit an app/theme → see installs/revenue — with **no broken, duplicate, placeholder, or unstyled page** inside your ownership, and every data call going through versioned gateway contracts.

**Operate in a single pass.** Walk your work queue (the existing audits' Top-100 lists, §2). For each issue: implement it (if owned) or **SKIP-and-log** it (if it needs Task A, packages, infra, or human approval), then continue. **Never block. Never silently skip. Never ship a placebo** — use honest, dated `Beta`/`Planned` states.

---

## 1) OPERATING CONTRACT (laws)

1. **Single pass, all issues**; SKIP-and-log anything out of scope; keep going.
2. **Governance is law.** Keep `node scripts/validate-governance.mjs`, `pnpm -w typecheck`, `pnpm -w lint`, and affected `test` green. Regenerate `AGENTS.md` via `node scripts/generate-repository-intelligence.mjs` **only after Task A signals done** in `HANDOFF_PARALLEL_AND_HUMAN.md` (see §5).
3. **No new app roots**; no deprecated aliases (`apps/{admin,auth,checkout,internal,merchant,storefront,analytics}`, `apps/mobile/operator-team-app`, `apps/storefront-runtime/consumer-storefront`).
4. **App → gateway → DB.** Apps are thin: routing/rendering/presentation/adapters/hooks only. Use `@letbuyy/api-client` + `@letbuyy/shared-types`; no app-local DB clients, no hand-rolled commerce DTOs.
5. **Schemas first**, `AppError`/`formatAppError`, pagination on lists, idempotency + server-side price recompute on mutations/payments, webhook signature verification before side effects.
6. **Tenant isolation:** every merchant record resolves via `site_id` or explicit ownership; storefront customer auth stays separate from merchant/admin auth; never leak draft/private/billing state to shoppers.
7. **Money is INR/paise, server-side.** Never trust client totals.
8. **No secrets in repo;** never store auth tokens in `localStorage` (UI prefs/preview state only).
9. **Migrations are additive & banded:** new tables go in **`110`+ only** (Task A reserves `090–099`); never edit `000_baseline.sql`.
10. **Small, labeled commits per wave.**

---

## 2) GROUND TRUTH — required reading & work queue

Implement against the existing master audits and their Top-100 issue lists:

- `docs/LETBUYY_DEVELOPER_PLATFORM_MASTER_AUDIT.md` + `docs/developer-platform-audit/TOP_100_ISSUES.md` (developer portal + partner console — *frontend slice*).
- `docs/LETBUYY_APPS_MARKETPLACE_MASTER_AUDIT.md` + `docs/apps-marketplace-audit/*` (app marketplace).
- `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` + `docs/themes-marketplace-audit/*` (theme marketplace).
- `docs/LETBUYY_UI_SYSTEM_MASTER_AUDIT.md` + `docs/ui-system-audit/*` (design-system consistency across apps).
- `docs/LETBUYY_MASTER_EXECUTION_PLAN.md`, `docs/LETBUYY_DEEP_AUDIT_REPORT.md`, `docs/LETBUYY_CTO_WAR_ROOM_REPORT.md` (cross-cutting priorities P0–P4).

Also obey root `AGENTS.md`, each owned app's local `AGENTS.md` + `runtime.manifest.json`, and `docs/governance/*`.

> Your work queue = the union of the Top-100 issues in the four audit folders above that fall inside your ownership (§3). Build a single consolidated ledger (§4).

---

## 3) OWNERSHIP & PARALLELISM CONTRACT

### ✅ YOU OWN (write freely)
- `apps/storefront-runtime/**` — shopper storefront, cart, checkout UI, customer accounts, policy pages, theme previews.
- `apps/merchant-control-plane/**` — merchant dashboard, CMS, products, orders, settings, themes, analytics UI.
- `apps/identity-platform/**` — login, signup, onboarding, store selection, password/OTP UI.
- `apps/marketing-site/**` — marketing + pricing (no auth pages).
- `apps/app-marketplace/**` — app catalog, install flows, developer/partner console (`/developers/*`, `/my-apps`).
- `apps/developer-portal/**` — docs/reference portal (per the developer-platform audit).
- `apps/theme-marketplace/**` — theme catalog, detail, acquisition/checkout UI.
- `apps/mobile/merchant-app/**` — Flutter merchant builder (reserved mobile roots stay manifest-only).
- **Gateway route groups for these domains** (extend, do not break): `storefront.ts`, `products.ts`, `orders.ts`, `payments.ts`, `themes.ts`, `app-store*`, `customers.ts`, `cart-routes`, `checkout-payment-routes`, `categories.ts`, `coupons.ts`, `inventory.ts`, `pages.ts`, `portfolio.ts`, `resume.ts`, `blog.ts`, `reviews.ts`, `onboarding.ts`, `media.ts`, `upload.ts`, `shipping-tax.ts`, `notifications.ts`, `analytics.ts` (merchant-facing), `stores.ts`, `auth.ts`, `contacts.ts`, `form-submissions.ts`, `export.ts`, `ai.ts`.
- **Migrations `110`+**; seeds/verification for your tables.

### ⛔ FORBIDDEN (owned by Task A — SKIP + hand off)
- `apps/platform-console/**`, `apps/platform-operations-portal/**`, `apps/mobile/operator-app/**`.
- Gateway internal-ops routes: `operations.ts` (+ `routes/operations/*`), `internal-console.ts` (+ `routes/internal-console/*`), `employee.ts`, and internal sub-routers for risk/trust-safety/support/review-checks/oncall/internal-analytics/internal-finance.
- **Migrations `090–099`** (Task A's band).
- `packages/**` (import only; package change → SKIP:PACKAGES + handoff), `infrastructure/**`, `config/**`, `legacy/**`, `.github/**`, `docs/governance/**`.

### Shared surfaces (coordinate, don't clobber)
- **`services/api-gateway/src/middleware/rbac.ts`** — Task A extends it additively for internal roles. If you need a change, **append only**, and note it in the handoff.
- **`services/api-gateway/src/index.ts`** — you add only your own top-level mounts; never reorder/remove existing mounts; Task A adds nothing here (it uses sub-routers).
- **`AGENTS.md`** — do **not** regenerate until Task A signals done; then regenerate once and reconcile.
- **`HANDOFF_PARALLEL_AND_HUMAN.md`** — shared coordination file; append your handoffs, don't overwrite Task A's.

Run `git diff --name-only` before finishing; confirm every path is in the ✅ allowlist or a coordinated shared surface.

---

## 4) LEDGER & STATUS
Create `CODEX_MERCHANT_PARTNER_VERTICAL_FOUNDATION_LEDGER.md` (root), pre-filled with your in-scope issues from the four audits.

```
| Source audit | Issue # | Title | Status | Layers (UI/API/DB/Test) | Notes / handoff |
```
`Status` ∈ `DONE` · `PARTIAL` · `SKIPPED:INTERNAL-TASK-A` · `SKIPPED:PACKAGES` · `SKIPPED:INFRA` · `SKIPPED:HUMAN-APPROVAL` · `N/A`.

---

## 5) THE WORK — Waves (do in order; map each to the audits' issue #s)

### WB-0 — Boundary & baseline
Read §2. Create the ledger. Record green baseline. Confirm fence.

### WB-1 — Storefront end-to-end (shopper) — *storefront-runtime*
Browse → product → cart → checkout → order confirmation → customer account; policy pages; theme preview. Wire to `storefront.ts`/`cart`/`checkout-payment`/`orders`/`payments`. Server-side totals; payment signature handling SHELL where provider go-live needed → SKIP:HUMAN.

### WB-2 — Merchant control plane end-to-end — *merchant-control-plane*
Dashboard, products (CRUD + variants + inventory), orders (fulfillment/refunds), CMS pages, settings, themes, merchant analytics. Wire to existing gateway groups. Dense operational UI: tables/filters/bulk/forms with all states.

### WB-3 — Identity & onboarding — *identity-platform*
Login/signup/OTP/password/reset, store selection, onboarding flow. Keep auth centralized; storefront customer auth separate. CSRF + rate-limit handling per security governance (server bits may handoff if package-owned).

### WB-4 — Marketing & pricing — *marketing-site*
Public marketing + pricing + conversion; no auth pages (redirects only).

### WB-5 — App marketplace + developer console — *app-marketplace, developer-portal*
Implement the developer-platform Top-100 (frontend): one IA/nav, kill unstyled System-B CSS, kill the fake dashboard, link portal↔console, build docs surfaces, fix the Edit-404 and wizard, app discovery/install/consent/billing/OAuth UI. Reviewer-side queues are Task A → SKIP:INTERNAL-TASK-A.

### WB-6 — Theme marketplace — *theme-marketplace*
Catalog/detail/preview/acquisition/checkout honesty per themes audit; consume existing api-client. Theme *review* tooling is Task A → SKIP.

### WB-7 — UI-system unification — *all owned apps*
Per the UI-system audit: shared tokens, fix undefined CSS classes, light/dark, skeleton/empty/error/focus/hover/active/disabled states, Lucide (web)/Material (Flutter) icons, kill inline styles. Extract to `@letbuyy/ui` is package-owned → SKIP:PACKAGES + handoff; meanwhile use local components.

### WB-8 — Mobile merchant app — *apps/mobile/merchant-app*
Wire builder/editor/dashboard/products/themes via `services/mobile-bff`. Mobile package order `core → models → services/ui_kit`; no app-to-app imports.

### WB-9 — Cross-cutting (perf, SEO, a11y, responsiveness, telemetry)
P2/P3 items from the master plan within owned apps; responsiveness at 320/375/768; metadata/OG; route health metrics (apps own these).

### WB-10 — Tests, governance, finalize
Per-app tests + states; migrations `110`+ with RLS; gates green; complete ledger + handoff. `AGENTS.md` regen only after Task A done-signal.

---

## 6) CROSS-BOUNDARY REGISTER (hand to Task A / packages / human)
- Reviewer/risk/T&S/support/ops surfaces, internal aggregates → **SKIP:INTERNAL-TASK-A**.
- `@letbuyy/ui` primitives / shared-types changes → **SKIP:PACKAGES**.
- Provider live keys, payment go-live, DNS/custom-domain activation, legal/pricing copy, commission % → **SKIP:HUMAN-APPROVAL** (ship honest placeholder).
- New queue bindings / infra → **SKIP:INFRA**.

## 7) DEFINITION OF DONE
1. Gates green (`typecheck`/`lint`/`test`/`validate-governance`).
2. Every in-scope audit issue has a terminal ledger row; handoff complete.
3. Shopper, merchant, partner journeys work end-to-end through gateway contracts; no placebo/unstyled/duplicate pages in owned scope.
4. No edits outside §3 allowlist (prove with `git diff --name-only`); migrations only `110+`; no internal-app/internal-route edits; `index.ts` only your own mounts; `AGENTS.md` regenerated only after Task A done-signal.

## 8) EXECUTION DISCIPLINE
WB-0 → WB-10 in order, commit per wave. Out-of-scope or approval-needed → log + honest placeholder + continue. Optimize the whole customer-facing foundation, not any one feature.

— END OF CODEX MISSION (TASK B) —
