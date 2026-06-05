# CODEX FOUNDATION MISSION — LetBuyy_Store → "Shopify for India"

**Driver:** GPT‑5.5 in Codex, reasoning effort `xhigh` for architecture/refactor tasks, `medium` for mechanical edits.
**Mode:** Continuous, autonomous, local. Do not stop between tasks. Pick the next task the instant one finishes.
**Authority basis:** `LETBUYY_DEEP_AUDIT_AND_SHOPIFY_BLUEPRINT.md` (the verified audit) is the source of truth for *what is wrong*. This file is the source of truth for *what to do and how to behave*. If they conflict, this file wins.
**Scope chosen by owner:** FULL PLATFORM — Phases 0 through 5.
**Theme strategy chosen by owner:** INTERIM JSON‑contract themes‑as‑data now, with a clean Liquid seam for later.
**Governance posture chosen by owner:** KEEP ALL 128 VALIDATORS GREEN at every commit. You may NOT delete or weaken validators. You MAY update governance *memory/expectations* (topology manifests, allowlists) in lockstep with an architecture change when that is the legitimate, intended update. Anything that needs a human *policy* decision → `[SKIP — NEEDS HUMAN]` and continue.

---

## 0. PRIME DIRECTIVE

Transform LetBuyy from "too much of the wrong code in too many places, with no single source of truth" into a **single‑source‑of‑truth commerce platform** that is structurally a Shopify‑for‑India: one Commerce API, one shared domain contract, portable themes‑as‑data, an open app platform, and India‑native payments/compliance/logistics — **without a rewrite**, by consolidating and correcting what already exists.

You succeed when, at the end, ALL of the following are simultaneously true and proven by command output recorded in the ledger:

1. No app under `apps/**` contains business logic or imports `@supabase/*` directly; every app is a thin client of the **one Commerce API** (`services/api-gateway`) and types come from `@letbuyy/shared-types`.
2. There is exactly **one** implementation of each domain (Order, Product, Customer, Payment, Theme) — no forks.
3. A **second theme** can be added to the storefront with **zero storefront code changes** (themes are data), and the theme editor is generated from `settings_schema.json`.
4. There is exactly **one** payment code path behind a provider abstraction with India‑native providers wired (Razorpay live; Cashfree/PhonePe/UPI/COD scaffolded).
5. `pnpm turbo typecheck`, `pnpm run validate:governance` (all 128), `pnpm lint`, `pnpm turbo build`, and the Playwright suite all pass.
6. The mission ledger (`CODEX_MISSION_LEDGER.md`) shows every task either `DONE` (with evidence) or `[SKIP — NEEDS HUMAN]` (with exact remediation), and `CODEX_FOUNDATION_STATUS_V2.md` summarizes the run.

---

## 1. OPERATING CONTRACT (how you must run)

These rules are non‑negotiable. They exist because the previous autonomous run on this repo (`FOUNDATION_STATUS.md`, "Codex Foundation Mission") produced CI/CD + 128 validators and **zero product** — the classic ceremony trap. Do not repeat it.

1. **Continuous execution.** After completing a task, immediately update the ledger and start the next unblocked task. Do not pause to ask the human. Do not end the session while unblocked tasks remain.
2. **The Green Law.** The repo must be green after every commit. Before committing any increment run, at minimum: `pnpm turbo typecheck`, `pnpm lint`, and the relevant `pnpm run validate:*` for the area you touched; run the FULL `pnpm run validate:governance` at every phase gate. Never commit a red tree. If a change would turn the tree red and you cannot make it green within 3 attempts, revert the change, log it as `BLOCKED` with the diagnosis, and move on.
3. **Small reversible increments.** One logical change → validate → commit with a clear message. Never accumulate a giant uncommitted diff. Prefer 200 small green commits over 1 big red one.
4. **Human‑skip ledger (the "mark and continue" rule you asked for).** When a step requires anything a local agent cannot safely do, DO NOT block the mission. Write an entry in `CODEX_MISSION_LEDGER.md` under `## SKIPPED — NEEDS HUMAN` with: the task, the exact command/credential/decision required, and why it is human‑gated. Then continue with the next non‑blocked task. SKIP triggers:
   - Remote git mutation (push, delete remote branch, PR merge).
   - Secrets/credentials/API keys (Razorpay live, Supabase service role, Cloudflare, Vercel, Resend, Turnstile…).
   - **Production** database mutations or anything touching the live `qtrzgnnqnvboifoqntfi` Supabase project.
   - Irreversible deletes outside `docs/archive/`.
   - Paid third‑party account setup (Shiprocket, Cashfree, PhonePe, GST e‑invoice provider).
   - Policy/legal/pricing decisions (final ₹ price points, GST e‑invoice vendor, refund policy).
   - DNS / Vercel project / Cloudflare resource creation.
5. **Anti‑ceremony guardrails (do NOT do these):**
   - Do NOT create new governance validators, new "framework" abstractions, new runtime services, or new top‑level docs beyond the two ledger/status files. This mission REDUCES surface area.
   - Do NOT add new Next.js API routes under `apps/**/app/api/**`. The freeze is permanent for this mission.
   - Do NOT create a fourth backend or a new event system. The api‑gateway is the one front door.
   - Do NOT write status reports claiming completion of work that is not green and committed.
6. **No fabrication.** Never fake a passing test, never stub a function and mark the task done, never invent file paths or command output. If you didn't run it, don't claim it. Evidence (command + result) is required for every `DONE`.
7. **Anti‑thrash.** Max 3 attempts per task. On the 3rd failure, stop, write a precise `BLOCKED` diagnosis (what you tried, the error, your hypothesis) in the ledger, and move to the next task. Never loop on the same error.
8. **Self‑verify with the browser.** After any storefront or admin UI change, start the dev server, drive it with Playwright/the built‑in browser, screenshot the result, and confirm the flow works before marking `DONE`.
9. **Reasoning effort.** Use `xhigh` for: architecture decisions, the shared‑contract design, the themes‑as‑data refactor, the payment abstraction. Use `medium` for: mechanical route migrations, moving files to archive, import rewrites.
10. **Respect existing law.** Obey `AGENTS.md`, `CLAUDE.md`, and `docs/governance/` (e.g. the Deprecated Runtime Policy and Reserved Service Roots). Where this mission needs to change a governance expectation, update the governance memory in the *same commit* as the code change so the suite stays green and honest.

---

## 2. ARCHITECTURE INVARIANTS (the target shape — never violate)

- **One Commerce API:** `services/api-gateway` (Hono worker) is the single backend. All domain logic lives in the `@letbuyy/*-core` packages, invoked *through* the gateway.
- **One contract:** `@letbuyy/shared-types` is the only place domain types are defined. Gateway zod schemas (`services/api-gateway/src/schemas/*`) derive from / agree with it. Apps import generated client types — never hand‑roll a `Product`/`Order`/`Customer`.
- **Apps are thin clients:** an app may render UI and call the typed API client. It may not import `@supabase/*`, may not hold a DB connection, may not define domain logic.
- **Themes are data:** a theme is a portable bundle (settings_schema + templates JSON + section/block definitions + locales) stored in `theme_packages`. The storefront *interprets* the bundle. Adding a theme is uploading a bundle, not editing code.
- **One payment path:** all charges flow through `@letbuyy/payments` behind the gateway; all provider webhooks land in `services/webhook-service`.
- **SSO stays as is, hardened:** `accounts.letbuyy.store` (identity‑platform) is the auth hub; `lb_session` (merchant) and `lb_customer_session` (shopper) are validated by ONE shared verifier in `@letbuyy/auth-core`, not per‑app copies.

---

## 3. LEDGER FORMAT (create and maintain `CODEX_MISSION_LEDGER.md`)

Create it in the first task and keep it current after EVERY task. Structure:

```
# CODEX MISSION LEDGER — started <ISO timestamp>

## BASELINE (Phase 0, task 0.1)
- typecheck: PASS/FAIL (output excerpt)
- validate:governance: PASS (128/128) / FAIL (which)
- lint / build / test: ...

## PROGRESS LOG  (newest first)
- <timestamp> [Phase X.Y] <task> — DONE — evidence: <command> -> <result> — commit <sha>
- <timestamp> [Phase X.Y] <task> — BLOCKED — tried A/B/C — error <...> — hypothesis <...>

## SKIPPED — NEEDS HUMAN
- [SKIP] <task> — requires: <exact command / credential / decision> — reason: <...> — unblocks: <which later tasks>

## VALIDATOR LEDGER (keep all 128 green)
- <timestamp> validate:governance -> 128/128 PASS after commit <sha>
```

Rule: the **SKIPPED** and **VALIDATOR LEDGER** sections are append‑only history. Never silently drop a skip.

---

## 4. THE WORK — PHASES 0 → 5

Execute phases in order. Within a phase, do tasks in order. **Do not start a phase until the previous phase's gate is green.** Each task lists a Definition of Done (DoD). A task is only `DONE` when its DoD is met AND the area validators are green.

### PHASE 0 — Truth & Safety ("stop the bleeding")

Goal: make the tree tell the truth and install the freeze, without breaking green.

- **0.1 Baseline.** Run `pnpm install`, `pnpm turbo typecheck`, `pnpm run validate:governance`, `pnpm lint`, `pnpm turbo build --dry-run`, `pnpm test`. Record every result in the ledger BASELINE. This is the green bar you must preserve. _DoD: baseline recorded._
- **0.2 Quarantine dead packages.** Move the 16 orphan package dirs (`analytics`, `analytics-core`, `api`, `auth`, `config`, `db`, `payments`, `shared`, `shared-utils`, `ui`, `ui-system`, `mobile-core`, `mobile-models`, `mobile-services`, `mobile-ui-kit`, `dart`) into `docs/archive/legacy-packages/<name>/`. First `grep -r "@letbuyy/<name>"` to confirm zero live imports; if any exist, fix the importer first. **Do not hard‑delete.** `payments` and `ui` will be rebuilt fresh later, so archive their content but note it. _DoD: orphans gone from `packages/`; governance still 128/128 green (run it)._
- **0.3 Reconcile empty service stubs.** The 6 stubs (`analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service`) contain only `AGENTS.md` + `runtime.manifest.json` and may be referenced by topology/runtime validators and by `docs/governance/runtime-boundaries.md` as Reserved Service Roots. **Check first** which validators read them. If they are governed reserved roots, LEAVE them and log that they are intentional placeholders. If they are not referenced anywhere, archive them like 0.2. Never break a topology validator — update its manifest expectation in the same commit if you remove a root. _DoD: stubs resolved one way or the other; governance green; decision logged._
- **0.4 Permanent route freeze (green‑safe).** Add an ESLint boundary rule: (a) forbid new files matching `apps/**/app/api/**/route.ts`, (b) forbid `@supabase/*` imports under `apps/**`, (c) forbid local domain‑type declarations under `apps/**`. To keep the tree green against the ~122 existing routes, ship the rule with a generated baseline allowlist of the *current* offenders so only NEW violations fail. _DoD: rule active; `pnpm lint` green; adding a new api route locally fails lint._
- **0.5 Declare the One Commerce API.** Record in `AGENTS.md` governance memory (not a new doc) that `services/api-gateway` is the sole backend and `@letbuyy/shared-types` the sole contract. Update any governance validator expectation that needs to know this, in the same commit. _DoD: decision encoded; governance green._

**PHASE 0 GATE:** `pnpm run validate:governance` 128/128, typecheck, lint, build all green. Log to VALIDATOR LEDGER.

### PHASE 1 — One Contract + Collapse the Backends (fixes Issues 1, 2, 7)

Goal: every app becomes a thin client of the gateway; one domain model.

- **1.1 Complete the domain contract.** Expand `packages/shared-types/src/index.ts` (currently 243 lines) into the full domain model: `Store`, `Product`, `Variant`, `Collection`, `Order`, `LineItem`, `Customer`, `Address`, `Cart`, `Payment`, `Theme`, `Page`, `Coupon`, etc. Keep it framework‑free. _DoD: types compile; exported from package index._
- **1.2 Align gateway schemas to the contract.** Make `services/api-gateway/src/schemas/*.schema.ts` derive from or exactly match `@letbuyy/shared-types` (zod ↔ types). _DoD: gateway typechecks against shared‑types; no divergent field names._
- **1.3 Build the typed API client.** Create `packages/typescript/api-client` (`@letbuyy/api-client`): a typed fetch wrapper over the gateway, returning `shared-types`. Add to workspace. _DoD: client typechecks; one example call works against local gateway._
- **1.4 Move logic into core, behind the gateway.** For each domain, ensure the real logic lives in the matching `@letbuyy/*-core` package and is exposed by a gateway route. Fill gaps where a route currently only exists as a Next handler. _DoD: gateway can serve the domain end‑to‑end locally._
- **1.5 Migrate merchant‑control‑plane (62 routes).** Domain by domain (start products → orders → customers → themes → pages → coupons). For each: replace the Next API route's logic with a call to `@letbuyy/api-client`; delete the route if it becomes a pure passthrough the app can call directly; ensure types come from shared‑types. Run the admin Playwright smoke after each domain. _DoD: merchant‑control‑plane has no direct supabase, no local domain logic; admin smoke green._
- **1.6 Migrate storefront‑runtime read paths (28 routes).** Same treatment for non‑payment routes (store‑lookup, products, orders/check, customer/*). Payments handled in Phase 2. _DoD: storefront read flows go through the client; storefront smoke green._
- **1.7 One session verifier.** Move `lb_session` / `lb_customer_session` validation into a single `@letbuyy/auth-core` verifier; replace per‑app copies in identity‑platform, merchant‑control‑plane, app‑marketplace, theme‑marketplace. Add a test that all apps accept/reject the same token identically (kills the redirect‑loop risk). _DoD: one verifier; cross‑app auth test green._
- **1.8 Flip the boundary rule to ERROR** for migrated apps (remove them from the 0.4 allowlist as they go clean). _DoD: lint green with apps enforced._

**PHASE 1 GATE:** full governance 128/128, typecheck, lint, build, Playwright smoke (marketing/accounts/admin/storefront) all green.

### PHASE 2 — Unify Payments, India‑first (fixes Issue 6)

Goal: exactly one payment path, India‑native.

- **2.1 Create `packages/payments`** (real, in workspace, `@letbuyy/payments`). Define a `PaymentProvider` interface (createIntent, verify, capture, refund, webhookVerify) and money handling in INR minor units with idempotency keys. _DoD: package typechecks; interface documented in code._
- **2.2 Provider adapters.** Razorpay (port existing working logic — it's already wired, see migration `016_razorpay_plan_ids`). Scaffold Cashfree, PhonePe, native UPI (incl. UPI AutoPay for subscriptions), and **COD with verification**. Keep Stripe/PayPal as secondary adapters, not primary. Live keys → `[SKIP — NEEDS HUMAN]`. _DoD: Razorpay adapter passes `services/api-gateway/src/__tests__/payments.test.ts`; others compile as scaffolds._
- **2.3 Single charge path.** Route all charges through `@letbuyy/payments` via the gateway. **Delete** the 7 forked storefront routes under `apps/storefront-runtime/src/app/api/payments/{razorpay,stripe,paypal}/...`. _DoD: storefront has no payment routes; one path remains._
- **2.4 One webhook verifier.** Move all provider webhook handling into `services/webhook-service`; verify signatures once; emit domain events. _DoD: webhook tests green; no duplicate verifier._

**PHASE 2 GATE:** governance 128/128, payments tests green, storefront checkout Playwright flow green (test mode).

### PHASE 3 — Themes‑as‑Data (interim JSON→Liquid) (fixes Issue 3 — your headline)

Goal: a theme becomes portable data; a new theme needs zero storefront code.

- **3.1 Theme bundle contract.** Define and document (in code, via zod in `@letbuyy/theme-engine`) the bundle shape: `config/settings_schema.json`, `config/settings_data.json`, `templates/*.json`, a section manifest, block definitions, `locales/*.json`. Persist to the existing `theme_packages` / `theme_package_versions` tables. _DoD: a bundle validates against the schema._
- **3.2 Make the 47 renderers data‑described.** Refactor `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx` so each section publishes a JSON settings schema and consumes settings from `templates/*.json` — the storefront renders by *interpreting the template + data*, not by hardcoding which sections a theme has. _DoD: the storefront renders a theme purely from its bundle._
- **3.3 Liquid seam.** Introduce a `ThemeRenderer` interface with the JSON‑contract engine as the default implementation and a `LiquidRenderer` stub behind the same interface (not implemented now). This is the clean seam so Liquid can be dropped in later without touching callers. _DoD: interface in place; default engine wired; stub compiles._
- **3.4 Schema‑driven editor.** Replace the bespoke 535‑line editor (`apps/merchant-control-plane/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx`) with a GENERIC editor that renders form controls from `settings_schema.json` and writes `settings_data.json`. Archive the old editor. _DoD: editing any theme works through the generic editor; admin smoke green._
- **3.5 Install = upload bundle.** Implement theme‑package upload → validate → store → activate, surfaced in `theme-marketplace` + `merchant-control-plane`. _DoD: uploading a valid bundle makes it installable._
- **3.6 Re‑open the catalog.** Add a NEW migration `067_reenable_dynamic_theme_catalog.sql` (never edit old migrations) that undoes the single‑theme lock from `055/058/066`. Any production data change → `[SKIP — NEEDS HUMAN]`; apply locally only. _DoD: local catalog shows ≥2 themes; both render._

**PHASE 3 GATE:** governance 128/128; Playwright renders TWO distinct themes from bundles; generic editor round‑trips settings.

### PHASE 4 — App Platform & Marketplace

Goal: an open app ecosystem with app‑blocks, OAuth, billing.

- **4.1 App‑block contract.** Extend the theme renderer with app‑block slots so an installed app can render into the storefront (Shopify app‑block parity). _DoD: an example app block renders in a theme._
- **4.2 App lifecycle + OAuth.** Per‑app scoped tokens via `@letbuyy/auth-core`; install/uninstall; webhooks via `services/webhook-service`. _DoD: example app installs and receives a webhook locally._
- **4.3 Billing API.** Recurring/usage charges over Razorpay via `@letbuyy/billing-core`, merchant‑approved (use existing Razorpay plan ids). Live keys → SKIP. _DoD: billing flow works in test mode._
- **4.4 Admin embed ("LetBuyy App Bridge").** Iframe embed + a minimal JS bridge so third‑party apps appear native in `merchant-control-plane`. _DoD: example app embeds and calls the API via the bridge._

**PHASE 4 GATE:** governance 128/128; example app installs, renders an app block, and bills (test mode); E2E green.

### PHASE 5 — India‑Native, Localization, Pricing, Scale

Goal: the differentiators.

- **5.1 GST invoicing.** GSTIN capture, HSN codes on products, CGST/SGST/IGST split, invoice generation; e‑invoice provider integration → `[SKIP — NEEDS HUMAN]` (vendor choice). _DoD: a GST‑correct invoice generates for a test order._
- **5.2 Logistics.** Adapter interface + Shiprocket/Delhivery/Pickrr scaffolds for label + tracking; live accounts → SKIP. _DoD: adapter interface + one scaffold compile and are wired to fulfilment._
- **5.3 Localization.** Hindi + major regional languages via theme `locales/` and admin i18n scaffolding. _DoD: storefront renders a non‑English locale from a bundle._
- **5.4 Pricing tiers.** Wire plan tiers (e.g. ₹0 / ₹399 / ₹999 — final numbers `[SKIP — NEEDS HUMAN]`) to `billing-core` + Razorpay plans. _DoD: tier selection + entitlement gating works in test mode._
- **5.5 Governance posture.** Per owner's choice, KEEP ALL 128 validators. Do **not** delete any. In the ledger, record a *recommendation* (not an action) listing which validators are highest‑cost/lowest‑value for a future human‑approved consolidation. _DoD: recommendation logged; suite still 128/128._

**PHASE 5 GATE (FINAL):** full governance 128/128, typecheck, lint, `pnpm turbo build`, and the complete Playwright E2E (storefront + admin + checkout) all green.

---

## 5. FINAL REPORT — write `CODEX_FOUNDATION_STATUS_V2.md`

When the final gate is green (or no unblocked tasks remain), write a status report mirroring the old `FOUNDATION_STATUS.md` style: per‑phase completion table, the Success‑Criteria checklist from §0 with PASS/FAIL + evidence, the full `SKIPPED — NEEDS HUMAN` list (so the human knows exactly what to finish), and the final validator/typecheck/build/E2E results. Do not mark the mission COMPLETE unless §0's six criteria are all proven green; otherwise mark it `BLOCKED — AWAITING HUMAN` and list precisely why.

---

## 6. LAUNCH PROMPT (paste this into Codex `/goal` to start)

```
Read CODEX_FOUNDATION_MISSION.md and LETBUYY_DEEP_AUDIT_AND_SHOPIFY_BLUEPRINT.md in full.
Execute CODEX_FOUNDATION_MISSION.md exactly, Phases 0→5, continuously and autonomously.

Operating rules (from that file, obey strictly):
- Keep the tree green after every commit; run the relevant validators each increment and the full
  `pnpm run validate:governance` (all 128) at every phase gate. Never commit red.
- Do NOT stop between tasks. Do NOT ask me. If a step needs a human (credentials, remote git,
  production DB, paid signups, policy/pricing), append it to CODEX_MISSION_LEDGER.md under
  "SKIPPED — NEEDS HUMAN" with the exact command/decision required, then continue the next task.
- Small reversible commits. Max 3 attempts per task, then log BLOCKED and move on.
- Do NOT add new validators, new docs, new services, or new Next.js API routes. Reduce surface area.
- No fabrication: every DONE needs the command + result as evidence. Self-verify UI with the browser/Playwright.
- Reasoning: xhigh for architecture/refactors/theme/payments; medium for mechanical edits.

Maintain CODEX_MISSION_LEDGER.md from the first task. When the §0 success criteria are all green,
write CODEX_FOUNDATION_STATUS_V2.md. Begin with Phase 0, task 0.1 (baseline) now.
```

---

## 7. ONE‑LINE NORTH STAR

Force every app through one Commerce API, make every theme a piece of portable data, and unify the one money path — everything else in this mission serves those three truths.

