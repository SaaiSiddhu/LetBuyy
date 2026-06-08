<!-- CODEX MISSION PROMPT. Paste this entire file to Codex, or point Codex at this path. Single-go, autonomous. Scope: FINISH the LetBuyy Apps Marketplace UI/UX parity by building the §7 DATA LAYER that the prior UI/UX run skipped. Spec: docs/apps-marketplace-audit/SHOPIFY_APP_STORE_UIUX_TEARDOWN.md. Prior mission: docs/apps-marketplace-audit/CODEX_APPS_MARKETPLACE_UIUX_MISSION.md. -->

# CODEX MISSION — Apps Marketplace UI/UX Parity, Wave 9: Data-Backed Parity (completion pass)

> **You are Codex.** The prior UI/UX run shipped the **visual** layer (tokens, component kit, mega-menu, home/category/`/all`/search/detail/stories pages) but **skipped almost the entire data layer** it was told to build — and then marked the mission "complete." It added **no new marketplace migrations**, so feature facets, app awards, review provenance, the "What merchants think" summary, and story editorial bodies are **empty slots with no backing data**. Your job: **build that data layer end-to-end** (DB → gateway → api-client → BFF → UI) so the parity surfaces show **real data**, in a **single autonomous run**. Read this whole file first.

This is a **finish-it** pass. The bar is: the slots the last run left empty now render real, queryable data — or, where genuinely human-owned, an honest empty state with the *build* complete behind it.

---

## 0. The one rule that was broken last time (read first)

**"SKIPPED (HUMAN-APPROVAL)" DOES NOT MEAN "data I would have to build."** The previous run skipped building tables, endpoints, and wiring by calling them human-approval items. That is wrong and forbidden here.

- **BUILD (never skip):** migrations, RLS, gateway read/filter endpoints, `@letbuyy/api-client` methods, `shared-types` DTOs, BFF action branches, and the UI wiring that renders the data. Seeding a **taxonomy** (structural reference data) is BUILD work, not content.
- **SKIP (the only allowed skips):** marketing/editorial **copy & imagery**, design **assets** (hero video/illustration), an external **AI provider's keys/credentials**, **sold** sponsored inventory & pricing, final **program criteria sign-off**, and applying a migration to **staging/prod**. For each, build the table/endpoint/UI + an honest empty state, apply the migration **locally**, and log only the human bit as `SKIPPED (HUMAN-APPROVAL)`.

**Completion contract:** a §3 item is `DONE` only when its migration is **applied locally**, the gateway returns **real** data, and the UI **renders** it. `PARTIAL` is allowed only when a *strictly human-only* dependency remains (copy/asset/AI-keys/sold-inventory) — and even then the full build + honest empty must be in place. **Marking an item SKIPPED because "it needs data" is a mission failure.**

---

## 1. Non-negotiables (carry over + reinforce)

1. **Build on the existing work; don't redo the visual layer.** Read `CODEX_APPS_MARKETPLACE_UIUX_STATUS.md` + `_LEDGER.md` and the prior mission. The components and pages exist — you are **wiring real data into them**, not rebuilding them.
2. **Truth over theater.** Real data or honest empty/loading/error — never fake. Gate every surface on real data depth.
3. **Governance is law.** `node scripts/validate-governance.mjs` green after every sub-wave (ignore only the known unrelated `apps/theme-marketplace` hardcoded-domain failure). Single-writer table ownership, route files ≤1500 lines (split modules), single-source helpers, topology honesty.
4. **No new Next API route files.** Extend the existing BFF multiplexers with `action:` branches (`api/apps/route.ts`, `api/apps/search/route.ts`, `api/apps/[id]/route.ts`, `api/developers/apps/route.ts`, …).
5. **Use `@letbuyy/ui` primitives + `next/image`** (no raw `<input>`/`<img>`/unstyled `<button>`). Reuse `FilterBar`/`FilterChips`/`Drawer`/`Accordion`/`Badge`. Shared-package changes **additive & backwards-compatible**.
6. **Migrations forward-only** (`database/supabase/migrations/NNN_*.sql`, next number after the current highest), each with **real RLS** (service-role + owner/tenant predicate) and a single declared writer; **apply locally**; prod apply = the only migration SKIP.
7. **Green before done:** typecheck/lint/test/build for every touched workspace + governance, each sub-wave. Next build may run outside the sandbox (documented).
8. **Evidence:** every item gets a ledger row (files + how verified + the grep/seed/test proof). Update the **existing** `CODEX_APPS_MARKETPLACE_UIUX_LEDGER.md`/`_STATUS.md` (correct the inflated "complete" rollup to reality).

---

## 2. Exact current state (verified) — what to fix

| SPEC surface | Current reality | What's missing (BUILD) |
|---|---|---|
| Feature facets (§5.3 FilterRail) + Feature tags (§5.5E) | **Absent.** Zero `feature_handles` in app/gateway/db. `/all` has only category/pricing/rating/program filters. `FeatureTagGroups` is a shell that says "when taxonomy data exists" and renders nothing. | Feature taxonomy table + per-app tags + seed; gateway `feature_handles[]` filter; FilterRail facet groups; real FeatureTagGroups; chips → `/all?feature_handles[]=` |
| App awards (§5.5A) | **Absent.** No `app_awards`; header/badge have no award data. | `app_awards` table + read + render; QualityBadge tie-in |
| Review provenance (§5.5G) | **Absent.** No country / "duration using the app" on reviews. | country (from store/site) + duration (derived from install date) on review payload + render |
| "What merchants think" (§5.5G) | UI slot only; no data, no generation. | summary storage + generation hook + render; honest "no summary yet" |
| Stories/collections (§5.6) | Thin view over V2 `app_collections`; no editorial body. | editorial body column(s) + read + render; content = SKIP |
| Sponsored rail (§5.2) | Verify it's wired to the V2 featured model + labeled. | wire/label if not; sold inventory = SKIP |
| Rollup honesty | STATUS claims "13 DONE / 0 PARTIAL / complete"; ledger has no skip rows; data layer absent. | correct the rollup to reflect real DONE/PARTIAL |

No new marketplace migrations exist beyond V2's (108–111 are unrelated orders/customer work). Start your migration numbering after the current highest.

---

## 3. The work (sub-waves) — build the data layer

### W9.1 — Feature-facet taxonomy + faceted filtering (the headline gap)

This is the defining capability of Shopify's `/all` and the biggest miss. Build end-to-end:

- **DB** [migration]: `app_feature_groups` (category_id → group handle + label + display order) and `app_feature_tags` (handle + label + group), plus a join `app_feature_tag_assignments` (app_id → feature tag). RLS (service-role + public read of published taxonomy; writer = the app-store developer/ops route). Single writer declared.
- **Seed** [migration or seed script]: populate the taxonomy for the existing LetBuyy categories using the SPEC §5.3 facet lists as the structural model (e.g. Product reviews → *Display options*: testimonials, photo/video reviews, star ratings, badges, carousels, …; *Ways to collect*: email/SMS/push requests, social UGC, forms, surveys, QR codes, …). This is **reference data = BUILD**, not editorial content. Assign tags to the seeded first-party demo apps so facets return real results.
- **Gateway** [extend `app-store` list route]: accept `feature_handles[]` and filter the catalog by tag assignments (AND semantics across selected facets). Return available facet groups+counts for a category.
- **api-client + shared-types**: additive method to fetch a category's facet groups; extend the list query with `feature_handles[]`; DTOs.
- **UI**: `FilterRail` renders the facet groups (reuse `FilterBar`/`FilterChips`) on `/categories/[slug]/all` **and** search; each toggle updates URL `?feature_handles[]=` + results (server-side). Replace the degenerate `FeatureTagGroups` (in `AppDetailParity.tsx`) with one driven by the app's **real** assigned tags, each chip linking to `/all?feature_handles[]=`. If a category genuinely has no taxonomy rows, hide its facet group (honest) — but the seed means major categories DO have them.

**Acceptance:** `grep -r feature_handles services apps database` returns matches; selecting a facet changes results + URL server-side; app-detail feature chips render real tags and link to filtered browse.

### W9.2 — App awards

- **DB** [migration]: `app_awards` (app_id → award key, label, year, blurb). RLS; writer = ops/admin route. 
- **Gateway/api-client/shared-types**: read awards for an app (additive).
- **UI**: render awards in the app-detail header (SPEC §5.5A) and tie the QualityBadge "Built for LetBuyy" to real award/program data. Awarding **criteria sign-off** = SKIP (business); the awarding **write path** (ops) = BUILD.

### W9.3 — Review provenance (country + duration)

- **Data**: add reviewer **country** (from the store/site profile) and **duration using the app** (derived from the installation's `installed_at` → "Over N years/months using the app") to the review read payload. Additive columns or server-side derivation; no fake values — only show when the underlying install/store data exists.
- **Gateway/api-client/shared-types + UI**: extend the reviews read + render provenance in the review list (SPEC §5.5G). Keep verified-install gating.

### W9.4 — "What merchants think" summary

- **DB** [migration]: `app_review_summaries` (app_id → summary text, generated_at, model/source, eligibility snapshot). RLS; single writer.
- **Generation hook** [gateway/queue, BUILD]: a job/endpoint that produces the summary when an app has ≥100 reviews and ≥4.0 rating (SPEC threshold). Wire it to the platform's existing inference path **if one is available behind a flag**; otherwise leave the hook callable and the summary empty. The external **AI provider keys** = the only SKIP here.
- **UI**: render the summary slot + Helpful/Not-helpful + honest "no summary yet" when absent (already slotted).

### W9.5 — Story/collection editorial bodies

- **DB** [migration]: extend `app_collections` (or a new `app_collection_sections`) with an editorial **body** (ordered sections: rich text + app callouts). RLS; writer = ops/admin.
- **Gateway/api-client/UI**: read + render the body on `/stories/[slug]` and `/collections/[slug]`. Editorial **copy/imagery** = SKIP; the **content type + rendering** = BUILD. Collections/stories gate on real membership.

### W9.6 — Sponsored/featured rail (verify + finish)

Confirm the category "Sponsored apps" rail and home featured rail are wired to the **V2 featured/sponsored model** and clearly **labeled**. If labeling or wiring is missing, build it. **Sold** inventory/pricing/business rules = SKIP.

### W9.7 — Verify & correct the record

Full gates + governance + regenerate intelligence. **Rewrite the UIUX STATUS/LEDGER rollup to the truth:** mark W9 items `DONE` (built + local-applied + rendering) or `PARTIAL` (only the human bit pending), and fix the prior inflated "complete/0 PARTIAL" claim.

---

## 4. Data-model & ownership notes

- All new tables: PK, FKs, indexes, `updated_at` trigger, **real RLS** (service-role full + public read for published taxonomy/awards/summaries/story bodies; owner/ops write), and a **single declared writer module** (register where the validator expects). Match the pattern of the newer V2 tables (real RLS), not the legacy blanket-`service_role` tables.
- Tenant scope via `site_id` where tenant-scoped; taxonomy/awards/summaries are app-scoped (not tenant) and globally readable when published.
- Keep migrations forward-only; apply locally (the local Supabase migration-history mismatch noted in V2 may require the same documented local-apply handling — record it; prod apply = SKIP).

## 5. Anti-skip enforcement & verification mandate

Before declaring the mission complete, run and record these proofs (a clean result is required):
```bash
grep -rl "feature_handles" services/api-gateway/src apps/app-marketplace/src   # must match (W9.1)
grep -rl "app_awards"        database services packages                         # must match (W9.2)
grep -rl "app_review_summaries\|review_summaries" database services             # must match (W9.4)
ls database/supabase/migrations | tail                                          # new NNN_* migrations present
```
If any required proof is empty, the corresponding item is **not** done — keep working; do not mark it SKIPPED.

## 6. Green gates & Definition of Done

```bash
pnpm --filter @letbuyy/app-marketplace typecheck && pnpm --filter @letbuyy/app-marketplace lint && pnpm --filter @letbuyy/app-marketplace test && pnpm --filter @letbuyy/app-marketplace build
pnpm --filter @letbuyy/ui typecheck && pnpm --filter @letbuyy/ui build
pnpm --filter @letbuyy/api-client typecheck && pnpm --filter @letbuyy/api-client build
pnpm --filter @letbuyy/shared-types typecheck && pnpm --filter @letbuyy/shared-types build
pnpm --filter @letbuyy/api-gateway typecheck && pnpm --filter @letbuyy/api-gateway build && pnpm --filter @letbuyy/api-gateway test
# apply new migrations LOCALLY and verify; prod apply = SKIP
node scripts/validate-governance.mjs           # green except the known theme-marketplace failure
node scripts/generate-repository-intelligence.mjs
```
**Mission complete when:** every §3 item is `DONE` (built + local-applied + rendering real data) or `PARTIAL` with a *strictly human-only* remainder; the §5 proofs all match; no fake data; the UIUX STATUS/LEDGER rollup is corrected to the truth; all gates + governance green; intelligence regenerated.

## 7. First actions

1. Read this file, `docs/apps-marketplace-audit/SHOPIFY_APP_STORE_UIUX_TEARDOWN.md` (§5.3, §5.5, §7), the prior UIUX mission, and `CODEX_APPS_MARKETPLACE_UIUX_STATUS.md`/`_LEDGER.md`.
2. Confirm the §2 gaps with the §5 grep proofs (they should currently be empty — that's the work).
3. Baseline the §6 gates; record it.
4. Execute **W9.1 → W9.7** without stopping; build the data layer (never skip it); apply migrations locally; keep governance green; correct the rollup.

> The bar: the parity slots the last run left empty now render **real, queryable data** — feature facets you can filter by, awards/provenance/summaries that come from the database, stories with real bodies — branded LetBuyy, theater-free. Build the data layer. Do not skip what you can build.
