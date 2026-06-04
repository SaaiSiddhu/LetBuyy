# CODEX SETTINGS ARCHITECTURE MISSION — LetBuyy WS9

**Driver:** Codex agent. Reasoning: `xhigh` for the hub architecture + permissions UX, `medium` for pane migrations.
**Mode:** Continuous, autonomous, 24h+. Never stop while unblocked work remains.
**Domain Ownership:** `apps/merchant-control-plane/src/app/[store]/settings/**` and `apps/merchant-control-plane/src/components/settings/**` **ONLY**.
**Dependencies:** WS1 (`@letbuyy/ui` components — consume) · WS2 (owns the app shell/Sidebar/`globals.css` — WS9 registers routes via the shared route manifest, never edits the Sidebar) · WS7 (real stack to screenshot against; backend data).
**Predecessor:** WS1 has shipped `Page/PageHeader/Card/Section/Tabs/Select/SaveBar/Banner/Toast/EmptyState/IndexTable` (use `_local-ui/` fallback if a component is missing).

---

## 0. PRIME DIRECTIVE

Settings is LetBuyy's **biggest maturity gap (~20%)**. Today there are **13 scattered settings pages** (general, payments, domains, plan, shipping, policies, checkout, taxes, users, notifications, billing, subscribe/checkout, index) with no unified shell, inconsistent layout, and missing panes. Transform them into a **Shopify‑class Settings hub**: one shell with a grouped left index, every pane on the same layout grammar with a sticky save bar, plus the missing panes (Apps & Sales Channels, Business details, Localization, Security, Custom Data) built against existing gateway data — **frontend + workflow only, no architecture changes.**

**SUCCESS CRITERIA — COMPLETE only when all proven (commands + before/after screenshots):**
1. A single **Settings hub shell** (`settings/layout.tsx`) with a grouped left index + content pane wraps every settings route.
2. All **13 existing panes** migrated onto `@letbuyy/ui` grammar (`Page → Section → Card`) with a sticky `SaveBar` (Unsaved/Saving/Saved) and proper empty/loading/feedback states.
3. The **missing panes** exist: Apps & Sales Channels, Business details, Languages & Localization, Security, Custom Data — real where gateway data exists, `[SKIP — NEEDS BACKEND]` with placeholder UI where it doesn't.
4. **Settings search** (filter the index) + contextual guidance (Banners/tips) present.
5. Settings is **responsive** (index → drawer on mobile) and **WCAG‑AA** accessible.
6. **No route lost**; every old settings URL resolves; **128/128 governance**, 57/57 typecheck, tests green.
7. `CODEX_WS9_LEDGER.md` records every task DONE/SKIP; before/after screenshots in the VISUAL LEDGER.

---

## 1. OPERATING CONTRACT
1. Continuous; finish → ledger → next unblocked task; never pause.
2. **Green Law:** typecheck + lint each increment; full `validate:governance` (128/128) at each gate; never commit red; 3 strikes → revert + `BLOCKED` → next.
3. **No‑Architecture Law:** edit only the two owned paths; consume `@letbuyy/ui`/`api-client`/`shared-types`; never modify them or anything in §2. Missing data → `[SKIP — NEEDS BACKEND]` + placeholder pane.
4. **Visual Proof Law:** before/after screenshot per pane. During development use Storybook/component screenshots; after push, prove panes through staging preview deployments against staging APIs.
5. **One‑Design‑System Law:** compose from `@letbuyy/ui`; no new ad‑hoc CSS; settings get a scoped CSS module only if unavoidable.
6. **Do not edit the Sidebar/global layout** (WS2 owns them). Register settings routes via the shared route manifest WS2 exposes; if it's absent, add settings nav **inside** your `settings/layout.tsx` index and log `[HANDOFF → WS2: register Settings group]`.
7. Small reversible commits (one pane each); accessibility baseline; `ConfirmDialog` on destructive actions; no fabrication.

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
`services/**` · `packages/*-core/**` · `packages/shared-types/**` · `packages/typescript/api-client/**` · `packages/typescript/ui/**` (consume only — that's WS1) · `database/**` · `docs/governance/**` · `scripts/validators/**` · the Sidebar/`globals.css`/global `layout.tsx` (WS2) · any non‑settings page under `merchant-control-plane`.

---

## 3. THE WORK — S0 → S5

### S0 — Baseline & Data Audit
- **S0.1** Create `CODEX_WS9_LEDGER.md`; inventory the 13 existing settings pages + map each to its gateway data source. **Files:** `apps/merchant-control-plane/src/app/[store]/settings/**`. **Effort:** S. **Priority:** P0.
  - Shopify ref: Settings is a centralized hub, not scattered pages.
  - Data sources (confirmed in gateway): general/store → `stores.ts`; payments → `payments.ts` (`payment_configs`); shipping → `shipping-tax.ts` (`shipping_zones`); taxes → `shipping-tax.ts` (`tax_rates`); users → `employee.ts` (`users`, RBAC); plan/billing → `billing-core`/`stores`(`subscriptions`); domains → `stores.ts`; notifications → `notifications.ts`; policies → `pages.ts`/`cms-core`; checkout → `checkout-core` branding.
- **S0.2** Before screenshots of all 13 panes. **Effort:** S. **Priority:** P0. _DoD: inventory + before shots recorded._
- **GATE S0:** inventory complete; 128/128.

### S1 — The Settings Hub Shell
- **S1.1** Build `settings/layout.tsx` = Shopify Settings shell: a **grouped left index** + content pane + breadcrumb + consistent `SaveBar` host. Groups: **Store · Plan & Billing · Users & Permissions · Payments · Checkout · Shipping & Delivery · Taxes & Duties · Domains · Notifications · Languages · Policies · Apps & Channels · Custom Data · Security**. **Files:** `…/settings/layout.tsx`, `…/components/settings/SettingsShell.tsx`, `SettingsIndex.tsx`. **Effort:** M. **Priority:** P0.
  - Shopify ref: left settings index with grouped items; selected pane in the content area; one consistent save bar.
  - Data: none (presentational shell). Register routes via WS2 manifest or local index (log handoff).
- **S1.2** A reusable `SettingsPane` wrapper (`PageHeader` + `Section` + `Card` + `SaveBar` + dirty‑state tracking). **Files:** `…/components/settings/SettingsPane.tsx`. **Effort:** S. **Priority:** P0.
- **GATE S1:** shell wraps all settings routes; one save bar; 128/128; before/after of the hub.

### S2 — Migrate the 13 Existing Panes
For each pane: wrap in `SettingsPane`, compose with `@letbuyy/ui`, add empty/loading/feedback + dirty save bar, delete bespoke CSS. **Effort:** S–M each. **Priority:** P0/P1.
- **S2.1 Store details** (`settings/general/page.tsx`) — store name/email/address/currency(INR)/timezone. Data: `stores.ts`. Shopify ref: Store details pane.
- **S2.2 Plan** (`settings/plan/page.tsx`) — plan‑comparison card grid, current highlighted. Data: `billing-core`/`subscriptions`. Shopify ref: Plan page with comparison.
- **S2.3 Billing** (`settings/billing/page.tsx`) — invoices table + payment method + itemized app charges. Data: `billing-core`. Shopify ref: Billing with invoice history.
- **S2.4 Subscribe checkout** (`settings/subscribe/checkout/page.tsx`) — plan checkout via Razorpay. Data: `billing-core`/`payments.ts`. Keep flow; restyle only.
- **S2.5 Users & Permissions** (`settings/users/page.tsx`) — `IndexTable` of staff with role chips; invite modal; role categories (store/org). Data: `employee.ts` + `auth-core` RBAC. Shopify ref: Users & permissions with roles.
- **S2.6 Payments** (`settings/payments/page.tsx`) — provider cards (Razorpay/COD/Cashfree/UPI), enable/configure, status badges. Data: `payments.ts`/`payment_configs`. Shopify ref: Payments with provider list.
- **S2.7 Checkout** (`settings/checkout/page.tsx`) — checkout branding/options (locked core, customizable branding). Data: `checkout-core`. Shopify ref: Checkout settings.
- **S2.8 Shipping & Delivery** (`settings/shipping/page.tsx`) — zones/rates/profiles. Data: `shipping-tax.ts`/`shipping_zones`. Shopify ref: Shipping profiles + zones + rates.
- **S2.9 Taxes & Duties** (`settings/taxes/page.tsx`) — GST/regional tax config, HSN. Data: `shipping-tax.ts`/`tax_rates`. Shopify ref: Taxes auto‑calc + regional.
- **S2.10 Domains** (`settings/domains/page.tsx`) — connect/verify custom domain, primary domain. Data: `stores.ts`. Shopify ref: Domains pane.
- **S2.11 Notifications** (`settings/notifications/page.tsx`) — email templates + merchant alert prefs. Data: `notifications.ts`. Shopify ref: Notifications with templates.
- **S2.12 Policies** (`settings/policies/page.tsx`) — legal policies (refund/privacy/terms), auto‑generate templates. Data: `pages.ts`/`cms-core`. Shopify ref: Legal policies with templates.
- **GATE S2:** all 13 panes on the hub + grammar + save bar; bespoke settings CSS removed; routes intact; 128/128; before/after each.

### S3 — Add the Missing Panes
- **S3.1 Apps & Sales Channels** (`settings/apps/page.tsx` — new) — list installed apps + manage/uninstall (ConfirmDialog + data‑loss note); link to App Marketplace. **Data:** `app-store.ts`/`app_installs`. **Effort:** M. **Priority:** P1. Shopify ref: Apps & sales channels pane.
- **S3.2 Business details** (`settings/business/page.tsx` — new) — legal entity, GSTIN, billing address. **Data:** `stores.ts` (if fields exist) else `[SKIP — NEEDS BACKEND: business_details fields on sites]`. **Effort:** S. **Priority:** P2.
- **S3.3 Languages & Localization** (`settings/localization/page.tsx` — new) — store languages + default locale (drives theme `locales/`). **Data:** theme locale data via `themes.ts` if present, else `[SKIP — NEEDS BACKEND: store locales endpoint]` with placeholder. **Effort:** M. **Priority:** P2.
- **S3.4 Security** (`settings/security/page.tsx` — new) — 2FA/passkeys/recovery‑codes UI. **Data:** `auth.ts` if 2FA endpoints exist, else `[SKIP — NEEDS BACKEND: 2FA endpoints]` + clear "coming soon" pane. **Effort:** M. **Priority:** P2.
- **S3.5 Custom Data** (`settings/custom-data/page.tsx` — new) — metafields/metaobjects manager. **Data:** likely none → `[SKIP — NEEDS BACKEND: metafields API]` + placeholder/empty state. **Effort:** M. **Priority:** P3.
- **GATE S3:** missing panes present (real or honest placeholder); 128/128.

### S4 — Search, Guidance & Feedback
- **S4.1** Settings **search** (filters the index; jump to any setting). **Files:** `…/components/settings/SettingsSearch.tsx`. **Effort:** S. **Priority:** P1. Shopify ref: searchable settings.
- **S4.2** Contextual `Banner`/tips on key panes ("Set up payments to start selling"); toasts on every save; skeletons on load. **Effort:** S. **Priority:** P1.
- **GATE S4:** search works; guidance + feedback present; 128/128.

### S5 — Responsive & Polish
- **S5.1** Responsive settings (index → drawer/accordion on ≤768px; panes stack); a11y pass (focus order, ARIA, AA contrast); final consistency sweep. **Effort:** M. **Priority:** P1. _DoD: settings usable at 375px (mobile screenshots)._
- **GATE S5 (FINAL):** hub complete; all panes consistent; responsive + accessible; 128/128, typecheck/tests green; before/after for every pane; status report written.

---

## 4. PARALLELIZATION GUIDE
WS9 runs **fully in parallel with WS2** because it owns only `settings/**` while WS2 owns the rest of `merchant-control-plane/src`. The only coupling is the **Settings nav registration** (handoff to WS2's route manifest) and **`@letbuyy/ui` consumption** (WS1, read‑only). One agent is sufficient; a second could take S3 (new panes) while the first does S2 (migrations) — they touch different files.

## 5. SHOPIFY REFERENCE — Settings hub
Shopify centralizes all configuration in `/settings` with a grouped left index (Store details, Plan, Billing, Users & permissions, Payments, Checkout, Shipping & delivery, Taxes & duties, Domains, Notifications, Languages, Policies, Apps & sales channels, Customer accounts, Custom data, Security). Each pane uses the same Page/Card grammar, a single contextual save bar, inline validation, and contextual help. Permissions gate which panes a staff role can see. LetBuyy must match this **structure and feel** over its existing gateway data.

## 6. LEDGER — `CODEX_WS9_LEDGER.md`
```
# CODEX WS9 (SETTINGS) LEDGER — started <ts>
## BASELINE (S0): 13 panes inventoried + data sources; before-screenshots <paths>
## PROGRESS LOG (newest first): <ts> [S#] <task> — DONE — <cmd>->result — screenshot <path> — commit <sha>
## SKIPPED — NEEDS HUMAN / BACKEND / HANDOFF: [SKIP] <pane> — requires <endpoint/field/manifest>
## VISUAL LEDGER: <ts> <pane> — before <path> | after <path>
## VALIDATOR LEDGER: <ts> validate:governance -> 128/128 after <sha>
```

## 7. LAUNCH PROMPT
```
You are WS9 (Settings Architecture) in docs/Codex_waves/LETBUYY_MASTER_EXECUTION_BLUEPRINT_V2.md.
Work ONLY in git worktree branch stream/WS9-settings.
Read docs/Codex_waves/CODEX_SETTINGS_ARCHITECTURE_MISSION.md in full.
OWN ONLY: apps/merchant-control-plane/src/app/[store]/settings/** and .../src/components/settings/**.
NEVER edit @letbuyy/ui, the Sidebar/global layout/globals.css (WS2), backend, contracts, db, or governance.
Build the unified Settings hub shell, migrate the 13 existing panes onto @letbuyy/ui grammar + sticky SaveBar,
add the missing panes (Apps & Channels, Business, Localization, Security, Custom Data) against existing gateway
data — [SKIP — NEEDS BACKEND] with a placeholder pane where data is absent. Add settings search + guidance +
responsive + a11y. Before/after screenshot per pane. Keep all 128 validators green per commit; small reversible
commits; max 3 attempts then BLOCKED. Maintain CODEX_WS9_LEDGER.md. Begin with S0.1 now.
```

## 8. NORTH STAR
One Settings hub, one grammar, one save bar, every pane consistent and guided — turning 13 scattered config pages into a Shopify‑class commerce operating system's control room.
