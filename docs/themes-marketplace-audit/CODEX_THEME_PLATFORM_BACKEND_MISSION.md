<!-- CODEX MISSION PROMPT — point Codex at this file. COMPANION to CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md.
     Scope: the theme PLATFORM backend (packages/api-client, services/*, database/*). Owns every CROSS-boundary contract the
     marketplace (frontend) mission must SKIP. Safe to run IN PARALLEL with the marketplace mission — ownership does not overlap.
     LOCATION NOTE: lives under docs/themes-marketplace-audit/ (NOT root, NOT under apps/services/packages) per source-ledger-residue-validator. -->

# CODEX MISSION — Theme Platform Backend (companion / cross-boundary, single go)

You are Codex operating **locally** on the LetBuyy monorepo. This mission delivers the **backend/platform contracts** that make the Theme Marketplace *fundamentally strong* — the work the frontend mission (`CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md`) explicitly **SKIPs as cross-boundary**: reviews, payment settlement/receipts, refunds, real downloads, settings persistence, **a seeded starter catalog + industry taxonomy**, and the developer-program backend. Where a step needs a human/legal/secret decision or live infra, **do not stop** — implement locally, then mark the remainder `SKIPPED` with a reason/contract and continue. Status vocabulary matches prior missions (`DONE`, `DONE locally/SKIPPED live`, `DONE/SKIPPED human-gated`).

## 0. Authority & required reading
Authority order: root `AGENTS.md` → the owning runtime's `AGENTS.md` (e.g. `services/api-gateway/AGENTS.md`, `packages/*/AGENTS.md`) → `docs/governance/*` → this mission. **AGENTS.md wins** on conflict; log conflicts.

Read first (evidence + contracts):
- `docs/LETBUYY_THEMES_MARKETPLACE_MASTER_AUDIT.md` (Top 100), and the companion audit docs in `docs/themes-marketplace-audit/`.
- `docs/themes-marketplace-audit/CODEX_THEME_MARKETPLACE_FOUNDATION_MISSION.md` — **its §8 "CROSS-BOUNDARY CONTRACTS" is your inbound work order.** If that mission has already run, read its generated `CODEX_THEME_MARKETPLACE_FOUNDATION_LEDGER.md` → "CROSS-BOUNDARY CONTRACTS" for the exact endpoints it stubbed.
- `docs/themes-marketplace-audit/THEME_REVIEW_SYSTEM_AUDIT.md`, `THEME_INSTALLATION_JOURNEY_AUDIT.md`, `DEVELOPER_TRUST_SCORECARD.md`, `LETBUYY_THEME_MARKETPLACE_V2.md`.
- Existing patterns to mirror: `packages/typescript/api-client/src/index.ts` (themes resource ~lines 1462–1496; `ThemeReview` in `packages/theme-engine/src/index.ts:1021-1033`; `orders.refund` ~`:1290`; ops review queue `/operations/marketplace-reviews` ~`:1179`); the seed/verification convention `database/supabase/seeds/urban-kicks-theme.sql` + `database/supabase/verification/055_only_urban_kicks_theme_catalog.sql`; migrations under `database/supabase/migrations/`.

---

## 1. OWNERSHIP & BOUNDARY (single domain: theme platform backend)

**You OWN and may modify:**
- `packages/typescript/api-client/**` — **additively only** (new methods/types; never change or remove existing exported symbols or signatures).
- `packages/theme-engine/**` — additively only, and only if new shared types are required (e.g. review payloads). Prefer reusing `ThemeReview`.
- `services/**` — theme-related gateway routes, settlement/webhook handlers, workers (reviews, receipts/licenses, refunds, downloads, settings, developer program), following existing route/AGENTS conventions in each service.
- `database/**` — new migrations (single migration root `database/supabase/migrations/`), idempotent seeds (`database/supabase/seeds/`), and verification harnesses (`database/supabase/verification/`).
- Your two tracking files **under docs (NOT root):** `docs/themes-marketplace-audit/CODEX_THEME_PLATFORM_BACKEND_LEDGER.md`, `docs/themes-marketplace-audit/CODEX_THEME_PLATFORM_BACKEND_STATUS.md`.

**You MUST NOT touch (these belong to the parallel marketplace mission / other runtimes):**
- `apps/**` — **especially `apps/theme-marketplace/**`** (owned by the frontend mission). Do not edit any app. If an app must consume your new surface, that wiring is the frontend mission's job; you only ship the package/service/DB side.
- Other runtimes' `services` you don't own for this domain, `infrastructure/**`, `legacy/**`, `generated-artifacts/**`.
- Root shared/config (`AGENTS.md`, root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`), `scripts/**` (incl. governance validators — consume only), any other mission's `CODEX_*` files.
- **Do NOT create `CODEX*.md` at repo root or under `apps/`, `services/`, `packages/`** (`source-ledger-residue-validator` forbids it). Your ledger/status live under `docs/themes-marketplace-audit/` only.
- **Do not hand-edit any `AGENTS.md`**; defer regeneration to the final coordination pass (SKIP).

**PARALLEL-EXECUTION CONTRACT (critical):** the marketplace mission runs concurrently and **consumes** your packages. Therefore your `@letbuyy/api-client` / `@letbuyy/theme-engine` changes must be **strictly additive and backward-compatible** — the parallel app must keep typechecking/building against the existing surface at all times. New endpoints land behind clear method names the app can adopt later; never rename/remove/repurpose existing exports or change existing route response shapes.

---

## 2. PRIME DIRECTIVES
1. **Additive, backward-compatible surface.** Never break the existing `api-client`/`theme-engine`/route contracts the parallel app depends on.
2. **Honest data, no fabricated metrics.** Seeded themes start with real-zero counts (install/review/purchase = 0, no fake ratings). No inflated social proof. (Mirrors the frontend honesty rule.)
3. **Single-source invariants.** Respect existing governance single-source rules (INR formatting via `@letbuyy/ui/formatting`, crypto via the api-gateway crypto lib, one Supabase migration root, etc.). Do not duplicate.
4. **Security first.** No secrets in code; settlement/refund/webhook handlers verify provider signatures; verified-purchase gating on reviews; authz + rate-limit on upload/download; tenant/ownership checks on every store-scoped op.
5. **Idempotent, reversible migrations & seeds.** Follow the existing migration numbering and the `verification/` harness pattern; seeds re-runnable without dupes.
6. **Green gates always** (§5). Never leave a package/service non-building.
7. **Log everything** in the ledger with evidence.

---

## 3. CLASSIFICATION PROTOCOL
- **`IN` — implement now** (lives in packages/services/database you own).
- **`LIVE` — implement locally, SKIP live execution** (needs real provider keys, real KMS, or a live DB/migration apply). Build code + local/dry-run verification; log `DONE locally/SKIPPED live`.
- **`HUMAN` — SKIP + DEFAULT** (revenue-share %, legal/refund policy text, production theme creative/marketing content, brand). Apply the DEFAULT in §7, log `DONE/SKIPPED human-gated`.

---

## 4. WORKFLOW
1. **Baseline:** record gate results (§5) + worktree state (note unrelated parallel `CODEX_*` churn you will NOT touch).
2. Work phases **BE-P0 → BE-P5** in order.
3. After each phase: run gates, append ledger entries.
4. **Final:** gates green for your changes; write STATUS (per-phase DONE/SKIPPED counts) and an "integration handoff" list telling the marketplace mission exactly which new `api-client` methods/routes are now available to wire.
5. **Local only.** No deploys, no prod, no live secrets.

---

## 5. VERIFICATION GATES (after each phase + final)
```bash
pnpm --filter @letbuyy/api-client typecheck && pnpm --filter @letbuyy/api-client build
pnpm --filter @letbuyy/theme-engine typecheck && pnpm --filter @letbuyy/theme-engine test
# the owning service(s): discover scripts from their package.json, e.g.
pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway test
node --test tests/**/*theme*.test.mjs                  # extend federation/theme tests; keep all green
# migrations: apply to a LOCAL db if available, else dry-run/validate SQL + run the verification harness pattern
pnpm run validate:governance                            # == node scripts/validate-governance.mjs
```
Acceptance: typecheck/build/test pass for everything you changed; governance reports no **new** failures from your changes; migration verification passes locally (or `SKIPPED live` with the verification SQL written). Backward-compat check: the existing api-client public surface is unchanged except additions.

---

## 6. PHASES (deliver the marketplace mission's CROSS contracts)

### BE-P0 — Payments truth & safety
- **Settlement → receipt + license issuance.** Implement the provider settlement path so a verified Razorpay purchase issues a real receipt + license key and flips purchase status to `completed` (kills the frontend's `[SKIP - NEEDS BACKEND]` dependency on `/checkout/success`). Signature-verify the webhook/callback. `LIVE` for real keys → build + local test, `SKIPPED live`.
- **Identity/session `me`** read endpoint + `api-client` method so the app can hydrate the logged-in user (fixes the "always shows User" gap) — `IN` if not already present.
- **Upload hardening:** server-side authz + rate-limit + size caps + asset/bundle scanning on `/themes/packages/upload` (beyond JSON-shape validation). `IN` (scan hooks) / `LIVE` (external scanner).

### BE-P1 — Catalog & discovery data (seed a real starter catalog)
- **Starter catalog seed.** Add idempotent seeds for a **starter set of functional first-party sample themes — at least 2 per category** across `store, portfolio, resume, landing, saas` — modeled on `database/supabase/seeds/urban-kicks-theme.sql` (renderer/schema manifests, templates, section definitions, presets). **Honest metadata:** zero install/review/purchase counts, no fabricated ratings. Add a `verification/` harness like `055_*`. Production-grade creative themes & marketing copy = `HUMAN` (SKIP — seed clearly-labelled samples now).
- **Industry taxonomy seed** so `themes.industries()` returns real options.
- **Catalog query params** the app needs but the API lacks: add `price_min`/`price_max` and `layout`/`site_type` filter support to the catalog endpoint + `listCatalog` (additive) so the frontend can re-enable those filters.
- **Ranking/trending + collections** data model + read endpoints (composite rank: rating × installs × recency); `IN` (schema + endpoints), curation content = `HUMAN`.

### BE-P2 — Reviews & trust
- **Reviews API:** `theme_reviews` table + gateway routes + `api-client` methods `themes.reviews(slug, query)` (list, published only) and `themes.createReview(slug, input)` (**verified-purchase gated**, moderation status `pending`), backed by the existing `ThemeReview` model. Ratings aggregation (avg + distribution) on the theme record. Developer reply path.
- **Author profiles** read API (`themes.author(handle)`): portfolio, aggregate rating, support SLA.

### BE-P3 — Lifecycle: downloads, refunds, settings
- **Downloads:** artifact generation + **signed-URL** endpoint per platform (`letbuyy/wordpress/html/react`) returning **real file sizes**; entitlement-checked (purchased/owned). `IN` (endpoint + sizing) / `LIVE` (object storage).
- **Refunds:** theme-purchase refund path using/extending `orders.refund`; status transitions to `refunded`; policy fields. Policy text/window = `HUMAN`.
- **Settings persistence:** profile + notification-preference storage + endpoints so the app's Settings page persists.

### BE-P4 — Developer program backend
- **Listing/submission persistence:** listing records (assets, screenshots, pricing, license tiers, category/industry tags) + submission lifecycle states (`submitted → in_review → changes_requested → approved/rejected`) reusing the ops review queue (`/operations/marketplace-reviews` + `/decision`), with written-feedback fields.
- **Developer analytics** read endpoints (views → install/purchase funnel, revenue, refunds).
- **Revenue share & payouts** data model + endpoints. The **rate/payout terms = `HUMAN`** (default display "TBD pending program terms"); build the structure now.
- **Author verification** flag/model.

### BE-P5 — Hardening & handoff
- Tests for every new route/method (unit + the `tests/federation/*theme*` suite); migration verification harnesses; backward-compat surface assertion; governance single-source compliance. Write the **integration handoff** (new method/route inventory) for the marketplace mission to wire.

---

## 7. DEFAULT DECISIONS (apply now; flag `SKIPPED human-gated`)
- **D-1 Pricing model:** RATIFIED = **per-theme one-time purchase**. Build settlement/receipts/refunds/licensing for one-time theme purchases. Do **not** build subscription billing (separate future mission).
- **D-2 Revenue share:** DEFAULT = model the structure with rate held as config (display "TBD"); the **% and payout schedule = HUMAN (SKIP)**. (Benchmark reference: Shopify 15% — not a commitment.)
- **D-3 Seeded catalog:** DEFAULT = functional first-party **sample** themes with honest zero metrics; production creative catalog & copy = HUMAN (SKIP).
- **D-4 Refund policy:** DEFAULT = build the refund mechanism; the **policy window/terms text = HUMAN (SKIP)**.
- **D-5 Payments/geo:** DEFAULT = Razorpay/INR settlement now; Stripe/global rails = HUMAN/LIVE (SKIP).
- **D-6 Live execution:** DEFAULT = all migrations/seeds/provider integrations are built + locally verified; **live apply/keys = SKIPPED live**.
- **D-7 Generated intelligence & root residue:** do not regenerate `AGENTS.md`, do not create root `CODEX_*` (final coordination pass).

---

## 8. LEDGER & STATUS (under docs/themes-marketplace-audit/, NOT root)
Create `CODEX_THEME_PLATFORM_BACKEND_LEDGER.md` (ARCHITECTURE DECISIONS D-1…D-7 · BASELINE · PROGRESS LOG · **INTEGRATION HANDOFF**: new api-client methods + routes now available) and `CODEX_THEME_PLATFORM_BACKEND_STATUS.md` (per-phase DONE/SKIPPED-live/SKIPPED-human counts, final gate output, handoff summary). Progress line format:
`- <ISO8601Z> [BE-P{n}] <contract> - <STATUS> - evidence: <files/cmd>`

---

## 9. DEFINITION OF DONE
- Every CROSS-BOUNDARY CONTRACT from the marketplace mission has a terminal status (DONE / DONE locally-SKIPPED live / SKIPPED human-gated) + evidence.
- Reviews, settlement+receipt/license, refunds, downloads (real sizes/signed URLs), settings persistence, **seeded starter catalog (≥2 themes/category) + industry taxonomy**, and the developer-program backend are implemented locally with tests + migration verification.
- `api-client`/`theme-engine` changes are **additive & backward-compatible** (parallel app never breaks); a surface-diff confirms only additions.
- §5 gates pass for your changes; governance shows no new failures from you.
- `git status` shows changes **only** under `packages/**`, `services/**`, `database/**`, and the two `docs/themes-marketplace-audit/CODEX_THEME_PLATFORM_BACKEND_*` files — **nothing under `apps/**`**, no new root `CODEX_*`.
- INTEGRATION HANDOFF written so the marketplace mission can flip its feature flags and wire the new surface.

**Begin with BASELINE, then BE-P0. Build the whole contract list in one go. When in doubt: keep it additive, keep it honest (zero fake metrics), keep it out of `apps/**`, log it, and continue.**
