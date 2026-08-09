# 25 — Follow-up Backlog

> **Date:** 2026-08-05. Ordered P0 → P2. Scope is expressed in relative effort, never calendar dates.
>
> **P0** = blocks any canary decision, or is exploitable / legally exposed.
> **P1** = breaks a governance invariant or a shipped promise.
> **P2** = hygiene, correctness of tooling, or drift.

---

## P0

### P0-1 — Make the React fallback render coerced Liquid sections
- **Owner:** theme / storefront-runtime
- **Dependency:** none — this is the top of the tree
- **Blast radius:** `renderer-registry.tsx`, `composition-engine.tsx`; every Liquid store's failure mode
- **ARB:** ✅ D-09
- **Why:** coerced sections carry `rendererKey: 'liquid.section.<type>'`, which never matches
  `COMPATIBILITY_RENDERER_KEYS`. 22 of 44 sections render a "Renderer not available" placeholder on
  fallback. THEME-R6 designates this switch as *the* rollback, so **Liquid has no working rollback**
- **Acceptance:** for every one of the 44 sections, forcing `rendererEngine` off yields a working React
  page, asserted per section
- **Rollback:** revert the registry mapping
- **Scope:** medium — mapping + per-section verification

### P0-2 — Wire the parity harness into CI
- **Owner:** theme / platform · **Dependency:** P0-1 · **ARB:** ✅ D-09
- **Why:** `scripts/liquid-parity/run-parity-matrix.mjs` exists but is in **no workflow and no package
  script**, so THEME-R6 / TEST-R6's "parity harness green" gate is unenforceable
- **Acceptance:** a CI job fails on a parity regression
- **Scope:** small

### P0-3 — Decide the checkout handoff contract
- **Owner:** checkout + ARB · **ARB:** ✅ D-01 · **Blast radius:** public API contract
- **Why:** the ART-14 cart-bound signed handoff is correctly built and **orphaned**; the live path
  (`POST /v1/storefront/:subdomain/orders`) accepts raw `items[]` with no cart binding or session, capped
  only by 20 req/5 min/IP. Server-authoritative *pricing* does hold, so this is an authorization gap
- **Acceptance:** order-create refuses an unsigned request; every first-party client uses the handoff
- **Rollback:** feature-flag the enforcement
- **Scope:** medium — touches a public contract

### P0-4 — Release inventory when payment fails
- **Owner:** checkout + ARB · **ARB:** ✅ D-02
- **Why:** inventory is hard-decremented **before** payment and never released — a denial-of-inventory
  vector. ART-14 requires reserve-with-TTL
- **Acceptance:** a failed/abandoned payment restores availability within the TTL
- **Scope:** medium

### P0-5 — GST: send `stateCode`, issue invoices
- **Owner:** checkout + finance + ARB · **ARB:** ✅ D-03
- **Why:** GST computes to **zero** on every live order because the React checkout never sends
  `address.stateCode`; `gst_invoices` and its immutability triggers exist but **nothing ever inserts**.
  India-first legal exposure
- **Acceptance:** correct CGST/SGST vs IGST by place of supply; an immutable invoice per order
- **Scope:** medium

### P0-6 — Ledger COD at confirm
- **Owner:** finance + ARB · **ARB:** ✅ D-04
- **Why:** `cod_receivable` is only touched at remittance, where it is *debited* — no origination entry
  ever credits it (PAY-R2 / R-5)
- **Acceptance:** Σdebit = Σcredit across a COD lifecycle; reconciliation shows zero drift
- **Scope:** medium — money RPC, ARB-gated

---

## P1

### P1-1 — Fix the render concurrency, then re-tighten `renderLimit`
- **Owner:** theme · **Dependency:** none · **ARB:** no
- **Why:** sections render via `Promise.all` while `sanitizeRenderedHtml` runs jsdom + DOMPurify
  synchronously, so wall-clock budgets are charged sibling work. The F9 benchmark shows the parallel path
  is **~5× slower** than sequential (227 ms vs 42 ms for N=25) — it is both the bug's cause and a
  pessimisation. Raising `renderLimit` 250 → 5 000 ms removed the symptom, not the cause
- **Acceptance:** sanitization off the render path (or sequential rendering); `renderLimit` returns to a
  tight value with `liquid-render-limit-contention.test.ts` still green
- **Rollback:** revert to the current parallel path
- **Scope:** medium

### P1-2 — Build the shopper password-reset UI
- **Owner:** storefront-runtime · **Dependency:** ARB answers in [24](24-known-limitations.md) §3.1 · **ARB:** ✅
- **Why:** the gateway backend is complete (tenant-bound, hashed, 1 h TTL, one-time, rate-limited) but the
  `/account/reset-password` route it emails does not exist. Shoppers have **no** recovery path
- **Acceptance:** request + confirm work, including **without JavaScript**; cross-store tokens rejected
- **Scope:** small-medium — **no new gateway route or migration required**

### P1-3 — Ship the Turnstile widget in the Liquid auth sections
- **Owner:** theme + identity · **ARB:** ✅ D-07
- **Why:** the gateway requires a Turnstile token; the Liquid login/register sections ship no widget, so
  no-JS auth returns **403 TURNSTILE_REQUIRED every time**. The no-JS path is advertised but cannot work
- **Acceptance:** no-JS login and register succeed end to end
- **Scope:** small

### P1-4 — Wire experience compositions to the editor call site
- **Owner:** theme + merchant-control-plane · **Dependency:** none (blocking sections now exist) · **ARB:** no
- **Why:** `applyExperienceToDocument` / `computeExperienceApplyDiff` have **no runtime caller**; applying
  a preset writes only a 10-key token overlay while `ExperiencePicker` advertises a section count
- **Acceptance:** applying a preset produces its declared sections; the advertised count matches
- **Scope:** small — the engine API is ready

### P1-5 — Collapse the three active-theme stores to one
- **Owner:** theme + ARB · **ARB:** ✅ D-06 (an R-15 ruling)
- **Why:** `sites.theme_id`, `theme_instances.instance_status` and `store_themes.is_active` can and do
  disagree. `store_themes` has no one-active constraint
- **Acceptance:** one canonical store; the others derived or dropped; a constraint enforces uniqueness
- **Scope:** medium

### P1-6 — Stop `GET` requests mutating theme state
- **Owner:** gateway + ARB · **ARB:** ✅ D-06
- **Why:** `GET /themes/:slug/editor` → `ensureThemeInstance` deactivates every *other* instance;
  `GET /themes/:slug/schema` is unauthenticated yet performs registry writes
- **Acceptance:** no `GET` writes; a regression test asserts it
- **Scope:** medium — must not break the editor. **Note:** `theme-execution.adapter.ts` currently holds
  166/81 lines of uncommitted user work; coordinate before editing

### P1-7 — Unify the customer session token shape
- **Owner:** identity + gateway · **ARB:** ✅ D-07
- **Why:** two incompatible HS256 shapes under one cookie (`store_id`/`customer_id` vs
  `sub`/`storeId`/`email`/`name`), 30 min vs 7 days
- **Scope:** medium

### P1-8 — Rate-limit and Turnstile `POST /api/orders/login`
- **Owner:** gateway · **ARB:** ✅ D-07
- **Why:** same bcrypt check as `/customer/login` with **no** Turnstile and **no** rate limit — an
  unthrottled brute-force plus order-disclosure surface
- **Scope:** small

### P1-9 — Fix the seed's lossy `section_schemas`
- **Owner:** platform/DB · **ARB:** no
- **Why:** `seeds/urban-kicks-theme.sql` writes a shape that **overrides** the engine registry (DB schemas
  merge *after* built-ins), making `validateThemeSectionSettings` reject real settings; its
  `settings_schema` is the bare 1-field shape
- **Acceptance:** a fresh DB validates its own shipped theme
- **Scope:** small

### P1-10 — Decide `FEATURE_LIQUID`
- **Owner:** ARB + gateway · **ARB:** ✅ D-08
- **Why:** it gates nothing while `docs/governance/feature-flag-governance.md:20` presents it as a lever.
  An operator toggling it during an incident changes nothing
- **Scope:** small

---

## P2

| # | Item | Owner | ARB | Why | Scope |
|---|---|---|---|---|---|
| P2-1 | Split `routes/themes.ts` (1 870 lines vs 1 500) | theme | no | `route-line-count-validator` red; safe but a 370-line extraction across every theme endpoint | medium |
| P2-2 | Test-fixture allowlist in `environment-validator` | platform | no | It flags negative-test fixtures (`'sk_live_should_never_reach_liquid'`) whose purpose is asserting non-leakage. **Do not redact the fixtures** | small |
| P2-3 | Isolate the render benchmark | theme/CI | no | Wall-clock assertion in a concurrent pool; 711 ms vs a 30 000 ms budget. **Do not raise the budget** | small |
| P2-4 | Open Graph + favicon via sanitizer `ADD_ATTR` (`property`, `rel`) | theme + ARB | ✅ | Currently emitted as malformed `<meta content="…">`, so they were removed | small |
| P2-5 | Fix `apps/storefront-runtime/.../liquid-theme.css` | storefront | no | 0 `--lb-*`, 34 raw hex, 28 raw px, desktop-first — UI-R1/R7 | small |
| P2-6 | Add `instagram-feed` and `video-hero` Liquid sections | theme | no | Mapped but absent; currently carry the mapped-but-absent coverage | small |
| P2-7 | Make `theme_presets` represent the 10 experiences | theme | no | 1 stale row; the registry is code-only, so presets cannot be authored without a deploy | medium |
| P2-8 | Add `/search`, `/customers/register`, `/contact` routes | storefront | no | Templates/sections exist; routes 404. Missing keys silently render the homepage | medium |
| P2-9 | Guest → authenticated cart merge | commerce | no | No client sets `customer_id`; cross-device continuity is lost | medium |
| P2-10 | Collapse the two cart implementations | commerce | ✅ (WIN-R4) | Two implementations share one localStorage namespace; the Liquid one sends `variant_id: null` | medium |
| P2-11 | Mock/sandbox Razorpay adapter + `ProviderModeBadge` | checkout | no | Payments unverifiable offline; UI-R6/PAY-R10 unmet buyer-side | medium |
| P2-12 | Regenerate `tenant-tables.registry.ts` | platform | no | `tenant-isolation-validator` red since migrations 176/185 | small |
| P2-13 | Make `validate-governance.mjs` non-destructive and report all failures | platform | no | It `rm -rf`s `node_modules` and exits at the first failure — the reason the handoff reported "2" instead of 22 | small |
| P2-14 | Bring `services/lcis-api` + 19 `packages/lcis-*` under governance | lcis + ARB | ✅ D-10 | Escape ARCH-R2 entirely; no validator sees them | medium |
| P2-15 | Commit the `node:crypto`/`jsdom` build fix | user | no | Lives in two **uncommitted** `next.config.ts` files and one **untracked** stub. If HEAD ships as-is it ships without it | small |
| P2-16 | Revoke or expire theme preview sessions | gateway | no | The lookup filters `expires_at` but not `revoked_at`/`deleted_at`, so a revoked session still renders | small |

---

## Ordering constraints

- **P0-1 → P0-2 → any canary decision.** Nothing about rollout can be decided while rollback is broken.
- **P1-1 before re-tightening `renderLimit`** — the current value is a symptom fix.
- **P1-4 needs no new work** — the sections that blocked it now exist.
- **P1-2 needs no gateway route or migration** — only the ARB answers in [24](24-known-limitations.md) §3.1.
- **P1-6 must coordinate with the uncommitted user work** in `theme-execution.adapter.ts`.
- **P2-15 gates any deploy from HEAD**, independently of theme readiness.
